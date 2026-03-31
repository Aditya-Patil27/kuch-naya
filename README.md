# FLUX: AI-Powered Chaos Engineering Reviewer

FLUX listens to GitHub pull request webhooks, runs baseline + chaos performance checks (using Toxiproxy and k6), computes verdicts from measured metrics via Ollama, and publishes the results directly back to your GitHub PR.

## Architecture
- **Backend:** Node.js + Express, Bull Queue, Redis, Postgres
- **AI Analysis:** Ollama (`qwen3:8b` local) → Groq Fallback
- **Chaos Injection:** Toxiproxy + k6 via Docker
- **Frontend Dashboard:** React, Three.js, Recharts (Integrated inside Express via Vite Multi-stage build)

---

## 🚀 Production Deployment (VPS)

You can run FLUX on any Linux Virtual Private Server (e.g., Amazon EC2, DigitalOcean Droplet, Linode) using Docker. Because FLUX securely orchestrates temporary `toxiproxy` and `k6` test containers, the runtime requires access to the host's Docker socket.

### Prerequisites
1. A Linux machine with Docker and Docker Compose installed.

### Setup
1. Clone this repository onto your server.
2. Copy `.env.example` to `.env` and fill out your variables:
   - `GITHUB_APP_ID`
   - `GITHUB_WEBHOOK_SECRET`
   - Data stores (`POSTGRES_PASSWORD`, etc.)
3. Generate your GitHub App private key and place it in the root as `private-key.pem`.
4. Start the stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The application will now be available on port `3000` (or `PORT` in your `.env`). The React frontend dashboard is fully integrated and served automatically at `/`. Point your reverse proxy (e.g., Nginx, Caddy) to port 3000!

---

## 🛠 Local Development Environment

If you'd like to tweak the code or build new features locally on Mac or Windows:

### Prerequisites
- Node.js 20+
- Docker Desktop
- ngrok or an active smee.io URL

### 1. Start Infrastructure
```bash
docker compose up -d
```
*This command spins up the local dependencies: Redis, Postgres, and Ollama.*

### 2. Install & Start Application
Open 3 terminal windows from the repository root:

**Terminal 1 (Backend API):**
```bash
npm install
npm run dev
```

**Terminal 2 (Worker Queue):**
```bash
npm run worker
```

**Terminal 3 (React UI):**
```bash
cd flux-ui
npm install
npm run dev
```

### 3. Webhook Proxy Setup
Set up a [Smee.io](https://smee.io/) channel, put the URL in `WEBHOOK_PROXY_URL` in your `.env`, and run:
```bash
npm run proxy
```

---

## 🤖 GitHub App Configuration
1. Build a new App in GitHub Developer Settings.
2. App name: `Flux Chaos Reviewer`
3. Permissions required: 
   - Checks: **Read & Write**
   - Pull requests: **Read & Write**
   - Contents: **Read**
   - Metadata: **Read**
4. Subscribed Events: `pull_request`, `check_run`
5. Webhook URL: Your Live VPS domain (Prod) or Smee URL (Dev).

## Common Issues
- **`docker-compose.prod.yml` fails on Mac/Windows:** Production deployment relies on binding `/var/run/docker.sock`, which behaves differently on Mac/Windows Docker Desktop. It is highly recommended to use the 3-terminal `npm run dev` flow for local development, and reserve `docker-compose.prod.yml` purely for your Linux VPS.
- **Webhook 401 Unauthorized:** Ensure `GITHUB_WEBHOOK_SECRET` perfectly matches your `.env` value.
- **Branch Protection fails:** The required status check in your branch settings MUST be named exactly `flux/chaos-review`.
