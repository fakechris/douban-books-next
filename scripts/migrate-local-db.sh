#!/bin/sh
set -eu

DB_NAME="${PGDATABASE:-weread_douban_migration}"
SQL_DIR="apps/api/sql"

if command -v psql >/dev/null 2>&1; then
  PSQL_BIN="psql"
elif [ -x /opt/homebrew/Cellar/libpq/17.4/bin/psql ]; then
  PSQL_BIN="/opt/homebrew/Cellar/libpq/17.4/bin/psql"
elif [ -x /opt/homebrew/Cellar/postgresql@15/15.12_1/bin/psql ]; then
  PSQL_BIN="/opt/homebrew/Cellar/postgresql@15/15.12_1/bin/psql"
else
  echo "psql not found. Set PATH or install libpq/postgresql." >&2
  exit 127
fi

for file in "$SQL_DIR"/*.sql; do
  "$PSQL_BIN" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$file"
done
