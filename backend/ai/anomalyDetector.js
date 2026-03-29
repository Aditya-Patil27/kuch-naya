/**
 * Anomaly Detector
 * 
 * Detects unusual patterns in metrics and chaos resilience.
 * Identifies performance regressions, memory leaks, and other anomalies.
 */

class AnomalyDetector {
  constructor(historyLength = 10) {
    this.historyLength = historyLength;
  }

  /**
   * Detect anomalies in a job compared to historical baseline
   * @param {Object} job - Current job
   * @param {Array} historicalJobs - Previous jobs for baseline
   * @returns {Object} Anomaly report
   */
  detectAnomalies(job, historicalJobs = []) {
    const report = {
      hasAnomalies: false,
      anomalies: [],
      baseline: {},
      score: 100
    };

    if (historicalJobs.length < 2) {
      report.anomalies.push({
        type: 'INSUFFICIENT_HISTORY',
        severity: 'INFO',
        message: 'Not enough historical data for baseline comparison'
      });
      return report;
    }

    // Calculate baseline from historical data
    report.baseline = this.calculateBaseline(historicalJobs);

    // Detect metric anomalies
    this.detectMetricAnomalies(job, report);

    // Detect performance regressions
    this.detectPerformanceRegression(job, report);

    // Detect memory leaks
    this.detectMemoryLeaks(job, historicalJobs, report);

    // Detect chaos anomalies
    this.detectChaosAnomalies(job, report);

    report.hasAnomalies = report.anomalies.length > 0;
    return report;
  }

  /**
   * Calculate baseline statistics from history
   */
  calculateBaseline(historicalJobs) {
    const baseline = {
      p99Latency: { mean: 0, stdDev: 0, min: 0, max: 0 },
      errorRate: { mean: 0, stdDev: 0, min: 0, max: 0 },
      throughput: { mean: 0, stdDev: 0, min: 0, max: 0 },
      duration: { mean: 0, stdDev: 0, min: 0, max: 0 }
    };

    // Collect metric values
    const metrics = {
      p99Latency: [],
      errorRate: [],
      throughput: [],
      duration: []
    };

    historicalJobs.forEach(job => {
      if (job.metrics.p99Latency) metrics.p99Latency.push(job.metrics.p99Latency);
      if (job.metrics.errorRate !== undefined) metrics.errorRate.push(job.metrics.errorRate);
      if (job.metrics.throughput) metrics.throughput.push(job.metrics.throughput);
      if (job.duration) metrics.duration.push(job.duration);
    });

    // Calculate statistics for each metric
    Object.entries(metrics).forEach(([key, values]) => {
      if (values.length === 0) return;

      baseline[key].mean = this.calculateMean(values);
      baseline[key].stdDev = this.calculateStdDev(values);
      baseline[key].min = Math.min(...values);
      baseline[key].max = Math.max(...values);
    });

    return baseline;
  }

  /**
   * Detect anomalies in individual metrics
   */
  detectMetricAnomalies(job, report) {
    const stats = report.baseline;

    // P99 Latency anomaly
    if (job.metrics.p99Latency && stats.p99Latency.mean > 0) {
      const zScore = (job.metrics.p99Latency - stats.p99Latency.mean) / (stats.p99Latency.stdDev || 1);
      if (zScore > 3) {
        report.anomalies.push({
          type: 'LATENCY_SPIKE',
          severity: 'HIGH',
          metric: 'P99 Latency',
          value: job.metrics.p99Latency,
          baseline: stats.p99Latency.mean,
          deviation: ((job.metrics.p99Latency / stats.p99Latency.mean - 1) * 100).toFixed(0) + '%',
          zScore: zScore.toFixed(2),
          message: `Latency spike detected: ${((job.metrics.p99Latency / stats.p99Latency.mean - 1) * 100).toFixed(0)}% above baseline`
        });
        report.score -= 15;
      }
    }

    // Error rate anomaly
    if (job.metrics.errorRate !== undefined && stats.errorRate.mean >= 0) {
      if (job.metrics.errorRate > stats.errorRate.max * 1.5) {
        report.anomalies.push({
          type: 'ERROR_RATE_SPIKE',
          severity: 'HIGH',
          metric: 'Error Rate',
          value: job.metrics.errorRate,
          baseline: stats.errorRate.mean,
          increase: ((job.metrics.errorRate / stats.errorRate.mean - 1) * 100).toFixed(0) + '%',
          message: `Unusual error rate spike: ${job.metrics.errorRate}% vs baseline ${stats.errorRate.mean.toFixed(2)}%`
        });
        report.score -= 20;
      }
    }

    // Throughput anomaly
    if (job.metrics.throughput && stats.throughput.mean > 0) {
      const drop = (1 - job.metrics.throughput / stats.throughput.mean) * 100;
      if (drop > 30) {
        report.anomalies.push({
          type: 'THROUGHPUT_DROP',
          severity: 'HIGH',
          metric: 'Throughput',
          value: job.metrics.throughput,
          baseline: stats.throughput.mean,
          drop: drop.toFixed(0) + '%',
          message: `Significant throughput degradation: ${drop.toFixed(0)}% drop from baseline`
        });
        report.score -= 15;
      }
    }
  }

