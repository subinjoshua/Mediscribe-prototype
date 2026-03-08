# MediScribe — AI-Powered Clinical Documentation

**"One Day at Mumbai General"**

**Team Helios** | AWS AI for Bharat Hackathon

> A single-page React web app backed by AWS serverless services, demonstrating how AI can transform clinical documentation through a connected story: Dr. Priya Sharma's shift at Mumbai General Hospital.

---

## The Problem

Indian doctors spend an estimated **3 hours every day** on clinical documentation — handwriting prescriptions, filling discharge forms, and manually reporting disease cases to health authorities. This isn't just an inconvenience; it's a patient safety crisis.

Handwritten prescriptions lead to **misread dosages**. Drug interactions go **undetected** until a patient reacts. Disease outbreaks are identified **days late** because case data sits in paper registers. Discharge summaries are rushed, leaving patients confused about their medications and follow-up care.

Dr. Priya Sharma knows this firsthand. During a single shift at Mumbai General Hospital, she processes a handwritten Dengue prescription, validates complex medications for a patient with allergies, notices a spike in Dengue cases that could signal an outbreak, and must produce a discharge summary that a patient's family can actually understand — all while seeing dozens of other patients.

**MediScribe automates all four of these tasks using AWS AI services.**

---

## Solution Overview — 4 Layers

MediScribe addresses clinical documentation through four integrated layers, each demonstrated as a tab in the application:

### Layer 1: Smart Capture
**Prescription Photo → Structured Medical Record**

Upload a photo of a handwritten prescription. Amazon Textract extracts the text, then Amazon Bedrock (Claude) interprets medical abbreviations (OD, BD, TDS, SOS), maps medications to standard names, identifies the diagnosis with ICD-10 codes, and structures everything into a queryable patient record — complete with confidence scores.

### Layer 2: Prescription Guardian
**Rule-Based + AI Pharmaceutical Validation**

Every prescription is validated in two stages. First, a rule engine checks dosage ranges (adult vs. pediatric), unit correctness, allergy cross-reactivity (e.g., penicillin group), and condition contraindications against a database of 25+ drugs. Then Bedrock performs complex checks: drug-drug interactions, duplicate therapy detection, and diagnosis-specific clinical considerations. Results are classified as errors (red), warnings (yellow), or advisory info (blue).

### Layer 3: Outbreak Sentinel
**Real-Time Disease Surveillance**

Each new diagnosis is counted against configurable thresholds (e.g., 5 Dengue cases in 24 hours). When a threshold is crossed, Bedrock generates an epidemiological analysis with severity assessment, 48-hour and 72-hour forecasts, resource recommendations (ICU beds, IV fluid liters, platelet units, test kits), and recommended actions for hospital administration. A 7-day timeline chart visualizes the trend.

### Layer 4: Discharge Composer
**AI-Generated Discharge Summaries**

Bedrock drafts a complete discharge summary from the patient's record: demographics, admission details, a narrative hospital course (paragraphs, not bullet points), diagnoses with ICD-10 codes, significant findings, discharge medications with indications, follow-up appointments, and patient instructions written at an 8th-grade reading level with specific red-flag warnings.

---

## Architecture

