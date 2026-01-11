import os
import uuid
import psycopg2
import urllib.parse as urlparse
from dotenv import load_dotenv
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from psycopg2 import sql

load_dotenv()

app = Flask(__name__)
# Use a more permissive CORS for development; restrict in production
CORS(app, origins=["http://127.0.0.1:5500", "null"])

# --- CONFIGURATION ---
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

def get_db_connection():
    try:
        # Psycopg2 can parse the DATABASE_URL string natively.
        # This is much more robust than manually splitting it with urlparse.
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"!!! DB CONNECTION ERROR: {e}")
        return None

def get_data_from_query(query, params=None):
    conn = get_db_connection()
    if not conn: return None, "Database unavailable."
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

@app.route('/api/dashboard/metrics', methods=['GET'])
def get_dashboard_metrics():
    # Calling the View we built in Supabase!
    query = sql.SQL("SELECT * FROM dashboard_stats;")
    stats, error = get_data_from_query(query)
    if error or not stats:
        return jsonify({"error": "Could not load stats"}), 500
    return jsonify(stats[0])

@app.route('/api/guests', methods=['GET'])
def get_guests():
    query = sql.SQL("""
        SELECT id, legacy_key AS "partyName", address_street AS street, 
               address_street2 AS street2, address_city AS city, 
               address_state AS state, address_zip AS zip, 
               is_address_collected AS "isAddressCollected"
        FROM parties ORDER BY legacy_key ASC;
    """)
    parties, error = get_data_from_query(query)
    return jsonify(parties) if not error else (jsonify({"error": error}), 500)

@app.route('/api/guestlist', methods=['GET'])
def get_guestlist():
    query = sql.SQL("""
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
            g.relationship AS relation
        FROM guests g
        JOIN parties p ON g.party_id = p.id
        ORDER BY p.legacy_key, g.first_name;
    """)
    guest_list, error = get_data_from_query(query)
    return jsonify(guest_list) if not error else (jsonify({"error": error}), 500)


@app.route('/api/guests/<guest_id>', methods=['PATCH'])
def update_guest(guest_id):
    payload = request.get_json(force=True) or {}

    allowed = {
        "first_name", "last_name",
        "rsvp_status", "welcome_dinner_rsvp",
        "lodging", "dietary_restrictions",
        "table_number", "side", "relationship"
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

@app.route('/api/parties/<party_id>', methods=['GET'])
def get_party_details(party_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500

    try:
        with conn.cursor() as cur:
            # party
            cur.execute("""
                SELECT id, display_name,
                       address_street, address_street2, address_city, address_state, address_zip
                FROM parties
                WHERE id = %s;
            """, (party_id,))
            party_row = cur.fetchone()
            if not party_row:
                return jsonify({"error": "Party not found"}), 404

            party_cols = [d[0] for d in cur.description]
            party = dict(zip(party_cols, party_row))

            # members
            cur.execute("""
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
                    relationship AS relation
                FROM guests
                WHERE party_id = %s
                ORDER BY last_name, first_name;
            """, (party_id,))
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            members = [dict(zip(cols, r)) for r in rows]

        return jsonify({"party": party, "members": members})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/parties/<party_id>', methods=['PATCH'])
def update_party(party_id):
    payload = request.get_json(force=True) or {}

    allowed = {
        "address_street", "address_street2",
        "address_city", "address_state", "address_zip"
    }
    updates = {k: v for k, v in payload.items() if k in allowed}

    if not updates:
        return jsonify({"error": "No valid fields provided"}), 400

    set_parts = []
    values = []
    for k, v in updates.items():
        set_parts.append(sql.SQL("{} = %s").format(sql.Identifier(k)))
        values.append(v)

    values.append(party_id)

    query = sql.SQL("UPDATE parties SET {sets} WHERE id = %s RETURNING id;").format(
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
                return jsonify({"error": "Party not found"}), 404
        return jsonify({"ok": True, "id": party_id})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/vendors', methods=['GET'])
def get_vendors():
    vendors, error = get_data_from_query(sql.SQL("SELECT * FROM public.vendors;"))
    return jsonify(vendors) if not error else (jsonify({"error": error}), 500)

# --- FRONTEND PAGE ROUTES ---

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login')
def login():
    return render_template('login.html',
        supabase_url=os.environ.get('SUPABASE_URL'),
        supabase_anon_key=os.environ.get('SUPABASE_ANON_KEY')
    )

@app.route('/travel')
def travel():
    return render_template('travel.html')

@app.route('/our-story')
def outstory():
    return render_template('OurStory.html')

@app.route('/wedding')
def wedding():
    return render_template('wedding.html')

@app.route('/welcome-party')
def welcomeparty():
    return render_template('welcome-party.html')

@app.route('/vendors')
def vendors():
    return render_template('vendors.html', 
        supabase_url=os.environ.get('SUPABASE_URL'),
        supabase_anon_key=os.environ.get('SUPABASE_ANON_KEY')
    )

@app.route('/hello')
def hello():
    return render_template('address-collection.html', 
        supabase_url=os.environ.get('SUPABASE_URL'),
        supabase_anon_key=os.environ.get('SUPABASE_ANON_KEY')
    )

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html', 
        supabase_url=os.environ.get('SUPABASE_URL'),
        supabase_anon_key=os.environ.get('SUPABASE_ANON_KEY')
    )

# --- START THE SERVER ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # debug=True is helpful while you're building!
    app.run(host='0.0.0.0', port=port, debug=True)