#!/usr/bin/env python3
"""Export the OpenAPI spec to docs/openapi.json."""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app

spec = app.openapi()
output_path = os.path.join(os.path.dirname(__file__), "..", "docs", "openapi.json")
os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(output_path, "w") as f:
    json.dump(spec, f, indent=2)

print(f"OpenAPI spec written to {output_path}")
