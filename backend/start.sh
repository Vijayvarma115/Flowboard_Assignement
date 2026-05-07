#!/bin/sh
set -e

# Wait for DATABASE_URL to be available (optional)
# You can use a small loop here to retry, but keep it simple for Railway

echo "Running migrations..."
npx prisma migrate deploy

# Run seed if required
if [ "$RAILWAY_ENV" = "production" ] || [ -n "$FORCE_SEED" ]; then
  echo "Running seed script..."
  npx tsx prisma/seed.ts || true
fi

# Start server
echo "Starting server..."
node server.js
