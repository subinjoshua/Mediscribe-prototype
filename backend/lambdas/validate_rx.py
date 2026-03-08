import json
import logging
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.bedrock_client import invoke_bedrock_json
from shared.dynamodb_client import get_drug
from shared.response_helper import success_response, error_response

logger = logging.getLogger("mediscribe.validate_rx")
logger.setLevel(logging.INFO)

# --- Constants ---

FREQUENCY_MAP = {
    "OD": 1, "QD": 1, "ONCE DAILY": 1,
    "BD": 2, "BID": 2, "TWICE DAILY": 2,
    "TID": 3, "THREE TIMES DAILY": 3,
    "QID": 4, "FOUR TIMES DAILY": 4,
    "Q4H": 6, "Q6H": 4, "Q8H": 3, "Q12H": 2,
    "STAT": 1, "PRN": 1,
}

PENICILLIN_GROUP = ["amoxicillin", "ampicillin", "penicillin", "piperacillin", "flucloxacillin"]


# --- Rule-Based Checks ---

def _check_unit(med_name, prescribed_unit, drug_data):
    """Check if prescribed unit is valid for this drug."""
    valid_units = drug_data.get("validUnits", [])
    if not valid_units:
        return []

    if prescribed_unit.lower() not in [u.lower() for u in valid_units]:
        return [{
            "severity": "critical",
            "type": "unit",
            "drug": med_name,
            "message": (
                f"CRITICAL: {med_name} dosage unit is '{prescribed_unit}' but should be "
                f"'{valid_units[0]}'. {med_name} is dispensed in {valid_units[0]}, not {prescribed_unit}."
            ),
        }]
    return []


def _check_dosage(med_name, dose, frequency, patient_age, drug_data):
    """Check if dosage is within safe ranges."""
    alerts = []
    safe_ranges = drug_data.get("safeRanges", {})
    if not safe_ranges:
        return alerts

    # Pick adult or pediatric ranges
    if patient_age < 18 and "pediatric" in safe_ranges:
        ranges = safe_ranges["pediatric"]
    else:
        ranges = safe_ranges.get("adult", {})

    if not ranges:
        return alerts

    min_dose = float(ranges.get("minDose", 0))
    max_dose = float(ranges.get("maxDose", float("inf")))
    max_daily = float(ranges.get("maxDaily", float("inf")))

    if dose < min_dose:
        alerts.append({
            "severity": "warning",
            "type": "dosage",
            "drug": med_name,
            "message": f"Dose {dose} is below recommended minimum of {min_dose} for {med_name}.",
        })

    if dose > max_dose:
        alerts.append({
            "severity": "warning",
            "type": "dosage",
            "drug": med_name,
            "message": f"Dose {dose} exceeds recommended maximum of {max_dose} for {med_name}.",
        })

    # Daily dose check
    freq_upper = frequency.upper()
    times_per_day = FREQUENCY_MAP.get(freq_upper, 1)
    daily_dose = dose * times_per_day

    if daily_dose > max_daily:
        alerts.append({
            "severity": "critical",
            "type": "dosage",
            "drug": med_name,
            "message": (
                f"CRITICAL: Daily dose of {daily_dose} ({dose} x {times_per_day}/day) "
                f"exceeds safe maximum of {max_daily} for {med_name}."
            ),
        })

    return alerts


def _check_allergies(med_name, patient_allergies):
    """Check for direct allergy match and cross-reactivity."""
    alerts = []
    if not patient_allergies:
        return alerts

    drug_lower = med_name.lower()
    allergies_lower = [a.lower() for a in patient_allergies]

    # Direct match
    if drug_lower in allergies_lower:
        alerts.append({
            "severity": "critical",
            "type": "allergy",
            "drug": med_name,
            "message": f"CRITICAL: Patient has a documented allergy to {med_name}.",
        })
        return alerts

    # Cross-reactivity: penicillin group
    if drug_lower in PENICILLIN_GROUP:
        for allergy in allergies_lower:
            if allergy in PENICILLIN_GROUP:
                alerts.append({
                    "severity": "critical",
                    "type": "allergy",
                    "drug": med_name,
                    "message": (
                        f"CRITICAL: Patient is allergic to {allergy} — {med_name} belongs to the "
                        f"same penicillin group. High risk of cross-reactivity."
                    ),
                })
                return alerts

    return alerts