```
                        ┌─────────────────────────────────┐
                        │      React Frontend (Vite)      │
                        │   Tailwind CSS  |  Recharts     │
                        │                                 │
                        │  ┌─────────┐ ┌─────────┐       │
                        │  │Process  │ │Validate │       │
                        │  │   Tab   │ │   Tab   │       │
                        │  ├─────────┤ ├─────────┤       │
                        │  │Outbreak │ │Discharge│       │
                        │  │   Tab   │ │   Tab   │       │
                        │  └─────────┘ └─────────┘       │
                        └──────────────┬──────────────────┘
                                       │ REST + CORS
                        ┌──────────────▼──────────────────┐
                        │     Amazon API Gateway          │
                        │  8 endpoints (GET/POST)         │
                        └──────────────┬──────────────────┘
                                       │
          ┌────────────┬───────────────┼───────────────┬────────────┐
          │            │               │               │            │
    ┌─────▼─────┐┌─────▼─────┐ ┌──────▼──────┐ ┌─────▼─────┐┌────▼─────┐
    │ process   ││ validate  │ │   check     │ │ outbreak  ││discharge │
    │ _photo    ││ _rx       │ │ _outbreak   │ │_dashboard ││_summary  │
    │           ││           │ │             │ │           ││          │
    │ Lambda    ││ Lambda    │ │  Lambda     │ │ Lambda    ││ Lambda   │
    └──┬──┬─────┘└──┬────────┘ └──┬──────────┘ └──┬───────┘└──┬──────┘
       │  │         │             │                │           │
       │  │    ┌────▼─────┐ ┌────▼─────┐          │      ┌────▼─────┐
       │  │    │ Bedrock  │ │ Bedrock  │          │      │ Bedrock  │
       │  │    │ (Claude) │ │ (Claude) │          │      │ (Claude) │
       │  │    └──────────┘ └──────────┘          │      └──────────┘
       │  │                                       │
  ┌────▼──┴──┐  ┌────────────────────────────────▼──────────────────┐
  │ Amazon   │  │              Amazon DynamoDB                      │
  │Textract  │  │  ┌──────────────────┐ ┌───────────────────┐      │
  │ (OCR)    │  │  │MediScribe-       │ │MediScribe-Drugs   │      │
  └──────────┘  │  │Patients (GSI1)   │ │(25+ drugs)        │      │
                │  ├──────────────────┤ ├───────────────────┤      │
  ┌──────────┐  │  │MediScribe-       │ │drugName PK        │      │
  │Amazon S3 │  │  │Alerts            │ │safeRanges, units  │      │
  │(uploads) │  │  │(hospitalId+ts)   │ │interactions       │      │
  └──────────┘  │  └──────────────────┘ └───────────────────┘      │
                └───────────────────────────────────────────────────┘
```

---

## AWS Services — What and Why

| Service | What It Does | Why This Service |
|---------|-------------|-----------------|
| **Amazon Bedrock** (Claude Sonnet 4.6) | Medical data extraction, drug validation, epidemiological analysis, discharge summary generation | Most capable model for medical reasoning; structured JSON output; inference profiles for cost control; no model hosting required |
| **Amazon Textract** | Extracts text from prescription photos | Purpose-built for document OCR; handles handwritten text; returns confidence scores per word |
| **Amazon DynamoDB** | Stores patient records, drug database, outbreak alerts across 3 tables | Serverless with pay-per-request billing; composite keys (PK/SK) model medical hierarchies naturally; GSI enables cross-hospital outbreak queries |
| **Amazon S3** | Stores uploaded prescription images | Durable object storage; CORS-enabled for direct browser uploads |
| **AWS Lambda** | Runs 7 backend functions (Python 3.12) | Serverless compute; scales to zero; no infrastructure to manage; 256MB/60s config handles Bedrock calls |
| **Amazon API Gateway** | REST API with CORS for 8 endpoints | Managed API layer; built-in request throttling; seamless Lambda integration |
| **AWS IAM** | Least-privilege roles for Lambda execution | Security best practice; scoped to specific DynamoDB tables, S3 bucket, Bedrock model, and Textract actions |

---

## Setup Instructions

### Prerequisites

- **AWS Account** with Bedrock model access enabled
- **Node.js 18+** and npm
- **Python 3.12+** and pip
- **AWS CLI** configured (`aws configure` with your credentials)
- **SAM CLI** (for AWS deployment only)

### AWS Configuration

1. **Enable Bedrock access** in the AWS Console:
   - Navigate to Amazon Bedrock → Model access (region: **us-east-1**)
   - Request access to **Claude Sonnet 4.6** (Anthropic)
   - Verify with: `aws bedrock list-inference-profiles --region us-east-1`

2. **DynamoDB tables** are created automatically by the SAM template on deployment. For local development, run:
   ```bash
   cd infrastructure
   python setup_dynamodb.py
   python setup_s3.py
   ```

### Local Development

**Terminal 1 — Backend (Flask dev server on port 3000):**
```bash
cd backend
pip install -r requirements.txt
python local_server.py
```

**Terminal 2 — Frontend (Vite dev server on port 5173):**
```bash
cd frontend
npm install
npm run dev
```

**Seed demo data (6 patients + 25 drugs):**
```bash
curl -X POST http://localhost:3000/seed-data
```

