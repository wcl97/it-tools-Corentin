// IT-Tools Desktop Wrapper - Electron main process
// Serves the built static site over a local HTTP server (required because
// it-tools uses vue-router in HTML5 history mode, which breaks on file://)

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');

const ROOT = path.join(__dirname, 'renderer');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath;
      try {
        urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }

      // Prevent path traversal
      const filePath = path.normalize(path.join(ROOT, urlPath));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const sendFile = (p) => {
        fs.readFile(p, (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
          res.end(data);
        });
      };

      fs.stat(filePath, (err, stat) => {
        if (!err && stat.isFile()) {
          sendFile(filePath);
          return;
        }
        if (!err && stat.isDirectory()) {
          const index = path.join(filePath, 'index.html');
          if (fs.existsSync(index)) {
            sendFile(index);
            return;
          }
        }
        // SPA fallback: unknown route -> index.html (vue-router history mode)
        const fallback = path.join(ROOT, 'index.html');
        if (fs.existsSync(fallback)) {
          sendFile(fallback);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

let mainWindow = null;

async function createWindow() {
  const port = await startServer();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'IT-Tools',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    backgroundColor: '#18181b',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/`);

  // Open target=_blank / external links in the system browser instead of a new window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

Menu.setApplicationMenu(null);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
