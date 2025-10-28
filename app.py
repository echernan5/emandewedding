import os
from dotenv import load_dotenv

load_dotenv()

import os
import uuid
import psycopg2
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from psycopg2 import sql
import urllib.parse as urlparse

app = Flask(__name__)
# Use a more permissive CORS for development; restrict in production
CORS(app, origins=["http://127.0.0.1:5500", "null"])

# --- CONFIGURATION (UPDATED for Database) ---
# Get your database connection string from an environment variable for security
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

def get_db_connection():
    """
    Establishes a robust connection to the PostgreSQL database by parsing the URL.
    Returns: A connection object.
    """
    try:
        url = urlparse.urlparse(os.environ.get('DATABASE_URL'))
        
        conn = psycopg2.connect(
            dbname=url.path[1:],
            user=url.username,
            password=url.password,
            host=url.hostname,
            port=url.port
        )
        return conn
    except psycopg2.OperationalError as e:
        print(f"!!! ERROR: Could not connect to database: {e}")
        return None

def get_data_from_query(query, params=None):
    """
    Helper function to execute a SELECT query and return data.
    """
    conn = get_db_connection()
    if not conn:
        return None, "Database service not available."
    
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            
            # --- START DEBUGGING AND FIX ---
            rows = cur.fetchall() # FETCH DATA HERE ONCE AND STORE IT
            
            column_names = [desc[0] for desc in cur.description]
            print("Column names:", column_names)
            # --- END DEBUGGING AND FIX ---
            
            data = [dict(zip(column_names, row)) for row in rows] # USE THE STORED 'rows' VARIABLE
        return data, None
    except Exception as e:
        print(f"!!! ERROR: Could not get data from query: {e}")
        return None, "An internal server error occurred."
    finally:
        conn.close()

# --- Task Endpoints ---
@app.route('/api/kanban_tasks', methods=['GET'])
def get_kanban_tasks():
    tasks, error = get_data_from_query(sql.SQL("SELECT * FROM tasks;"))
    if error:
        return jsonify({"error": error}), 500
    return jsonify(tasks)

