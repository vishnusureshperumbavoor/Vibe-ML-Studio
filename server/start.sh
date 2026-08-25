#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

DO_INSTALL=false

for arg in "$@"; do
  case "$arg" in
    --install)
      DO_INSTALL=true
      ;;
  esac
done

# Create virtual environment if it does not exist
if [ ! -d venv ]; then
  echo "==> Creating virtual environment at $(pwd)/venv..."
  python3 -m venv venv
else
  echo "==> Existing virtual environment found at $(pwd)/venv"
fi

# Activate virtual environment
source venv/bin/activate
echo "==> Using Python: $(which python)"

# Install dependencies only when --install is passed
if [ "$DO_INSTALL" = true ]; then
  echo "==> Installing dependencies..."
  python -m pip install --upgrade pip "setuptools<82" wheel
  python -m pip install --prefer-binary --upgrade --upgrade-strategy eager -r requirements.txt

  # diffusers requires peft>=0.17.0; repair older envs proactively.
  if ! python -c "import importlib.metadata as m; from packaging.version import Version; import sys; sys.exit(0 if Version(m.version('peft')) >= Version('0.17.0') else 1)"; then
    echo "==> Detected incompatible peft version; upgrading to >=0.17.1"
    python -m pip install --upgrade "peft>=0.17.1,<1.0"
  fi
fi

# Run the server
echo "==> Starting backend server..."
python main.py
