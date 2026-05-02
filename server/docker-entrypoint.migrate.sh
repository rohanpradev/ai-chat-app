#!/bin/sh
set -eu

if [ -z "${DB_URL:-}" ] && [ -z "${DATABASE_URL:-}" ]; then
  if [ -z "${DB_HOST:-}" ]; then echo "ERROR: DB_HOST environment variable is required"; exit 1; fi
  if [ -z "${DB_PORT:-}" ]; then echo "ERROR: DB_PORT environment variable is required"; exit 1; fi
  if [ -z "${DB_NAME:-}" ]; then echo "ERROR: DB_NAME environment variable is required"; exit 1; fi
  if [ -z "${DB_USER:-}" ]; then echo "ERROR: DB_USER environment variable is required"; exit 1; fi
  if [ -z "${DB_PASSWORD:-}" ]; then echo "ERROR: DB_PASSWORD environment variable is required"; exit 1; fi

  export DB_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

exec "$@"
