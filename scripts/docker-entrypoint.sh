#!/bin/sh
set -e

# ==============================================================================
# Miles Admin Hub API - Docker Production Entrypoint
# ==============================================================================

echo "🌟 [Miles Admin API] Container startup initiated..."

# Check whether automatic database migrations should run
RUN_MIGRATIONS=${RUN_MIGRATIONS:-true}

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "🚀 [Miles Admin API] Running database migrations with retry mechanism..."
  MAX_RETRIES=10
  RETRY_INTERVAL=4
  COUNT=0

  until npx prisma migrate deploy; do
    COUNT=$((COUNT + 1))
    if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
      echo "❌ [Miles Admin API] FATAL: Database migration failed after $MAX_RETRIES attempts. Aborting startup." >&2
      exit 1
    fi
    echo "⏳ [Miles Admin API] Database server not ready yet. Retrying in ${RETRY_INTERVAL}s (Attempt $COUNT/$MAX_RETRIES)..."
    sleep "$RETRY_INTERVAL"
  done

  echo "✅ [Miles Admin API] Database migrations executed successfully."
else
  echo "ℹ️  [Miles Admin API] RUN_MIGRATIONS is '$RUN_MIGRATIONS'. Skipping startup migrations."
fi

echo "🚀 [Miles Admin API] Launching application process: $@"
exec "$@"
