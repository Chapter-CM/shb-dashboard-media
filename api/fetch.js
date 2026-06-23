'use strict';
/*
 * Cron ingest: Facebook Page Graph API -> Supabase.
 * Chạy định kỳ qua Vercel cron (xem vercel.json). Đọc cấu hình từ env vars.
 *
 * NGUYÊN TẮC:
 *  - Lõi tương tác (reactions/comments/shares) lấy bằng EDGE EXPANSION trên post
 *    object — ổn định, không phụ thuộc Insights (nhóm hay bị Meta cắt).
 *  - Views/Reach/Clicks lấy qua Insights — VÙNG BIẾN ĐỘNG. Tên metric đặt trong
 *    FB_INSIGHT_METRICS (env) để chỉnh không cần sửa code; metric lỗi được bỏ qua
 *    (ghi vào errors[]) thay vì làm hỏng cả lần fetch.
 *  - fb_posts giữ số liệu HIỆN TẠI (upsert mỗi lần); fb_snapshots + fb_page_snapshots
 *    tích luỹ LỊCH SỬ để dựng trend / velocity / follower-growth.
 *
 * ⚠️ Đợt deprecation 15/06/2026 đã đổi tên nhiều metric Insights — xác nhận
 *    FB_INSIGHT_METRICS với Graph API reference đúng version trước khi tin số liệu.
 */
const https = require('https');

const GRAPH = process.env.GRAPH_VERSION || 'v21.0';
const PAGE_ID = process.env.FB_PAGE_ID;
const TOKEN = process.env.FB_PAGE_TOKEN;
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const POST_LIMIT = parseInt(process.env.FB_POST_LIMIT || '50', 10);
// Tên metric Insights — chỉnh qua env cho khớp version đang dùng.
const INSIGHT_METRICS = (process.env.FB_INSIGHT_METRICS || 'post_impressions_unique,post_clicks').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

function getJSON(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, { headers: { Accept: 'application/json' } }, function (r) {
      var b = ''; r.on('data', function (c) { b += c; });
      r.on('end', function () { try { var j = JSON.parse(b); if (j && j.error) reject(new Error(j.error.message || JSON.stringify(j.error))); else resolve(j); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
function sbWrite(path, body, prefer) {
  return new Promise(function (resolve, reject) {
    var data = JSON.stringify(body), u = new URL(SB_URL + path);
    var req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: prefer || 'return=minimal', 'Content-Length': Buffer.byteLength(data) } },
      function (r) { var b = ''; r.on('data', function (c) { b += c; }); r.on('end', function () { (r.statusCode >= 200 && r.statusCode < 300) ? resolve(b) : reject(new Error('Supabase ' + r.statusCode + ' ' + b)); }); });
    req.on('error', reject); req.write(data); req.end();
  });
}
function graph(path, params) {
  var qs = Object.keys(params || {}).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
  return getJSON('https://graph.facebook.com/' + GRAPH + '/' + path + '?' + (qs ? qs + '&' : '') + 'access_token=' + encodeURIComponent(TOKEN));
}
function rc(o) { return (o && o.summary && o.summary.total_count) || 0; }
function mapType(p) {
  var st = p.status_type || '', att = (p.attachments && p.attachments.data && p.attachments.data[0]) || {};
  var mt = (att.media_type || att.type || '') + ' ' + (att.title || '');
  if (/reel/i.test(mt)) return 'Reel';
  if (/video/i.test(mt) || /video/i.test(st)) return 'Video';
  if (/photo|album|image/i.test(mt) || /photo/i.test(st)) return 'Ảnh';
  if (/share|link/i.test(mt) || att.unshimmed_url || att.target) return 'Link';
  return 'Text';
}
function topicOf(msg) { var m = (msg || '').match(/#(\w+)/); return m ? m[1] : 'Khác'; }

var REACT = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
var REACT_FIELDS = REACT.map(function (t) { return 'reactions.type(' + t.toUpperCase() + ').limit(0).summary(total_count).as(' + t + ')'; }).join(',');
var POST_FIELDS = 'id,message,created_time,status_type,permalink_url,shares,attachments{media_type,type,title,target,unshimmed_url},comments.limit(0).summary(true),' + REACT_FIELDS;

module.exports = async (req, res) => {
  var out = { ok: false, posts: 0, errors: [], insightMetrics: INSIGHT_METRICS };
  if (!PAGE_ID || !TOKEN || !SB_URL || !SB_KEY) {
    res.status(500).json({ error: 'Thiếu env: cần FB_PAGE_ID, FB_PAGE_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY' }); return;
  }
  try {
    var page = await graph(PAGE_ID, { fields: 'followers_count,fan_count' });
    var feed = await graph(PAGE_ID + '/posts', { fields: POST_FIELDS, limit: POST_LIMIT });
    var rows = [], snaps = [];
    var list = (feed && feed.data) || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var react = {}; REACT.forEach(function (t) { react[t] = rc(p[t]); });
      var comments = (p.comments && p.comments.summary && p.comments.summary.total_count) || 0;
      var shares = (p.shares && p.shares.count) || 0;
      var ins = {};
      if (INSIGHT_METRICS.length) {
        try {
          var io = await graph(p.id + '/insights', { metric: INSIGHT_METRICS.join(',') });
          ((io && io.data) || []).forEach(function (m) { ins[m.name] = (m.values && m.values[0] && m.values[0].value) || 0; });
        } catch (e) { out.errors.push('insights ' + p.id + ': ' + e.message); }
      }
      var views = ins.post_impressions_unique || ins.post_impressions || ins.post_views || 0;
      var clicks = ins.post_clicks || 0;
      var reactionsTotal = REACT.reduce(function (a, t) { return a + react[t]; }, 0);
      var engagement = reactionsTotal + comments + shares;
      rows.push({
        post_id: p.id, page_id: PAGE_ID, message: p.message || '', created_time: p.created_time,
        type: mapType(p), permalink: p.permalink_url || '', topic: topicOf(p.message), views: views,
        like_count: react.like, love_count: react.love, haha_count: react.haha, wow_count: react.wow, sad_count: react.sad, angry_count: react.angry,
        comments: comments, shares: shares, clicks: clicks, updated_at: new Date().toISOString()
      });
      snaps.push({ post_id: p.id, views: views, reactions: reactionsTotal, comments: comments, shares: shares, clicks: clicks, engagement: engagement });
    }
    if (rows.length) {
      await sbWrite('/rest/v1/fb_posts?on_conflict=post_id', rows, 'resolution=merge-duplicates,return=minimal');
      await sbWrite('/rest/v1/fb_snapshots', snaps, 'return=minimal');
    }
    var pageEng = snaps.reduce(function (a, s) { return a + s.engagement; }, 0);
    var pageViews = snaps.reduce(function (a, s) { return a + s.views; }, 0);
    await sbWrite('/rest/v1/fb_page_snapshots', [{ page_id: PAGE_ID, followers: page.followers_count || page.fan_count || 0, views: pageViews, engagement: pageEng }], 'return=minimal');
    out.ok = true; out.posts = rows.length;
    res.status(200).json(out);
  } catch (e) { out.errors.push(e.message); res.status(500).json(out); }
};
