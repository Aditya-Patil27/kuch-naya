const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

wss.on('connection', (socket) => {
  socket.isAlive = true;
  clients.add(socket);

  socket.on('pong', () => {
    socket.isAlive = true;
  });

  socket.on('close', () => {
    clients.delete(socket);
  });

  socket.on('error', () => {
    clients.delete(socket);
  });
});

function broadcastJob(event, data) {
  const payload = JSON.stringify({ event, data, ts: Date.now() });

  for (const client of clients) {
    if (client.readyState === 1) {
      try {
        client.send(payload);
      } catch {
        client.terminate();
        clients.delete(client);
      }
    }
  }
}

const heartbeat = setInterval(() => {
  for (const client of clients) {
    if (client.isAlive === false) {
      client.terminate();
      clients.delete(client);
      continue;
    }

    client.isAlive = false;
    client.ping();
  }
}, 25000);

heartbeat.unref();

module.exports = { wss, clients, broadcastJob };
