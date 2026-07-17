// ================================================================
// BẢN CHẠY TAY QUA CONSOLE (không cần Tampermonkey) — dán nguyên file
// này vào DevTools Console (F12) trên trang facebook.com rồi Enter.
// Phải làm lại mỗi lần mở tab mới (KHÔNG tự động/không lưu như bản
// Tampermonkey gốc: tools/shb-content-library.user.js).
//
// ⚠️ 17/07/2026 — CSP của facebook.com CHẶN fetch tới domain ngoài từ
// Console (Tampermonkey vượt được nhờ GM_xmlhttpRequest, Console thì
// không), nhưng KHÔNG chặn postMessage. Bản này TỰ ĐỘNG đẩy dữ liệu
// qua cửa sổ cầu nối /ingest-bridge (domain dashboard nội bộ — cần
// deploy server/ingest-server.js + nginx.conf bản 17/07 trước):
// dán script → cửa sổ bridge tự mở → cuộn bài → dữ liệu tự lên MySQL.
// Theo dõi ở ô "SHB" góc dưới phải (🟢 đã nối / ✅ số lô đã gửi).
// Đường lui nếu bridge chưa deploy: copy(SHBCL_export()) rồi dán vào
// tools/shb-ingest-upload.console.js trên tab dashboard.
// ================================================================

