# Deployment Guide (AWS EC2)

## Prerequisites

- AWS account with EC2 access
- Instance: **t3.small** (2 vCPU, 2 GB RAM) or larger
- OS: **Ubuntu 22.04 LTS**
- Security group: inbound on ports **22** (SSH), **80** (HTTP), **443** (HTTPS), **3000** (Grafana), **9090** (Prometheus)

## Step-by-Step

### 1. Launch EC2 Instance

- Launch a t3.small Ubuntu 22.04 instance
- Attach an EBS volume with at least 20 GB
- Configure the security group as above
- Download the SSH key pair

### 2. Connect and Bootstrap

```bash
ssh -i key.pem ubuntu@<EC2_PUBLIC_IP>
```

```bash
# Run the bootstrap script
git clone <REPO_URL> cloud-cost-anomaly-detection
cd cloud-cost-anomaly-detection
bash scripts/bootstrap_ec2.sh
```

Log out and back in for Docker group membership to take effect.

### 3. Configure Environment

```bash
cd cloud-cost-anomaly-detection
cp .env.example .env
nano .env   # Set strong passwords and JWT secret
```

### 4. Generate TLS Certificates

```bash
bash scripts/gen_certs.sh
```

### 5. Build and Start

```bash
docker compose up -d --build
```

Wait for all services to become healthy:
```bash
docker compose ps
curl -k https://localhost:8443/health
```

### 6. Seed Data

```bash
python scripts/simulate.py --base-url http://localhost:8080 seed --days 14
```

### 7. Open Grafana

Navigate to `http://<EC2_PUBLIC_IP>:3000`. Login with `admin` / the password from `.env`.

### 8. Verify

```bash
# Check all containers
docker compose ps

# Run a quick anomaly injection
python scripts/simulate.py --base-url http://localhost:8080 inject --kind spike --resource ec2-ml-gpu-07 --multiplier 12

# Check anomalies
curl -sk https://localhost:8443/api/v1/anomalies -H "Authorization: Bearer $(curl -sk -X POST https://localhost:8443/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@12345"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')"
```

## Maintenance

- **Logs**: `docker compose logs -f api-blue worker`
- **Scale workers**: `docker compose up -d --scale worker=3`
- **Update**: `git pull && bash scripts/deploy.sh <new-version>`
- **Rollback**: `bash scripts/rollback.sh`
- **Backup DB**: `docker compose exec postgres pg_dump -U ccad ccad > backup.sql`
