"""
MediScribe End-to-End Test Flow
Tests the entire demo flow against the local server (http://localhost:3000).

Usage: python backend/test_flow.py
Requires: local_server.py running on port 3000
"""

import io
import sys
import time

# Force UTF-8 output on Windows so emoji characters print correctly
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

import requests

BASE_URL = "http://localhost:3000"

MOCK_OCR_TEXT = (
    "Dr Priya Sharma\n"
    "Mumbai General Hospital\n"
    "Date 06/03/2026\n"
    "\n"
    "Pt: Aisha Begum / 28F / 55kg\n"
    "C/O: High fever x 4 days, rash, joint pain, headache\n"
    "O/E: Temp 103.2F BP 100/65 HR 102 SpO2 97%\n"
    "Maculopapular rash on trunk\n"
    "Tourniquet test positive\n"
    "\n"
    "Dx: Dengue Fever\n"
    "\n"
    "Rx:\n"
    "1. Tab Paracetamol 500 ml TID x 5 days\n"
    "2. ORS 1 sachet after each loose stool\n"
    "3. IV NS 1L over 4 hours\n"
    "\n"
    "Ix: CBC, Dengue NS1, Dengue IgM/IgG, LFT\n"
    "\n"
    "Adv: Plenty of oral fluids\n"
    "Daily platelet count\n"
    "Watch for warning signs\n"
    "Avoid aspirin/ibuprofen"
)


def fail(step, message):
    print(f"\n\u274c STEP {step} FAILED: {message}")
    sys.exit(1)


def step1_seed_data():
    """Seed drugs and patient data."""
    print("\n--- Step 1: Seed Data ---")
    resp = requests.post(f"{BASE_URL}/seed-data", timeout=30)
    if resp.status_code != 200:
        fail(1, f"HTTP {resp.status_code}: {resp.text}")

    data = resp.json()
    drugs = data.get("drugsLoaded", 0)
    patients = data.get("patientItemsLoaded", 0)

    if drugs == 0 and patients == 0:
        fail(1, "No data was loaded")

    print(f"\u2705 Seed data loaded: {drugs} drugs, {patients} patient items")
    return data


def step2_process_photo():
    """Process a prescription using test mode (mock OCR text)."""
    print("\n--- Step 2: Process Photo (Test Mode) ---")
    resp = requests.post(
        f"{BASE_URL}/process-photo",
        json={"ocrText": MOCK_OCR_TEXT, "hospitalId": "HOSPITAL_001"},
        timeout=60,
    )
    if resp.status_code != 200:
        fail(2, f"HTTP {resp.status_code}: {resp.text}")

    data = resp.json()
    patient_name = data.get("patient", {}).get("name", "Unknown")
    diagnosis = data.get("diagnosis", "Unknown")

    if not data.get("patientId"):
        fail(2, "No patientId in response")

    print(f"\u2705 Photo processed: {patient_name}, Diagnosis: {diagnosis}")
    return data


def step3_validate_rx(photo_data):
    """Validate medications from the processed photo."""
    print("\n--- Step 3: Validate Prescriptions ---")
    medications = photo_data.get("medications", [])
    if not medications:
        fail(3, "No medications from step 2 to validate")

    patient_info = photo_data.get("patient", {})
    payload = {
        "medications": medications,
        "patientContext": {
            "age": patient_info.get("age", 28),
            "weight": patient_info.get("weight", 55),
            "gender": patient_info.get("gender", "female"),
            "allergies": [],
            "currentMedications": [],
            "diagnosis": photo_data.get("diagnosis", ""),
        },
    }

    resp = requests.post(f"{BASE_URL}/validate-rx", json=payload, timeout=60)
    if resp.status_code != 200:
        fail(3, f"HTTP {resp.status_code}: {resp.text}")

    data = resp.json()
    errors = data.get("errors", [])
    warnings = data.get("warnings", [])

    print(f"\u2705 Validation: {len(errors)} errors, {len(warnings)} warnings")
    for err in errors:
        msg = err.get("message", err) if isinstance(err, dict) else str(err)
        print(f"   \u274c Error: {msg}")
    for warn in warnings:
        msg = warn.get("message", warn) if isinstance(warn, dict) else str(warn)
        print(f"   \u26a0\ufe0f Warning: {msg}")

    return data


