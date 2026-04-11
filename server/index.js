const http = require('http');
const WebSocket = require('ws');
const ReconnectingWebSocket = require('reconnecting-websocket');
const url = require('url');
const path = require('path');
const fs = require('fs');
const enableGracefulShutdown = require('server-graceful-shutdown');

let gpsd = null;
try {
  gpsd = require('node-gpsd');
} catch (_) {
  console.warn('node-gpsd not available, GPS support disabled.');
}

const debug = process.env.EKOS_WEB_DEBUG === '1';
const livestackEndpoint = process.env.LIVESTACK_ENDPOINT;
const port = process.env.PORT || 3000;
const staticDir = path.join(__dirname, 'static');

const server = http.createServer();

// WebSocket servers
const messageServer = new WebSocket.Server({ noServer: true });
const mediaServer = new WebSocket.Server({ noServer: true });
const cloudServer = new WebSocket.Server({ noServer: true });
const interfaceServer = new WebSocket.Server({ noServer: true });

const signals = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGTERM: 15,
};

const shutdown = (signal, value) => {
  console.log('shutdown!');

  try { messageServer.close(); } catch (_) {}
  try { mediaServer.close(); } catch (_) {}
  try { cloudServer.close(); } catch (_) {}
  try { interfaceServer.close(); } catch (_) {}

  server.shutdown(() => {
    console.log(`server stopped by ${signal} with value ${value}`);
    process.exit(128 + value);
  });
};

Object.keys(signals).forEach((signal) => {
  process.on(signal, () => {
    console.log(`process received a ${signal} signal`);
    shutdown(signal, signals[signal]);
  });
});

// Keep track of latest state
let lastMessages = {};

const saveToLastMessages = (msg) => {
  if (!msg || !msg.type) return;

  if (typeof msg.payload === 'object' && msg.payload !== null && !Array.isArray(msg.payload)) {
    lastMessages[msg.type] = {
      ...(lastMessages[msg.type] || {}),
      ...msg.payload,
    };
  } else {
    lastMessages[msg.type] = msg.payload;
  }
};

const sendJSON = (ws, msg) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  if (debug) {
    console.log('sending message', msg);
  }

  ws.send(JSON.stringify(msg));
};

const broadcastJSON = (wss, msg) => {
  wss.clients.forEach((c) => {
    sendJSON(c, msg);
  });
};

const setupMediaServerOptions = (ws) => {
  sendJSON(ws, { type: 'set_blobs', payload: true });
};

// Optional GPS support
if (gpsd) {
  const gpsdListener = new gpsd.Listener({
    hostname: process.env.GPSD_HOST || '127.0.0.1',
    parse: true,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  });

  gpsdListener.on('TPV', (loc) => {
    const msg = {
      type: 'new_gps_state',
      payload: {
        lat: loc.lat,
        lon: loc.lon,
        alt: loc.alt,
        mode: loc.mode,
      },
    };

    saveToLastMessages(msg);
    broadcastJSON(interfaceServer, msg);
  });

  gpsdListener.on('error', () => {});

  try {
    gpsdListener.connect(() => {
      gpsdListener.watch();
    });
  } catch (err) {
    console.warn('GPSD connection failed:', err.message);
  }
}

// Browser interface websocket
interfaceServer.on('connection', (ws) => {
  console.log('Interface client connected');

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      console.log('INTERFACE RAW:', parsed);

      messageServer.clients.forEach((c) => {
        sendJSON(c, parsed);
      });
    } catch (err) {
      console.error('Invalid interface message:', err.message);
    }
  });

  Object.keys(lastMessages).forEach((key) => {
    sendJSON(ws, { type: key, payload: lastMessages[key] });
  });

  sendJSON(ws, {
    type: 'new_connection_state',
    payload: {
      connected: messageServer.clients.size > 0,
      online: messageServer.clients.size > 0,
    },
  });

  // si Ekos est déjà connecté quand le navigateur arrive,
  // on redemande l'état initial
  if (messageServer.clients.size > 0) {
    const initialRequests = [
      { type: 'get_profiles' },
      { type: 'get_connection_state' },
      { type: 'get_capture_status' },
      { type: 'get_mount_status' },
      { type: 'get_focus_status' },
      { type: 'get_guide_status' },
      { type: 'get_align_status' },
    ];

    messageServer.clients.forEach((c) => {
      initialRequests.forEach((msg) => sendJSON(c, msg));
    });
  }

  mediaServer.clients.forEach((c) => {
    setupMediaServerOptions(c);
  });

  ws.on('close', () => {
    console.log('Interface client disconnected');
  });
});

