"""
Locust load test file for CCAD.

Task weights: 70% reads, 30% writes to simulate realistic traffic.
Each user logs in once, then performs weighted tasks.
"""

import os
import random

from locust import HttpUser, between, task


RESOURCES = [
    "ec2-ml-gpu-01", "ec2-ml-gpu-02", "rds-main-01", "s3-bucket-01",
    "lambda-fn-01", "dt-link-01", "ebs-vol-01", "ec2-web-03",
]
GROUP_BY_OPTIONS = ["service", "region", "team", "resource_type"]


class CCADUser(HttpUser):
    """Simulated user making API requests to the CCAD system."""

    wait_time = between(0.5, 2)
    host = os.environ.get("TARGET_URL", "https://localhost:8443")

    def on_start(self):
        """Login once per user session."""
        self.token = None
        self.api_key = os.environ.get("SERVICE_API_KEY", "svc-ingest-key-change-me")

        # Admin login for read endpoints
        resp = self.client.post(
            "/api/v1/auth/login",
            json={
                "username": os.environ.get("ADMIN_USERNAME", "admin"),
                "password": os.environ.get("ADMIN_PASSWORD", "Admin@12345"),
            },
            verify=False,
        )
        if resp.status_code == 200:
            self.token = resp.json().get("access_token")

    def _auth_headers(self):
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}

    @task(25)
    def get_anomalies(self):
        """GET /api/v1/anomalies — most common read operation."""
        self.client.get(
            "/api/v1/anomalies?limit=20",
            headers=self._auth_headers(),
            verify=False,
            name="/api/v1/anomalies",
        )

    @task(25)
    def get_cost_summary(self):
        """GET /api/v1/costs/summary — exercises the cache."""
        group_by = random.choice(GROUP_BY_OPTIONS)
        self.client.get(
            f"/api/v1/costs/summary?group_by={group_by}",
            headers=self._auth_headers(),
            verify=False,
            name="/api/v1/costs/summary",
        )

    @task(20)
    def get_resource_costs(self):
        """GET /api/v1/costs/resources/{id}/costs — per-resource history."""
        resource = random.choice(RESOURCES)
        self.client.get(
            f"/api/v1/costs/resources/{resource}/costs?hours=24",
            headers=self._auth_headers(),
            verify=False,
            name="/api/v1/costs/resources/[id]/costs",
        )

    @task(30)
    def post_records(self):
        """POST /api/v1/records/batch — write path using API key."""
        records = []
        for _ in range(20):
            resource = random.choice(RESOURCES)
            records.append({
                "resource_id": resource,
                "type": "EC2",
                "service": "EC2",
                "region": "us-east-1",
                "team_tag": "web",
                "timestamp": "2026-10-11T14:00:00Z",
                "usage_quantity": round(random.uniform(1, 100), 2),
                "unit_cost": 0.05,
                "cost": round(random.uniform(0.5, 5.0), 4),
            })

        self.client.post(
            "/api/v1/records/batch",
            json={"records": records, "backfill": False},
            headers={"X-API-Key": self.api_key},
            verify=False,
            name="/api/v1/records/batch",
        )
