/**
 * FLUX UI Utilities
 * Shared utilities for DOM manipulation, formatting, and data display
 */

class FluxUtils {
  /**
   * Format date for display
   */
  static formatDate(dateString, format = 'short') {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';

    const options = {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
      time: { hour: '2-digit', minute: '2-digit', second: '2-digit' }
    };

    return date.toLocaleDateString('en-US', options[format] || options.short);
  }

  /**
   * Format time duration (milliseconds to human readable)
   */
  static formatDuration(ms) {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * Format memory size (bytes to human readable)
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format percentage with consistent decimals
   */
  static formatPercent(value, decimals = 1) {
    if (value === null || value === undefined) return 'N/A';
    return `${parseFloat(value).toFixed(decimals)}%`;
  }

  /**
   * Format number with thousands separator
   */
  static formatNumber(value) {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US').format(value);
  }

  /**
   * Get verdict emoji and color
   */
  static getVerdictDisplay(verdict) {
    const displays = {
      'SAFE_TO_MERGE': { emoji: '✅', text: 'Safe to Merge', color: 'bg-green-900', textColor: 'text-green-200' },
      'NEEDS_REVIEW': { emoji: '⚠️', text: 'Needs Review', color: 'bg-yellow-900', textColor: 'text-yellow-200' },
      'UNSAFE': { emoji: '❌', text: 'Unsafe', color: 'bg-red-900', textColor: 'text-red-200' },
      'PASS': { emoji: '✅', text: 'Pass', color: 'bg-green-900', textColor: 'text-green-200' },
      'BLOCKED': { emoji: '❌', text: 'Blocked', color: 'bg-red-900', textColor: 'text-red-200' },
      'RUNNING': { emoji: '⏳', text: 'Running', color: 'bg-blue-900', textColor: 'text-blue-200' }
    };
    return displays[verdict] || { emoji: '❓', text: verdict, color: 'bg-gray-900', textColor: 'text-gray-200' };
  }

  /**
   * Get status color classes
   */
  static getStatusColor(status) {
    const colors = {
      'success': 'text-green-400 bg-green-900/20',
      'warning': 'text-yellow-400 bg-yellow-900/20',
      'error': 'text-red-400 bg-red-900/20',
      'info': 'text-blue-400 bg-blue-900/20',
      'neutral': 'text-gray-400 bg-gray-900/20'
    };
    return colors[status] || colors.neutral;
  }

  /**
   * Truncate text with ellipsis
   */
  static truncate(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Safely select DOM element
   */
  static $(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`Element not found: ${selector}`);
    }
    return element;
  }

  /**
   * Select all matching elements
   */
  static $$(selector) {
    return document.querySelectorAll(selector);
  }

  /**
   * Update element text content
   */
  static setText(selector, text) {
    const element = this.$(selector);
    if (element) {
      element.textContent = text;
    }
  }

  /**
   * Update element HTML
   */
  static setHTML(selector, html) {
    const element = this.$(selector);
    if (element) {
      element.innerHTML = html;
    }
  }

  /**
   * Add/remove classes
   */
  static addClass(selector, className) {
    const element = this.$(selector);
    if (element) {
      element.classList.add(className);
    }
  }

  static removeClass(selector, className) {
    const element = this.$(selector);
    if (element) {
      element.classList.remove(className);
    }
  }

  static toggleClass(selector, className) {
    const element = this.$(selector);
    if (element) {
      element.classList.toggle(className);
    }
  }

  /**
   * Show/hide elements
   */
  static show(selector) {
    const element = this.$(selector);
    if (element) {
      element.style.display = '';
    }
  }

  static hide(selector) {
    const element = this.$(selector);
    if (element) {
      element.style.display = 'none';
    }
  }

  /**
   * Create HTML element from string
   */
  static createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  /**
   * Create table row with data
   */
  static createTableRow(data, columns) {
    let html = '<tr class="border-t border-outline-variant hover:bg-surface-container-high transition-colors">';

    columns.forEach((col) => {
      const value = data[col.key];
      const displayValue = col.format ? col.format(value) : value;
      html += `<td class="px-4 py-3 text-sm">${displayValue || 'N/A'}</td>`;
    });

    html += '</tr>';
    return this.createElement(html);
  }

  /**
   * Show loading skeleton
   */
  static showSkeleton(selector, count = 5) {
    const container = this.$(selector);
    if (!container) return;

    const skeleton = `
      <div class="animate-pulse space-y-2">
        ${Array.from({ length: count })
          .map(() => '<div class="h-12 bg-surface-container-high rounded"></div>')
          .join('')}
      </div>
    `;
    container.innerHTML = skeleton;
  }

  /**
   * Show error message
   */
  static showError(selector, message) {
    const container = this.$(selector);
    if (!container) return;

    const errorHTML = `
      <div class="rounded-lg bg-error-container/10 border border-error px-4 py-3 text-error-container">
        <span class="material-symbols-outlined">error</span>
        <span>${message}</span>
      </div>
    `;
    container.innerHTML = errorHTML;
  }

  /**
   * Show empty state
   */
  static showEmpty(selector, message = 'No data available') {
    const container = this.$(selector);
    if (!container) return;

    const emptyHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-on-surface-variant">
        <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
        <p>${message}</p>
      </div>
    `;
    container.innerHTML = emptyHTML;
  }

  /**
   * Debounce function
   */
  static debounce(func, delay = 300) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * Throttle function
   */
  static throttle(func, limit = 1000) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= limit) {
        lastCall = now;
        func(...args);
      }
    };
  }

  /**
   * Copy text to clipboard
   */
  static copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => {
        console.error('Failed to copy to clipboard');
      });
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  /**
   * Retry function with exponential backoff
   */
  static async retry(fn, maxAttempts = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }

  /**
   * Local storage helpers
   */
  static setStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  static getStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return defaultValue;
    }
  }

  static removeStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FluxUtils;
}
