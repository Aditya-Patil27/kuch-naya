# FLUX AI Analysis Engine

**Advanced chaos testing evaluation and intelligent recommendations**

---

## 📋 Overview

The AI Analysis Engine evaluates FLUX chaos test results and generates:

1. **Chaos Analysis** - Evaluate test execution and chaos event resilience
2. **Performance Validation** - Check metrics against configurable thresholds
3. **Anomaly Detection** - Identify unusual patterns and regressions
4. **GitHub Comments** - Generate professional PR feedback
5. **Recommendations** - Actionable insights for improvements

---

## 🏗️ Architecture

### Components

```
ai/
├── analyzer.js                    # Core chaos analysis engine
├── performanceValidator.js        # Threshold validation
├── commentGenerator.js            # GitHub comment generation
├── anomalyDetector.js            # Pattern anomaly detection
└── (integrated via routes/analyze.js)
```

### Analysis Flow

```
Job Data
   ↓
ChaosAnalyzer (Evaluate resilience & metrics)
   ↓
PerformanceValidator (Check thresholds)
   ↓
AnomalyDetector (Detect patterns)
   ↓
CommentGenerator (Create GitHub feedback)
   ↓
Analysis Result + GitHub Comment
```

---

## 🔍 Analysis Components

### 1. Chaos Analyzer

Evaluates chaos test execution and generates verdicts.

**What it does:**
- Analyzes metrics against thresholds
- Evaluates resilience to chaos events
- Generates strengths and observations
- Calculates impact scores per event type
- Determines final verdict (SAFE_TO_MERGE, NEEDS_REVIEW, UNSAFE)

**Verdict System:**

| Verdict | Score | Meaning | Action |
|---------|-------|---------|--------|
| SAFE_TO_MERGE | 80+ | Ready for production | Auto-approve |
| NEEDS_REVIEW | 50-80 | Minor concerns | Request review |
| UNSAFE | <50 | Critical issues | Block merge |

**Example:**
```javascript
const analyzer = new ChaosAnalyzer({
  p99Latency: 500,
  errorRate: 1.0,
  throughput: 1000
});

const analysis = analyzer.analyzeJob(job);
console.log(analysis.verdict);        // "SAFE_TO_MERGE"
console.log(analysis.confidence);     // 94
console.log(analysis.score);          // 92
```

### 2. Performance Validator

Validates metrics against configurable thresholds.

**Default Thresholds:**
```javascript
{
  p99Latency: 500,      // milliseconds
  p95Latency: 400,
  p50Latency: 200,
  errorRate: 1.0,       // percentage
  throughput: 1000,     // RPS
  memoryUsage: 80,      // percentage
  cpuUsage: 85,         // percentage
  dbPool: 240,          // connections
  cacheHitRate: 85,     // percentage
  recoveryTime: 5000    // milliseconds
}
```

**Validation Levels:**
- ✅ **OK** - Within threshold
- ⚠️ **Warning** - Above threshold but acceptable
- ❌ **Violation** - Critical threshold breach

**Example:**
```javascript
const validator = new PerformanceValidator({ thresholds });
const report = validator.validate(job.metrics);

if (!report.passed) {
  console.log('Critical violations:', report.violations);
  console.log('Warnings:', report.warnings);
}
```

### 3. Anomaly Detector

Detects unusual patterns by comparing to historical baselines.

**Detection Types:**
- **Latency Spike** - P99 latency >3σ above baseline
- **Error Rate Spike** - Error rate >150% of historical max
- **Throughput Drop** - >30% reduction from baseline
- **Performance Regression** - Duration >50% longer than baseline
- **Memory Leak** - Memory trending up >5% per execution
- **Chaos Anomalies** - Unusual chaos event handling

**Example:**
```javascript
const detector = new AnomalyDetector();
const historicalJobs = await Job.find(...).limit(10);
const anomalies = detector.detectAnomalies(currentJob, historicalJobs);

if (anomalies.hasAnomalies) {
  anomalies.anomalies.forEach(a => {
    console.log(`${a.type}: ${a.message}`);
  });
}
```

### 4. Comment Generator

Creates professional GitHub comments from analysis results.

**Output Sections:**
1. Verdict with confidence
2. Performance metrics table
3. Chaos events summary
4. Strengths highlighting
5. Recommendations
6. Code changes (if available)

