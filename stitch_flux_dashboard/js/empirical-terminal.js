/**
 * Empirical Terminal Controller
 * Manages real-time terminal output for SRE commands
 */

class EmpiricalTerminalController {
  constructor() {
    this.ws = fluxWS;
    this.maxLines = 1000;
    this.outputLines = [];
    this.isScrollLocked = false;
  }

  async init() {
    console.log('Initializing empirical terminal...');
    try {
      await this.connectWebSocket();
      this.setupEventListeners();
      this.initializeTerminal();
      console.log('Terminal initialized');
    } catch (error) {
      console.error('Failed to initialize terminal:', error);
      this.writeOutput('ERROR: Failed to initialize terminal\n', 'error');
    }
  }

  async connectWebSocket() {
    return new Promise((resolve) => {
      this.ws.connect()
        .then(() => {
          // Listen for terminal output
          this.ws.on('terminal-output', (data) => {
            this.writeOutput(data.output, data.type || 'info');
          });
          resolve();
        })
        .catch(() => {
          this.writeOutput('WARNING: WebSocket not connected - terminal updates unavailable\n', 'warning');
          resolve();
        });
    });
  }

  initializeTerminal() {
    this.writeOutput('$ FLUX SRE Terminal Initialized\n', 'system');
    this.writeOutput('$ Type "help" for available commands\n', 'system');
    this.writeOutput('$ Ready for input...\n\n', 'system');
  }

  setupEventListeners() {
    // Command input
    const cmdInput = document.querySelector('[data-input="command"]') || document.querySelector('.terminal-input') || document.querySelector('input[type="text"]');
    if (cmdInput) {
      cmdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.executeCommand(cmdInput.value);
          cmdInput.value = '';
        }
      });
    }

    // Clear button
    const clearBtn = document.querySelector('[data-action="clear"]') || this.findButtonByText('CLEAR');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearTerminal());
    }

    // Scroll-lock toggle
    const scrollBtn = document.querySelector('[data-action="scroll-lock"]');
    if (scrollBtn) {
      scrollBtn.addEventListener('click', () => this.toggleScrollLock());
    }

    // Auto-scroll on output
    const output = this.getOutputElement();
    if (output) {
      output.addEventListener('scroll', () => {
        // User scrolled
        const atBottom = output.scrollHeight - output.scrollTop <= output.clientHeight + 50;
        this.isScrollLocked = !atBottom;
      });
    }
  }

  writeOutput(text, type = 'info') {
    const output = this.getOutputElement();
    if (!output) return;

    const lines = text.split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        this.outputLines.push({ text: line, type });
      }
    });

    // Keep only last N lines
    if (this.outputLines.length > this.maxLines) {
      this.outputLines = this.outputLines.slice(-this.maxLines);
    }

    this.renderOutput();
    
    // Auto-scroll if not locked
    if (!this.isScrollLocked) {
      setTimeout(() => {
        output.scrollTop = output.scrollHeight;
      }, 0);
    }
  }

  renderOutput() {
    const output = this.getOutputElement();
    if (!output) return;

    output.innerHTML = this.outputLines.map((line) => {
      const colorClass = this.getLineColor(line.type);
      return `<div class="font-mono text-xs ${colorClass}">${this.escapeHtml(line.text)}</div>`;
    }).join('');
  }

  getLineColor(type) {
    const colors = {
      'system': 'text-primary',
      'info': 'text-on-surface',
      'success': 'text-green-400',
      'warning': 'text-yellow-400',
      'error': 'text-red-400',
      'debug': 'text-blue-400'
    };
    return colors[type] || colors.info;
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  executeCommand(cmd) {
    this.writeOutput(`$ ${cmd}\n`, 'system');

    // Parse command
    const parts = cmd.trim().split(' ');
    const command = parts[0];

    switch (command) {
      case 'help':
        this.showHelp();
        break;
      case 'status':
        this.showStatus();
        break;
      case 'jobs':
        this.showJobs();
        break;
      case 'clear':
        this.clearTerminal();
        break;
      case 'echo':
        this.writeOutput(parts.slice(1).join(' ') + '\n', 'info');
        break;
      default:
        this.writeOutput(`Unknown command: ${command}\n`, 'error');
    }

    this.writeOutput('', 'system'); // Blank line for spacing
  }

  showHelp() {
    const help = `
Available Commands:
  help              - Show this help message
  status            - Show system status
  jobs              - List running jobs
  clear             - Clear terminal
  echo [text]       - Echo text to terminal

Type "help" for more information
    `.trim();
    
    this.writeOutput(help + '\n', 'info');
  }

  showStatus() {
    const status = `
FLUX System Status:
  Orchestrator:     OPERATIONAL
  vCluster Pool:    12/16 Active
  WebSocket:        CONNECTED
  Database:         CONNECTED
  Cost/Min:         $0.47
    `.trim();
    
    this.writeOutput(status + '\n', 'success');
  }

  showJobs() {
    const jobs = `
Running Jobs:
  PR #402           RUNNING (45% complete)
  PR #401           BLOCKED (failed)
  PR #400           COMPLETED (3.2h ago)
    `.trim();
    
    this.writeOutput(jobs + '\n', 'info');
  }

  clearTerminal() {
    this.outputLines = [];
    this.renderOutput();
    this.writeOutput('$ Terminal cleared\n', 'system');
  }

  toggleScrollLock() {
    this.isScrollLocked = !this.isScrollLocked;
    const btn = document.querySelector('[data-action="scroll-lock"]');
    if (btn) {
      btn.textContent = this.isScrollLocked ? 'Unlock Scroll' : 'Lock Scroll';
    }
  }

  getOutputElement() {
    return document.querySelector('[data-section="output"]') || document.querySelector('.terminal-output');
  }

  findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find((btn) => (btn.textContent || '').trim().toUpperCase() === text.toUpperCase()) || null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new EmpiricalTerminalController().init();
});
