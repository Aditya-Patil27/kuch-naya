/**
 * Performance Validator
 * 
 * Validates metrics against configurable thresholds
 * and generates detailed validation reports.
 */

class PerformanceValidator {
  constructor(settings = {}) {
    this.thresholds = settings.thresholds || this.defaultThresholds();
  }

  defaultThresholds() {
    return {
      p99Latency: 500,
      p95Latency: 400,
      p50Latency: 200,
      errorRate: 1.0,
      throughput: 1000,
      memoryUsage: 80,
      cpuUsage: 85,
      dbPool: 240,
      dbPoolLimit: 300,
      cacheHitRate: 85,
      recoveryTime: 5000
    };
  }

  /**
   * Validate job metrics against thresholds
   * @param {Object} metrics - Job metrics
   * @returns {Object} Validation report
   */
  validate(metrics) {
    const report = {
      passed: true,
      violations: [],
      warnings: [],
      metrics: {}
    };

    // Validate each metric
    this.validateLatency(metrics, report);
    this.validateErrors(metrics, report);
    this.validateThroughput(metrics, report);
    this.validateMemory(metrics, report);
    this.validateResources(metrics, report);

    return report;
  }

  /**
   * Check latency metrics
   */
  validateLatency(metrics, report) {
    if (!metrics.p99Latency) return;

    report.metrics.latency = {
      p99: metrics.p99Latency,
      p95: metrics.p95Latency || 'N/A',
      threshold: this.thresholds.p99Latency
    };

    if (metrics.p99Latency > this.thresholds.p99Latency * 1.2) {
      report.violations.push({
        type: 'LATENCY_CRITICAL',
        metric: 'P99 Latency',
        value: metrics.p99Latency,
        threshold: this.thresholds.p99Latency,
        exceeded: ((metrics.p99Latency / this.thresholds.p99Latency - 1) * 100).toFixed(0) + '%'
      });
      report.passed = false;
    } else if (metrics.p99Latency > this.thresholds.p99Latency) {
      report.warnings.push({
        type: 'LATENCY_WARNING',
        metric: 'P99 Latency',
        value: metrics.p99Latency,
        message: 'Slightly above threshold'
      });
    }
  }

  /**
   * Check error rates
   */
  validateErrors(metrics, report) {
    if (metrics.errorRate === undefined) return;

    report.metrics.errors = {
      rate: metrics.errorRate,
      threshold: this.thresholds.errorRate
    };

    if (metrics.errorRate > this.thresholds.errorRate * 2) {
      report.violations.push({
        type: 'ERROR_RATE_CRITICAL',
        metric: 'Error Rate',
        value: metrics.errorRate,
        threshold: this.thresholds.errorRate,
        exceeded: ((metrics.errorRate / this.thresholds.errorRate - 1) * 100).toFixed(0) + '%'
      });
      report.passed = false;
    } else if (metrics.errorRate > this.thresholds.errorRate) {
      report.warnings.push({
        type: 'ERROR_RATE_WARNING',
        metric: 'Error Rate',
        value: metrics.errorRate,
        message: 'Above baseline threshold'
      });
    }
  }

  /**
   * Check throughput
   */
  validateThroughput(metrics, report) {
    if (!metrics.throughput) return;

    report.metrics.throughput = {
      value: metrics.throughput,
      threshold: this.thresholds.throughput
    };

    const throughputRatio = metrics.throughput / this.thresholds.throughput;
    
    if (throughputRatio < 0.7) {
      report.violations.push({
        type: 'THROUGHPUT_CRITICAL',
        metric: 'Throughput',
        value: metrics.throughput,
        threshold: this.thresholds.throughput,
        drop: ((1 - throughputRatio) * 100).toFixed(0) + '%'
      });
      report.passed = false;
    } else if (throughputRatio < 0.85) {
      report.warnings.push({
        type: 'THROUGHPUT_WARNING',
        metric: 'Throughput',
        value: metrics.throughput,
        message: `Reduced by ${((1 - throughputRatio) * 100).toFixed(0)}%`
      });
    }
  }

  /**
   * Check memory usage
   */
  validateMemory(metrics, report) {
    if (!metrics.memoryUsage) return;

    report.metrics.memory = {
      usage: metrics.memoryUsage,
      limit: metrics.memoryLimit,
      threshold: this.thresholds.memoryUsage
    };

    if (metrics.memoryUsage > this.thresholds.memoryUsage * 1.1) {
      report.warnings.push({
        type: 'MEMORY_WARNING',
        metric: 'Memory Usage',
        value: metrics.memoryUsage,
        threshold: this.thresholds.memoryUsage
      });
    }
  }

  /**
   * Check resource utilization
   */
  validateResources(metrics, report) {
    report.metrics.resources = {};

    // CPU validation
    if (metrics.cpuUsage !== undefined) {
      report.metrics.resources.cpu = metrics.cpuUsage;
      if (metrics.cpuUsage > this.thresholds.cpuUsage) {
        report.warnings.push({
          type: 'CPU_WARNING',
          metric: 'CPU Usage',
          value: metrics.cpuUsage,
          threshold: this.thresholds.cpuUsage
        });
      }
    }

    // DB Pool validation
    if (metrics.dbConnections && metrics.dbConnectionLimit) {
      const poolUsage = (metrics.dbConnections / metrics.dbConnectionLimit) * 100;
      report.metrics.resources.dbPool = {
        used: metrics.dbConnections,
        limit: metrics.dbConnectionLimit,
        usage: poolUsage.toFixed(1)
      };

      if (poolUsage > 95) {
        report.violations.push({
          type: 'DB_POOL_CRITICAL',
          metric: 'Database Connection Pool',
          value: `${metrics.dbConnections}/${metrics.dbConnectionLimit}`,
          message: 'Pool near exhaustion'
        });
        report.passed = false;
      } else if (poolUsage > 80) {
        report.warnings.push({
          type: 'DB_POOL_WARNING',
          metric: 'Database Connection Pool',
          usage: poolUsage.toFixed(0) + '%'
        });
      }
    }

    // Cache hit rate validation
    if (metrics.cacheHitRate !== undefined) {
      report.metrics.resources.cache = metrics.cacheHitRate;
      if (metrics.cacheHitRate < this.thresholds.cacheHitRate * 0.9) {
        report.warnings.push({
          type: 'CACHE_WARNING',
          metric: 'Cache Hit Rate',
          value: metrics.cacheHitRate,
          threshold: this.thresholds.cacheHitRate
        });
      }
    }
  }

  /**
   * Get human-readable validation summary
   */
  generateSummary(report) {
    if (report.violations.length === 0 && report.warnings.length === 0) {
      return 'All metrics within acceptable range';
    }

    const parts = [];
    
    if (report.violations.length > 0) {
      parts.push(`❌ ${report.violations.length} critical violation(s) detected`);
    }
    
    if (report.warnings.length > 0) {
      parts.push(`⚠️ ${report.warnings.length} warning(s)`);
    }

    return parts.join(', ');
  }
}

module.exports = PerformanceValidator;
