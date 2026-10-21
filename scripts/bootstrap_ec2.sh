#!/bin/bash
# Bootstrap a fresh Ubuntu EC2 instance for Meghdrishti
set -e

echo "=== Meghdrishti EC2 Bootstrap ==="

# Update system
sudo apt-get update
sudo apt-get install -y git make openssl curl jq

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose (v2 is included with Docker Engine)
docker compose version

echo ""
echo "=== Bootstrap complete ==="
echo "Next steps:"
echo "  1. Log out and back in (for docker group)"
echo "  2. Clone the repo: git clone <repo_url>"
echo "  3. cd cloud-cost-anomaly-detection"
echo "  4. cp .env.example .env && nano .env"
echo "  5. bash scripts/gen_certs.sh"
echo "  6. docker compose up -d --build"
echo "  7. make seed"