**Example Comment:**
```markdown
## FLUX AI Chaos Reviewer

✅ **SAFE_TO_MERGE** | Confidence: 94%

### 📊 Performance Metrics

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| P99 Latency | 247ms | 500ms | ✅ |
| Error Rate | 0.3% | 1% | ✅ |
| Throughput | 1,240 RPS | 1,000 RPS | ✅ |

### ⚡ Chaos Events

| Event Type | Count | Impact | Resilience |
|------------|-------|--------|------------|
| LATENCY_INJECTION | 1 | HIGH | ✅ Resilient |
| CACHE_MISS | 1 | MEDIUM | ✅ Resilient |
```

---

## 📡 API Endpoints

### Analysis Endpoints

#### POST /api/analyze/:jobId
Run full AI analysis on a job.

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job-001",
    "prNumber": 402,
    "analysis": {
      "verdict": "SAFE_TO_MERGE",
      "confidence": 94,
      "score": 92,
      "passed": true,
      "strengths": [
        "Excellent latency performance under chaos",
        "Robust error handling - minimal error rates"
      ],
      "recommendations": [],
      "reasoning": [
        "P99 latency OK: 247ms",
        "Error rate safe: 0.3%",
        ...
      ]
    },
    "validation": {
      "passed": true,
      "violations": [],
      "warnings": []
    },
    "anomalies": {
      "detected": false,
      "anomalies": []
    },
    "githubComment": "## FLUX AI Chaos Reviewer\n\n✅ **SAFE_TO_MERGE**..."
  }
}
```

#### GET /api/analyze/:jobId
Get pre-computed analysis for a job.

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job-001",
    "analysis": { ... }
  }
}
```

#### POST /api/analyze/batch/queue
Analyze all running jobs in queue.

**Response:**
```json
{
  "success": true,
  "analyzed": 3,
  "data": [
    { "jobId": "job-001", "verdict": "SAFE_TO_MERGE", "confidence": 94 },
    { "jobId": "job-002", "verdict": "NEEDS_REVIEW", "confidence": 72 }
  ]
}
```

#### POST /api/analyze/compare
Compare two jobs and analyze differences.

**Request:**
```json
{
  "jobId1": "job-001",
  "jobId2": "job-002"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "job1Id": "job-001",
    "job2Id": "job-002",
    "metrics": {
      "p99Latency": {
        "before": 247,
        "after": 198,
        "change": "-19.8%",
        "improved": true
      }
    },
    "improvement": {
      "improvementScore": 30,
      "status": "IMPROVED"
    }
  }
}
```

---

## 🎯 Analysis Scoring

### Confidence Score
Ranges from 50% (low confidence) to 100% (high confidence)

**Factors:**
- Number of test signals (reasoning points)
- Data completeness (all metrics present)
- Historical data availability
- Chaos coverage

### Impact Score (per chaos event)
Ranges from 0 (no impact) to 100 (complete failure)

**Event Scores:**
- LATENCY_INJECTION: HIGH=65, MEDIUM=35, LOW=15
- PACKET_LOSS: HIGH=70, MEDIUM=40, LOW=20
- POD_TERMINATION: HIGH=80, MEDIUM=50, LOW=25
- CACHE_MISS: HIGH=45, MEDIUM=25, LOW=10
- DB_SLOWDOWN: HIGH=75, MEDIUM=45, LOW=20
- MEMORY_LEAK: HIGH=85, MEDIUM=55, LOW=30

### Overall Score
Penalized based on:
- Metric violations (-10 to -25 per violation)
- Chaos resilience issues (-8 to -15 per event)
- Performance degradation (-10 to -20)
- Anomalies (-8 to -20 per anomaly)

---

## 💡 Recommendations Engine

Generates actionable recommendations based on analysis.

**Categories:**

1. **Performance Optimization**
   - "Consider caching frequently accessed queries"
   - "Optimize request handling pipeline"
   - "Review database query execution plans"

2. **Resilience Improvements**
   - "Implement circuit breaker pattern"
   - "Add retry logic with exponential backoff"
   - "Increase database connection pool size"

3. **Resource Management**
   - "Profile memory usage for leaks"
   - "Review long-running transactions"
   - "Consider connection pooling improvements"

4. **Monitoring & Alerting**
   - "Add monitoring for chaos impact signals"
   - "Implement comprehensive error handling"
   - "Set up performance regression alerts"

---

## 📊 Anomaly Detection Examples

### Latency Spike Detection
```
Historical Baseline: 200ms ± 20ms (mean ± std dev)
Current Execution: 600ms
Z-Score: 20 standard deviations above mean
Detection: ANOMALY - Latency Spike (200% increase)
```

