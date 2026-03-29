/**
 * FLUX API Client
 * Handles all HTTP communication with the backend REST API
 */

const API_BASE_URL = 'http://localhost:5000/api';
const API_TIMEOUT = 10000; // 10 seconds

class FluxAPI {
  /**
   * Make HTTP request with timeout and error handling
   */
  static async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      timeout = API_TIMEOUT
    } = options;

    const url = `${API_BASE_URL}${endpoint}`;
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error(`Request failed: ${endpoint}`, error);
      return {
        success: false,
        error: error.message,
        endpoint
      };
    }
  }

  /**
   * ============================================
   * JOBS API ENDPOINTS
   * ============================================
   */

  static async getJobs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/jobs${query ? '?' + query : ''}`);
  }

  static async getJobById(jobId) {
    return this.request(`/jobs/${jobId}`);
  }

  static async createJob(jobData) {
    return this.request('/jobs', { method: 'POST', body: jobData });
  }

  static async updateJob(jobId, jobData) {
    return this.request(`/jobs/${jobId}`, { method: 'PUT', body: jobData });
  }

  static async deleteJob(jobId) {
    return this.request(`/jobs/${jobId}`, { method: 'DELETE' });
  }

  static async getJobsByStatus(status, limit = 10) {
    return this.getJobs({ status, limit });
  }

  static async addChaosEvent(jobId, eventData) {
    return this.request(`/jobs/${jobId}/chaos-events`, {
      method: 'POST',
      body: eventData
    });
  }

  static async getChaosEvents(jobId) {
    return this.request(`/jobs/${jobId}/chaos-events`);
  }

  /**
   * ============================================
   * SETTINGS API ENDPOINTS
   * ============================================
   */

  static async getSettings() {
    return this.request('/settings');
  }

  static async updateSettings(settingsData) {
    return this.request('/settings', { method: 'PUT', body: settingsData });
  }

  static async resetSettings() {
    return this.request('/settings/reset', { method: 'POST' });
  }

  /**
   * ============================================
   * DASHBOARD API ENDPOINTS
   * ============================================
   */

  static async getDashboardSummary() {
    return this.request('/dashboard/summary');
  }

  static async getDashboardMetrics(timeframe = '24h') {
    return this.request(`/dashboard/metrics?timeframe=${timeframe}`);
  }

  static async getDashboardTrends() {
    return this.request('/dashboard/trends');
  }

  static async getQueueStatus() {
    return this.request('/dashboard/queue');
  }

  /**
   * ============================================
   * AI ANALYSIS API ENDPOINTS
   * ============================================
   */

  static async analyzeJob(jobId) {
    return this.request(`/analyze/${jobId}`, { method: 'POST' });
  }

  static async getAnalysis(jobId) {
    return this.request(`/analyze/${jobId}`);
  }

  static async batchAnalyze() {
    return this.request('/analyze/batch/queue', { method: 'POST' });
  }

  static async compareJobs(jobId1, jobId2) {
    return this.request('/analyze/compare', {
      method: 'POST',
      body: { jobId1, jobId2 }
    });
  }

  /**
   * ============================================
   * REAL-TIME MONITORING
   * ============================================
   */

  static async subscribeToJobUpdates(jobId, callback) {
    // This will be handled by WebSocket connection
    console.log('Use WebSocket for real-time updates:', jobId);
  }

  /**
   * ============================================
   * HEALTH CHECK
   * ============================================
   */

  static async healthCheck() {
    const url = 'http://localhost:5000/health';
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FluxAPI;
}
