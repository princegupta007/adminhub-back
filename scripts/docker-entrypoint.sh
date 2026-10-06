#!/bin/sh
set -e

# ==============================================================================
# Miles Admin Hub API - Docker Production Entrypoint
# ==============================================================================

echo "🌟 [Miles Admin API] Container startup initiated..."

# Check whether automatic database migrations should run
RUN_MIGRATIONS=${RUN_MIGRATIONS:-true}

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "🚀 [Miles Admin API] Running pending database migrations (prisma migrate deploy)..."
  if npx prisma migrate deploy; then
    echo "✅ [Miles Admin API] Database migrations executed successfully."
  else
    echo "❌ [Miles Admin API] FATAL: Database migration failed. Aborting container startup." >&2
    exit 1
  fi
else
  echo "ℹ️  [Miles Admin API] RUN_MIGRATIONS is not 'true'. Skipping automatic migrations."
fi

echo "🚀 [Miles Admin API] Launching application process: $@"
exec "$@"
