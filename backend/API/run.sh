#!/bin/bash
# Knowledge Robot backend entrypoint.
# Reads gunicorn tuning from environment variables with sensible defaults.
set -euo pipefail

exec gunicorn \
  --workers "${KNOWLEDGE_ROBOT_WORKERS:-1}" \
  --threads "${KNOWLEDGE_ROBOT_THREADS:-16}" \
  --timeout "${KNOWLEDGE_ROBOT_TIMEOUT:-600}" \
  --bind "${KNOWLEDGE_ROBOT_BINDING_ADDRESS:-0.0.0.0:8080}" \
  api:app