### Memory Leak Detection
```
Recent History: [320MB, 340MB, 360MB, 380MB, 400MB]
Trend: +5% per execution
Detection: ANOMALY - Potential Memory Leak
```

### Performance Regression
```
Baseline Duration: 260s
Current Duration: 400s
Change: +54%
Detection: ANOMALY - Performance Regression
```

---

## 🚀 Usage Examples

### Basic Analysis
```javascript
const ChaosAnalyzer = require('./ai/analyzer');

const analyzer = new ChaosAnalyzer({
  p99Latency: 500,
  errorRate: 1.0
});

const job = await Job.findOne({ jobId: 'job-001' });
const result = analyzer.analyzeJob(job);

console.log(`Verdict: ${result.verdict}`);
console.log(`Confidence: ${result.confidence}%`);
console.log(`Strengths: ${result.strengths.join(', ')}`);
```

### Full Analysis via API
```bash
curl -X POST http://localhost:5000/api/analyze/job-001 \
  -H "Content-Type: application/json"
```

### Compare Two Jobs
```bash
curl -X POST http://localhost:5000/api/analyze/compare \
  -H "Content-Type: application/json" \
  -d '{"jobId1":"job-001","jobId2":"job-002"}'
```

### Batch Analysis
```bash
curl -X POST http://localhost:5000/api/analyze/batch/queue \
  -H "Content-Type: application/json"
```

---

## 🔧 Configuration

### Custom Thresholds
Set via MongoDB Settings or API:

```bash
curl -X PATCH http://localhost:5000/api/settings/thresholds \
  -H "Content-Type: application/json" \
  -d '{
    "thresholds": {
      "p99Latency": 600,
      "errorRate": 0.5,
      "throughput": 1200
    }
  }'
```

### Anomaly Detection Sensitivity
Increase history length for more accurate baselines:

```javascript
const detector = new AnomalyDetector(30); // Use last 30 jobs
```

---

## 📈 Analytics & Reporting

### Verdict Distribution (24h)
```
SAFE_TO_MERGE: 94.2% (233/247)
NEEDS_REVIEW:  4.9%  (12/247)
UNSAFE:        0.9%  (2/247)
```

### Common Issues
```
1. Database Connection Pool Exhaustion (23% of NEEDS_REVIEW)
2. P99 Latency Elevation (19%)
3. Error Rate Spikes (18%)
4. Throughput Degradation (15%)
```

### Performance Trends
```
Average P99 Latency: 247ms ↓ 2.4% vs last week
Average Error Rate:  0.3%  → stable
Average Throughput:  1240 RPS ↑ 5.1% vs last week
```

---

## 🎓 Advanced Topics

### Custom Impact Scores
Override event impact calculation:

```javascript
analyzer.getImpactScore = (eventType, impactLevel) => {
  // Custom scoring logic
  return customScore;
};
```

### Historical Baseline Optimization
Use weighted history for more recent emphasis:

```javascript
const recentJobs = historicalJobs.map((job, idx) => ({
  ...job,
  weight: idx / historicalJobs.length // Recent jobs weighted higher
}));
```

### Confidence Calibration
Adjust confidence thresholds:

```javascript
const confidenceThresholds = {
  minRequiredSignals: 8,
  minHistoricalGaps: 5,
  minDataCompleteness: 0.8
};
```

---

## ✅ Testing the Analysis

```bash
# 1. Start backend
cd backend
npm run dev

# 2. Seed sample data
npm run seed

# 3. Test analysis on sample job
curl -X POST http://localhost:5000/api/analyze/job-001

# 4. Check verdict and recommendations in response
```

---

## 📚 Related Documentation

- [BACKEND_API.md](./BACKEND_API.md) - Complete API reference
- [README.md](./README.md) - Quick start guide
- [../../PROGRESS.md](../../PROGRESS.md) - Project progress

---

## 🔮 Future Enhancements

- [ ] ML-based anomaly detection (isolation forests)
- [ ] Predictive performance forecasting
- [ ] Custom rule engine for verdicts
- [ ] Integration with monitoring systems
- [ ] Advanced pattern recognition
- [ ] Automated remediation suggestions

---

**Status:** ✅ Phase B - AI Analysis Logic COMPLETE  
**Build Date:** March 29, 2026  
**Next:** Phase C - Full Frontend Integration
