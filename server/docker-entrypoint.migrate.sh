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

if [ -n "${DB_HOST:-}" ] && [ -n "${DB_PORT:-}" ]; then
  DB_CONNECT_TIMEOUT_SECONDS="${DB_CONNECT_TIMEOUT_SECONDS:-90}"
  case "${DB_CONNECT_TIMEOUT_SECONDS}" in
    *[!0-9]*|'') echo "ERROR: DB_CONNECT_TIMEOUT_SECONDS must be a positive integer"; exit 1 ;;
  esac

  if [ "${DB_CONNECT_TIMEOUT_SECONDS}" -lt 1 ]; then
    echo "ERROR: DB_CONNECT_TIMEOUT_SECONDS must be a positive integer"
    exit 1
  fi

  started_at="$(date +%s)"
  echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
  until bun -e '
    import net from "node:net";
    const socket = net.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) });
    const fail = () => process.exit(1);
    socket.setTimeout(2000);
    socket.once("connect", () => { socket.end(); process.exit(0); });
    socket.once("error", fail);
    socket.once("timeout", () => { socket.destroy(); fail(); });
  '; do
    elapsed="$(( $(date +%s) - started_at ))"
    if [ "${elapsed}" -ge "${DB_CONNECT_TIMEOUT_SECONDS}" ]; then
      echo "ERROR: PostgreSQL did not accept connections within ${DB_CONNECT_TIMEOUT_SECONDS}s"
      exit 1
    fi
    sleep 2
  done
  echo "PostgreSQL is accepting connections."
fi

exec "$@"
