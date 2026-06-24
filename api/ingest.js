'use strict';
/*
 * Ingest endpoint — nhận bài Group "SHB Một Nhà" từ userscript (Professional
 * Dashboard Content Library) và upsert vào Supabase.
 *
 * Vì sao tồn tại: Facebook Groups API công khai đã bị Meta gỡ 22/04/2024, không
 * token/quyền nào đọc nội dung group qua Graph API nữa. Dữ liệu chỉ còn ở GraphQL
 * nội bộ của Professional Dashboard. Userscript chạy trong trình duyệt thật của
 * admin bắt response đó rồi POST sang đây — giữ Supabase service key + secret
 * server-side, tách "nguồn nạp" khỏi dashboard.
 *
 * Bảo mật: header `x-ingest-secret` phải khớp env INGEST_SECRET, sai -> 401.
 * Env cần: INGEST_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY.
 */
const https = require('https');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const SECRET = process.env.INGEST_SECRET;
const GROUP_ID = process.env.FB_GROUP_ID || '503009407721580'; // SHB Một Nhà

function sbWrite(path, body, prefer) {
  return new Promise(function (resolve, reject) {
    var data = JSON.stringify(body), u = new URL(SB_URL + path);
    var req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: prefer || 'return=minimal', 'Content-Length': Buffer.byteLength(data) } },
      function (r) { var b = ''; r.on('data', function (c) { b += c; }); r.on('end', function () { (r.statusCode >= 200 && r.statusCode < 300) ? resolve(b) : reject(new Error('Supabase ' + r.statusCode + ' ' + b)); }); });
    req.on('error', reject); req.write(data); req.end();
  });
}

function num(v) { v = parseInt(v, 10); return isNaN(v) ? 0 : v; }
function str(v) { return (v == null) ? '' : String(v); }

// Chuẩn hoá 1 bài từ userscript -> 1 row fb_group_posts. Phòng thủ với tên field
// thật chưa chắc (engagement/comments/created_time): chấp nhận nhiều biến thể.
function normalize(p) {
  if (!p || typeof p !== 'object') return null;
  var postId = str(p.post_id || p.postId || p.id).trim();
  if (!postId) return null;
  var created = p.created_time || p.createdTime || p.created || null;
  var row = {
    post_id: postId,
    group_id: str(p.group_id || GROUP_ID),
    title: str(p.title || p.message || ''),
    permalink: str(p.permalink || p.url || ''),
    post_type: str(p.post_type || p.type || ''),
    reach: num(p.reach),
    viewers: num(p.viewers),
    engagement: num(p.engagement),
    comments: num(p.comments),
    source: str(p.source || 'prodash'),
    updated_at: new Date().toISOString()
  };
  if (created) { var t = new Date(created); if (!isNaN(t.getTime())) row.created_time = t.toISOString(); }
  return row;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // userscript dùng GM_xmlhttpRequest, '*' đủ an toàn vì có secret
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-ingest-secret');
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body != null) { resolve(req.body); return; }
    var b = ''; req.on('data', function (c) { b += c; });
    req.on('end', function () { try { resolve(b ? JSON.parse(b) : null); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!SECRET || !SB_URL || !SB_KEY) { res.status(500).json({ error: 'Thiếu env: INGEST_SECRET / SUPABASE_URL / SUPABASE_SERVICE_KEY' }); return; }

  var got = req.headers['x-ingest-secret'];
  if (!got || got !== SECRET) { res.status(401).json({ error: 'unauthorized' }); return; }

  try {
    var body = await readBody(req);

    // Payload cấp TRANG (page-level insights) — {kind:'page', metrics:{}, series:{}, date_range}
    if (body && body.kind === 'page') {
      var prow = {
        date_range: str(body.date_range || ''),
        metrics: (body.metrics && typeof body.metrics === 'object') ? body.metrics : {},
        series: (body.series && typeof body.series === 'object') ? body.series : {}
      };
      if (!Object.keys(prow.metrics).length && !Object.keys(prow.series).length) {
        res.status(200).json({ ok: true, kind: 'page', note: 'không có metric' }); return;
      }
      await sbWrite('/rest/v1/fb_page_insights', [prow], 'return=minimal');
      res.status(200).json({ ok: true, kind: 'page', metrics: Object.keys(prow.metrics).length, series: Object.keys(prow.series).length }); return;
    }

    var list = Array.isArray(body) ? body : (body && Array.isArray(body.posts) ? body.posts : null);
    if (!list) { res.status(400).json({ error: 'body phải là mảng post hoặc {posts:[...]}' }); return; }

    var rows = list.map(normalize).filter(Boolean);
    if (!rows.length) { res.status(200).json({ ok: true, received: list.length, upserted: 0, note: 'không có post_id hợp lệ' }); return; }

    await sbWrite('/rest/v1/fb_group_posts?on_conflict=post_id', rows, 'resolution=merge-duplicates,return=minimal');
    var snaps = rows.map(function (r) { return { post_id: r.post_id, reach: r.reach, viewers: r.viewers, engagement: r.engagement, comments: r.comments }; });
    await sbWrite('/rest/v1/fb_group_post_snapshots', snaps, 'return=minimal');

    res.status(200).json({ ok: true, received: list.length, upserted: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
