// Seed demo data vào bảng `events` (Email Supabase) để demo dashboard đầy đủ tính năng.
// Dùng: EMAIL_SUPABASE_URL=... EMAIL_SUPABASE_SERVICE_KEY=... node scripts/seed-email-demo.js
// Có thể thêm --wipe để xoá sạch bảng events trước khi seed (CHỈ dùng cho môi trường demo).
'use strict';
const https = require('https');

const SUPABASE_URL = process.env.EMAIL_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_KEY  = process.env.EMAIL_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const WIPE = process.argv.includes('--wipe');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Thiếu EMAIL_SUPABASE_URL / EMAIL_SUPABASE_SERVICE_KEY (hoặc SUPABASE_URL / SUPABASE_SERVICE_KEY).');
  process.exit(1);
}
const HOST = SUPABASE_URL.replace(/^https?:\/\//, '');

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request({ hostname: HOST, path, method, headers }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(buf);
        else reject(new Error(`${method} ${path} -> ${res.statusCode}: ${buf}`));
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

/* ── Dữ liệu người nhận demo ───────────────────────────────────────────── */
const DEPTS = ['Khối Bán lẻ', 'Khối Doanh nghiệp', 'Khối Vận hành', 'Khối Công nghệ', 'Khối Quản trị rủi ro', 'Khối Nhân sự'];
const ROLES = ['Chuyên viên', 'Chuyên viên cao cấp', 'Trưởng phòng', 'Giám đốc'];
const HO = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vu', 'Dang', 'Bui', 'Do', 'Ngo'];
const TEN = ['An', 'Binh', 'Chi', 'Dung', 'Giang', 'Ha', 'Huy', 'Khanh', 'Lan', 'Minh', 'Nam', 'Phuong', 'Quang', 'Son', 'Thao', 'Trang', 'Tuan', 'Van', 'Yen', 'Linh'];

function rnd(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rnd(arr.length)]; }
function pct(p) { return Math.random() < p; }

function buildPeople(n) {
  const people = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    let local;
    do { local = (pick(TEN) + '.' + pick(HO) + (rnd(90) + 10)).toLowerCase(); } while (used.has(local));
    used.add(local);
    people.push({
      rcpt: local + '@shb.com.vn',
      dept: pick(DEPTS),
      role: pick(ROLES),
    });
  }
  return people;
}

/* ── Chiến dịch demo ──────────────────────────────────────────────────── */
const CAMPAIGNS = [
  { name: 'ra-mat-shb-transformation-talk-thang-6', subject: 'SHB Transformation Talk — Tập 1: Chuyển đổi số bắt đầu từ đâu?', msg_type: null, initiative: 'SHB Transformation Talk', daysAgo: 25, reach: 0.78, click: 0.42 },
  { name: 'shb-transformation-talk-tap-2-cong-nghe', subject: 'SHB Transformation Talk — Tập 2: Công nghệ lõi ngân hàng', msg_type: null, initiative: 'SHB Transformation Talk', daysAgo: 11, reach: 0.71, click: 0.35 },
  { name: 'ra-mat-tinh-nang-sinh-loi-tu-dong', subject: 'Ra mắt tính năng Sinh lời Tự động trên SAHA', msg_type: null, initiative: 'Sinh lời Tự động', daysAgo: 18, reach: 0.66, click: 0.28 },
  { name: 'cap-nhat-ket-qua-kinh-doanh-quy-2', subject: 'Cập nhật kết quả kinh doanh Quý 2/2026', msg_type: null, initiative: '', daysAgo: 6, reach: 0.83, click: 0.15 },
  { name: 'thong-bao-nghi-le-va-lich-truc', subject: 'Thông báo lịch nghỉ lễ và phân công trực', msg_type: null, initiative: '', daysAgo: 2, reach: 0.52, click: 0.08 },
  { name: 'quy-dinh-bao-mat-thong-tin-noi-bo-2026', subject: 'Bắt buộc: Quy định bảo mật thông tin nội bộ 2026', msg_type: 'mandatory', initiative: '', daysAgo: 14, reach: 0.62, click: 0.05 },
];

