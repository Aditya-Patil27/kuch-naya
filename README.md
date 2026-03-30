# FLUX Hackathon Setup

Local-first PR chaos reviewer with deterministic PASS/WARN/BLOCK checks.

## Overview
FLUX listens to GitHub pull request webhooks, runs baseline + chaos performance checks, computes verdicts from measured metrics, and publishes:

1. GitHub check run (`flux/chaos-review`)
2. GitHub PR comment with findings
3. Live dashboard events over WebSocket

Current repo layout:

```text
server/           Express API + webhook + GitHub integration + WS
worker/           Bull queue processor + k6 + Toxiproxy + AI analyzer
k6/               baseline and chaos scripts
db/               Postgres init schema
flux-ui/          React dashboard
docker-compose.yml
package.json
```

## Prerequisites

1. Node.js 20+
2. Docker Desktop running
3. ngrok
4. Ollama installed
5. Git

Verify:

```bash
node --version
docker --version
docker compose version
ngrok version
ollama --version
```

Model pre-pull:

```bash
ollama pull qwen3:8b
```

For RTX 3050 6GB, `qwen3:8b` is usable but can be slow on long prompts. Keep fallback enabled (`AI_PROVIDER=auto`).

## Install

```bash
npm install
cd flux-ui && npm install && cd ..
```

## Environment

Create `.env` at repo root from `.env.example` and fill values:

```bash
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY_PATH=./private-key.pem
GITHUB_WEBHOOK_SECRET=
API_KEY=

POSTGRES_USER=flux
POSTGRES_PASSWORD=flux_local_only_change_me
POSTGRES_DB=flux
DATABASE_URL=postgres://flux:flux_local_only_change_me@localhost:5432/flux
REDIS_URL=redis://localhost:6379
PORT=3000
APP_TARGET_PORT=3001
APP_TARGET_HOST=host.docker.internal
APP_TARGET_BASE_URL=

JOB_MAX_ATTEMPTS=3
JOB_RETRY_DELAY_MS=5000
DIFF_FETCH_TIMEOUT_MS=15000

K6_VUS=50
K6_DURATION=30s
K6_TARGET_PATH=/api/health
K6_TARGET_METHOD=GET

OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_TIMEOUT_MS=10000

GROQ_API_KEY=
GROQ_MODEL=qwen-qwq-32b
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
AI_PROVIDER=auto
```

Do not commit secrets. `.env` and `private-key.pem` are ignored.

## GitHub App Setup

Create app in GitHub Developer Settings:

1. App name: `Flux Chaos Reviewer`
2. Permissions:
   1. Checks: Read & Write
   2. Pull requests: Read & Write
   3. Contents: Read
   4. Metadata: Read
3. Events: `pull_request`, `check_run`
4. Generate private key and place at `./private-key.pem`
5. Install app on your test repo

Branch protection on `main` must require status check name exactly:

```text
flux/chaos-review
```

## Start Infrastructure

```bash
docker compose up -d
docker compose ps
```

Services started:

1. Redis (`redis:7-alpine`)
2. Postgres (`postgres:16-alpine`)
3. Ollama (`ollama/ollama:latest`)

Ports are bound to `127.0.0.1` only for safer local development.

Pull model inside container if needed:

```bash
docker exec flux-ollama ollama pull qwen3:8b
```

## Run Application

Terminal 1 (API server):

```bash
npm run dev
```

Terminal 2 (worker):

```bash
npm run worker
```

Terminal 3 (frontend):

```bash
cd flux-ui
npm run dev
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## Expose Webhook with ngrok

```bash
ngrok http 3000
```

Set GitHub App webhook URL to:

```text
https://<your-ngrok-domain>/webhooks/github
```

## AI Fallback Chain

`worker/analyzer.js` uses this strategy:

1. If `AI_PROVIDER=ollama`: Ollama only, then hard fallback object
2. If `AI_PROVIDER=groq`: Groq only, then hard fallback object
3. If `AI_PROVIDER=auto`:
   1. Try local Ollama (timeout via `OLLAMA_TIMEOUT_MS`)
   2. On error/timeout, try Groq
   3. On failure, return structured fallback analysis

Important: verdict logic never depends on LLM output. Verdict is always computed from measured P99 delta in `worker/runner.js`.

## Smoke Test Checklist

1. `curl http://localhost:3000/api/health` returns `{ "status": "ok" }`
2. Open PR in test repo
3. GitHub webhook delivery shows HTTP 202
4. Worker logs stage progression
5. Dashboard updates live via WS (`ws://localhost:3000/ws`)
6. PR receives check run + comment
7. Branch protection blocks merge on BLOCK verdict

## Common Issues

1. `docker` not found:
   1. Install Docker Desktop
   2. Restart shell and verify `docker --version`
2. Webhook 401:
   1. `GITHUB_WEBHOOK_SECRET` mismatch between GitHub App and `.env`
3. Check run posts but merge not blocked:
   1. Branch protection check name mismatch (`flux/chaos-review` must match exactly)
4. k6 docker volume issues:
   1. Ensure scripts are in `k6/`
5. Ollama slow on laptop:
   1. Use `AI_PROVIDER=auto` with Groq key set
   2. Lower prompt size if needed

## Notes

1. Legacy `backend/`, `k8s/`, and `nginx/` stacks were intentionally removed.
2. New canonical runtime is root `server/worker` architecture.
