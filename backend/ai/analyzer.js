/**
 * FLUX AI Analysis Engine
 * 
 * Core module for evaluating chaos test results and generating verdicts.
 * Analyzes metrics, performance impact, and chaos event resilience.
 */

class ChaosAnalyzer {
  constructor(thresholds = {}) {
    // Default performance thresholds
    this.thresholds = {
      p99Latency: 500,        // milliseconds
      errorRate: 1.0,         // percentage
      throughput: 1000,       // requests per second
      memoryUsage: 80,        // percentage
      dbPool: 240,            // connections
      cacheHitRate: 85,       // percentage
      recoveryTime: 5000,     // milliseconds
      ...thresholds
    };

    // Impact scoring weights
    this.weights = {
      latency: 0.25,
      errorRate: 0.35,
      throughput: 0.20,
      recovery: 0.20
    };
  }

  /**
   * Analyze complete job execution
   * @param {Object} job - Job document from MongoDB
   * @returns {Object} Analysis result with verdict and confidence
   */
  analyzeJob(job) {
    if (!job || !job.metrics || !job.chaosEvents) {
      throw new Error('Invalid job data: missing metrics or chaosEvents');
    }

    const analysis = {
      passed: true,
      score: 100,
      metrics: {},
      chaosResilience: {},
      strengths: [],
      observations: [],
      recommendations: [],
      verdict: 'SAFE_TO_MERGE',
      confidence: 100,
      reasoning: []
    };

    // 1. Analyze metrics against thresholds
    const metricAnalysis = this.analyzeMetrics(job.metrics);
    analysis.metrics = metricAnalysis.results;
    analysis.passed = analysis.passed && metricAnalysis.passed;
    analysis.score -= metricAnalysis.penalty;
    analysis.reasoning = analysis.reasoning.concat(metricAnalysis.reasoning);

    // 2. Analyze chaos event resilience
    const chaosAnalysis = this.analyzeChaosResilience(job.chaosEvents, job.metrics);
    analysis.chaosResilience = chaosAnalysis.results;
    analysis.passed = analysis.passed && chaosAnalysis.passed;
    analysis.score -= chaosAnalysis.penalty;
    analysis.reasoning = analysis.reasoning.concat(chaosAnalysis.reasoning);

    // 3. Generate strengths and observations
    analysis.strengths = this.generateStrengths(job, metricAnalysis, chaosAnalysis);
    analysis.observations = this.generateObservations(job, metricAnalysis, chaosAnalysis);

    // 4. Generate recommendations
    analysis.recommendations = this.generateRecommendations(job, metricAnalysis, chaosAnalysis);

    // 5. Determine final verdict and confidence
    const verdict = this.determineVerdict(analysis);
    analysis.verdict = verdict.verdict;
    analysis.confidence = verdict.confidence;

    return analysis;
  }

