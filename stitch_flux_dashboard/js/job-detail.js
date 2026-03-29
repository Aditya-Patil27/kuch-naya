/**
 * Job Detail Controller
 * Displays detailed information for a single job
 */

class JobDetailController {
  constructor() {
    this.api = FluxAPI;
    this.utils = FluxUtils;
    this.ws = fluxWS;
    this.jobId = null;
    this.job = null;
  }

  async init() {
    console.log('Initializing job detail...');
    try {
      this.jobId = await this.extractJobIdFromUrl();
      if (!this.jobId) {
        throw new Error('No job ID found in URL');
      }

      await this.connectWebSocket();
      await this.loadJobDetail();
      this.setupEventListeners();
      console.log('Job detail initialized');
    } catch (error) {
      console.error('Failed to initialize job detail:', error);
      this.utils.showError('[data-section="detail"]', error.message);
    }
  }

  async extractJobIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const queryJobId = params.get('jobId');
    if (queryJobId) return queryJobId;

    // Fallback: extract PR number from folder name and map to job id.
    const match = window.location.pathname.match(/job_detail_pr_(\d+)_pro/);
    if (!match) return null;

    const prNumber = match[1];
    const jobsResponse = await this.api.getJobs({ limit: 200 });
    if (!jobsResponse.success || !Array.isArray(jobsResponse.data)) return null;

    const matchedJob = jobsResponse.data.find((job) => {
      const normalized = String(job.prNumber || '').replace(/^PR\s*#?/i, '').trim();
      return normalized === prNumber;
    });

    return matchedJob ? matchedJob._id : null;
  }

  async connectWebSocket() {
    return new Promise((resolve) => {
      this.ws.connect()
        .then(() => {
          this.ws.subscribeToJob(this.jobId, (data) => {
            this.job = { ...this.job, ...data };
            this.refreshDisplay();
          });
          resolve();
        })
        .catch(() => resolve());
    });
  }

  async loadJobDetail() {
    const response = await this.api.getJobById(this.jobId);
    
    if (!response.success) {
      throw new Error(`Failed to load job: ${response.error}`);
    }

    this.job = response.data;
    this.displayJobDetail();
    await this.loadAnalysis();
  }

  displayJobDetail() {
    if (!this.job) return;

    const verdict = this.utils.getVerdictDisplay(this.job.status);
    
    // Update header
    this.utils.setText('[data-field="pr-number"]', `PR #${this.job.prNumber}`);
    this.utils.setText('[data-field="repository"]', this.job.repository);
    this.utils.setText('[data-field="status"]', this.job.status);
    this.utils.setText('[data-field="verdict"]', verdict.text);
    
    // Update metrics
    this.utils.setText('[data-metric="p99-latency"]', 
      this.utils.formatDuration(this.job.metrics?.p99Latency || 0));
    this.utils.setText('[data-metric="error-rate"]',
      this.utils.formatPercent(this.job.metrics?.errorRate || 0));
    this.utils.setText('[data-metric="throughput"]',
      this.utils.formatNumber(this.job.metrics?.throughput || 0));
    this.utils.setText('[data-metric="memory"]',
      this.utils.formatBytes(this.job.metrics?.memoryUsage || 0));
    this.utils.setText('[data-metric="duration"]',
      this.utils.formatDuration(this.job.duration || 0));

    // Display chaos events
    this.displayChaosEvents();
  }

  displayChaosEvents() {
    const tbody = document.querySelector('[data-section="chaos-events"] tbody');
    if (!tbody || !this.job.chaosEvents) return;

    Array.from(tbody.querySelectorAll('tr')).forEach(row => row.remove());

    if (this.job.chaosEvents.length === 0) {
      this.utils.showEmpty('[data-section="chaos-events"]', 'No chaos events');
      return;
    }

    this.job.chaosEvents.forEach((event) => {
      const html = `
        <tr class="hover:bg-surface-container transition-colors">
          <td class="px-6 py-3">${event.type}</td>
          <td class="px-6 py-3">${event.severity}</td>
          <td class="px-6 py-3">${event.duration}ms</td>
          <td class="px-6 py-3 text-on-surface-variant">${this.utils.formatDate(event.timestamp, 'time')}</td>
          <td class="px-6 py-3 text-on-surface-variant">${event.impact || 'N/A'}</td>
        </tr>
      `;
      const row = this.utils.createElement(html);
      tbody.appendChild(row);
    });
  }

  async loadAnalysis() {
    let response = await this.api.getAnalysis(this.jobId);

    // If analysis does not exist yet, trigger it once and re-fetch.
    if (!response.success) {
      await this.api.analyzeJob(this.jobId);
      response = await this.api.getAnalysis(this.jobId);
    }
    
    if (response.success && response.data) {
      this.displayAnalysis(response.data);
    }
  }

  displayAnalysis(analysis) {
    // Verdict
    this.utils.setText('[data-field="verdict-confidence"]', 
      `${analysis.verdict} (${analysis.confidence}% confidence)`);

    // Strengths
    const strengthsList = document.querySelector('[data-section="strengths"]');
    if (strengthsList && analysis.strengths) {
      strengthsList.innerHTML = analysis.strengths
        .map(s => `<li class="text-sm text-on-surface-variant">✓ ${s}</li>`)
        .join('');
    }

    // Recommendations
    const recsList = document.querySelector('[data-section="recommendations"]');
    if (recsList && analysis.recommendations) {
      recsList.innerHTML = analysis.recommendations
        .map(r => `<li class="text-sm text-on-surface-variant">→ ${r}</li>`)
        .join('');
    }
  }

  refreshDisplay() {
    this.displayJobDetail();
  }

  setupEventListeners() {
    // Re-analyze button
    const reanalyzeBtn = document.querySelector('[data-action="reanalyze"]');
    if (reanalyzeBtn) {
      reanalyzeBtn.addEventListener('click', () => this.reanalyze());
    }

    // View comment button
    const commentBtn = document.querySelector('[data-action="view-comment"]');
    if (commentBtn) {
      commentBtn.addEventListener('click', () => this.viewGitHubComment());
    }
  }

  async reanalyze() {
    console.log('Re-analyzing job...');
    const response = await this.api.analyzeJob(this.jobId);
    
    if (response.success) {
      this.job.aiAnalysis = response.data;
      this.displayAnalysis(response.data);
    }
  }

  viewGitHubComment() {
    window.location.href = `../github_comment_preview_pro_console/code_complete.html?jobId=${encodeURIComponent(this.jobId)}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new JobDetailController().init();
});
