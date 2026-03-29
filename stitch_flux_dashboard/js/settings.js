/**
 * Settings Controller
 * Manages application settings and configuration
 */

class SettingsController {
  constructor() {
    this.api = FluxAPI;
    this.utils = FluxUtils;
    this.settings = null;
    this.isDirty = false;
  }

  async init() {
    console.log('Initializing settings...');
    try {
      await this.loadSettings();
      this.bindFormControls();
      this.setupEventListeners();
      console.log('Settings initialized');
    } catch (error) {
      console.error('Failed to initialize settings:', error);
      this.utils.showError('[data-section="settings"]', 'Failed to load settings');
    }
  }

  async loadSettings() {
    const response = await this.api.getSettings();
    
    if (!response.success) {
      throw new Error('Failed to load settings');
    }

    this.settings = response.data;
    this.displaySettings();
  }

  displaySettings() {
    if (!this.settings) return;

    // Keep a lightweight summary visible without tightly coupling to specific inputs.
    const summary = document.querySelector('[data-section="settings-summary"]');
    if (summary) {
      summary.textContent = `Loaded settings: p99=${this.settings?.thresholds?.p99Latency ?? 'n/a'}ms, error=${this.settings?.thresholds?.errorRate ?? 'n/a'}%`;
    }

    this.isDirty = false;
  }

  bindFormControls() {
    // Mark as dirty when any input changes
    document.querySelectorAll('input, select, textarea').forEach(control => {
      control.addEventListener('change', () => {
        this.isDirty = true;
        this.updateSaveButtonState();
      });
    });
  }

  setupEventListeners() {
    // Save button
    const saveBtn = document.querySelector('[data-action="save"]') || this.findButtonByText('SAVE CHANGES');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveSettings());
    }

    // Reset button
    const resetBtn = document.querySelector('[data-action="reset"]') || this.findButtonByText('RESET');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetSettings());
    }

    // Test connection buttons
    const testGithubBtn = document.querySelector('[data-action="test-github"]');
    if (testGithubBtn) {
      testGithubBtn.addEventListener('click', () => this.testGitHubConnection());
    }

    const testChaosBtn = document.querySelector('[data-action="test-chaos"]');
    if (testChaosBtn) {
      testChaosBtn.addEventListener('click', () => this.testChaosConnection());
    }
  }

  updateSaveButtonState() {
    const saveBtn = document.querySelector('[data-action="save"]') || this.findButtonByText('SAVE CHANGES');
    if (saveBtn) {
      saveBtn.disabled = !this.isDirty;
    }
  }

  async saveSettings() {
    const formData = this.collectFormData();
    const response = await this.api.updateSettings(formData);

    if (!response.success) {
      this.utils.showError('[data-section="settings"]', 'Failed to save settings');
      return;
    }

    this.settings = response.data;
    this.isDirty = false;
    this.updateSaveButtonState();
    console.log('Settings saved successfully');
  }

  async resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
      const response = await this.api.resetSettings();
      
      if (response.success) {
        this.settings = response.data;
        this.displaySettings();
        console.log('Settings reset to defaults');
      }
    }
  }

  collectFormData() {
    const numberInputs = Array.from(document.querySelectorAll('input[type="number"]'));
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));

    return {
      github: this.settings?.github || {},
      tests: {
        timeout: parseInt(numberInputs[5]?.value || this.settings?.tests?.timeout || 600, 10),
        parallelism: parseInt(this.settings?.tests?.parallelism || 5, 10),
        retries: parseInt(this.settings?.tests?.retries || 3, 10)
      },
      chaos: {
        enabled: !!(checkboxes[0]?.checked),
        intensity: this.settings?.chaos?.intensity || 'medium'
      },
      notifications: {
        slack: {
          enabled: !!(checkboxes[3]?.checked)
        },
        email: {
          enabled: !!(checkboxes[4]?.checked)
        }
      },
      thresholds: {
        p99Latency: parseInt(numberInputs[0]?.value || this.settings?.thresholds?.p99Latency || 500, 10),
        errorRate: parseFloat(numberInputs[1]?.value || this.settings?.thresholds?.errorRate || 1.0),
        throughput: parseInt(numberInputs[2]?.value || this.settings?.thresholds?.throughput || 1000, 10)
      }
    };
  }

  findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find((btn) => (btn.textContent || '').trim().toUpperCase() === text.toUpperCase()) || null;
  }

  async testGitHubConnection() {
    console.log('Testing GitHub connection...');
    // Mock test - in production would call backend test endpoint
    alert('GitHub connection test would be executed here');
  }

  async testChaosConnection() {
    console.log('Testing chaos connection...');
    // Mock test
    alert('Chaos connection test would be executed here');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SettingsController().init();
});