  /**
   * Analyze metrics against performance thresholds
   */
  analyzeMetrics(metrics) {
    const results = {};
    let passed = true;
    let penalty = 0;
    const reasoning = [];

    // P99 Latency Analysis
    if (metrics.p99Latency) {
      const latencyRatio = metrics.p99Latency / this.thresholds.p99Latency;
      results.p99Latency = {
        value: metrics.p99Latency,
        threshold: this.thresholds.p99Latency,
        ratio: latencyRatio.toFixed(2),
        status: latencyRatio > 1 ? 'CONCERN' : 'OK'
      };

      if (latencyRatio > 1.2) {
        passed = false;
        penalty += 20;
        reasoning.push(`P99 latency ${metrics.p99Latency}ms exceeds threshold ${this.thresholds.p99Latency}ms by ${((latencyRatio - 1) * 100).toFixed(0)}%`);
      } else if (latencyRatio > 1) {
        penalty += 10;
        reasoning.push(`P99 latency elevated to ${metrics.p99Latency}ms (threshold: ${this.thresholds.p99Latency}ms)`);
      } else {
        reasoning.push(`P99 latency OK: ${metrics.p99Latency}ms`);
      }
    }

    // Error Rate Analysis
    if (metrics.errorRate !== undefined) {
      const errorRatio = metrics.errorRate / this.thresholds.errorRate;
      results.errorRate = {
        value: metrics.errorRate,
        threshold: this.thresholds.errorRate,
        ratio: errorRatio.toFixed(2),
        status: errorRatio > 1 ? 'CONCERN' : 'OK'
      };

      if (errorRatio > 2) {
        passed = false;
        penalty += 25;
        reasoning.push(`Error rate ${metrics.errorRate}% exceeds threshold by ${((errorRatio - 1) * 100).toFixed(0)}%`);
      } else if (errorRatio > 1) {
        penalty += 15;
        reasoning.push(`Error rate elevated to ${metrics.errorRate}% (threshold: ${this.thresholds.errorRate}%)`);
      } else {
        reasoning.push(`Error rate safe: ${metrics.errorRate}%`);
      }
    }

    // Throughput Analysis
    if (metrics.throughput) {
      const throughputRatio = metrics.throughput / this.thresholds.throughput;
      results.throughput = {
        value: metrics.throughput,
        threshold: this.thresholds.throughput,
        ratio: throughputRatio.toFixed(2),
        status: throughputRatio < 0.8 ? 'CONCERN' : 'OK'
      };

      if (throughputRatio < 0.7) {
        passed = false;
        penalty += 20;
        reasoning.push(`Throughput ${metrics.throughput} RPS drops below threshold by ${((1 - throughputRatio) * 100).toFixed(0)}%`);
      } else if (throughputRatio < 0.85) {
        penalty += 10;
        reasoning.push(`Throughput reduced to ${metrics.throughput} RPS`);
      } else {
        reasoning.push(`Throughput maintained: ${metrics.throughput} RPS`);
      }
    }

    // Memory Analysis
    if (metrics.memoryUsage) {
      const memoryRatio = metrics.memoryUsage / this.thresholds.memoryUsage;
      results.memory = {
        value: metrics.memoryUsage,
        threshold: this.thresholds.memoryUsage,
        ratio: memoryRatio.toFixed(2),
        status: memoryRatio > 1 ? 'CONCERN' : 'OK'
      };

      if (memoryRatio > 1.1) {
        penalty += 12;
        reasoning.push(`Memory usage ${metrics.memoryUsage}% exceeds threshold ${this.thresholds.memoryUsage}%`);
      }
    }

    // DB Pool Analysis
    if (metrics.dbConnections && metrics.dbConnectionLimit) {
      const poolUsage = (metrics.dbConnections / metrics.dbConnectionLimit) * 100;
      const threshold = (this.thresholds.dbPool / 300) * 100;
      
      results.dbPool = {
        used: metrics.dbConnections,
        limit: metrics.dbConnectionLimit,
        usage: poolUsage.toFixed(1),
        status: poolUsage > 90 ? 'CRITICAL' : poolUsage > 80 ? 'CONCERN' : 'OK'
      };

      if (poolUsage > 95) {
        passed = false;
        penalty += 15;
        reasoning.push(`DB connection pool near exhaustion: ${metrics.dbConnections}/${metrics.dbConnectionLimit}`);
      } else if (poolUsage > 80) {
        penalty += 8;
        reasoning.push(`DB connection pool usage high: ${poolUsage.toFixed(0)}%`);
      }
    }

    return { results, passed, penalty, reasoning };
  }

  /**
   * Analyze resilience to chaos events
   */
  analyzeChaosResilience(chaosEvents, metrics) {
    const results = {};
    let passed = true;
    let penalty = 0;
    const reasoning = [];

    if (!Array.isArray(chaosEvents) || chaosEvents.length === 0) {
      reasoning.push('No chaos events recorded - test may not have been executed properly');
      return { results: {}, passed: false, penalty: 10, reasoning };
    }

    // Analyze each chaos event type
    const eventSummary = {};
    chaosEvents.forEach(event => {
      if (!eventSummary[event.eventType]) {
        eventSummary[event.eventType] = {
          count: 0,
          maxImpact: 'LOW'
        };
      }
      eventSummary[event.eventType].count += event.eventCount || 1;
      
      // Track highest impact level
      const impactLevel = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
      const currentLevel = impactLevel[event.impact] || 0;
      const maxLevel = impactLevel[eventSummary[event.eventType].maxImpact] || 0;
      if (currentLevel > maxLevel) {
        eventSummary[event.eventType].maxImpact = event.impact;
      }
    });

    // Evaluate resilience per event type
    Object.entries(eventSummary).forEach(([eventType, summary]) => {
      const impactScore = this.getImpactScore(eventType, summary.maxImpact);
      results[eventType] = {
        count: summary.count,
        maxImpact: summary.maxImpact,
        score: impactScore,
        resilient: impactScore < 50
      };

      if (impactScore > 70) {
        penalty += 15;
        passed = false;
        reasoning.push(`${eventType} caused severe impact (score: ${impactScore})`);
      } else if (impactScore > 50) {
        penalty += 8;
        reasoning.push(`${eventType} caused moderate degradation (${summary.count} events)`);
      } else {
        reasoning.push(`${eventType} handled well (${summary.count} events, impact score: ${impactScore})`);
      }
    });

    return { results, passed, penalty, reasoning };
  }

