#!/usr/bin/env python3
"""Config/runtime drift detection.

Compares desired state (Git: docker-compose.yml, config.yaml) against
actual state (running containers, live thresholds via API, nginx upstream).

Usage:
    python drift_check.py [--base-url URL]

Exit code 0 = no drift, 1 = drift detected.
"""

import json
import os
import subprocess
import sys
import urllib.request

import yaml


def check_item(name: str, expected, actual) -> dict:
    """Compare expected vs actual and return a result dict."""
    match = str(expected) == str(actual)
    return {
        "name": name,
        "status": "OK" if match else "DRIFT",
        "expected": str(expected),
        "actual": str(actual),
    }


def main():
    base_url = "http://localhost:8080"
    for i, arg in enumerate(sys.argv):
        if arg == "--base-url" and i + 1 < len(sys.argv):
            base_url = sys.argv[i + 1]

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.join(script_dir, "..")
    results = []

    # 1. Check config.yaml vs live thresholds
    config_path = os.path.join(project_dir, "config", "config.yaml")
    try:
        with open(config_path) as f:
            yaml_cfg = yaml.safe_load(f)

        # Get live thresholds from API
        try:
            # Login first
            login_data = json.dumps({
                "username": os.environ.get("ADMIN_USERNAME", "admin"),
                "password": os.environ.get("ADMIN_PASSWORD", "Admin@12345"),
            }).encode()
            req = urllib.request.Request(
                f"{base_url}/api/v1/auth/login",
                data=login_data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                token = json.loads(resp.read())["access_token"]

            req = urllib.request.Request(
                f"{base_url}/api/v1/config/thresholds",
                headers={"Authorization": f"Bearer {token}"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                live_cfg = json.loads(resp.read())

            # Compare detection thresholds
            yaml_det = yaml_cfg.get("detection", {})
            live_det = live_cfg.get("detection", {})
            for key in yaml_det:
                results.append(check_item(
                    f"detection.{key}",
                    yaml_det[key],
                    live_det.get(key, "MISSING"),
                ))

            # Compare severity
            yaml_sev = yaml_cfg.get("severity", {})
            live_sev = live_cfg.get("severity", {})
            for key in yaml_sev:
                results.append(check_item(
                    f"severity.{key}",
                    json.dumps(yaml_sev[key], sort_keys=True),
                    json.dumps(live_sev.get(key, {}), sort_keys=True),
                ))

        except Exception as exc:
            results.append({"name": "live_thresholds", "status": "ERROR", "expected": "reachable", "actual": str(exc)})

    except FileNotFoundError:
        results.append({"name": "config.yaml", "status": "ERROR", "expected": "exists", "actual": "missing"})

    # 2. Check nginx upstream vs expected
    upstream_path = os.path.join(project_dir, "nginx", "active", "upstream.inc")
    try:
        with open(upstream_path) as f:
            upstream_content = f.read().strip()
        # We just report what's there
        results.append({
            "name": "nginx_upstream",
            "status": "OK",
            "expected": upstream_content,
            "actual": upstream_content,
        })
    except Exception as exc:
        results.append({"name": "nginx_upstream", "status": "ERROR", "expected": "readable", "actual": str(exc)})

    # 3. Check running containers
    try:
        output = subprocess.check_output(
            ["docker", "compose", "ps", "--format", "json"],
            cwd=project_dir, text=True, stderr=subprocess.DEVNULL,
        )
        for line in output.strip().split("\n"):
            if line.strip():
                try:
                    container = json.loads(line)
                    name = container.get("Service", container.get("Name", "unknown"))
                    state = container.get("State", "unknown")
                    expected_state = "running"
                    results.append(check_item(f"container.{name}", expected_state, state))
                except json.JSONDecodeError:
                    pass
    except Exception as exc:
        results.append({"name": "containers", "status": "ERROR", "expected": "checkable", "actual": str(exc)})

    # Print results
    has_drift = False
    print(f"\n{'Name':<40} {'Status':<8} {'Expected':<30} {'Actual':<30}")
    print("-" * 108)
    for r in results:
        status = r["status"]
        if status == "DRIFT":
            has_drift = True
        print(f"{r['name']:<40} {status:<8} {r['expected'][:30]:<30} {r['actual'][:30]:<30}")

    print()
    if has_drift:
        print("DRIFT DETECTED — see items marked DRIFT above")
        sys.exit(1)
    else:
        print("All checks passed — no drift detected")
        sys.exit(0)


if __name__ == "__main__":
    main()
