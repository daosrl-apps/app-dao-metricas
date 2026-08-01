FROM python:3.12-slim

# Install system dependencies (curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir xlrd

# Create a non-root user and group
RUN groupadd -g 1000 appgroup && \
    useradd -r -u 1000 -g appgroup -d /app appuser

# Copy files and change ownership
COPY --chown=appuser:appgroup . .

# Run as non-root user
USER appuser

EXPOSE 8000

# Healthcheck to verify the web server is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

CMD ["python", "server.py"]
