#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# MediScribe Prototype — SAM Deployment Script
# Builds and deploys the entire backend to AWS via SAM CLI.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Constants ─────────────────────────────────────────────────
STACK_NAME="mediscribe-prototype"
AWS_REGION="${AWS_REGION:-us-east-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
LAMBDAS_DIR="$BACKEND_DIR/lambdas"
INFRA_DIR="$PROJECT_ROOT/infrastructure"

# ── Cleanup (runs on exit, even on failure) ───────────────────
cleanup() {
    echo ""
    echo "Cleaning up temporary deployment files..."
    rm -rf "$LAMBDAS_DIR/shared"
    rm -rf "$LAMBDAS_DIR/data"
    rm -f  "$LAMBDAS_DIR/requirements.txt"
}
trap cleanup EXIT

# ── Prerequisite checks ──────────────────────────────────────
echo "Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "ERROR: AWS CLI not found. Install it from https://aws.amazon.com/cli/"
    exit 1
fi

if ! command -v sam &> /dev/null; then
    echo "ERROR: SAM CLI not found. Install it from https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

echo "  AWS CLI: $(aws --version 2>&1 | head -1)"
echo "  SAM CLI: $(sam --version)"
echo "  Region:  $AWS_REGION"
echo "  Stack:   $STACK_NAME"
echo ""

# ── Prepare deployment package ────────────────────────────────
echo "Preparing deployment package..."

# Ensure shared/ is a proper Python package
if [ ! -f "$BACKEND_DIR/shared/__init__.py" ]; then
    echo "  Creating shared/__init__.py..."
    touch "$BACKEND_DIR/shared/__init__.py"
fi

# Copy shared modules into lambdas/ (SAM CodeUri = ../backend/lambdas/)
echo "  Copying shared/ -> lambdas/shared/"
cp -r "$BACKEND_DIR/shared" "$LAMBDAS_DIR/shared"

# Copy data files for seed_data lambda
echo "  Copying data/ -> lambdas/data/"
cp -r "$BACKEND_DIR/data" "$LAMBDAS_DIR/data"

# Write runtime-only requirements (exclude flask/flask-cors — dev only)
echo "boto3" > "$LAMBDAS_DIR/requirements.txt"
echo "  Created lambdas/requirements.txt (boto3 only)"

echo ""

# ── SAM Build ─────────────────────────────────────────────────
echo "Running sam build..."
cd "$INFRA_DIR"
sam build --template-file template.yaml

echo ""
echo "Build complete."
echo ""

# ── Deploy ────────────────────────────────────────────────────
STACK_EXISTS=false
if aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    > /dev/null 2>&1; then
    STACK_EXISTS=true
fi

if [ "$STACK_EXISTS" = true ]; then
    echo "Updating existing stack '$STACK_NAME'..."
else
    echo "Creating new stack '$STACK_NAME' (first deploy — this may take 3-5 minutes)..."
fi

sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --capabilities CAPABILITY_IAM \
    --resolve-s3 \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset

echo ""

# ── Extract API URL ───────────────────────────────────────────
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text)

echo "========================================"
echo "  Deployment complete!"
echo "  API URL: $API_URL"
echo "========================================"

# ── Update frontend environment ───────────────────────────────
if [ -n "$API_URL" ] && [ "$API_URL" != "None" ]; then
    echo ""
    echo "Updating frontend environment..."
    bash "$INFRA_DIR/update_frontend_env.sh" "$API_URL"
fi

echo ""
echo "Next steps:"
echo "  1. cd frontend && npm run dev    (start frontend with deployed API)"
echo "  2. Call /seed-data endpoint       (populate test data)"
echo "  3. Test all tabs in the UI"