  /**
   * Detect performance regression compared to baseline
   */
  detectPerformanceRegression(job, report) {
    const stats = report.baseline;

    // Overall regression detection
    if (job.duration && stats.duration.mean > 0) {
      const durationIncrease = ((job.duration / stats.duration.mean - 1) * 100);
      
      if (durationIncrease > 50) {
        report.anomalies.push({
          type: 'PERFORMANCE_REGRESSION',
          severity: 'MEDIUM',
          metric: 'Execution Duration',
          value: job.duration,
          baseline: stats.duration.mean,
          increase: durationIncrease.toFixed(0) + '%',
          message: `Test duration ${durationIncrease.toFixed(0)}% longer than baseline`
        });
        report.score -= 10;
      }
    }
  }

  /**
   * Detect possible memory leaks
   */
  detectMemoryLeaks(job, historicalJobs, report) {
    if (!job.metrics.memoryUsage || !historicalJobs.length) return;

    // Get recent memory trend
    const recentMemory = historicalJobs
      .slice(-5)
      .map(j => j.metrics.memoryUsage)
      .filter(m => m);

    if (recentMemory.length < 3) return;

    // Calculate memory trend
    const trend = this.calculateTrend(recentMemory);
    
    if (trend > 5) {
      // Memory usage increasing by >5% per execution
      report.anomalies.push({
        type: 'POTENTIAL_MEMORY_LEAK',
        severity: 'MEDIUM',
        metric: 'Memory Usage',
        current: job.metrics.memoryUsage,
        trend: trend.toFixed(1) + '%/execution',
        message: `Memory usage trending up by ${trend.toFixed(1)}% per execution - possible leak`
      });
      report.score -= 12;
    }

    // Check for high memory usage
    if (job.metrics.memoryUsage > 85) {
      report.anomalies.push({
        type: 'HIGH_MEMORY_USAGE',
        severity: 'MEDIUM',
        metric: 'Memory Usage',
        value: job.metrics.memoryUsage,
        message: `Memory usage at ${job.metrics.memoryUsage}% - very close to limit`
      });
      report.score -= 8;
    }
  }

  /**
   * Detect anomalies in chaos event handling
   */
  detectChaosAnomalies(job, report) {
    if (!job.chaosEvents || job.chaosEvents.length === 0) {
      report.anomalies.push({
        type: 'NO_CHAOS_EVENTS',
        severity: 'WARNING',
        message: 'No chaos events were recorded - test may not have executed properly'
      });
      return;
    }

    // Check for unexpected high impact
    const highImpactEvents = job.chaosEvents.filter(e => e.impact === 'HIGH');
    if (highImpactEvents.length > 3) {
      report.anomalies.push({
        type: 'EXCESSIVE_CHAOS_IMPACT',
        severity: 'MEDIUM',
        count: highImpactEvents.length,
        message: `${highImpactEvents.length} chaos events with HIGH impact - unusual resilience issues`
      });
      report.score -= 10;
    }

    // Check for missing event types
    if (job.chaosEvents.length < 3) {
      report.anomalies.push({
        type: 'LIMITED_CHAOS_COVERAGE',
        severity: 'INFO',
        count: job.chaosEvents.length,
        message: `Limited chaos event coverage - only ${job.chaosEvents.length} event type(s) tested`
      });
    }
  }

  /**
   * Calculate mean of array
   */
  calculateMean(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(values) {
    if (values.length === 0) return 0;
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate trend direction (percentage change per item)
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    let totalChange = 0;
    for (let i = 1; i < values.length; i++) {
      const change = (values[i] - values[i-1]) / values[i-1] * 100;
      totalChange += change;
    }
    
    return totalChange / (values.length - 1);
  }
}

module.exports = AnomalyDetector;
