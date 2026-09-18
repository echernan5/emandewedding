import os
import psycopg2
import requests
import uuid
import json
import csv
import io

from supabase import create_client, Client
from dotenv import load_dotenv

from dotenv import load_dotenv
# Consolidated all Flask imports into one clean line at the top:
from flask import Flask, jsonify, request, render_template, Response, redirect, url_for, flash, session
from flask_cors import CORS
from psycopg2 import sql
# Import Supabase:
from supabase import create_client, Client

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20MB

# REQUIRED FOR FLASH MESSAGES:
app.secret_key = os.environ.get("SECRET_KEY", "fallback-secret-key-for-development")

# -----------------------------
# Config & Supabase Init
# -----------------------------
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

if "sslmode=" not in DATABASE_URL:
    DATABASE_URL += ("&" if "?" in DATABASE_URL else "?") + "sslmode=require"

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set.")

supabase: Client = create_client(
    os.environ.get("SUPABASE_URL"),
    os.environ.get("SUPABASE_PUBLISHABLE_KEY")
)

# -----------------------------
# Environment / CORS
# -----------------------------
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

# -----------------------------
# Config
# -----------------------------
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

# Render Postgres often requires sslmode=require
if "sslmode=" not in DATABASE_URL:
    DATABASE_URL += ("&" if "?" in DATABASE_URL else "?") + "sslmode=require"

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set.")

# Put this near the top of app.py (after SUPABASE_* are defined)
ROLE_RANK = {"viewer": 1, "editor": 2, "admin": 3}

import os
print("DB:", os.getenv("DATABASE_URL"))

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

from datetime import datetime, date

def format_last_updated(val):
    if not val:
        return '—'
    
    # Parse string to datetime if necessary
    if isinstance(val, str):
        try:
            val = datetime.fromisoformat(val)
        except ValueError:
            return '—'
            
    # Extract the date part
    val_date = val.date() if isinstance(val, datetime) else val
    today = date.today()
    delta_days = (today - val_date).days
    
    if delta_days == 0:
        return 'Today'
    elif delta_days == 1:
        return 'Yesterday'
    else:
        return val_date.strftime('%b %d, %Y')

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
                WHERE party_id = %s
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
              ) FILTER (WHERE g.id IS NOT NULL),
              '[]'::json
            ) AS members
        FROM parties p
        LEFT JOIN guests g ON g.party_id = p.id
        GROUP BY p.id
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


