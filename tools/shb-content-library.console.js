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
  // Nhớ lại Cảm xúc chi tiết đã lấy được (post_id -> tổng), TÁCH RIÊNG khỏi POSTS —
  // để nếu quét lại Thư viện nội dung SAU KHI đã lấy Cảm xúc (vd bấm "🚀 Quét toàn bộ"
  // lần 2 trong cùng phiên), object bài viết MỚI dựng lại từ Content Library (không có
  // field này) vẫn tự được gộp lại, KHÔNG bị ghi đè mất Cảm xúc đã lấy trước đó.
  var REACTION_TOTALS = {};

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

  // Chẩn đoán: liệt kê MỌI giá trị THẬT của field "post_type" (business_content_type
  // của Facebook) đã bắt được trong POSTS, kèm số bài mỗi loại — để đối chiếu với 6
  // loại chuẩn Facebook hiện (Reels/Live/Ảnh/Liên kết/Văn bản/Tin) và viết bảng ánh xạ
  // ĐÚNG 1:1 thay vì đoán bằng regex khớp chuỗi con.
  W.SHBCL_postTypes = function () {
    var agg = {};
    POSTS.forEach(function (p) { var t = p.post_type || '(rỗng)'; agg[t] = (agg[t] || 0) + 1; });
    var rows = Object.keys(agg).map(function (k) { return { post_type: k, soBai: agg[k] }; }).sort(function (a, b) { return b.soBai - a.soBai; });
    console.table(rows);
    log('SHBCL_postTypes: ' + rows.length + ' giá trị post_type khác nhau đã bắt được trong ' + POSTS.length + ' bài. Đối chiếu với "Loại bài viết" trên Facebook (Reels/Live/Ảnh/Liên kết/Văn bản/Tin) rồi gửi bảng này để lập ánh xạ chính xác.');
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
    // Rút gọn giao diện (20/07/2026, theo yêu cầu bớt nút): "🚀 Quét toàn bộ" làm hết
    // mọi việc trong 1 lần bấm — dùng cái này hàng ngày. "⋯ Cách khác" xổ ra đúng 2 nút
    // phụ (chỉ quét tab / chỉ lấy Cảm xúc) cho lúc cần làm riêng 1 phần. Đã BỎ HẲN 2 nút
    // rê chuột cũ (kém tin cậy hơn cách replay, chưa từng cần dùng tới trong thực tế) —
    // 2 lệnh SHBCL_sweep()/SHBCL_sweepAllTabs() vẫn còn trong code, gõ tay được khi
    // thực sự cần (rất hiếm), chỉ không còn hiện nút để đỡ rối giao diện.
    b.innerHTML = '<b style="color:#e11d2a">SHB</b> gom: ' + POSTS.length + ' bài · ' + PAGES.length + ' page | ' +
      (bridgeReady ? '🟢 đã nối' : '🔴 <u>bấm để nối bridge</u>') +
      ' | ✅' + okCount + (failCount ? ' ❌' + failCount : '') + (QUEUE.length ? ' | chờ gửi: ' + QUEUE.length : '') +
      ' <button id="shb-cl-runall-btn" style="margin-left:6px;background:linear-gradient(90deg,#0a7cff,#00c853);' +
      'color:#fff;border:0;border-radius:6px;padding:3px 8px;font:11px system-ui;cursor:pointer;font-weight:600" ' +
      'title="Làm HẾT trong 1 lần bấm: quét mọi tab Insight (replay, không rê chuột) + tự lấy Cảm xúc chi tiết cho toàn bộ bài. Chọn đúng Tuỳ chỉnh trước khi bấm.">🚀 Quét toàn bộ</button>' +
      ' <button id="shb-cl-more-btn" style="margin-left:4px;background:#333;' +
      'color:#fff;border:0;border-radius:6px;padding:3px 8px;font:11px system-ui;cursor:pointer" ' +
      'title="Các lệnh lẻ/cũ — chỉ cần khi gỡ lỗi, không cần dùng hàng ngày">⋯ Cách khác</button>' +
      '<div id="shb-cl-more-menu" style="display:none;margin-top:6px;text-align:right">' +
      '<button id="shb-cl-fetchall-btn" style="background:#0a7cff;color:#fff;border:0;border-radius:6px;padding:3px 8px;font:11px system-ui;cursor:pointer" title="Chỉ quét tab Insight, KHÔNG lấy Cảm xúc chi tiết">⚡ Chỉ quét tab</button> ' +
      '<button id="shb-cl-reactall-btn" style="background:#00c853;color:#fff;border:0;border-radius:6px;padding:3px 8px;font:11px system-ui;cursor:pointer" title="Chỉ lấy Cảm xúc chi tiết cho bài đã có sẵn trong POSTS">😀 Chỉ lấy Cảm xúc</button>' +
      '</div>';
    var btnRunAll = document.getElementById('shb-cl-runall-btn');
    if (btnRunAll) btnRunAll.onclick = function (ev) {
      ev.stopPropagation();
      btnRunAll.disabled = true; btnRunAll.textContent = '⏳ đang quét toàn bộ...';
      W.SHBCL_runAll().then(function () { btnRunAll.disabled = false; btnRunAll.textContent = '🚀 Quét toàn bộ'; });
    };
    var btnMore = document.getElementById('shb-cl-more-btn'), menu = document.getElementById('shb-cl-more-menu');
    if (btnMore) btnMore.onclick = function (ev) { ev.stopPropagation(); menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
    var btnFetchAll = document.getElementById('shb-cl-fetchall-btn');
    if (btnFetchAll) btnFetchAll.onclick = function (ev) {
      ev.stopPropagation();
      btnFetchAll.disabled = true; btnFetchAll.textContent = '⏳ đang quét...';
      W.SHBCL_fetchAllTabs().then(function () { btnFetchAll.disabled = false; btnFetchAll.textContent = '⚡ Chỉ quét tab'; });
    };
    var btnReactAll = document.getElementById('shb-cl-reactall-btn');
    if (btnReactAll) btnReactAll.onclick = function (ev) {
      ev.stopPropagation();
      btnReactAll.disabled = true; btnReactAll.textContent = '⏳ đang lấy Cảm xúc...';
      W.SHBCL_fetchAllPostReactions().then(function () { btnReactAll.disabled = false; btnReactAll.textContent = '😀 Chỉ lấy Cảm xúc'; });
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
      // Gộp lại Cảm xúc đã lấy trước đó (nếu có) — tránh mất dữ liệu khi Content Library
      // tự tải lại (reach/engagement đổi nhẹ khiến key dedup khác đi, coi là "bài mới").
      if (REACTION_TOTALS[row.post_id] != null) row.metrics.reaction_total = REACTION_TOTALS[row.post_id];
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

  // ── CHẨN ĐOÁN: bắt response khi bấm vào TỪNG BÀI trong Thư viện nội dung — trang chi
  // tiết 1 bài có breakdown Cảm xúc theo từng loại (Like/Love/Haha...) mà request danh
  // sách (Content Library) không có. Field thật là "top_reactions":{"count":N,"summary":
  // [{reaction_count, reaction:{id,localized_name}}]} — CHÚ Ý: bình luận cũng có
  // "top_reactions" nhưng dạng KHÁC ("edges":[{reaction_count,node:{id}}], không có
  // breakdown loại) — lọc chặt theo '"top_reactions":{"count"' để chỉ bắt đúng của BÀI
  // VIẾT, không lẫn bình luận. GIỮ LẠI CẢ request body để biết request ứng với bài nào.
  var LAST_POST_RESPONSES = [];
  function maybeCapturePostDetail(text, reqUrl, reqBody) {
    if (text.indexOf('"top_reactions":{"count"') < 0) return; // chỉ bắt "top_reactions" của BÀI (có count+summary), bỏ qua dạng "edges" của bình luận
    LAST_POST_RESPONSES.unshift({ url: reqUrl, body: reqBody, text: text, ts: Date.now() });
    if (LAST_POST_RESPONSES.length > 5) LAST_POST_RESPONSES.length = 5;
  }
  W.SHBCL_lastPostReactions = function () {
    if (!LAST_POST_RESPONSES.length) { log('⚠️ Chưa bắt được response nào có breakdown Cảm xúc của BÀI (top_reactions dạng count+summary) — vào tab Thư viện nội dung, bấm mở chi tiết 1 bài (thấy breakdown Cảm xúc như Like/Love/Haha ngay dưới bài, KHÔNG phải dưới 1 bình luận) rồi gọi lại lệnh này.'); return []; }
    LAST_POST_RESPONSES.forEach(function (r, i) {
      var varsStr = '';
      try { varsStr = decodeURIComponent(String(r.body || '').split('&').filter(function (p) { return /^variables=/.test(p); })[0] || '').replace(/^variables=/, ''); } catch (e) {}
      var docIdM = String(r.body || '').match(/doc_id=(\d+)/);
      var idx = r.text.indexOf('"top_reactions":{"count"');
      log('── response #' + i + ' (' + new Date(r.ts).toLocaleTimeString() + ') ──');
      log('url:', r.url);
      log('doc_id:', docIdM ? docIdM[1] : '(không thấy)');
      log('variables (JSON) của REQUEST:', varsStr || '(không tìm thấy — xem body thô)');
      log('response (600 ký tự TRƯỚC + 1200 SAU top_reactions — phần trước để tìm "id" của bài):', r.text.slice(Math.max(0, idx - 600), idx + 1200));
    });
    log('Gửi cả "variables (JSON)" và "response" của 1 request cho tôi (đã ẩn được token vì không dump nguyên body thô ở đây) để viết hàm replay cho toàn bộ bài.');
    return LAST_POST_RESPONSES;
  };

  // ── REPLAY Cảm xúc chi tiết cho TOÀN BỘ bài đã quét — không cần bấm tay từng bài.
  // feedbackTargetID trong request = base64("feedback:"+post_id) — post_id ĐÃ CÓ SẴN
  // trong POSTS (từ lần quét Thư viện nội dung), nên tự tính lại cho mọi bài được.
  // CỘNG TỔNG mọi loại cảm xúc trong "summary" (không map riêng Like/Love/Haha... theo
  // ID để tránh đoán sai tên field — chỉ cần TỔNG cho công thức ER, không cần tách loại).
  // QUAN TRỌNG: server ghi ĐÈ nguyên cột "metrics" mỗi lần upsert (không tự gộp) — nên
  // MUTATE thẳng vào object đang có trong POSTS (đã có reach/viewers/engagement/comments
  // từ lần quét trước) rồi gửi lại NGUYÊN DÒNG, tránh mất dữ liệu cũ.
  W.SHBCL_fetchAllPostReactions = async function (reqIndex) {
    reqIndex = reqIndex || 0;
    var tmpl = LAST_POST_RESPONSES[reqIndex];
    if (!tmpl || typeof tmpl.body !== 'string') {
      var msg1 = 'Chưa có mẫu Cảm xúc — vào Thư viện nội dung, bấm mở 1 bài (thấy Cảm xúc dưới bài, KHÔNG phải dưới bình luận) 1 lần, rồi bấm lại nút này.';
      log('⚠️ ' + msg1); showBigWarning(msg1); return;
    }
    if (!POSTS.length) {
      var msg2 = 'Chưa có bài nào trong phiên này — quét tab "Thư viện nội dung" trước (nằm trong "🚀 Quét toàn bộ"), rồi bấm lại nút này.';
      log('⚠️ ' + msg2); showBigWarning(msg2); return;
    }
    log('SHBCL_fetchAllPostReactions: sẽ lấy Cảm xúc chi tiết cho ' + POSTS.length + ' bài (không rê chuột, không cần bấm tay)...');
    var ok = 0, fail = 0;
    for (var i = 0; i < POSTS.length; i++) {
      var row = POSTS[i], pid = row.post_id;
      if (!pid || !/^\d+$/.test(pid)) { fail++; continue; }
      try {
        var feedbackTargetID = btoa('feedback:' + pid);
        var newVars = { feedbackTargetID: feedbackTargetID, reactionID: '1635855486666999', scale: 1 };
        var newBody = tmpl.body.replace(/variables=[^&]*/, 'variables=' + encodeURIComponent(JSON.stringify(newVars)));
        var res = await fetch(tmpl.url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: newBody });
        var text = await res.text();
        var j = null; try { j = JSON.parse(text); } catch (e) {}
        var summary = j && j.data && j.data.node && j.data.node.top_reactions && j.data.node.top_reactions.summary;
        if (!Array.isArray(summary)) { fail++; continue; }
        var total = summary.reduce(function (t, s) { return t + (s.reaction_count || 0); }, 0);
        row.metrics = row.metrics || {};
        row.metrics.reaction_total = total; // gộp vào object đang có sẵn — KHÔNG tạo object mới, tránh mất field cũ
        REACTION_TOTALS[pid] = total; // nhớ lại cho các lần Content Library tự tải lại sau này trong phiên
        enqueue('bài ' + pid + ' (cảm xúc)', [row]); // gửi lại NGUYÊN DÒNG (đủ reach/viewers/engagement/comments)
        ok++;
      } catch (e) { fail++; }
      badge();
      await sleep(500); // giãn cách nhẹ tránh gọi dồn dập bị Facebook chặn tạm
    }
    log('✅ SHBCL_fetchAllPostReactions: xong — ' + ok + ' bài lấy được Cảm xúc, ' + fail + ' bài lỗi/bỏ qua (post_id không hợp lệ hoặc request lỗi).');
  };

  function tryParse(text, reqUrl, reqBody) {
    text = String(text || '');
    maybeCapturePostDetail(text, reqUrl, reqBody);
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

  // ── Auto-scroll để lazy-load hết bài (FB chỉ render dần khi cuộn) — cuộn CẢ window
  // LẪN mọi khung con cuộn được (bảng Thư viện nội dung có thể cuộn riêng bên trong,
  // window.scrollTo() không chạm tới), xem scrollAllContainers() bên dưới. ──────────
  if (AUTO_SCROLL) {
    var idle = 0, lastH = 0;
    var timer = setInterval(function () {
      scrollAllContainers();
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

  // Bảng Thư viện nội dung có thể cuộn bên trong 1 KHUNG CON riêng (overflow-y auto),
  // KHÔNG phải cuộn cả trang — cuộn mỗi window.scrollTo() không chạm tới đúng khung đó
  // nên không ép Facebook tải thêm (chỉ khi chuyển tab đi/về, component tự dựng lại từ
  // đầu mới thấy thêm bài — đúng triệu chứng gặp phải). Cuộn CẢ window LẪN mọi div có
  // vẻ cuộn được (heuristic: scrollHeight hơn clientHeight > 200px) để không phụ thuộc
  // đoán đúng 1 selector cụ thể (dễ vỡ khi Facebook đổi cấu trúc DOM).
  function scrollAllContainers() {
    W.scrollTo(0, document.body.scrollHeight);
    var divs = document.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
      var el = divs[i];
      if (el.scrollHeight - el.clientHeight > 200) el.scrollTop = el.scrollHeight;
    }
  }
  function autoScrollOnce(ms) {
    return new Promise(function (resolve) {
      var idle = 0, lastH = 0, end = Date.now() + ms;
      var timer = setInterval(function () {
        scrollAllContainers();
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
  // Thư viện nội dung: Facebook GIỚI HẠN số trang tải mỗi lần "mở" component — đã xác
  // nhận qua thực tế: kể cả người dùng cuộn TAY THẬT cũng bị dừng giữa chừng, chỉ khi
  // thoát sang tab khác rồi quay lại (ép component dựng lại từ đầu) mới tải thêm được.
  // Tự động hoá ĐÚNG thao tác đó: nhảy đi tab khác → quay lại → cuộn → lặp lại tới khi
  // số bài không tăng thêm 2 vòng liên tiếp (coi như đã lấy hết) hoặc hết số vòng tối đa.
  async function scrapeContentLibraryFully(maxRounds) {
    maxRounds = maxRounds || 6;
    var libLabel = 'Thư viện nội dung', bounceLabel = 'Lượt xem';
    var lastCount = -1, stableRounds = 0;
    for (var r = 0; r < maxRounds; r++) {
      var lib = findSidebarLink(libLabel);
      if (lib) lib.click(); else log('⚠️ Không tìm thấy tab "' + libLabel + '" ở vòng ' + (r + 1) + ' — có thể đang đứng sẵn ở đó, bỏ qua bước bấm.');
      await sleep(1500);
      for (var s = 0; s < 5; s++) await autoScrollOnce(3000);
      log('📜  Thư viện nội dung — vòng ' + (r + 1) + '/' + maxRounds + ': đã gom ' + POSTS.length + ' bài.');
      if (POSTS.length === lastCount) { stableRounds++; if (stableRounds >= 2) { log('✅ Số bài không tăng thêm 2 vòng liên tiếp — coi như đã lấy hết.'); break; } }
      else stableRounds = 0;
      lastCount = POSTS.length;
      if (r < maxRounds - 1) {
        var away = findSidebarLink(bounceLabel) || findSidebarLink('Đối tượng');
        if (away) { away.click(); await sleep(1200); } // ép component Thư viện nội dung dựng lại từ đầu ở vòng sau
      }
    }
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
      // An toàn: nếu không ai bấm/chọn lại trong 3 phút (vd bấm nút rồi đi làm việc khác),
      // TỰ BỎ QUA tab này thay vì treo cả quy trình "🚀 Quét toàn bộ" mãi mãi.
      var timeout = setTimeout(function () {
        log('⏱️  Chờ quá lâu ở tab "' + label + '" — tự bỏ qua tab này để tiếp tục các tab còn lại.');
        finish();
      }, 180000);
      function finish() {
        clearInterval(poll); clearTimeout(timeout);
        var el = document.getElementById('shb-cl-datewait'); if (el) el.remove();
        resolve();
      }
      document.getElementById('shb-cl-datewait-btn').onclick = finish;
    });
  }
  function esc0(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  // Cảnh báo TO trên màn hình — log Console dễ bị bỏ sót (nhất là khi tab Console không
  // mở), khiến người dùng tưởng nút đã chạy xong dù script thực ra dừng ngay từ đầu vì
  // thiếu điều kiện (vd chưa chọn "Tuỳ chỉnh"). Tự biến mất sau 6 giây hoặc bấm để đóng.
  function showBigWarning(msg) {
    var el = document.getElementById('shb-cl-warn'); if (el) el.remove();
    el = document.createElement('div');
    el.id = 'shb-cl-warn';
    el.style.cssText = 'position:fixed;bottom:110px;right:16px;z-index:1000000;background:#fff3cd;border:2px solid #f5a623;border-radius:10px;padding:12px 14px;font:13px system-ui;color:#111;box-shadow:0 4px 20px rgba(0,0,0,.35);max-width:320px;cursor:pointer';
    el.innerHTML = '⚠️ <b>Chưa quét được</b><div style="margin-top:4px">' + esc0(msg) + '</div><div style="margin-top:6px;font-size:11px;color:#666">(bấm để đóng)</div>';
    el.onclick = function () { el.remove(); };
    document.body.appendChild(el);
    setTimeout(function () { var e2 = document.getElementById('shb-cl-warn'); if (e2) e2.remove(); }, 6000);
  }
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
    if (!wantRange) {
      var msg = 'Hãy chọn "Tuỳ chỉnh" đúng khoảng ngày cần TRÊN TAB HIỆN TẠI trước, rồi bấm lại "🚀 Quét toàn bộ".';
      log('⚠️ ' + msg);
      showBigWarning(msg); // hiện to trên màn hình — log Console dễ bị bỏ sót, gây hiểu lầm nút "chạy xong" dù chưa làm gì
      return;
    }
    var startISO = iso(new Date(wantRange.start)), endISO = iso(new Date(wantRange.end));
    log('SHBCL_fetchAllTabs: khoảng ' + startISO + ' → ' + endISO + ', đi qua ' + tabs.length + ' tab, REPLAY request thật cho từng tab (không rê chuột)...');
    for (var i = 0; i < tabs.length; i++) {
      var label = tabs[i];
      // Bọc TỪNG TAB trong try/catch riêng — lỗi ở 1 tab (network, timeout, request hỏng...)
      // trước đây làm CẢ VÒNG LẶP dừng giữa chừng (promise reject không ai bắt), khiến nút
      // "Quét toàn bộ" có cảm giác "không chạy hết". Giờ lỗi 1 tab chỉ bỏ qua tab đó, log rõ
      // ràng, rồi tiếp tục tab kế tiếp — không để 1 chỗ hỏng kéo sập cả quy trình.
      try {
        var link = findSidebarLink(label);
        if (!link) { log('⚠️ Không tìm thấy tab "' + label + '" — bỏ qua, tự làm tay tab này (đứng ở tab đó rồi gõ SHBCL_fetchFullRange("' + startISO + '","' + endISO + '")).'); continue; }
        log('➡️  [' + (i + 1) + '/' + tabs.length + '] Chuyển sang tab "' + label + '"...');
        link.click();
        await sleep(1800); // đợi SPA đổi route + gọi API đầu tiên của tab mới
        // Thư viện nội dung là danh sách PHÂN TRANG KIỂU CUỘN — Facebook GIỚI HẠN số trang
        // tải mỗi lần "mở" component (đã xác nhận: kể cả cuộn TAY thật cũng bị dừng, chỉ
        // thoát tab đi/về mới tải thêm) — nên thay vì chỉ cuộn, tự "nhảy đi tab khác rồi
        // quay lại" nhiều vòng để ép Facebook dựng lại component + tải thêm trang, y hệt
        // thao tác tay đã xác nhận hiệu quả.
        if (label === 'Thư viện nội dung') { await scrapeContentLibraryFully(); continue; }
        var beforeCount = LAST_TS_REQUESTS.length;
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
      } catch (e) {
        log('❌ Lỗi ở tab "' + label + '" — BỎ QUA, tiếp tục tab kế tiếp:', e);
      }
    }
    coverageReport(false);
    badge();
    log('✅ SHBCL_fetchAllTabs: XONG TẤT CẢ TAB — tổng đã gom: ' + POSTS.length + ' bài, ' + PAGES.length + ' page. Gõ SHBCL_coverage() xem chi tiết từng chỉ số.');
  };

  // ── LỆNH DUY NHẤT — gộp TẤT CẢ các bước thành 1 nút, khỏi phải nhớ nhiều lệnh:
  // (1) quét hết mọi tab Insight bằng replay (SHBCL_fetchAllTabs), (2) tự lấy luôn Cảm
  // xúc chi tiết cho toàn bộ bài NẾU đã có mẫu request (đã bấm mở 1 bài ít nhất 1 lần
  // trong phiên này). Việc tay DUY NHẤT còn lại của cả quy trình: (a) bấm "Đã chọn xong"
  // khi Facebook tự reset ngày lúc đổi tab, (b) lần đầu mỗi phiên cần bấm mở 1 bài xem
  // Cảm xúc 1 lần cho script có mẫu — mọi lần chạy SAU trong CÙNG phiên không cần nữa.
  W.SHBCL_runAll = async function () {
    log('🚀 SHBCL_runAll: bắt đầu quét TOÀN BỘ (tất cả tab Insight + Cảm xúc chi tiết từng bài)...');
    await W.SHBCL_fetchAllTabs();
    if (LAST_POST_RESPONSES.length) {
      log('➡️  Tiếp tục lấy Cảm xúc chi tiết cho toàn bộ bài...');
      await W.SHBCL_fetchAllPostReactions();
    } else {
      var msg3 = 'CHƯA lấy được Cảm xúc chi tiết — vào Thư viện nội dung, bấm mở 1 bài BẤT KỲ (thấy Cảm xúc dưới bài, KHÔNG phải dưới bình luận) 1 LẦN, rồi bấm "🚀 Quét toàn bộ" lại — lần sau trong CÙNG phiên sẽ tự động, không cần bấm nữa.';
      log('⚠️  ' + msg3); showBigWarning(msg3);
    }
    log('✅ SHBCL_runAll: XONG TOÀN BỘ.');
  };

  log('KHUYÊN DÙNG (1 nút duy nhất, ít thao tác tay nhất): chọn đúng khoảng "Tuỳ chỉnh" cần lấy, ' +
      'bấm nút "🚀 Quét toàn bộ" trên ô SHB (hoặc gõ SHBCL_runAll()) — tự quét mọi tab Insight bằng replay ' +
      '(không rê chuột) VÀ tự lấy Cảm xúc chi tiết cho toàn bộ bài trong 1 lần bấm. ' +
      'Việc tay duy nhất còn lại: (a) bấm "✅ Đã chọn xong" khi Facebook tự reset ngày lúc đổi tab, ' +
      '(b) LẦN ĐẦU mỗi phiên (mở bookmark lại) cần bấm mở 1 bài xem Cảm xúc 1 lần trước khi bấm nút — chạy lại trong cùng phiên thì không cần nữa. ' +
      'Gõ SHBCL_coverage() bất kỳ lúc nào để xem báo cáo hiện tại.');

  openBridge(); // mở cửa sổ bridge ngay (nếu bị chặn popup: bấm ô SHB góc dưới phải)
  badge();
  log('Bản console (bridge) đã chạy — dữ liệu tự đẩy lên MySQL qua cửa sổ bridge. ' +
      'Nếu ô SHB góc dưới phải báo 🔴, bấm vào đó để mở bridge. ' +
      'Đường lui nếu bridge lỗi: copy(SHBCL_export()) + shb-ingest-upload.console.js.');
})();
