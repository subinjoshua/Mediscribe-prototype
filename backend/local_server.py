"""
Local development server that mimics API Gateway.
Translates HTTP requests into Lambda event format and invokes handlers directly.

Usage: python backend/local_server.py
Frontend at localhost:5173 talks to this server at localhost:3000.
"""

import json
import os
import sys

# Set environment variables BEFORE importing lambdas (some read env at import time)
os.environ.setdefault("PATIENTS_TABLE", "MediScribe-Patients")
os.environ.setdefault("DRUGS_TABLE", "MediScribe-Drugs")
os.environ.setdefault("ALERTS_TABLE", "MediScribe-Alerts")
os.environ.setdefault("S3_BUCKET", "mediscribe-uploads-local")
os.environ.setdefault("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-6")

# Add backend/ to sys.path so Lambda imports (from shared.xxx) resolve
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from flask import Flask, request, jsonify
from flask_cors import CORS

from lambdas import (
    process_photo,
    validate_rx,
    check_outbreak,
    outbreak_dashboard,
    discharge_summary,
    get_patients,
    seed_data,
)

app = Flask(__name__)
CORS(app)


def build_event(path_params=None):
    """Convert a Flask request into a Lambda event dict."""
    body = request.get_data(as_text=True) or None
    query_params = dict(request.args) if request.args else None

    return {
        "body": body,
        "queryStringParameters": query_params,
        "pathParameters": path_params,
        "httpMethod": request.method,
        "headers": dict(request.headers),
    }


def lambda_to_flask(lambda_response):
    """Convert a Lambda response dict into a Flask response."""
    status_code = lambda_response.get("statusCode", 200)
    body = lambda_response.get("body", "{}")
    headers = lambda_response.get("headers", {})

    parsed_body = json.loads(body)

    response = jsonify(parsed_body)
    response.status_code = status_code
    for key, value in headers.items():
        if key.lower() != "content-type":
            response.headers[key] = value
    return response


# --- Routes ---


@app.route("/process-photo", methods=["POST"])
def route_process_photo():
    event = build_event()
    result = process_photo.lambda_handler(event, None)
    return lambda_to_flask(result)


@app.route("/validate-rx", methods=["POST"])
def route_validate_rx():
    event = build_event()
    result = validate_rx.lambda_handler(event, None)
    return lambda_to_flask(result)


@app.route("/check-outbreak", methods=["POST"])
def route_check_outbreak():
    event = build_event()
    result = check_outbreak.lambda_handler(event, None)
    return lambda_to_flask(result)


@app.route("/outbreak-dashboard", methods=["GET"])
def route_outbreak_dashboard():
    event = build_event()
    result = outbreak_dashboard.lambda_handler(event, None)
    return lambda_to_flask(result)


@app.route("/discharge-summary", methods=["POST"])
def route_discharge_summary():
    event = build_event()
    result = discharge_summary.lambda_handler(event, None)
    return lambda_to_flask(result)


@app.route("/patients", methods=["GET"])
def route_get_patients():
    event = build_event()
    result = get_patients.lambda_handler(event, None)
    return lambda_to_flask(result)


@app.route("/patients/<patient_id>", methods=["GET"])
def route_get_patient(patient_id):
    event = build_event(path_params={"id": patient_id})
    result = get_patients.lambda_handler(event, None)
    return lambda_to_flask(result)


@app.route("/seed-data", methods=["POST"])
def route_seed_data():
    event = build_event()
    result = seed_data.lambda_handler(event, None)
    return lambda_to_flask(result)


if __name__ == "__main__":
    print("=" * 60)
    print("MediScribe Local Development Server")
    print("=" * 60)
    print(f"  PATIENTS_TABLE  = {os.environ['PATIENTS_TABLE']}")
    print(f"  DRUGS_TABLE     = {os.environ['DRUGS_TABLE']}")
    print(f"  ALERTS_TABLE    = {os.environ['ALERTS_TABLE']}")
    print(f"  S3_BUCKET       = {os.environ['S3_BUCKET']}")
    print(f"  BEDROCK_MODEL_ID= {os.environ['BEDROCK_MODEL_ID']}")
    print("=" * 60)
    print("  Server running on http://localhost:3000")
    print("  Frontend should connect from http://localhost:5173")
    print("=" * 60)
    app.run(host="0.0.0.0", port=3000, debug=True)
