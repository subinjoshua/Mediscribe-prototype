import json
import time
import logging
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.bedrock_client import invoke_bedrock_json
from shared.dynamodb_client import get_patient, get_encounter, get_encounter_items
from shared.response_helper import success_response, error_response

logger = logging.getLogger("mediscribe.discharge_summary")

BEDROCK_PROMPT_TEMPLATE = """You are a senior medical documentation specialist generating a discharge summary for Mumbai General Hospital, India.

PATIENT PROFILE:
{patient_json}

ENCOUNTER:
{encounter_json}

DAILY PROGRESS NOTES (chronological):
{notes_json}

MEDICATIONS ON DISCHARGE:
{medications_json}

LAB RESULTS:
{labs_json}

Generate a comprehensive, professional discharge summary. Respond with ONLY valid JSON:
{{
  "demographics": {{
    "name": "string",
    "age": number,
    "gender": "string",
    "mrn": "MRN-MG-2026-XXX",
    "bloodGroup": "string",
    "abhaNumber": "string or null"
  }},
  "admissionDetails": {{
    "admissionDate": "human readable date",
    "dischargeDate": "human readable date",
    "lengthOfStay": number,
    "admittingDiagnosis": "string",
    "attendingPhysician": "string"
  }},
  "hospitalCourse": "WRITE THIS AS A COHERENT 3-4 PARAGRAPH NARRATIVE. NOT bullet points. Chronological from admission to discharge. Include key clinical decisions, procedures, lab trends, and response to treatment. Write as a senior physician would dictate.",
  "diagnoses": [
    {{"type": "Primary", "condition": "string", "icd10": "code"}},
    {{"type": "Secondary", "condition": "string", "icd10": "code"}}
  ],
  "significantFindings": {{
    "labs": ["key abnormal lab findings with values"],
    "imaging": ["imaging findings if any"],
    "procedures": ["procedures performed with findings"]
  }},
  "medicationsOnDischarge": [
    {{
      "name": "string",
      "dosage": "string with unit",
      "frequency": "string",
      "duration": "string",
      "indication": "why this drug"
    }}
  ],
  "followUp": {{
    "appointments": [
      {{"specialty": "string", "when": "specific timeframe", "purpose": "string"}}
    ],
    "investigations": ["specific tests with timeframe"]
  }},
  "patientInstructions": {{
    "medications": "Clear instructions about taking meds. Highlight which ones must NOT be stopped. Use simple language.",
    "diet": "Specific dietary advice relevant to diagnoses.",
    "activity": "Activity restrictions and gradual return to normal. Be specific.",
    "redFlags": "RETURN TO HOSPITAL IMMEDIATELY IF: list specific warning signs in plain language. This section saves lives — be thorough."
  }}
}}

QUALITY REQUIREMENTS:
1. Hospital course MUST be narrative prose, not bullets
2. Patient instructions MUST use 8th-grade reading level — no medical jargon
3. Red flags must be specific and alarming enough that a patient takes them seriously
4. Include ALL medications with indications
5. Follow-up dates should be specific relative to discharge date
6. ICD-10 codes must be accurate"""


def _strip_dynamo_keys(item):
    """Remove DynamoDB-specific keys before injecting into prompt."""
    if not item:
        return {}
    return {k: v for k, v in item.items() if k not in ("PK", "SK", "GSI1PK", "GSI1SK")}


def _classify_encounter_items(items):
    """Separate encounter items into notes, medications, and labs by SK prefix."""
    notes = []
    medications = []
    labs = []
    for item in items:
        sk = item.get("SK", "")
        if sk.startswith("NOTE#"):
            notes.append(item)
        elif sk.startswith("MED#"):
            medications.append(item)
        elif sk.startswith("LAB#"):
            labs.append(item)
    notes.sort(key=lambda x: x.get("SK", ""))
    labs.sort(key=lambda x: x.get("SK", ""))
    return notes, medications, labs


def lambda_handler(event, context):
    # Handle CORS preflight for Lambda Function URL
    http_method = event.get("requestContext", {}).get("http", {}).get("method", "")
    if http_method == "OPTIONS":
        return success_response({})

    try:
        body = json.loads(event.get("body", "{}"))
        patient_id = body.get("patientId")
        encounter_id = body.get("encounterId")

        if not patient_id:
            return error_response(400, "Missing required field: patientId")
        if not encounter_id:
            return error_response(400, "Missing required field: encounterId")

        # Fetch data from DynamoDB
        patient = get_patient(patient_id)
        if not patient:
            return error_response(404, f"Patient not found: {patient_id}")

        encounter = get_encounter(patient_id, encounter_id)
        if not encounter:
            return error_response(404, f"Encounter not found: {encounter_id}")

        encounter_items = get_encounter_items(encounter_id)
        notes, medications, labs = _classify_encounter_items(encounter_items)

        # Strip DynamoDB keys
        patient_clean = _strip_dynamo_keys(patient)
        encounter_clean = _strip_dynamo_keys(encounter)
        notes_clean = [_strip_dynamo_keys(n) for n in notes]
        meds_clean = [_strip_dynamo_keys(m) for m in medications]
        labs_clean = [_strip_dynamo_keys(l) for l in labs]

        # Build prompt
        prompt = BEDROCK_PROMPT_TEMPLATE.format(
            patient_json=json.dumps(patient_clean, indent=2, default=str),
            encounter_json=json.dumps(encounter_clean, indent=2, default=str),
            notes_json=json.dumps(notes_clean, indent=2, default=str) if notes_clean else "No daily progress notes recorded.",
            medications_json=json.dumps(meds_clean, indent=2, default=str) if meds_clean else "No discharge medications recorded.",
            labs_json=json.dumps(labs_clean, indent=2, default=str) if labs_clean else "No lab results recorded.",
        )

        # Call Bedrock and measure generation time
        start_time = time.time()
        summary = invoke_bedrock_json(prompt, max_tokens=8192)
        generation_time_ms = int((time.time() - start_time) * 1000)

        return success_response({
            "success": True,
            "generationTimeMs": generation_time_ms,
            "summary": summary,
        })

    except json.JSONDecodeError:
        return error_response(400, "Invalid JSON in request body")
    except ValueError as e:
        logger.error("Bedrock response parsing failed: %s", e)
        return error_response(502, f"Failed to parse discharge summary from AI: {str(e)}")
    except Exception as e:
        logger.error("discharge_summary failed: %s", e, exc_info=True)
        return error_response(500, f"Failed to generate discharge summary: {str(e)}")
