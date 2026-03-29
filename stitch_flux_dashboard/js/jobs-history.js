/**
 * Jobs History Controller
 * Handles job listing, filtering, and sorting
 */

class JobsHistoryController {
  constructor() {
    this.api = FluxAPI;
    this.utils = FluxUtils;
    this.ws = fluxWS;
    this.currentFilter = 'ALL';
    this.currentPage = 1;
    this.pageSize = 20;
    this.allJobs = [];
  }

  async init() {
    console.log('Initializing jobs history...');
    try {
      await this.connectWebSocket();
      await this.loadJobs();
      this.setupEventListeners();
      this.setupAutoRefresh();
      console.log('Jobs history initialized');
    } catch (error) {
      console.error('Failed to initialize jobs history:', error);
      this.utils.showError('[data-section="jobs"]', 'Failed to load jobs');
    }
  }

  async connectWebSocket() {
    return new Promise((resolve) => {
      this.ws.connect()
        .then(() => {
          this.ws.on('job-update', (data) => {
            console.log('Job updated:', data);
            this.updateJobInList(data.jobId, data.data);
          });
          resolve();
        })
        .catch(() => resolve()); // Polling fallback
    });
  }

  async loadJobs(status = 'ALL') {
    this.currentFilter = status;
    const params = status === 'ALL' ? {} : { status };
    
    const response = await this.api.getJobs({ ...params, limit: 100 });
    
    if (!response.success) {
      console.error('Failed to load jobs:', response.error);
      return;
    }

    this.allJobs = response.data || [];
    this.currentPage = 1;
    this.renderJobsTable();
  }

  renderJobsTable() {
    const tbody = document.querySelector('[data-section="jobs"] tbody') || document.querySelector('table tbody');
    if (!tbody) return;

    if (!this.allJobs || this.allJobs.length === 0) {
      this.utils.showEmpty('[data-section="jobs"]', 'No jobs found');
      return;
    }

    // Clear existing rows
    Array.from(tbody.querySelectorAll('tr')).forEach(row => row.remove());

    // Add paginated rows
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageJobs = this.allJobs.slice(start, end);

    pageJobs.forEach((job) => {
      const row = this.createJobRow(job);
      tbody.appendChild(row);
    });

    this.updatePagination();
  }

  createJobRow(job) {
    const verdict = this.utils.getVerdictDisplay(job.status || job.verdict || 'PENDING');
    const duration = this.utils.formatDuration(job.duration || 0);
    const timestamp = this.utils.formatDate(job.createdAt, 'long');

    const html = `
      <tr class="hover:bg-surface-container transition-colors cursor-pointer" data-job-id="${job._id}">
        <td class="px-6 py-3 font-bold text-primary">${job.prNumber || 'N/A'}</td>
        <td class="px-6 py-3 text-on-surface">${job.repository || 'N/A'}</td>
        <td class="px-6 py-3">
          <span class="flex items-center gap-2">
            <span>${verdict.emoji}</span>
            <span>${job.status || 'PENDING'}</span>
          </span>
        </td>
        <td class="px-6 py-3 text-on-surface-variant">${job.chaosEventsCount || 0}</td>
        <td class="px-6 py-3 text-on-surface-variant">${duration}</td>
        <td class="px-6 py-3 text-on-surface-variant">${timestamp}</td>
      </tr>
    `;

    const row = this.utils.createElement(html);
    row.addEventListener('click', () => this.viewJobDetail(job._id));
    return row;
  }

  updatePagination() {
    const totalPages = Math.ceil(this.allJobs.length / this.pageSize);
    const pageInfo = document.querySelector('[data-info="page"]');
    if (pageInfo) {
      pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    }

    const prevBtn = document.querySelector('[data-action="prev"]') || this.findButtonByText('PREV');
    const nextBtn = document.querySelector('[data-action="next"]') || this.findButtonByText('NEXT');
    
    if (prevBtn) prevBtn.disabled = this.currentPage === 1;
    if (nextBtn) nextBtn.disabled = this.currentPage === totalPages;
  }

  updateJobInList(jobId, jobData) {
    const jobIndex = this.allJobs.findIndex(j => j._id === jobId);
    if (jobIndex !== -1) {
      this.allJobs[jobIndex] = { ...this.allJobs[jobIndex], ...jobData };
      this.renderJobsTable();
    }
  }

  setupEventListeners() {
    // Status filter select or buttons
    const statusSelect = document.querySelector('[data-filter="status"]') || document.querySelector('select');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        const value = (e.target.value || 'ALL').toUpperCase();
        this.loadJobs(value === 'ALL' ? 'ALL' : value);
      });
    }

    document.querySelectorAll('[data-filter="status-button"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const status = e.currentTarget.dataset.status || 'ALL';
        this.loadJobs(status);
      });
    });

    // Pagination
    const prevBtn = document.querySelector('[data-action="prev"]') || this.findButtonByText('PREV');
    const nextBtn = document.querySelector('[data-action="next"]') || this.findButtonByText('NEXT');
    
    if (prevBtn) prevBtn.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderJobsTable();
      }
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(this.allJobs.length / this.pageSize);
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderJobsTable();
      }
    });

    // Search/filter input
    const searchInput = document.querySelector('[data-action="search"]') || document.querySelector('input[type="text"]');
    if (searchInput) {
      searchInput.addEventListener('input', this.utils.debounce((e) => {
        this.filterJobs(e.target.value);
      }, 300));
    }
  }

  filterJobs(query) {
    if (!query) {
      this.renderJobsTable();
      return;
    }

    const filtered = this.allJobs.filter(job => 
      job.prNumber?.includes(query) ||
      job.repository?.includes(query) ||
      job._id?.includes(query)
    );

    this.allJobs = filtered;
    this.currentPage = 1;
    this.renderJobsTable();
  }

  setupAutoRefresh() {
    setInterval(() => this.loadJobs(this.currentFilter), 10000);
  }

  findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find((btn) => (btn.textContent || '').trim().toUpperCase() === text.toUpperCase()) || null;
  }

  viewJobDetail(jobId) {
    window.location.href = `../job_detail_pr_402_pro_console/code_complete.html?jobId=${encodeURIComponent(jobId)}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new JobsHistoryController().init();
});
