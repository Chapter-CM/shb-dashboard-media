// ==UserScript==
// @name         SHB Content Library → Supabase
// @namespace    shb-fb-dashboard
// @version      3.6.0
// @description  Bắt response Professional Dashboard Content Library (bài Group "SHB Một Nhà") và đẩy sang /api/ingest. Groups API công khai đã bị Meta gỡ 22/04/2024 nên đây là nguồn dữ liệu duy nhất.
// @author       SHB CM
// @match        https://www.facebook.com/*
// @match        https://business.facebook.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      cm-dashboard.dev-saha.aws.shb.com.vn
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ── CẤU HÌNH (chỉ nằm trên máy admin, KHÔNG commit secret thật) ──────────
  // Đổi 14/07/2026: endpoint nội bộ SHB (trước là Vercel, xem lịch sử HANDOFF.md).
  var INGEST = 'https://cm-dashboard.dev-saha.aws.shb.com.vn/api/ingest';
  var SECRET = '500a13c1-4b4a-4da0-a4c7-c4200e51b66a';   // INGEST_SECRET noi bo SHB
  var GROUP_ID = '503009407721580';          // SHB Một Nhà
  var AUTO_SCROLL = true;                     // tự cuộn để lazy-load hết bài trong dải ngày đang chọn
  var DEBUG = true;

  // Hook trên window THẬT của trang (unsafeWindow) — KHÔNG phải sandbox của Tampermonkey.
  // Đây là điểm mấu chốt: response data đến qua XHR của trang; hook window sandbox sẽ trượt.
  var W = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

  function log() { if (DEBUG) try { console.log.apply(console, ['[SHB-CL]'].concat([].slice.call(arguments))); } catch (e) {} }

  function mval(insights, key) {
    var m = insights && insights[key];
    return (m && typeof m.value === 'number') ? m.value : 0;
  }
  function idFromUrl(url) {
    var m = String(url || '').match(/permalink\/(\d+)/) || String(url || '').match(/\/posts\/(\d+)/) || String(url || '').match(/(\d{6,})/);
    return m ? m[1] : '';
  }

  // Bóc TẤT CẢ chỉ số {value} trong entity_insights của 1 bài (Lượt hiển thị, Số người
  // theo dõi thực, Lượt phân phối, watch time, ≥3s/≥1ph...). Lưu jsonb metrics.
  function entMetrics(ins) {
    var o = {};
    if (ins && typeof ins === 'object') {
      Object.keys(ins).forEach(function (k) {
        var v = ins[k];
        if (v && typeof v === 'object' && typeof v.value === 'number') o[k] = v.value;
      });
    }
    return o;
  }

  // Chuẩn hoá 1 node ProDashContentLibraryStory -> 1 row ingest.
  function mapNode(node) {
    if (!node) return null;
    var story = node.story || {};
    var ent = node.tofu_entity || {};
    var ins = ent.entity_insights || {};
    var postId = String(ent.entity_id || idFromUrl(story.url) || '').trim();
    if (!postId) return null;
    // CHẶN bài của trang/group KHÁC: chỉ nhận bài thuộc GROUP_ID (SHB Một Nhà).
    var grp = (story.target_group && story.target_group.id) ? String(story.target_group.id) : '';
    if (grp && grp !== GROUP_ID) return null;
    if (!grp) { var u = String(story.url || ''); if (u.indexOf(GROUP_ID) < 0 && u.indexOf('shbmotnha') < 0) return null; }
    var created = null;
    if (story.creation_time) { try { created = new Date(story.creation_time * 1000).toISOString(); } catch (e) {} }
    return {
      post_id: postId,
      group_id: (story.target_group && story.target_group.id) || GROUP_ID,
      title: node.title || '',
      permalink: story.url || '',
      created_time: created,
      post_type: node.business_content_type || node.__typename || '',
      reach: mval(ins, 'views'),          // cột "Lượt xem" (headline)
      viewers: mval(ins, 'viewers'),      // "Người xem" (unique)
      engagement: mval(ins, 'engagement'),// "Tương tác"
      comments: mval(ins, 'comment'),     // "Bình luận"
      metrics: entMetrics(ins),           // TẤT CẢ chỉ số per-post (jsonb)
      source: 'prodash'
    };
  }

  var sent = {}; // chống gửi trùng trong cùng phiên

  function handleLibrary(lib) {
    if (!lib || !lib.edges || !lib.edges.length) return;
    var rows = [];
    lib.edges.forEach(function (e) {
      var row = mapNode(e && e.node);
      if (!row) return;
      var key = row.post_id + ':' + row.reach + ':' + row.engagement;
      if (sent[key]) return; sent[key] = 1;
      rows.push(row);
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

  // Tìm prodash_content_library ở các vị trí có thể: data.node.* hoặc data.*
  function scanJson(j) {
    if (!j || !j.data) return;
    var d = j.data;
    if (d.node && d.node.prodash_content_library) handleLibrary(d.node.prodash_content_library);
    if (d.prodash_content_library) handleLibrary(d.prodash_content_library);
  }

  // ── PAGE-LEVEL: trích generic mọi metric {value} + time-series từ insights ──
  var SKIP = { recent_posts: 1, image: 1, privacy_icon: 1, attachments: 1, story: 1 };
  var NOISE = { raw_query_result: 1 }; // key bao quanh giá trị 1 bài viết -> bỏ
  function extractMetrics(obj, acc) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { for (var i = 0; i < obj.length; i++) extractMetrics(obj[i], acc); return; }
    for (var k in obj) {
      if (SKIP[k]) continue;
      var v = obj[k];
      if (!v || typeof v !== 'object') continue;
      var tn = v.__typename || '';
      if (typeof v.value === 'number' && /Metric/.test(tn) && !NOISE[k]) { acc.metrics[k] = v.value; }
      else if (/TimeSeries/.test(tn)) { if (!acc.series[k]) acc.series[k] = v; }
      else if (/Breakdown/.test(tn) && Array.isArray(v.bucket_values)) { acc.series[k] = v; } // nhân khẩu học (tuổi/giới...)
      else extractMetrics(v, acc);
    }
  }
  // Mảnh deferred của time-series tới theo path riêng (vd ["...","view_time_series","data_points"]).
  function grabSeriesByPath(j, acc) {
    if (!j || !Array.isArray(j.path) || typeof j.data === 'undefined') return;
    for (var i = 0; i < j.path.length; i++) {
      if (/time_series/i.test(String(j.path[i]))) { acc.series[j.path[i]] = j.data; return; }
    }
  }
  function rangeFromUrl() { var m = String(location.search).match(/date_range=([A-Z0-9_]+)/); return m ? m[1] : ''; }
  var pageLastSent = '';
  function sendPage(acc) {
    var sCount = Object.keys(acc.series).sort().map(function (k) { var pts = acc.series[k] && acc.series[k].points; return k + ':' + (Array.isArray(pts) ? pts.length : 0); }).join(',');
    var sig = JSON.stringify(acc.metrics) + '|' + sCount;
    if (sig === pageLastSent) return; pageLastSent = sig;
    log('PAGE metrics:', acc.metrics, '| series:', Object.keys(acc.series));
    Object.keys(acc.series).forEach(function (k) { log('  series[' + k + ']:', JSON.stringify(acc.series[k]).slice(0, 400)); });
    GM_xmlhttpRequest({
      method: 'POST', url: INGEST,
      headers: { 'Content-Type': 'application/json', 'x-ingest-secret': SECRET },
      data: JSON.stringify({ kind: 'page', date_range: rangeFromUrl(), metrics: acc.metrics, series: acc.series }),
      onload: function (r) { log('page ingest', r.status, r.responseText); },
      onerror: function (e) { log('page ingest LỖI', e); }
    });
  }

  function tryParse(text) {
    text = String(text || '');
    var hasLib = text.indexOf('prodash_content_library') > -1;
    var hasPage = /professional_dashboard/.test(location.pathname) &&
      (text.indexOf('MetricsQueryResult') > -1 || text.indexOf('TimeSeries') > -1);
    if (!hasLib && !hasPage) return;
    var pageAcc = { metrics: {}, series: {} };
    // Response FB hay có tiền tố for(;;); và nhiều JSON (deferred) nối bằng newline.
    text.replace(/^for\s*\(;;\);/, '').split('\n').forEach(function (line) {
      line = line.trim(); if (!line) return;
      var j; try { j = JSON.parse(line); } catch (e) { return; }
      if (hasLib) scanJson(j);
      if (hasPage) { extractMetrics(j, pageAcc); grabSeriesByPath(j, pageAcc); }
    });
    if (hasPage && (Object.keys(pageAcc.metrics).length || Object.keys(pageAcc.series).length)) sendPage(pageAcc);
  }

  // ── Hook fetch (trên window thật) ─────────────────────────────────────────
  var of = W.fetch;
  if (of) {
    W.fetch = function () {
      var p = of.apply(this, arguments);
      try { p.then(function (r) { try { r.clone().text().then(tryParse); } catch (e) {} }); } catch (e) {}
      return p;
    };
  }

  // ── Hook XHR (trên window thật) — FB dùng cái này cho graphql ──────────────
  var XHR = W.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    var oo = XHR.prototype.open, os = XHR.prototype.send;
    XHR.prototype.open = function (m, u) { this.__shbUrl = u; return oo.apply(this, arguments); };
    XHR.prototype.send = function () {
      var x = this;
      x.addEventListener('load', function () { try { tryParse(x.responseText); } catch (e) {} });
      return os.apply(this, arguments);
    };
  }

  // ── Auto-scroll để lazy-load hết bài (FB chỉ render dần khi cuộn) ──────────
  if (AUTO_SCROLL) {
    var idle = 0, lastH = 0;
    var timer = setInterval(function () {
      W.scrollTo(0, document.body.scrollHeight);
      var h = document.body.scrollHeight;
      if (h === lastH) { if (++idle >= 6) { clearInterval(timer); log('auto-scroll xong'); } }
      else { idle = 0; lastH = h; }
    }, 1500);
  }

  // ── AUTO-TOUR: tự đi hết các mục của Professional Dashboard để quét sạch ────
  // Bấm Ctrl+Shift+Y trên trang dashboard để bắt đầu. Script tự mở từng mục,
  // mỗi mục đợi ~10s (đủ để auto-scroll nạp hết widget + hook bắt số liệu), rồi sang mục kế.
  var TOUR = [
    '/professional_dashboard/?ref=tab_bar',
    '/professional_dashboard/profile_insights/views/',
    '/professional_dashboard/profile_insights/interactions/',
    '/professional_dashboard/profile_insights/audience/',
    '/professional_dashboard/profile_insights/earnings/',
    '/professional_dashboard/content/content_library/?ref=tab_bar'
  ];
  function tourTick() {
    var raw = null; try { raw = sessionStorage.getItem('shbTour'); } catch (e) {}
    if (!raw) return;
    var q; try { q = JSON.parse(raw); } catch (e) { q = null; }
    if (!q || !q.length) { try { sessionStorage.removeItem('shbTour'); } catch (e) {} return; }
    log('TOUR: đang ở', q[0], '— còn', q.length, 'mục');
    setTimeout(function () {
      q.shift();
      try { sessionStorage.setItem('shbTour', JSON.stringify(q)); } catch (e) {}
      if (q.length) { W.location.href = q[0]; }
      else { try { sessionStorage.removeItem('shbTour'); } catch (e) {} log('TOUR xong — đã quét hết các mục.'); }
    }, 10000);
  }
  function startTour() {
    try { sessionStorage.setItem('shbTour', JSON.stringify(TOUR.slice())); } catch (e) {}
    log('TOUR bắt đầu — sẽ tự đi qua', TOUR.length, 'mục (~1 phút). Đừng đụng chuột.');
    W.location.href = TOUR[0];
  }
  try {
    W.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'Y' || e.key === 'y')) { startTour(); }
    });
  } catch (e) {}
  if (/professional_dashboard/.test(location.pathname)) tourTick();

  log('userscript v3.6 đã nạp — bóc full chỉ số per-post + page-level. Bấm Ctrl+Shift+Y để tự quét hết các mục.');
})();
