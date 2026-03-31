#!/bin/bash

echo "======================================"
echo "   FLUX DEMO ENVIRONMENT RESET        "
echo "======================================"

echo "[1/4] Flushing Redis Queues..."
redis-cli flushall || echo "WARNING: redis-cli not found or failed. Please flush Redis manually if needed."

echo "[2/4] Clearing Postgres 'jobs' table..."
# Uses the standard postgres credentials, adjust if using a different DB/User
psql -U postgres -d postgres -c "TRUNCATE TABLE jobs RESTART IDENTITY CASCADE;" || echo "WARNING: psql not found or failed. Please clear the jobs table manually."

echo "[3/4] Removing orphaned Toxiproxy and k6 containers..."
# Removes matching docker containers safely
docker ps -a -q --filter="name=toxiproxy" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null
docker ps -a -q --filter="name=k6-worker" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null

echo "[4/4] Demo reset complete! 🎉"
echo "You are now ready to run the next end-to-end hackathon demo."
echo "======================================"
