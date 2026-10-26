/**
 * FaceCount AI · Local Dev & Mobile Wi-Fi Server
 * Pure Node.js (Zero external dependencies)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT_HTTP = process.env.PORT || 3000;
const PORT_HTTPS = process.env.PORT_HTTPS || 3443;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
  '.apk': 'application/vnd.android.package-archive'
};

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function handleRequest(req, res) {
  // CORS & Security headers for camera and WebRTC
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  // Direct download route for 100% Native Android APK
  if (reqPath === '/download-native-apk' || reqPath === '/FaceCount-Native.apk') {
    const nativeApkPath = path.join('C:/Users/Administrator/.gemini/antigravity/scratch', 'FaceCount-Native.apk');
    if (fs.existsSync(nativeApkPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="FaceCount-Native.apk"',
        'Content-Length': fs.statSync(nativeApkPath).size
      });
      fs.createReadStream(nativeApkPath).pipe(res);
      return;
    }
  }

  // Direct download route for Android APK
  if (reqPath === '/download-apk' || reqPath === '/FaceCountAI.apk') {
    const apkPath = path.join(PUBLIC_DIR, 'FaceCountAI.apk');
    if (fs.existsSync(apkPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="FaceCountAI.apk"',
        'Content-Length': fs.statSync(apkPath).size
      });
      fs.createReadStream(apkPath).pipe(res);
      return;
    }
  }

  // Direct download route for zip
  if (reqPath === '/download' || reqPath === '/download-zip') {
    const zipPath = path.join(PUBLIC_DIR, 'facecount-ai-app.zip');
    if (fs.existsSync(zipPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="facecount-ai-app.zip"',
        'Content-Length': fs.statSync(zipPath).size
      });
      fs.createReadStream(zipPath).pipe(res);
      return;
    }
  }

  // Direct download route for standalone html
  if (reqPath === '/download-html') {
    const htmlPath = path.join(PUBLIC_DIR, 'facecount-ai-app.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'attachment; filename="facecount-ai-app.html"',
        'Content-Length': fs.statSync(htmlPath).size
      });
      fs.createReadStream(htmlPath).pipe(res);
      return;
    }
  }

  // QR Code generator helper page
  if (reqPath === '/qr') {
    const ips = getLocalIpAddresses();
    const targetUrl = ips.length ? `http://${ips[0]}:${PORT_HTTP}` : `http://localhost:${PORT_HTTP}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(targetUrl)}`;
    
    const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Download & Open · FaceCount AI</title>
      <style>
        body { background: #07090e; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
        .card { background: #0f172a; padding: 28px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); max-width: 380px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
        h1 { margin: 0 0 8px 0; font-size: 1.4rem; color: #06b6d4; }
        p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px; }
        .qr-box { background: #fff; padding: 12px; border-radius: 12px; display: inline-block; }
        .url-pill { margin-top: 18px; padding: 10px 16px; background: rgba(6,182,212,0.15); border: 1px solid #06b6d4; border-radius: 8px; font-family: monospace; font-size: 0.95rem; color: #38bdf8; word-break: break-all; }
        .btn-group { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; width: 100%; }
        .btn-dl { display: block; padding: 12px 18px; background: linear-gradient(135deg, #06b6d4, #0284c7); color: #fff; text-decoration: none; font-weight: 700; border-radius: 10px; font-size: 0.95rem; }
        .btn-dl-sub { display: block; padding: 10px 18px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; text-decoration: none; font-weight: 600; border-radius: 10px; font-size: 0.88rem; }
        .tip { margin-top: 20px; font-size: 0.8rem; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>📱 FaceCount AI</h1>
        <p>Scan with your phone to open, or download the app package below:</p>
        <div class="qr-box">
          <img src="${qrApiUrl}" width="260" height="260" alt="QR Code">
        </div>
        <div class="url-pill">${targetUrl}</div>
        <div class="btn-group">
          <a href="/download-native-apk" class="btn-dl" style="background: linear-gradient(135deg, #10b981, #059669); font-size: 1.05rem;">⚡ Download Native Android APK (NEW)</a>
          <a href="/download-apk" class="btn-dl-sub">🤖 Download Web-Based APK</a>
          <a href="/download" class="btn-dl-sub">📦 Download Source ZIP</a>
          <a href="/" class="btn-dl-sub">🚀 Launch Web App in Browser</a>
        </div>
        <p class="tip">Ensure your phone is connected to the same Wi-Fi network.</p>
      </div>
    </body>
    </html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  const filePath = path.join(PUBLIC_DIR, reqPath);

  // Security: prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

// Start HTTP Server
const serverHttp = http.createServer(handleRequest);

serverHttp.listen(PORT_HTTP, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log('\n======================================================');
  console.log('  👤 FaceCount AI · Mobile Phone Face Detector Server');
  console.log('======================================================\n');
  console.log(`  🖥️  Desktop Local URL:   http://localhost:${PORT_HTTP}`);
  if (ips.length) {
    ips.forEach(ip => {
      console.log(`  📱  Mobile Wi-Fi URL:    http://${ip}:${PORT_HTTP}`);
      console.log(`  📷  Mobile QR Code Page: http://${ip}:${PORT_HTTP}/qr`);
    });
  }
  console.log('\n------------------------------------------------------');
  console.log('  💡 TIPS FOR PHONE TESTING:');
  console.log('  1. Open http://localhost:' + PORT_HTTP + ' on your computer to test now.');
  console.log('  2. To open on your phone over Wi-Fi, open the Mobile Wi-Fi URL.');
  console.log('  3. Open http://localhost:' + PORT_HTTP + '/qr to scan the QR code with phone!');
  console.log('======================================================\n');
});
