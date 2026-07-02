// SHB Email Tracker — track endpoint v3.6 (beacon Email + dwell/thời gian đọc)
// ENV: EMAIL_SUPABASE_URL, EMAIL_SUPABASE_SERVICE_KEY (ghi vào Supabase Email — tách khỏi SUPABASE_* của Facebook)
'use strict';
const https = require('https');

const SUPABASE_URL = process.env.EMAIL_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_KEY  = process.env.EMAIL_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'
);

// ── Dwell (thời gian đọc) ──────────────────────────────────────────────
// Pixel bottom được stream NHỎ GIỌT: client giữ kết nối chừng nào email còn
// mở, đóng email → client hủy tải ảnh → đo được thời gian đọc (kiểu Litmus).
// Ghi thêm event pos='dwell' với dwell_s (cần cột dwell_s — db/migrate_05).
const DWELL_CAP_S   = Math.max(5, parseInt(process.env.EMAIL_DWELL_CAP_S || '25', 10) || 25);
const DWELL_TICK_MS = 2000;
const GIF_BODY    = GIF.slice(0, GIF.length - 1);              // GIF trừ byte trailer 0x3B
const GIF_TRAILER = GIF.slice(GIF.length - 1);
const GIF_PAD     = Buffer.from([0x21, 0xFE, 0x01, 0x20, 0x00]); // comment block — hợp lệ trước trailer

// Proxy/gateway tải ảnh hộ (không phải người đọc) → dwell vô nghĩa, bỏ đo
function isImageProxy(ua) {
  return /GoogleImageProxy|ggpht|YahooMailProxy|proofpoint|barracuda|mimecast/i.test(ua || '');
}

// Sanitize: remove null bytes (causes Supabase 22P05 error), clip length
function clip(v, n) {
  if (v == null || v === '') return null;
  return String(v).replace(/\u0000/g, '').slice(0, n);
}



// Fix VBA encoding bug: @ (hex 40) encoded as literal "40" instead of "%40"
// e.g. "dung.ha440shb.com.vn@shb.com.vn" -> "dung.ha4@shb.com.vn"
function fixRcpt(v) {
  if (!v) return v;
  var m = v.match(/^([\w.+\-]+?)40([\w.\-]+\.[a-z]{2,})@\2$/i);
  return m ? (m[1] + '@' + m[2]) : v;
}

function streamDwellPixel(req, res, row) {
  const t0 = Date.now();
  const pending = [
    insertEvent(row).catch(e => console.error('[SHB Tracker] Insert failed:', e.message))
  ];
  res.writeHead(200, {
    'Content-Type':  'image/gif',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma':        'no-cache',
    'Expires':       '0',
    'Access-Control-Allow-Origin': '*'
  });
  res.write(GIF_BODY);
  return new Promise((resolve) => {
    let done = false, hb = null, cap = null;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(hb);
      clearTimeout(cap);
      // Ghi dwell TRƯỚC khi kết thúc response: Vercel có thể freeze function
      // ngay sau khi response end → insert đứng sau res.end() sẽ bị rơi
      const dwell = Math.min(DWELL_CAP_S, Math.round((Date.now() - t0) / 1000));
      pending.push(insertEvent(Object.assign({}, row, {
        pos: 'dwell', dwell_s: dwell, ts: new Date().toISOString()
      })).catch(e => console.error('[SHB Tracker] Dwell insert failed:', e.message)));
      const end = () => {
        try { res.write(GIF_TRAILER); res.end(); } catch (e) { /* client đã ngắt */ }
        resolve();
      };
      Promise.all(pending).then(end, end);
    };
    hb  = setInterval(() => { try { res.write(GIF_PAD); } catch (e) { finish(); } }, DWELL_TICK_MS);
    cap = setTimeout(finish, DWELL_CAP_S * 1000);
    res.on('close', finish);
    res.on('error', finish);
    req.on('close', finish);
  });
}