Or click the **"Seed Demo Data"** button in the app header.

### Deployment to AWS

```bash
cd infrastructure
sam build
sam deploy --guided

# After deployment, update the frontend API URL:
bash update_frontend_env.sh
```

---

## Demo Script

The demo follows Dr. Priya Sharma through a single shift, exercising all four layers in sequence:

| Step | Action | What Happens |
|------|--------|-------------|
| **1. Seed** | Click "Seed Demo Data" | Loads 6 patient profiles (with allergies, conditions) and 25 drugs (with safe ranges, interactions) into DynamoDB |
| **2. Process** | Upload/paste a handwritten Dengue prescription | Textract OCR → Bedrock extracts patient (Aisha Begum, 28F, 55kg), vitals, diagnosis (Dengue Fever, ICD-10 A90), and 4 medications with confidence scores |
| **3. Validate** | Auto-triggered after processing | Rule engine + Bedrock flag issues: dosage range checks, allergy cross-reactivity, drug-drug interactions, condition contraindications. Errors in red, warnings in yellow |
| **4. Outbreak** | Auto-checked on new diagnosis | Dengue case count exceeds threshold (5 in 24h) → Bedrock epidemiologist generates severity assessment, 48h/72h forecasts, resource needs (ICU beds, NS fluid, platelet units), and action steps |
| **5. Dashboard** | View Outbreak tab | 7-day timeline chart, active alerts, disease counts, recent diagnoses — all aggregated from DynamoDB |
| **6. Discharge** | Generate summary for patient | Bedrock produces a complete discharge document: narrative hospital course, medications table, follow-up plan, and patient instructions at 8th-grade reading level |

**Automated test:** `python backend/test_flow.py` runs all 6 steps against the local server.

---

## Cost Analysis

**Target: $35–55 of the $100 hackathon budget**

| Service | Monthly Estimate | Notes |
|---------|-----------------|-------|
| Amazon Bedrock | ~$30 | Largest cost driver. ~$0.03 per discharge summary (2K output tokens). Claude Sonnet 4.6: $3/1M input, $15/1M output tokens |
| Amazon Textract | ~$5 | $1.50 per 1,000 pages. Each prescription = 1 page |
| Amazon DynamoDB | ~$5–10 | Pay-per-request billing. 1–5 WCU per transaction |
| AWS Lambda | ~$1–2 | 256MB, 60s timeout. ~$0.0000002 per invocation |
| Amazon S3 | <$1 | Minimal storage for prescription images |
| API Gateway | <$1 | $3.50 per million requests |
| **Total** | **~$40–50/month** | At pilot scale (100 patients/day) |

All services are **serverless** — costs scale to zero when not in use. During the hackathon, actual spend will be well under $55 for development and demo runs.

---

## Future Roadmap — Production Architecture

Scaling MediScribe from prototype to production would introduce 13+ additional AWS services:

| Service | Production Role |
|---------|----------------|
| **Amazon Cognito** | Doctor and admin authentication with MFA |
| **AWS Step Functions** | Orchestrate multi-step clinical workflows (process → validate → alert → discharge) |
| **Amazon SQS** | Async prescription processing queue for high-throughput hospitals |
| **Amazon SNS** | Real-time outbreak notifications to district health authorities |
| **Amazon QuickSight** | Advanced analytics dashboards for hospital administrators |
| **AWS HealthLake** | FHIR-compliant health data store for interoperability |
| **Amazon Comprehend Medical** | Enhanced named-entity recognition for medical terms |
| **AWS WAF** | API security, rate limiting, and DDoS protection |
| **Amazon CloudWatch** | Monitoring, alarms, and operational dashboards |
| **AWS Secrets Manager** | Secure credential and API key management |
| **Amazon ElastiCache** | Cache drug database for sub-millisecond lookups |
| **AWS CloudFormation** | Full infrastructure-as-code for multi-region deployment |
| **Amazon EventBridge** | Event-driven routing for outbreak alerts across hospital networks |

---

## Team

**Team Helios** — AWS AI for Bharat Hackathon

---

*Built with Amazon Bedrock, Textract, DynamoDB, S3, Lambda, and API Gateway*
