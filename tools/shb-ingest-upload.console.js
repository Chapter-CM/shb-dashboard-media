// ================================================================
// UPLOADER — bước 2 của quy trình gom dữ liệu Facebook (17/07/2026).
// CSP của facebook.com chặn gửi trực tiếp từ Console, nên dữ liệu được
// gom trên tab Facebook (tools/shb-content-library.console.js) rồi
// gửi từ ĐÂY — dán file này vào DevTools Console (F12) trên tab
// dashboard nội bộ: https://cm-dashboard.dev-saha.aws.shb.com.vn
// (cùng domain với /api/ingest nên không bị CSP chặn).
//
// Cách dùng:
//   1. Tab Facebook: chạy script gom, cuộn hết bài, gõ copy(SHBCL_export())
//   2. Tab dashboard: dán file này → Enter → hiện ô nhập ở góc phải
//   3. Ctrl+V dán dữ liệu vào ô → bấm "Gửi lên MySQL" → chờ log ✅
// ================================================================

(function () {
  'use strict';

  var INGEST = 'https://cm-dashboard.dev-saha.aws.shb.com.vn/api/ingest';
  var CHUNK = 25; // gửi bài viết theo lô 25 dòng/request cho nhẹ

  // INGEST_SECRET: KHÔNG hardcode trong file — hỏi 1 lần rồi lưu trên máy này
  // (localStorage của domain dashboard), tránh lộ secret thật khi commit lên GitLab.
  var SECRET_KEY = 'shb_ingest_secret';
  function getSecret() {
    var s = null;
    try { s = localStorage.getItem(SECRET_KEY); } catch (e) {}
    if (!s) {
      s = window.prompt('Nhập INGEST_SECRET nội bộ SHB (chỉ hỏi 1 lần, lưu trên máy này):') || '';
      if (s) { try { localStorage.setItem(SECRET_KEY, s); } catch (e) {} }
    }
    return s;
  }

  // ── UI nổi góc phải ────────────────────────────────────────────────────────
  var old = document.getElementById('shb-uploader'); if (old) old.remove();
  var box = document.createElement('div');
  box.id = 'shb-uploader';
  box.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;background:#fff;border:2px solid #e11d2a;border-radius:12px;padding:14px;width:380px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:13px/1.5 system-ui,sans-serif;color:#111';
  box.innerHTML =
    '<b style="color:#e11d2a">SHB — Đẩy dữ liệu Facebook lên MySQL</b>' +
    '<div style="margin:6px 0 4px">Dán (Ctrl+V) dữ liệu từ <code>copy(SHBCL_export())</code> vào ô dưới:</div>' +
    '<textarea id="shb-up-ta" style="width:100%;height:110px;box-sizing:border-box;font:11px monospace;border:1px solid #ccc;border-radius:8px;padding:6px" placeholder=\'{"posts":[...],"pages":[...]}\'></textarea>' +
    '<div style="display:flex;gap:8px;margin-top:8px">' +
    '<button id="shb-up-go" style="flex:1;background:linear-gradient(90deg,#e11d2a,#fb7427);color:#fff;border:0;border-radius:8px;padding:8px;font-weight:700;cursor:pointer">Gửi lên MySQL</button>' +
    '<button id="shb-up-x" style="background:#eee;border:0;border-radius:8px;padding:8px 12px;cursor:pointer">Đóng</button></div>' +
    '<div id="shb-up-log" style="margin-top:8px;max-height:160px;overflow:auto;font:11px monospace;white-space:pre-wrap"></div>';
  document.body.appendChild(box);

  var logEl = box.querySelector('#shb-up-log');
  function log(s) { logEl.textContent += s + '\n'; logEl.scrollTop = 1e9; try { console.log('[SHB-UP]', s); } catch (e) {} }
  box.querySelector('#shb-up-x').onclick = function () { box.remove(); };

  function post(body) {
    return fetch(INGEST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ingest-secret': getSecret() },
      body: JSON.stringify(body)
    }).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); });
  }

  box.querySelector('#shb-up-go').onclick = function () {
    var raw = box.querySelector('#shb-up-ta').value.trim();
    if (!raw) { log('⚠️ Ô trống — hãy dán dữ liệu đã copy từ tab Facebook.'); return; }
    var data;
    try { data = JSON.parse(raw); } catch (e) { log('❌ JSON không hợp lệ: ' + e.message + ' — copy lại bằng copy(SHBCL_export()) rồi dán nguyên vẹn.'); return; }
    var posts = Array.isArray(data.posts) ? data.posts : (Array.isArray(data) ? data : []);
    var pages = Array.isArray(data.pages) ? data.pages : [];
    log('Bắt đầu gửi: ' + posts.length + ' bài + ' + pages.length + ' page metrics...');

    var jobs = [];
    for (var i = 0; i < posts.length; i += CHUNK) jobs.push({ label: 'bài ' + (i + 1) + '–' + Math.min(i + CHUNK, posts.length), body: posts.slice(i, i + CHUNK) });
    pages.forEach(function (p, i) { jobs.push({ label: 'page metrics #' + (i + 1) + (p.date_range ? ' (' + p.date_range + ')' : ''), body: p }); });

    var ok = 0, fail = 0;
    (function next(idx) {
      if (idx >= jobs.length) { log('── XONG: ' + ok + ' OK, ' + fail + ' lỗi. ' + (fail ? 'Xem lỗi ở trên.' : 'F5 dashboard #fb để xem số liệu.')); return; }
      var j = jobs[idx];
      post(j.body).then(function (r) {
        if (r.status >= 200 && r.status < 300) { ok++; log('✅ ' + j.label + ' → ' + r.status); }
        else { fail++; log('❌ ' + j.label + ' → ' + r.status + ' ' + String(r.text).slice(0, 200)); }
        next(idx + 1);
      }).catch(function (e) { fail++; log('❌ ' + j.label + ' → ' + e.message); next(idx + 1); });
    })(0);
  };

  log('Sẵn sàng. Dán dữ liệu vào ô trên rồi bấm "Gửi lên MySQL".');
})();
