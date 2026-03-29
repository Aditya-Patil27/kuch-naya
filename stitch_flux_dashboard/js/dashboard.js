/**
 * FLUX Dashboard Integration
 * Connects dashboard UI to backend APIs and WebSocket
 */

class DashboardController {
  constructor() {
    this.api = FluxAPI;
    this.utils = FluxUtils;
    this.ws = fluxWS;
    this.autoRefresh = true;
    this.refreshInterval = 5000; // 5 seconds
  }

  /**
   * Initialize dashboard on page load
   */
  async init() {
    console.log('Initializing dashboard...');

    try {
      // Connect WebSocket for real-time updates
      await this.connectWebSocket();

      // Load initial data
      await this.loadDashboardMetrics();
      await this.loadRecentRuns();
      await this.loadQueueStatus();

      // Set up auto-refresh
      this.setupAutoRefresh();

      // Set up event listeners
      this.setupEventListeners();

      console.log('Dashboard initialized successfully');
    } catch (error) {
      console.error('Failed to initialize dashboard:', error);
      this.showError('Failed to load dashboard data. Please refresh the page.');
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      this.ws.connect()
        .then(() => {
          console.log('WebSocket connected');

          // Listen for metrics updates
          this.ws.onMetricsUpdate((metrics) => {
            console.log('Metrics updated:', metrics);
            this.updateHeroMetrics(metrics);
          });

          // Listen for job updates
          this.ws.on('job-update', (data) => {
            console.log('Job updated:', data);
            this.updateJobInTable(data.jobId, data.data);
          });

          // Listen for analysis completion
          this.ws.onAnalysisComplete((data) => {
            console.log('Analysis complete:', data);
            this.refreshRecentRuns();
          });

          resolve();
        })
        .catch((error) => {
          console.warn('WebSocket connection failed, using polling:', error);
          resolve(); // Don't fail if WebSocket isn't available
        });
    });
  }

  /**
   * Load dashboard metrics from API
   */
  async loadDashboardMetrics() {
    const response = await this.api.getDashboardSummary();

    if (!response.success) {
      console.error('Failed to load metrics:', response.error);
      return;
    }

    const metrics = response.data;
    this.updateHeroMetrics(metrics);
  }

  /**
   * Update hero metrics display
   */
  updateHeroMetrics(metrics) {
    if (metrics.totalTested !== undefined) {
      this.utils.setText('[data-metric="tested"]', this.utils.formatNumber(metrics.totalTested));
    }

    if (metrics.chaosEventsTriggered !== undefined) {
      this.utils.setText('[data-metric="chaos"]', this.utils.formatNumber(metrics.chaosEventsTriggered));
    }

    if (metrics.successRate !== undefined) {
      this.utils.setText('[data-metric="success"]', this.utils.formatPercent(metrics.successRate));
    }

    if (metrics.avgDuration !== undefined) {
      this.utils.setText('[data-metric="duration"]', this.utils.formatDuration(metrics.avgDuration));
    }
  }

  /**
   * Load recent runs from API
   */
  async loadRecentRuns() {
    const response = await this.api.getJobsByStatus('PASS', 20);

    if (!response.success) {
      console.error('Failed to load recent runs:', response.error);
      this.utils.showError('[data-section="runs"]', 'Failed to load recent runs');
      return;
    }

    this.displayRecentRuns(response.data);
  }

  /**
   * Display recent runs in table
   */
  displayRecentRuns(jobs) {
    const tbody = document.querySelector('[data-section="runs"] tbody');
    if (!tbody) return;

    if (!jobs || jobs.length === 0) {
      this.utils.showEmpty('[data-section="runs"]', 'No recent runs available');
      return;
    }

    // Clear existing rows (except header)
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => row.remove());

    // Add job rows
    jobs.slice(0, 10).forEach((job) => {
      const row = this.createJobRow(job);
      tbody.appendChild(row);
    });
  }

  /**
   * Create table row for a job
   */
  createJobRow(job) {
    const verdict = this.utils.getVerdictDisplay(job.status);
    const duration = this.utils.formatDuration(job.duration || 0);
    const timestamp = this.utils.formatDate(job.createdAt, 'time');

    const html = `
      <tr class="status-${job.status.toLowerCase()} hover:bg-surface-container transition-colors cursor-pointer" data-job-id="${job._id}">
        <td class="px-6 py-3 font-bold text-primary">${job.prNumber || 'N/A'}</td>
        <td class="px-6 py-3 text-on-surface">${job.repository || 'N/A'}</td>
        <td class="px-6 py-3">
          <span class="flex items-center gap-2">
            <span>${verdict.emoji}</span>
            <span style="color: ${job.status === 'PASS' ? '#00f0ff' : '#ff4444'};">${job.status}</span>
          </span>
        </td>
        <td class="px-6 py-3 text-on-surface-variant">${duration}</td>
        <td class="px-6 py-3 text-on-surface-variant">${timestamp}</td>
      </tr>
    `;

    const row = this.utils.createElement(html);
    row.addEventListener('click', () => this.viewJobDetail(job._id));
    return row;
  }

  /**
   * Update a single job row in the table
   */
  updateJobInTable(jobId, jobData) {
    const row = document.querySelector(`[data-job-id="${jobId}"]`);
    if (!row) return;

    // Update status
    const status = jobData.status || jobData.verdict;
    const verdict = this.utils.getVerdictDisplay(status);

    const statusCell = row.querySelector('td:nth-child(3)');
    if (statusCell) {
      statusCell.innerHTML = `
        <span class="flex items-center gap-2">
          <span>${verdict.emoji}</span>
          <span>${status}</span>
        </span>
      `;
    }

    // Update duration if available
    if (jobData.duration) {
      const durationCell = row.querySelector('td:nth-child(4)');
      if (durationCell) {
        durationCell.textContent = this.utils.formatDuration(jobData.duration);
      }
    }

    // Add animation
    row.style.animation = 'slide-in 0.3s ease-out';
  }

  /**
   * Load queue status
   */
  async loadQueueStatus() {
    const response = await this.api.getQueueStatus();

    if (!response.success) {
      console.error('Failed to load queue status:', response.error);
      return;
    }

    const status = response.data;

    // Update pipeline blocks (example)
    const stagePlaceholders = {
      'provision': status.provisioning || 0,
      'test': status.testing || 0,
      'chaos': status.chaosInjection || 0,
      'analyze': status.analyzing || 0
    };

    Object.entries(stagePlaceholders).forEach(([stage, count]) => {
      const element = document.querySelector(`[data-stage="${stage}"]`);
      if (element && count > 0) {
        element.classList.add('animate-pulse-glow');
      }
    });
  }

  /**
   * Set up auto-refresh of dashboard data
   */
  setupAutoRefresh() {
    if (!this.autoRefresh) return;

    // Refresh recent runs every 10 seconds
    setInterval(() => {
      this.loadRecentRuns();
      this.loadQueueStatus();
    }, this.refreshInterval);

    console.log(`Auto-refresh enabled (${this.refreshInterval}ms)`);
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Refresh button
    const refreshBtn = document.querySelector('[data-action="refresh"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }

    // Sort/filter controls could go here
    // Example: Job status filter
    const statusFilter = document.querySelector('[data-filter="status"]');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.loadRecentRuns());
    }
  }

  /**
   * Refresh all dashboard data
   */
  async refresh() {
    console.log('Refreshing dashboard...');
    await this.loadDashboardMetrics();
    await this.loadRecentRuns();
    await this.loadQueueStatus();
  }

  /**
   * View job detail
   */
  viewJobDetail(jobId) {
    console.log('Viewing job:', jobId);
    // Navigate to job detail page
    window.location.href = `../job_detail_pr_402_pro_console/code_complete.html?jobId=${encodeURIComponent(jobId)}`;
  }

  /**
   * Show error message
   */
  showError(message) {
    const container = document.querySelector('[data-section="alert"]');
    if (container) {
      this.utils.showError('[data-section="alert"]', message);
    }
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const dashboard = new DashboardController();
  dashboard.init();
});

// Make dashboard available globally for debugging
window.dashboard = DashboardController;
