import boto3
import os
import logging
from datetime import datetime, timedelta, timezone
from boto3.dynamodb.conditions import Key, Attr

logger = logging.getLogger("mediscribe.dynamodb_client")

PATIENTS_TABLE = os.environ.get("PATIENTS_TABLE", "MediScribe-Patients")
DRUGS_TABLE = os.environ.get("DRUGS_TABLE", "MediScribe-Drugs")
ALERTS_TABLE = os.environ.get("ALERTS_TABLE", "MediScribe-Alerts")

_dynamodb = boto3.resource("dynamodb")

_patients_table = _dynamodb.Table(PATIENTS_TABLE)
_drugs_table = _dynamodb.Table(DRUGS_TABLE)
_alerts_table = _dynamodb.Table(ALERTS_TABLE)


def put_patient_item(item: dict) -> dict:
    """Puts an item into the Patients table."""
    try:
        _patients_table.put_item(Item=item)
        return item
    except Exception as e:
        logger.error("Failed to put patient item: %s", e)
        return None


def get_patient(patient_id: str) -> dict:
    """Gets a patient profile: PK=PATIENT#{patient_id}, SK=PROFILE."""
    try:
        response = _patients_table.get_item(
            Key={"PK": f"PATIENT#{patient_id}", "SK": "PROFILE"}
        )
        return response.get("Item")
    except Exception as e:
        logger.error("Failed to get patient %s: %s", patient_id, e)
        return None


def get_encounter(patient_id: str, encounter_id: str) -> dict:
    """Gets an encounter: PK=PATIENT#{patient_id}, SK=ENCOUNTER#{encounter_id}."""
    try:
        response = _patients_table.get_item(
            Key={"PK": f"PATIENT#{patient_id}", "SK": f"ENCOUNTER#{encounter_id}"}
        )
        return response.get("Item")
    except Exception as e:
        logger.error("Failed to get encounter %s for patient %s: %s", encounter_id, patient_id, e)
        return None


def query_patient_encounters(patient_id: str) -> list:
    """Queries all encounters for a patient: PK=PATIENT#{patient_id}, SK begins_with ENCOUNTER#."""
    try:
        response = _patients_table.query(
            KeyConditionExpression=Key("PK").eq(f"PATIENT#{patient_id}")
            & Key("SK").begins_with("ENCOUNTER#")
        )
        return response.get("Items", [])
    except Exception as e:
        logger.error("Failed to query encounters for patient %s: %s", patient_id, e)
        return []


def get_encounter_items(encounter_id: str) -> list:
    """Gets ALL items for an encounter (meds, notes, labs): PK=ENCOUNTER#{encounter_id}."""
    try:
        response = _patients_table.query(
            KeyConditionExpression=Key("PK").eq(f"ENCOUNTER#{encounter_id}")
        )
        return response.get("Items", [])
    except Exception as e:
        logger.error("Failed to get encounter items for %s: %s", encounter_id, e)
        return []


def get_drug(drug_name: str) -> dict:
    """Gets a drug from the Drugs table. Lowercases the drug_name for lookup."""
    try:
        response = _drugs_table.get_item(
            Key={"drugName": drug_name.lower()}
        )
        return response.get("Item")
    except Exception as e:
        logger.error("Failed to get drug %s: %s", drug_name, e)
        return None


def query_recent_diagnoses(hospital_id: str, hours: int = 24) -> list:
    """Queries GSI1 for recent diagnoses within the given time window."""
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        cutoff_str = cutoff.isoformat()

        response = _patients_table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(f"HOSPITAL#{hospital_id}")
            & Key("GSI1SK").begins_with("DX#"),
            FilterExpression=Attr("timestamp").gte(cutoff_str),
        )
        return response.get("Items", [])
    except Exception as e:
        logger.error("Failed to query recent diagnoses for hospital %s: %s", hospital_id, e)
        return []


def put_alert(item: dict) -> dict:
    """Puts an item into the Alerts table."""
    try:
        _alerts_table.put_item(Item=item)
        return item
    except Exception as e:
        logger.error("Failed to put alert: %s", e)
        return None


def get_active_alerts(hospital_id: str) -> list:
    """Queries the Alerts table for a hospital's alerts."""
    try:
        response = _alerts_table.query(
            KeyConditionExpression=Key("hospitalId").eq(hospital_id)
        )
        return response.get("Items", [])
    except Exception as e:
        logger.error("Failed to get alerts for hospital %s: %s", hospital_id, e)
        return []


def list_all_patients() -> list:
    """Scans Patients table where SK = PROFILE."""
    try:
        response = _patients_table.scan(
            FilterExpression=Attr("SK").eq("PROFILE")
        )
        items = response.get("Items", [])

        while "LastEvaluatedKey" in response:
            response = _patients_table.scan(
                FilterExpression=Attr("SK").eq("PROFILE"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))

        return items
    except Exception as e:
        logger.error("Failed to list patients: %s", e)
        return []


def batch_write_items(table_name: str, items: list) -> None:
    """Batch writes items to a table (for seeding)."""
    try:
        table = _dynamodb.Table(table_name)
        with table.batch_writer() as batch:
            for item in items:
                batch.put_item(Item=item)
        logger.info("Batch wrote %d items to %s", len(items), table_name)
    except Exception as e:
        logger.error("Failed to batch write to %s: %s", table_name, e)