def _check_conditions(med_name, diagnosis, drug_data):
    """Check if drug should be avoided given the patient's diagnosis."""
    avoid_conditions = drug_data.get("avoidInConditions", [])
    if not avoid_conditions or not diagnosis:
        return []

    diagnosis_lower = diagnosis.lower()
    for condition in avoid_conditions:
        if condition.lower() == diagnosis_lower:
            return [{
                "severity": "critical",
                "type": "contraindication",
                "drug": med_name,
                "message": (
                    f"CRITICAL: {med_name} is contraindicated for patients with {diagnosis}. "
                    f"This drug should be avoided in this condition."
                ),
            }]

    return []


def _run_rule_checks(medications, patient_context):
    """Run all rule-based checks across all medications."""
    errors = []
    warnings = []
    info = []

    patient_age = patient_context.get("age", 30)
    patient_allergies = patient_context.get("allergies", [])
    diagnosis = patient_context.get("diagnosis", "")

    for med in medications:
        med_name = med.get("name", "Unknown")
        dose = float(med.get("dosage", 0))
        unit = med.get("unit", "")
        frequency = med.get("frequency", "OD")

        # Look up drug in DynamoDB
        drug_data = get_drug(med_name)
        if not drug_data:
            info.append({
                "severity": "info",
                "type": "lookup",
                "drug": med_name,
                "message": f"{med_name} not found in drug database. Unable to perform rule-based checks.",
            })
            continue

        # Run each check
        for alert in _check_unit(med_name, unit, drug_data):
            if alert["severity"] == "critical":
                errors.append(alert)
            else:
                warnings.append(alert)

        for alert in _check_dosage(med_name, dose, frequency, patient_age, drug_data):
            if alert["severity"] == "critical":
                errors.append(alert)
            else:
                warnings.append(alert)

        for alert in _check_allergies(med_name, patient_allergies):
            errors.append(alert)

        for alert in _check_conditions(med_name, diagnosis, drug_data):
            errors.append(alert)

    return errors, warnings, info


# --- Bedrock Complex Validation ---

def _build_bedrock_prompt(medications, patient_context, rule_based_results):
    """Build the prompt for Bedrock complex validation."""
    age = patient_context.get("age", "unknown")
    weight = patient_context.get("weight", "unknown")
    gender = patient_context.get("gender", "unknown")
    allergies = patient_context.get("allergies", [])
    current_meds = patient_context.get("currentMedications", [])
    diagnosis = patient_context.get("diagnosis", "unknown")

    medications_json = json.dumps(medications, indent=2)
    allergies_str = ", ".join(allergies) if allergies else "None reported"
    current_meds_str = ", ".join(current_meds) if current_meds else "None"

    # Format rule-based results for context
    rule_summary_parts = []
    for alert in rule_based_results:
        rule_summary_parts.append(f"- [{alert['severity'].upper()}] {alert['drug']}: {alert['message']}")
    rule_based_str = "\n".join(rule_summary_parts) if rule_summary_parts else "No issues found by rule-based checks."

    prompt = f"""You are a clinical pharmacist AI performing a final safety review of a prescription.

The following rule-based checks have already been performed:
{rule_based_str}

PRESCRIPTION:
{medications_json}

PATIENT:
- Age: {age}, Weight: {weight}kg, Gender: {gender}
- Allergies: {allergies_str}
- Current medications: {current_meds_str}
- Diagnosis: {diagnosis}

Please check for any ADDITIONAL issues not caught by rule-based checks:
1. Drug-drug interactions between prescribed medications AND current medications
2. Duplicate therapy (two drugs from same class)
3. Dosing frequency appropriateness
4. Any diagnosis-specific clinical considerations

Respond with ONLY valid JSON:
{{
  "errors": [
    {{"severity": "critical", "type": "interaction|duplicate|frequency|clinical", "drug": "name", "message": "explanation"}}
  ],
  "warnings": [
    {{"severity": "warning", "type": "same types", "drug": "name", "message": "explanation"}}
  ],
  "info": [
    {{"severity": "info", "type": "monitoring|advisory", "drug": "name", "message": "clinical tip"}}
  ]
}}

Return empty arrays if no additional issues found. Do NOT repeat issues already caught by rule-based checks."""

    return prompt


