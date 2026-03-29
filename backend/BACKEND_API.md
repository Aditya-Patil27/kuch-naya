# FLUX Backend API Documentation

**Node.js/Express REST API for FLUX AI Chaos Reviewer Dashboard**

---

## 📋 Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Running the Server](#running-the-server)
4. [API Endpoints](#api-endpoints)
5. [WebSocket Real-Time Updates](#websocket-real-time-updates)
6. [Data Models](#data-models)
7. [Error Handling](#error-handling)
8. [Examples](#examples)

---

## Installation

### Prerequisites
- Node.js 16+
- MongoDB 4.4+
- npm or yarn

### Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your MongoDB URI
# For local MongoDB:
# MONGODB_URI=mongodb://localhost:27017/flux
# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/flux
```

---

## Configuration

Edit `.env` file:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/flux
MONGODB_USER=admin
MONGODB_PASSWORD=password

# Server
PORT=5000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000

# GitHub
GITHUB_API_TOKEN=your_token
GITHUB_APP_ID=your_app_id
GITHUB_WEBHOOK_SECRET=your_secret

# API
API_KEY=your_secret_key
```

---

## Running the Server

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Seed Sample Data
```bash
npm run seed
```

**Output:**
```
🌱 Seeding database...
✅ Inserted 5 sample jobs
✅ Inserted default settings
✅ Database seeded successfully!
```

---

## API Endpoints

### Jobs Endpoints

#### GET /api/jobs
Get all jobs with optional filtering and pagination.

**Query Parameters:**
```
status=PASS|BLOCKED|RUNNING|PENDING|FAILED  - Filter by status
repository=core/api                           - Filter by repository
page=1                                        - Page number (default: 1)
limit=10                                      - Items per page (default: 10)
sortBy=createdAt|status|duration              - Sort field (default: createdAt)
order=asc|desc                                - Sort direction (default: desc)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65f123abc123",
      "jobId": "job-001",
      "prNumber": 402,
      "repository": "core/api",
      "status": "PASS",
      "duration": 263000,
      "metrics": {
        "p99Latency": 247,
        "errorRate": 0.3,
        "throughput": 1240
      },
      "createdAt": "2024-03-29T10:30:00Z"
    }
  ],
  "pagination": {
    "current": 1,
    "total": 5,
    "count": 5,
    "perPage": 10
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:5000/api/jobs?status=PASS&limit=5"
```

---

#### GET /api/jobs/:jobId
Get detailed information about a specific job.

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job-001",
    "prNumber": 402,
    "repository": "core/api",
    "title": "Fix N+1 query in user dashboard",
    "author": "alice@company.com",
    "status": "PASS",
    "duration": 263000,
    "metrics": {
      "p99Latency": 247,
      "errorRate": 0.3,
      "throughput": 1240,
      "dbConnections": 240,
      "dbConnectionLimit": 300,
      "memoryUsage": 456,
      "memoryLimit": 512,
      "cpuUsage": 68
    },
    "chaosEvents": [
      {
        "eventType": "LATENCY_INJECTION",
        "eventCount": 1,
        "impact": "HIGH"
      }
    ],
    "codeChanges": {
      "fileName": "src/utils/userDashboard.js",
      "before": "for (let user of users) { await getProfile(user.id); }",
      "after": "await Promise.all(users.map(u => getProfile(u.id)));",
      "summary": "Parallel query optimization"
    },
    "aiAnalysis": {
      "strengths": ["Reduces database roundtrips", "Improves P99 latency by 40%"],
      "observations": ["Memory usage stable under load"],
      "recommendations": ["Consider connection pooling optimization"],
      "verdict": "SAFE_TO_MERGE",
      "confidence": 94
    }
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:5000/api/jobs/job-001"
```

---

#### POST /api/jobs
Create a new job record.

**Request Body:**
```json
{
  "jobId": "job-006",
  "prNumber": 407,
  "repository": "core/api",
  "title": "Add caching layer",
  "author": "frank@company.com",
  "status": "PENDING",
  "metrics": {
    "p99Latency": 300,
    "errorRate": 0.5,
    "throughput": 1000
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65f456def456",
    "jobId": "job-006",
    "prNumber": 407,
    "status": "PENDING",
    "createdAt": "2024-03-29T11:00:00Z"
  }
}
```

**Example:**
```bash
curl -X POST "http://localhost:5000/api/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-006",
    "prNumber": 407,
    "repository": "core/api",
    "title": "Add caching layer",
    "author": "frank@company.com",
    "status": "RUNNING"
  }'
```

---

#### PATCH /api/jobs/:jobId
Update a job's status or metrics.

**Request Body:**
```json
{
  "status": "PASS",
  "duration": 310000,
  "metrics": {
    "p99Latency": 280,
    "errorRate": 0.2,
    "throughput": 1350
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job-001",
    "status": "PASS",
    "updatedAt": "2024-03-29T11:15:00Z"
  }
}
```

**Example:**
```bash
curl -X PATCH "http://localhost:5000/api/jobs/job-001" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PASS",
    "duration": 310000
  }'
```

---

#### GET /api/jobs/:jobId/chaos-events
Get all chaos events for a job.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "eventId": "event-1001",
      "jobId": "job-001",
      "eventType": "LATENCY_INJECTION",
      "duration": 30,
      "severity": "HIGH",
      "targetService": "user-service",
      "impact": {
        "errorCount": 5,
        "latencyIncrease": 245,
        "recoveryTime": 2000
      }
    }
  ]
}
```

---

#### POST /api/jobs/:jobId/chaos-events
Log a chaos event for a job.

**Request Body:**
```json
{
  "eventId": "event-1002",
  "eventType": "PACKET_LOSS",
  "duration": 45,
  "severity": "MEDIUM",
  "targetService": "payment-service",
  "parameters": {
    "packetLossRate": 0.05,
    "affectedNodes": 2
  },
  "impact": {
    "errorCount": 12,
    "latencyIncrease": 500,
    "recoveryTime": 3000
  }
}
```

---

### Settings Endpoints

#### GET /api/settings
Get current FLUX configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "settingId": "global",
    "github": {
      "appInstalled": true,
      "webhookVerified": true,
      "prAuthor": "org-members",
      "autoMerge": false
    },
    "thresholds": {
      "p99Latency": 500,
      "errorRate": 1.0,
      "throughput": 1000,
      "memoryUsage": 80,
      "dbPool": 240,
      "cacheHitRate": 85
    },
    "notifications": {
      "onPass": true,
      "onBlock": true,
      "slackEnabled": true,
      "emailNotifications": true,
      "emailAddress": "team@company.com"
    },
    "advanced": {
      "commandTimeout": 600,
      "rampDuration": 120,
      "chaosTypes": ["LATENCY_INJECTION", "PACKET_LOSS", "POD_TERMINATION"],
      "logRetention": 30,
      "apiRateLimit": 1000
    }
  }
}
```

---

#### PATCH /api/settings
Update settings.

**Request Body:**
```json
{
  "notifications": {
    "onPass": true,
    "onBlock": true,
    "slackEnabled": true,
    "emailNotifications": false
  }
}
```

---

#### PATCH /api/settings/thresholds
Update performance thresholds.

**Request Body:**
```json
{
  "thresholds": {
    "p99Latency": 600,
    "errorRate": 1.5,
    "throughput": 800
  }
}
```

---

#### POST /api/settings/reset
Reset all settings to defaults.

**Response:**
```json
{
  "success": true,
  "message": "Settings reset to defaults"
}
```

---

### Dashboard Endpoints

#### GET /api/dashboard/summary
Get 24-hour dashboard summary.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPRsTested": 247,
    "totalChaosEvents": 892,
    "successRate": 94.2,
    "avgDuration": 263000,
    "statusBreakdown": {
      "PASS": 233,
      "BLOCKED": 12,
      "RUNNING": 2,
      "PENDING": 0,
      "FAILED": 0
    },
    "metrics": {
      "p99Latency": 247,
      "errorRate": 0.3,
      "throughput": 1240
    }
  }
}
```

---

#### GET /api/dashboard/recent-runs
Get latest job executions.

**Query Parameters:**
```
limit=10  - Number of recent runs (default: 10)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "jobId": "job-001",
      "prNumber": 402,
      "repository": "core/api",
      "status": "PASS",
      "duration": 263000,
      "startTime": "2024-03-29T10:30:00Z",
      "endTime": "2024-03-29T10:34:23Z"
    }
  ]
}
```

---

#### GET /api/dashboard/queue-stats
Get current queue statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 247,
    "active": 2,
    "queued": 12,
    "passed": 233,
    "blocked": 12,
    "successRate": "94.34"
  }
}
```

---

#### GET /api/dashboard/performance-trends
Get performance trends over time.

**Query Parameters:**
```
days=7  - Number of days to analyze (default: 7)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "2024-03-29",
      "totalJobs": 35,
      "passCount": 33,
      "blockedCount": 2,
      "avgDuration": 263000,
      "avgP99Latency": 247,
      "avgErrorRate": 0.3
    }
  ]
}
```

---

#### GET /api/dashboard/chaos-breakdown
Get chaos events breakdown for last 24 hours.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "LATENCY_INJECTION",
      "count": 245,
      "avgImpact": 0.65
    },
    {
      "_id": "CACHE_MISS",
      "count": 156,
      "avgImpact": 0.42
    }
  ]
}
```

