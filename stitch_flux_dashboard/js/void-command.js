/**
 * Void Command Controller
 * Orchestration interface for deployment commands
 */

class VoidCommandController {
  constructor() {
    this.api = FluxAPI;
    this.utils = FluxUtils;
    this.tasks = [];
    this.selectedTask = null;
  }

  async init() {
    console.log('Initializing void command orchestration...');
    try {
      this.setupEventListeners();
      this.initializeInterface();
      console.log('Void command initialized');
    } catch (error) {
      console.error('Failed to initialize void command:', error);
    }
  }

  initializeInterface() {
    this.writeLog('FLUX Orchestration Console Initialized', 'system');
    this.displayAvailableTasks();
  }

  setupEventListeners() {
    // Execute button
    const executeBtn = document.querySelector('[data-action="execute"]');
    if (executeBtn) {
      executeBtn.addEventListener('click', () => this.executeSelectedTask());
    }

    // Pause button
    const pauseBtn = document.querySelector('[data-action="pause"]');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.pauseTask());
    }

    // Resume button
    const resumeBtn = document.querySelector('[data-action="resume"]');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.resumeTask());
    }

    // Stop button
    const stopBtn = document.querySelector('[data-action="stop"]');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopTask());
    }

    // Task selection
    document.querySelectorAll('[data-task]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.target.dataset.task;
        this.selectTask(taskId);
      });
    });
  }

  displayAvailableTasks() {
    const tasks = [
      { id: 'provision', name: 'Provision vCluster', status: 'ready' },
      { id: 'deploy', name: 'Deploy Application', status: 'ready' },
      { id: 'test', name: 'Run Test Suite', status: 'ready' },
      { id: 'chaos', name: 'Execute Chaos Tests', status: 'ready' },
      { id: 'analyze', name: 'Analyze Results', status: 'ready' },
      { id: 'cleanup', name: 'Cleanup Resources', status: 'ready' }
    ];

    const container = document.querySelector('[data-section="tasks"]');
    if (!container) return;

    container.innerHTML = tasks.map(task => `
      <button data-task="${task.id}" class="task-button flex items-center gap-3 p-3 rounded border border-outline-variant hover:border-primary transition-colors text-left">
        <span class="w-3 h-3 rounded-full" data-status="${task.status}"></span>
        <div class="flex-1">
          <p class="text-sm font-mono font-bold">${task.name}</p>
          <p class="text-xs text-on-surface-variant">${task.status}</p>
        </div>
      </button>
    `).join('');

    // Re-attach listeners
    document.querySelectorAll('[data-task]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectTask(e.currentTarget.dataset.task);
      });
    });
  }

  selectTask(taskId) {
    this.selectedTask = taskId;
    
    // Update UI
    document.querySelectorAll('[data-task]').forEach(btn => {
      btn.classList.toggle('border-primary', btn.dataset.task === taskId);
    });

    this.writeLog(`Selected task: ${taskId}`, 'info');
    this.displayTaskDetails(taskId);
  }

  displayTaskDetails(taskId) {
    const details = {
      provision: {
        name: 'Provision vCluster',
        description: 'Create isolated virtual cluster for testing',
        duration: '3-5 minutes',
        resources: 'CPU: 4, Memory: 8GB'
      },
      deploy: {
        name: 'Deploy Application',
        description: 'Deploy code to provisioned environment',
        duration: '2-3 minutes',
        resources: 'Kubernetes, Docker'
      },
      test: {
        name: 'Run Test Suite',
        description: 'Execute load and integration tests',
        duration: '4-8 minutes',
        resources: 'k6, 500 VUs'
      },
      chaos: {
        name: 'Execute Chaos Tests',
        description: 'Inject failures and measure resilience',
        duration: '3-6 minutes',
        resources: 'Toxiproxy, Chaos Toolkit'
      },
      analyze: {
        name: 'Analyze Results',
        description: 'Evaluate performance and generate report',
        duration: '1-2 minutes',
        resources: 'AI Engine, Data Processing'
      },
      cleanup: {
        name: 'Cleanup Resources',
        description: 'Destroy resources and release quota',
        duration: '1-2 minutes',
        resources: 'Kubernetes cleanup'
      }
    };

    const task = details[taskId];
    const container = document.querySelector('[data-section="task-details"]');
    if (!container) return;

    container.innerHTML = `
      <div class="space-y-3">
        <h3 class="text-lg font-bold">${task.name}</h3>
        <p class="text-sm text-on-surface-variant">${task.description}</p>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p class="text-xs text-on-surface-variant">Duration</p>
            <p class="font-mono">${task.duration}</p>
          </div>
          <div>
            <p class="text-xs text-on-surface-variant">Resources</p>
            <p class="font-mono">${task.resources}</p>
          </div>
        </div>
      </div>
    `;
  }

  async executeSelectedTask() {
    if (!this.selectedTask) {
      this.writeLog('No task selected', 'error');
      return;
    }

    this.writeLog(`Executing task: ${this.selectedTask}`, 'system');
    this.updateTaskStatus(this.selectedTask, 'running');

    // Simulate task execution
    setTimeout(() => {
      this.writeLog(`Task ${this.selectedTask} completed successfully`, 'success');
      this.updateTaskStatus(this.selectedTask, 'completed');
    }, 5000);
  }

  pauseTask() {
    if (this.selectedTask) {
      this.updateTaskStatus(this.selectedTask, 'paused');
      this.writeLog(`Task paused: ${this.selectedTask}`, 'warning');
    }
  }

  resumeTask() {
    if (this.selectedTask) {
      this.updateTaskStatus(this.selectedTask, 'running');
      this.writeLog(`Task resumed: ${this.selectedTask}`, 'info');
    }
  }

  stopTask() {
    if (this.selectedTask) {
      this.updateTaskStatus(this.selectedTask, 'stopped');
      this.writeLog(`Task stopped: ${this.selectedTask}`, 'error');
    }
  }

  updateTaskStatus(taskId, status) {
    const statusButton = document.querySelector(`[data-task="${taskId}"] [data-status]`);
    if (statusButton) {
      const colorMap = {
        ready: 'bg-gray-400',
        running: 'bg-blue-400 animate-pulse',
        completed: 'bg-green-400',
        paused: 'bg-yellow-400',
        stopped: 'bg-red-400'
      };
      statusButton.className = `w-3 h-3 rounded-full ${colorMap[status]}`;
    }
  }

  writeLog(message, type = 'info') {
    const logs = document.querySelector('[data-section="logs"]');
    if (!logs) return;

    const timestamp = new Date().toLocaleTimeString();
    const colorClass = this.getLogColor(type);

    const logLine = document.createElement('div');
    logLine.className = `font-mono text-xs ${colorClass}`;
    logLine.textContent = `[${timestamp}] ${message}`;

    logs.appendChild(logLine);

    // Scroll to bottom
    logs.scrollTop = logs.scrollHeight;

    // Keep only last 100 lines
    while (logs.children.length > 100) {
      logs.removeChild(logs.firstChild);
    }
  }

  getLogColor(type) {
    const colors = {
      system: 'text-primary',
      info: 'text-on-surface',
      success: 'text-green-400',
      warning: 'text-yellow-400',
      error: 'text-red-400'
    };
    return colors[type] || colors.info;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VoidCommandController().init();
});
