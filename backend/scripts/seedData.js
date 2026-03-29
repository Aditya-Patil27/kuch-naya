const mongoose = require('mongoose');
const { Job, ChaosEvent, Settings } = require('../models/schemas');
require('dotenv').config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flux', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🌱 Seeding database...');

    // Clear existing data
    await Job.deleteMany({});
    await ChaosEvent.deleteMany({});
    await Settings.deleteMany({});

    // Seed Jobs
    const jobs = [
      {
        jobId: 'job-001',
        prNumber: 402,
        repository: 'core/api',
        title: 'Fix N+1 query in user dashboard',
        author: 'alice@company.com',
        authorAvatar: 'https://i.pravatar.cc/150?img=1',
        status: 'PASS',
        duration: 263000,
        startTime: new Date(Date.now() - 15 * 60 * 1000),
        endTime: new Date(Date.now() - 10 * 60 * 1000),
        metrics: {
          p99Latency: 247,
          errorRate: 0.3,
          throughput: 1240,
          dbConnections: 240,
          dbConnectionLimit: 300,
          memoryUsage: 456,
          memoryLimit: 512,
          cpuUsage: 68
        },
        chaosEvents: [
          { eventType: 'LATENCY_INJECTION', eventCount: 1, impact: 'HIGH' },
          { eventType: 'CACHE_MISS', eventCount: 1, impact: 'MEDIUM' }
        ],
        codeChanges: {
          fileName: 'src/utils/userDashboard.js',
          before: 'for (let user of users) { await getProfile(user.id); }',
          after: 'await Promise.all(users.map(u => getProfile(u.id)));',
          summary: 'Parallel query optimization'
        },
        aiAnalysis: {
          strengths: ['Reduces database roundtrips', 'Improves P99 latency by 40%'],
          observations: ['Memory usage stable under load', 'No regressions detected'],
          recommendations: ['Consider connection pooling optimization'],
          verdict: 'SAFE_TO_MERGE',
          confidence: 94
        },
        githubUrl: 'https://github.com/company/core/pull/402',
        commitSha: 'abc123def456',
        createdAt: new Date(Date.now() - 30 * 60 * 1000)
      },
      {
        jobId: 'job-002',
        prNumber: 403,
        repository: 'payment-service',
        title: 'Add circuit breaker pattern',
        author: 'bob@company.com',
        authorAvatar: 'https://i.pravatar.cc/150?img=2',
        status: 'BLOCKED',
        duration: 480000,
        startTime: new Date(Date.now() - 45 * 60 * 1000),
        endTime: new Date(Date.now() - 37 * 60 * 1000),
        metrics: {
          p99Latency: 845,
          errorRate: 5.2,
          throughput: 420,
          dbConnections: 280,
          dbConnectionLimit: 300,
          memoryUsage: 680,
          memoryLimit: 512,
          cpuUsage: 92
        },
        chaosEvents: [
          { eventType: 'POD_TERMINATION', eventCount: 2, impact: 'HIGH' },
          { eventType: 'DB_SLOWDOWN', eventCount: 1, impact: 'HIGH' }
        ],
        codeChanges: {
          fileName: 'src/clients/externalAPI.js',
          before: 'await retry(connect(), 3);',
          after: 'await circuitBreaker(connect(), { threshold: 5, timeout: 30000 });',
          summary: 'Implement circuit breaker'
        },
        aiAnalysis: {
          strengths: ['Good error handling design'],
          observations: ['Circuit breaker trips too early', 'Recovery time too long under pod termination'],
          recommendations: ['Increase timeout to 45s', 'Adjust failure threshold to 8'],
          verdict: 'NEEDS_REVIEW',
          confidence: 72
        },
        githubUrl: 'https://github.com/company/payment-service/pull/403',
        commitSha: 'def456ghi789',
        createdAt: new Date(Date.now() - 45 * 60 * 1000)
      },
      {
        jobId: 'job-003',
        prNumber: 404,
        repository: 'core/api',
        title: 'Update dependencies',
        author: 'charlie@company.com',
        authorAvatar: 'https://i.pravatar.cc/150?img=3',
        status: 'PASS',
        duration: 310000,
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() - 53 * 60 * 1000),
        metrics: {
          p99Latency: 198,
          errorRate: 0.1,
          throughput: 1580,
          dbConnections: 180,
          dbConnectionLimit: 300,
          memoryUsage: 320,
          memoryLimit: 512,
          cpuUsage: 45
        },
        chaosEvents: [
          { eventType: 'LATENCY_INJECTION', eventCount: 1, impact: 'LOW' }
        ],
        codeChanges: {
          fileName: 'package.json',
          before: '"express": "^4.17.1"',
          after: '"express": "^4.18.2"',
          summary: 'Update framework versions'
        },
        aiAnalysis: {
          strengths: ['No breaking changes', 'Improves security'],
          observations: ['All tests passing', 'Performance improved slightly'],
          recommendations: ['Monitor for compatibility issues in production'],
          verdict: 'SAFE_TO_MERGE',
          confidence: 98
        },
        githubUrl: 'https://github.com/company/core/pull/404',
        commitSha: 'ghi789jkl012',
        createdAt: new Date(Date.now() - 70 * 60 * 1000)
      },
      {
        jobId: 'job-004',
        prNumber: 405,
        repository: 'notifications-service',
        title: 'Add retry logic for email delivery',
        author: 'diana@company.com',
        authorAvatar: 'https://i.pravatar.cc/150?img=4',
        status: 'PASS',
        duration: 254000,
        startTime: new Date(Date.now() - 90 * 60 * 1000),
        endTime: new Date(Date.now() - 85 * 60 * 1000),
        metrics: {
          p99Latency: 287,
          errorRate: 0.5,
          throughput: 950,
          dbConnections: 210,
          dbConnectionLimit: 300,
          memoryUsage: 410,
          memoryLimit: 512,
          cpuUsage: 58
        },
        chaosEvents: [
          { eventType: 'PACKET_LOSS', eventCount: 1, impact: 'MEDIUM' }
        ],
        codeChanges: {
          fileName: 'src/services/emailService.js',
          before: 'await sendEmail(user.email, template);',
          after: 'await retry(sendEmail(user.email, template), { maxAttempts: 3, backoff: exponential });',
          summary: 'Add exponential backoff retry'
        },
        aiAnalysis: {
          strengths: ['Reduces email delivery failures', 'Handles transient network issues'],
          observations: ['No performance degradation', 'Backoff strategy appropriate'],
          recommendations: [],
          verdict: 'SAFE_TO_MERGE',
          confidence: 96
        },
        githubUrl: 'https://github.com/company/notifications-service/pull/405',
        commitSha: 'jkl012mno345',
        createdAt: new Date(Date.now() - 100 * 60 * 1000)
      },
      {
        jobId: 'job-005',
        prNumber: 406,
        repository: 'analytics-engine',
        title: 'Optimize aggregation pipeline',
        author: 'eve@company.com',
        authorAvatar: 'https://i.pravatar.cc/150?img=5',
        status: 'PASS',
        duration: 325000,
        startTime: new Date(Date.now() - 120 * 60 * 1000),
        endTime: new Date(Date.now() - 114 * 60 * 1000),
        metrics: {
          p99Latency: 156,
          errorRate: 0.2,
          throughput: 2100,
          dbConnections: 150,
          dbConnectionLimit: 300,
          memoryUsage: 380,
          memoryLimit: 512,
          cpuUsage: 52
        },
        chaosEvents: [
          { eventType: 'CACHE_MISS', eventCount: 2, impact: 'LOW' }
        ],
        codeChanges: {
          fileName: 'src/queries/analytics.js',
          before: 'db.aggregate([ { $match }, { $group }, { $sort }, { $limit: 1000 } ])',
          after: 'db.aggregate([ { $match }, { $limit: 100 }, { $group }, { $sort } ])',
          summary: 'Move limit before group stage'
        },
        aiAnalysis: {
          strengths: ['Significant query performance improvement', 'Memory usage reduced'],
          observations: ['Results identical to previous version', 'Execution time improved 60%'],
          recommendations: [],
          verdict: 'SAFE_TO_MERGE',
          confidence: 99
        },
        githubUrl: 'https://github.com/company/analytics-engine/pull/406',
        commitSha: 'mno345pqr678',
        createdAt: new Date(Date.now() - 130 * 60 * 1000)
      }
    ];

    await Job.insertMany(jobs);
    console.log('✅ Inserted 5 sample jobs');

    // Seed Settings
    const settings = new Settings({
      settingId: 'global',
      github: {
        appInstalled: true,
        webhookUrl: 'https://flux.company.com/webhooks/github',
        webhookVerified: true,
        prAuthor: 'org-members',
        autoMerge: false
      },
      thresholds: {
        p99Latency: 500,
        errorRate: 1.0,
        throughput: 1000,
        memoryUsage: 80,
        dbPool: 240,
        cacheHitRate: 85
      },
      notifications: {
        onPass: true,
        onBlock: true,
        dailyDigest: false,
        slackEnabled: true,
        slackWebhook: 'https://hooks.slack.com/services/...',
        emailNotifications: true,
        emailAddress: 'team@company.com'
      },
      advanced: {
        commandTimeout: 600,
        rampDuration: 120,
        chaosTypes: ['LATENCY_INJECTION', 'PACKET_LOSS', 'POD_TERMINATION', 'CACHE_MISS', 'DB_SLOWDOWN'],
        logRetention: 30,
        apiRateLimit: 1000,
        webhookUrl: 'https://flux.company.com/orchestrator/webhook'
      }
    });

    await settings.save();
    console.log('✅ Inserted default settings');

    console.log('✅ Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedData();
