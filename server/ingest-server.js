'use strict';
/*
 * Node ingest server nội bộ (:3001) — thay cho 2 Vercel function `api/email-track.js`
 * (beacon Outlook) và `api/fb-ingest.js` (POST userscript). Theo kiến trúc §4 kế hoạch:
 * nginx route GET /api/track và POST /api/ingest sang service này; mọi route khác
 * (dashboard) là file tĩnh do nginx phục vụ trực tiếp, không qua đây.
 *
 * Env cần: EMAIL_SUPABASE_URL/EMAIL_SUPABASE_SERVICE_KEY (hoặc URL/KEY nội bộ tương đương),
 * SUPABASE_URL/SUPABASE_SERVICE_KEY, INGEST_SECRET. Xem .env.example.
 */
const http = require('http');
const { wrap } = require('./vercel-compat');

const emailTrack = require('../api/email-track');
const fbIngest = require('../api/fb-ingest');

const PORT = parseInt(process.env.SERVER_PORT || process.env.INGEST_PORT || '3001', 10);

const trackHandler = wrap(emailTrack);
const ingestHandler = wrap(fbIngest);

// Chẩn đoán tạm — liệt kê SHOW DATABASES từ BÊN TRONG pod (khác hẳn đường mạng
// GitLab runner đã bị Security Group chặn). Cần header/query x-ingest-secret
// khớp INGEST_SECRET để tránh lộ ra ngoài. XOÁ route này sau khi xác nhận xong
// MYSQL_DATABASE — chỉ dùng để chẩn đoán 1 lần.
function dbDebugHandler(req, res) {
  var url = new URL(req.url, 'http://x');
  var got = url.searchParams.get('secret') || req.headers['x-ingest-secret'];
  if (!process.env.INGEST_SECRET || got !== process.env.INGEST_SECRET) {
    res.writeHead(401); return res.end('unauthorized');
  }
  if (!process.env.MYSQL_HOST || !process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD) {
    res.writeHead(500); return res.end('Thieu MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD trong env cua pod nay.\n');
  }
  var mysql = require('mysql2/promise');
  mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    connectTimeout: 10000
  }).then(function (conn) {
    return conn.query('SHOW DATABASES;').then(function (result) {
      var dbs = result[0];
      conn.end();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('SHOW DATABASES:\n' + dbs.map(function (r) { return r.Database; }).join('\n') + '\n');
    });
  }).catch(function (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('LOI ket noi MySQL tu trong pod: ' + (e.code || '') + ' - ' + e.message + '\n');
  });
}

const server = http.createServer((req, res) => {
  const path = req.url.split('?')[0];
  if (path === '/api/track' || path === '/api/email-track') return trackHandler(req, res);
  if (path === '/api/ingest' || path === '/api/fb-ingest') return ingestHandler(req, res);
  if (path === '/dbdebug') return dbDebugHandler(req, res);
  if (path === '/healthz') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`[ingest-server] listening on :${PORT}`);
});
