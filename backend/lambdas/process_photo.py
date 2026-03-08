import json
import os
import sys
import uuid
import base64
import time
import logging
from datetime import datetime, timezone
from decimal import Decimal

import boto3

# Local testing: add backend/ to path so shared/ imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.bedrock_client import invoke_bedrock_json
from shared.dynamodb_client import put_patient_item
from shared.response_helper import success_response, error_response

logger = logging.getLogger("mediscribe.process_photo")

S3_BUCKET = os.environ.get("S3_BUCKET", "mediscribe-uploads")

_s3_client = boto3.client("s3")
_textract_client = boto3.client("textract")

BEDROCK_PROMPT_TEMPLATE = """You are a medical documentation AI processing handwritten prescription data extracted via OCR. The OCR text may contain errors, abbreviations, and unclear handwriting artifacts.

Your task: Extract and structure the medical information into clean JSON.

MEDICAL ABBREVIATIONS TO RECOGNIZE:
- BP = Blood Pressure, HR = Heart Rate, RR = Respiratory Rate
- SpO2 = Oxygen Saturation, Temp = Temperature
- Hx = History, Dx = Diagnosis, Rx = Prescription
- OD = once daily, BD = twice daily, TID = three times daily, QID = four times daily
- SOS = as needed, HS = at bedtime, AC = before meals, PC = after meals
- Tab = Tablet, Cap = Capsule, Inj = Injection, Syr = Syrup
- mg = milligrams, ml = milliliters, mcg = micrograms
- C/O = complains of, O/E = on examination, Adv = advice
- Ix = investigations, Rx = prescription, Dx = diagnosis
- F = Female, M = Male, Pt = Patient

OCR TEXT:
{raw_ocr_text}

Respond with ONLY valid JSON (no markdown, no explanation, just the JSON object):
{{
  "patient": {{
    "name": "string",
    "age": number,
    "gender": "male" or "female",
    "weight": number or null,
    "confidence": 0.0 to 1.0
  }},
  "vitals": {{
    "bloodPressure": "string or null",
    "heartRate": number or null,
    "temperature": number or null,
    "spO2": number or null,
    "respiratoryRate": number or null,
    "confidence": 0.0 to 1.0
  }},
  "chiefComplaint": "string",
  "diagnosis": "string",
  "icd10Code": "string",
  "symptoms": ["string array"],
  "medications": [
    {{
      "name": "string (generic name)",
      "dosage": number,
      "unit": "string (EXACTLY as written in the OCR — preserve errors for validation)",
      "frequency": "string",
      "route": "oral" or "injectable" or "topical" or "inhaled",
      "duration": "string or null",
      "confidence": 0.0 to 1.0
    }}
  ],
  "labsOrdered": ["string array"],
  "advice": ["string array"],
  "lowConfidenceFields": ["list field paths with confidence < 0.85"]
}}

CRITICAL RULES:
1. Preserve the EXACT unit from OCR text even if it looks wrong — downstream validation will catch errors
2. Convert medical abbreviations to full terms (BD → twice daily, TID → three times daily)
3. Assign honest confidence scores — unclear text = lower confidence
4. Use standard ICD-10 codes
5. If a field is unreadable, set to null and add to lowConfidenceFields"""


