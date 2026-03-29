const express = require('express');
const router = express.Router();
const { Job, Metrics } = require('../models/schemas');

// GET /api/dashboard/summary - Get dashboard summary metrics
router.get('/summary', async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Count jobs by status
    const statusCounts = await Job.aggregate([
      { $match: { createdAt: { $gte: last24h } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate success rate
    const allJobs24h = await Job.find({ createdAt: { $gte: last24h } });
    const passCount = allJobs24h.filter(j => j.status === 'PASS').length;
    const successRate = allJobs24h.length > 0 ? (passCount / allJobs24h.length * 100).toFixed(2) : 0;

    // Average duration
    const avgDuration = allJobs24h.length > 0 
      ? Math.round(allJobs24h.reduce((sum, j) => sum + (j.duration || 0), 0) / allJobs24h.length)
      : 0;

    // Total chaos events
    const totalChaosEvents = allJobs24h.reduce((sum, j) => {
      return sum + j.chaosEvents.reduce((es, e) => es + (e.eventCount || 0), 0);
    }, 0);

    // Average metrics
    const jobsWithMetrics = allJobs24h.filter(j => j.metrics);
    const avgMetrics = {
      p99Latency: jobsWithMetrics.length > 0 
        ? Math.round(jobsWithMetrics.reduce((sum, j) => sum + (j.metrics.p99Latency || 0), 0) / jobsWithMetrics.length)
        : 0,
      errorRate: jobsWithMetrics.length > 0 
        ? (jobsWithMetrics.reduce((sum, j) => sum + (j.metrics.errorRate || 0), 0) / jobsWithMetrics.length).toFixed(2)
        : 0,
      throughput: jobsWithMetrics.length > 0 
        ? Math.round(jobsWithMetrics.reduce((sum, j) => sum + (j.metrics.throughput || 0), 0) / jobsWithMetrics.length)
        : 0
    };

    res.json({
      success: true,
      data: {
        totalPRsTested: allJobs24h.length,
        totalChaosEvents,
        successRate: parseFloat(successRate),
        avgDuration,
        statusBreakdown: statusCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        metrics: avgMetrics
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/recent-runs - Get recent job runs
router.get('/recent-runs', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const runs = await Job.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('jobId prNumber repository status duration startTime endTime metrics chaosEvents title author');

    res.json({ success: true, data: runs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/queue-stats - Get current queue statistics
router.get('/queue-stats', async (req, res) => {
  try {
    const total = await Job.countDocuments();
    const active = await Job.countDocuments({ status: 'RUNNING' });
    const queued = await Job.countDocuments({ status: { $in: ['PENDING', 'RUNNING'] } });
    const passed = await Job.countDocuments({ status: 'PASS' });
    const blocked = await Job.countDocuments({ status: 'BLOCKED' });

    res.json({
      success: true,
      data: {
        total,
        active,
        queued,
        passed,
        blocked,
        successRate: total > 0 ? ((passed / total) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/performance-trends - Get performance over time
router.get('/performance-trends', async (req, res) => {
  try {
    const days = req.query.days || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends = await Job.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['PASS', 'BLOCKED', 'FAILED'] }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalJobs: { $sum: 1 },
          passCount: {
            $sum: { $cond: [{ $eq: ['$status', 'PASS'] }, 1, 0] }
          },
          blockedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'BLOCKED'] }, 1, 0] }
          },
          avgDuration: { $avg: '$duration' },
          avgP99Latency: { $avg: '$metrics.p99Latency' },
          avgErrorRate: { $avg: '$metrics.errorRate' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ success: true, data: trends });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/chaos-breakdown - Get chaos events breakdown
router.get('/chaos-breakdown', async (req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const breakdown = await Job.aggregate([
      {
        $match: { createdAt: { $gte: last24h } }
      },
      {
        $unwind: '$chaosEvents'
      },
      {
        $group: {
          _id: '$chaosEvents.eventType',
          count: { $sum: '$chaosEvents.eventCount' },
          avgImpact: { $avg: { $cond: [{ $eq: ['$chaosEvents.impact', 'HIGH'] }, 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({ success: true, data: breakdown });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