// Ekos message websocket
messageServer.on('connection', (ws) => {
  console.log('Ekos message channel connected');

  // prévenir immédiatement le navigateur qu'Ekos est en ligne
  broadcastJSON(interfaceServer, {
    type: 'new_connection_state',
    payload: { connected: true, online: true },
  });

  // demander l'état initial à Ekos
  const initialRequests = [
    { type: 'get_profiles' },
    { type: 'get_connection_state' },
    { type: 'get_capture_status' },
    { type: 'get_mount_status' },
    { type: 'get_focus_status' },
    { type: 'get_guide_status' },
    { type: 'get_align_status' },
  ];

  initialRequests.forEach((msg) => sendJSON(ws, msg));

  ws.on('message', (msg) => {
    try {
      const text = msg.toString();
      console.log('MESSAGE CHANNEL RAW:', text);

      const msgObj = JSON.parse(text);

      saveToLastMessages(msgObj);
      broadcastJSON(interfaceServer, msgObj);

      if (msgObj.type === 'new_connection_state') {
        if (msgObj.payload && msgObj.payload.online) {
          mediaServer.clients.forEach((c) => {
            setupMediaServerOptions(c);
          });
        } else {
          console.log('Clearing cached messages');
          lastMessages = {};
        }
      }
    } catch (err) {
      console.error('Invalid message channel payload:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('Ekos message channel disconnected');
    broadcastJSON(interfaceServer, {
      type: 'new_connection_state',
      payload: { connected: false, online: false },
    });
  });
});

// Ekos media websocket
mediaServer.on('connection', (ws) => {
  console.log('Ekos media channel connected');

  ws.on('message', (msg) => {
    try {
      // msg is expected to contain JSON metadata then binary jpeg
      const metaEnd = msg.indexOf('}');
      if (metaEnd < 0) {
        return;
      }

      const metaBuf = Buffer.from(msg.subarray(0, metaEnd + 1));
      const meta = JSON.parse(metaBuf.toString());

      const imgStart = msg.indexOf(0xff, metaEnd + 1);
      if (imgStart < 0) {
        return;
      }

      const raw = Buffer.from(msg.subarray(imgStart));
      const encoded = raw.toString('base64');

      const data = {
        type: 'image_data',
        payload: {
          ...meta,
          image: 'data:image/jpeg;base64,' + encoded,
        },
      };

      saveToLastMessages(data);
      broadcastJSON(interfaceServer, data);
    } catch (err) {
      console.error('Invalid media payload:', err.message);
    }
  });

  setupMediaServerOptions(ws);

  ws.on('close', () => {
    console.log('Ekos media channel disconnected');
  });
});

// Ekos cloud websocket
cloudServer.on('connection', (ws) => {
  console.log('Ekos cloud channel connected');

  ws.on('message', (msg) => {
    try {
      console.log('received cloud message');
    } catch (err) {
      console.error('Cloud message error:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('Ekos cloud channel disconnected');
  });
});

// Safe static file serving
const sendFile = (res, filePath) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.map': 'application/json; charset=utf-8',
    };

    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
};

server.on('request', (req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname || '/';

  if (debug) {
    console.log('HTTP request', pathname);
  }

  // Required by Ekos Live
  if (pathname === '/api/authenticate') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      token: 'TOKEN',
      success: true,
    }));
    return;
  }

  // Serve static frontend
  let filePath;
  if (pathname === '/' || pathname === '') {
    filePath = path.join(staticDir, 'index.html');
  } else {
    const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    filePath = path.join(staticDir, normalized);
  }

  // Prevent path traversal
  const resolvedStatic = path.resolve(staticDir);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(resolvedStatic)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(resolvedFile, (err, stat) => {
    if (!err && stat.isFile()) {
      sendFile(res, resolvedFile);
    } else {
      // SPA fallback
      sendFile(res, path.join(staticDir, 'index.html'));
    }
  });
});

// WebSocket upgrade routing
server.on('upgrade', (req, socket, head) => {
  const pathname = url.parse(req.url).pathname;

  if (debug) {
    console.log('upgrade started', pathname);
  }

  switch (pathname) {
    case '/message/ekos':
      messageServer.handleUpgrade(req, socket, head, (ws) => {
        messageServer.emit('connection', ws, req);
      });
      break;

    case '/cloud/ekos':
      cloudServer.handleUpgrade(req, socket, head, (ws) => {
        cloudServer.emit('connection', ws, req);
      });
      break;

    case '/media/ekos':
      mediaServer.handleUpgrade(req, socket, head, (ws) => {
        mediaServer.emit('connection', ws, req);
      });
      break;

    case '/interface':
      interfaceServer.handleUpgrade(req, socket, head, (ws) => {
        interfaceServer.emit('connection', ws, req);
      });
      break;

    default:
      socket.destroy();
  }
});

// Optional LiveStack bridge
if (livestackEndpoint) {
  const livestack = new ReconnectingWebSocket(livestackEndpoint, [], {
    WebSocket,
  });

  livestack.addEventListener('error', () => {});

  livestack.addEventListener('message', (msg) => {
    try {
      const msgObj = JSON.parse(msg.data);
      saveToLastMessages(msgObj);
      broadcastJSON(interfaceServer, msgObj);
    } catch (err) {
      console.error('LiveStack message error:', err.message);
    }
  });
}

enableGracefulShutdown(server, 1000);

server.listen(port, () => {
  console.log(`Ekos Web server listening on http://localhost:${port}`);
  console.log(`Serving frontend from ${staticDir}`);
});
