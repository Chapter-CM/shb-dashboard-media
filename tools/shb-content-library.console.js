// ================================================================
// BẢN CHẠY QUA CONSOLE HOẶC BOOKMARKLET (không cần Tampermonkey — máy
// công ty chặn cài extension qua Group Policy, xem HANDOFF.md 14/07).
//
// ► CÁCH 1 — Console (F12): dán nguyên file này vào DevTools Console
//   trên trang facebook.com rồi Enter.
// ► CÁCH 2 — Bookmarklet (khuyên dùng, KHÔNG cần mở DevTools mỗi lần):
//   biến file này thành 1 nút Bookmark trên thanh trình duyệt, từ nay
//   chỉ cần BẤM NÚT đó (không gõ lệnh gì) mỗi khi cần gom dữ liệu.
//   Cách tạo (làm 1 lần):
//   1. Chuột phải thanh Bookmark → "Thêm trang" (Add page).
//   2. Tên: "SHB Gom FB" (tuỳ ý). URL: dán TOÀN BỘ nội dung file
//      tools/shb-bookmarklet.txt (đã được đóng gói sẵn, gửi kèm) vào ô URL.
//   3. Lưu. Từ nay: mở Facebook → Công cụ chuyên nghiệp → BẤM nút
//      Bookmark đó (không cần F12) — script tự chạy y hệt cách 1, có
//      thêm nút "🔄 Quét trang này" ngay trên ô SHB góc dưới phải để
//      quét chart bằng 1 cú bấm (không cần gõ SHBCL_sweep() nữa).
//   Lưu ý: mỗi khi Facebook CHUYỂN SANG TRANG MỚI (đổi URL/F5), trình
//   duyệt không tự chạy lại script (vì không phải extension) — bấm lại
//   đúng nút Bookmark đó 1 lần nữa trên trang mới là được.
//
// Phải làm lại (bấm bookmark / dán Console) mỗi lần mở tab mới hoặc
// chuyển trang (KHÔNG tự động/không lưu như bản Tampermonkey gốc:
// tools/shb-content-library.user.js — bản đó auto-chạy mọi lúc nhưng
// cần cài extension, hiện đang bị chặn).
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

  // ── COVERAGE: đếm chính xác đã phủ đủ ngày nào trong khoảng đang chọn chưa —
  // KHÔNG đoán mò như quét chuột giả, mà tính toán thật từ dữ liệu đã bắt được.
  function parseUrlRange() {
    var sp = new URLSearchParams(location.search);
    var sd = sp.get('start_date'), ed = sp.get('end_date');
    if (!sd || !ed) return null;
    return { start: new Date(sd + 'T00:00:00Z').getTime(), end: new Date(ed + 'T00:00:00Z').getTime() };
  }
  function dayMs(t) { var d = new Date(t); d.setUTCHours(0, 0, 0, 0); return d.getTime(); }
  function fmtDate(ms) { var d = new Date(ms); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0'); }
  // Gom ngày đã bắt được theo TỪNG HỌ chỉ số (views/interactions/followers/...) —
  // trước đây chỉ đếm key khớp /view/ nên đứng ở tab "Lượt tương tác"
  // (interactions_time_series) coverage luôn báo 0%/bị bỏ qua, quét thiếu cả
  // đoạn dài mà không hề có cảnh báo → tổng Lượt tương tác trên dashboard hụt
  // hẳn so với số Facebook tự hiện.
  function familyOf(key) {
    return /^interactions?(_|$)/.test(key) ? 'interactions' : /^followers?(_|$)/.test(key) ? 'followers' : /^views?(_|$)/.test(key) ? 'views' : key.replace(/_time_series$/, '');
  }
  function coverageReport(silent) {
    var range = parseUrlRange();
    if (!range) { if (!silent) log('Không xác định được khoảng ngày Tùy chỉnh từ URL — bỏ qua kiểm tra coverage (chỉ áp dụng khi chọn "Tùy chỉnh").'); return null; }
    var famCov = {}; // family -> {dayMs:1}
    PAGES.forEach(function (p) {
      var s = p && p.series || {};
      Object.keys(s).forEach(function (k) {
        var pts = s[k] && s[k].points;
        if (!Array.isArray(pts)) return;
        var fam = familyOf(k);
        if (!famCov[fam]) famCov[fam] = {};
        pts.forEach(function (pt) { var t = new Date(pt.start_time).getTime(); if (t) famCov[fam][dayMs(t)] = 1; });
      });
    });
    var totalDays = Math.round((range.end - range.start) / 864e5) + 1;
    var out = {};
    var fams = Object.keys(famCov);
    if (!fams.length) { if (!silent) log('⚠️ Chưa bắt được chuỗi theo ngày nào. Script chỉ bắt được request MẠNG MỚI — nếu bạn dán script SAU KHI chart đã tải xong (mở tab từ trước) sẽ không bắt được gì dù rê chuột bao nhiêu. Hãy ĐỔI KHOẢNG NGÀY (vd bấm "7N" rồi bấm lại "Tuỳ chỉnh" chọn đúng khoảng cần) để ép Facebook gọi lại API, thấy chart vẽ lại rồi mới bấm "🔄 Quét trang này".'); return null; }
    fams.forEach(function (fam) {
      var covered = famCov[fam];
      var coveredDays = 0, gaps = [], gapStart = null;
      for (var t = range.start; t <= range.end; t += 864e5) {
        if (covered[t]) {
          coveredDays++;
          if (gapStart != null) { gaps.push([gapStart, t - 864e5]); gapStart = null; }
        } else if (gapStart == null) gapStart = t;
      }
      if (gapStart != null) gaps.push([gapStart, range.end]);
      var pct = totalDays ? Math.round(coveredDays / totalDays * 100) : 0;
      out[fam] = { totalDays: totalDays, coveredDays: coveredDays, pct: pct, gaps: gaps };
      if (!silent) {
        if (gaps.length) {
          log('⚠️ [' + fam + '] Coverage ' + coveredDays + '/' + totalDays + ' ngày (' + pct + '%) — CÒN THIẾU ' + gaps.length + ' đoạn: ' +
            gaps.slice(0, 15).map(function (g) { return fmtDate(g[0]) + (g[1] > g[0] ? '→' + fmtDate(g[1]) : ''); }).join(', ') + (gaps.length > 15 ? ' …' : ''));
        } else {
          log('✅ [' + fam + '] Coverage ' + coveredDays + '/' + totalDays + ' ngày (100%) — ĐỦ toàn bộ khoảng ngày đã chọn.');
        }
      }
    });
    return out;
  }
  W.SHBCL_coverage = function () { return coverageReport(); };

  // Chẩn đoán: liệt kê TẤT CẢ chuỗi theo ngày (raw field name, chưa gộp nhóm) đã bắt
  // được trong PAGES, kèm tổng giá trị trong khoảng ngày Tuỳ chỉnh đang chọn (nếu có).
  // Dùng khi số trên dashboard KHÔNG khớp Facebook dù coverage đã đủ ngày — Facebook có
  // thể dùng 1 field KHÁC "interactions_time_series" (vd 1 field "engagement" rộng hơn,
  // gồm cả click/xem chứ không chỉ cảm xúc+bình luận+chia sẻ) để tính ra số đầu trang.
  // So cột "sumInRange" với số Facebook hiển thị để tìm đúng field cần map.
  W.SHBCL_seriesKeys = function () {
    var range = parseUrlRange();
    var agg = {};
    PAGES.forEach(function (p) {
      var s = p && p.series || {};
      Object.keys(s).forEach(function (k) {
        var pts = s[k] && s[k].points;
        if (!Array.isArray(pts) || !pts.length) return;
        if (!agg[k]) agg[k] = { days: {}, sumAll: 0, sumInRange: 0 };
        pts.forEach(function (pt) {
          var ms = new Date(pt.start_time).getTime(); if (!ms) return;
          var v = pt.value || 0;
          if (agg[k].days[ms] === undefined) { agg[k].sumAll += v; if (range && ms >= range.start && ms <= range.end) agg[k].sumInRange += v; }
          agg[k].days[ms] = 1;
        });
      });
    });
    var rows = Object.keys(agg).map(function (k) { return { key: k, ngayDaBat: Object.keys(agg[k].days).length, tongTatCa: agg[k].sumAll, tongTrongKhoangDangChon: range ? agg[k].sumInRange : '(chưa chọn Tuỳ chỉnh)' }; });
    rows.sort(function (a, b) { return (b.tongTatCa || 0) - (a.tongTatCa || 0); });
    console.table(rows);
    log('SHBCL_seriesKeys: ' + rows.length + ' chuỗi theo ngày đã bắt được (tên field GỐC, chưa gộp nhóm views/interactions/followers). ' +
        'So cột "tongTrongKhoangDangChon" với số Facebook hiển thị trên đầu trang (vd 49.159) để tìm ĐÚNG field cần dùng cho KPI Lượt tương tác.');
    return rows;
  };

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
      ' | ✅' + okCount + (failCount ? ' ❌' + failCount : '') + (QUEUE.length ? ' | chờ gửi: ' + QUEUE.length : '') +
      ' <button id="shb-cl-fetchall-btn" style="margin-left:6px;background:linear-gradient(90deg,#0a7cff,#00c853);' +
      'color:#fff;border:0;border-radius:6px;padding:3px 8px;font:11px system-ui;cursor:pointer;font-weight:600" ' +
      'title="KHUYÊN DÙNG: tự chuyển qua tất cả tab Insight, REPLAY request thật (không rê chuột) — chuẩn nhất, ít thao tác tay nhất. Chọn đúng Tuỳ chỉnh trước khi bấm.">⚡ Quét chuẩn</button>' +
      ' <button id="shb-cl-more-btn" style="margin-left:4px;background:#333;' +
      'color:#fff;border:0;border-radius:6px;padding:3px 8px;font:11px system-ui;cursor:pointer" ' +
      'title="Cách cũ (rê chuột giả lập) — đường lui nếu Quét chuẩn không replay được">⋯ Cách khác</button>' +
      '<div id="shb-cl-more-menu" style="display:none;margin-top:6px;text-align:right">' +
      '<button id="shb-cl-sweep-btn" style="background:linear-gradient(90deg,#e11d2a,#fb7427);color:#fff;border:0;border-radius:6px;padding:3px 8px;font:11px system-ui;cursor:pointer">🔄 Quét trang này (rê chuột)</button> ' +
      '<button id="shb-cl-sweepall-btn" style="background:#1877f2;color:#fff;border:0;border-radius:6px;padding:3px 8px;font:11px system-ui;cursor:pointer">🌐 Quét tất cả tab (rê chuột)</button>' +
      '</div>';
    var btnFetchAll = document.getElementById('shb-cl-fetchall-btn');
    if (btnFetchAll) btnFetchAll.onclick = function (ev) {
      ev.stopPropagation();
      btnFetchAll.disabled = true; btnFetchAll.textContent = '⏳ đang quét chuẩn...';
      W.SHBCL_fetchAllTabs().then(function () { btnFetchAll.disabled = false; btnFetchAll.textContent = '⚡ Quét chuẩn'; });
    };
    var btnMore = document.getElementById('shb-cl-more-btn'), menu = document.getElementById('shb-cl-more-menu');
    if (btnMore) btnMore.onclick = function (ev) { ev.stopPropagation(); menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
    var btn = document.getElementById('shb-cl-sweep-btn');
    if (btn) btn.onclick = function (ev) {
      ev.stopPropagation();
      btn.disabled = true; btn.textContent = '⏳ đang quét...';
      W.SHBCL_sweep().then(function () { btn.disabled = false; btn.textContent = '🔄 Quét trang này (rê chuột)'; });
    };
    var btnAll = document.getElementById('shb-cl-sweepall-btn');
    if (btnAll) btnAll.onclick = function (ev) {
      ev.stopPropagation();
      btnAll.disabled = true; btnAll.textContent = '⏳ đang quét tất cả tab...';
      W.SHBCL_sweepAllTabs().then(function () { btnAll.disabled = false; btnAll.textContent = '🌐 Quét tất cả tab (rê chuột)'; });
    };
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

  // Rê chuột giả lập tooltip KHÔNG đáng tin cậy (isTrusted:false — nhiều chart không
  // coi là tương tác thật nên không lazy-load thêm). Thay vì đoán mù, GIỮ LẠI request
  // GraphQL THẬT (url + body) mỗi lần response chứa TimeSeries — để sau này REPLAY lại
  // request đó (đổi biến ngày) mà không cần rê chuột nữa. Dùng: SHBCL_lastRequests().
  var LAST_TS_REQUESTS = [];
  function rememberRequest(url, body, hadSeries) {
    if (!hadSeries) return;
    LAST_TS_REQUESTS.unshift({ url: url, body: body, ts: Date.now() });
    if (LAST_TS_REQUESTS.length > 8) LAST_TS_REQUESTS.length = 8;
  }
  W.SHBCL_lastRequests = function () {
    if (!LAST_TS_REQUESTS.length) { log('⚠️ Chưa bắt được request nào chứa TimeSeries — quét trang (rê chuột/bấm nút) ít nhất 1 lần rồi gọi lại.'); return []; }
    LAST_TS_REQUESTS.forEach(function (r, i) {
      var varsStr = '';
      try { varsStr = decodeURIComponent(String(r.body || '').split('&').filter(function (p) { return /^variables=/.test(p); })[0] || '').replace(/^variables=/, ''); } catch (e) {}
      log('── request #' + i + ' (' + new Date(r.ts).toLocaleTimeString() + ') ──');
      log('url:', r.url);
      log('variables (JSON):', varsStr || '(không tìm thấy field "variables" trong body — có thể payload dùng cấu trúc khác, xem body thô)');
      log('body thô (600 ký tự đầu):', String(r.body || '').slice(0, 600));
    });
    log('⚠️ TRƯỚC KHI gửi log này cho ai: xoá bớt phần "fb_dtsg"/cookie nếu có trong body (token phiên đăng nhập) — chỉ cần giữ lại phần "variables" là đủ để phân tích cấu trúc ngày tháng.');
    return LAST_TS_REQUESTS;
  };

  function tryParse(text, reqUrl, reqBody) {
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
    var hadSeries = hasPage && Object.keys(pageAcc.series).length > 0;
    rememberRequest(reqUrl, reqBody, hadSeries);
    if (hasPage && (Object.keys(pageAcc.metrics).length || Object.keys(pageAcc.series).length)) sendPage(pageAcc);
  }

  // ── Hook fetch (trên window thật) ─────────────────────────────────────────
  var of = W.fetch;
  if (of) {
    W.fetch = function () {
      var url = arguments[0], init = arguments[1] || {};
      var p = of.apply(this, arguments);
      try { p.then(function (r) { try { r.clone().text().then(function (t) { tryParse(t, String(url), init.body); }); } catch (e) {} }); } catch (e) {}
      return p;
    };
  }

  // ── Hook XHR (trên window thật) — FB dùng cái này cho graphql ──────────────
  var XHR = W.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    var oo = XHR.prototype.open, os = XHR.prototype.send;
    XHR.prototype.open = function (m, u) { this.__shbUrl = u; return oo.apply(this, arguments); };
    XHR.prototype.send = function (body) {
      var x = this;
      x.__shbBody = body;
      x.addEventListener('load', function () { try { tryParse(x.responseText, x.__shbUrl, x.__shbBody); } catch (e) {} });
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

  // 17/07: ĐÃ GỠ auto-tour (Ctrl+Shift+Y) — dùng location.href để chuyển trang cứng,
  // full-reload sẽ xoá sạch hook fetch/XHR + kết nối bridge, bắt phải dán lại script.
  // Dọn sessionStorage nếu còn sót từ bản cũ, tránh confirm() thừa.
  try { sessionStorage.removeItem('shbTour'); } catch (e) {}

  // ── SHBCL_sweep() (17/07 bản 3 — ĐÃ BỎ tự bấm sidebar): thử tự bấm xuyên suốt
  // qua sidebar (AUTOPILOT) đã KHÔNG an toàn — sidebar Facebook có mục dạng xổ
  // (accordion, VD "Lượt tương tác") bấm vào chỉ mở submenu chứ không nhảy trang,
  // dễ lạc sang trang khác hẳn (đã xác nhận lỗi thật khi test). Rút gọn lại: vẫn
  // phải TỰ BẤM TAY từng mục sidebar (an toàn, không đoán mù DOM), nhưng mỗi mục
  // chỉ cần gõ ĐÚNG 1 LỆNH thay vì rê chuột thủ công: gõ SHBCL_sweep() trong
  // Console SAU KHI đã bấm tay vào 1 tab Insight — nó tự cuộn + tự quét hết chart
  // trang đó (mousemove giả lập), rồi báo số liệu gom được. Lặp lại: bấm tab kế →
  // gõ SHBCL_sweep() → ... cho tới hết các tab cần (Lượt xem/Lượt tương tác/
  // Đối tượng/Thu nhập/Thư viện nội dung).

  function sweepVisibleCharts(passes) {
    return new Promise(function (resolve) {
      var p = 0;
      (function next() {
        var svgs = Array.from(document.querySelectorAll('svg')).map(function (s) { return { el: s, r: s.getBoundingClientRect() }; })
          .filter(function (x) { return x.r.width > 250 && x.r.height > 60 && x.r.top < window.innerHeight && x.r.bottom > 0; })
          .sort(function (a, b) { return (b.r.width * b.r.height) - (a.r.width * a.r.height); });
        if (!svgs.length) { p++; return p >= passes ? resolve() : setTimeout(next, 400); }
        var r = svgs[0].r, ys = [0.3, 0.5, 0.7].map(function (f) { return r.top + r.height * f; });
        var x = r.left, yi = 0;
        var timer = setInterval(function () {
          if (x > r.right) { yi++; if (yi >= ys.length) { clearInterval(timer); p++; return p >= passes ? resolve() : setTimeout(next, 400); } x = r.left; }
          var y = ys[yi], el = document.elementFromPoint(x, y) || svgs[0].el;
          ['mouseover', 'mousemove'].forEach(function (type) {
            try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window })); } catch (e) {}
          });
          x += 3;
        }, 8);
      })();
    });
  }

  function autoScrollOnce(ms) {
    return new Promise(function (resolve) {
      var idle = 0, lastH = 0, end = Date.now() + ms;
      var timer = setInterval(function () {
        W.scrollTo(0, document.body.scrollHeight);
        var h = document.body.scrollHeight;
        if (h === lastH) idle++; else { idle = 0; lastH = h; }
        if (idle >= 4 || Date.now() > end) { clearInterval(timer); resolve(); }
      }, 500);
    });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function iso(d) { return d.toISOString().slice(0, 10); }

  // ── REPLAY REQUEST THẬT — thay hẳn cách rê chuột giả lập ────────────────────
  // Rê chuột giả lập KHÔNG đáng tin cậy (isTrusted:false, chỉ ép được 1 chart đang
  // hiển thị, hay bị Facebook lờ đi). Ở đây thay bằng cách CHẮC ĂN hơn: dùng lại
  // ĐÚNG request GraphQL Facebook vừa gọi thật (đã bắt qua SHBCL_lastRequests()),
  // chỉ đổi phần "variables" (customStartDate/customEndDate/timeRange) rồi tự
  // fetch() lại — cookie phiên đăng nhập tự đính kèm vì cùng gốc (same-origin),
  // KHÔNG cần rê chuột, KHÔNG phụ thuộc chart nào đang hiển thị, tự chia đủ mọi
  // đoạn ngày nên không sót ngày.
  function buildVariables(base, startISO, endISO) {
    var v = JSON.parse(JSON.stringify(base));
    v.customStartDate = startISO; v.customEndDate = endISO; v.dateRange = 'CUSTOM';
    v.timeRange = { start_iso_date: startISO, end_iso_date: endISO, type: 'CUSTOM' };
    return v;
  }
  function replaceVariablesInBody(rawBody, newVarsObj) {
    var encoded = encodeURIComponent(JSON.stringify(newVarsObj));
    if (!/(^|&)variables=/.test(rawBody)) return null; // body không có field "variables" dạng x-www-form-urlencoded — không replay được kiểu này
    return rawBody.replace(/variables=[^&]*/, 'variables=' + encoded);
  }
  W.SHBCL_fetchRange = async function (startISO, endISO, reqIndex) {
    reqIndex = reqIndex || 0;
    var req = LAST_TS_REQUESTS[reqIndex];
    if (!req || typeof req.body !== 'string') { log('⚠️ Chưa có request nào đã bắt (dạng chuỗi x-www-form-urlencoded) — chạy SHBCL_lastRequests() trước để kiểm tra.'); return null; }
    var m = req.body.match(/variables=([^&]*)/);
    if (!m) { log('⚠️ Request #' + reqIndex + ' không có field "variables" — không replay được.'); return null; }
    var baseVars; try { baseVars = JSON.parse(decodeURIComponent(m[1])); } catch (e) { log('⚠️ Không parse được variables gốc:', e); return null; }
    var newBody = replaceVariablesInBody(req.body, buildVariables(baseVars, startISO, endISO));
    var res = await fetch(req.url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: newBody });
    var text = await res.text();
    tryParse(text, req.url, newBody); // tái dùng pipeline có sẵn: bóc series, gom PAGES, đẩy bridge
    return text;
  };
  // Tự chia [startISO, endISO] thành từng đoạn chunkDays ngày (mặc định 30) rồi gọi
  // SHBCL_fetchRange() lần lượt — phủ đủ toàn bộ khoảng ngày cần, không thủ công.
  W.SHBCL_fetchFullRange = async function (startISO, endISO, chunkDays, reqIndex) {
    chunkDays = chunkDays || 30;
    if (!LAST_TS_REQUESTS.length) { log('⚠️ Chưa bắt được request nào — mở tab Insight cần lấy (vd Lượt tương tác), đợi chart tải xong 1 lần rồi gọi lại SHBCL_fetchFullRange().'); return; }
    var start = new Date(startISO + 'T00:00:00Z'), end = new Date(endISO + 'T00:00:00Z'), cur = new Date(start), chunks = [];
    while (cur <= end) {
      var chunkEnd = new Date(Math.min(cur.getTime() + (chunkDays - 1) * 864e5, end.getTime()));
      chunks.push([iso(cur), iso(chunkEnd)]);
      cur = new Date(chunkEnd.getTime() + 864e5);
    }
    log('SHBCL_fetchFullRange: sẽ gọi ' + chunks.length + ' đoạn (' + chunkDays + ' ngày/đoạn) từ ' + startISO + ' → ' + endISO + '...');
    for (var i = 0; i < chunks.length; i++) {
      log('  đoạn ' + (i + 1) + '/' + chunks.length + ': ' + chunks[i][0] + ' → ' + chunks[i][1]);
      await W.SHBCL_fetchRange(chunks[i][0], chunks[i][1], reqIndex || 0);
      badge();
      await sleep(700); // giãn cách nhẹ tránh gọi dồn dập bị Facebook chặn tạm
    }
    coverageReport(false);
    badge();
    log('✅ SHBCL_fetchFullRange: xong ' + chunks.length + ' đoạn — tổng đã gom: ' + POSTS.length + ' bài, ' + PAGES.length + ' page. Gõ SHBCL_coverage() để xem chi tiết.');
  };

  // Quét LẶP LẠI tự động cho tới khi coverage đủ 100% (hoặc hết MAX_TRY lần) —
  // không còn "quét 1 phát rồi hy vọng", mà tự kiểm tra thật + tự thử lại.
  // Coverage giờ trả về THEO TỪNG HỌ chỉ số — lấy họ TỆ NHẤT làm điều kiện dừng,
  // vì tab hiện tại có thể là interactions/followers chứ không chỉ views.
  function worstCoverage(cov) {
    if (!cov) return null;
    var worst = null;
    Object.keys(cov).forEach(function (fam) { if (!worst || cov[fam].coveredDays < worst.coveredDays) worst = cov[fam]; });
    return worst;
  }
  // Trang biểu đồ Insight (Lượt xem/Lượt tương tác/Đối tượng/Thu nhập) hiển thị
  // 1 chart tĩnh, KHÔNG cần cuộn tải thêm nội dung — cuộn xuống chỉ làm mất chart
  // khỏi khung nhìn (script tìm SVG lớn nhất ĐANG HIỂN THỊ), khiến sweep không
  // bắt được gì. Chỉ trang Thư viện nội dung (danh sách bài, infinite-scroll)
  // mới cần autoScrollOnce.
  function isInsightChartPage() { return /professional_dashboard\/insights/.test(location.pathname); }
  W.SHBCL_sweep = async function () {
    var MAX_TRY = 6, tries = 0, cov = null;
    var skipScroll = isInsightChartPage();
    log('SHBCL_sweep: bắt đầu quét + tự kiểm tra coverage (tối đa ' + MAX_TRY + ' lượt)...' + (skipScroll ? ' (trang biểu đồ — bỏ qua bước tự cuộn)' : ''));
    while (tries < MAX_TRY) {
      tries++;
      if (!skipScroll) await autoScrollOnce(2500);
      await sweepVisibleCharts(2);
      badge();
      cov = worstCoverage(coverageReport(true));
      if (!cov) { log('✓ Không kiểm tra được coverage (không phải khoảng "Tùy chỉnh", HOẶC chưa bắt được request mạng nào — xem chi tiết bằng SHBCL_coverage()) — xong sau 1 lượt quét.'); break; }
      log('  lượt ' + tries + '/' + MAX_TRY + ': coverage ' + cov.coveredDays + '/' + cov.totalDays + ' ngày (' + cov.pct + '%)' + (cov.gaps.length ? ', còn ' + cov.gaps.length + ' đoạn thiếu' : ''));
      if (!cov.gaps.length) break;
    }
    coverageReport(false); // in báo cáo cuối cùng đầy đủ (kể cả khi vẫn còn thiếu)
    badge();
    log('✓ Xong trang này — tổng đã gom: ' + POSTS.length + ' bài, ' + PAGES.length + ' page. ' +
        (cov && cov.gaps.length ? '⚠️ VẪN CÒN THIẾU dữ liệu — xem đoạn ngày ở dòng "Coverage" phía trên, cân nhắc rê chuột tay thêm đúng đoạn đó rồi bấm "🔄 Quét trang này" lại. ' : '') +
        'Xong thì bấm sang tab Insight kế tiếp, bấm lại nút Bookmark, rồi bấm "🔄 Quét trang này" (hoặc gõ SHBCL_sweep()) tiếp.');
  };
  // ── QUÉT TỰ ĐỘNG QUA TẤT CẢ TAB — để logic dữ liệu của Công cụ chuyên nghiệp
  // khớp với dashboard: dashboard gộp mọi chuỗi/metric THEO TÊN (views/interactions/
  // followers/...), KHÔNG quan tâm lấy từ tab nào — nên chỉ cần đi hết các tab Insight
  // 1 lần, script sẽ tự gom đủ views_time_series (tab Lượt xem), interactions_time_series
  // (tab Lượt tương tác), followers + demographics (tab Đối tượng), thu nhập (tab Thu
  // nhập)... KHÔNG cần đổi ngày thủ công cho từng tab: mỗi lần điều hướng SANG TAB MỚI
  // là 1 lượt "trang mới mở" đối với React — luôn tự gọi API mới (khác vấn đề gặp ở tab
  // đang đứng sẵn khi dán script, xem coverageReport()).
  var INSIGHT_TABS = ['Lượt xem', 'Thu nhập', 'Lượt tương tác', 'Đối tượng', 'Nhắn tin', 'Thư viện nội dung'];
  function findSidebarLink(label) {
    var cands = Array.from(document.querySelectorAll('a[role="link"], a, [role="link"]'));
    return cands.find(function (a) { return (a.textContent || '').trim() === label; }) || null;
  }
  // Facebook KHÔNG giữ query date_range/start_date/end_date khi điều hướng SPA sang
  // tab khác (tự rơi về mặc định "28 ngày qua") — đây là hành vi của chính Facebook,
  // không sửa được từ script. Mù đoán DOM để tự bấm lại bộ chọn ngày rất dễ vỡ (không
  // thấy được cấu trúc thật lúc chạy) → thay vào đó: PHÁT HIỆN đúng lúc ngày bị reset
  // và TẠM DỪNG, hiện overlay yêu cầu tự chọn lại "Tuỳ chỉnh" (2 cú bấm, Facebook nhớ
  // sẵn khoảng ngày vừa chọn lần trước) rồi bấm nút để script tiếp tục quét tab đó.
  function rangeMatches(want) {
    var have = parseUrlRange();
    return !!(have && want && have.start === want.start && have.end === want.end);
  }
  function waitForDateFix(label, want) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.id = 'shb-cl-datewait';
      ov.style.cssText = 'position:fixed;bottom:64px;right:16px;z-index:999999;background:#fff8e1;border:2px solid #f5a623;border-radius:10px;padding:12px 14px;font:13px system-ui;color:#111;box-shadow:0 4px 20px rgba(0,0,0,.3);max-width:320px';
      ov.innerHTML = '⏸️ <b>Tab "' + esc0(label) + '"</b> đã rơi về "28 ngày qua" (Facebook không giữ khoảng ngày khi chuyển tab).<br>' +
        '<b>Hãy tự chọn lại "Tuỳ chỉnh"</b> đúng khoảng ngày cần, rồi bấm nút dưới để quét tiếp:' +
        '<div style="margin-top:8px;text-align:right"><button id="shb-cl-datewait-btn" style="background:linear-gradient(90deg,#e11d2a,#fb7427);color:#fff;border:0;border-radius:6px;padding:5px 12px;font:12px system-ui;cursor:pointer">✅ Đã chọn xong — Quét tab này</button></div>';
      document.body.appendChild(ov);
      var poll = setInterval(function () { if (rangeMatches(want)) finish(); }, 800); // tự đóng ngay khi phát hiện đã khớp, khỏi cần bấm
      function finish() {
        clearInterval(poll);
        var el = document.getElementById('shb-cl-datewait'); if (el) el.remove();
        resolve();
      }
      document.getElementById('shb-cl-datewait-btn').onclick = finish;
    });
  }
  function esc0(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  W.SHBCL_sweepAllTabs = async function (tabs) {
    tabs = tabs || INSIGHT_TABS;
    var wantRange = parseUrlRange(); // khoảng ngày Tuỳ chỉnh đang chọn ở tab BAN ĐẦU — dùng làm chuẩn cho các tab sau
    log('SHBCL_sweepAllTabs: sẽ đi qua ' + tabs.length + ' tab: ' + tabs.join(', ') + (wantRange ? '' : ' — ⚠️ chưa phát hiện khoảng "Tuỳ chỉnh" ở tab hiện tại, sẽ không kiểm tra được ngày bị reset ở các tab sau.'));
    for (var i = 0; i < tabs.length; i++) {
      var label = tabs[i];
      var link = findSidebarLink(label);
      if (!link) { log('⚠️ Không tìm thấy tab "' + label + '" trong sidebar (tên có thể đã đổi, hoặc cần cuộn sidebar cho thấy) — bỏ qua, tự bấm tay tab này rồi gõ SHBCL_sweep().'); continue; }
      log('➡️  [' + (i + 1) + '/' + tabs.length + '] Chuyển sang tab "' + label + '"...');
      link.click();
      await sleep(1800); // đợi SPA đổi route + gọi API đầu tiên của tab mới
      if (wantRange && !rangeMatches(wantRange)) {
        log('⏸️  Tab "' + label + '" rơi về mặc định (không phải khoảng Tuỳ chỉnh đã chọn) — chờ bạn chọn lại...');
        await waitForDateFix(label, wantRange);
        await sleep(1200); // đợi chart vẽ lại theo ngày mới trước khi quét
      }
      await W.SHBCL_sweep();
    }
    log('✅ SHBCL_sweepAllTabs: xong tất cả tab — tổng đã gom: ' + POSTS.length + ' bài, ' + PAGES.length + ' page. Gõ SHBCL_coverage() để xem coverage từng chỉ số.');
  };

  // ── LỆNH DUY NHẤT KHUYÊN DÙNG — gộp "tự chuyển qua từng tab" + "replay request
  // thật" thành 1 bước: KHÔNG rê chuột ở đâu cả, tự phủ đủ toàn bộ ngày cho MỌI tab
  // Insight. Việc tay duy nhất còn lại: chọn lại "Tuỳ chỉnh" khi Facebook tự reset về
  // 28 ngày lúc chuyển tab (hành vi của chính Facebook, không sửa được từ script).
  W.SHBCL_fetchAllTabs = async function (chunkDays, tabs) {
    chunkDays = chunkDays || 30;
    tabs = tabs || INSIGHT_TABS;
    var wantRange = parseUrlRange();
    if (!wantRange) { log('⚠️ Hãy chọn "Tuỳ chỉnh" đúng khoảng ngày cần TRÊN TAB HIỆN TẠI trước, rồi gọi lại SHBCL_fetchAllTabs().'); return; }
    var startISO = iso(new Date(wantRange.start)), endISO = iso(new Date(wantRange.end));
    log('SHBCL_fetchAllTabs: khoảng ' + startISO + ' → ' + endISO + ', đi qua ' + tabs.length + ' tab, REPLAY request thật cho từng tab (không rê chuột)...');
    for (var i = 0; i < tabs.length; i++) {
      var label = tabs[i];
      var link = findSidebarLink(label);
      if (!link) { log('⚠️ Không tìm thấy tab "' + label + '" — bỏ qua, tự làm tay tab này (đứng ở tab đó rồi gõ SHBCL_fetchFullRange("' + startISO + '","' + endISO + '")).'); continue; }
      log('➡️  [' + (i + 1) + '/' + tabs.length + '] Chuyển sang tab "' + label + '"...');
      var beforeCount = LAST_TS_REQUESTS.length;
      link.click();
      await sleep(1800); // đợi SPA đổi route + gọi API đầu tiên của tab mới
      if (!rangeMatches(wantRange)) {
        log('⏸️  Tab "' + label + '" rơi về mặc định (Facebook tự reset khi chuyển tab) — chờ bạn chọn lại "Tuỳ chỉnh" ' + startISO + ' → ' + endISO + '...');
        await waitForDateFix(label, wantRange);
        await sleep(1200); // đợi chart vẽ lại + request đầu tiên của khoảng ngày mới chạy xong
      }
      // Đợi có request MỚI (khác lượt trước) rồi mới replay — tránh dùng nhầm request cũ của tab trước.
      var waited = 0;
      while (LAST_TS_REQUESTS.length === beforeCount && waited < 6000) { await sleep(300); waited += 300; }
      if (LAST_TS_REQUESTS.length === beforeCount) { log('⚠️ Không bắt được request mới ở tab "' + label + '" — bỏ qua, tự làm tay tab này.'); continue; }
      await W.SHBCL_fetchFullRange(startISO, endISO, chunkDays, 0);
    }
    coverageReport(false);
    badge();
    log('✅ SHBCL_fetchAllTabs: XONG TẤT CẢ TAB — tổng đã gom: ' + POSTS.length + ' bài, ' + PAGES.length + ' page. Gõ SHBCL_coverage() xem chi tiết từng chỉ số.');
  };

  log('KHUYÊN DÙNG (chuẩn nhất, ít thao tác tay nhất): chọn đúng khoảng "Tuỳ chỉnh" cần lấy, rồi gõ SHBCL_fetchAllTabs() — ' +
      'TỰ ĐỘNG chuyển qua tất cả tab Insight (Lượt xem/Thu nhập/Lượt tương tác/Đối tượng/Nhắn tin/Thư viện nội dung), ' +
      'REPLAY đúng request thật của từng tab để phủ đủ toàn bộ khoảng ngày — không rê chuột đâu cả. ' +
      'Duy nhất cần bấm tay: nút "✅ Đã chọn xong" mỗi khi Facebook tự reset ngày lúc chuyển tab. ' +
      'Muốn làm riêng 1 tab: gõ SHBCL_fetchFullRange("2025-12-01","2026-07-20") khi đang đứng ở tab đó. ' +
      'Gõ SHBCL_coverage() bất kỳ lúc nào để xem báo cáo hiện tại. ' +
      '(Cách rê chuột cũ SHBCL_sweep()/SHBCL_sweepAllTabs() vẫn còn làm đường lui nếu 1 tab nào đó không replay được.)');

  openBridge(); // mở cửa sổ bridge ngay (nếu bị chặn popup: bấm ô SHB góc dưới phải)
  badge();
  log('Bản console (bridge) đã chạy — dữ liệu tự đẩy lên MySQL qua cửa sổ bridge. ' +
      'Nếu ô SHB góc dưới phải báo 🔴, bấm vào đó để mở bridge. ' +
      'Đường lui nếu bridge lỗi: copy(SHBCL_export()) + shb-ingest-upload.console.js.');
})();
