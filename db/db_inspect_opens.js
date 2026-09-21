// Điều tra lượt "mở" email bất thường (vd 1 người hiện 93 lượt mở trong 1
// ngày) — CHỈ ĐỌC, không sửa/xoá gì. Gọi từ job `db_inspect_opens` trong
// .gitlab-ci.yml (when: manual).
//
// QUAN TRỌNG — dùng lib/db-client.js (giống hệt sync.js/api/email-dashboard.js),
// KHÔNG tự mở kết nối mysql2 trực tiếp: GitLab runner bị Security Group chặn
// kết nối thẳng RDS (đã xác nhận thật bằng lỗi ETIMEDOUT khi thử — xem
// HANDOFF.md mục E và db/db_cleanup_test.js). Đường DUY NHẤT chạy được từ CI
// là route HTTP /dbquery của service ingest (biến INGEST_API_URL/INGEST_SECRET,
// đã có sẵn trong CI/CD Variables vì job sync_data đang dùng đúng đường này).
//
// CÁCH CHẠY: Pipelines → chọn pipeline mới nhất → job db_inspect_opens → nút ▶
// → điền biến (không bắt buộc):
//   RCPT      = email cần soi chi tiết (vd trung.lt@shb.com.vn).
//   CAMPAIGN  = tên chiến dịch để lọc bớt (khớp gần đúng, không phân biệt hoa/thường).
//
// 2 CHẾ ĐỘ:
//   A. Có RCPT: in TOÀN BỘ event thô (pos, ua, ts) của người đó theo đúng thứ
//      tự thời gian, kèm khoảng cách (giây) giữa 2 lần "top" liên tiếp — để
//      mắt thường thấy ngay nhịp mở có đều đặn bất thường không (vd đúng mỗi
//      5-10 phút suốt cả ngày = khả năng cao mail client/gateway tự tải lại
//      ảnh, không phải người mở lại thật).
//   B. Không có RCPT: liệt kê TOP 20 người có nhiều lượt "top" nhất, kèm số
//      User-Agent khác nhau và số ngày khác nhau có lượt mở — cùng logic
//      p.burstSuspect trên dashboard (api/email-dashboard.js) để đối chiếu.
//
// GHI CHÚ KỸ THUẬT: lib/db-client.js dịch path kiểu PostgREST sang SQL nhưng
// CHỈ hỗ trợ select/eq/neq/in/not.in/order/limit/offset — KHÔNG có GROUP BY,
// hàm tổng hợp hay LIKE. Vì vậy chế độ B tự lấy toàn bộ raw event rồi tổng
// hợp bằng JS (không phải SQL) — giống hệt cách api/email-dashboard.js đang
// làm (đọc thô, tính toán ở tầng ứng dụng), và lọc CAMPAIGN cũng làm bằng JS
// (substring, không phân biệt hoa/thường) thay vì SQL LIKE.
'use strict';
const dbClient = require('../lib/db-client');

const { RCPT, CAMPAIGN } = process.env;
const PAGE = 1000;

async function fetchAll(basePath) {
  let out = [];
  let offset = 0;
  for (;;) {
    const rows = await dbClient.get(basePath + '&limit=' + PAGE + '&offset=' + offset);
    if (!rows || !rows.length) break;
    out = out.concat(rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

function matchesCampaign(row) {
  if (!CAMPAIGN) return true;
  return String(row.campaign || '').toLowerCase().indexOf(CAMPAIGN.toLowerCase()) > -1;
}

async function main() {
  if (!process.env.INGEST_API_URL && !process.env.MYSQL_HOST) {
    console.error('Thieu INGEST_API_URL (+ INGEST_SECRET) hoac MYSQL_HOST trong CI/CD Variables.');
    process.exit(1);
  }
  if (!process.env.INGEST_API_URL) {
    console.log('CANH BAO: khong thay INGEST_API_URL trong CI/CD Variables - se thu ket noi');
    console.log('MySQL truc tiep bang MYSQL_HOST, DA BIET TRUOC cach nay KHONG chay duoc tu');
    console.log('GitLab runner (ETIMEDOUT do Security Group chan, xem HANDOFF.md muc E).');
  }

  const sel = 'pos,campaign,ua,ts';

  if (RCPT) {
    console.log('=== CHE DO A: raw event cua "' + RCPT + '" ' +
      (CAMPAIGN ? '(loc gan dung campaign chua "' + CAMPAIGN + '")' : '(moi campaign)') + ' ===\n');
    const path = '/rest/v1/events?select=' + encodeURIComponent(sel) +
      '&rcpt=eq.' + encodeURIComponent(RCPT) + '&order=ts.asc';
    let rows = await fetchAll(path);
    rows = rows.filter(matchesCampaign);

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
        console.log(r.ts + '  ' + String(r.pos).padEnd(6) + '  campaign=' + (r.campaign || '') + '  ua="' + (r.ua || '') + '"' + gapNote);
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
    console.log('=== CHE DO B: TOP 20 nguoi co nhieu luot "top" nhat ' +
      (CAMPAIGN ? '(loc gan dung campaign chua "' + CAMPAIGN + '")' : '(toan bo DB)') + ' ===\n');
    const path = '/rest/v1/events?select=rcpt,' + encodeURIComponent(sel) + '&pos=eq.top';
    let rows = await fetchAll(path);
    rows = rows.filter(matchesCampaign);

    if (!rows.length) {
      console.log('Khong co du lieu pos=top nao khop dieu kien.');
    } else {
      const byRcpt = {};
      rows.forEach((r) => {
        if (!byRcpt[r.rcpt]) byRcpt[r.rcpt] = { n: 0, uaSet: new Set(), daySet: new Set(), first: r.ts, last: r.ts };
        const g = byRcpt[r.rcpt];
        g.n++;
        g.uaSet.add(r.ua || '');
        g.daySet.add(String(r.ts).slice(0, 10));
        if (r.ts < g.first) g.first = r.ts;
        if (r.ts > g.last) g.last = r.ts;
      });
      const list = Object.keys(byRcpt).map((rcpt) => ({
        rcpt, n: byRcpt[rcpt].n, nUa: byRcpt[rcpt].uaSet.size, nDays: byRcpt[rcpt].daySet.size,
        first: byRcpt[rcpt].first, last: byRcpt[rcpt].last,
      })).sort((a, b) => b.n - a.n).slice(0, 20);

      console.log('Tong so nguoi co it nhat 1 lan mo (khop dieu kien): ' + Object.keys(byRcpt).length + '\n');
      console.log('rcpt | so_lan_top | so_UA_khac_nhau | so_ngay_khac_nhau | lan_dau | lan_cuoi');
      list.forEach((r) => {
        const flag = (r.n >= 15 && r.nDays <= 2) ? '  <-- nghi don dap' : '';
        console.log(r.rcpt + ' | ' + r.n + ' | ' + r.nUa + ' | ' + r.nDays + ' | ' + r.first + ' | ' + r.last + flag);
      });
      console.log('\nChay lai job nay voi bien RCPT=<email o dong nghi ngo> de xem chi tiet raw event (che do A).');
    }
  }

  await dbClient.end().catch(() => {});
}

main().catch((err) => {
  console.error('LOI:', err.code || '(no code)', '-', err.message);
  process.exit(1);
});