  /**
   * Calculate impact score for chaos event
   */
  getImpactScore(eventType, impactLevel) {
    const baseScores = {
      'LATENCY_INJECTION': { 'HIGH': 65, 'MEDIUM': 35, 'LOW': 15 },
      'PACKET_LOSS': { 'HIGH': 70, 'MEDIUM': 40, 'LOW': 20 },
      'POD_TERMINATION': { 'HIGH': 80, 'MEDIUM': 50, 'LOW': 25 },
      'CACHE_MISS': { 'HIGH': 45, 'MEDIUM': 25, 'LOW': 10 },
      'DB_SLOWDOWN': { 'HIGH': 75, 'MEDIUM': 45, 'LOW': 20 },
      'MEMORY_LEAK': { 'HIGH': 85, 'MEDIUM': 55, 'LOW': 30 }
    };

    return baseScores[eventType]?.[impactLevel] || 50;
  }

  /**
   * Generate strength observations
   */
  generateStrengths(job, metricAnalysis, chaosAnalysis) {
    const strengths = [];

    // Well-handled latency
    if (metricAnalysis.results.p99Latency?.ratio < 0.8) {
      strengths.push('Excellent latency performance under chaos');
    }

    // Low error rate
    if (metricAnalysis.results.errorRate?.value < 0.5) {
      strengths.push('Robust error handling - minimal error rates');
    }

    // Maintained throughput
    if (metricAnalysis.results.throughput?.ratio > 0.9) {
      strengths.push('Throughput maintained well under stress');
    }

    // Resilient to chaos
    const resilientEvents = Object.values(chaosAnalysis.results || {})
      .filter(e => e.resilient).length;
    if (resilientEvents > 2) {
      strengths.push(`Resilient to ${resilientEvents} chaos event types`);
    }

    // Stable memory
    if (metricAnalysis.results.memory?.ratio < 0.8) {
      strengths.push('Memory usage stable and efficient');
    }

    // Code optimization indicator
    if (job.codeChanges?.summary) {
      strengths.push(`Code optimization: ${job.codeChanges.summary}`);
    }

    return strengths.length > 0 ? strengths : ['Passed basic chaos testing'];
  }

  /**
   * Generate observation points
   */
  generateObservations(job, metricAnalysis, chaosAnalysis) {
    const observations = [];

    // Check for warning signs
    if (metricAnalysis.results.p99Latency?.ratio > 1) {
      observations.push('P99 latency shows room for optimization');
    }

    if (metricAnalysis.results.dbPool?.status === 'CONCERN') {
      observations.push('Database connection pool usage trending high');
    }

    // Recovery patterns
    const hasRecovery = Object.values(chaosAnalysis.results || {})
      .some(e => e.score < 50);
    if (hasRecovery) {
      observations.push('System recovers well from chaos events');
    }

    // No critical issues
    if (metricAnalysis.penalty < 15) {
      observations.push('No critical performance issues detected');
    }

    return observations;
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(job, metricAnalysis, chaosAnalysis) {
    const recommendations = [];

    // Latency recommendations
    if (metricAnalysis.results.p99Latency?.ratio > 1.1) {
      recommendations.push('Consider caching frequently accessed queries');
      recommendations.push('Review database query execution plans');
    }

    // Error rate recommendations
    if (metricAnalysis.results.errorRate?.value > 0.5) {
      recommendations.push('Implement circuit breaker pattern for external dependencies');
      recommendations.push('Add retry logic with exponential backoff');
    }

    // Throughput recommendations
    if (metricAnalysis.results.throughput?.ratio < 0.85) {
      recommendations.push('Optimize request handling pipeline');
      recommendations.push('Consider connection pooling improvements');
    }

    // DB pool recommendations
    if (metricAnalysis.results.dbPool?.status === 'CONCERN') {
      recommendations.push('Increase database connection pool size');
      recommendations.push('Review long-running transactions');
    }

    // Memory recommendations
    if (metricAnalysis.results.memory?.ratio > 0.9) {
      recommendations.push('Profile memory usage for leaks');
      recommendations.push('Consider garbage collection tuning');
    }

    // General recommendations
    if (Object.values(chaosAnalysis.results || {}).some(e => e.score > 60)) {
      recommendations.push('Add more comprehensive error handling');
      recommendations.push('Implement monitoring for chaos impact signals');
    }

    return recommendations;
  }

  /**
   * Determine final verdict and confidence
   */
  determineVerdict(analysis) {
    let verdict = 'SAFE_TO_MERGE';
    let confidence = 100;

    // Not passed = needs review or unsafe
    if (!analysis.passed) {
      verdict = analysis.score < 40 ? 'UNSAFE' : 'NEEDS_REVIEW';
      confidence = Math.max(50, 100 - analysis.penalty);
    } else if (analysis.score < 80) {
      verdict = 'NEEDS_REVIEW';
      confidence = 75;
    } else if (analysis.score < 90) {
      confidence = 90;
    }

    return { verdict, confidence: Math.min(99, Math.max(50, confidence)) };
  }
}

module.exports = ChaosAnalyzer;
