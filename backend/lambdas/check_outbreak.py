import json
import os
import sys
import uuid
import logging
from datetime import datetime, timezone
from decimal import Decimal
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.bedrock_client import invoke_bedrock_json
from shared.dynamodb_client import query_recent_diagnoses, put_alert
from shared.response_helper import success_response, error_response

logger = logging.getLogger("mediscribe.check_outbreak")

THRESHOLDS = {
    "Dengue Fever": {"absolute": 5, "baseline": 1.5},
    "Malaria": {"absolute": 5, "baseline": 2.0},
    "Typhoid": {"absolute": 5, "baseline": 1.0},
    "Tuberculosis": {"absolute": 3, "baseline": 0.5},
    "Influenza": {"absolute": 10, "baseline": 3.0},
    "default": {"absolute": 5, "baseline": 1.5},
}

RELATIVE_MULTIPLIER = 3

BEDROCK_PROMPT_TEMPLATE = """You are a public health epidemiologist analyzing disease surveillance data from Mumbai General Hospital, Mumbai, India.

An outbreak threshold has been crossed:

CURRENT SITUATION:
- Disease: {disease}
- Cases in last 24 hours: {case_count}
- Historical baseline: {baseline} cases/day
- Increase: {percentage}% above baseline
- Current month: March (post-monsoon transition period)
- Location: Mumbai, Maharashtra, India

CASE DETAILS:
{case_details_json}

Provide your epidemiological analysis as ONLY valid JSON:
{{
  "analysis": "2-3 paragraphs: situation assessment, likely cause, risk trajectory. Write as a real epidemiologist would. Reference seasonal patterns, vector-borne disease dynamics, and Mumbai-specific factors where relevant.",
  "severity": "low" or "moderate" or "high" or "critical",
  "forecast": {{
    "next48Hours": {{"predicted": number, "range": [low, high]}},
    "next72Hours": {{"predicted": number, "range": [low, high]}},
    "reasoning": "Brief explanation of forecast basis"
  }},
  "resourceRecommendations": {{
    "beds": number,
    "nsFluidLiters": number,
    "plateletUnits": number,
    "testKits": number,
    "keyMedications": ["specific medication names to stock"],
    "reasoning": "Brief calculation basis"
  }},
  "recommendedActions": [
    "5-7 specific actionable steps for hospital administration"
  ],
  "clinicalAdvisory": "One paragraph advisory for treating physicians"
}}

Use real epidemiological reasoning. For dengue specifically:
- ~80% of cases need admission
- Each patient needs ~3L NS fluid
- ~30% may need platelet monitoring/transfusion
- Test each suspected case + confirm positives
- NSAIDs are CONTRAINDICATED (bleeding risk with thrombocytopenia)"""


