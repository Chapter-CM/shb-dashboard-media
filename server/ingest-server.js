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

// ── /ingest-bridge — trang cầu nối cho userscript Facebook (17/07/2026) ──────
// CSP của facebook.com chặn fetch ra domain ngoài từ Console, nhưng KHÔNG chặn
// postMessage giữa các cửa sổ. Script trên tab Facebook mở trang này (domain
// nội bộ, không dính CSP Facebook) rồi postMessage từng lô dữ liệu sang; trang
// này gọi /api/ingest CÙNG ORIGIN và trả kết quả về qua postMessage.
// KHÔNG chứa secret nào — secret do script Facebook gửi kèm message, /api/ingest
// tự xác thực như mọi request bình thường.
const BRIDGE_HTML = `<!doctype html><meta charset="utf-8"><title>SHB Ingest Bridge</title>
<body style="font:13px/1.6 system-ui;margin:16px;color:#111">
<b style="color:#e11d2a">SHB Ingest Bridge</b> — giữ cửa sổ này mở trong lúc cuộn Facebook.
<div id=log style="margin-top:8px;font:11px monospace;white-space:pre-wrap"></div>
<script>
(function(){
  var ALLOW = /^https:\\/\\/([a-z0-9-]+\\.)?facebook\\.com$/;
  var el = document.getElementById('log');
  function log(s){ el.textContent += s + '\\n'; }
  window.addEventListener('message', function(ev){
    if (!ALLOW.test(ev.origin)) return;
    var m = ev.data || {};
    if (m.type !== 'shb-ingest') return;
    fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ingest-secret': m.secret || '' },
      body: JSON.stringify(m.body)
    }).then(function(r){ return r.text().then(function(t){
      log((r.status < 300 ? 'OK  ' : 'LOI ') + r.status + ' ' + (m.label || '') + (r.status < 300 ? '' : ' ' + t.slice(0,150)));
      ev.source.postMessage({ type:'shb-ingest-result', id:m.id, label:m.label, status:r.status, text:t.slice(0,300) }, ev.origin);
    });}).catch(function(e){
      log('LOI ' + (m.label||'') + ' ' + e.message);
      ev.source.postMessage({ type:'shb-ingest-result', id:m.id, label:m.label, status:0, text:e.message }, ev.origin);
    });
  });
  if (window.opener) { try { window.opener.postMessage({ type:'shb-bridge-ready' }, '*'); } catch(e){} }
  log('Bridge sẵn sàng — chờ dữ liệu từ tab Facebook...');
})();
</scr` + `ipt>`;
function bridgeHandler(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(BRIDGE_HTML);
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
  if (path === '/ingest-bridge' || path.endsWith('/ingest-bridge')) return bridgeHandler(req, res);
  if (path === '/healthz') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`[ingest-server] listening on :${PORT}`);
});