@app.route("/welcome-party")
def welcomeparty():
    return render_template("welcome-party.html")

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
                    g.dietary_restrictions,
                    g.is_anonymous,
                    p.display_name AS party_name,
                    p.legacy_key,
                    p.lodging_choice,
                    p.shuttle_interest,
                    p.guest_note,
                    p.updated_at
                FROM guests g
                JOIN parties p ON g.party_id = p.id
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
                # Check for True, 1, or 'true' depending on how psycopg2 returns the boolean
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
                
            # Build table row data
            formatted_guests.append({
                'first_name': g.get('first_name'),
                'last_name': g.get('last_name'),
                'party_name': g.get('party_name') or g.get('legacy_key', ''),
                'is_plus_one': g.get('is_anonymous', False),
                'rsvp_status': g.get('rsvp_status'),
                'lodging_choice': g.get('lodging_choice'),
                'shuttle_interest': g.get('shuttle_interest'),
                'updated_at': format_last_updated(g.get('updated_at'))
            })

        # Count Shuttles: If the party requested shuttle, add all accepted members of this party to the correct hotel block
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

    # Calculate days until RSVP deadline (May 14, 2027)
    rsvp_deadline = date(2027, 5, 14)
    days_until_rsvp = (rsvp_deadline - date.today()).days

    return render_template(
        "family_dashboard.html",
        total_accepted=total_accepted,
        total_pending=total_pending,
        total_21_plus=total_21_plus,
        days_until_rsvp=days_until_rsvp,  # <-- Pass the countdown here
        lodging_counts=lodging_counts,
        shuttle_counts=shuttle_counts,
        total_shuttle_requested=total_shuttle_requested,
        dietary_list=dietary_list,
        guest_notes=guest_notes,
        all_guests=formatted_guests,
        supabase_url=os.environ.get("SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY=os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    )

@app.route("/faqs")
def faqs():
    return render_template("faq.html")

@app.route("/rsvp")
def rsvp():
    return render_template("rsvp.html")

@app.route("/rsvp/lookup")
def rsvp_existing():
    return render_template("find_rsvp.html")

@app.route("/rsvp/form")
def rsvp_form():
    code = request.args.get("code")
    
    if not code:
        flash("No reservation code found. Please search again.", "error")
        return redirect(url_for("rsvp_existing"))

    party_query = """
        SELECT id, confirmation_code, lodging_choice, shuttle_interest, guest_note
        FROM parties
        WHERE confirmation_code = %s;
    """
    
    guests_query = """
        SELECT g.id, g.party_id, g.first_name, g.last_name, g.rsvp_status, 
               g.dietary_restrictions, g.is_anonymous, g.guest_of, g.updated_at
        FROM guests g
        JOIN parties p ON g.party_id = p.id
        WHERE p.confirmation_code = %s
        ORDER BY g.id ASC;
    """
    
    conn = get_db_connection()
    if not conn:
        flash("Database unavailable. Please try again later.", "error")
        return redirect(url_for("rsvp_existing"))

    try:
        with conn.cursor() as cur:
            # 1. Fetch party details
            cur.execute(party_query, (code,))
            party_row = cur.fetchone()
            
            if not party_row:
                flash("We couldn't find an invitation tied to that code.", "error")
                return redirect(url_for("rsvp_existing"))
                
            party = {
                "id": party_row[0],
                "confirmation_code": party_row[1] or "",
                "lodging_choice": party_row[2] or "",
                "shuttle_interest": party_row[3] or "",
                "guest_note": party_row[4] or ""
            }

            # 2. Fetch all guests for this party
            cur.execute(guests_query, (code,))
            guest_rows = cur.fetchall()
            guest_cols = [d[0] for d in cur.description]
            guests = [dict(zip(guest_cols, r)) for r in guest_rows]

        # 3. Build a string-safe ID-to-First-Name lookup dictionary
        guest_name_map = {}
        for g in guests:
            g_id = str(g.get("id"))
            fname = (g.get("first_name") or "").strip()
            guest_name_map[g_id] = fname if fname else "Guest"

        # 4. Resolve the guest_of UUID to the primary guest's first name
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
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        with conn.cursor() as cur:
            # 1. Fetch party details using your confirmation code column
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

            # 2. Fetch guests associated with this party's ID
            cur.execute(
                """
                SELECT id, party_id, first_name, last_name, rsvp_status, 
                       dietary_restrictions, is_anonymous, guest_of, updated_at
                FROM guests
                WHERE party_id = %s;
                """,
                (party["id"],)
            )
            guest_rows = cur.fetchall()
            guest_cols = [d[0] for d in cur.description]
            guests = [dict(zip(guest_cols, r)) for r in guest_rows]

        # 3. Build a UUID-to-Name lookup dictionary for all guests in this party
        guest_name_map = {}
        for g in guests:
            g_id = str(g.get("id"))
            fname = (g.get("first_name") or "").strip()
            lname = (g.get("last_name") or "").strip()
            if fname:
                guest_name_map[g_id] = f"{fname} {lname}".strip()
            else:
                guest_name_map[g_id] = "Guest"

        # 4. Resolve the guest_of UUID to the primary guest's full name
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
    form_data = request.form
    confirmation_code = form_data.get("confirmation_code")
    
    if not confirmation_code:
        flash("Confirmation code missing. Please try again.", "error")
        return redirect(url_for("rsvp_existing"))

    lodging_choice = form_data.get("lodging_choice")
    shuttle_interest = form_data.get("shuttle_interest")
    guest_note = form_data.get("guest_note")

    # 1. Capture email and check if the user chose to skip
    confirmation_email = form_data.get("confirmation_email", "").strip()
    skip_email = form_data.get("skip_email") == "true"

    conn = get_db_connection()
    if not conn:
        flash("Database unavailable. Please try again later.", "error")
        return redirect(url_for("rsvp_existing"))

    try:
        with conn.cursor() as cur:
            # Update Household Logistics & Note in 'parties' table
            cur.execute(
                """
                UPDATE parties 
                SET lodging_choice = %s, 
                    shuttle_interest = %s, 
                    guest_note = %s
                WHERE confirmation_code = %s;
                """,
                (lodging_choice, shuttle_interest, guest_note, confirmation_code)
            )
            
            # Track if anyone in the party is attending
            party_attending = False

            # Update Individual Guests (Status, Dietary Restrictions, and Plus-One Names)
            for key, value in form_data.items():
                if key.startswith("guest_") and key.endswith("_status"):
                    
                    # Check if this guest accepted
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

            conn.commit()

            # 2. Fetch the updated guests for this confirmation code to include in the email
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
                
                # Format into the guest list structure for MailerSend
                guests_list = []
                for row in rows:
                    # Depending on your cursor type (dict vs tuple), adjust indexing or keys. 
                    # Assuming standard tuple here: (first_name, last_name, rsvp_status, dietary_restrictions)
                    full_name = f"{row[0]} {row[1]}" if row[0] and row[1] else (row[0] or "")
                    guests_list.append({
                        "name": full_name,
                        "rsvp": row[2] or "Pending",
                        "dietary": row[3] or "None"
                    })

            # 3. Trigger the confirmation email if provided and not skipped
            if confirmation_email and not skip_email:
                # Assign the dynamic preview text based on attendance
                if party_attending:
                    dynamic_preview = "We can't wait to celebrate with you at Bay Pointe Inn!"
                else:
                    dynamic_preview = "Thank you for letting us know. You'll be with us in spirit!"
                
                try:
                    send_rpv_confirmation_email = send_rsvp_confirmation_email(
                        recipient_email=confirmation_email,
                        confirmation_code=confirmation_code,
                        guests_list=guests_list, # <--- Passed here successfully!
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

from flask import session, render_template, redirect, url_for
# (make sure your Supabase query imports are set up as needed)

# We allow both URL styles: /rsvp/confirmation?code=XYZ and /rsvp/confirmation/XYZ
@app.route('/rsvp/confirmation', defaults={'code': None})
@app.route('/rsvp/confirmation/<code>')
def rsvp_confirmation(code):
    # 1. Get the code from the URL path OR the query string (?code=)
    if not code:
        code = request.args.get("code", "").strip().upper()
        
    if not code:
        flash("Please enter a confirmation code to view your itinerary.", "error")
        return redirect(url_for("rsvp_existing"))

    # 2. Query the real party details from Postgres
    party_query = """
        SELECT id, confirmation_code, lodging_choice, shuttle_interest, guest_note
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

    # 3. Query ALL guests tied to this party_id
    # We use SQL to cleanly combine first_name + last_name into 'name' for your HTML template!
    # 3. Query ALL guests tied to this party_id and grab their individual rsvp_status
    guests_query = """
        SELECT id, 
               TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS name,
               rsvp_status, 
               dietary_restrictions
        FROM guests
        WHERE party_id = %s
        ORDER BY id ASC;
    """
    real_party_members, g_err = get_data_from_query(guests_query, (party_id,))
    
    if g_err:
        real_party_members = []

    # 4. Render your HTML template using the REAL database rows!
    return render_template(
        "rsvp_confirmation.html", 
        party=real_party, 
        party_members=real_party_members
    )

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

    # Grab the confirmation code AND the rsvp_status of the matching guest (or party)
    query = """
        SELECT g.party_id, p.confirmation_code, g.rsvp_status 
        FROM guests g
        JOIN parties p ON g.party_id = p.id
        WHERE TRIM(COALESCE(g.first_name, '') || ' ' || COALESCE(g.last_name, '')) ILIKE %s
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
           )
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
            
            if not row:
                flash("We couldn't find a reservation under that name. Please check your spelling or search by your reference code.", "error")
                return redirect(url_for("rsvp_existing"))
                
            party_id = row[0]
            confirmation_code = row[1]
            rsvp_status = row[2]
            
            # If they haven't responded yet (status is pending or empty/None), send them to the RSVP form
            if not rsvp_status or rsvp_status.lower() == 'pending':
                return redirect(url_for("rsvp_form", code=confirmation_code))
                
            # Otherwise, they've already responded, so take them to the confirmation/summary page
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
        return redirect(url_for("rsvp_landing")) # Or whatever your landing route is called

    search_pattern = f"%{clean_name}%"

    query = """
        SELECT g.party_id, p.confirmation_code, g.rsvp_status 
        FROM guests g
        JOIN parties p ON g.party_id = p.id
        WHERE TRIM(COALESCE(g.first_name, '') || ' ' || COALESCE(g.last_name, '')) ILIKE %s
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
           )
        LIMIT 1;
    """
    
    conn = get_db_connection()
    if not conn:
        flash("Database unavailable. Please try searching by your confirmation code.", "error")
        return redirect(url_for("rsvp_landing"))

    try:
        with conn.cursor() as cur:
            cur.execute(query, (search_pattern, search_pattern, search_pattern, search_pattern))
            row = cur.fetchone()
            
            if not row:
                flash("We couldn't find a reservation under that name. Please check your spelling or search by your reference code.", "error")
                return redirect(url_for("rsvp_landing"))
                
            party_id = row[0]
            confirmation_code = row[1]
            rsvp_status = row[2]
            
            # If pending (or empty), bounce them straight to the active RSVP form
            if not rsvp_status or rsvp_status.lower() == 'pending':
                return redirect(url_for("rsvp_form", code=confirmation_code))
                
            # Otherwise, they've already responded, so take them to the confirmation page
            return redirect(url_for("rsvp_confirmation", code=confirmation_code))
            
    except Exception as e:
        print(f"!!! DB Error in rsvp_search: {e}")
        flash("An internal database error occurred. Please try searching by your confirmation code.", "error")
        return redirect(url_for("rsvp_landing"))
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
    subject = "RSVP Confirmation: Emma & Ethan's Wedding"

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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG") == "1" or ENV == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)