def _call_bedrock_validation(medications, patient_context, rule_based_results):
    """Call Bedrock for complex validation. Returns (errors, warnings, info)."""
    try:
        prompt = _build_bedrock_prompt(medications, patient_context, rule_based_results)
        result = invoke_bedrock_json(prompt)

        bedrock_errors = result.get("errors", [])
        bedrock_warnings = result.get("warnings", [])
        bedrock_info = result.get("info", [])

        return bedrock_errors, bedrock_warnings, bedrock_info

    except Exception as e:
        logger.error("Bedrock validation failed: %s", e)
        return [], [], [{
            "severity": "info",
            "type": "system",
            "drug": "N/A",
            "message": "AI-powered interaction check unavailable. Rule-based checks were completed successfully.",
        }]


# --- Merge Logic ---

def _deduplicate(alerts):
    """Remove duplicate alerts (same drug + same type)."""
    seen = set()
    unique = []
    for alert in alerts:
        key = (alert.get("drug", "").lower(), alert.get("type", "").lower())
        if key not in seen:
            seen.add(key)
            unique.append(alert)
    return unique


def _merge_results(rule_errors, rule_warnings, rule_info, bedrock_errors, bedrock_warnings, bedrock_info):
    """Merge rule-based and Bedrock results, deduplicate, and sort."""
    all_errors = _deduplicate(rule_errors + bedrock_errors)
    all_warnings = _deduplicate(rule_warnings + bedrock_warnings)
    all_info = _deduplicate(rule_info + bedrock_info)

    return all_errors, all_warnings, all_info


# --- Handler ---

def lambda_handler(event, context):
    """Validate prescription medications for safety errors."""
    try:
        body = json.loads(event.get("body", "{}"))
    except (json.JSONDecodeError, TypeError):
        return error_response(400, "Invalid JSON in request body.")

    medications = body.get("medications")
    patient_context = body.get("patientContext")

    if not medications or not isinstance(medications, list):
        return error_response(400, "Missing or invalid 'medications' array.")

    if not patient_context or not isinstance(patient_context, dict):
        return error_response(400, "Missing or invalid 'patientContext' object.")

    logger.info("Validating %d medication(s) for patient (age=%s, diagnosis=%s)",
                len(medications),
                patient_context.get("age", "unknown"),
                patient_context.get("diagnosis", "unknown"))

    # Step 1: Rule-based checks
    rule_errors, rule_warnings, rule_info = _run_rule_checks(medications, patient_context)
    all_rule_alerts = rule_errors + rule_warnings + rule_info

    logger.info("Rule-based checks complete: %d errors, %d warnings, %d info",
                len(rule_errors), len(rule_warnings), len(rule_info))

    # Step 2: Bedrock complex validation
    bedrock_errors, bedrock_warnings, bedrock_info = _call_bedrock_validation(
        medications, patient_context, all_rule_alerts
    )

    logger.info("Bedrock validation complete: %d errors, %d warnings, %d info",
                len(bedrock_errors), len(bedrock_warnings), len(bedrock_info))

    # Step 3: Merge and deduplicate
    errors, warnings, info = _merge_results(
        rule_errors, rule_warnings, rule_info,
        bedrock_errors, bedrock_warnings, bedrock_info,
    )

    # Step 4: Determine overall result
    if errors:
        validation_result = "errors_found"
    elif warnings:
        validation_result = "warnings_found"
    else:
        validation_result = "approved"

    return success_response({
        "validationResult": validation_result,
        "errors": errors,
        "warnings": warnings,
        "info": info,
    })