def _convert_floats(obj):
    """Convert floats to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _convert_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_floats(i) for i in obj]
    return obj


def _get_disease_name(item):
    """Extract disease name from a diagnosis item, handling both field conventions."""
    return item.get("diagnosis") or item.get("description") or "Unknown"


def _count_diseases(diagnoses, new_diagnosis):
    """Count cases by disease from queried diagnoses + the new incoming diagnosis."""
    disease_data = defaultdict(lambda: {"count": 0, "cases": []})

    for item in diagnoses:
        disease = _get_disease_name(item)
        disease_data[disease]["count"] += 1
        disease_data[disease]["cases"].append({
            "patientId": item.get("patientId", "unknown"),
            "timestamp": item.get("timestamp") or item.get("date") or "",
            "diagnosisId": item.get("diagnosisId", "unknown"),
        })

    new_disease = new_diagnosis.get("disease", "Unknown")
    already_counted = any(
        _get_disease_name(d) == new_disease
        and d.get("patientId") == new_diagnosis.get("patientId")
        for d in diagnoses
    )

    if not already_counted:
        disease_data[new_disease]["count"] += 1
        disease_data[new_disease]["cases"].append({
            "patientId": new_diagnosis.get("patientId", "unknown"),
            "timestamp": new_diagnosis.get("timestamp", datetime.now(timezone.utc).isoformat()),
        })

    return dict(disease_data)


def _check_thresholds(disease_data):
    """Check each disease against absolute and relative thresholds."""
    triggered = []
    monitoring = {}

    for disease, data in disease_data.items():
        count = data["count"]
        thresholds = THRESHOLDS.get(disease, THRESHOLDS["default"])
        absolute = thresholds["absolute"]
        baseline = thresholds["baseline"]

        monitoring[disease] = {
            "last24h": count,
            "threshold": absolute,
            "baseline": baseline,
        }

        absolute_crossed = count >= absolute
        relative_crossed = baseline > 0 and count >= (RELATIVE_MULTIPLIER * baseline)

        if absolute_crossed or relative_crossed:
            percentage = ((count - baseline) / baseline * 100) if baseline > 0 else 0
            triggered.append({
                "disease": disease,
                "count": count,
                "absolute_threshold": absolute,
                "baseline": baseline,
                "percentage": round(percentage, 1),
                "cases": data["cases"],
                "trigger_reason": "absolute" if absolute_crossed else "relative",
            })

    return triggered, monitoring


def lambda_handler(event, context):
    """Check if a new diagnosis triggers an outbreak alert."""
    try:
        body = json.loads(event.get("body", "{}"))

        hospital_id = body.get("hospitalId")
        new_diagnosis = body.get("newDiagnosis")

        if not hospital_id:
            return error_response(400, "Missing required field: hospitalId")
        if not new_diagnosis or not new_diagnosis.get("disease"):
            return error_response(400, "Missing required field: newDiagnosis.disease")

        logger.info(
            "Checking outbreak for hospital=%s, disease=%s, patient=%s",
            hospital_id,
            new_diagnosis.get("disease"),
            new_diagnosis.get("patientId"),
        )

        # Query recent diagnoses from DynamoDB (last 24 hours via GSI1)
        recent_diagnoses = query_recent_diagnoses(hospital_id, hours=24)
        logger.info("Found %d diagnoses in last 24 hours", len(recent_diagnoses))

        # Count cases by disease (including the new one)
        disease_data = _count_diseases(recent_diagnoses, new_diagnosis)

        # Check thresholds
        triggered, monitoring = _check_thresholds(disease_data)

        # No threshold crossed — return monitoring status
        if not triggered:
            logger.info("No outbreak thresholds crossed. Monitoring %d diseases.", len(monitoring))
            return success_response({
                "status": "monitoring",
                "diseaseCounts": monitoring,
            })

        # Threshold crossed — process the highest-count trigger
        triggered.sort(key=lambda t: t["count"], reverse=True)
        primary_trigger = triggered[0]

        logger.warning(
            "OUTBREAK THRESHOLD CROSSED: %s — %d cases (threshold=%d, baseline=%.1f)",
            primary_trigger["disease"],
            primary_trigger["count"],
            primary_trigger["absolute_threshold"],
            primary_trigger["baseline"],
        )

        # Call Bedrock for epidemiological analysis
        case_details_json = json.dumps(primary_trigger["cases"], indent=2)
        prompt = BEDROCK_PROMPT_TEMPLATE.format(
            disease=primary_trigger["disease"],
            case_count=primary_trigger["count"],
            baseline=primary_trigger["baseline"],
            percentage=primary_trigger["percentage"],
            case_details_json=case_details_json,
        )
        bedrock_analysis = invoke_bedrock_json(prompt)

        # Build and store alert in MediScribe-Alerts table
        alert_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()

        alert_item = _convert_floats({
            "hospitalId": hospital_id,
            "alertTimestamp": timestamp,
            "alertId": alert_id,
            "disease": primary_trigger["disease"],
            "caseCount": primary_trigger["count"],
            "baseline": primary_trigger["baseline"],
            "percentageIncrease": primary_trigger["percentage"],
            "triggerReason": primary_trigger["trigger_reason"],
            "status": "active",
            "analysis": bedrock_analysis.get("analysis", ""),
            "severity": bedrock_analysis.get("severity", "moderate"),
            "forecast": bedrock_analysis.get("forecast", {}),
            "resourceRecommendations": bedrock_analysis.get("resourceRecommendations", {}),
            "recommendedActions": bedrock_analysis.get("recommendedActions", []),
            "clinicalAdvisory": bedrock_analysis.get("clinicalAdvisory", ""),
            "cases": primary_trigger["cases"],
        })

        put_alert(alert_item)
        logger.info("Alert stored: alertId=%s", alert_id)

        # Convert Decimals back to JSON-safe types for the response
        alert_response = json.loads(json.dumps(alert_item, default=str))

        return success_response({
            "status": "outbreak_detected",
            "alert": alert_response,
        })

    except Exception as e:
        logger.error("check_outbreak failed: %s", e, exc_info=True)
        return error_response(500, f"Failed to check outbreak: {str(e)}")
