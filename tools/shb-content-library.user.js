// ==UserScript==
// @name         SHB Content Library → Supabase
// @namespace    shb-fb-dashboard
// @version      3.0.0
// @description  Bắt response Professional Dashboard Content Library (bài Group "SHB Một Nhà") và đẩy sang /api/ingest. Groups API công khai đã bị Meta gỡ 22/04/2024 nên đây là nguồn dữ liệu duy nhất.
// @author       SHB CM
// @match        https://www.facebook.com/*
// @match        https://business.facebook.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
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

  // Chuẩn hoá 1 node ProDashContentLibraryStory -> 1 row ingest.
  function mapNode(node) {
    if (!node) return null;
    var story = node.story || {};
    var ent = node.tofu_entity || {};
    var ins = ent.entity_insights || {};
    var postId = String(ent.entity_id || idFromUrl(story.url) || '').trim();
    if (!postId) return null;
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
  var SKIP = { recent_posts: 1, image: 1, privacy_icon: 1, attachments: 1 };
  function extractMetrics(obj, acc) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { for (var i = 0; i < obj.length; i++) extractMetrics(obj[i], acc); return; }
    for (var k in obj) {
      if (SKIP[k]) continue;
      var v = obj[k];
      if (!v || typeof v !== 'object') continue;
      var tn = v.__typename || '';
      if (typeof v.value === 'number' && /Metric/.test(tn)) { acc.metrics[k] = v.value; }
      else if (/TimeSeries/.test(tn)) { acc.series[k] = v; }
      else extractMetrics(v, acc);
    }
  }
  function rangeFromUrl() { var m = String(location.search).match(/date_range=([A-Z0-9_]+)/); return m ? m[1] : ''; }
  var pageLastSent = '';
  function sendPage(acc) {
    var sig = JSON.stringify(acc.metrics) + '|' + Object.keys(acc.series).sort().join(',');
    if (sig === pageLastSent) return; pageLastSent = sig;
    log('PAGE metrics:', acc.metrics, '| series:', Object.keys(acc.series));
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
    var hasPage = text.indexOf('TofuFBPageEntityInsights') > -1;
    if (!hasLib && !hasPage) return;
    var pageAcc = { metrics: {}, series: {} };
    // Response FB hay có tiền tố for(;;); và nhiều JSON (deferred) nối bằng newline.
    text.replace(/^for\s*\(;;\);/, '').split('\n').forEach(function (line) {
      line = line.trim(); if (!line) return;
      var j; try { j = JSON.parse(line); } catch (e) { return; }
      if (hasLib) scanJson(j);
      if (hasPage) extractMetrics(j, pageAcc);
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

  log('userscript v3.0 đã nạp (hook window thật) — Content Library tự cuộn; trang Insights tự bắt số liệu page-level.');
})();
