// ==UserScript==
// @name         SHB Content Library → Supabase
// @namespace    shb-fb-dashboard
// @version      1.0.0
// @description  Bắt response Professional Dashboard Content Library (bài Group "SHB Một Nhà") và đẩy sang /api/ingest. Groups API công khai đã bị Meta gỡ 22/04/2024 nên đây là nguồn dữ liệu duy nhất.
// @author       SHB CM
// @match        https://www.facebook.com/*
// @match        https://business.facebook.com/*
// @grant        GM_xmlhttpRequest
// @connect      shb-fb-dashboard.vercel.app
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ── CẤU HÌNH (chỉ nằm trên máy admin, KHÔNG commit secret thật) ──────────
  var INGEST = 'https://shb-fb-dashboard.vercel.app/api/ingest';
  var SECRET = 'PASTE_INGEST_SECRET_HERE';   // dán INGEST_SECRET của Vercel vào đây
  var GROUP_ID = '503009407721580';          // SHB Một Nhà
  var AUTO_SCROLL = true;                     // tự cuộn để lazy-load hết bài trong dải ngày đang chọn
  var DEBUG = true;

  function log() { if (DEBUG) try { console.log.apply(console, ['[SHB-CL]'].concat([].slice.call(arguments))); } catch (e) {} }

  // post_id chuẩn = số trong permalink .../permalink/{id}/  (ổn định hơn id GraphQL).
  function extractId(n) {
    var pl = n.permalink || n.url || n.permalink_url || '';
    var m = String(pl).match(/permalink\/(\d+)/) || String(pl).match(/\/posts\/(\d+)/) || String(pl).match(/(\d{6,})/);
    if (m) return m[1];
    // fallback: id GraphQL (có thể là base64/feedback id) — vẫn dùng làm khoá nếu không có permalink
    return String(n.post_id || n.id || n.legacy_story_id || '').trim();
  }

  // Một số metric của prodash bọc trong {value: N} hoặc {count: N} hoặc số thẳng.
  function metric(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'object') { var x = v.value != null ? v.value : (v.count != null ? v.count : v.total_count); return Number(x) || 0; }
    var n = Number(v); return isNaN(n) ? 0 : n;
  }

  function pickTitle(n) {
    return n.title || n.message || (n.preview && n.preview.text) || (n.story && n.story.message && n.story.message.text) || '';
  }
  function pickPermalink(n) {
    return n.permalink || n.url || n.permalink_url || n.story_permalink || '';
  }
  function pickCreated(n) {
    var c = n.created_time || n.creation_time || n.publish_time || n.created || null;
    if (c == null) return null;
    // epoch giây -> ISO; nếu đã là chuỗi thì giữ nguyên
    if (typeof c === 'number') return new Date(c < 1e12 ? c * 1000 : c).toISOString();
    return c;
  }

  var sent = {}; // chống gửi trùng trong cùng phiên

  function handle(json) {
    var lib = json && json.data && json.data.prodash_content_library;
    if (!lib || !lib.edges) return;
    var rows = [];
    lib.edges.forEach(function (e) {
      var n = (e && e.node) || {};
      var id = extractId(n);
      if (!id) return;
      var key = id + ':' + metric(n.reach) + ':' + metric(n.engagement);
      if (sent[key]) return; sent[key] = 1;
      rows.push({
        post_id: id,
        group_id: GROUP_ID,
        title: pickTitle(n),
        permalink: pickPermalink(n),
        created_time: pickCreated(n),
        post_type: n.post_type || n.subtype || n.type || '',
        reach: metric(n.reach),
        viewers: metric(n.viewers || n.unique_viewers || n.media_viewers),
        engagement: metric(n.engagement || n.engagement_count || n.total_engagement),
        comments: metric(n.comment || n.comments || n.comment_count),
        source: 'prodash'
      });
    });
    if (!rows.length) return;
    log('gửi', rows.length, 'bài', rows);
    GM_xmlhttpRequest({
      method: 'POST', url: INGEST,
      headers: { 'Content-Type': 'application/json', 'x-ingest-secret': SECRET },
      data: JSON.stringify(rows),
      onload: function (r) { log('ingest', r.status, r.responseText); },
      onerror: function (e) { log('ingest LỖI', e); }
    });
  }

  function tryParse(text) {
    if (!text || text.indexOf('prodash_content_library') < 0) return;
    // Response GraphQL của FB có thể là nhiều JSON nối nhau bằng newline.
    String(text).split('\n').forEach(function (line) {
      line = line.trim(); if (!line) return;
      try { handle(JSON.parse(line)); } catch (e) {}
    });
  }

  // ── Hook fetch ───────────────────────────────────────────────────────────
  var of = window.fetch;
  if (of) {
    window.fetch = function () {
      var p = of.apply(this, arguments);
      try { p.then(function (r) { try { r.clone().text().then(tryParse); } catch (e) {} }); } catch (e) {}
      return p;
    };
  }

  // ── Hook XHR (FB dùng cả hai) ──────────────────────────────────────────────
  var oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__shbUrl = u; return oo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try { tryParse(this.responseText); } catch (e) {}
    });
    return os.apply(this, arguments);
  };

  // ── Auto-scroll để lazy-load hết bài (FB chỉ render dần khi cuộn) ──────────
  if (AUTO_SCROLL) {
    var idle = 0, lastH = 0;
    var timer = setInterval(function () {
      window.scrollTo(0, document.body.scrollHeight);
      var h = document.body.scrollHeight;
      if (h === lastH) { if (++idle >= 6) { clearInterval(timer); log('auto-scroll xong'); } }
      else { idle = 0; lastH = h; }
    }, 1500);
  }

  log('userscript đã nạp — mở Content Library và để trang tự cuộn.');
})();
