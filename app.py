# =============================================
# Imports & Environment Setup
# =============================================
import os
import psycopg2
import requests
import uuid
import json
import csv
import io
from datetime import datetime, date
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request, render_template, Response, redirect, url_for, flash, session
from flask_cors import CORS
from psycopg2 import sql
from supabase import create_client, Client

# =============================================
# Flask App Initialization & Config
# =============================================
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20MB

# REQUIRED FOR FLASH MESSAGES:
app.secret_key = os.environ.get("SECRET_KEY", "fallback-secret-key-for-development")

# =============================================
# Database & Supabase Configuration
# =============================================
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

# Render Postgres often requires sslmode=require
if "sslmode=" not in DATABASE_URL:
    DATABASE_URL += ("&" if "?" in DATABASE_URL else "?") + "sslmode=require"

print("DB:", os.getenv("DATABASE_URL"))

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

print("--- ENVIRONMENT DEBUG ---")
print("SUPABASE_URL loaded:", bool(os.environ.get("SUPABASE_URL")))
print("SUPABASE_PUBLISHABLE_KEY loaded:", bool(os.environ.get("SUPABASE_PUBLISHABLE_KEY")))
print("DEBUG URL:", os.environ.get("SUPABASE_URL"))
print("DEBUG KEY:", os.environ.get("SUPABASE_PUBLISHABLE_KEY"))
supabase: Client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
print("-------------------------")


# =============================================
# Environment / CORS
# =============================================
ENV = os.environ.get("FLASK_ENV", "production")

if ENV == "development":
    CORS(app, origins=["http://127.0.0.1:5500", "http://localhost:5500"])
else:
    CORS(
        app,
        origins=[
            "https://emma-and-ethans-wedding-site.onrender.com",
            "https://emmaandethan.com",
            "https://www.emmaandethan.com",
        ],
    )

# =============================================
# Constants & Deadline Logic (Pacific Time)
# =============================================
ROLE_RANK = {"viewer": 1, "editor": 2, "admin": 3}

# Define your exact deadline in Pacific Time (May 15, 2027 at 12:00:00 AM PT)
RSVP_DEADLINE = datetime(2027, 5, 15, 0, 0, 0, tzinfo=ZoneInfo("US/Pacific"))

def check_is_post_deadline():
    return datetime.now(ZoneInfo("US/Pacific")) >= RSVP_DEADLINE

# =============================================
# Authentication & Role Helpers
# =============================================
def require_user(min_role="viewer"):
    """
    Requires a valid Supabase session token (Authorization: Bearer <token>),
    loads the user's profile from `profiles`, and enforces a minimum role.

    Returns: (ctx, err)
      - ctx = {"user": <supabase_user_json>, "profile": <profile_dict>}
      - err = (jsonify(...), status_code) or None
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None, (jsonify({"error": "Missing Authorization bearer token"}), 401)

    token = auth.split(" ", 1)[1].strip()
    if not token:
        return None, (jsonify({"error": "Missing token"}), 401)

    # Verify token with Supabase
    try:
        resp = requests.get(
            f"{SUPABASE_URL.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {token}",
            },
            timeout=10,
        )
    except Exception as e:
        return None, (jsonify({"error": f"Auth service unreachable: {str(e)}"}), 502)

    if resp.status_code != 200:
        return None, (jsonify({"error": "Invalid/expired session"}), 401)

    sb_user = resp.json()

    # Load profile row
    profile = get_profile(sb_user["id"])
    if not profile:
        return None, (jsonify({"error": "No profile row for this user"}), 403)

    # Enforce role
    role = (profile.get("role") or "viewer").lower().strip()
    need = (min_role or "viewer").lower().strip()

    if ROLE_RANK.get(role, 0) < ROLE_RANK.get(need, 0):
        return None, (jsonify({"error": "Forbidden"}), 403)

    ctx = {
        "user": {"id": sb_user.get("id"), "email": sb_user.get("email")},
        "profile": profile,
    }
    return ctx, None

def require_service_key():
    """
    Service role key is required for server-side storage operations
    (uploads, signed URLs, listing private objects).
    """
    if not SUPABASE_SECRET_KEY:
        return None, (jsonify({"error": "Storage not configured (missing SUPABASE_SECRET_KEY)."}), 500)
    return SUPABASE_SECRET_KEY, None

def format_last_updated(val):
    if not val:
        return '—'
    
    # Parse string to datetime if necessary
    if isinstance(val, str):
        try:
            val = datetime.fromisoformat(val)
        except ValueError:
            return '—'
            
    val_date = val.date() if isinstance(val, datetime) else val
    today = date.today()
    delta_days = (today - val_date).days
    
    if delta_days == 0:
        return 'Today'
    elif delta_days == 1:
        return 'Yesterday'
    else:
        # Format as "Jul 7" for anything older than yesterday
        try:
            return val_date.strftime('%b %-d')
        except ValueError:
            # Fallback for Windows systems if %-d throws an error
            return val_date.strftime('%b %#d')

# app.py - Add with other helper functions
from decimal import Decimal # Ensure Decimal is imported


# app.py - Near other helper functions
from decimal import Decimal

def get_guest_price(age_group):
    """
    Returns the price and a simple display tier based on computed_age_group.
    """
    if age_group == 'under_12':
        return Decimal('45.00'), 'under_12'
    elif age_group == '12_to_21':
        return Decimal('75.00'), 'under_21'
    elif age_group == '21_plus':
        return Decimal('115.25'), '21_plus'
    else:
        # Fallback (e.g., if age group computation is empty)
        return Decimal('115.25'), '21_plus'

def get_profile(user_id: str):
    conn = get_db_connection()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            # Added household_id to the SELECT
            cur.execute(
                "SELECT id, role, full_name, display_role, theme_color, household_id FROM profiles WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "id": row[0], "role": row[1], "full_name": row[2], 
                "display_role": row[3], "theme_color": row[4], 
                "household_id": row[5] # <-- Added this!
            }
    finally:
        conn.close()

@app.route("/api/me", methods=["GET"])
def api_me():
    ctx, err = require_user()
    if err:
        return err

    return jsonify({
        "user": ctx["user"],
        "profile": ctx["profile"]
    })

# -----------------------------
# DB helpers
# -----------------------------
def get_db_connection():
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"!!! DB CONNECTION ERROR: {e}")
        return None


def get_data_from_query(query, params=None):
    conn = get_db_connection()
    if not conn:
        return None, "Database unavailable."
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            column_names = [desc[0] for desc in cur.description]
            data = [dict(zip(column_names, row)) for row in rows]
        return data, None
    except Exception as e:
        print(f"!!! QUERY ERROR: {e}")
        return None, str(e)
    finally:
        conn.close()


# -----------------------------
# Dashboard / Guests / Parties
# -----------------------------
@app.route("/api/dashboard/metrics", methods=["GET"])
def get_dashboard_metrics():
    ctx, err = require_user()
    if err:
        return err

    query = sql.SQL("SELECT * FROM dashboard_stats;")
    stats, error = get_data_from_query(query)
    if error or not stats:
        return jsonify({"error": "Could not load stats"}), 500
    return jsonify(stats[0])


@app.route("/api/guests", methods=["GET"])
def get_guests():
    ctx, err = require_user()
    if err:
        return err

    query = sql.SQL(
        """
        SELECT id, legacy_key AS "partyName", address_street AS street,
               address_street2 AS street2, address_city AS city,
               address_state AS state, address_zip AS zip,
               is_address_collected AS "isAddressCollected"
        FROM parties ORDER BY legacy_key ASC;
        """
    )
    parties, error = get_data_from_query(query)
    return jsonify(parties) if not error else (jsonify({"error": error}), 500)


@app.route("/api/guestlist", methods=["GET"])
def get_guestlist():
    ctx, err = require_user()
    if err:
        return err

    query = sql.SQL(
        """
        SELECT
            g.id AS guest_id,
            g.party_id,
            g.first_name,
            g.last_name,
            (g.first_name || ' ' || g.last_name) AS name,
            p.legacy_key AS party,
            g.rsvp_status AS rsvp,
            g.welcome_dinner_rsvp AS "welcomeRSVP",
            g.lodging,
            g.dietary_restrictions AS dietaryrequest,
            g.table_number AS tablenumber,
            g.side,
            g.relationship AS relation,
            g.is_21_plus AS "is21Plus",
            g.updated_at AS last_updated
        FROM guests g
        JOIN parties p ON g.party_id = p.id
        WHERE (g.record_status IS NULL OR g.record_status = 'active')
        ORDER BY p.legacy_key, g.first_name;
        """
    )
    guest_list, error = get_data_from_query(query)
    return jsonify(guest_list) if not error else (jsonify({"error": error}), 500)


@app.route("/api/guests/<guest_id>", methods=["PATCH"])
def update_guest(guest_id):
    ctx, err = require_user()
    if err:
        return err

    payload = request.get_json(force=True) or {}

    allowed = {
        "first_name",
        "last_name",
        "rsvp_status",
        "welcome_dinner_rsvp",
        "lodging",
        "dietary_restrictions",
        "table_number",
        "side",
        "relationship",
    }

    updates = {k: v for k, v in payload.items() if k in allowed}
    if not updates:
        return jsonify({"error": "No valid fields provided"}), 400

    set_parts = []
    values = []
    for k, v in updates.items():
        set_parts.append(sql.SQL("{} = %s").format(sql.Identifier(k)))
        values.append(v)

    values.append(guest_id)

    query = sql.SQL("UPDATE guests SET {sets} WHERE id = %s RETURNING id;").format(
        sets=sql.SQL(", ").join(set_parts)
    )

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        with conn.cursor() as cur:
            cur.execute(query, values)
            row = cur.fetchone()
            conn.commit()
            if not row:
                return jsonify({"error": "Guest not found"}), 404
        return jsonify({"ok": True, "id": guest_id})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/parties/<party_id>", methods=["GET"])
def get_party_details(party_id):
    ctx, err = require_user()
    if err:
        return err

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, display_name,
                       address_street, address_street2, address_city, address_state, address_zip
                FROM parties
                WHERE id = %s;
                """,
                (party_id,),
            )
            party_row = cur.fetchone()
            if not party_row:
                return jsonify({"error": "Party not found"}), 404

            party_cols = [d[0] for d in cur.description]
            party = dict(zip(party_cols, party_row))

            cur.execute(
                """
                SELECT
                    id AS guest_id,
                    first_name,
                    last_name,
                    rsvp_status AS rsvp,
                    welcome_dinner_rsvp AS "welcomeRSVP",
                    lodging,
                    dietary_restrictions AS dietaryrequest,
                    table_number AS tablenumber,
                    side,
                    relationship AS relation,
                    is_21_plus AS "is21Plus",
                    updated_at AS last_updated
                FROM guests
                WHERE party_id = %s AND (record_status IS NULL OR record_status = 'active')
                ORDER BY last_name, first_name;
                """,
                (party_id,),
            )

            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            members = [dict(zip(cols, r)) for r in rows]

        return jsonify({"party": party, "members": members})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/parties/<party_id>", methods=["PATCH"])