(function () {
  'use strict';

  // ── CẤU HÌNH ──────────────────────────────────────────────────────────────
  // 17/07/2026 (bản 2 — TỰ ĐỘNG qua BRIDGE): CSP Facebook chặn fetch trực tiếp,
  // nhưng KHÔNG chặn postMessage. Script tự mở cửa sổ /ingest-bridge (domain nội
  // bộ) và đẩy dữ liệu qua đó — không cần copy/dán nữa. Nếu bridge chưa deploy
  // (404) thì vẫn còn đường lui: copy(SHBCL_export()) + shb-ingest-upload.console.js.
  var BRIDGE_URL = 'https://cm-dashboard.dev-saha.aws.shb.com.vn/ingest-bridge';
  var BRIDGE_ORIGIN = 'https://cm-dashboard.dev-saha.aws.shb.com.vn';
  var SECRET = '500a13c1-4b4a-4da0-a4c7-c4200e51b66a';   // INGEST_SECRET noi bo SHB
  var GROUP_ID = '503009407721580';          // SHB Một Nhà
  var AUTO_SCROLL = true;                     // tự cuộn để lazy-load hết bài trong dải ngày đang chọn
  var DEBUG = true;

  // Chạy trong console -> đã là window thật của trang, không cần unsafeWindow.
  var W = window;

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

  var sent = {}; // chống gom trùng trong cùng phiên
  var POSTS = [];  // bộ đệm bài viết đã gom
  var PAGES = [];  // bộ đệm page-level metrics đã gom

  // Xuất toàn bộ dữ liệu đã gom (chuỗi JSON) — dùng: copy(SHBCL_export())
  // (đường lui khi bridge chưa deploy/không mở được)
  W.SHBCL_export = function () {
    var out = JSON.stringify({ posts: POSTS, pages: PAGES });
    log('export: ' + POSTS.length + ' bài + ' + PAGES.length + ' page metrics (' + out.length + ' ký tự). Gõ copy(SHBCL_export()) để đưa vào clipboard nếu chưa.');
    return out;
  };

  // ── BRIDGE: tự gửi qua cửa sổ /ingest-bridge bằng postMessage ─────────────
  var bridgeWin = null, bridgeReady = false, QUEUE = [], msgId = 0, okCount = 0, failCount = 0;

  function badge() {
    var b = document.getElementById('shb-cl-badge');
    if (!b) {
      b = document.createElement('div');
      b.id = 'shb-cl-badge';
      b.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:999999;background:#fff;border:2px solid #e11d2a;border-radius:10px;padding:8px 12px;font:12px system-ui;color:#111;box-shadow:0 4px 20px rgba(0,0,0,.25);cursor:pointer';
      b.title = 'Bấm để mở lại cửa sổ bridge nếu bị chặn popup';
      b.onclick = openBridge;
      document.body.appendChild(b);
    }
    b.innerHTML = '<b style="color:#e11d2a">SHB</b> gom: ' + POSTS.length + ' bài · ' + PAGES.length + ' page | ' +
      (bridgeReady ? '🟢 đã nối' : '🔴 <u>bấm để nối bridge</u>') +
      ' | ✅' + okCount + (failCount ? ' ❌' + failCount : '') + (QUEUE.length ? ' | chờ gửi: ' + QUEUE.length : '');
  }

  function openBridge() {
    if (bridgeWin && !bridgeWin.closed) { try { bridgeWin.focus(); } catch (e) {} return; }
    bridgeReady = false;
    bridgeWin = W.open(BRIDGE_URL, 'shb_bridge', 'width=420,height=320');
    if (!bridgeWin) log('⚠️ Popup bị chặn — bấm vào ô SHB góc dưới phải để mở bridge.');
    badge();
  }

  function flush() {
    if (!bridgeReady || !bridgeWin || bridgeWin.closed) return;
    while (QUEUE.length) {
      var j = QUEUE.shift();
      try { bridgeWin.postMessage({ type: 'shb-ingest', id: ++msgId, label: j.label, secret: SECRET, body: j.body }, BRIDGE_ORIGIN); }
      catch (e) { QUEUE.unshift(j); log('bridge postMessage lỗi', e); break; }
    }
    badge();
  }

  function enqueue(label, body) { QUEUE.push({ label: label, body: body }); flush(); badge(); }

  // Gửi LẠI toàn bộ dữ liệu đã gom qua bridge (dùng khi server lỗi xong đã fix,
  // khỏi cuộn lại từ đầu): gõ SHBCL_resend() trong Console.
  W.SHBCL_resend = function () {
    okCount = 0; failCount = 0;
    for (var i = 0; i < POSTS.length; i += 25) QUEUE.push({ label: 'bài ' + (i + 1) + '–' + Math.min(i + 25, POSTS.length), body: POSTS.slice(i, i + 25) });
    PAGES.forEach(function (p, i) { QUEUE.push({ label: 'page metrics #' + (i + 1), body: p }); });
    log('resend: xếp lại ' + QUEUE.length + ' lô (' + POSTS.length + ' bài + ' + PAGES.length + ' page).');
    openBridge(); flush();
  };

  W.addEventListener('message', function (ev) {
    if (ev.origin !== BRIDGE_ORIGIN) return;
    var m = ev.data || {};
    if (m.type === 'shb-bridge-ready') { bridgeReady = true; log('🟢 Bridge đã nối — dữ liệu sẽ tự đẩy lên MySQL.'); flush(); }
    if (m.type === 'shb-ingest-result') {
      if (m.status >= 200 && m.status < 300) { okCount++; log('✅ ingest', m.status, m.label); }
      else { failCount++; log('❌ ingest', m.status, m.label, m.text); }
      badge();
    }
  });

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
    POSTS = POSTS.concat(rows);
    log('gom', rows.length, 'bài (tổng ' + POSTS.length + ') — đẩy qua bridge');
    enqueue('bài x' + rows.length, rows);
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
    var payload = { kind: 'page', date_range: rangeFromUrl(), metrics: acc.metrics, series: acc.series };
    PAGES.push(payload);
    log('gom PAGE metrics (tổng ' + PAGES.length + ' bản) — đẩy qua bridge');
    enqueue('page metrics', payload);
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
    // 17/07: KHÔNG tự tiếp tục tour ngầm nữa — từng làm mất dữ liệu đã gom vì
    // tự chuyển trang ngay khi dán script (queue cũ còn sót trong sessionStorage).
    if (!W.confirm('[SHB-CL] Phát hiện TOUR tự động đang dở (' + q.length + ' mục). Tiếp tục tour?\n\nBấm Cancel để HỦY tour và ở lại trang này (khuyên dùng khi đang gom bài Content Library).')) {
      try { sessionStorage.removeItem('shbTour'); } catch (e) {}
      log('TOUR đã hủy theo yêu cầu — ở lại trang hiện tại.');
      return;
    }
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

  openBridge(); // mở cửa sổ bridge ngay (nếu bị chặn popup: bấm ô SHB góc dưới phải)
  badge();
  log('Bản console (bridge) đã chạy — dữ liệu tự đẩy lên MySQL qua cửa sổ bridge. ' +
      'Nếu ô SHB góc dưới phải báo 🔴, bấm vào đó để mở bridge. ' +
      'Đường lui nếu bridge lỗi: copy(SHBCL_export()) + shb-ingest-upload.console.js. ' +
      'Ctrl+Shift+Y = tự quét hết các mục Professional Dashboard.');
})();
