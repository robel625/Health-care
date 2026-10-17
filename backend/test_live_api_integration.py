import requests
import json

BASE_URL = "http://localhost:8000/api"

USERS = {
    "Healthcare Administrator": ("test_admin", "Password123!"),
    "Receptionist": ("test_receptionist", "Password123!"),
    "Doctor (Assigned)": ("test_doc_assigned", "Password123!"),
    "Doctor (Unrelated)": ("test_doc_unrelated", "Password123!"),
    "Laboratory Technician": ("test_lab_tech", "Password123!"),
    "Pharmacist": ("test_pharmacist", "Password123!"),
}

print("======================================================================")
print("LIVE HTTP RBAC & PATIENT PRIVACY API TEST SUITE")
print("======================================================================")

tokens = {}

# 1. Test Authentication & Token Issuance for each role
print("\n--- 1. Testing Login & Token Generation ---")
for role_label, (username, password) in USERS.items():
    res = requests.post(f"{BASE_URL}/auth/login/", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.status_code} {res.text}"
    data = res.json()
    token = data["accessToken"]
    tokens[role_label] = token
    user_roles = [r.get("name") if isinstance(r, dict) else r for r in data["user"].get("roles", [])]
    perm_count = len(data["user"].get("permissions", []))
    print(f"[{res.status_code} OK] {role_label:<25} User: {username:<20} Roles: {user_roles} (Perms: {perm_count})")

# Helper for authenticated GET
def get_as(role_label, path):
    headers = {"Authorization": f"Bearer {tokens[role_label]}"}
    return requests.get(f"{BASE_URL}{path}", headers=headers)

# Helper for authenticated POST
def post_as(role_label, path, payload=None):
    headers = {"Authorization": f"Bearer {tokens[role_label]}"}
    return requests.post(f"{BASE_URL}{path}", json=payload or {}, headers=headers)

# 2. Test Patient List & Detail Access (Demographics vs Clinical)
print("\n--- 2. Testing Patient Access & Field-Level Redaction ---")
# Get patient list
p_res = get_as("Receptionist", "/healthcare/patients/?search=Jane")
assert p_res.status_code == 200
p_list = p_res.json().get("results", [])
patient_id = p_list[0]["id"] if p_list else 1
print(f"Found target test patient ID: {patient_id}")

# A. Receptionist sees redacted clinical fields
rec_patient = get_as("Receptionist", f"/healthcare/patients/{patient_id}/").json()
print(f"Receptionist viewing Patient {patient_id}:")
print(f"  medical_history : '{rec_patient.get('medical_history')}' (Redacted)")
print(f"  allergies       : '{rec_patient.get('allergies')}' (Redacted)")
print(f"  can_view_clinical: {rec_patient.get('access_scope', {}).get('can_view_clinical')}")
assert rec_patient.get('medical_history') == "", "Receptionist must not see medical history"
assert rec_patient.get('allergies') == "", "Receptionist must not see allergies"

# B. Assigned Doctor sees full clinical details
doc_patient = get_as("Doctor (Assigned)", f"/healthcare/patients/{patient_id}/").json()
print(f"Assigned Doctor viewing Patient {patient_id}:")
print(f"  medical_history : '{doc_patient.get('medical_history')}' (Visible)")
print(f"  allergies       : '{doc_patient.get('allergies')}' (Visible)")
print(f"  can_view_clinical: {doc_patient.get('access_scope', {}).get('can_view_clinical')}")
assert "HIV" in doc_patient.get('medical_history', '') or len(doc_patient.get('medical_history', '')) > 0

# 3. Test Encounters Endpoint & Relationship Isolation
print("\n--- 3. Testing Encounters Access & Care Relationship Boundary ---")
# Receptionist, Lab Tech, Pharmacist cannot see clinical encounters
for role in ["Receptionist", "Laboratory Technician", "Pharmacist"]:
    enc_res = get_as(role, "/healthcare/encounters/")
    count = enc_res.json().get("count", 0)
    print(f"{role:<25} Encounters visible: {count} (Must be 0)")
    assert count == 0, f"{role} must have 0 encounters visible"

