# FLUX Backend API

Express.js REST API for FLUX AI Chaos Reviewer Dashboard

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your MongoDB connection
nano .env

# Seed database with sample data
npm run seed

# Start server
npm run dev
```

**Server running on:** `http://localhost:5000`  
**WebSocket:** `ws://localhost:5000/ws`

---

## 📁 Project Structure

```
backend/
├── server.js                 # Main Express application
├── package.json              # Dependencies
├── .env.example             # Environment template
├── .env                     # Local configuration (create from template)
│
├── models/
│   └── schemas.js           # MongoDB models (Job, ChaosEvent, Settings, Metrics)
│
├── routes/
│   ├── jobs.js              # Job management endpoints
│   ├── settings.js          # FLUX settings endpoints
│   └── dashboard.js         # Dashboard metrics endpoints
│
├── utils/
│   └── db.js                # MongoDB connection
│
├── scripts/
│   └── seedData.js          # Sample data generator
│
└── BACKEND_API.md           # Complete API documentation
```

---

## 🔌 API Endpoints

### Jobs
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/:jobId` - Get job details
- `POST /api/jobs` - Create new job
- `PATCH /api/jobs/:jobId` - Update job

### Settings
- `GET /api/settings` - Get configuration
- `PATCH /api/settings` - Update settings
- `POST /api/settings/reset` - Reset to defaults

### Dashboard
- `GET /api/dashboard/summary` - 24-hour summary
- `GET /api/dashboard/recent-runs` - Latest jobs
- `GET /api/dashboard/queue-stats` - Queue information
- `GET /api/dashboard/performance-trends` - Historical trends
- `GET /api/dashboard/chaos-breakdown` - Chaos events analysis

### WebSocket
- `ws://localhost:5000/ws` - Real-time updates (job & metrics)
- `GET /health` - Health check

---

## 📊 Database Models

### Job
Test execution record for a PR
```javascript
{
  jobId, prNumber, repository, status, duration,
  metrics { p99Latency, errorRate, throughput, ... },
  chaosEvents [{eventType, eventCount, impact}],
  aiAnalysis {verdict, confidence, recommendations}
}
```

### ChaosEvent
Detailed log of injected chaos
```javascript
{
  eventId, jobId, eventType, duration, severity,
  impact {errorCount, latencyIncrease, recoveryTime}
}
```

### Settings
FLUX configuration
```javascript
{
  github {appInstalled, webhookVerified, autoMerge},
  thresholds {p99Latency, errorRate, throughput, ...},
  notifications {onPass, onBlock, slackEnabled, ...},
  advanced {commandTimeout, chaosTypes, logRetention, ...}
}
```

---

## 🛠️ Configuration

Edit `.env`:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/flux

# Server
PORT=5000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000

# GitHub Integration (optional)
GITHUB_API_TOKEN=your_token
GITHUB_APP_ID=your_app_id
```

---

## 📚 Scripts

```bash
npm start           # Run production server
npm run dev         # Run with auto-reload (requires nodemon)
npm run seed        # Populate database with sample data
```

---

## 🔄 Real-Time WebSocket

Connect from frontend:

```javascript
const ws = new WebSocket('ws://localhost:5000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'job_update') {
    // Handle job update
  } else if (data.type === 'metrics_update') {
    // Handle metrics
  }
};
```

Updates broadcast every 5 seconds automatically.

---

## 🗄️ MongoDB Setup

### Local MongoDB
```bash
# WSL/Linux
mongod

# macOS
brew services start mongodb-community

# Windows
services.msc → MongoDB
```

### MongoDB Atlas (Cloud)
```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/flux?retryWrites=true&w=majority
```

---

## 🐛 Troubleshooting

**MongoDB Connection Error:**
```
Ensure MongoDB is running on localhost:27017 or update MONGODB_URI in .env
```

**CORS Error:**
```
Update CORS_ORIGIN in .env to match your frontend URL
```

**Port Already in Use:**
```bash
# Find process on port 5000
lsof -i :5000

# Kill it (PID=xxxx)
kill -9 xxxx
```

---

## 📖 Full Documentation

See **BACKEND_API.md** for:
- Complete endpoint reference
- Request/response examples
- Error handling
- Data models
- Example workflows

---

## 🔗 Related Files

- Frontend: `../stitch_flux_dashboard/`
- Design Specs: `../flux_technical_architecture.md`
- Progress: `../PROGRESS.md`

---

## ✅ Status

- ✅ Express server with REST API
- ✅ MongoDB models and schemas
- ✅ Job management endpoints
- ✅ Dashboard metrics aggregation
- ✅ WebSocket real-time updates
- ✅ Settings management
- ✅ Sample data seeding
- ✅ AI Analysis Engine (Phase B)
  - ✅ Chaos analyzing with verdict generation
  - ✅ Performance threshold validation
  - ✅ GitHub comment generation
  - ✅ Anomaly detection with ML baselines
- ⏭️ (Phase C) Frontend Integration
- ⏭️ (Phase D) Deployment

---

**Build Started:** March 29, 2026  
**Phase A Complete:** March 29, 2026  
**Next:** Option B - AI Analysis Logic
