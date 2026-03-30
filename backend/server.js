const express = require('express');
const cors = require('cors');
const expressWs = require('express-ws');
const dotenv = require('dotenv');
const { connectDB } = require('./utils/db');
const { Job } = require('./models/schemas');
const { startInlineAnalysisWorker } = require('./services/inlineAnalysisWorker');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
expressWs(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Connect to MongoDB
connectDB();

let stopInlineWorker;
if (process.env.ANALYSIS_WORKER_INLINE === 'true') {
  stopInlineWorker = startInlineAnalysisWorker();
}

// Routes
const jobsRouter = require('./routes/jobs');
const settingsRouter = require('./routes/settings');
const dashboardRouter = require('./routes/dashboard');
const analyzeRouter = require('./routes/analyze');

app.use('/api/jobs', jobsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/analyze', analyzeRouter);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket Endpoint for Real-time Updates
// Connect: ws://localhost:5001/ws
app.ws('/ws', (ws, req) => {
  console.log('🔌 WebSocket client connected');

  // Send initial message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to FLUX real-time updates',
    timestamp: new Date().toISOString()
  }));

  // Simulate real-time job updates
  const interval = setInterval(async () => {
    try {
      // Get random job and send update
      const randomJob = await Job.aggregate([
        { $sample: { size: 1 } }
      ]);

      if (randomJob.length > 0) {
        ws.send(JSON.stringify({
          type: 'job_update',
          data: randomJob[0],
          timestamp: new Date().toISOString()
        }));
      }

      // Get dashboard metrics
      const metrics = await Job.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      ws.send(JSON.stringify({
        type: 'metrics_update',
        data: metrics,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('WebSocket update error:', error);
    }
  }, 5000); // Update every 5 seconds

  ws.on('message', (msg) => {
    console.log(`📨 WebSocket message: ${msg}`);
    
    try {
      const data = JSON.parse(msg);
      
      // Handle different message types
      if (data.type === 'subscribe') {
        ws.send(JSON.stringify({
          type: 'subscribed',
          channel: data.channel,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Message parse error:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    clearInterval(interval);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(interval);
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Server Configuration
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   FLUX Backend API Server                  ║
╚════════════════════════════════════════════╝

🚀 Server running on http://localhost:${PORT}

📡 WebSocket endpoint: ws://localhost:${PORT}/ws

📚 API Endpoints:
  GET    /api/jobs                          - List all jobs
  GET    /api/jobs/:jobId                   - Get job details
  POST   /api/jobs                          - Create new job
  PATCH  /api/jobs/:jobId                   - Update job
  GET    /api/settings                      - Get settings
  PATCH  /api/settings                      - Update settings
  GET    /api/dashboard/summary             - Dashboard summary
  GET    /api/dashboard/recent-runs         - Recent test runs
  GET    /api/dashboard/queue-stats         - Queue statistics
  GET    /api/analyze/queue/stats           - Analysis queue stats
  GET    /api/analyze/task/:taskId          - Analysis task status
  POST   /api/analyze/:jobId                - Queue analysis
  POST   /api/analyze/:jobId/sync           - Run analysis synchronously
  GET    /api/dashboard/performance-trends  - Performance trends
  GET    /api/dashboard/chaos-breakdown     - Chaos events breakdown
  GET    /health                            - Health check

🌱 Seed database with: npm run seed

📖 Documentation: See BACKEND_API.md
  `);
});

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (stopInlineWorker) {
    stopInlineWorker();
  }
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;