let seq = 0;
function eid() { return 'seed' + Date.now().toString(36) + (seq++).toString(36); }

function buildRowsForCampaign(camp, people) {
  const now = Date.now();
  const sendTs = now - camp.daysAgo * 864e5 - rnd(4) * 36e5;
  const targetN = 60 + rnd(90); // 60–150 người nhận / chiến dịch
  const targets = [...people].sort(() => Math.random() - 0.5).slice(0, targetN);

  const rows = [];
  targets.forEach((p) => {
    const id = eid();
    rows.push({
      event_id: id, pos: 'sent', rcpt: p.rcpt, campaign: camp.name, subject: camp.subject,
      msg_type: camp.msg_type, initiative: camp.initiative || null, target_size: targetN,
      dept: p.dept, role: p.role, loc: null, link: null, dest: null, ua: null,
      ts: new Date(sendTs).toISOString(),
    });
    if (!pct(camp.reach)) return; // không mở
    const openTs = sendTs + (5 + rnd(240)) * 60e3; // mở sau 5 phút – 4 giờ
    const ua = pct(0.55) ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Outlook';
    rows.push({
      event_id: id, pos: 'top', rcpt: p.rcpt, campaign: camp.name, subject: camp.subject,
      msg_type: camp.msg_type, initiative: camp.initiative || null, target_size: targetN,
      dept: p.dept, role: p.role, loc: null, link: null, dest: null, ua,
      ts: new Date(openTs).toISOString(),
    });
    if (pct(0.18)) { // một số người mở lại lần 2 (>5s sau, kiểm tra dedup lượt mở)
      rows.push({
        event_id: id, pos: 'top', rcpt: p.rcpt, campaign: camp.name, subject: camp.subject,
        msg_type: camp.msg_type, initiative: camp.initiative || null, target_size: targetN,
        dept: p.dept, role: p.role, loc: null, link: null, dest: null, ua,
        ts: new Date(openTs + (10 + rnd(600)) * 60e3).toISOString(),
      });
    }
    if (pct(camp.click)) {
      rows.push({
        event_id: id, pos: 'click', rcpt: p.rcpt, campaign: camp.name, subject: camp.subject,
        msg_type: camp.msg_type, initiative: camp.initiative || null, target_size: targetN,
        dept: p.dept, role: p.role, loc: null,
        link: 'https://saha.shb.com.vn/' + camp.name, dest: 'https://saha.shb.com.vn/' + camp.name, ua,
        ts: new Date(openTs + (2 + rnd(30)) * 60e3).toISOString(),
      });
    }
    if (camp.msg_type === 'mandatory' && pct(0.7)) {
      rows.push({
        event_id: id, pos: 'read', rcpt: p.rcpt, campaign: camp.name, subject: camp.subject,
        msg_type: camp.msg_type, initiative: camp.initiative || null, target_size: targetN,
        dept: p.dept, role: p.role, loc: null, link: null, dest: null, ua,
        ts: new Date(openTs + (1 + rnd(15)) * 60e3).toISOString(),
      });
    }
  });
  return rows;
}

async function main() {
  if (WIPE) {
    console.log('Đang xoá dữ liệu demo cũ (event_id bắt đầu bằng "seed") trong bảng events...');
    await req('DELETE', '/rest/v1/events?event_id=like.seed*', null);
  }

  const people = buildPeople(200);
  let allRows = [];
  CAMPAIGNS.forEach((camp) => { allRows = allRows.concat(buildRowsForCampaign(camp, people)); });

  console.log(`Chuẩn bị chèn ${allRows.length} sự kiện (${CAMPAIGNS.length} chiến dịch, ${people.length} người nhận demo)...`);

  const BATCH = 500;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH);
    await req('POST', '/rest/v1/events', batch);
    console.log(`  đã chèn ${Math.min(i + BATCH, allRows.length)}/${allRows.length}`);
  }
  console.log('Xong! Mở /api/email (hoặc /api/leader) để xem demo.');
}

main().catch((e) => { console.error('Lỗi:', e.message); process.exit(1); });
