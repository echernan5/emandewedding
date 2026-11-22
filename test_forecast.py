import os
import math
import numpy as np
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

def prob_to_logit(p):
    p = max(0.001, min(0.999, p))
    return math.log(p / (1.0 - p))

def logit_to_prob(logit):
    return 1.0 / (1.0 + math.exp(-logit))

def get_guest_price(age_group):
    """Matches your app.py pricing tiers + $1.50 cake cutting fee"""
    cake_fee = Decimal('1.50')
    if age_group == 'under_12':
        return Decimal('45.00') + cake_fee, 'under_12'
    elif age_group in ('12_to_21', '12_to_20', 'under_21'):
        return Decimal('75.00') + cake_fee, 'under_21'
    else:
        return Decimal('115.25') + cake_fee, '21_plus'

def run_financial_forecast(num_simulations=10000, debug=True):
    assumptions_res = supabase.table("forecast_assumptions").select("assumption_key, value").execute()
    assumptions = {row["assumption_key"]: float(row["value"]) for row in assumptions_res.data}
    
    parties_res = supabase.table("parties").select(
        "id, rsvp_session_status, form_step_reached, distance_tier, "
        "guests(id, first_name, last_name, rsvp_status, relationship, age_category, is_plus_one, record_status, has_verbal_commitment, is_21_plus, guest_of)"
    ).eq("is_test", False).execute()
    
    MI_SALES_TAX = Decimal('0.06')
    SERVICE_FEE = Decimal('0.22')
    
    CEREMONY_FEE = Decimal('850.00')
    PAVILION_FEE = Decimal('3500.00')
    flat_fees_subtotal_taxable = CEREMONY_FEE + PAVILION_FEE
    
    BUDGETED_AMOUNT = Decimal('18638.00')
    CONTRACT_FB_MIN = Decimal('9000.00')
    CONTRACT_ADULT_MIN = 75
    
    VENDOR_COUNT = 13
    VENDOR_PRICE_PP = Decimal('58.00')
    vendor_cost_subtotal = VENDOR_COUNT * VENDOR_PRICE_PP  # $754.00

    invites_sent_date = date(2027, 2, 14)
    rsvp_due_date = date(2027, 5, 14)
    today = date.today()
    total_window = (rsvp_due_date - invites_sent_date).days
    elapsed_time = (today - invites_sent_date).days
    time_progress = max(0.0, min(1.0, elapsed_time / total_window if total_window > 0 else 0.0))

    structured_parties = []
    guest_meta_lookup = {}

    for party in parties_res.data:
        status = party.get("rsvp_session_status", "not_started")
        step = party.get("form_step_reached", 0)
        distance = party.get("distance_tier", "drivable_overnight")
        dist = str(distance).strip().lower()
        
        party_guests = []
        for guest in party.get("guests", []):
            if guest.get("record_status") == "inactive":
                continue
                
            guest_id = guest.get("id")
            name = f"{guest.get('first_name', '')} {guest.get('last_name', '')}".strip() or "Unnamed"
            relationship = guest.get("relationship", "friend")
            
            age_cat = str(guest.get('age_category') or '').strip().lower()
            is_21 = guest.get('is_21_plus')
            is_21_bool = is_21 in [True, 1, 'true', 'True']
            
            if age_cat == 'under_12':
                computed_age_group = 'under_12'
            elif age_cat in ('12_to_21', '12-21', 'under_21'): 
                computed_age_group = '12_to_21'
            else:
                computed_age_group = '21_plus' if is_21_bool else '12_to_21'
                
            guest_price_pp, _ = get_guest_price(computed_age_group)
            
            notes_list = []
            if status == "submitted":
                tier = 4
                is_accepted = (guest.get("rsvp_status") == "accepted")
                fixed_prob = 1.0 if is_accepted else 0.0
                base_logit = prob_to_logit(fixed_prob)
                is_locked = True
                state_desc = "Submitted (Yes)" if is_accepted else "Submitted (No)"
            elif status == "in_progress":
                tier = 3
                is_accepted = (guest.get("rsvp_status") == "accepted")
                if is_accepted:
                    step_key = f"tier3_step_{step}" if step > 0 else "tier3_step_1_rsvp"
                    fixed_prob = assumptions.get(step_key, 0.80)
                else:
                    fixed_prob = 0.05
                base_logit = prob_to_logit(fixed_prob)
                is_locked = False
                state_desc = f"Draft (Step {step})"
            else:
                tier = 1
                rel = str(relationship).strip().lower()
                is_po = guest.get("is_plus_one")
                has_name = bool(str(guest.get("first_name", "")).strip())
                has_verbal = guest.get("has_verbal_commitment", False)
                
                if rel in ["immediate_family", "parent", "sibling", "wedding party"]:
                    rel_label = "imm_fam"
                    base_p = assumptions.get("base_prob_immediate_family", 0.98)
                elif rel in ["extended_family", "aunt", "uncle", "cousin"]:
                    rel_label = "ext_fam"
                    base_p = assumptions.get("base_prob_extended_family", 0.85)
                else:
                    rel_label = "friend"
                    base_p = assumptions.get("base_prob_friend", 0.72)
                
                score = prob_to_logit(base_p)
                notes_list.append(f"{rel_label}:{int(base_p*100)}%")
                
                dist_shift = assumptions.get(f"shift_dist_{dist}", -0.25)
                score += dist_shift
                if dist != "local":
                    notes_list.append(dist[:5])
                
                if is_po and not has_name:
                    score = prob_to_logit(assumptions.get("base_prob_friend", 0.72)) + dist_shift
                    score += assumptions.get("shift_unnamed_plus_one", -0.95)
                    notes_list = [f"unnamed+1({dist[:5]})"]
                elif is_po and has_name:
                    score += assumptions.get("shift_named_plus_one", -0.20)
                    notes_list.append("named+1")
                    
                if computed_age_group == 'under_12':
                    score += assumptions.get("shift_child_under_12", -0.10)
                    notes_list.append("child")
                    
                if has_verbal:
                    score += assumptions.get("shift_verbal_commit", 1.80)
                    notes_list.append("verbal")
                elif time_progress > 0:
                    max_decay = assumptions.get("shift_time_decay_max", -0.60)
                    score += max_decay * time_progress
                    notes_list.append("decay")

                base_logit = score
                is_locked = (tier == 4)
                state_desc = " | ".join(notes_list)

            g_data = {
                "id": guest_id,
                "name": name,
                "relationship": relationship,
                "tier": tier,
                "state_desc": state_desc,
                "base_logit": base_logit,
                "is_locked": is_locked,
                "price": guest_price_pp,
                "guest_of": guest.get("guest_of")
            }
            party_guests.append(g_data)
            guest_meta_lookup[guest_id] = g_data
            
        if party_guests:
            structured_parties.append(party_guests)

    sim_adult_headcounts = np.zeros(num_simulations)
    sim_total_headcounts = np.zeros(num_simulations)
    sim_total_costs = np.zeros(num_simulations)
    guest_attendance_counts = {g_id: 0 for g_id in guest_meta_lookup}
    
    adult_min_met_count = 0
    under_budget_count = 0

    def quant(val):
        return val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    for sim in range(num_simulations):
        sim_fb_raw = vendor_cost_subtotal
        sim_adults = 0.0
        sim_total_guests = 0.0
        
        for party_guests in structured_parties:
            household_shock = np.random.normal(0, 0.35)
            attendance_map = {}
            
            for guest in party_guests:
                if guest["guest_of"]:
                    continue
                
                if guest["is_locked"]:
                    attends = (guest["base_logit"] > 0)
                else:
                    adjusted_logit = guest["base_logit"] + household_shock
                    p_attends = logit_to_prob(adjusted_logit)
                    attends = np.random.rand() < p_attends
                
                attendance_map[guest["id"]] = attends
                if attends:
                    guest_attendance_counts[guest["id"]] += 1
                    sim_fb_raw += guest["price"]
                    sim_total_guests += 1.0
                    # Check if guest is adult (price $115.25 + cake fee = $116.75)
                    if guest["price"] == Decimal('116.75'):
                        sim_adults += 1.0

            for guest in party_guests:
                host_id = guest["guest_of"]
                if not host_id:
                    continue
                
                host_attends = attendance_map.get(host_id, False)
                if not host_attends:
                    attends = False
                else:
                    if guest["is_locked"]:
                        attends = (guest["base_logit"] > 0)
                    else:
                        adjusted_logit = guest["base_logit"] + household_shock
                        p_attends = logit_to_prob(adjusted_logit)
                        attends = np.random.rand() < p_attends
                
                attendance_map[guest["id"]] = attends
                if attends:
                    guest_attendance_counts[guest["id"]] += 1
                    sim_fb_raw += guest["price"]
                    sim_total_guests += 1.0
                    if guest["price"] == Decimal('116.75'):
                        sim_adults += 1.0

        billable_fb = sim_fb_raw
        if sim_adults < CONTRACT_ADULT_MIN:
            shortfall = Decimal(str(CONTRACT_ADULT_MIN - sim_adults))
            billable_fb += shortfall * Decimal('115.25')

        service_fee_fb = billable_fb * SERVICE_FEE
        tax_fb = (billable_fb + service_fee_fb) * MI_SALES_TAX
        tax_flat_fees = flat_fees_subtotal_taxable * MI_SALES_TAX
        
        grand_total = billable_fb + service_fee_fb + tax_fb + flat_fees_subtotal_taxable + tax_flat_fees
        
        sim_adult_headcounts[sim] = sim_adults
        sim_total_headcounts[sim] = sim_total_guests
        sim_total_costs[sim] = float(grand_total)
        
        if sim_adults >= CONTRACT_ADULT_MIN:
            adult_min_met_count += 1
        if grand_total <= BUDGETED_AMOUNT:
            under_budget_count += 1

    if debug:
        print("\n" + "="*105)
        print(f"{'GUEST NAME':<22} | {'RELATIONSHIP':<15} | {'TIER':<4} | {'STATUS / NOTES':<22} | {'SIM ODDS':<8} | {'COST/EA':<8}")
        print("="*105)
        
        for party_guests in structured_parties:
            for guest in party_guests:
                sim_prob = guest_attendance_counts[guest["id"]] / num_simulations
                print(f"{guest['name']:<22} | {guest['relationship']:<15} | T{guest['tier']:<3} | {guest['state_desc']:<22} | {sim_prob:<8.2f} | ${guest['price']:<7.2f}")

        print("="*105)
        
        prob_adults = (adult_min_met_count / num_simulations) * 100
        prob_budget = (under_budget_count / num_simulations) * 100
        
        med_adults = np.median(sim_adult_headcounts)
        p5_adults = np.percentile(sim_adult_headcounts, 5)
        p95_adults = np.percentile(sim_adult_headcounts, 95)
        
        med_total = np.median(sim_total_headcounts)
        p5_total = np.percentile(sim_total_headcounts, 5)
        p95_total = np.percentile(sim_total_headcounts, 95)
        
        med_cost = np.median(sim_total_costs)
        p5_cost = np.percentile(sim_total_costs, 5)
        p95_cost = np.percentile(sim_total_costs, 95)

        print("\n============================================================")
        print("MONTE CARLO FINANCIAL FORECAST (10,000 Runs)")
        print("============================================================")
        print(f"Probability of Clearing 75+ Adults: {prob_adults:.1f}%")
        print(f"Probability of Staying Under Budget (${BUDGETED_AMOUNT:,.2f}): {prob_budget:.1f}%")
        print("------------------------------------------------------------")
        print(f"Adult Headcount (Median): {med_adults:.1f} (90% Range: {p5_adults:.0f} – {p95_adults:.0f})")
        print(f"Total Headcount (Median): {med_total:.1f} (90% Range: {p5_total:.0f} – {p95_total:.0f})")
        print(f"Grand Total Cost (Median): ${med_cost:,.2f}")
        print(f"Grand Total Cost (90% Range): ${p5_cost:,.2f} – ${p95_cost:,.2f}")
        print("============================================================\n")

    return sim_total_costs

if __name__ == "__main__":
    run_financial_forecast()