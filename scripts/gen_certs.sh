#!/bin/bash
# Generate self-signed TLS certificates for Nginx
set -e
CERT_DIR="$(dirname "$0")/../nginx/certs"
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -subj "/CN=localhost/O=CCAD/C=US"

echo "Certificates generated in $CERT_DIR"
