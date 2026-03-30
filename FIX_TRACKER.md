# Fix Tracker

Last updated: 2026-03-30

## Completed Fixes

### Architecture and Repository Integrity
- [x] Removed stale legacy backend entrypoint (`backend/server.js`) that referenced missing modules.
- [x] Removed stale legacy backend environment template (`backend/.env.example`).
- [x] Added schema bootstrap patching on startup (`server/db.js`) to keep runtime schema in sync.

### Webhook Reliability and Idempotency
- [x] Replaced async fire-and-forget webhook handling with deterministic request-scope processing (`server/webhook.js`).
- [x] Added `x-github-delivery` based idempotency checks and queue job de-duplication (`server/webhook.js`).
- [x] Added retry policy controls (`JOB_MAX_ATTEMPTS`, `JOB_RETRY_DELAY_MS`) for queued jobs.
- [x] Added guardrails for missing webhook secret and delivery id header handling.

### Database Robustness
- [x] Added `delivery_id` field and indexes in init schema (`db/init.sql`).
- [x] Added startup-time schema patches and indexes for existing DBs (`server/db.js`).
- [x] Added query-friendly indexes for `created_at`, `status+created_at`, and `(repo, pr_number, head_sha)`.

### API and WebSocket Security
- [x] Added optional API key enforcement for `/api/jobs` and `/api/jobs/:id` (`server/index.js`).
- [x] Added optional API key enforcement for WebSocket upgrade path (`server/index.js`).
- [x] Added minimal hardening headers (`x-content-type-options`, `x-frame-options`, `referrer-policy`).
- [x] Removed sensitive DB error leakage from `/api/health` response body.

### Worker Performance and Portability
- [x] Replaced `execSync` shell blocking calls with async `spawn` command execution (`worker/runner.js`).
- [x] Removed hard dependency on `--network host` for k6 and toxiproxy.
- [x] Added safer URL validation and timeout behavior for fetching PR diffs (`worker/runner.js`).
- [x] Added toxiproxy admin/listen port derivation per job to reduce collisions.
- [x] Added Redis error logging and `SIGTERM` shutdown handling in worker (`worker/index.js`).

### AI Analyzer Reliability
- [x] Fixed timeout cleanup to avoid dangling timer handles (`worker/analyzer.js`).
- [x] Added fallback-path error logging for Ollama/Groq failures (`worker/analyzer.js`).

### Frontend Stability and Safety
- [x] Fixed Dashboard hook imports and removed impure `Date.now()` rendering path (`flux-ui/src/pages/Dashboard.jsx`).
- [x] Added reconnect backoff + jitter and memory capping in live jobs hook (`flux-ui/src/useJobs.js`).
- [x] Migrated Jobs Queue from mock data to live backend job data (`flux-ui/src/pages/JobsQueue.jsx`).
- [x] Fixed Jobs Queue failed filter logic and implemented real pagination.
- [x] Added explicit `FAILED` verdict token style (`flux-ui/src/tokens.js`).
- [x] Removed unsafe `dangerouslySetInnerHTML` markdown rendering path (`flux-ui/src/pages/PRPreview.jsx`).
- [x] Cleaned lint issues in `ThreeScene.jsx`, `UI.jsx`, and `JobDetail.jsx`.

### k6 Script Correctness
- [x] Updated baseline and chaos scripts to use configurable target path/method.
- [x] Aligned default target to `/api/health` instead of non-existent endpoint.

### DevOps and Local Security
- [x] Bound compose service ports to localhost only (`docker-compose.yml`).
- [x] Parameterized postgres credentials and added restart policy for local services.
- [x] Updated `.env.example` and README to include new hardening/retry/k6 configuration.

## Remaining Work

### Must-Do Before Production
- [ ] Add authentication and RBAC for all operator-facing APIs beyond API-key gate.
- [ ] Add webhook rate limiting and abuse throttling.
- [ ] Add durable dead-letter handling and retry visibility for failed jobs.
- [ ] Add typed validation for all inbound payloads/events (schema-based validation).
- [ ] Move secrets to a managed secret store (not `.env`) for deployed environments.
- [ ] Pin container image digests (avoid mutable tags in deployment manifests).

### Test and CI Gaps
- [ ] Add unit tests for webhook signature validation, idempotency flow, and verdict logic.
- [ ] Add integration tests for webhook -> queue -> worker -> DB -> GitHub report path.
- [ ] Add frontend tests for `useJobs` reconnect/backoff behavior and list updates.
- [ ] Add CI pipeline gates for lint, tests, and security scanning.

### Observability Gaps
- [ ] Replace ad-hoc console logs with structured logger + correlation IDs.
- [ ] Export metrics for queue depth, stage latency, webhook failures, and analyzer fallback rates.
- [ ] Add tracing across server webhook ingestion and worker execution spans.

### Scale and Product Readiness
- [ ] Replace demo/static values still present in some UI cards with live telemetry.
- [ ] Add cancel-job backend endpoint before wiring active queue cancel button.
- [ ] Add cursor-based pagination for jobs API for high-volume histories.
- [ ] Add multi-tenant repo isolation and per-installation quotas.

## Validation Commands

```bash
npm --prefix flux-ui run lint
npm audit --omit=dev --json
```

Use these after each major change set and update this tracker with pass/fail evidence.

## Validation Snapshot (2026-03-30)

- [x] `npm --prefix flux-ui run lint` (pass)
- [x] `npm audit --omit=dev --json` (0 vulnerabilities in prod deps)
- [x] `node --check server/index.js server/webhook.js worker/runner.js worker/analyzer.js` (pass)
- [ ] Full runtime smoke test (`docker compose up`, `npm run dev`, `npm run worker`) pending local infra startup.