def _convert_floats(obj):
    """Convert floats to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _convert_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_floats(i) for i in obj]
    return obj


def lambda_handler(event, context):
    try:
        start_time = time.time()

        # 1. Parse request
        body = json.loads(event["body"])
        hospital_id = body.get("hospitalId", "HOSPITAL_001")

        # TEST MODE: accept raw OCR text directly (skip S3 + Textract)
        if "ocrText" in body:
            raw_ocr_text = body["ocrText"]
            s3_key = "test-mode"
            avg_textract_confidence = 100.0
            logger.info("TEST MODE: using provided OCR text (%d chars)", len(raw_ocr_text))
        else:
            image_base64 = body["image"]

            # 2. Decode and upload to S3
            image_bytes = base64.b64decode(image_base64)
            image_id = str(uuid.uuid4())
            s3_key = f"prescriptions/{image_id}.jpg"

            _s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=s3_key,
                Body=image_bytes,
                ContentType="image/jpeg",
            )
            logger.info("Uploaded image to s3://%s/%s", S3_BUCKET, s3_key)

            # 3. Call Textract
            textract_response = _textract_client.detect_document_text(
                Document={"S3Object": {"Bucket": S3_BUCKET, "Name": s3_key}}
            )

            lines = []
            textract_confidences = []
            for block in textract_response["Blocks"]:
                if block["BlockType"] == "LINE":
                    lines.append(block["Text"])
                    textract_confidences.append(block["Confidence"])

            raw_ocr_text = "\n".join(lines)
            avg_textract_confidence = (
                sum(textract_confidences) / len(textract_confidences)
                if textract_confidences
                else 0.0
            )
            logger.info(
                "Textract extracted %d lines, avg confidence=%.2f",
                len(lines),
                avg_textract_confidence,
            )

        # 4. Send to Bedrock for structuring
        prompt = BEDROCK_PROMPT_TEMPLATE.format(raw_ocr_text=raw_ocr_text)
        structured_data = invoke_bedrock_json(prompt)

        # 5. Generate IDs
        patient_id = str(uuid.uuid4())
        encounter_id = str(uuid.uuid4())
        diagnosis_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()

        # 6. Store in DynamoDB
        patient_info = structured_data.get("patient", {})
        patient_item = _convert_floats({
            "PK": f"PATIENT#{patient_id}",
            "SK": "PROFILE",
            "patientId": patient_id,
            "name": patient_info.get("name", "Unknown"),
            "age": patient_info.get("age"),
            "gender": patient_info.get("gender"),
            "weight": patient_info.get("weight"),
            "confidence": patient_info.get("confidence"),
            "createdAt": timestamp,
        })
        put_patient_item(patient_item)

        vitals = structured_data.get("vitals", {})
        encounter_item = _convert_floats({
            "PK": f"PATIENT#{patient_id}",
            "SK": f"ENCOUNTER#{encounter_id}",
            "encounterId": encounter_id,
            "patientId": patient_id,
            "hospitalId": hospital_id,
            "chiefComplaint": structured_data.get("chiefComplaint"),
            "diagnosis": structured_data.get("diagnosis"),
            "icd10Code": structured_data.get("icd10Code"),
            "symptoms": structured_data.get("symptoms", []),
            "vitals": vitals,
            "labsOrdered": structured_data.get("labsOrdered", []),
            "advice": structured_data.get("advice", []),
            "lowConfidenceFields": structured_data.get("lowConfidenceFields", []),
            "rawOcrText": raw_ocr_text,
            "s3Key": s3_key,
            "timestamp": timestamp,
        })
        put_patient_item(encounter_item)

        diagnosis_item = _convert_floats({
            "PK": f"DIAGNOSIS#{diagnosis_id}",
            "SK": "DETAIL",
            "GSI1PK": f"HOSPITAL#{hospital_id}",
            "GSI1SK": f"DX#{timestamp}",
            "diagnosisId": diagnosis_id,
            "patientId": patient_id,
            "encounterId": encounter_id,
            "diagnosis": structured_data.get("diagnosis"),
            "icd10Code": structured_data.get("icd10Code"),
            "timestamp": timestamp,
        })
        put_patient_item(diagnosis_item)

        medications = structured_data.get("medications", [])
        for med in medications:
            med_id = str(uuid.uuid4())
            med_item = _convert_floats({
                "PK": f"ENCOUNTER#{encounter_id}",
                "SK": f"MED#{med_id}",
                "medicationId": med_id,
                "encounterId": encounter_id,
                "patientId": patient_id,
                "name": med.get("name"),
                "dosage": med.get("dosage"),
                "unit": med.get("unit"),
                "frequency": med.get("frequency"),
                "route": med.get("route"),
                "duration": med.get("duration"),
                "confidence": med.get("confidence"),
                "timestamp": timestamp,
            })
            put_patient_item(med_item)

        # 7. Return response
        processing_time_ms = int((time.time() - start_time) * 1000)

        return success_response({
            "patientId": patient_id,
            "encounterId": encounter_id,
            "patient": structured_data.get("patient"),
            "vitals": structured_data.get("vitals"),
            "chiefComplaint": structured_data.get("chiefComplaint"),
            "diagnosis": structured_data.get("diagnosis"),
            "icd10Code": structured_data.get("icd10Code"),
            "symptoms": structured_data.get("symptoms", []),
            "medications": medications,
            "labsOrdered": structured_data.get("labsOrdered", []),
            "advice": structured_data.get("advice", []),
            "lowConfidenceFields": structured_data.get("lowConfidenceFields", []),
            "rawOcrText": raw_ocr_text,
            "textractConfidence": round(avg_textract_confidence, 2),
            "processingTimeMs": processing_time_ms,
        })

    except Exception as e:
        logger.error("process_photo failed: %s", e, exc_info=True)
        return error_response(500, f"Failed to process prescription image: {str(e)}")
