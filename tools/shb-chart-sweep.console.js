// ================================================================
// SHB — QUÉT TỰ ĐỘNG CHART LAZY-LOAD (17/07/2026)
// Vấn đề: chart "Xu hướng theo thời gian" trên Facebook Professional
// Dashboard chỉ nhả dữ liệu theo TỪNG KHUNG NGÀY NHỎ khi rê chuột qua
// (giống Content Library lazy-load khi cuộn) — rê tay dễ thiếu đoạn.
// Script này TỰ ĐỘNG phát sự kiện mousemove quét hết bề ngang khung
// chart lớn nhất đang hiển thị, ép nhả hết các khung ngày.
//
// Cách dùng:
//   1. Dán tools/shb-content-library.console.js trước (script gom chính,
//      cần chạy trước để có hook fetch/XHR + bridge đang mở/kết nối).
//   2. Vào tab Insight cần quét (Lượt xem/Lượt tương tác/...), chọn đúng
//      khoảng ngày muốn lấy.
//   3. Dán NGUYÊN FILE NÀY vào Console → Enter. Tự chạy ~5-15 giây tuỳ
//      độ rộng chart, log "[SHB-SWEEP] Xong" khi hoàn tất.
//   4. Xem ô "SHB" góc dưới phải — số "page" phải tăng lên nhiều lần so
//      với trước khi quét. Nếu không tăng, thử chạy lại 2-3 lần (mỗi
//      lần bước nhảy random khác nhau, dễ bắt được khung còn sót) hoặc
//      dùng cách tay (rê chuột dọc chart) như phương án dự phòng.
// ================================================================
(function () {
  'use strict';
  function log() { try { console.log.apply(console, ['[SHB-SWEEP]'].concat([].slice.call(arguments))); } catch (e) {} }

  // Tìm SVG lớn nhất đang thực sự hiển thị trên màn hình (chart thường
  // là SVG rộng > 250px, cao > 80px, nằm trong viewport).
  var svgs = Array.from(document.querySelectorAll('svg')).map(function (s) {
    var r = s.getBoundingClientRect();
    return { el: s, r: r };
  }).filter(function (x) {
    return x.r.width > 250 && x.r.height > 60 && x.r.top < window.innerHeight && x.r.bottom > 0 && x.r.left < window.innerWidth;
  }).sort(function (a, b) { return (b.r.width * b.r.height) - (a.r.width * a.r.height); });

  if (!svgs.length) { log('Không tìm thấy chart SVG nào đủ lớn đang hiển thị — cuộn trang cho chart vào khung nhìn rồi thử lại.'); return; }

  var target = svgs[0], r = target.r;
  log('Quét chart ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' tại (' + Math.round(r.left) + ',' + Math.round(r.top) + ')');

  // Quét vài hàng Y khác nhau trong chart (không chỉ giữa) vì tooltip
  // hitbox nhiều thư viện chart chỉ nhận đúng vùng đường vẽ, không phải
  // toàn bộ chiều cao — random nhẹ mỗi lần để tránh lặp y hệt lần trước.
  var ys = [0.3, 0.5, 0.7].map(function (f) { return r.top + r.height * f; });
  var STEP = 3, x = r.left, yi = 0;
  var timer = setInterval(function () {
    if (x > r.right) {
      yi++;
      if (yi >= ys.length) { clearInterval(timer); log('Xong — kiểm tra ô SHB góc dưới phải xem số "page" đã tăng chưa.'); return; }
      x = r.left;
    }
    var y = ys[yi];
    var el = document.elementFromPoint(x, y) || target.el;
    ['mouseover', 'mousemove'].forEach(function (type) {
      try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window })); } catch (e) {}
    });
    x += STEP;
  }, 12);
})();
