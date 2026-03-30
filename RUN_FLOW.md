# FLUX Running Flow (Local Testing)

Last updated: 2026-03-31

## 1. Prerequisites

1. Node.js 20+
2. npm
3. Docker Desktop running
4. Git
5. Optional for webhook tests: ngrok

Quick checks:

1. node --version
2. npm --version
3. docker --version
4. docker compose version

If docker command fails in VS Code PowerShell but works in system terminal, use full path:

1. "C:\Program Files\Docker\Docker\resources\bin\docker.exe" --version
2. "C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose version

## 2. Project Setup

From repo root:

1. npm install
2. cd flux-ui
3. npm install
4. cd ..

Create .env from .env.example and fill required values.

Minimum required for local run:

1. DATABASE_URL
2. REDIS_URL
3. PORT
4. APP_TARGET_PORT
5. OLLAMA_URL
6. OLLAMA_MODEL

Required only for GitHub App flow:

1. GITHUB_APP_ID
2. GITHUB_PRIVATE_KEY_PATH
3. GITHUB_WEBHOOK_SECRET

## 3. Start Infrastructure

From repo root:

1. docker compose up -d
2. docker compose ps

Expected services:

1. redis
2. postgres
3. ollama

Optional: preload model in ollama container

1. docker exec flux-ollama ollama pull qwen3:8b

## 4. Start Application Processes

Open 3 terminals from repo root.

Terminal A (API server):

1. npm run dev

Terminal B (worker):

1. npm run worker

Terminal C (frontend):

1. cd flux-ui
2. npm run dev

## 5. Health and Smoke Validation

API health:

1. curl http://localhost:3000/api/health

Expected response:

1. status should be ok

Frontend:

1. Open the URL printed by Vite (usually http://localhost:5173)
2. Dashboard should load without console errors

Worker readiness:

1. Worker terminal should print readiness log
2. No repeated redis/db connection errors

## 6. Optional GitHub Webhook Test Flow

1. Start ngrok: ngrok http 3000
2. Set GitHub App webhook URL to: https://<your-ngrok-domain>/webhooks/github
3. Open or update a PR in test repository
4. Validate:
   a. webhook delivery returns accepted response
   b. job appears in jobs API and dashboard
   c. worker stages progress to completion
   d. GitHub check run and comment are posted

## 7. Useful Verification Commands

From repo root:

1. npm --prefix flux-ui run lint
2. npm --prefix flux-ui run build
3. node --check server/index.js
4. node --check server/webhook.js
5. node --check worker/runner.js
6. npm audit --omit=dev --json

## 8. Stop and Cleanup

1. Stop app processes in terminals with Ctrl+C
2. docker compose down

Optional full cleanup:

1. docker compose down -v

## 9. Troubleshooting

Docker not found in VS Code terminal:

1. Restart VS Code after Docker installation
2. Use full docker path shown above

Database connection refused:

1. Confirm docker compose ps shows postgres healthy
2. Verify DATABASE_URL in .env

Worker cannot run load tests:

1. Confirm docker daemon is running
2. Confirm k6 files exist in k6 folder
3. Confirm APP_TARGET_PORT points to target app

Webhook 401 invalid signature:

1. Verify GITHUB_WEBHOOK_SECRET matches GitHub App setting

## 10. Go/No-Go for Testing

Go when all are true:

1. docker compose services are up
2. api health endpoint is ok
3. frontend loads
4. worker process is running without repeated failures
5. lint and build pass

No-Go when any are true:

1. postgres/redis unavailable
2. api health fails
3. worker cannot start
4. frontend build fails
