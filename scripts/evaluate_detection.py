#!/usr/bin/env python3
"""Evaluate detection quality: precision, recall, F1, false-positive rate.

Injects labelled anomalies, waits for processing, then compares
ground_truth_anomalies to detected anomalies.

Usage:
    python evaluate_detection.py [--base-url URL]
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx


def main():
    base_url = os.environ.get("BASE_URL", "http://localhost:8080")
    for i, arg in enumerate(sys.argv):
        if arg == "--base-url" and i + 1 < len(sys.argv):
            base_url = sys.argv[i + 1]

    results_dir = os.path.join(os.path.dirname(__file__), "..", "results")
    os.makedirs(results_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    with httpx.Client(timeout=30, verify=False) as client:
        # Login
        resp = client.post(f"{base_url}/api/v1/auth/login",
                           json={"username": os.environ.get("ADMIN_USERNAME", "admin"),
                                 "password": os.environ.get("ADMIN_PASSWORD", "Admin@12345")})
        resp.raise_for_status()
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Inject test set
        injections = [
            {"inject": "spike", "resource_id": "ec2-ml-gpu-01", "multiplier": 12, "hours": 1},
            {"inject": "spike", "resource_id": "rds-main-01", "multiplier": 8, "hours": 1},
            {"inject": "spike", "resource_id": "s3-bucket-01", "multiplier": 15, "hours": 1},
            {"inject": "drift", "resource_id": "ec2-ml-gpu-02", "hours": 12},
            {"inject": "drift", "resource_id": "lambda-fn-01", "hours": 12},
            {"inject": "new_resource", "hours": 2},
        ]

        print("Injecting test anomalies...")
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        gt_entries = []

        for i, inj in enumerate(injections):
            start_time = now + timedelta(hours=i * 24)  # spread out
            body = {
                "start_time": start_time.isoformat(),
                "hours": inj["hours"],
                "inject": inj["inject"],
                "resource_id": inj.get("resource_id"),
                "multiplier": inj.get("multiplier", 10),
                "backfill": False,
            }
            resp = client.post(f"{base_url}/api/v1/admin/simulate", headers=headers, json=body)
            if resp.status_code == 202:
                data = resp.json()
                print(f"  Injected {inj['inject']}: {data.get('records_generated', 0)} records")
                gt_entries.append({
                    "inject": inj["inject"],
                    "resource_id": inj.get("resource_id", "ec2-rogue-99"),
                    "start": start_time,
                    "end": start_time + timedelta(hours=inj["hours"]),
                })
            else:
                print(f"  Error: {resp.status_code} {resp.text}")

        # Wait for queue to drain
        print("Waiting for queue to drain...")
        for attempt in range(60):
            time.sleep(3)
            try:
                resp = client.get(f"{base_url}/api/v1/anomalies?limit=1", headers=headers)
                # Also check if we can query (basic connectivity)
                if resp.status_code == 200:
                    break
            except Exception:
                pass

        time.sleep(10)  # Extra time for detection

        # Fetch detected anomalies
        resp = client.get(f"{base_url}/api/v1/anomalies?limit=500", headers=headers)
        resp.raise_for_status()
        anomalies = resp.json()

        # Match ground truth to detected
        true_positives = 0
        false_negatives = 0
        matched_anomaly_ids = set()

        for gt in gt_entries:
            detected = False
            for anom in anomalies:
                if anom["id"] in matched_anomaly_ids:
                    continue
                res_name = anom.get("resource_name", "")
                record_ts = datetime.fromisoformat(anom["record_ts"].replace("Z", "+00:00")) if anom.get("record_ts") else None

                # Match: same resource, record_ts within [start, end + 1h]
                resource_match = (
                    res_name == gt["resource_id"] or
                    (gt["inject"] == "new_resource" and "rogue" in (res_name or ""))
                )
                time_match = record_ts and gt["start"] <= record_ts <= gt["end"] + timedelta(hours=1) if record_ts else False

                if resource_match and time_match:
                    true_positives += 1
                    matched_anomaly_ids.add(anom["id"])
                    detected = True
                    break

            if not detected:
                false_negatives += 1
                print(f"  MISSED: {gt['inject']} on {gt['resource_id']}")

        false_positives = len([a for a in anomalies if a["id"] not in matched_anomaly_ids and a["scope"] == "resource"])
        total_gt = len(gt_entries)

        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
        recall = true_positives / total_gt if total_gt > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        fpr = false_positives / max(len(anomalies), 1)

        # Write report
        report = f"""# Detection Quality Evaluation

- **Timestamp**: {datetime.now().isoformat()}
- **Ground truth entries**: {total_gt}
- **Detected anomalies**: {len(anomalies)}

## Results

| Metric | Value |
|--------|-------|
| True Positives | {true_positives} |
| False Negatives | {false_negatives} |
| False Positives | {false_positives} |
| Precision | {precision:.3f} |
| Recall | {recall:.3f} |
| F1 Score | {f1:.3f} |
| False Positive Rate | {fpr:.3f} |

## Target: Recall >= 0.9, Precision >= 0.8
- Recall target met: **{"Yes" if recall >= 0.9 else "No"}**
- Precision target met: **{"Yes" if precision >= 0.8 else "No"}**
"""

        report_path = os.path.join(results_dir, f"detection_eval_{ts}.md")
        with open(report_path, "w") as f:
            f.write(report)

        print(f"\n=== Detection Quality ===")
        print(f"Precision: {precision:.3f}  Recall: {recall:.3f}  F1: {f1:.3f}")
        print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
