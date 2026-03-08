import json
import os
import sys
import logging
from decimal import Decimal

# Local testing: add backend/ to path so shared/ imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.dynamodb_client import batch_write_items, DRUGS_TABLE, PATIENTS_TABLE
from shared.response_helper import success_response, error_response

logger = logging.getLogger("mediscribe.seed_data")

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
if not os.path.isdir(DATA_DIR):
    DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def _convert_floats(obj):
    """Convert float values to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _convert_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_floats(i) for i in obj]
    return obj


def lambda_handler(event, context):
    try:
        # Load and seed drugs
        with open(os.path.join(DATA_DIR, "drugs.json")) as f:
            drugs = _convert_floats(json.load(f))
        batch_write_items(DRUGS_TABLE, drugs)

        # Load and seed patient items
        with open(os.path.join(DATA_DIR, "seed_patients.json")) as f:
            patient_items = _convert_floats(json.load(f))
        batch_write_items(PATIENTS_TABLE, patient_items)

        return success_response({
            "drugsLoaded": len(drugs),
            "patientItemsLoaded": len(patient_items)
        })
    except Exception as e:
        logger.error("Seed data failed: %s", e)
        return error_response(500, f"Seed data failed: {str(e)}")
