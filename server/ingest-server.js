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
const dbClient = require('../lib/db-client');

const emailTrack = require('../api/email-track');
const fbIngest = require('../api/fb-ingest');

const PORT = parseInt(process.env.SERVER_PORT || process.env.INGEST_PORT || '3001', 10);

const trackHandler = wrap(emailTrack);
const ingestHandler = wrap(fbIngest);

// Proxy đọc MySQL qua HTTP — dùng cho sync_data (chạy trên GitLab runner, bị Security
// Group chặn kết nối thẳng MySQL) gọi vào đây thay vì tự mở kết nối. Pod này chạy
// trong cluster nên tới RDS được bình thường. Cần header x-ingest-secret khớp
// INGEST_SECRET. Query param "path" = path kiểu PostgREST (giống db-client.get()).
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function dbQueryHandler(req, res) {
  var url = new URL(req.url, 'http://x');
  var got = url.searchParams.get('secret') || req.headers['x-ingest-secret'];
  if (!process.env.INGEST_SECRET || got !== process.env.INGEST_SECRET) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }
  var path = url.searchParams.get('path');
  if (!path) return sendJson(res, 400, { error: 'thieu query param "path"' });
  if (!process.env.MYSQL_HOST) return sendJson(res, 500, { error: 'Pod nay thieu MYSQL_HOST.' });
  dbClient.get(path).then(function (rows) {
    sendJson(res, 200, rows);
  }).catch(function (e) {
    sendJson(res, 500, { error: (e.code || '') + ' - ' + e.message });
  });
}

const server = http.createServer((req, res) => {
  // So khop bang endsWith (khong phai ===) vi Ingress public moi (service.dev-saha...
  // /public-api/api/track) co the KHONG strip prefix truoc khi chuyen toi pod nay -
  // nhan duoc "/public-api/api/track" thay vi "/api/track". Chi ap dung cho 2 route
  // cong khai (track/ingest); /dbquery + /healthz van doi hoi khop tuyet doi (noi bo).
  const path = req.url.split('?')[0];
  if (path === '/api/track' || path === '/api/email-track' || path.endsWith('/api/track')) return trackHandler(req, res);
  if (path === '/api/ingest' || path === '/api/fb-ingest' || path.endsWith('/api/ingest')) return ingestHandler(req, res);
  if (path === '/dbquery') return dbQueryHandler(req, res);
  if (path === '/healthz') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`[ingest-server] listening on :${PORT}`);
});
