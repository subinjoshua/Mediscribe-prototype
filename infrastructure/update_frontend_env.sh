#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# MediScribe — Update Frontend Environment
# Writes the API Gateway URL to frontend/.env so the React app
# calls the deployed backend instead of localhost.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ENV_FILE="$FRONTEND_DIR/.env"

# ── Argument handling ─────────────────────────────────────────
if [ $# -ge 1 ]; then
    API_URL="$1"
else
    echo "Usage: $0 <API_GATEWAY_URL>"
    echo ""
    echo "Example:"
    echo "  $0 https://abc123.execute-api.us-east-1.amazonaws.com/Prod/"
    echo ""
    echo "This writes VITE_API_URL to frontend/.env so the React app"
    echo "calls the deployed API instead of localhost:3000."
    exit 1
fi

# ── Strip trailing slash ──────────────────────────────────────
# SAM output includes a trailing slash (/Prod/) but api.js builds
# URLs like ${base}/process-photo — double slash would break routing.
API_URL="${API_URL%/}"

# ── Write .env file ──────────────────────────────────────────
echo "VITE_API_URL=$API_URL" > "$ENV_FILE"

echo "Frontend environment updated:"
echo "  File: $ENV_FILE"
echo "  VITE_API_URL=$API_URL"
echo ""
echo "Restart the Vite dev server (npm run dev) or rebuild (npm run build) for changes to take effect."
