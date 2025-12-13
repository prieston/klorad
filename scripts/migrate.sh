#!/bin/bash

# Prisma Migration Script
# Loads .env file and runs Prisma migrations
# Usage: ./scripts/migrate.sh [dev|deploy]

set -e

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load DATABASE_URL and DIRECT_DATABASE_URL from .env file if it exists
if [ -f "$ROOT_DIR/.env" ]; then
  # Use eval to export variables from .env file (only for DATABASE_URL and DIRECT_DATABASE_URL)
  # This handles quotes and special characters properly
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue

    # Only process DATABASE_URL and DIRECT_DATABASE_URL lines
    if [[ "$line" =~ ^[[:space:]]*(DATABASE_URL|DIRECT_DATABASE_URL)[[:space:]]*= ]]; then
      # Use eval to properly handle quoted values
      eval "export $line" 2>/dev/null || true
    fi
  done < "$ROOT_DIR/.env"
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  exit 1
fi

# For migrations, use DIRECT_DATABASE_URL if available, otherwise fall back to DATABASE_URL
# DIRECT_DATABASE_URL is required when using Prisma Accelerate (for direct connection to database)
if [ -z "$DIRECT_DATABASE_URL" ]; then
  echo "Warning: DIRECT_DATABASE_URL not set, using DATABASE_URL for migrations"
  echo "Note: If using Prisma Accelerate, set DIRECT_DATABASE_URL to your direct database connection string"
  export DIRECT_DATABASE_URL="$DATABASE_URL"
fi

echo "Using DIRECT_DATABASE_URL for migrations"

# Get migration command (default to deploy)
MIGRATE_CMD="${1:-deploy}"

# Validate command
if [ "$MIGRATE_CMD" != "dev" ] && [ "$MIGRATE_CMD" != "deploy" ]; then
  echo "Error: Invalid migration command. Use 'dev' or 'deploy'"
  exit 1
fi

# Change to prisma package directory
cd "$ROOT_DIR/packages/prisma"

# Run the migration
echo "Running Prisma migration: $MIGRATE_CMD"
pnpm prisma migrate $MIGRATE_CMD

