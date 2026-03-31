const crypto = require('crypto');

function safeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};

  const output = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue;
    output[key] = value;
  }
  return output;
}

function log(level, message, meta = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...safeMeta(meta),
  };
  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}

function logInfo(message, meta = {}) {
  log('info', message, meta);
}

function logWarn(message, meta = {}) {
  log('warn', message, meta);
}

function logError(message, meta = {}) {
  log('error', message, meta);
}

function requestContext() {
  return (req, res, next) => {
    const requestId = req.header('x-request-id') || crypto.randomUUID();
    req.requestId = requestId;
    req.requestStartAt = Date.now();

    res.setHeader('x-request-id', requestId);
    next();
  };
}

function requestLogger() {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      logInfo('http_request', {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip,
      });
    });

    next();
  };
}

module.exports = {
  requestContext,
  requestLogger,
  logInfo,
  logWarn,
  logError,
};