@app.route('/api/kanban_tasks/add', methods=['POST'])
def add_kanban_task():
    data = request.get_json()
    if not data or not data.get('description'):
        return jsonify({"error": "Task description is required."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database service not available."}), 503
    
    try:
        with conn.cursor() as cur:
            
            # Use UUIDs as the default value is set in the database
            cur.execute(sql.SQL(
                "INSERT INTO tasks (status, description, assignee, category, due_date, related_vendors, comments) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING task_id;"
            ), (
                data.get('status', 'To Do'),
                data.get('description'),
                data.get('assignee', 'Unassigned'),
                data.get('category'),
                data.get('dueDate'),
                data.get('relatedVendors'),
                data.get('comments')
            ))
            new_task_id = cur.fetchone()[0]
            conn.commit()
            return jsonify({"message": "Task added successfully!", "id": new_task_id}), 201
    except Exception as e:
        conn.rollback()
        print(f"Error adding task: {e}")
        return jsonify({"error": "An internal server error occurred while adding the task."}), 500
    finally:
        conn.close()

@app.route('/api/kanban_tasks/update', methods=['PUT', 'PATCH'])
def update_kanban_task():
    data = request.get_json()
    task_id = data.get('id')
    if not task_id:
        return jsonify({"error": "Task ID is required."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database service not available."}), 503

    try:
        with conn.cursor() as cur:
            cur.execute(sql.SQL(
                "UPDATE tasks SET status=%s, description=%s, assignee=%s, category=%s, due_date=%s, related_vendors=%s, comments=%s WHERE task_id=%s;"
            ), (
                data.get('status'),
                data.get('description'),
                data.get('assignee'),
                data.get('category'),
                data.get('dueDate'),
                data.get('relatedVendors'),
                data.get('comments'),
                task_id
            ))
            conn.commit()
            if cur.rowcount == 0:
                return jsonify({"error": f"Task with ID {task_id} not found."}), 404
        return jsonify({"message": "Task updated successfully!"}), 200
    except Exception as e:
        conn.rollback()
        print(f"Error updating task: {e}")
        return jsonify({"error": "An internal server error occurred while updating the task."}), 500
    finally:
        conn.close()

@app.route('/api/kanban_tasks/delete', methods=['DELETE'])
def delete_kanban_task():
    data = request.get_json()
    task_id = data.get('id')
    if not task_id:
        return jsonify({"error": "Task ID is required."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database service not available."}), 503

    try:
        with conn.cursor() as cur:
            cur.execute(sql.SQL(
                "DELETE FROM tasks WHERE task_id=%s;"
            ), (task_id,))
            conn.commit()
            if cur.rowcount == 0:
                return jsonify({"error": f"Task with ID {task_id} not found."}), 404
            return jsonify({"message": "Task deleted successfully!"}), 200
    except Exception as e:
        conn.rollback()
        print(f"Error deleting task: {e}")
        return jsonify({"error": "An internal server error occurred while deleting the task."}), 500
    finally:
        conn.close()

# --- Guest Address Endpoints ---
# UPDATED: This endpoint now joins the guest_list and parties table to get all address info
# In your app.py file, replace the existing get_guests endpoint
# In your app.py file, replace the existing get_guests endpoint
# In your app.py file, replace the existing get_guests endpoint
@app.route('/api/guests', methods=['GET'])
def get_guests():
    # This query now returns one record per party, which is what the JS expects
    query = sql.SQL("""
        SELECT
            p.party_id AS id,
            p.party_name AS partyName,
            p.address_collection_assigned_to_name AS assignedTo,
            p.address_street AS street,
            p.address_street2 AS street2,
            p.address_city AS city,
            p.address_state AS state,
            p.address_zip AS zip
        FROM public.parties AS p;
    """)
    guests, error = get_data_from_query(query)
    if error:
        return jsonify({"error": error}), 500
    
    print("Data returned from DB query:", guests) 

    return jsonify(guests)
# UPDATED: This endpoint now correctly updates the parties table, not the guests table
@app.route('/api/guests/update', methods=['PUT'])
def update_guest():
    data = request.get_json()
    party_id = data.get('id')
    if not party_id:
        return jsonify({"error": "Party ID is required."}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database service not available."}), 503

    try:
        with conn.cursor() as cur:
            cur.execute(sql.SQL(
                "UPDATE public.parties SET address_street=%s, address_street2=%s, address_city=%s, address_state=%s, address_zip=%s, is_address_collected=%s WHERE party_id=%s;"
            ), (
                data.get('street'),
                data.get('street2'),
                data.get('city'),
                data.get('state'),
                data.get('zip'),
                data.get('street') is not None, # Boolean logic
                party_id
            ))
            conn.commit()
            if cur.rowcount == 0:
                return jsonify({"error": f"Party with ID {party_id} not found."}), 404
        return jsonify({"message": "Party address updated successfully!"}), 200
    except Exception as e:
        conn.rollback()
        print(f"Error updating party: {e}")
        return jsonify({"error": "An internal server error occurred while updating the party address."}), 500
    finally:
        conn.close()

# --- Guest List Endpoint ---
# UPDATED: This query now joins the guest_list and parties table correctly and aliases columns
@app.route('/api/guestlist', methods=['GET'])
def get_guestlist():
    query = sql.SQL("""
        SELECT
            g.first_name || ' ' || g.last_name AS name,
            p.party_key AS party,
            g.rsvp_status AS rsvp,
            g.meal_choice AS dietaryrequest,
            g.table_number AS tablenumber,
            g.relationship AS relation,
            g.guest_of AS guestof,
            g.is_invited_to_rehearsal_dinner AS rehearsaldinner,
            g.is_invited_to_bridal_shower AS bridalshower
        FROM public.guest_list AS g
        JOIN public.parties AS p ON g.party_id = p.party_id;
    """)
    guest_list, error = get_data_from_query(query)
    if error:
        return jsonify({"error": error}), 500
    return jsonify(guest_list)

# --- Calendar Events Endpoints ---  
@app.route('/api/calendar_events', methods=['GET'])
def get_calendar_events():
    events, error = get_data_from_query(sql.SQL("SELECT * FROM calendar_events;"))
    if error:
        return jsonify({"error": error}), 500
    
    # Restructure for your frontend's needs
    formatted_events = []
    for event in events:
        formatted_events.append({
            'title': event['title'],
            'start': event['start'],
            'end': event['end'],
            'extendedProps': {
                'description': event['description'],
                'location': event['location'],
                'locationName': event['location_name'],
                'locationAddress': event['location_address']
            }
        })
    return jsonify(formatted_events)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login')
def login():
    # --- START DEBUGGING ---
    # Add these two lines to see what Python is reading from your .env file
    print("DEBUG: SUPABASE_URL from .env is:", os.environ.get('SUPABASE_URL'))
    print("DEBUG: SUPABASE_ANON_KEY from .env is:", os.environ.get('SUPABASE_ANON_KEY'))
    # --- END DEBUGGING ---

    # Pass the public keys to the template
    return render_template(
        'login.html',
        supabase_url=os.environ.get('SUPABASE_URL'),
        supabase_anon_key=os.environ.get('SUPABASE_ANON_KEY')
    )

@app.route('/members_only')
def members_only():
    return render_template('members-only.html')

@app.route('/vendors')
def vendors():
    # This reads the keys from .env and passes them to the HTML template
    return render_template(
        'vendors.html', 
        supabase_url=os.environ.get('SUPABASE_URL'),
        supabase_anon_key=os.environ.get('SUPABASE_ANON_KEY')
    )

@app.route('/api/vendors', methods=['GET'])
def get_vendors():
    vendors, error = get_data_from_query(sql.SQL("SELECT * FROM public.vendors;"))
    if error:
        return jsonify({"error": error}), 500
    
    # Optional: Add a print statement for debugging
    print("Fetched vendors data:", vendors) 
    
    return jsonify(vendors)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)