#!/usr/bin/env python3
"""Query Prometheus HTTP API and print the result as JSON.

Usage:
    python prom_query.py '<promql>'
    python prom_query.py '<promql>' --url http://localhost:9090

Used by deploy.sh and failure_experiment.sh to capture metrics snapshots.
"""

import json
import sys
import urllib.request
import urllib.parse


def query_prometheus(promql: str, url: str = "http://localhost:9090") -> dict:
    """Execute an instant query against Prometheus."""
    endpoint = f"{url}/api/v1/query"
    params = urllib.parse.urlencode({"query": promql})
    full_url = f"{endpoint}?{params}"

    try:
        req = urllib.request.Request(full_url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            if data.get("status") == "success":
                results = data.get("data", {}).get("result", [])
                if results:
                    value = results[0].get("value", [None, "0"])[1]
                    return {"query": promql, "value": value, "raw": results}
                return {"query": promql, "value": "0", "raw": []}
            return {"query": promql, "error": data.get("error", "unknown")}
    except Exception as exc:
        return {"query": promql, "error": str(exc), "value": "0"}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: prom_query.py '<promql>' [--url URL]", file=sys.stderr)
        sys.exit(1)

    promql = sys.argv[1]
    url = "http://localhost:9090"
    if "--url" in sys.argv:
        idx = sys.argv.index("--url")
        url = sys.argv[idx + 1]

    result = query_prometheus(promql, url)
    print(json.dumps(result, indent=2))
