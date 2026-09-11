#!/usr/bin/env bash
# DocIntel AI / Googi Platform Bootstrap Script (Bash)
# Usage: ./scripts/bootstrap.sh

set -euo pipefail

echo "================================================="
echo " DocIntel AI Platform Bootstrap & Verification"
echo "================================================="

# 1. Check Python
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    echo "[!] Error: Python 3.11+ is required but not found in PATH." >&2
    exit 1
fi
echo "[✓] Python found: $($PYTHON_CMD --version)"

# 2. Check Node & NPM
if command -v npm >/dev/null 2>&1; then
    echo "[✓] NPM found: $(npm --version)"
else
    echo "[!] Error: NPM is required for frontend build." >&2
    exit 1
fi

# 3. Setup Backend Environment
echo ""
echo "--> Setting up Backend Virtual Environment..."
if [ ! -d ".venv" ]; then
    $PYTHON_CMD -m venv .venv
    echo "[✓] Created .venv"
fi

source .venv/bin/activate || source .venv/Scripts/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# 4. Setup Frontend Environment
echo ""
echo "--> Setting up Frontend Dependencies..."
cd frontend
npm ci
cd ..

echo ""
echo "================================================="
echo " DocIntel Platform Bootstrapped Successfully!"
echo "================================================="