function insertEvent(row) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL || !SERVICE_KEY) return resolve(null);
    const body = JSON.stringify(row);
    const host = SUPABASE_URL.replace(/^https?:\/\//, '');
    const req = https.request({
      hostname: host,
      path:     '/rest/v1/events',
      method:   'POST',
      headers: {
        'apikey':         SERVICE_KEY,
        'Authorization':  'Bearer ' + SERVICE_KEY,
        'Content-Type':   'application/json',
        'Prefer':         'return=minimal',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(buf);
        else reject(new Error('Supabase ' + res.statusCode + ': ' + buf));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  if (req.method && req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' });
    return res.end();
  }

  // req.query is provided by Vercel — auto-decoded, reliable
  const q = req.query || {};

  // FIX: VBA sends "eid" not "id", "squad" not "initiative", "type" not "msg_type"
  // Accept both old and new param names for backward compat
  const getParam = (newName, oldName) =>
    (q[newName] != null && q[newName] !== '') ? q[newName]
    : (oldName && q[oldName] != null && q[oldName] !== '') ? q[oldName]
    : null;

  // Campaigns to block — events from these are silently ignored (not written to Supabase)
  const BLOCKED_CAMPAIGNS = [
    'ban-tin-du-an-sinh-loi-tu-dong-thang-6-cap-nhat-ket-qua',
  ];

  const VALID = new Set(['sent', 'top', 'bottom', 'click', 'read']);
  const pos   = VALID.has(String(q.pos || '').toLowerCase())
                ? String(q.pos).toLowerCase() : 'top';

  const t = parseInt(getParam('target_size'), 10);
  const row = {
    event_id:    clip(getParam('eid', 'id'),            60),
    pos:         pos,
    rcpt:        fixRcpt(clip(getParam('rcpt'),         160)),
    campaign:    clip(getParam('campaign'),             80),
    subject:     clip(getParam('subject'),            160),
    msg_type:    clip(getParam('type', 'msg_type'),    16),
    initiative:  clip(getParam('squad', 'initiative'), 80),
    target_size: isNaN(t) ? null : t,
    dept:        clip(getParam('dept'),                80),
    role:        clip(getParam('role'),                80),
    loc:         clip(getParam('loc'),                 80),
    link:        clip(getParam('url', 'link'),        500),
    dest:        clip(getParam('dest'),               500),
    ua:          clip(req.headers['user-agent'],      200),
    ts:          new Date().toISOString()
  };

  // Validate event_id
  const ID_RE = /^[\w\-]{1,60}$/;
  if (row.event_id && !ID_RE.test(row.event_id)) row.event_id = null;

  const isBlocked = row.campaign && BLOCKED_CAMPAIGNS.includes(row.campaign);

  // BOTTOM → pixel streaming đo thời gian đọc (ghi cả event bottom lẫn dwell)
  if (pos === 'bottom' && row.event_id && !isBlocked && !isImageProxy(row.ua)) {
    return streamDwellPixel(req, res, row);
  }

  if (row.event_id && !isBlocked) {
    try {
      await insertEvent(row);
    } catch (err) {
      console.error('[SHB Tracker] Insert failed:', err.message);
    }
  }

  // CLICK: redirect to original URL
  if (pos === 'click') {
    // VBA sends original URL as "url=" param (UrlEnc encoded)
    // req.query auto-decodes it: %3A→: %2F→/ etc.
    const dest = getParam('url', 'dest') || getParam('link') || '';
    if (dest) {
      // Must be absolute URL to redirect properly
      const isAbsolute = /^https?:\/\//i.test(dest);
      const location   = isAbsolute ? dest : ('https://' + dest);
      try {
        res.writeHead(302, {
          'Location':      location,
          'Cache-Control': 'no-store, no-cache',
          'Pragma':        'no-cache'
        });
        return res.end();
      } catch (e) {
        console.error('[SHB Tracker] Redirect error:', e.message, '| dest:', dest);
      }
    }
    // Fallback: return pixel if no dest
  }

  // READ: confirmation page
  if (pos === 'read') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(`<!DOCTYPE html><html lang="vi"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Da ghi nhan</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;
    margin:0;background:#0f0d1a;color:#f2effc}
  .card{text-align:center;padding:40px 32px;background:rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.1);border-radius:20px;max-width:340px}
  .icon{font-size:42px;margin-bottom:16px}
  h2{margin:0 0 8px;font-size:18px;font-weight:700}
  p{margin:0;font-size:13px;color:#8e89b3;line-height:1.5}
</style></head><body>
<div class="card"><div class="icon">&#10003;</div>
<h2>Da ghi nhan</h2>
<p>Cam on ban da xac nhan.<br>Phan hoi cua ban giup chung toi cai thien<br>chat luong thong tin.</p>
</div></body></html>`);
  }

  // PIXEL (default)
  res.writeHead(200, {
    'Content-Type':   'image/gif',
    'Content-Length': GIF.length,
    'Cache-Control':  'no-cache, no-store, must-revalidate',
    'Pragma':         'no-cache',
    'Expires':        '0',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(GIF);
};

// Vercel: bật streaming response cho pixel dwell (Fluid compute mặc định đã hỗ trợ)
module.exports.config = { supportsResponseStreaming: true };
