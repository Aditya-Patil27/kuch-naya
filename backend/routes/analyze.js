const express = require('express');
const router = express.Router();
const { Job, Settings } = require('../models/schemas');
const ChaosAnalyzer = require('../ai/analyzer');
const PerformanceValidator = require('../ai/performanceValidator');
const CommentGenerator = require('../ai/commentGenerator');
const AnomalyDetector = require('../ai/anomalyDetector');

/**
 * POST /api/analyze/:jobId
 * Run full AI analysis on a job
 */
router.post('/:jobId', async (req, res) => {
  try {
    // Get job data
    const job = await Job.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Get settings for thresholds
    const settings = await Settings.findOne({ settingId: 'global' });
    const thresholds = settings?.thresholds || {};

    // Initialize analyzers
    const analyzer = new ChaosAnalyzer(thresholds);
    const validator = new PerformanceValidator({ thresholds });
    const commentGenerator = new CommentGenerator();
    const anomalyDetector = new AnomalyDetector();

    // 1. Chaos Analysis
    const analysis = analyzer.analyzeJob(job);

    // 2. Performance Validation
    const validation = validator.validate(job.metrics);

    // 3. Anomaly Detection (with historical data)
    const historicalJobs = await Job.find({ repository: job.repository, status: 'PASS' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('metrics duration chaosEvents');
    
    const anomalies = anomalyDetector.detectAnomalies(job, historicalJobs);

    // 4. Generate GitHub Comment
    const githubComment = commentGenerator.generateComment(job, analysis);

    // 5. Prepare comprehensive result
    const result = {
      jobId: job.jobId,
      prNumber: job.prNumber,
      repository: job.repository,
      analysis: {
        verdict: analysis.verdict,
        confidence: analysis.confidence,
        score: analysis.score,
        passed: analysis.passed,
        strengths: analysis.strengths,
        observations: analysis.observations,
        recommendations: analysis.recommendations,
        reasoning: analysis.reasoning.slice(0, 10) // Top 10 reasoning points
      },
      validation: {
        passed: validation.passed,
        summary: validator.generateSummary(validation),
        violations: validation.violations,
        warnings: validation.warnings,
        metrics: validation.metrics
      },
      anomalies: {
        detected: anomalies.hasAnomalies,
        count: anomalies.anomalies.length,
        anomalies: anomalies.anomalies,
        anomalyScore: anomalies.score
      },
      githubComment: githubComment,
      timestamp: new Date().toISOString()
    };

    // Save analysis result to job
    await Job.findOneAndUpdate(
      { jobId: req.params.jobId },
      {
        aiAnalysis: {
          verdict: analysis.verdict,
          confidence: analysis.confidence,
          strengths: analysis.strengths,
          observations: analysis.observations,
          recommendations: analysis.recommendations
        },
        updatedAt: new Date()
      }
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analyze/:jobId
 * Get pre-computed analysis for a job
 */
router.get('/:jobId', async (req, res) => {
  try {
    const job = await Job.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (!job.aiAnalysis) {
      return res.status(404).json({ 
        success: false, 
        error: 'Job has not been analyzed yet. POST to /api/analyze/:jobId to run analysis.' 
      });
    }

    res.json({
      success: true,
      data: {
        jobId: job.jobId,
        prNumber: job.prNumber,
        analysis: job.aiAnalysis
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analyze/batch/queue
 * Analyze all jobs in queue
 */
router.post('/batch/queue', async (req, res) => {
  try {
    const jobs = await Job.find({ status: 'RUNNING' });
    
    const settings = await Settings.findOne({ settingId: 'global' });
    const thresholds = settings?.thresholds || {};
    const analyzer = new ChaosAnalyzer(thresholds);

    const results = [];
    for (const job of jobs) {
      try {
        const analysis = analyzer.analyzeJob(job);
        results.push({
          jobId: job.jobId,
          verdict: analysis.verdict,
          confidence: analysis.confidence
        });

        // Update job
        await Job.findOneAndUpdate(
          { jobId: job.jobId },
          {
            status: analysis.verdict === 'SAFE_TO_MERGE' ? 'PASS' : 'BLOCKED',
            aiAnalysis: analysis
          }
        );
      } catch (error) {
        results.push({
          jobId: job.jobId,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      analyzed: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analyze/compare
 * Compare two jobs and analyze differences
 */
router.post('/compare', async (req, res) => {
  try {
    const { jobId1, jobId2 } = req.body;

    if (!jobId1 || !jobId2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both jobId1 and jobId2 are required' 
      });
    }

    const job1 = await Job.findOne({ jobId: jobId1 });
    const job2 = await Job.findOne({ jobId: jobId2 });

    if (!job1 || !job2) {
      return res.status(404).json({ success: false, error: 'One or both jobs not found' });
    }

    // Compare metrics
    const comparison = {
      job1Id: job1.jobId,
      job2Id: job2.jobId,
      metrics: this.compareMetrics(job1.metrics, job2.metrics),
      chaosEvents: this.compareChaosEvents(job1.chaosEvents, job2.chaosEvents),
      verdict: job1.aiAnalysis?.verdict || 'N/A',
      improvement: this.calculateImprovement(job1, job2)
    };

    res.json({ success: true, data: comparison });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper: Compare metrics between jobs
 */
function compareMetrics(metrics1, metrics2) {
  const comparison = {};

  if (metrics1.p99Latency && metrics2.p99Latency) {
    const change = ((metrics2.p99Latency - metrics1.p99Latency) / metrics1.p99Latency * 100);
    comparison.p99Latency = {
      before: metrics1.p99Latency,
      after: metrics2.p99Latency,
      change: change.toFixed(1) + '%',
      improved: change < 0
    };
  }

  if (metrics1.errorRate !== undefined && metrics2.errorRate !== undefined) {
    const change = metrics2.errorRate - metrics1.errorRate;
    comparison.errorRate = {
      before: metrics1.errorRate,
      after: metrics2.errorRate,
      change: change.toFixed(2) + '%',
      improved: change < 0
    };
  }

  if (metrics1.throughput && metrics2.throughput) {
    const change = ((metrics2.throughput - metrics1.throughput) / metrics1.throughput * 100);
    comparison.throughput = {
      before: metrics1.throughput,
      after: metrics2.throughput,
      change: change.toFixed(1) + '%',
      improved: change > 0
    };
  }

  return comparison;
}

/**
 * Helper: Compare chaos events
 */
function compareChaosEvents(events1, events2) {
  const summary = {
    previousEventCount: events1?.length || 0,
    currentEventCount: events2?.length || 0,
    change: (events2?.length || 0) - (events1?.length || 0)
  };

  return summary;
}

/**
 * Helper: Calculate improvement
 */
function calculateImprovement(job1, job2) {
  let score = 0;

  if (job1.metrics && job2.metrics) {
    if (job2.metrics.p99Latency < job1.metrics.p99Latency) score += 10;
    if (job2.metrics.errorRate < job1.metrics.errorRate) score += 10;
    if (job2.metrics.throughput > job1.metrics.throughput) score += 10;
  }

  return {
    improvementScore: score,
    status: score > 15 ? 'IMPROVED' : score > 5 ? 'UNCHANGED' : 'DEGRADED'
  };
}

module.exports = router;
