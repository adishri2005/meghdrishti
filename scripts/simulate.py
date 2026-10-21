#!/usr/bin/env python3
"""CLI client: seed history, stream load, inject anomalies.

Sub-commands:
    seed    --days 14       Post 14 days of history as backfill
    stream  --rate 200 --duration 60   Send batches at steady rate
    inject  --kind spike --resource ec2-ml-gpu-07 --multiplier 12

All commands read --base-url, --api-key or --username/--password,
with defaults from environment variables.
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx


def get_defaults():
    return {
        "base_url": os.environ.get("BASE_URL", "http://localhost:8080"),
        "api_key": os.environ.get("SERVICE_API_KEY", "svc-ingest-key-change-me"),
        "username": os.environ.get("ADMIN_USERNAME", "admin"),
        "password": os.environ.get("ADMIN_PASSWORD", "Admin@12345"),
    }


def get_token(client: httpx.Client, base_url: str, username: str, password: str) -> str:
    resp = client.post(f"{base_url}/api/v1/auth/login",
                       json={"username": username, "password": password})
    resp.raise_for_status()
    return resp.json()["access_token"]


def cmd_seed(args):
    """Seed the system with N days of historical data (backfill)."""
    defaults = get_defaults()
    base_url = args.base_url or defaults["base_url"]
    days = args.days

    print(f"Seeding {days} days of history to {base_url}...")

    with httpx.Client(timeout=60, verify=False) as client:
        token = get_token(client, base_url, args.username or defaults["username"],
                          args.password or defaults["password"])
        headers = {"Authorization": f"Bearer {token}"}

        # Use simulate endpoint for each day
        start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0) - timedelta(days=days)
        hours_total = days * 24
        batch_hours = 24  # one day at a time

        job_ids = []
        for day_offset in range(0, hours_total, batch_hours):
            day_start = start + timedelta(hours=day_offset)
            hours = min(batch_hours, hours_total - day_offset)

            resp = client.post(f"{base_url}/api/v1/admin/simulate", headers=headers,
                               json={"start_time": day_start.isoformat(), "hours": hours,
                                     "backfill": True})
            if resp.status_code == 202:
                data = resp.json()
                job_ids.extend(data.get("job_ids", []))
                print(f"  Day {day_offset // 24 + 1}/{days}: {data.get('records_generated', 0)} records")
            else:
                print(f"  ERROR: {resp.status_code} {resp.text}")

        # Wait for jobs to complete
        print("Waiting for processing to complete...")
        for attempt in range(120):
            all_done = True
            for jid in job_ids[-5:]:  # check last few
                resp = client.get(f"{base_url}/api/v1/records/jobs/{jid}", headers=headers)
                if resp.status_code == 200:
                    status = resp.json().get("status", "")
                    if status not in ("done", "failed"):
                        all_done = False
                        break
            if all_done:
                break
            time.sleep(2)

        print(f"Seeding complete: {len(job_ids)} jobs submitted")


def cmd_stream(args):
    """Send records at a steady rate for load testing."""
    defaults = get_defaults()
    base_url = args.base_url or defaults["base_url"]
    api_key = args.api_key or defaults["api_key"]
    rate = args.rate
    duration = args.duration

    print(f"Streaming ~{rate} records/s for {duration}s to {base_url}...")

    # Import generator locally
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from app.simulator.generator import generate_hours
    from app.simulator.catalog import CATALOG

    total_sent = 0
    batch_size = min(rate, 500)
    start_time = time.time()

    with httpx.Client(timeout=30, verify=False) as client:
        headers = {"X-API-Key": api_key}
        ts = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

        while time.time() - start_time < duration:
            records, _ = generate_hours(ts, 1, seed=int(time.time() * 1000) % 100000)
            batch = records[:batch_size]

            resp = client.post(f"{base_url}/api/v1/records/batch", headers=headers,
                               json={"records": batch, "backfill": False})
            if resp.status_code == 202:
                total_sent += len(batch)
            else:
                print(f"  Error: {resp.status_code}")

            # Pace to hit target rate
            elapsed = time.time() - start_time
            expected = elapsed * rate
            if total_sent > expected:
                time.sleep(0.1)

            ts += timedelta(hours=1)

    print(f"Sent {total_sent} records in {duration}s")

    # Write count file for failure experiment
    count_file = os.path.join(os.path.dirname(__file__), "..", "results", "stream_count.txt")
    os.makedirs(os.path.dirname(count_file), exist_ok=True)
    with open(count_file, "w") as f:
        f.write(str(total_sent))


def cmd_inject(args):
    """Inject a specific anomaly via the admin/simulate endpoint."""
    defaults = get_defaults()
    base_url = args.base_url or defaults["base_url"]

    with httpx.Client(timeout=30, verify=False) as client:
        token = get_token(client, base_url, args.username or defaults["username"],
                          args.password or defaults["password"])
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.post(f"{base_url}/api/v1/admin/simulate", headers=headers,
                           json={
                               "hours": args.hours,
                               "inject": args.kind,
                               "resource_id": args.resource,
                               "multiplier": args.multiplier,
                               "backfill": False,
                           })
        if resp.status_code == 202:
            data = resp.json()
            print(f"Injection: {json.dumps(data, indent=2)}")
        else:
            print(f"ERROR: {resp.status_code} {resp.text}")


def main():
    parser = argparse.ArgumentParser(description="Meghdrishti Simulation Client")
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--api-key", default=None)
    parser.add_argument("--username", default=None)
    parser.add_argument("--password", default=None)

    sub = parser.add_subparsers(dest="command")

    seed_p = sub.add_parser("seed", help="Seed historical data")
    seed_p.add_argument("--days", type=int, default=14)

    stream_p = sub.add_parser("stream", help="Stream records at a steady rate")
    stream_p.add_argument("--rate", type=int, default=200)
    stream_p.add_argument("--duration", type=int, default=60)

    inject_p = sub.add_parser("inject", help="Inject an anomaly")
    inject_p.add_argument("--kind", choices=["spike", "drift", "new_resource"], required=True)
    inject_p.add_argument("--resource", default=None)
    inject_p.add_argument("--multiplier", type=float, default=10.0)
    inject_p.add_argument("--hours", type=int, default=1)

    args = parser.parse_args()

    if args.command == "seed":
        cmd_seed(args)
    elif args.command == "stream":
        cmd_stream(args)
    elif args.command == "inject":
        cmd_inject(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