def step4_check_outbreak(photo_data):
    """Check if the diagnosis triggers an outbreak alert."""
    print("\n--- Step 4: Check Outbreak ---")
    diagnosis = photo_data.get("diagnosis", "Dengue Fever")
    patient_id = photo_data.get("patientId")

    payload = {
        "hospitalId": "HOSPITAL_001",
        "newDiagnosis": {
            "disease": diagnosis,
            "patientId": patient_id,
        },
    }

    resp = requests.post(f"{BASE_URL}/check-outbreak", json=payload, timeout=60)
    if resp.status_code != 200:
        fail(4, f"HTTP {resp.status_code}: {resp.text}")

    data = resp.json()
    status = data.get("status", "unknown")
    print(f"\u2705 Outbreak status: {status}")

    if status == "outbreak_detected":
        alert = data.get("alert", {})
        summary = alert.get("analysis", alert.get("summary", ""))
        if summary:
            print(f"   Alert: {summary[:200]}")

    return data


def step5_outbreak_dashboard():
    """Fetch the outbreak dashboard."""
    print("\n--- Step 5: Outbreak Dashboard ---")
    resp = requests.get(
        f"{BASE_URL}/outbreak-dashboard",
        params={"hospitalId": "HOSPITAL_001"},
        timeout=30,
    )
    if resp.status_code != 200:
        fail(5, f"HTTP {resp.status_code}: {resp.text}")

    data = resp.json()
    active_alerts = data.get("activeAlerts", [])
    disease_counts = data.get("diseaseCounts", {})

    print(f"\u2705 Dashboard: {len(active_alerts)} active alerts, {disease_counts}")
    return data


def step6_discharge_summary(photo_data):
    """Generate a discharge summary for the patient from step 2."""
    print("\n--- Step 6: Discharge Summary ---")
    patient_id = photo_data.get("patientId")
    encounter_id = photo_data.get("encounterId")

    if not patient_id or not encounter_id:
        fail(6, "Missing patientId or encounterId from step 2")

    payload = {
        "patientId": patient_id,
        "encounterId": encounter_id,
    }

    start = time.time()
    resp = requests.post(f"{BASE_URL}/discharge-summary", json=payload, timeout=120)
    elapsed_ms = int((time.time() - start) * 1000)

    if resp.status_code != 200:
        fail(6, f"HTTP {resp.status_code}: {resp.text}")

    data = resp.json()
    hospital_course = data.get("hospitalCourse", data.get("summary", ""))

    print(f"\u2705 Discharge summary generated in {elapsed_ms}ms")
    if hospital_course:
        print(f"   {str(hospital_course)[:200]}")

    return data


def main():
    print("=" * 60)
    print("MediScribe End-to-End Test Flow")
    print("=" * 60)
    print(f"Server: {BASE_URL}")

    # Verify server is reachable
    try:
        requests.get(f"{BASE_URL}/patients", timeout=5)
    except requests.ConnectionError:
        print(f"\n\u274c Cannot connect to {BASE_URL}")
        print("   Start the server first: python backend/local_server.py")
        sys.exit(1)

    step1_seed_data()
    photo_data = step2_process_photo()
    step3_validate_rx(photo_data)
    step4_check_outbreak(photo_data)
    step5_outbreak_dashboard()
    step6_discharge_summary(photo_data)

    print("\n" + "=" * 60)
    print("\U0001f389 ALL TESTS PASSED \u2014 Demo flow working end-to-end")
    print("=" * 60)


if __name__ == "__main__":
    main()
