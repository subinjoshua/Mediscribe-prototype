import json
import os
import sys
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.dynamodb_client import (
    list_all_patients,
    get_patient,
    query_patient_encounters,
    get_encounter_items,
)
from shared.response_helper import success_response, error_response

logger = logging.getLogger("mediscribe.get_patients")


def _list_patients():
    """GET /patients — return summary list of all patients."""
    patients = list_all_patients()

    summaries = []
    for p in patients:
        summaries.append({
            "patientId": p.get("patientId"),
            "name": p.get("name"),
            "age": p.get("age"),
            "gender": p.get("gender"),
            "latestDiagnosis": p.get("primaryDiagnosis"),
        })

    result = json.loads(json.dumps({"patients": summaries, "count": len(summaries)}, default=str))
    return success_response(result)


def _get_patient_detail(patient_id):
    """GET /patients/{id} — return full patient record with encounters."""
    profile = get_patient(patient_id)
    if not profile:
        return error_response(404, f"Patient {patient_id} not found")

    encounters = query_patient_encounters(patient_id)

    # Sort encounters by admission date (most recent first)
    encounters.sort(key=lambda e: e.get("admissionDate", ""), reverse=True)

    enriched_encounters = []
    for i, enc in enumerate(encounters):
        encounter_data = {k: v for k, v in enc.items() if k not in ("PK", "SK")}

        # For the first (most recent) encounter, fetch meds, notes, labs
        if i == 0:
            encounter_id = enc.get("encounterId")
            if encounter_id:
                items = get_encounter_items(encounter_id)
                notes = []
                meds = []
                labs = []
                for item in items:
                    sk = item.get("SK", "")
                    clean_item = {k: v for k, v in item.items() if k not in ("PK", "SK")}
                    if sk.startswith("NOTE#"):
                        notes.append(clean_item)
                    elif sk.startswith("MED#"):
                        meds.append(clean_item)
                    elif sk.startswith("LAB#"):
                        labs.append(clean_item)

                encounter_data["notes"] = notes
                encounter_data["medications"] = meds
                encounter_data["labs"] = labs

        enriched_encounters.append(encounter_data)

    # Build patient object without DynamoDB keys
    patient = {k: v for k, v in profile.items() if k not in ("PK", "SK")}
    patient["encounters"] = enriched_encounters

    result = json.loads(json.dumps(patient, default=str))
    return success_response(result)


def lambda_handler(event, context):
    """Handles GET /patients and GET /patients/{id}."""
    try:
        path_params = event.get("pathParameters") or {}
        patient_id = path_params.get("id")

        if patient_id:
            logger.info("Getting patient detail for %s", patient_id)
            return _get_patient_detail(patient_id)
        else:
            logger.info("Listing all patients")
            return _list_patients()

    except Exception as e:
        logger.error("get_patients failed: %s", e, exc_info=True)
        return error_response(500, f"Failed to get patients: {str(e)}")
