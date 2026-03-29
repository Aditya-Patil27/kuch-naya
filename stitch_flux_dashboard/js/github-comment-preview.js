/**
 * GitHub Comment Preview Controller
 * Displays AI-generated GitHub comment for a job
 */

class GitHubCommentController {
  constructor() {
    this.api = FluxAPI;
    this.utils = FluxUtils;
    this.jobId = null;
    this.analysis = null;
  }

  async init() {
    console.log('Initializing GitHub comment preview...');
    try {
      this.jobId = await this.extractJobIdFromUrl();
      if (!this.jobId) {
        throw new Error('No job ID provided');
      }

      await this.loadComment();
      this.setupEventListeners();
      console.log('GitHub comment preview initialized');
    } catch (error) {
      console.error('Failed to initialize comment preview:', error);
      this.utils.showError('[data-section="comment"]', error.message);
    }
  }

  async extractJobIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const queryJobId = params.get('jobId');
    if (queryJobId) return queryJobId;

    const jobsResponse = await this.api.getJobs({ limit: 1 });
    if (jobsResponse.success && Array.isArray(jobsResponse.data) && jobsResponse.data.length > 0) {
      return jobsResponse.data[0]._id;
    }
    return null;
  }

  async loadComment() {
    let response = await this.api.getAnalysis(this.jobId);

    if (!response.success) {
      await this.api.analyzeJob(this.jobId);
      response = await this.api.getAnalysis(this.jobId);
    }
    
    if (!response.success) {
      throw new Error('Failed to load analysis');
    }

    this.analysis = response.data;
    this.displayComment();
  }

  displayComment() {
    if (!this.analysis || !this.analysis.githubComment) {
      this.utils.showEmpty('[data-section="comment"]', 'No comment generated');
      return;
    }

    const container = document.querySelector('[data-section="comment"]');
    if (container) {
      container.innerHTML = this.renderMarkdown(this.analysis.githubComment);
    }
  }

  renderMarkdown(markdown) {
    // Simple markdown rendering for GitHub comment
    return `
      <div class="prose prose-invert text-sm">
        ${markdown
          .split('\n\n')
          .map(para => {
            // Headers
            if (para.startsWith('## ')) {
              return `<h3 class="text-lg font-bold mt-4 mb-2">${para.substring(3)}</h3>`;
            }
            if (para.startsWith('### ')) {
              return `<h4 class="text-base font-bold mt-3 mb-2">${para.substring(4)}</h4>`;
            }
            // Tables (basic)
            if (para.includes('|')) {
              return `<pre class="overflow-x-auto bg-surface-container-low p-3 rounded text-xs mb-2">${para}</pre>`;
            }
            // Lists
            if (para.startsWith('- ')) {
              const items = para.split('\n').filter(l => l.startsWith('- '));
              return `<ul class="list-disc list-inside mb-2">${
                items.map(item => `<li>${item.substring(2)}</li>`).join('')
              }</ul>`;
            }
            // Emoji + bold
            return `<p class="mb-2">${para}</p>`;
          })
          .join('')}
      </div>
    `;
  }

  setupEventListeners() {
    // Copy button
    const copyBtn = document.querySelector('[data-action="copy"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyToClipboard());
    }

    // Post to PR button (mock)
    const postBtn = document.querySelector('[data-action="post-to-pr"]');
    if (postBtn) {
      postBtn.addEventListener('click', () => this.postToPR());
    }

    // Download button
    const downloadBtn = document.querySelector('[data-action="download"]');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadComment());
    }
  }

  copyToClipboard() {
    if (this.analysis?.githubComment) {
      this.utils.copyToClipboard(this.analysis.githubComment);
      console.log('Comment copied to clipboard');
    }
  }

  postToPR() {
    if (!this.analysis?.githubComment) return;
    
    const prNumber = this.analysis.job?.prNumber;
    if (prNumber) {
      // Open GitHub PR in new tab
      const githubUrl = `https://github.com/${this.analysis.repository}/pull/${prNumber}`;
      window.open(githubUrl, '_blank');
    }
  }

  downloadComment() {
    if (!this.analysis?.githubComment) return;

    const element = document.createElement('a');
    const file = new Blob([this.analysis.githubComment], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `flux-comment-${this.jobId}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new GitHubCommentController().init();
});