---

## WebSocket Real-Time Updates

### Connection

```javascript
const ws = new WebSocket('ws://localhost:5000/ws');

ws.onopen = () => {
  console.log('Connected to FLUX real-time updates');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'job_update') {
    console.log('Job updated:', data.data);
  } else if (data.type === 'metrics_update') {
    console.log('Metrics:', data.data);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from real-time updates');
};
```

### Message Types

**Connected Message:**
```json
{
  "type": "connected",
  "message": "Connected to FLUX real-time updates",
  "timestamp": "2024-03-29T10:30:00Z"
}
```

**Job Update:**
```json
{
  "type": "job_update",
  "data": {
    "jobId": "job-001",
    "status": "PASS",
    "metrics": { ... }
  },
  "timestamp": "2024-03-29T10:35:00Z"
}
```

**Metrics Update:**
```json
{
  "type": "metrics_update",
  "data": [
    { "_id": "PASS", "count": 233 },
    { "_id": "BLOCKED", "count": 12 }
  ],
  "timestamp": "2024-03-29T10:35:05Z"
}
```

---

## Data Models

### Job Schema
```javascript
{
  jobId: String (unique),
  prNumber: Number,
  repository: String,
  title: String,
  author: String,
  status: "PASS" | "BLOCKED" | "RUNNING" | "PENDING" | "FAILED",
  duration: Number (milliseconds),
  metrics: {
    p99Latency: Number,
    errorRate: Number,
    throughput: Number,
    dbConnections: Number,
    memoryUsage: Number
  },
  chaosEvents: [{
    eventType: String,
    eventCount: Number,
    impact: "LOW" | "MEDIUM" | "HIGH"
  }],
  aiAnalysis: {
    verdict: "SAFE_TO_MERGE" | "NEEDS_REVIEW" | "UNSAFE",
    confidence: Number (0-100)
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Settings Schema
```javascript
{
  github: {
    appInstalled: Boolean,
    webhookVerified: Boolean,
    prAuthor: "anyone" | "org-members" | "approved-list",
    autoMerge: Boolean
  },
  thresholds: {
    p99Latency: Number,
    errorRate: Number,
    throughput: Number,
    memoryUsage: Number,
    dbPool: Number,
    cacheHitRate: Number
  },
  notifications: {
    onPass: Boolean,
    onBlock: Boolean,
    slackEnabled: Boolean,
    emailNotifications: Boolean
  },
  advanced: {
    commandTimeout: Number,
    rampDuration: Number,
    chaosTypes: [String],
    logRetention: Number,
    apiRateLimit: Number
  }
}
```

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Common Status Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Examples

**Invalid Job ID:**
```json
{
  "success": false,
  "error": "Job not found"
}
```

**Validation Error:**
```json
{
  "success": false,
  "error": "Path `status` is invalid enum value `UNKNOWN`"
}
```

---

## Examples

### Complete Workflow

**1. Create a new job:**
```bash
curl -X POST "http://localhost:5000/api/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-007",
    "prNumber": 408,
    "repository": "core/api",
    "title": "Add feature X",
    "author": "user@company.com",
    "status": "PENDING"
  }'