def update_party(party_id):
    ctx, err = require_user()
    if err:
        return err

    payload = request.get_json(force=True) or {}

    allowed = {
        "address_street",
        "address_street2",
        "address_city",
        "address_state",
        "address_zip",
        "is_address_collected",
    }

    updates = {k: v for k, v in payload.items() if k in allowed}
    if not updates:
        return jsonify({"error": "No valid fields provided"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        required_keys = ["address_street", "address_city", "address_state", "address_zip"]
        if any(k in updates for k in required_keys):
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT address_street, address_city, address_state, address_zip
                    FROM parties
                    WHERE id = %s;
                    """,
                    (party_id,),
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "Party not found"}), 404

            existing = dict(zip(required_keys, row))
            merged = {**existing, **updates}

            street = (merged.get("address_street") or "").strip()
            city = (merged.get("address_city") or "").strip()
            state_val = (merged.get("address_state") or "").strip()
            zip_val = (merged.get("address_zip") or "").strip()
            updates["is_address_collected"] = bool(street and city and state_val and zip_val)

        set_parts = []
        values = []
        for k, v in updates.items():
            set_parts.append(sql.SQL("{} = %s").format(sql.Identifier(k)))
            values.append(v)

        values.append(party_id)

        query = sql.SQL(
            """
            UPDATE parties
            SET {sets}
            WHERE id = %s
            RETURNING id;
            """
        ).format(sets=sql.SQL(", ").join(set_parts))

        with conn.cursor() as cur:
            cur.execute(query, values)
            updated = cur.fetchone()
            conn.commit()
            if not updated:
                return jsonify({"error": "Party not found"}), 404

        return jsonify(
            {"ok": True, "id": party_id, "is_address_collected": updates.get("is_address_collected")}
        )

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/address-book", methods=["GET"])
def get_address_book():
    ctx, err = require_user()
    if err:
        return err

    query = sql.SQL(
        """
        SELECT
            p.id,
            COALESCE(p.display_name, p.legacy_key) AS party_name,
            p.legacy_key,
            p.address_street,
            p.address_street2,
            p.address_city,
            p.address_state,
            p.address_zip,
            p.is_address_collected,
            p.assigned_users,
            COALESCE(
              json_agg(
                json_build_object(
                  'guest_id', g.id,
                  'first_name', g.first_name,
                  'last_name', g.last_name,
                  'name', (g.first_name || ' ' || g.last_name)
                )
                ORDER BY g.last_name, g.first_name
              ) FILTER (WHERE g.id IS NOT NULL AND (g.record_status IS NULL OR g.record_status = 'active')),
              '[]'::json
            ) AS members
        FROM parties p
        LEFT JOIN guests g ON g.party_id = p.id AND (g.record_status IS NULL OR g.record_status = 'active')
        GROUP BY p.id
        HAVING COUNT(g.id) > 0  -- Optional: hides parties with zero active guests
        ORDER BY COALESCE(p.display_name, p.legacy_key) ASC;
        """
    )
    data, error = get_data_from_query(query)
    return jsonify(data) if not error else (jsonify({"error": error}), 500)


@app.route("/api/parties/<party_id>/assign", methods=["PATCH"])
def assign_party(party_id):
    ctx, err = require_user()
    if err:
        return err

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        data = request.get_json(silent=True) or {}
        assigned_users = data.get("assigned_users", [])

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE parties SET assigned_users = %s::jsonb WHERE id = %s",
                (json.dumps(assigned_users), party_id),
            )
            conn.commit()

        return jsonify({"ok": True, "id": party_id, "assigned_users": assigned_users})

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# -----------------------------
# Vendors
# -----------------------------
@app.route("/api/vendors", methods=["GET"])
def get_vendors():
    ctx, err = require_user()
    if err:
        return err

    status = (request.args.get("status") or "booked").strip().lower()

    query = sql.SQL(
        """
        SELECT
            id,
            name,
            category,
            status,
            notes,
            created_at,
            updated_at
        FROM vendor_companies
        WHERE (%s IS NULL OR status = %s)
        ORDER BY name ASC;
        """
    )

    params = (None, None) if status == "all" else (status, status)
    vendors, error = get_data_from_query(query, params)
    return jsonify(vendors) if not error else (jsonify({"error": error}), 500)


@app.route("/api/vendors/<company_id>", methods=["GET"])
def get_vendor_details(company_id):
    ctx, err = require_user()
    if err:
        return err

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        with conn.cursor() as cur:
            # 1. Company
            cur.execute(
                """
                SELECT id, name, category, status, notes, created_at, updated_at
                FROM vendor_companies
                WHERE id = %s;
                """,
                (company_id,),
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Vendor company not found"}), 404
            cols = [d[0] for d in cur.description]
            company = dict(zip(cols, row))

            # 2. People
            cur.execute(
                """
                SELECT id, company_id, full_name, email, phone, title
                FROM vendor_people
                WHERE company_id = %s
                ORDER BY full_name ASC NULLS LAST;
                """,
                (company_id,),
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            people = [dict(zip(cols, r)) for r in rows]

            # 3. Payments with responsibilities + files
            cur.execute(
                """
                SELECT
                    vp.id,
                    vp.company_id,
                    vp.description,
                    vp.amount,
                    vp.due_date,
                    vp.notes,
                    vp.created_at,
                    vp.updated_at,
                    (
                        SELECT COALESCE(jsonb_agg(resp_objs), '[]'::jsonb)
                        FROM (
                            SELECT jsonb_build_object(
                                'id', r.id,
                                'payment_id', r.payment_id,
                                'responsible_party', r.responsible_party,
                                'responsible_household_id', r.responsible_household_id,
                                'paid_by_party', r.paid_by_party,
                                'reimbursed_by_party', r.reimbursed_by_party,
                                'reimbursement_status', r.reimbursement_status,
                                'amount', r.amount,
                                'status', r.status,
                                'paid_date', r.paid_date,
                                'reimbursement_date', r.reimbursement_date,
                                'notes', r.notes,
                                'created_at', r.created_at
                            ) as resp_objs
                            FROM vendor_payment_responsibilities r
                            WHERE r.payment_id = vp.id
                            ORDER BY r.created_at ASC, r.id ASC
                        ) sub
                    ) AS responsibilities,
                    (
                        SELECT COALESCE(jsonb_agg(file_objs), '[]'::jsonb)
                        FROM (
                            SELECT jsonb_build_object(
                                'id', vf.id,
                                'payment_id', vf.payment_id,
                                'file_type', vf.file_type,
                                'file_name', vf.file_name,
                                'storage_path', vf.storage_path,
                                'mime_type', vf.mime_type,
                                'uploaded_at', vf.uploaded_at
                            ) as file_objs
                            FROM vendor_files vf
                            WHERE vf.payment_id = vp.id
                            ORDER BY vf.uploaded_at DESC, vf.id DESC
                        ) sub
                    ) AS files
                FROM vendor_payments vp
                WHERE vp.company_id = %s
                ORDER BY vp.due_date ASC NULLS LAST;
                """,
                (company_id,),
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            payments = [dict(zip(cols, r)) for r in rows]

            # 4. Company-level files
            cur.execute(
                """
                SELECT id, company_id, payment_id, file_type, file_name, storage_path, mime_type, uploaded_at
                FROM vendor_files
                WHERE company_id = %s
                  AND payment_id IS NULL
                ORDER BY uploaded_at DESC NULLS LAST;
                """,
                (company_id,),
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            company_files = [dict(zip(cols, r)) for r in rows]

        return jsonify(
            {"company": company, "people": people, "payments": payments, "company_files": company_files}
        )

    except Exception as e:
        print(f"Server Error in get_vendor_details: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/vendors/save", methods=["POST"])
def save_vendor():
    ctx, err = require_user()
    if err:
        return err

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        data = request.get_json() or {}

        name = data.get("name")
        category = data.get("category")
        status = data.get("status", "booked")
        email = data.get("email")
        phone = data.get("phone")
        notes = data.get("notes")

        if not name:
            return jsonify({"error": "Vendor name is required"}), 400

        new_company_id = str(uuid.uuid4())

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO vendor_companies (id, name, category, status, notes, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                """,
                (new_company_id, name, category, status, notes),
            )

            if email or phone:
                new_person_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO vendor_people (id, company_id, full_name, email, phone, title)
                    VALUES (%s, %s, 'Primary Contact', %s, %s, 'Main')
                    """,
                    (new_person_id, new_company_id, email, phone),
                )

            conn.commit()

        return jsonify({"id": new_company_id, "message": "Vendor created successfully"})

    except Exception as e:
        conn.rollback()
        print(f"Error saving vendor: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/vendors/<company_id>/notes", methods=["POST"])
def update_vendor_notes(company_id):
    ctx, err = require_user()
    if err:
        return err

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500
    try:
        data = request.get_json() or {}
        notes = data.get("notes", "")

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE vendor_companies SET notes = %s, updated_at = NOW() WHERE id = %s",
                (notes, company_id),
            )
            conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# -----------------------------
# Vendor files (Supabase Storage)
# -----------------------------
@app.route("/api/vendor-files/upload", methods=["POST"])
def upload_vendor_file():
    ctx, err = require_user()
    if err:
        return err

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500
    try:
        company_id = request.form.get("company_id")
        display_name = request.form.get("file_name")
        file = request.files.get("file")
        doc_type = request.form.get("file_type", "file")

        if not company_id or not file or not display_name:
            return jsonify({"error": "Missing required fields"}), 400

        safe_name = f"{uuid.uuid4()}_{file.filename}"
        storage_path = f"{company_id}/docs/{safe_name}"

        bucket = "vendor-files"
        base_url = SUPABASE_URL.rstrip("/")
        upload_url = f"{base_url}/storage/v1/object/{bucket}/{storage_path}"

        api_key, err = require_service_key()
        if err:
            return err

        headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": file.mimetype,
        }

        # Stream file instead of loading into memory
        r = requests.post(upload_url, headers=headers, data=file.stream, timeout=30)
        if r.status_code >= 400:
            raise Exception(f"Supabase error: {r.text}")

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO vendor_files
                (id, company_id, file_type, file_name, storage_path, mime_type, uploaded_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                """,
                (str(uuid.uuid4()), company_id, doc_type, display_name, storage_path, file.mimetype),
            )
            conn.commit()

        return jsonify({"ok": True})
    except Exception as e:
        print(f"Error uploading file: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/vendor-files/signed-url", methods=["GET"])
