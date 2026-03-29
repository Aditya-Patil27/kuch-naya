const mongoose = require('mongoose');

// Job Schema - Represents a FLUX test execution for a PR
const jobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  prNumber: {
    type: Number,
    required: true,
    index: true
  },
  repository: {
    type: String,
    required: true,
    index: true
  },
  title: String,
  author: String,
  authorAvatar: String,
  status: {
    type: String,
    enum: ['PASS', 'BLOCKED', 'RUNNING', 'PENDING', 'FAILED'],
    default: 'PENDING',
    index: true
  },
  duration: Number, // in milliseconds
  queuedTime: {
    type: Date,
    default: Date.now
  },
  startTime: Date,
  endTime: Date,
  
  // Performance Metrics
  metrics: {
    p99Latency: Number, // in milliseconds
    errorRate: Number, // percentage
    throughput: Number, // requests per second
    dbConnections: Number,
    dbConnectionLimit: Number,
    memoryUsage: Number, // in MB
    memoryLimit: Number,
    cpuUsage: Number // percentage
  },

  // Chaos Events
  chaosEvents: [{
    eventType: {
      type: String,
      enum: ['LATENCY_INJECTION', 'PACKET_LOSS', 'POD_TERMINATION', 'CACHE_MISS', 'DB_SLOWDOWN', 'MEMORY_LEAK'],
    },
    eventCount: Number,
    impact: String // LOW, MEDIUM, HIGH
  }],

  // Code Changes
  codeChanges: {
    fileName: String,
    before: String,
    after: String,
    summary: String
  },

  // AI Analysis
  aiAnalysis: {
    strengths: [String],
    observations: [String],
    recommendations: [String],
    verdict: {
      type: String,
      enum: ['SAFE_TO_MERGE', 'NEEDS_REVIEW', 'UNSAFE'],
      default: 'NEEDS_REVIEW'
    },
    confidence: Number // 0-100
  },

  // GitHub Integration
  githubUrl: String,
  commitWillCreatedAt: Date,
  commitSha: String,

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Chaos Event Schema - Detailed log of each chaos injection
const chaosEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    unique: true,
    required: true
  },
  jobId: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: ['LATENCY_INJECTION', 'PACKET_LOSS', 'POD_TERMINATION', 'CACHE_MISS', 'DB_SLOWDOWN', 'MEMORY_LEAK'],
    required: true
  },
  duration: Number, // in seconds
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  },
  targetService: String,
  parameters: {}, // Flexible object for event-specific params
  
  // Observed Impact
  impact: {
    errorCount: Number,
    latencyIncrease: Number,
    throughputDecreases: Number,
    recoveryTime: Number // time to recover in ms
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date
});

// Settings Schema - FLUX Configuration
const settingsSchema = new mongoose.Schema({
  settingId: {
    type: String,
    default: 'global',
    unique: true
  },

  // GitHub Integration Settings
  github: {
    appInstalled: Boolean,
    webhookUrl: String,
    webhookVerified: Boolean,
    prAuthor: {
      type: String,
      enum: ['anyone', 'org-members', 'approved-list']
    },
    autoMerge: Boolean
  },

  // Performance Thresholds
  thresholds: {
    p99Latency: Number, // milliseconds
    errorRate: Number, // percentage
    throughput: Number, // requests per second
    memoryUsage: Number, // percentage
    dbPool: Number, // connections
    cacheHitRate: Number // percentage
  },

  // Notification Settings
  notifications: {
    onPass: Boolean,
    onBlock: Boolean,
    dailyDigest: Boolean,
    slackEnabled: Boolean,
    slackWebhook: String,
    emailNotifications: Boolean,
    emailAddress: String
  },

  // Advanced Settings
  advanced: {
    commandTimeout: Number, // seconds
    rampDuration: Number, // seconds
    chaosTypes: [String],
    logRetention: Number, // days
    apiRateLimit: Number, // requests per minute
    webhookUrl: String
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Dashboard Metrics Schema - Aggregated metrics for dashboard display
const metricsSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Aggregated Counts
  totalPRsTested: Number,
  totalChaosEvents: Number,
  successRate: Number, // percentage
  blockRate: Number, // percentage
  avgDuration: Number, // milliseconds

  // Top Failing Services
  topFailingServices: [{
    serviceName: String,
    failureCount: Number,
    errorRate: Number
  }],

  // Performance Distribution
  p99Latency: Number,
  p95Latency: Number,
  p50Latency: Number,
  errorRate: Number,
  throughput: Number,

  createdAt: {
    type: Date,
    default: Date.now,
    expire: 2592000 // TTL: 30 days
  }
});

module.exports = {
  Job: mongoose.model('Job', jobSchema),
  ChaosEvent: mongoose.model('ChaosEvent', chaosEventSchema),
  Settings: mongoose.model('Settings', settingsSchema),
  Metrics: mongoose.model('Metrics', metricsSchema)
};
