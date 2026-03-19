#!/bin/bash
# Script to create multiple databases in PostgreSQL
# Used by Docker entrypoint to initialize databases for main app and Langfuse

set -e
set -u

function create_database() {
	local database=$1
	echo "Creating database '$database'"
	psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
	    SELECT 'CREATE DATABASE $database'
	    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$database')\gexec
EOSQL
	return 0
}

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
	echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
	IFS=',' read -r -a db_array <<< "$POSTGRES_MULTIPLE_DATABASES"
	for db in "${db_array[@]}"; do
		db="$(echo "$db" | xargs)"
		if [ -n "$db" ]; then
			create_database "$db"
		fi
	done
	echo "Multiple databases created"
fi