```

**2. Get job details:**
```bash
curl -X GET "http://localhost:5000/api/jobs/job-007"
```

**3. Update job with results:**
```bash
curl -X PATCH "http://localhost:5000/api/jobs/job-007" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "RUNNING",
    "startTime": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "metrics": {
      "p99Latency": 250,
      "errorRate": 0.2,
      "throughput": 1300
    }
  }'
```

**4. Add chaos event:**
```bash
curl -X POST "http://localhost:5000/api/jobs/job-007/chaos-events" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "event-007-1",
    "eventType": "LATENCY_INJECTION",
    "duration": 30,
    "severity": "HIGH"
  }'
```

**5. Complete job:**
```bash
curl -X PATCH "http://localhost:5000/api/jobs/job-007" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PASS",
    "endTime": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "duration": 310000,
    "aiAnalysis": {
      "verdict": "SAFE_TO_MERGE",
      "confidence": 96
    }
  }'
```

**6. Get dashboard summary:**
```bash
curl -X GET "http://localhost:5000/api/dashboard/summary"
```

---

## Troubleshooting

### MongoDB Connection Error
```
ERROR: MongoDB Connection Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Ensure MongoDB is running:
```bash
# On Windows with WSL:
mongod

# Or use MongoDB Atlas with MONGODB_URI in .env
```

### CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution:** Update CORS_ORIGIN in .env:
```env
CORS_ORIGIN=http://localhost:3000
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution:** Change PORT in .env or kill the process:
```bash
lsof -i :5000
kill -9 <PID>
```

---

## Next Steps

✅ **Phase A (Complete):** Backend API with REST endpoints and MongoDB  
➡️ **Phase B (Next):** AI Analysis Logic - Implement chaos recommendation engine  
➡️ **Phase C:** Full Integration - Wire frontend to backend APIs  
➡️ **Phase D:** Deployment Setup - Docker, Kubernetes, CI/CD  

---

**API Base URL:** `http://localhost:5000`  
**WebSocket URL:** `ws://localhost:5000/ws`  
**Documentation Updated:** March 29, 2026
