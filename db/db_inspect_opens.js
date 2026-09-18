// Điều tra lượt "mở" email bất thường (vd 1 người hiện 93 lượt mở trong 1
// ngày) — CHỈ ĐỌC, không sửa/xoá gì. Gọi từ job `db_inspect_opens` trong
// .gitlab-ci.yml (when: manual), dùng MYSQL_* đã có sẵn trong CI/CD Variables
// (cùng bộ biến job db_check/db_cleanup_test đang dùng).
//
// CÁCH CHẠY: Pipelines → chọn pipeline mới nhất → Run pipeline (hoặc job
// db_inspect_opens có nút ▶ nếu job đã tồn tại trong pipeline) → điền biến:
//   RCPT      = email cần soi chi tiết (vd trung.lt@shb.com.vn) — BẮT BUỘC nếu
//               muốn xem đúng 1 người.
//   CAMPAIGN  = tên chiến dịch để lọc bớt (không bắt buộc, khớp gần đúng LIKE).
//
// 2 CHẾ ĐỘ:
//   A. Có RCPT: in TOÀN BỘ event thô (pos, ua, timestamp) của người đó theo
//      đúng thứ tự thời gian, kèm khoảng cách (giây) giữa 2 lần "top" liên
//      tiếp — để mắt thường thấy ngay nhịp mở có đều đặn bất thường không
//      (vd đúng mỗi 5-10 phút suốt cả ngày = khả năng cao mail client/gateway
//      tự tải lại ảnh, không phải người mở lại thật).
//   B. Không có RCPT (chỉ CAMPAIGN, hoặc để trống cả 2 = toàn bộ DB): liệt kê
//      TOP 20 người có nhiều lượt "top" nhất, kèm số User-Agent khác nhau và
//      số ngày khác nhau có lượt mở — cùng logic p.burstSuspect trên dashboard
//      (api/email-dashboard.js) để đối chiếu 2 chiều.
'use strict';
const mysql = require('mysql2/promise');

const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, RCPT, CAMPAIGN } = process.env;

if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD || !MYSQL_DATABASE) {
  console.error('Thieu MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE trong CI/CD Variables.');
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT) || 3306,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    dateStrings: true,
    connectTimeout: 10000,
  });

  if (RCPT) {
    console.log('=== CHE DO A: chi tiet raw event cua "' + RCPT + '" ' + (CAMPAIGN ? '(campaign LIKE "%' + CAMPAIGN + '%")' : '(moi campaign)') + ' ===\n');
    let sql = 'SELECT pos, campaign, ua, ts FROM `events` WHERE rcpt = ?';
    const params = [RCPT];
    if (CAMPAIGN) { sql += ' AND campaign LIKE ?'; params.push('%' + CAMPAIGN + '%'); }
    sql += ' ORDER BY ts ASC';
    const [rows] = await conn.query(sql, params);

    if (!rows.length) {
      console.log('KHONG TIM THAY event nao khop. Kiem tra lai RCPT/CAMPAIGN da dien dung chua.');
    } else {
      console.log('Tong so dong: ' + rows.length + '\n');
      let lastTopTs = null;
      const uaCount = {};
      rows.forEach((r) => {
        let gapNote = '';
        if (r.pos === 'top') {
          if (lastTopTs) {
            const gapS = Math.round((new Date(r.ts) - new Date(lastTopTs)) / 1000);
            gapNote = '  [cach lan top truoc: ' + gapS + 's]';
          }
          lastTopTs = r.ts;
          uaCount[r.ua || '(rong)'] = (uaCount[r.ua || '(rong)'] || 0) + 1;
        }
        console.log(r.ts + '  ' + r.pos.padEnd(6) + '  campaign=' + (r.campaign || '') + '  ua="' + (r.ua || '') + '"' + gapNote);
      });
      console.log('\n--- Tong hop User-Agent cua cac lan "top" (mo) ---');
      Object.keys(uaCount).sort((a, b) => uaCount[b] - uaCount[a]).forEach((ua) => {
        console.log(uaCount[ua] + ' lan  ua="' + ua + '"');
      });
      console.log('\nDoc ket qua: neu chi 1-2 UA lap lai voi khoang cach GAN NHU DEU NHAU (vd luon ~300s/~600s)');
      console.log('suot ca ngay -> gan nhu chac chan la mail client/gateway tu tai lai anh, KHONG phai nguoi mo lai that.');
      console.log('Neu UA da dang / khoang cach ngau nhien / trai dai nhieu ngay -> can xem xet them, co the la mo that.');
    }
  } else {
    console.log('=== CHE DO B: TOP 20 nguoi co nhieu luot "top" nhat ' + (CAMPAIGN ? '(campaign LIKE "%' + CAMPAIGN + '%")' : '(toan bo DB)') + ' ===\n');
    let sql = "SELECT rcpt, COUNT(*) AS n_top, COUNT(DISTINCT ua) AS n_ua, COUNT(DISTINCT DATE(ts)) AS n_days, MIN(ts) AS first_ts, MAX(ts) AS last_ts FROM `events` WHERE pos = 'top'";
    const params = [];
    if (CAMPAIGN) { sql += ' AND campaign LIKE ?'; params.push('%' + CAMPAIGN + '%'); }
    sql += ' GROUP BY rcpt ORDER BY n_top DESC LIMIT 20';
    const [rows] = await conn.query(sql, params);

    if (!rows.length) {
      console.log('Khong co du lieu pos=top nao khop dieu kien.');
    } else {
      console.log('rcpt | so_lan_top | so_UA_khac_nhau | so_ngay_khac_nhau | lan_dau | lan_cuoi');
      rows.forEach((r) => {
        const flag = (r.n_top >= 15 && r.n_days <= 2) ? '  <-- ⚠️ nghi don dap' : '';
        console.log(r.rcpt + ' | ' + r.n_top + ' | ' + r.n_ua + ' | ' + r.n_days + ' | ' + r.first_ts + ' | ' + r.last_ts + flag);
      });
      console.log('\nChay lai job nay voi bien RCPT=<email o dong nghi ngo> de xem chi tiet raw event (che do A).');
    }
  }

  await conn.end();
}

main().catch((err) => {
  console.error('LOI:', err.code || '(no code)', '-', err.message);
  process.exit(1);
});
