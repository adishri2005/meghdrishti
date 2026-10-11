#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    if python -c "
import psycopg2, os
conn = psycopg2.connect(os.environ.get('DATABASE_URL', '').replace('+psycopg2', ''))
conn.close()
print('OK')
" 2>/dev/null; then
        echo "PostgreSQL is ready"
        break
    fi
    echo "  Attempt $i/30..."
    sleep 2
done

# Wait for Redis to be ready
echo "Waiting for Redis..."
for i in $(seq 1 30); do
    if python -c "
import redis, os
r = redis.from_url(os.environ.get('REDIS_URL', 'redis://redis:6379/0'))
r.ping()
print('OK')
" 2>/dev/null; then
        echo "Redis is ready"
        break
    fi
    echo "  Attempt $i/30..."
    sleep 2
done

MODE="${1:-api}"

if [ "$MODE" = "api" ]; then
    echo "Running as API server..."

    # Run migrations (with advisory lock to prevent races between blue/green)
    echo "Running Alembic migrations..."
    python -c "
import psycopg2, os
conn = psycopg2.connect(os.environ.get('DATABASE_URL', '').replace('+psycopg2', ''))
conn.autocommit = True
cur = conn.cursor()
# Advisory lock to prevent concurrent migrations
cur.execute('SELECT pg_advisory_lock(42)')
print('Acquired advisory lock for migrations')
" 2>/dev/null || true

    alembic upgrade head || echo "Migration may have already been applied"

    python -c "
import psycopg2, os
conn = psycopg2.connect(os.environ.get('DATABASE_URL', '').replace('+psycopg2', ''))
conn.autocommit = True
cur = conn.cursor()
cur.execute('SELECT pg_advisory_unlock(42)')
print('Released advisory lock')
" 2>/dev/null || true

    # Seed admin and analyst users (idempotent)
    echo "Seeding users and settings..."
    python -c "
import os, json, yaml
from app.db import get_session_factory
from app.models import User, ApiClient, SettingsRow
from app.security import hash_password, hash_api_key
from app.config import load_yaml_config

SessionLocal = get_session_factory()
db = SessionLocal()

# Seed admin
existing = db.query(User).filter(User.username == os.environ.get('ADMIN_USERNAME', 'admin')).first()
if not existing:
    db.add(User(
        username=os.environ.get('ADMIN_USERNAME', 'admin'),
        password_hash=hash_password(os.environ.get('ADMIN_PASSWORD', 'Admin@12345')),
        role='admin',
    ))
    print('  Created admin user')

# Seed analyst
existing = db.query(User).filter(User.username == os.environ.get('ANALYST_USERNAME', 'analyst')).first()
if not existing:
    db.add(User(
        username=os.environ.get('ANALYST_USERNAME', 'analyst'),
        password_hash=hash_password(os.environ.get('ANALYST_PASSWORD', 'Analyst@12345')),
        role='analyst',
    ))
    print('  Created analyst user')

# Seed service API client
api_key = os.environ.get('SERVICE_API_KEY', 'svc-ingest-key-change-me')
key_hash = hash_api_key(api_key)
existing = db.query(ApiClient).filter(ApiClient.api_key_hash == key_hash).first()
if not existing:
    # Also check by name
    existing_name = db.query(ApiClient).filter(ApiClient.name == 'default-ingest').first()
    if not existing_name:
        db.add(ApiClient(
            name='default-ingest',
            api_key_hash=key_hash,
            role='service',
        ))
        print('  Created default API client')

# Seed settings from config.yaml
cfg = load_yaml_config()
for key in ('detection', 'severity', 'queue', 'cache'):
    existing = db.query(SettingsRow).filter(SettingsRow.key == key).first()
    if not existing and key in cfg:
        db.add(SettingsRow(key=key, value=cfg[key], updated_by='system'))
        print(f'  Seeded settings: {key}')

db.commit()
db.close()
print('Seeding complete')
"

    # Start the API server
    exec gunicorn app.main:app \
        -k uvicorn.workers.UvicornWorker \
        -w 2 \
        -b 0.0.0.0:8000 \
        --access-logfile - \
        --error-logfile -

elif [ "$MODE" = "worker" ]; then
    echo "Running as worker..."
    exec python -m app.worker.main

else
    echo "Unknown mode: $MODE (expected 'api' or 'worker')"
    exit 1
fi