def vendor_file_signed_url():
    ctx, err = require_user()
    if err:
        return err

    storage_path = request.args.get("path")
    if not storage_path:
        return jsonify({"error": "Missing ?path="}), 400

    bucket = "vendor-files"
    expires_in = 60 * 60

    api_key, err = require_service_key()
    if err:
        return err

    base_url = SUPABASE_URL.rstrip("/")
    sign_api_url = f"{base_url}/storage/v1/object/sign/{bucket}/{storage_path}"

    try:
        resp = requests.post(
            sign_api_url,
            headers={
                "apikey": api_key,
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={"expiresIn": expires_in},
            timeout=15,
        )

        data = resp.json() if resp.content else {}
        if resp.status_code >= 400:
            return jsonify({"error": data.get("message") or "Object not found"}), 500

        raw_signed_url = data.get("signedURL") or data.get("signedUrl") or data.get("url")
        if not raw_signed_url:
            return jsonify({"error": "No URL returned from Supabase"}), 500

        if "?" in raw_signed_url:
            token_query = raw_signed_url.split("?", 1)[1]
            final_url = f"{base_url}/storage/v1/object/sign/{bucket}/{storage_path}?{token_query}"
        else:
            final_url = f"{base_url}/storage/v1/object/public/{bucket}/{storage_path}"

        return jsonify({"url": final_url})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/debug-storage/<company_id>/<folder>")
def debug_storage(company_id, folder):
    ctx, err = require_user()
    if err:
        return err

    if ENV != "development":
        return "", 404

    path = f"{company_id}/{folder}"
    bucket = "vendor-files"
    list_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/list/{bucket}"

    api_key, err = require_service_key()
    if err:
        return err

    resp = requests.post(
        list_url,
        headers={"apikey": api_key, "Authorization": f"Bearer {api_key}"},
        json={"prefix": path},
        timeout=15,
    )
    return jsonify(resp.json())


# -----------------------------
# Payments
# -----------------------------
@app.route("/api/payments/save", methods=["POST"])
def save_payment_details():
    ctx, err = require_user()
    if err:
        return err

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        data = request.get_json() or {}
        company_id = data.get("company_id")
        payment_id = data.get("payment_id")
        description = data.get("description")
        amount = data.get("amount")
        due_date = data.get("due_date")
        notes = data.get("notes")
        responsibilities = data.get("responsibilities", [])

        cur = conn.cursor()

        if payment_id:
            cur.execute(
                """
                UPDATE vendor_payments
                SET description = %s,
                    amount = %s,
                    due_date = %s,
                    notes = %s,
                    updated_at = NOW()
                WHERE id = %s RETURNING id;
                """,
                (description, amount, due_date, notes, payment_id),
            )
            row = cur.fetchone()
            if not row:
                conn.rollback()
                return jsonify({"error": "Payment not found"}), 404
            pid = row[0]
        else:
            cur.execute(
                """
                INSERT INTO vendor_payments
                (company_id, description, amount, due_date, notes)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (company_id, description, amount, due_date, notes),
            )
            pid = cur.fetchone()[0]

        HOUSEHOLD_MAP = {
            "Emma/Ethan": "hernandez-wlodarczyk",
            "Amy/Dave": "eiduke-wlodarczyk",
            "Dad": "hernandez",
            "Mom": "rayburn"
        }

        cur.execute("DELETE FROM vendor_payment_responsibilities WHERE payment_id = %s", (pid,))

        for r in responsibilities:
            party = r.get("responsible_party")
            household_id = HOUSEHOLD_MAP.get(party)

            cur.execute(
                """
                INSERT INTO vendor_payment_responsibilities
                (payment_id, responsible_party, amount, reimbursement_status, responsible_household_id)
                VALUES (%s, %s, %s, 'none', %s);
                """,
                (pid, party, r.get("amount"), household_id),
            )

        conn.commit()
        return jsonify({"ok": True, "id": pid})

    except Exception as e:
        conn.rollback()
        print(f"ERROR saving payment: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/payments/record", methods=["POST"])
def record_payment():
    ctx, err = require_user()
    if err:
        return err

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        payment_id = request.form.get("payment_id")
        paid_date = request.form.get("paid_date")
        main_notes = request.form.get("notes")
        resps_json = request.form.get("responsibilities")
        file = request.files.get("file")

        if not payment_id:
            return jsonify({"error": "Missing payment ID"}), 400

        responsibilities = json.loads(resps_json) if resps_json else []

        with conn.cursor() as cur:
            cur.execute("SELECT company_id FROM vendor_payments WHERE id = %s", (payment_id,))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Payment record not found"}), 404
            company_id = row[0]

            if file:
                safe_name = f"{uuid.uuid4()}_{file.filename}"
                storage_path = f"{company_id}/receipts/{safe_name}"

                bucket = "vendor-files"
                base_url = SUPABASE_URL.rstrip("/")
                upload_url = f"{base_url}/storage/v1/object/{bucket}/{storage_path}"

                api_key, err = require_service_key()
                if err:
                    return err

                headers = {
                    "apikey": api_key,
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": file.mimetype,
                }

                r = requests.post(upload_url, headers=headers, data=file.stream, timeout=30)
                if r.status_code >= 400:
                    raise Exception(f"Supabase upload error: {r.text}")

                cur.execute(
                    """
                    INSERT INTO vendor_files (id, company_id, payment_id, file_type, file_name, storage_path, mime_type, uploaded_at)
                    VALUES (%s, %s, %s, 'receipt', %s, %s, %s, NOW())
                    """,
                    (str(uuid.uuid4()), company_id, payment_id, file.filename, storage_path, file.mimetype),
                )

            HOUSEHOLD_MAP = {
                "Emma/Ethan": "hernandez-wlodarczyk",
                "Amy/Dave": "eiduke-wlodarczyk",
                "Dad": "hernandez",
                "Mom": "rayburn"
            }

            cur.execute("DELETE FROM vendor_payment_responsibilities WHERE payment_id = %s", (payment_id,))

            for r in responsibilities:
                party = r.get("responsible_party")
                household_id = HOUSEHOLD_MAP.get(party)

                cur.execute(
                    """
                    INSERT INTO vendor_payment_responsibilities
                    (payment_id, responsible_party, amount, status, reimbursement_status, paid_by_party, paid_date, notes, responsible_household_id)
                    VALUES (%s, %s, %s, 'paid', %s, %s, %s, %s, %s)
                    """,
                    (
                        payment_id,
                        party,
                        r.get("amount"),
                        r.get("reimbursement_status", "none"),
                        r.get("paid_by_party"),
                        paid_date,
                        f"Method: {r.get('payment_method')}",
                        household_id
                    ),
                )
            
            if main_notes is not None:
                cur.execute(
                    "UPDATE vendor_payments SET notes = %s, updated_at = NOW() WHERE id = %s",
                    (main_notes, payment_id),
                )

            conn.commit()

        return jsonify({"ok": True, "id": payment_id})

    except Exception as e:
        conn.rollback()
        print(f"Error in record_payment: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# -----------------------------
# Exports
# -----------------------------
@app.route("/api/exports/<export_type>")
def export_data(export_type):
    ctx, err = require_user()
    if err:
        return err

    user_name = (request.args.get("name") or "").strip().lower()

    conn = get_db_connection()
    if not conn:
        return "Database unavailable", 500

    try:
        cur = conn.cursor()
        data = []
        filename = f"{export_type}_export.csv"
        headers = []

        if export_type == "guests":
            cur.execute(
                "SELECT first_name, last_name, rsvp_status, dietary_restrictions FROM guests ORDER BY last_name;"
            )
            headers = ["First Name", "Last Name", "RSVP Status", "Dietary"]
            data = cur.fetchall()

        elif export_type == "addresses":
            cur.execute(
                """
                SELECT display_name, address_street, address_city, address_state, address_zip
                FROM parties
                WHERE is_address_collected = true;
                """
            )
            headers = ["Party Name", "Street", "City", "State", "Zip"]
            data = cur.fetchall()

        elif export_type == "vendors":
            cur.execute("SELECT name, category, notes FROM vendor_companies WHERE status = 'booked';")
            headers = ["Vendor", "Category", "Notes"]
            data = cur.fetchall()

        elif export_type == "my-payments":
            query = """
                SELECT vp.description, r.amount, r.status, r.paid_date
                FROM vendor_payment_responsibilities r
                JOIN vendor_payments vp ON r.payment_id = vp.id
                WHERE LOWER(r.responsible_party) LIKE %s
                ORDER BY vp.due_date;
            """
            cur.execute(query, (f"%{user_name}%",))
            headers = ["Description", "Your Share", "Status", "Date Paid"]
            data = cur.fetchall()

        elif export_type == "all-payments":
            cur.execute(
                """
                SELECT vp.description, vp.amount, vp.due_date, vp.notes
                FROM vendor_payments vp
                ORDER BY vp.due_date;
                """
            )
            headers = ["Payment Description", "Total Contract Amount", "Due Date", "Notes"]
            data = cur.fetchall()
        else:
            return jsonify({"error": "Unknown export type"}), 400

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(data)

        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-disposition": f"attachment; filename={filename}"},
        )

    except Exception as e:
        print(f"Export Error: {e}")
        return str(e), 500
    finally:
        conn.close()


# -----------------------------
# Misc / Frontend pages
# -----------------------------
@app.route("/favicon.ico")
def favicon():
    return "", 204


@app.route("/health")
def health():
    return jsonify({"ok": True}), 200


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/login")
def login():
    return render_template(
        "login.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY=os.environ.get("SUPABASE_PUBLISHABLE_KEY"),
    )


@app.route("/travel")
def travel():
    return render_template("travel.html")


@app.route("/our-story")
def outstory():
    return render_template("OurStory.html")


@app.route("/wedding")
def wedding():
    return render_template("wedding.html")


@app.route("/welcome-gathering")
def welcomeparty():
    return render_template("welcome_gathering.html")

from datetime import datetime, date

def format_last_updated(val):
    if not val:
        return '—'
    
    if isinstance(val, str):
        try:
            val = datetime.fromisoformat(val)
        except ValueError:
            return '—'
            
    val_date = val.date() if isinstance(val, datetime) else val
    today = date.today()
    delta_days = (today - val_date).days
    
    if delta_days == 0:
        return 'Today'
    elif delta_days == 1:
        return 'Yesterday'
    else:
        return val_date.strftime('%b %d, %Y')


@app.route('/admin')
def admin():
    # 1. Grab filter parameters from the URL (e.g., ?status=accepted)
    filter_status = request.args.get('status', '').strip().lower()
    filter_lodging = request.args.get('lodging', '').strip().lower()
    filter_shuttle = request.args.get('shuttle', '').strip().lower()
    
    conn = get_db_connection()
    if not conn:
        return "Database unavailable", 500

    try:
        with conn.cursor() as cur:
            # Query guests joined with parties to fetch lodging, shuttle, and notes data
            cur.execute("""
                SELECT 
                    g.id, 
                    g.first_name, 
                    g.last_name, 
                    g.rsvp_status, 
                    g.is_21_plus,
                    g.age_category,
                    g.dietary_restrictions, 
                    g.is_anonymous,
                    g.side,
                    g.relationship AS relation,
                    p.display_name AS party_name, 
                    p.legacy_key, 
                    p.lodging_choice,
                    p.shuttle_interest, 
                    p.guest_note, 
                    p.updated_at
                FROM guests g
                JOIN parties p ON g.party_id = p.id
                WHERE g.record_status != 'inactive' OR g.record_status IS NULL
                ORDER BY p.legacy_key, g.first_name;
            """)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            all_guests_records = [dict(zip(cols, row)) for row in rows]
    except Exception as e:
        return f"Database query error: {e}", 500
    finally:
        conn.close()

    total_accepted = 0
    total_pending = 0
    total_21_plus = 0
    
    lodging_counts = {
        'bay_pointe': 0,
        'best_western': 0,
        'gun_lake': 0,
        'other': 0
    }
    
    shuttle_counts = {
        'best_western': 0,
        'gun_lake': 0
    }
    
    total_shuttle_requested = 0
    dietary_list = []
    guest_notes = []
    formatted_guests = []
    
    # Group records by party to handle party-level lodging/shuttles and individual guest tallies
    parties_dict = {}
    for g in all_guests_records:
        party_key = g.get('legacy_key') or g.get('party_name') or str(g.get('id'))
        if party_key not in parties_dict:
            parties_dict[party_key] = {
                'party_name': g.get('party_name'),
                'legacy_key': g.get('legacy_key'),
                'lodging_choice': g.get('lodging_choice'),
                'shuttle_interest': g.get('shuttle_interest'),
                'guest_note': g.get('guest_note'),
                'guests': []
            }
        parties_dict[party_key]['guests'].append(g)

    unique_notes = {}

    for party_key, p_data in parties_dict.items():
        lodging = (p_data['lodging_choice'] or '').strip()
        shuttle = (p_data['shuttle_interest'] or '').strip().lower()
        note = p_data['guest_note']
        
        # Calculate accepted guests in this party first
        accepted_in_party = sum(
            1 for g in p_data['guests'] 
            if (g.get('rsvp_status') or '').strip().lower() in ['accept', 'accepted']
        )
        
        # Count Lodging for accepted guests
        if accepted_in_party > 0:
            if 'Bay Pointe' in lodging:
                lodging_counts['bay_pointe'] += accepted_in_party
            elif 'Best Western' in lodging:
                lodging_counts['best_western'] += accepted_in_party
            elif 'Gun Lake' in lodging:
                lodging_counts['gun_lake'] += accepted_in_party
            else:
                lodging_counts['other'] += accepted_in_party

        # Process individual guests in this party for the main table & statuses
        for g in p_data['guests']:
            status = (g.get('rsvp_status') or 'pending').lower()
            is_21 = g.get('is_21_plus')
            
            # Count statuses & 21+ globally
            if status in ['accept', 'accepted']:
                total_accepted += 1
                if is_21 in [True, 1, 'true', 'True']:
                    total_21_plus += 1
            elif status not in ['decline', 'declined']:
                total_pending += 1
                
            # Collect Dietary Restrictions
            dietary = g.get('dietary_restrictions')
            if dietary:
                dietary_list.append({
                    'name': f"{g.get('first_name', '')} {g.get('last_name', '')}".strip(),
                    'restriction': dietary
                })
            
            # Determine age group based on age_category
            age_cat = str(g.get('age_category') or '').strip().lower()
            is_21_bool = is_21 in [True, 1, 'true', 'True']

            if age_cat == 'under_12':
                computed_age_group = 'under_12'
            elif age_cat == 'under_21':
                computed_age_group = '12_to_20'
            elif age_cat == 'adult':
                computed_age_group = '21_plus'
            else:
                # Fallback if age_category is empty
                computed_age_group = '21_plus' if is_21_bool else '12_to_20'

            # Define plus-one status variable here before building the dictionary
            is_plus_one_val = 'yes' if g.get('is_anonymous') else 'no'
                
            # Build table row data
            formatted_guests.append({
                'id': g.get('id'), # <-- ADD THIS LINE!
                'first_name': g.get('first_name'),
                'last_name': g.get('last_name'),
                'party_name': g.get('party_name') or g.get('legacy_key', ''),
                'rsvp_status': g.get('rsvp_status', 'pending'),
                'lodging_choice': g.get('lodging_choice', 'unknown'),
                'shuttle_interest': g.get('shuttle_interest', 'no'),
                'age_group': computed_age_group, 
                'is_plus_one': is_plus_one_val,
                'side': (g.get('side') or '').strip().lower(),
                'relation': (g.get('relation') or '').strip().lower(),
                'has_plus_one': '',
                'updated_at': format_last_updated(g.get('updated_at'))
            })

        # Count Shuttles
        if shuttle == 'yes' and accepted_in_party > 0:
            total_shuttle_requested += accepted_in_party
            if 'Best Western' in lodging:
                shuttle_counts['best_western'] += accepted_in_party
            elif 'Gun Lake' in lodging:
                shuttle_counts['gun_lake'] += accepted_in_party

        # Collect Unique Guest Notes per Party
        if note and party_key not in unique_notes:
            unique_notes[party_key] = note
            first_guest_name = ""
            if p_data['guests']:
                first_guest_name = f"{p_data['guests'][0].get('first_name', '')} {p_data['guests'][0].get('last_name', '')}"
            guest_notes.append({
                'text': note,
                'party_name': p_data['party_name'] or p_data['legacy_key'] or first_guest_name
            })

    # 2. Apply filters to the formatted_guests list specifically for the table display
    if filter_status:
        formatted_guests = [g for g in formatted_guests if (g['rsvp_status'] or '').strip().lower() == filter_status]
        
    if filter_lodging:
        formatted_guests = [g for g in formatted_guests if filter_lodging in (g['lodging_choice'] or '').strip().lower()]
        
    if filter_shuttle:
        formatted_guests = [g for g in formatted_guests if filter_shuttle in (g['shuttle_interest'] or '').strip().lower()]

    # Calculate days until RSVP deadline (May 14, 2027)
    rsvp_deadline = date(2027, 5, 14)
    days_until_rsvp = (rsvp_deadline - date.today()).days

    return render_template(
        "family_dashboard.html",
        total_accepted=total_accepted,
        total_pending=total_pending,
        total_21_plus=total_21_plus,
        days_until_rsvp=days_until_rsvp,  
        lodging_counts=lodging_counts,
        shuttle_counts=shuttle_counts,
        total_shuttle_requested=total_shuttle_requested,
        dietary_list=dietary_list,
        guest_notes=guest_notes,
        all_guests=formatted_guests, # This is now the filtered list
        supabase_url=os.environ.get("SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY=os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    )

# app.py - New route to handle the projections page

# app.py - New route for the expense dashboard

# Ensure ROUND_HALF_UP is imported along with Decimal
from decimal import Decimal, ROUND_HALF_UP

@app.route('/admin/expense')
def expense_dashboard():
    # 1. Constants and Budget Data (Precise decimal math required)
    # ---------------------------------------------------------
    MI_SALES_TAX = Decimal('0.06')     # 6% sales tax
    SERVICE_FEE = Decimal('0.22')     # 22% service fee
    CEREMONY_FEE = Decimal('850.00') # Taxable, but not serviced
    PAVILION_FEE = Decimal('3500.00') # Taxable, but not serviced
    
    # Non-guest expenses that are now Taxable but NOT Serviced
    flat_fees_subtotal_taxable = CEREMONY_FEE + PAVILION_FEE

    BUDGETED_AMOUNT = Decimal('18638.00')
    CONTRACT_FB_MIN = Decimal('9000.00')
    CONTRACT_ADULT_MIN = 75
    
    # VENDOR DATA ( Rule 3: Hardcoded, not in DB)
    VENDOR_COUNT = 13
    VENDOR_PRICE_PP = Decimal('58.00')

    # 2. Grab filter parameters (reusing standard names)
    filter_status = request.args.get('status', '').strip().lower()
    filter_tier = request.args.get('tier', '').strip().lower()

    conn = get_db_connection()
    if not conn:
        return "Database unavailable", 500

    try:
        with conn.cursor() as cur:
            # Query active or null-status guests (Rule 1, 2c, 5)
            cur.execute("""
                SELECT 
                    g.id, 
                    g.first_name, 
                    g.last_name, 
                    g.rsvp_status, 
                    g.is_21_plus,
                    g.age_category,
                    g.is_anonymous
                FROM guests g
                WHERE (g.record_status IS NULL OR LOWER(TRIM(g.record_status)) != 'inactive')
                ORDER BY g.last_name, g.first_name;
            """)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            all_guests_records = [dict(zip(cols, row)) for row in rows]
    except Exception as e:
        return f"Database query error: {e}", 500
    finally:
        conn.close()

    rsvp_declined = ['decline', 'declined']

    # 3. Headcounts & Raw F&B Calculations (Precise decimal math)
    # ---------------------------------------------------------
    # Rule 2a/2b: accepted + pending guests are factored into projections.
    # (Declined guests count as $0 for F&B but are still filtered).
    fb_subtotal_raw = Decimal('0.00')
    
    tier_counts = {
        '21_plus': 0,
        'under_21': 0,
        'under_12': 0
    }
    tier_costs = {
        '21_plus': Decimal('0.00'),
        'under_21': Decimal('0.00'),
        'under_12': Decimal('0.00')
    }
    contract_adult_headcount = 0
    
    formatted_guests_raw = []

    for g in all_guests_records:
        status = (g.get('rsvp_status') or 'pending').strip().lower()
        is_21 = g.get('is_21_plus')
        age_cat = str(g.get('age_category') or '').strip().lower()
        
        # Consistent check for boolean or string 'true'
        is_21_bool = is_21 in [True, 1, 'true', 'True']

        # Reuse updated age mapping (Hernandez DB update)
        if age_cat == 'under_12':
            computed_age_group = 'under_12'
        elif age_cat in ('12_to_21', '12-21', 'under_21'): 
            computed_age_group = '12_to_21'
        else:
            # Fallback if age_category is empty
            computed_age_group = '21_plus' if is_21_bool else '12_to_21'

        price, display_tier = get_guest_price(computed_age_group)

        # Process guests (Rule 2a/2b: Accepted + Pending are tracked)
        # (Rule 2c: declined = $0)
        if status not in rsvp_declined:
            tier_counts[display_tier] += 1
            tier_costs[display_tier] += price
            fb_subtotal_raw += price
            
            # Count for contractual adult minimum (Rule 4: 75 adults 21+)
            if computed_age_group == '21_plus':
                contract_adult_headcount += 1

        formatted_guests_raw.append({
            'first_name': g.get('first_name'),
            'last_name': g.get('last_name'),
            'rsvp_status': g.get('rsvp_status', 'pending'),
            'price_tier': display_tier, 
            # Cost is price, or $0 if declined
            'cost_pp': price if status not in rsvp_declined else Decimal('0.00'), 
            'is_plus_one': g.get('is_anonymous') == True,
        })

    # 4. Inject Vendors separately into subtotals (Rule 3)
    # ---------------------------------------------------------
    # Added AFTER guest DB process to ensure clean filtering in table later.
    vendor_cost_subtotal = VENDOR_COUNT * VENDOR_PRICE_PP
    fb_subtotal_raw += vendor_cost_subtotal

    # Vendors do NOT count towards the adult headcount minimum of 75 
    # (they are vendors, not attending guests), so we don't increment contract_adult_headcount.

    # 5. Apply Taxes & Fees (Service Fee 22%, Tax 6% on taxable items only)
    # ---------------------------------------------------------
    # A standard way to handle money rounding precisely using ROUND_HALF_UP.
    def quant(val):
        return val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Tax on F&B (Guests + Vendors)
    tax_fb = quant(fb_subtotal_raw * MI_SALES_TAX)
    
    # Service Fee on F&B only (Rule: Service fee is NOT taxed)
    service_fee_fb = quant(fb_subtotal_raw * SERVICE_FEE)
    
    # --- THIS IS THE FIX ---
    # Tax on Flat Fees (Rule: FLAT FEES ARE NOW TAXABLE 6%)
    tax_flat_fees = quant(flat_fees_subtotal_taxable * MI_SALES_TAX)

    # 6. Contractual Check against Minimums (Rule 4: Interactive trackers)
    # ---------------------------------------------------------
    # Checked against raw pre-tax subtotals
    fb_min_met = fb_subtotal_raw >= CONTRACT_FB_MIN
    adult_min_met = contract_adult_headcount >= CONTRACT_ADULT_MIN

    # 7. Final Grand Totals
    # ---------------------------------------------------------
    grand_total_projected = (fb_subtotal_raw + tax_fb + service_fee_fb + 
                             flat_fees_subtotal_taxable + tax_flat_fees)

    # Budget tracking (Rule 3 & 4)
    budget_variance = grand_total_projected - BUDGETED_AMOUNT
    under_budget = budget_variance <= 0

    # 8. Filter the table list (Rule 2c)
    # ---------------------------------------------------------
    formatted_guests = formatted_guests_raw
    if filter_status:
        formatted_guests = [g for g in formatted_guests if (g['rsvp_status'] or '').strip().lower() == filter_status]
    if filter_tier:
        formatted_guests = [g for g in formatted_guests if filter_tier == g['price_tier']]

    # --- Cost Breakdown by RSVP Status for Visual Bar ---
    tax_and_service_mult = Decimal('1.28') # 1 + 0.06 tax + 0.22 service fee
    accepted_fb_raw = Decimal('0.00')
    pending_fb_raw = Decimal('0.00')
    declined_fb_raw = Decimal('0.00')

    for g in all_guests_records:
        status = (g.get('rsvp_status') or 'pending').strip().lower()
        is_21 = g.get('is_21_plus')
        age_cat = str(g.get('age_category') or '').strip().lower()
        is_21_bool = is_21 in [True, 1, 'true', 'True']

        if age_cat == 'under_12':
            computed_age = 'under_12'
        elif age_cat in ('12_to_21', '12-21', 'under_21'): 
            computed_age = '12_to_21'
        else:
            computed_age = '21_plus' if is_21_bool else '12_to_21'

        price, _ = get_guest_price(computed_age)

        if status in ['accept', 'accepted']:
            accepted_fb_raw += price
        elif status in ['decline', 'declined']:
            declined_fb_raw += price
        else:
            pending_fb_raw += price

    # Include fixed 13 vendors in accepted total
    accepted_fb_raw += vendor_cost_subtotal

    cost_confirmed = (accepted_fb_raw * tax_and_service_mult) + (flat_fees_subtotal_taxable * Decimal('1.06'))
    cost_pending = pending_fb_raw * tax_and_service_mult
    cost_declined_saved = declined_fb_raw * tax_and_service_mult

    # Total pool including declined savings for a complete 100% distribution bar
    total_pool = cost_confirmed + cost_pending + cost_declined_saved
    pct_confirmed = (cost_confirmed / total_pool * 100) if total_pool > 0 else 0
    pct_pending = (cost_pending / total_pool * 100) if total_pool > 0 else 0
    pct_declined = (cost_declined_saved / total_pool * 100) if total_pool > 0 else 0

    # Helper function to format Decimal as standard currency string ("1,234.56")
    def fmt(val):
        return f"{val:,.2f}"

    # Calculate percentage position of budget relative to projected total cost pool
    # Scaling against total projected spend (Confirmed + Pending) ensures the line lands where $18,638 sits
    cost_active_total = cost_confirmed + cost_pending
    pct_budget_line = (BUDGETED_AMOUNT / cost_active_total * 100) if cost_active_total > 0 else 0

    return render_template(
        "expense_dashboard.html",
        # Budget tracking variables
        budgeted_amount=fmt(BUDGETED_AMOUNT),
        grand_total_projected=fmt(grand_total_projected),
        budget_variance=fmt(abs(budget_variance)),
        under_budget=under_budget,
        
        # Visual Breakdown Variables
        cost_confirmed=fmt(cost_confirmed),
        cost_pending=fmt(cost_pending),
        cost_declined_saved=fmt(cost_declined_saved),
        pct_confirmed=f"{pct_confirmed:.1f}",
        pct_pending=f"{pct_pending:.1f}",
        pct_declined=f"{pct_declined:.1f}",
        pct_budget_line=f"{pct_budget_line:.1f}",
        
        # Breakdown section
        fb_subtotal_raw=fmt(fb_subtotal_raw),
        fb_total_final=fmt(fb_subtotal_raw + tax_fb + service_fee_fb),
        fixed_fees_total=fmt(flat_fees_subtotal_taxable + tax_flat_fees),
        
        ceremony_fee=fmt(CEREMONY_FEE),
        pavilion_fee=fmt(PAVILION_FEE),
        
        # Vendor data
        vendor_count=VENDOR_COUNT,
        vendor_cost=fmt(vendor_cost_subtotal),

        # Contractual requirements
        fb_min_met=fb_min_met,
        fb_min_required=fmt(CONTRACT_FB_MIN),
        adult_headcount=contract_adult_headcount,
        adult_min_required=CONTRACT_ADULT_MIN,
        adult_min_met=adult_min_met,
        
        # Headcounts for headcounts grid
        tier_21_count=tier_counts['21_plus'],
        tier_under_21_count=tier_counts['under_21'],
        tier_under_12_count=tier_counts['under_12'],
        
        all_guests=formatted_guests,
        supabase_url=os.environ.get("SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY=os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    )

@app.route("/faqs")
def faqs():
    return render_template("faq.html")

@app.route("/rsvp")
def rsvp():
    return render_template("rsvp.html", is_post_deadline=check_is_post_deadline())

@app.route("/rsvp/lookup")
def rsvp_existing():
    return render_template("find_rsvp.html", is_post_deadline=check_is_post_deadline())

@app.route("/rsvp/form")
def rsvp_form():
    # Extract the code parameter right away at the top
    code = request.args.get("code")

    if check_is_post_deadline():
        if code:
            return redirect(url_for("rsvp_confirmation", code=code))
        flash("The RSVP deadline has passed.", "info")
        return redirect(url_for("rsvp_existing"))

    # Ensure code exists even if accessed directly without query params
    if not code:
        flash("Confirmation code missing.", "error")
        return redirect(url_for("rsvp_existing"))

    party_query = """
        SELECT id, confirmation_code, lodging_choice, shuttle_interest, guest_note, email
        FROM parties
        WHERE confirmation_code = %s;
    """
    
    guests_query = """
        SELECT g.id, g.party_id, g.first_name, g.last_name, g.rsvp_status, 
               g.welcome_dinner_rsvp, g.dietary_restrictions, g.is_anonymous, g.guest_of, g.updated_at
        FROM guests g
        JOIN parties p ON g.party_id = p.id
        WHERE p.confirmation_code = %s
            AND (g.record_status IS NULL OR LOWER(TRIM(g.record_status)) != 'inactive')
        ORDER BY g.id ASC;
    """
    
    conn = get_db_connection()
    if not conn:
        flash("Database unavailable. Please try again later.", "error")
        return redirect(url_for("rsvp_existing"))

    try:
        with conn.cursor() as cur:
            cur.execute(party_query, (code,))
            party_row = cur.fetchone()
            
            if not party_row:
                flash("We couldn't find an invitation tied to that code.", "error")
                return redirect(url_for("rsvp_existing"))
                
            party_cols = [d[0] for d in cur.description]
            party_dict = dict(zip(party_cols, party_row))

            party = {
                "id": party_dict.get("id"),
                "confirmation_code": party_dict.get("confirmation_code") or "",
                "lodging_choice": party_dict.get("lodging_choice") or "",
                "shuttle_interest": party_dict.get("shuttle_interest") or "",
                "guest_note": party_dict.get("guest_note") or "",
                "email": party_dict.get("email") or ""
            }

            cur.execute(guests_query, (code,))
            guest_rows = cur.fetchall()
            guest_cols = [d[0] for d in cur.description]
            guests = [dict(zip(guest_cols, r)) for r in guest_rows]

        guest_name_map = {}
        for g in guests:
            g_id = str(g.get("id"))
            fname = (g.get("first_name") or "").strip()
            guest_name_map[g_id] = fname if fname else "Guest"

        for guest in guests:
            raw_guest_of = guest.get("guest_of")
            if raw_guest_of:
                lookup_key = str(raw_guest_of)
                if lookup_key in guest_name_map:
                    guest["resolved_guest_of"] = guest_name_map[lookup_key]
                else:
                    guest["resolved_guest_of"] = None
            else:
                guest["resolved_guest_of"] = None

        return render_template("rsvp_form.html", guests=guests, party=party, code=code)
            
    except Exception as e:
        print(f"!!! DB Error in rsvp_form: {e}")
        flash("An error occurred loading your reservation. Please try again.", "error")
        return redirect(url_for("rsvp_existing"))
    finally:
        conn.close()

@app.route('/rsvp/<party_code>', methods=['GET'])
def public_rsvp_form(party_code):
    if check_is_post_deadline():
        return redirect(url_for("rsvp_confirmation", code=party_code))

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, confirmation_code, lodging_choice, shuttle_interest, guest_note
                FROM parties
                WHERE confirmation_code = %s;
                """,
                (party_code,)
            )
            party_row = cur.fetchone()
            if not party_row:
                return jsonify({"error": "Party not found"}), 404
            
            party_cols = [d[0] for d in cur.description]
            party = dict(zip(party_cols, party_row))

            cur.execute(
                """
                SELECT id, party_id, first_name, last_name, rsvp_status, 
                       dietary_restrictions, is_anonymous, guest_of, updated_at
                FROM guests
                WHERE party_id = %s AND (record_status IS NULL OR record_status != 'inactive')
                """,
                (party["id"],)
            )
            guest_rows = cur.fetchall()
            guest_cols = [d[0] for d in cur.description]
            guests = [dict(zip(guest_cols, r)) for r in guest_rows]

        guest_name_map = {}
        for g in guests:
            g_id = str(g.get("id"))
            fname = (g.get("first_name") or "").strip()
            lname = (g.get("last_name") or "").strip()
            if fname:
                guest_name_map[g_id] = f"{fname} {lname}".strip()
            else:
                guest_name_map[g_id] = "Guest"

        for guest in guests:
            raw_guest_of = guest.get("guest_of")
            if raw_guest_of and str(raw_guest_of) in guest_name_map:
                guest["resolved_guest_of"] = guest_name_map[str(raw_guest_of)]
            else:
                guest["resolved_guest_of"] = None

        return render_template('rsvp_form.html', party=party, guests=guests)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route("/rsvp/submit", methods=["POST"])
def submit_rsvp():
    if check_is_post_deadline():
        flash("The RSVP deadline has passed. Submissions are no longer accepted.", "error")
        code = request.form.get("confirmation_code")
        return redirect(url_for("rsvp_confirmation", code=code) if code else url_for("rsvp_existing"))

    form_data = request.form
    confirmation_code = form_data.get("confirmation_code")
    
    if not confirmation_code:
        flash("Confirmation code missing. Please try again.", "error")
        return redirect(url_for("rsvp_existing"))

    editor_name = session.get('current_editor', 'Guest (Direct Form Link)')
    batch_id = str(uuid.uuid4())

    lodging_choice = form_data.get("lodging_choice")
    shuttle_interest = form_data.get("shuttle_interest")
    guest_note = form_data.get("guest_note")
    confirmation_email = form_data.get("confirmation_email", "").strip()
    skip_email = form_data.get("skip_email") == "true"

    conn = get_db_connection()
    if not conn:
        flash("Database unavailable. Please try again later.", "error")
        return redirect(url_for("rsvp_existing"))

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT set_config('app.current_editor', %s, true);", (editor_name,))
            cur.execute("SELECT set_config('app.current_batch_id', %s, true);", (batch_id,))

            # 1. Update Household Logistics, Note, & Email
            cur.execute(
                """
                UPDATE parties 
                SET lodging_choice = %s, 
                    shuttle_interest = %s, 
                    guest_note = %s,
                    email = COALESCE(NULLIF(%s, ''), email)
                WHERE confirmation_code = %s;
                """,
                (lodging_choice, shuttle_interest, guest_note, confirmation_email, confirmation_code)
            )

            party_attending = False

            # 2. Update Individual Guests (Attendance, Dietary, & Welcome Gathering)
            for key, value in form_data.items():
                # Handle main wedding attendance & dietary notes
                if key.startswith("guest_") and key.endswith("_status"):
                    if value.lower() in ["accept", "accepted", "yes"]:
                        party_attending = True
                        
                    guest_id = key[6:-7]
                    dietary_note = form_data.get(f"dietary_{guest_id}", "").strip()
                    first_name = form_data.get(f"guest_{guest_id}_first")
                    last_name = form_data.get(f"guest_{guest_id}_last")

                    cur.execute(
                        """
                        UPDATE guests 
                        SET rsvp_status = %s, 
                            dietary_restrictions = %s,
                            first_name = COALESCE(NULLIF(%s, ''), first_name),
                            last_name = COALESCE(NULLIF(%s, ''), last_name)
                        WHERE id = %s;
                        """,
                        (
                            value, 
                            dietary_note, 
                            first_name.strip() if first_name else None, 
                            last_name.strip() if last_name else None, 
                            guest_id
                        )
                    )

                # Handle individual Thursday Welcome Gathering responses
                elif key.startswith("welcome_guest_") and key.endswith("_status"):
                    guest_id = key[14:-7]
                    cur.execute(
                        """
                        UPDATE guests 
                        SET welcome_dinner_rsvp = %s
                        WHERE id = %s;
                        """,
                        (value, guest_id)
                    )

            conn.commit()

            # 3. Fetch the updated guests for this confirmation code to include in the email
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT first_name, last_name, rsvp_status, dietary_restrictions 
                    FROM guests 
                    WHERE party_id = (SELECT id FROM parties WHERE confirmation_code = %s);
                    """,
                    (confirmation_code,)
                )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description] if cur.description else []
                
                guests_list = []
                for r in rows:
                    guest_dict = dict(zip(cols, r))
                    fname = (guest_dict.get('first_name') or '').strip()
                    lname = (guest_dict.get('last_name') or '').strip()
                    full_name = f"{fname} {lname}".strip()
                    if not full_name:
                        full_name = "Guest"
                        
                    guests_list.append({
                        "name": full_name,
                        "rsvp": guest_dict.get('rsvp_status') or "Pending",
                        "dietary": guest_dict.get('dietary_restrictions') or "None"
                    })

            # 4. Trigger the confirmation email if provided and not skipped
            if confirmation_email and not skip_email:
                if party_attending:
                    dynamic_preview = "We can't wait to celebrate with you at Bay Pointe Inn!"
                else:
                    dynamic_preview = "Thank you for letting us know. You'll be with us in spirit!"
                
                try:
                    send_rsvp_confirmation_email(
                        recipient_email=confirmation_email,
                        confirmation_code=confirmation_code,
                        guests_list=guests_list,
                        lodging_choice=lodging_choice,
                        preview_text=dynamic_preview
                    )
                except Exception as mail_error:
                    print(f"Non-fatal email error: {mail_error}")

    except Exception as e:
        conn.rollback()
        print(f"!!! DB Error in submit_rsvp: {e}")
        flash("An error occurred while saving your RSVP. Please try again.", "error")
        return redirect(url_for("rsvp_existing"))
    finally:
        conn.close()

    return redirect(url_for("rsvp_confirmation", code=confirmation_code))

# We allow both URL styles: /rsvp/confirmation?code=XYZ and /rsvp/confirmation/XYZ
@app.route('/rsvp/confirmation', defaults={'code': None})
@app.route('/rsvp/confirmation/<code>')
def rsvp_confirmation(code):
    if not code:
        code = request.args.get("code", "").strip().upper()
        
    if not code:
        flash("Please enter a confirmation code to view your itinerary.", "error")
        return redirect(url_for("rsvp_existing"))

    party_query = """
        SELECT id, confirmation_code, lodging_choice, shuttle_interest, guest_note, email
        FROM parties
        WHERE confirmation_code ILIKE %s
        LIMIT 1;
    """
    parties, err = get_data_from_query(party_query, (code,))
    
    if err or not parties:
        flash("We couldn't find a confirmed reservation with that reference code.", "error")
        return redirect(url_for("rsvp_existing"))
        
    real_party = parties[0]
    party_id = real_party["id"]

    guests_query = """
        SELECT id, 
               CASE 
                   WHEN is_anonymous = true AND (first_name IS NULL OR TRIM(first_name) = '') THEN 'Plus One'
                   ELSE TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
               END AS name,
               rsvp_status, 
               dietary_restrictions
        FROM guests
        WHERE party_id = %s AND (record_status IS NULL OR record_status != 'inactive')
        ORDER BY id ASC;
    """
    real_party_members, g_err = get_data_from_query(guests_query, (party_id,))
    if g_err:
        real_party_members = []

    # Check if the deadline has passed
    if check_is_post_deadline():
        for guest in real_party_members:
            status = (guest.get('rsvp_status') or '').strip().lower()
            if status not in ['accept', 'accepted', 'attending']:
                guest['rsvp_status'] = 'declined'

        return render_template(
            "rsvp_confirmation_closed.html", 
            party=real_party, 
            party_members=real_party_members
        )

    return render_template(
        "rsvp_confirmation.html", 
        party=real_party, 
        party_members=real_party_members
    )

@app.route("/rsvp/email-confirmation", methods=["POST"])
def email_confirmation():
    confirmation_code = request.form.get("confirmation_code")
    recipient_email = request.form.get("email", "").strip()

    if not confirmation_code or not recipient_email:
        flash("Confirmation code or email missing.", "error")
        return redirect(url_for("rsvp_existing"))

    conn = get_db_connection()
    if not conn:
        flash("Database unavailable.", "error")
        return redirect(url_for("rsvp_confirmation", code=confirmation_code))

    try:
        with conn.cursor() as cur:
            # 1. Save or update the email in the parties table
            cur.execute(
                """
                UPDATE parties 
                SET email = COALESCE(NULLIF(%s, ''), email)
                WHERE confirmation_code = %s;
                """,
                (recipient_email, confirmation_code)
            )

            # 2. Fetch party lodging
            cur.execute("SELECT lodging_choice FROM parties WHERE confirmation_code = %s;", (confirmation_code,))
            party_row = cur.fetchone()
            lodging_choice = party_row[0] if party_row else "Not specified"

            # 3. Fetch guest rows for this party to build the email payload
            cur.execute(
                """
                SELECT first_name, last_name, rsvp_status, dietary_restrictions 
                FROM guests 
                WHERE party_id = (SELECT id FROM parties WHERE confirmation_code = %s)
                  AND (record_status IS NULL OR record_status != 'inactive');
                """,
                (confirmation_code,)
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description] if cur.description else []

            guests_list = []
            party_attending = False
            for r in rows:
                guest_dict = dict(zip(cols, r))
                fname = (guest_dict.get('first_name') or '').strip()
                lname = (guest_dict.get('last_name') or '').strip()
                full_name = f"{fname} {lname}".strip() or "Guest"
                
                status = guest_dict.get('rsvp_status') or "Pending"
                if status.lower() in ["accept", "accepted", "attending", "yes"]:
                    party_attending = True

                guests_list.append({
                    "name": full_name,
                    "rsvp": status,
                    "dietary": guest_dict.get('dietary_restrictions') or "None"
                })

            conn.commit()

            # 4. Match the exact same dynamic preview logic as submit_rsvp
            if party_attending:
                dynamic_preview = "We can't wait to celebrate with you at Bay Pointe Inn!"
            else:
                dynamic_preview = "Thank you for letting us know. You'll be with us in spirit!"
            
            send_rsvp_confirmation_email(
                recipient_email=recipient_email,
                confirmation_code=confirmation_code,
                guests_list=guests_list,
                lodging_choice=lodging_choice,
                preview_text=dynamic_preview
            )

            flash("Confirmation email sent successfully!", "success")

    except Exception as e:
        conn.rollback()
        print(f"!!! Error in email_confirmation: {e}")
        flash("An error occurred while sending your email.", "error")
    finally:
        conn.close()

    return redirect(url_for("rsvp_confirmation", code=confirmation_code))

@app.route("/rsvp/respond")
def rsvp_respond():
    return render_template("rsvp_form.html")

@app.route("/vendors")
def vendors():
    return render_template(
        "vendors.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY=os.environ.get("SUPABASE_PUBLISHABLE_KEY"),
    )


@app.route("/hello")
def hello():
    return render_template(
        "address-collection.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY=os.environ.get("SUPABASE_PUBLISHABLE_KEY"),
    )


@app.route("/dashboard")
def dashboard():
    return render_template(
        "dashboard.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY=os.environ.get("SUPABASE_PUBLISHABLE_KEY"),
    )


@app.route("/address")
def address_book():
    return render_template(
        "address-book.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY=os.environ.get("SUPABASE_PUBLISHABLE_KEY"),
    )

# --- Page Route ---
@app.route("/timeline")
def timeline_page():
    return render_template(
        "timeline.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY=os.environ.get("SUPABASE_PUBLISHABLE_KEY"),
    )

# --- API Routes ---
@app.route("/api/timeline", methods=["GET"])
def get_timeline():
    ctx, err = require_user()
    if err: return err
    
    query = """
        SELECT 
            id, 
            description, 
            wedding_party, 
            vendor, 
            phase,
            start_time::text, 
            end_time::text, 
            color_code
        FROM timeline_events 
        ORDER BY phase, start_time ASC; -- Group by phase first
    """
    data, error = get_data_from_query(query)
    return jsonify(data) if not error else (jsonify({"error": error}), 500)

from flask import request, redirect, url_for, render_template, flash

@app.route("/rsvp/modify/search-by-code", methods=["POST"])
def search_by_code():
    code = request.form.get("confirmation_code", "").strip().upper()
    
    # Query Supabase for the confirmation code
    response = supabase.table("parties").select("*").eq("confirmation_code", code).execute()
    
    if not response.data:
        # FIXED: Uses 'rsvp_existing' instead of 'find_rsvp_page'
        flash("We couldn't find a reservation matching that reference code. Please check for typos or try searching by your name.", "error")
        return redirect(url_for("rsvp_existing"))
        
    # FIXED: Uses 'rsvp_confirmation' instead of 'confirmation_page'
    return redirect(url_for("rsvp_confirmation", code=code))


# ADD THIS MISSING ROUTE FOR SEARCHING BY NAME:
from flask import current_app
# (Ensure you import whatever database connection utility your project uses, 
# e.g., psycopg2 or a get_db() context manager. Here is the standard psycopg2 approach:)



@app.route("/rsvp/modify/search-by-name", methods=["POST"])
def search_by_name():
    raw_name = request.form.get("guest_name", "").strip()
    clean_name = " ".join(raw_name.split())
    
    if not clean_name:
        flash("Please enter a name to search.", "error")
        return redirect(url_for("rsvp_existing"))

    search_pattern = f"%{clean_name}%"

    # SQL query automatically filters out inactive guests (Rule 2c)
    query = """
        SELECT g.party_id, p.confirmation_code, g.rsvp_status 
        FROM guests g
        JOIN parties p ON g.party_id = p.id
        WHERE (TRIM(COALESCE(g.first_name, '') || ' ' || COALESCE(g.last_name, '')) ILIKE %s
           OR EXISTS (
               SELECT 1 
               FROM unnest(COALESCE(g.alt_first_name, ARRAY[]::text[])) af(fn),
                    unnest(COALESCE(g.alt_last_name, ARRAY[]::text[])) al(ln)
               WHERE TRIM(fn || ' ' || ln) ILIKE %s
           )
           OR EXISTS (
               SELECT 1 
               FROM unnest(COALESCE(g.alt_first_name, ARRAY[]::text[])) af(fn)
               WHERE TRIM(fn || ' ' || COALESCE(g.last_name, '')) ILIKE %s
           )
           OR EXISTS (
               SELECT 1 
               FROM unnest(COALESCE(g.alt_last_name, ARRAY[]::text[])) al(ln)
               WHERE TRIM(COALESCE(g.first_name, '') || ' ' || ln) ILIKE %s
           ))
          AND (g.record_status IS NULL OR LOWER(TRIM(g.record_status)) != 'inactive')
        LIMIT 1;
    """
    
    conn = get_db_connection()
    if not conn:
        flash("Database unavailable. Please try searching by your confirmation code.", "error")
        return redirect(url_for("rsvp_existing"))

    try:
        with conn.cursor() as cur:
            cur.execute(query, (search_pattern, search_pattern, search_pattern, search_pattern))
            row = cur.fetchone()
            
            # Rule 2b & 2c: If not found or inactive, stay on page and show error
            if not row:
                flash("We couldn't find an invitation under that name. Please check your spelling or search by your reference code.", "error")
                return redirect(url_for("rsvp_existing"))
                
            party_id = row[0]
            confirmation_code = row[1]
            rsvp_status = row[2]

            # Store the current editor in the session for tracking purposes
            session['current_editor'] = f"Guest: {clean_name}"

            # Rule 1: If found but RSVP deadline has passed, go to confirmation page
            if check_is_post_deadline():
                return redirect(url_for("rsvp_confirmation", code=confirmation_code))
            
            # Rule 2: If found and active, go to form or confirmation page
            if not rsvp_status or rsvp_status.lower() == 'pending':
                return redirect(url_for("rsvp_form", code=confirmation_code))
                
            return redirect(url_for("rsvp_confirmation", code=confirmation_code))
            
    except Exception as e:
        print(f"!!! DB Error in search_by_name: {e}")
        flash("An internal database error occurred. Please try searching by your confirmation code.", "error")
        return redirect(url_for("rsvp_existing"))
    finally:
        conn.close()


@app.route("/rsvp/search", methods=["POST"])
def rsvp_search():
    raw_name = request.form.get("guest_name", "").strip()
    clean_name = " ".join(raw_name.split())
    
    if not clean_name:
        flash("Please enter a name to search.", "error")
        return redirect(url_for("rsvp"))  # Stays on the main RSVP page

    search_pattern = f"%{clean_name}%"

    query = """
        SELECT g.party_id, p.confirmation_code, g.rsvp_status 
        FROM guests g
        JOIN parties p ON g.party_id = p.id
        WHERE (TRIM(COALESCE(g.first_name, '') || ' ' || COALESCE(g.last_name, '')) ILIKE %s
           OR EXISTS (
               SELECT 1 
               FROM unnest(COALESCE(g.alt_first_name, ARRAY[]::text[])) af(fn),
                    unnest(COALESCE(g.alt_last_name, ARRAY[]::text[])) al(ln)
               WHERE TRIM(fn || ' ' || ln) ILIKE %s
           )
           OR EXISTS (
               SELECT 1 
               FROM unnest(COALESCE(g.alt_first_name, ARRAY[]::text[])) af(fn)
               WHERE TRIM(fn || ' ' || COALESCE(g.last_name, '')) ILIKE %s
           )
           OR EXISTS (
               SELECT 1 
               FROM unnest(COALESCE(g.alt_last_name, ARRAY[]::text[])) al(ln)
               WHERE TRIM(COALESCE(g.first_name, '') || ' ' || ln) ILIKE %s
           ))
          AND (g.record_status IS NULL OR LOWER(TRIM(g.record_status)) != 'inactive')
        LIMIT 1;
    """
    
    conn = get_db_connection()
    if not conn:
        flash("Database unavailable. Please try searching by your confirmation code.", "error")
        return redirect(url_for("rsvp"))  # Stays on the main RSVP page

    try:
        with conn.cursor() as cur:
            cur.execute(query, (search_pattern, search_pattern, search_pattern, search_pattern))
            row = cur.fetchone()
            
            # If not found OR if they are inactive (because the SQL query filters inactive out):
            if not row:
                flash("We couldn't find an invitation under that name. Please check your spelling or search by your reference code.", "error")
                return redirect(url_for("rsvp"))  # Stays on the main RSVP page
                
            party_id = row[0]
            confirmation_code = row[1]
            rsvp_status = row[2]

            # Store the current editor in the session for tracking purposes
            session['current_editor'] = f"Guest: {clean_name}"
            
            if not rsvp_status or rsvp_status.lower() == 'pending':
                return redirect(url_for("rsvp_form", code=confirmation_code))
                
            return redirect(url_for("rsvp_confirmation", code=confirmation_code))
            
    except Exception as e:
        print(f"!!! DB Error in rsvp_search: {e}")
        flash("An internal database error occurred. Please try searching by your confirmation code.", "error")
        return redirect(url_for("rsvp"))  # Stays on the main RSVP page
    finally:
        conn.close()

@app.route("/api/timeline", methods=["POST"])
def add_timeline_event():
    # 1. Enforce Admin-only access using your existing auth rank
    ctx, err = require_user(min_role="admin")
    if err: return err
    
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    # --- THIS IS THE FIX ---
    # Convert empty strings ("") into None (NULL for the database)
    start_time = data.get("start_time") or None
    end_time = data.get("end_time") or None

    try:
        with conn.cursor() as cur:
            event_id = data.get("id")
            
            # 2. UPDATE existing row if an ID is present
            if event_id:
                cur.execute(
                    """
                    UPDATE timeline_events 
                    SET description=%s, wedding_party=%s, vendor=%s, 
                        start_time=%s, end_time=%s, color_code=%s, phase=%s
                    WHERE id=%s RETURNING id;
                    """,
                    (
                        data.get("description"), 
                        data.get("wedding_party"), 
                        data.get("vendor"), 
                        start_time, # <-- Uses the safe variable
                        end_time,   # <-- Uses the safe variable
                        data.get("color_code"),
                        data.get("phase"),
                        event_id
                    )
                )
            
            # 3. INSERT new row if no ID exists
            else:
                cur.execute(
                    """
                    INSERT INTO timeline_events 
                        (description, wedding_party, vendor, start_time, end_time, color_code, phase)
                    VALUES (%s, %s, %s, %s, %s, %s, %s) 
                    RETURNING id;
                    """,
                    (
                        data.get("description"), 
                        data.get("wedding_party"), 
                        data.get("vendor"), 
                        start_time, # <-- Uses the safe variable
                        end_time,   # <-- Uses the safe variable
                        data.get("color_code"),
                        data.get("phase")
                    )
                )
            
            result = cur.fetchone()
            conn.commit()
            
            if not result:
                return jsonify({"error": "Event not found or failed to save"}), 404
                
            return jsonify({"ok": True, "id": result[0]})

    except Exception as e:
        conn.rollback()
        print(f"Error saving timeline event: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/timeline/<event_id>", methods=["DELETE"])
def delete_timeline_event(event_id):
    ctx, err = require_user(min_role="admin")
    if err: return err
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM timeline_events WHERE id = %s", (event_id,))
            conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/guests/<guest_id>/history", methods=["GET"])
def get_guest_history(guest_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT party_id FROM guests WHERE id = %s", (guest_id,))
            guest_row = cur.fetchone()
            party_id = guest_row[0] if guest_row else None

            cur.execute(
                """
                SELECT 
                    a.id, 
                    a.table_name, 
                    a.record_id, 
                    a.action, 
                    a.batch_id, 
                    a.changed_by, 
                    a.old_data, 
                    a.new_data, 
                    a.created_at,
                    CASE 
                        WHEN a.table_name = 'guests' THEN COALESCE(g.first_name || ' ' || g.last_name, 'Guest')
                        WHEN a.table_name = 'parties' THEN COALESCE(p.display_name, p.legacy_key, 'Household')
                        ELSE 'Record'
                    END AS entity_name
                FROM audit_logs a
                LEFT JOIN guests g ON a.table_name = 'guests' AND a.record_id = g.id
                LEFT JOIN parties p ON a.table_name = 'parties' AND a.record_id = p.id
                WHERE (a.table_name = 'guests' AND a.record_id = %s)
                   OR (a.table_name = 'parties' AND a.record_id = %s)
                ORDER BY a.created_at DESC;
                """,
                (guest_id, party_id)
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            logs = []
            for row in rows:
                log = dict(zip(cols, row))
                # Convert datetime object to ISO string so JS can parse local timezone cleanly
                if log.get("created_at"):
                    log["created_at"] = log["created_at"].isoformat()
                logs.append(log)
                
        return jsonify(logs)
    except Exception as e:
        print(f"Error fetching guest history: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route("/export")
def exports():
    return render_template(
        "export.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY=os.environ.get("SUPABASE_PUBLISHABLE_KEY"),
    )

@app.route("/settings")
def settings_page():
    return render_template(
        "settings.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY=os.environ.get("SUPABASE_PUBLISHABLE_KEY"),
    )

@app.route('/api/profile/update', methods=['POST'])
def update_profile():
    # 1. Verify who is making the request (using your exact tuple unpacking)
    ctx, err = require_user()
    if err: 
        return err
        
    user_id = ctx["user"]["id"]

    data = request.json or {}
    full_name = data.get('full_name')
    theme_color = data.get('theme_color')

    # 2. Package up the changes
    updates = {}
    if full_name:
        updates['full_name'] = full_name
    if theme_color:
        updates['theme_color'] = theme_color

    if not updates:
        return jsonify({"error": "No data to update"}), 400

    # 3. Connect to the DB using your exact psycopg2 setup
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500
        
    try:
        # Safely build the SQL query to prevent SQL injection
        set_parts = []
        values = []
        for k, v in updates.items():
            set_parts.append(sql.SQL("{} = %s").format(sql.Identifier(k)))
            values.append(v)
            
        values.append(user_id)

        query = sql.SQL(
            "UPDATE profiles SET {sets} WHERE id = %s"
        ).format(sets=sql.SQL(", ").join(set_parts))

        with conn.cursor() as cur:
            cur.execute(query, values)
            conn.commit()

        return jsonify({"success": True, "message": "Profile updated successfully"}), 200
    
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Profile update error: {e}")
        return jsonify({"error": "Failed to update profile"}), 500
    finally:
        if conn:
            conn.close()


def send_rsvp_confirmation_email(recipient_email, confirmation_code, guests_list, lodging_choice=None, preview_text=""):
    api_key = os.environ.get("MAILERSEND_API_KEY")
    template_id = os.environ.get("MAILERSEND_TEMPLATE_ID")
    from_email = os.environ.get("MAILERSEND_FROM_EMAIL", "rsvp@emmaandethan.com")
    from_name = os.environ.get("MAILERSEND_FROM_NAME", "Emma & Ethan")
    subject = "RSVP Confirmation for Emma & Ethan's Wedding"

    if not api_key or not template_id:
        print("!!! MailerSend credentials missing in environment variables.")
        return False

    # Format the list to match MailerSend's native 'item' array structure
    formatted_items = []
    for guest in guests_list:
        formatted_items.append({
            "name": guest.get('name', ''),
            "status": guest.get('rsvp', ''),  # Maps to the 'status' column in your screenshot
            "dietary": guest.get('dietary', 'None')
        })

    url = "https://api.mailersend.com/v1/email"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "from": {
            "email": from_email,
            "name": from_name
        },
        "to": [
            {
                "email": recipient_email
            }
        ],
        "subject": subject, 
        "template_id": template_id,
        "personalization": [
            {
                "email": recipient_email,
                "data": {
                    "confirmation_code": confirmation_code,
                    "lodging": lodging_choice or "Not specified",
                    "confirmation_url": f"https://www.emmaandethan.com/rsvp/confirmation/{confirmation_code}",
                    "preview_text": preview_text,
                    "item": formatted_items
                }
            }
        ]
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code >= 400:
            print(f"!!! MailerSend API Error: {response.status_code} - {response.text}")
            return False
        return True
    except Exception as e:
        print(f"!!! Error sending confirmation email: {e}")
        return False

@app.route("/admin/log")
def audit_logs_page():
    conn = get_db_connection()
    if not conn:
        return "Database unavailable", 500

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 
                    a.id, 
                    a.table_name, 
                    a.record_id, 
                    a.action, 
                    a.batch_id, 
                    a.changed_by, 
                    a.old_data, 
                    a.new_data, 
                    a.created_at,
                    CASE 
                        WHEN a.table_name = 'guests' THEN COALESCE(g.first_name || ' ' || g.last_name, (a.new_data->>'first_name') || ' ' || (a.new_data->>'last_name'), (a.old_data->>'first_name') || ' ' || (a.old_data->>'last_name'), 'Guest #' || LEFT(a.record_id::text, 8))
                        WHEN a.table_name = 'parties' THEN COALESCE(p.display_name, p.legacy_key, (a.new_data->>'display_name'), (a.old_data->>'display_name'), 'Party #' || LEFT(a.record_id::text, 8))
                        ELSE a.record_id::text
                    END AS entity_name
                FROM audit_logs a
                LEFT JOIN guests g ON a.table_name = 'guests' AND a.record_id = g.id
                LEFT JOIN parties p ON a.table_name = 'parties' AND a.record_id = p.id
                ORDER BY a.created_at DESC;
                """
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            logs = [dict(zip(cols, row)) for row in rows]
    except Exception as e:
        return f"Database query error: {e}", 500
    finally:
        conn.close()

    return render_template("audit-log.html", logs=logs)



if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG") == "1" or ENV == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)


