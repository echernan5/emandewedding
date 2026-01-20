import os
import psycopg2
import requests
import urllib.parse
from dotenv import load_dotenv
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from psycopg2 import sql

load_dotenv()

app = Flask(__name__)

# Use a more permissive CORS for development; restrict in production
CORS(app, origins=["http://127.0.0.1:5500", "null"])

# --- CONFIGURATION ---
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")  # recommended for signed urls

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set.")


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


# --- GUEST & PARTY API ENDPOINTS ---

@app.route("/api/dashboard/metrics", methods=["GET"])
def get_dashboard_metrics():
    query = sql.SQL("SELECT * FROM dashboard_stats;")
    stats, error = get_data_from_query(query)
    if error or not stats:
        return jsonify({"error": "Could not load stats"}), 500
    return jsonify(stats[0])


@app.route("/api/guests", methods=["GET"])
def get_guests():
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
            g.is_21_plus AS "is21Plus"
        FROM guests g
        JOIN parties p ON g.party_id = p.id
        ORDER BY p.legacy_key, g.first_name;
        """
    )
    guest_list, error = get_data_from_query(query)
    return jsonify(guest_list) if not error else (jsonify({"error": error}), 500)


@app.route("/api/guests/<guest_id>", methods=["PATCH"])
def update_guest(guest_id):
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
                    is_21_plus AS "is21Plus"
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

        return jsonify({"ok": True, "id": party_id, "is_address_collected": updates.get("is_address_collected")})

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/address-book", methods=["GET"])
def get_address_book():
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


# --- VENDORS API ENDPOINTS ---

@app.route("/api/vendors", methods=["GET"])
def get_vendors():
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
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        with conn.cursor() as cur:
            # 1. Fetch Company
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

            # 2. Fetch People
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

            # 3. Fetch Payments + Subqueries for Responsibilities & Files
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

            # 4. Fetch Company-level files
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

        return jsonify({
            "company": company,
            "people": people,
            "payments": payments,
            "company_files": company_files,
        })

    except Exception as e:
        print(f"Server Error in get_vendor_details: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


import urllib.parse

@app.route("/api/vendor-files/signed-url", methods=["GET"])
def vendor_file_signed_url():
    storage_path = request.args.get("path")
    if not storage_path:
        return jsonify({"error": "Missing ?path="}), 400

    bucket = "vendor-files"
    expires_in = 60 * 60 
    api_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY

    # clean base url (remove trailing slash)
    base_url = SUPABASE_URL.rstrip("/")
    
    # 1. Request the signature from Supabase
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

        # 2. Extract the signed URL from the response
        # It usually looks like: "/object/sign/vendor-files/...?token=xyz"
        raw_signed_url = data.get("signedURL") or data.get("signedUrl") or data.get("url")
        
        if not raw_signed_url:
            return jsonify({"error": "No URL returned from Supabase"}), 500

        # 3. THE FIX: Manually build the correct URL structure.
        # We assume the response might be missing '/storage/v1' or have other quirks.
        # The safest bet is to extract the query string (the token) and rebuild the path.
        
        if "?" in raw_signed_url:
            token_query = raw_signed_url.split("?")[1] # gets "token=eyJ..."
            
            # Construct the definitive correct URL manually
            # Structure: [SUPABASE_URL]/storage/v1/object/sign/[bucket]/[path]?[token]
            final_url = f"{base_url}/storage/v1/object/sign/{bucket}/{storage_path}?{token_query}"
        else:
            # Fallback if no token found (public bucket scenario?)
            final_url = f"{base_url}/storage/v1/object/public/{bucket}/{storage_path}"

        return jsonify({"url": final_url})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/debug-storage/<company_id>/<folder>")
def debug_storage(company_id, folder):
    # Construct the folder path (e.g., vendor_id/receipts)
    path = f"{company_id}/{folder}"
    bucket = "vendor-files"
    list_url = f"{SUPABASE_URL}/storage/v1/object/list/{bucket}"
    api_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY

    resp = requests.post(
        list_url,
        headers={"apikey": api_key, "Authorization": f"Bearer {api_key}"},
        json={"prefix": path}
    )
    return jsonify(resp.json())

@app.route("/api/payments/save", methods=["POST"])
def save_payment_details():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        data = request.json
        company_id = data.get("company_id")
        payment_id = data.get("payment_id") 
        description = data.get("description")
        amount = data.get("amount")
        due_date = data.get("due_date")
        notes = data.get("notes")
        responsibilities = data.get("responsibilities", [])

        cur = conn.cursor()

        if payment_id:
            # --- UPDATE EXISTING ---
            cur.execute("""
                UPDATE vendor_payments
                SET description = %s,
                    amount = %s,
                    due_date = %s,
                    notes = %s,
                    updated_at = NOW()
                WHERE id = %s RETURNING id;
            """, (description, amount, due_date, notes, payment_id))
            pid = cur.fetchone()[0]
        else:
            # --- INSERT NEW ---
            # THE FIX: Removed 'status' from columns and 'upcoming' from values
            cur.execute("""
                INSERT INTO vendor_payments 
                (company_id, description, amount, due_date, notes)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
            """, (company_id, description, amount, due_date, notes))
            pid = cur.fetchone()[0]

        # --- UPDATE RESPONSIBILITIES ---
        cur.execute("DELETE FROM vendor_payment_responsibilities WHERE payment_id = %s", (pid,))
        
        for r in responsibilities:
            cur.execute("""
                INSERT INTO vendor_payment_responsibilities 
                (payment_id, responsible_party, amount, reimbursement_status)
                VALUES (%s, %s, %s, 'none');
            """, (pid, r.get("responsible_party"), r.get("amount")))

        conn.commit()
        return jsonify({"ok": True, "id": pid})

    except Exception as e:
        conn.rollback()
        print(f"ERROR saving payment: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route("/favicon.ico")
def favicon():
    return "", 204


# --- FRONTEND PAGE ROUTES ---

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/login")
def login():
    return render_template(
        "login.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        supabase_anon_key=os.environ.get("SUPABASE_ANON_KEY"),
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

@app.route("/faqs")
def faqs():
    return render_template("faq.html")


@app.route("/vendors")
def vendors():
    return render_template(
        "vendors.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        supabase_anon_key=os.environ.get("SUPABASE_ANON_KEY"),
    )


@app.route("/hello")
def hello():
    return render_template(
        "address-collection.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        supabase_anon_key=os.environ.get("SUPABASE_ANON_KEY"),
    )


@app.route("/dashboard")
def dashboard():
    return render_template(
        "dashboard.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        supabase_anon_key=os.environ.get("SUPABASE_ANON_KEY"),
    )


@app.route("/address")
def address_book():
    return render_template(
        "address-book.html",
        supabase_url=os.environ.get("SUPABASE_URL"),
        supabase_anon_key=os.environ.get("SUPABASE_ANON_KEY"),
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
