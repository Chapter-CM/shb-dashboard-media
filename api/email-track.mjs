// SHB Email Tracker — track endpoint v4.0 (Web Handler + dwell/thời gian đọc)
// Viết theo Web Handler (Request→Response + ReadableStream) vì kiểu (req,res)
// cũ KHÔNG nhận được tín hiệu client ngắt kết nối qua proxy của Vercel →
// dwell luôn chạm trần. Web handler nhận abort qua request.signal/stream cancel.
// ENV: EMAIL_SUPABASE_URL, EMAIL_SUPABASE_SERVICE_KEY (Supabase Email — tách
// khỏi SUPABASE_* của Facebook), EMAIL_DWELL_CAP_S (trần đo, mặc định 25s).

const SUPABASE_URL = process.env.EMAIL_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_KEY  = process.env.EMAIL_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'
);

// ── Dwell (thời gian đọc) ──────────────────────────────────────────────
// Pixel top/bottom được stream NHỎ GIỌT: email còn mở = kết nối còn giữ,
// đóng email = client hủy tải → đo được số giây đọc (kiểu Litmus).
// Ghi event pos='dwell' + cột dwell_s (db/migrate_05).
const DWELL_CAP_S   = Math.max(5, parseInt(process.env.EMAIL_DWELL_CAP_S || '25', 10) || 25);
const DWELL_TICK_MS = 2000;
const GIF_BODY    = GIF.slice(0, GIF.length - 1);               // GIF trừ byte trailer 0x3B
const GIF_TRAILER = GIF.slice(GIF.length - 1);
const GIF_PAD     = Buffer.from([0x21, 0xFE, 0x01, 0x20, 0x00]); // comment block — hợp lệ trước trailer

// waitUntil (Fluid compute): giữ function sống để hoàn tất ghi Supabase sau khi
// response kết thúc. Không có package thì fallback await trong cancel().
let waitUntil = null;
try { ({ waitUntil } = await import('@vercel/functions')); } catch (e) { /* optional */ }

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
  const m = v.match(/^([\w.+\-]+?)40([\w.\-]+\.[a-z]{2,})@\2$/i);
  return m ? (m[1] + '@' + m[2]) : v;
}

async function insertEvent(row) {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const res = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/events', {
    method: 'POST',
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    },
    body: JSON.stringify(row)
  });
  if (!res.ok) throw new Error('Supabase ' + res.status + ': ' + await res.text());
  return null;
}

const PIXEL_HEADERS = {
  'Content-Type':  'image/gif',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma':        'no-cache',
  'Expires':       '0',
  'Access-Control-Allow-Origin': '*'
};

// Campaigns to block — events from these are silently ignored
const BLOCKED_CAMPAIGNS = [
  'ban-tin-du-an-sinh-loi-tu-dong-thang-6-cap-nhat-ket-qua',
];

const VALID = new Set(['sent', 'top', 'bottom', 'click', 'read']);
const ID_RE = /^[\w\-]{1,60}$/;

function logErr(prefix) {
  return (e) => console.error('[SHB Tracker] ' + prefix + ':', e && e.message);
}

// Pixel streaming đo dwell: ghi event top/bottom NGAY, giữ kết nối tới khi
// client ngắt (đóng email) hoặc chạm trần → ghi event dwell với số giây.
function dwellResponse(request, row) {
  const t0 = Date.now();
  const pending = [insertEvent(row).catch(logErr('Insert failed'))];
  let hb = null, cap = null, done = false, ctrl = null;

  const finish = () => {
    if (done) return done;
    done = (async () => {
      clearInterval(hb);
      clearTimeout(cap);
      const dwell = Math.min(DWELL_CAP_S, Math.round((Date.now() - t0) / 1000));
      pending.push(insertEvent(Object.assign({}, row, {
        pos: 'dwell', dwell_s: dwell, ts: new Date().toISOString()
      })).catch(logErr('Dwell insert failed')));
      const all = Promise.all(pending).then(() => {});
      if (waitUntil) try { waitUntil(all); } catch (e) { /* ignore */ }
      await all; // giữ function sống tới khi ghi xong (kể cả không có waitUntil)
      try { ctrl.enqueue(GIF_TRAILER); ctrl.close(); } catch (e) { /* client đã ngắt */ }
    })();
    return done;
  };

  const stream = new ReadableStream({
    start(controller) {
      ctrl = controller;
      controller.enqueue(GIF_BODY);
      hb  = setInterval(() => { try { controller.enqueue(GIF_PAD); } catch (e) { finish(); } }, DWELL_TICK_MS);
      cap = setTimeout(finish, DWELL_CAP_S * 1000);
      if (request.signal) request.signal.addEventListener('abort', finish, { once: true });
    },
    cancel() { return finish(); } // client đóng email/tab → đo dwell tại đây
  });
  return new Response(stream, { status: 200, headers: PIXEL_HEADERS });
}

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const getParam = (newName, oldName) =>
    (sp.get(newName) != null && sp.get(newName) !== '') ? sp.get(newName)
    : (oldName && sp.get(oldName) != null && sp.get(oldName) !== '') ? sp.get(oldName)
    : null;

  const pos = VALID.has(String(sp.get('pos') || '').toLowerCase())
              ? String(sp.get('pos')).toLowerCase() : 'top';

  const t = parseInt(getParam('target_size'), 10);
  const row = {
    event_id:    clip(getParam('eid', 'id'),            60),
    pos:         pos,
    rcpt:        fixRcpt(clip(getParam('rcpt'),         160)),
    campaign:    clip(getParam('campaign'),             80),
    subject:     clip(getParam('subject'),             160),
    msg_type:    clip(getParam('type', 'msg_type'),     16),
    initiative:  clip(getParam('squad', 'initiative'),  80),
    target_size: isNaN(t) ? null : t,
    dept:        clip(getParam('dept'),                 80),
    role:        clip(getParam('role'),                 80),
    loc:         clip(getParam('loc'),                  80),
    link:        clip(getParam('url', 'link'),         500),
    dest:        clip(getParam('dest'),                500),
    ua:          clip(request.headers.get('user-agent'), 200),
    ts:          new Date().toISOString()
  };
  if (row.event_id && !ID_RE.test(row.event_id)) row.event_id = null;

  const isBlocked = row.campaign && BLOCKED_CAMPAIGNS.includes(row.campaign);

  // TOP/BOTTOM → pixel streaming đo thời gian đọc. VBA hiện chỉ nhúng pixel
  // top nên top là nguồn đo chính; bottom giữ cho email cũ còn 2 pixel.
  if ((pos === 'top' || pos === 'bottom') && row.event_id && !isBlocked && !isImageProxy(row.ua)) {
    return dwellResponse(request, row);
  }

  if (row.event_id && !isBlocked) {
    try { await insertEvent(row); } catch (e) { logErr('Insert failed')(e); }
  }

  // CLICK: redirect to original URL
  if (pos === 'click') {
    const dest = getParam('url', 'dest') || getParam('link') || '';
    if (dest) {
      const location = /^https?:\/\//i.test(dest) ? dest : ('https://' + dest);
      return new Response(null, {
        status: 302,
        headers: { 'Location': location, 'Cache-Control': 'no-store, no-cache', 'Pragma': 'no-cache' }
      });
    }
    // Fallback: return pixel if no dest
  }

  // READ: confirmation page
  if (pos === 'read') {
    return new Response(`<!DOCTYPE html><html lang="vi"><head>
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
</div></body></html>`, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  // PIXEL (default — sent, proxy, thiếu event_id, campaign bị chặn)
  return new Response(GIF, { status: 200, headers: PIXEL_HEADERS });
}
