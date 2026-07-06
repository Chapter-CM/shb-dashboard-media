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

const PORT = parseInt(process.env.INGEST_PORT || '3001', 10);

const trackHandler = wrap(emailTrack);
const ingestHandler = wrap(fbIngest);

const server = http.createServer((req, res) => {
  const path = req.url.split('?')[0];
  if (path === '/api/track' || path === '/api/email-track') return trackHandler(req, res);
  if (path === '/api/ingest' || path === '/api/fb-ingest') return ingestHandler(req, res);
  if (path === '/healthz') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`[ingest-server] listening on :${PORT}`);
});