# Assigned Doctor can see encounters
doc_enc = get_as("Doctor (Assigned)", "/healthcare/encounters/").json()
doc_count = doc_enc.get("count", 0)
print(f"{'Doctor (Assigned)':<25} Encounters visible: {doc_count} (Accessible)")
assert doc_count > 0, "Assigned Doctor must see active care encounters"

# Unrelated Doctor direct access to encounter returns 403 Forbidden
enc_id = doc_enc["results"][0]["id"]
unrel_res = get_as("Doctor (Unrelated)", f"/healthcare/encounters/{enc_id}/")
print(f"{'Doctor (Unrelated)':<25} Direct access to Encounter {enc_id}: HTTP {unrel_res.status_code} ({unrel_res.json().get('detail', '')})")
assert unrel_res.status_code == 403, "Unrelated doctor must receive 403 Forbidden on direct encounter access"

# 4. Test Laboratory Submission Endpoint
print("\n--- 4. Testing Lab Test Submission Permissions ---")
lab_list_res = get_as("Laboratory Technician", "/healthcare/lab-tests/")
assert lab_list_res.status_code == 200
lab_tests = lab_list_res.json().get("results", [])
lab_id = lab_tests[0]["id"] if lab_tests else 1

# Lab Tech submit -> 200 OK
lab_sub_res = post_as("Laboratory Technician", f"/healthcare/lab-tests/{lab_id}/submit/")
print(f"Lab Tech submit Lab Test {lab_id}: HTTP {lab_sub_res.status_code}")
assert lab_sub_res.status_code in (200, 400), f"Lab Tech should be authorized (got {lab_sub_res.status_code})"

# Receptionist submit -> 403 Forbidden
rec_lab_res = post_as("Receptionist", f"/healthcare/lab-tests/{lab_id}/submit/")
print(f"Receptionist submit Lab Test {lab_id}: HTTP {rec_lab_res.status_code} ({rec_lab_res.json().get('detail', '')})")
assert rec_lab_res.status_code == 403, "Receptionist must receive 403 Forbidden"

# Pharmacist submit -> 403 Forbidden
pharm_lab_res = post_as("Pharmacist", f"/healthcare/lab-tests/{lab_id}/submit/")
print(f"Pharmacist submit Lab Test {lab_id}: HTTP {pharm_lab_res.status_code} ({pharm_lab_res.json().get('detail', '')})")
assert pharm_lab_res.status_code == 403, "Pharmacist must receive 403 Forbidden"

# 5. Test Medication Dispense Endpoint
print("\n--- 5. Testing Pharmacy Dispensing Permissions ---")
med_list_res = get_as("Pharmacist", "/healthcare/pharmacy/medication-requests/")
if med_list_res.status_code != 200:
    med_list_res = get_as("Pharmacist", "/healthcare/medication-requests/")
med_reqs = med_list_res.json().get("results", [])
med_id = med_reqs[0]["id"] if med_reqs else 1

# Pharmacist dispense -> 200 OK
pharm_disp_res = post_as("Pharmacist", f"/healthcare/medication-requests/{med_id}/dispense/")
print(f"Pharmacist dispense Med {med_id}: HTTP {pharm_disp_res.status_code}")
assert pharm_disp_res.status_code in (200, 400), f"Pharmacist should be authorized (got {pharm_disp_res.status_code})"

# Receptionist dispense -> 403 Forbidden
rec_disp_res = post_as("Receptionist", f"/healthcare/medication-requests/{med_id}/dispense/")
print(f"Receptionist dispense Med {med_id}: HTTP {rec_disp_res.status_code} ({rec_disp_res.json().get('detail', '')})")
assert rec_disp_res.status_code == 403, "Receptionist must receive 403 Forbidden"

# Lab Tech dispense -> 403 Forbidden
lab_disp_res = post_as("Laboratory Technician", f"/healthcare/medication-requests/{med_id}/dispense/")
print(f"Lab Tech dispense Med {med_id}: HTTP {lab_disp_res.status_code} ({lab_disp_res.json().get('detail', '')})")
assert lab_disp_res.status_code == 403, "Lab Tech must receive 403 Forbidden"

print("\n======================================================================")
print("ALL LIVE HTTP RBAC & PATIENT PRIVACY TESTS PASSED SUCCESSFULLY (100%)")
print("======================================================================")
