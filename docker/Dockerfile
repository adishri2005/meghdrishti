FROM python:3.14-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash appuser

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
COPY config/ config/
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create log directory
RUN mkdir -p /var/log/app && chown appuser:appuser /var/log/app

# Build arg for version tagging
ARG APP_VERSION=1.0.0
ENV APP_VERSION=$APP_VERSION

# Health check for the API container
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=30s \
    CMD curl -f http://localhost:8000/health || exit 1

# Switch to non-root
USER appuser

EXPOSE 8000 8001

# Default command runs the API server
ENTRYPOINT ["/entrypoint.sh"]
CMD ["api"]
