/**
 * FLUX WebSocket Handler
 * Manages real-time connection and event streaming from backend
 */

const WS_URL = 'ws://localhost:5000/ws';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

class FluxWebSocket {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.messageHandlers = {};
    this.eventListeners = {};
    this.messageQueue = [];
    this.heartbeatInterval = null;
  }

  /**
   * Connect to WebSocket server and establish listeners
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.processQueuedMessages();
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Attempt reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      this.emit('connection-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(() => {
        console.error('Reconnection failed');
      });
    }, delay);
  }

  /**
   * Send message to server
   */
  send(message) {
    const data = typeof message === 'object' ? JSON.stringify(message) : message;

    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn('WebSocket not connected, queuing message');
      this.messageQueue.push(data);
    }
  }

  /**
   * Process queued messages when connection restored
   */
  processQueuedMessages() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handle incoming messages and dispatch to handlers
   */
  handleMessage(message) {
    const { type, data, jobId } = message;

    console.log('WebSocket message:', type);

    // Handle specific message types
    if (type === 'job-update' && jobId) {
      this.emit('job-update', { jobId, data });
    } else if (type === 'metrics-update') {
      this.emit('metrics-update', data);
    } else if (type === 'analysis-complete') {
      this.emit('analysis-complete', data);
    } else if (type === 'queue-update') {
      this.emit('queue-update', data);
    } else if (type === 'pong') {
      // Heartbeat response
      console.log('Heartbeat received');
    }

    // Emit generic message event
    this.emit('message', message);
  }

  /**
   * Subscribe to specific message type
   */
  on(eventType, callback) {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
    }
    this.eventListeners[eventType].push(callback);
  }

  /**
   * Unsubscribe from specific message type
   */
  off(eventType, callback) {
    if (!this.eventListeners[eventType]) return;

    this.eventListeners[eventType] = this.eventListeners[eventType].filter(
      (cb) => cb !== callback
    );
  }

  /**
   * Emit event to all listeners
   */
  emit(eventType, data) {
    if (!this.eventListeners[eventType]) return;

    this.eventListeners[eventType].forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    });
  }

  /**
   * Subscribe to job updates
   */
  subscribeToJob(jobId, callback) {
    const handler = (data) => {
      if (data.jobId === jobId) {
        callback(data.data);
      }
    };
    this.on('job-update', handler);
    return () => this.off('job-update', handler);
  }

  /**
   * Watch for metrics changes
   */
  onMetricsUpdate(callback) {
    this.on('metrics-update', callback);
    return () => this.off('metrics-update', callback);
  }

  /**
   * Watch for analysis completion
   */
  onAnalysisComplete(callback) {
    this.on('analysis-complete', callback);
    return () => this.off('analysis-complete', callback);
  }

  /**
   * Watch for queue changes
   */
  onQueueUpdate(callback) {
    this.on('queue-update', callback);
    return () => this.off('queue-update', callback);
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.messageQueue = [];
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      readyState: this.ws ? this.ws.readyState : null,
      queuedMessages: this.messageQueue.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create singleton instance
const fluxWS = new FluxWebSocket();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = fluxWS;
}
