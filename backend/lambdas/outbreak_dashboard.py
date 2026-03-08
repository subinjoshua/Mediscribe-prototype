import json
import os
import sys
import logging
from datetime import datetime, timedelta, timezone
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.dynamodb_client import get_active_alerts, query_recent_diagnoses
from shared.response_helper import success_response, error_response

logger = logging.getLogger("mediscribe.outbreak_dashboard")

THRESHOLDS = {
    "Dengue Fever": {"absolute": 5, "baseline": 1.5},
    "Malaria": {"absolute": 5, "baseline": 2.0},
    "Typhoid": {"absolute": 5, "baseline": 1.0},
    "Tuberculosis": {"absolute": 3, "baseline": 0.5},
    "Influenza": {"absolute": 10, "baseline": 3.0},
    "default": {"absolute": 5, "baseline": 1.5},
}


def _get_disease_name(item):
    """Extract disease name, handling both field conventions."""
    return item.get("diagnosis") or item.get("description") or "Unknown"


def _get_timestamp(item):
    """Extract timestamp, handling both field conventions."""
    return item.get("timestamp") or item.get("date") or ""


def _parse_timestamp(ts_string):
    """Parse an ISO timestamp string to a datetime. Returns None on failure."""
    if not ts_string:
        return None
    try:
        cleaned = ts_string.replace("Z", "+00:00")
        return datetime.fromisoformat(cleaned)
    except (ValueError, TypeError):
        return None


def _aggregate_dashboard_data(all_diagnoses_7d):
    """Process 7-day diagnoses into dashboard views."""
    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)

    counts_24h = defaultdict(int)
    counts_7d = defaultdict(int)
    timeline_data = defaultdict(lambda: defaultdict(int))
    recent_list = []
    all_diseases = set()

    for item in all_diagnoses_7d:
        disease = _get_disease_name(item)
        ts_str = _get_timestamp(item)
        ts_dt = _parse_timestamp(ts_str)

        all_diseases.add(disease)
        counts_7d[disease] += 1

        if ts_dt and ts_dt >= cutoff_24h:
            counts_24h[disease] += 1

        if ts_dt:
            date_key = ts_dt.strftime("%Y-%m-%d")
            timeline_data[date_key][disease] += 1

        time_display = ts_dt.strftime("%H:%M") if ts_dt else ""
        recent_list.append({
            "patientName": item.get("patientName", item.get("patientId", "Unknown")),
            "disease": disease,
            "time": time_display,
            "patientId": item.get("patientId", "Unknown"),
        })

    # Build disease counts with threshold info
    disease_counts = {}
    for disease in all_diseases:
        threshold_info = THRESHOLDS.get(disease, THRESHOLDS["default"])
        disease_counts[disease] = {
            "last24h": counts_24h.get(disease, 0),
            "last7d": counts_7d.get(disease, 0),
            "threshold": threshold_info["absolute"],
        }

    # Build timeline with all 7 days filled (oldest first)
    timeline = []
    for i in range(7):
        day = now - timedelta(days=(6 - i))
        date_str = day.strftime("%Y-%m-%d")
        day_entry = {"date": date_str}
        for disease in sorted(all_diseases):
            day_entry[disease] = timeline_data[date_str].get(disease, 0)
        timeline.append(day_entry)

    # Sort recent diagnoses by time descending
    recent_list.sort(key=lambda x: x["time"], reverse=True)

    return disease_counts, recent_list, timeline


def lambda_handler(event, context):
    """Return outbreak dashboard data for a hospital."""
    try:
        params = event.get("queryStringParameters") or {}
        hospital_id = params.get("hospitalId")

        if not hospital_id:
            return error_response(400, "Missing required query parameter: hospitalId")

        logger.info("Fetching outbreak dashboard for hospital=%s", hospital_id)

        # Query active alerts and 7-day diagnoses
        active_alerts = get_active_alerts(hospital_id)
        logger.info("Found %d active alerts", len(active_alerts))

        all_diagnoses_7d = query_recent_diagnoses(hospital_id, hours=168)
        logger.info("Found %d diagnoses in last 7 days", len(all_diagnoses_7d))

        # Aggregate into dashboard views
        disease_counts, recent_diagnoses, timeline = _aggregate_dashboard_data(all_diagnoses_7d)

        # Convert Decimals for JSON serialization
        alerts_clean = json.loads(json.dumps(active_alerts, default=str))

        return success_response({
            "activeAlerts": alerts_clean,
            "diseaseCounts": disease_counts,
            "recentDiagnoses": recent_diagnoses,
            "timeline": timeline,
        })

    except Exception as e:
        logger.error("outbreak_dashboard failed: %s", e, exc_info=True)
        return error_response(500, f"Failed to load outbreak dashboard: {str(e)}")
