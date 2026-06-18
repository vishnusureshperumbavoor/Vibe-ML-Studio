#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

# Create and activate virtual environment
if [ ! -d venv ]; then
  python3 -m venv venv
fi
source venv/bin/activate

# Install dependencies
python -m pip install --upgrade pip "setuptools<82" wheel
python -m pip install --prefer-binary --upgrade --upgrade-strategy eager -r requirements.txt

# diffusers requires peft>=0.17.0; repair older envs proactively.
if ! python -c "import importlib.metadata as m; from packaging.version import Version; import sys; sys.exit(0 if Version(m.version('peft')) >= Version('0.17.0') else 1)"; then
  echo "Detected incompatible peft version; upgrading to >=0.17.1"
  python -m pip install --upgrade "peft>=0.17.1,<1.0"
fi

# Run the server
python main.py
