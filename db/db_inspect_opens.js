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
//
// BUG ĐÃ SỬA (chạy thật lần đầu phát hiện): lấy trang bằng limit/offset mà
// KHÔNG có order= trên bảng `events` — bảng này đang được ghi liên tục
// (nhận beacon real-time) nên MySQL KHÔNG đảm bảo thứ tự dòng ổn định giữa
// các trang khi không có ORDER BY, có thể đọc trùng dòng cũ / bỏ sót dòng
// khi phân trang → phồng số đếm và sai số ngày (bằng chứng thật: 1 dòng
// kết quả báo 111 lượt mở nhưng chỉ "1 ngày khác nhau" trong khi lần đầu và
// lần cuối cách nhau 2 tháng — không thể đúng). Đã thêm order=ts.asc vào
// chế độ B (chế độ A đã có sẵn từ đầu).
'use strict';
const dbClient = require('../lib/db-client');

const { RCPT, CAMPAIGN } = process.env;
const PAGE = 1000;
// Doi so nay MOI LAN sua file, de doi chieu ban dang chay tren GitLab.
const TOOL_VERSION = 'v8 (21/09/2026) - them Che do F: doi chieu log cac nguoi mo cao, tach luot GIA (trung khoanh khac) vs THAT (rieng le)';

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

// ts trong DB luu gio UTC (ghi bang new Date().toISOString() o api/email-track.js),
// mysql2 dateStrings:true tra ve "YYYY-MM-DD HH:MM:SS" KHONG co hau to "Z" nen
// new Date(chuoi do) se bi hieu NHAM la gio LOCAL cua may chay script (o day la
// container CI, thuong la UTC) thay vi UTC that -> hien thi sai gio-trong-ngay
// (BUG THAT DA XAY RA: mot dong "04:01" tuong bat thuong hoa ra la 11:01 gio VN
// that, hoan toan binh thuong - xem HANDOFF.md, dashboard da tung gap dung loi
// nay va sua bang ham fmtTime()/vnTime()). Ham nay lam dung cach do: ep "Z" vao
// truoc khi parse Date, roi quy doi hien thi sang gio Viet Nam (UTC+7).
// LUU Y: cac phep tinh KHOANG CACH (giay) giua 2 lan mo KHONG bi anh huong boi
// loi nay - do la HIEU SO giua 2 moc UTC, lech mui gio nhu nhau o ca 2 dau nen
// tu trieu tieu. Chi phan HIEN THI "may gio trong ngay" la sai, khong anh
// huong ket luan ve do DEU/KHONG DEU cua nhip mo.
function fmtVN(tsStr) {
  if (!tsStr) return tsStr;
  var iso = String(tsStr).replace(' ', 'T') + 'Z';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return tsStr;
  return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (giờ VN)';
}

// Ngay theo LICH VIET NAM (yyyy-mm-dd, UTC+7) - dung de dem "so ngay khac
// nhau" cho dung truc giac nguoi doc, tranh lech 1 ngay o cac moc gan nua dem
// UTC (vd 23:30 UTC = 06:30 SANG NGAY HOM SAU gio VN).
function vnDateKey(tsStr) {
  var iso = String(tsStr).replace(' ', 'T') + 'Z';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(tsStr).slice(0, 10);
  var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return parts; // en-CA format = yyyy-mm-dd
}

function matchesCampaign(row) {
  if (!CAMPAIGN) return true;
  return String(row.campaign || '').toLowerCase().indexOf(CAMPAIGN.toLowerCase()) > -1;
}

// CHE DO C — kiem dinh gia thuyet "mo tu iPhone phan lon la gia (Apple Mail
// Privacy Protection tu tai truoc anh, khong phai nguoi doc that)":
// So sanh TY LE CLICK giua nhom nguoi CHI co bang chung mo tu iPhone, nhom
// CHI mo tu may tinh (Outlook Desktop), va nhom ca 2. Neu gia thuyet MPP dung,
// ty le click cua nhom "chi iPhone" phai THAP HON HAN nhom "chi may tinh" -
// vi phan lon "mo" tren iPhone la Apple tu tai, khong di kem hanh vi doc/bam
// link that. Day la phep kiem chung KHACH QUAN bang so lieu, khong phai suy
// doan them.
// Kich hoat: dat bien UACHECK=1 (bat ky gia tri gi), khong dien RCPT.
function categorizeUA(ua) {
  if (/iPhone|iPad/i.test(ua)) return 'iphone';
  if (/ms-office|MSOffice|Trident|Microsoft Outlook/i.test(ua)) return 'desktop';
  if (/Android|Mobile/i.test(ua)) return 'android';
  return 'khac';
}

async function runUACheck() {
  console.log('=== CHE DO C: doi chieu UA cua lan MO voi ty le CLICK ' +
    (CAMPAIGN ? '(loc gan dung campaign chua "' + CAMPAIGN + '")' : '(toan bo DB)') + ' ===\n');
  const path = '/rest/v1/events?select=rcpt,campaign,pos,ua,ts&pos=in.(sent,top,click)&order=ts.asc';
  let rows = await fetchAll(path);
  rows = rows.filter(matchesCampaign);

  if (!rows.length) {
    console.log('Khong co du lieu top/click nao khop dieu kien.');
    await dbClient.end().catch(() => {});
    return;
  }

  const byRcpt = {};
  rows.forEach((r) => {
    if (!byRcpt[r.rcpt]) byRcpt[r.rcpt] = { openCats: new Set(), clicked: false, sentTs: null, firstTopTs: null, clickTs: [] };
    const g = byRcpt[r.rcpt];
    if (r.pos === 'sent' && !g.sentTs) g.sentTs = r.ts;
    if (r.pos === 'top') {
      g.openCats.add(categorizeUA(r.ua || ''));
      if (!g.firstTopTs) g.firstTopTs = r.ts; // rows da order=ts.asc nen lan dau gap la som nhat
    }
    if (r.pos === 'click') { g.clicked = true; g.clickTs.push(r.ts); }
  });

  // Kiem dinh gia thuyet "click gia do he thong quet link tu dong (Safe Links...)":
  // may quet khong can DOC noi dung email, chi can THAY link trong than mail la
  // bam thu - nen click cua no se xay ra RAT SOM sau "sent" (thuong vai giay den
  // vai phut, luc quet mail luc gui/nhan) HOAC xay ra TRUOC CA lan "top" dau
  // tien (nguoi that phai MO email moi thay duoc link de bam - khong the bam
  // link truoc khi mo). Neu thay 1 trong 2 dau hieu do -> click do CHAC CHAN
  // khong phai nguoi that bam (khong lien quan gi den UA/thiet bi, vi may quet
  // co the gia UA giong trinh duyet that).
  const clickers = Object.keys(byRcpt).filter((r) => byRcpt[r].clicked);
  if (clickers.length) {
    console.log('--- Chi tiet ' + clickers.length + ' nguoi co click: thu tu sent -> mo dau tien -> click ---');
    console.log('(⚠️ = click TRUOC lan mo dau tien, hoac click trong vong 120s sau sent - dau hieu quet tu dong, KHONG phai nguoi bam that)\n');
    clickers.forEach((rcpt) => {
      const g = byRcpt[rcpt];
      g.clickTs.forEach((ct) => {
        const sentMs = g.sentTs ? new Date(g.sentTs).getTime() : null;
        const topMs = g.firstTopTs ? new Date(g.firstTopTs).getTime() : null;
        const clickMs = new Date(ct).getTime();
        const clickBeforeOpen = topMs !== null && clickMs < topMs;
        const gapFromSentS = sentMs !== null ? Math.round((clickMs - sentMs) / 1000) : null;
        const suspicious = clickBeforeOpen || (gapFromSentS !== null && gapFromSentS >= 0 && gapFromSentS <= 120);
        console.log((suspicious ? '⚠️ ' : '   ') + rcpt +
          ' | sent=' + fmtVN(g.sentTs) +
          ' | mo_dau_tien=' + (g.firstTopTs ? fmtVN(g.firstTopTs) : '(khong co lan mo nao)') +
          ' | click=' + fmtVN(ct) +
          (gapFromSentS !== null ? ' | cach sent ' + gapFromSentS + 's' : '') +
          (clickBeforeOpen ? ' | CLICK TRUOC KHI MO' : ''));
      });
    });
    console.log('');
  }

  // Phan nhom: 'iphone' (CHI iphone/ipad, khong may tinh/android), 'desktop'
  // (CHI may tinh), 'mixed' (ca 2 loai tro len), 'khac' (chi loai khong xac
  // dinh duoc, vd android don le hoac UA la).
  const groups = { iphone: { n: 0, clicked: 0 }, desktop: { n: 0, clicked: 0 }, mixed: { n: 0, clicked: 0 }, khac: { n: 0, clicked: 0 } };
  Object.keys(byRcpt).forEach((rcpt) => {
    const g = byRcpt[rcpt];
    if (!g.openCats.size) return; // khong co lan "top" nao (chi co click ma khong co open - hiem, bo qua)
    const cats = Array.from(g.openCats);
    let key;
    if (cats.length > 1) key = 'mixed';
    else if (cats[0] === 'iphone') key = 'iphone';
    else if (cats[0] === 'desktop') key = 'desktop';
    else key = 'khac';
    groups[key].n++;
    if (g.clicked) groups[key].clicked++;
  });

  console.log('Nhom nguoi mo (theo loai thiet bi DUY NHAT tung thay o lan "top") | So nguoi | So nguoi co click | Ty le click');
  ['desktop', 'iphone', 'mixed', 'khac'].forEach((key) => {
    const g = groups[key];
    const pct = g.n > 0 ? Math.round((g.clicked / g.n) * 100) : 0;
    console.log(key.padEnd(10) + ' | ' + g.n + ' | ' + g.clicked + ' | ' + pct + '%');
  });

  console.log('\nDoc ket qua: neu ty le click nhom "iphone" THAP HON RO RET nhom "desktop"');
  console.log('(vd desktop 15% nhung iphone chi 1-2%) -> ung ho manh gia thuyet Apple Mail');
  console.log('Privacy Protection tu tai truoc anh tren iPhone, phan lon "mo" tren iPhone la GIA.');
  console.log('Neu 2 ty le xap xi nhau -> gia thuyet MPP KHONG du de giai thich, can xem lai.');

  await dbClient.end().catch(() => {});
}

// CHE DO D — kiem dinh gia thuyet "co he thong tu dong tai anh pixel NGAY KHI
// EMAIL VUA DEN hop thu, khong lien quan gi den click": neu dung, se thay RAT
// NHIEU nguoi co "lan mo DAU TIEN" chi vai giay/phut sau "sent" - bat ke ho co
// thuc su doc email hay khong. Day la phep kiem dinh CHO RIENG LUOT MO, khong
// dung click - dung yeu cau cua user (tach hoan toan khoi Che do C/click).
// Kich hoat: dat bien OPENTIME=1 (khong dien RCPT).
function bucketize(gapS) {
  if (gapS < 0) return 'am (top truoc sent - loi du lieu)';
  if (gapS <= 60) return '0-60 giay';
  if (gapS <= 300) return '1-5 phut';
  if (gapS <= 3600) return '5 phut-1 gio';
  if (gapS <= 86400) return '1 gio-1 ngay';
  if (gapS <= 604800) return '1 ngay-1 tuan';
  return 'tren 1 tuan';
}
const BUCKET_ORDER = ['0-60 giay', '1-5 phut', '5 phut-1 gio', '1 gio-1 ngay', '1 ngay-1 tuan', 'tren 1 tuan', 'am (top truoc sent - loi du lieu)'];

async function runOpenTiming(opts) {
  opts = opts || {};
  console.log('=== CHE DO D: phan bo khoang cach tu SENT den LAN MO DAU TIEN ' +
    (CAMPAIGN ? '(loc gan dung campaign chua "' + CAMPAIGN + '")' : '(toan bo DB)') + ' ===\n');
  // Lay them event_id: eid ma hoa dung THU TU GUI (eid0 + 0001, 0002, ...,
  // xem tools/CampaignTracker.bas), dung de kiem tra cac luot mo trong 1 dot
  // co LIEN TIEP nhau theo thu tu gui khong - xem runBurstCheck().
  const path = '/rest/v1/events?select=id:event_id,rcpt,campaign,pos,ts&pos=in.(sent,top)&order=ts.asc';
  let rows = await fetchAll(path);
  rows = rows.filter(matchesCampaign);

  if (!rows.length) {
    console.log('Khong co du lieu sent/top nao khop dieu kien.');
    if (!opts.keepConnection) await dbClient.end().catch(() => {});
    return;
  }

  const byRcpt = {};
  rows.forEach((r) => {
    if (!byRcpt[r.rcpt]) byRcpt[r.rcpt] = { sentTs: null, firstTopTs: null };
    const g = byRcpt[r.rcpt];
    if (r.pos === 'sent' && !g.sentTs) g.sentTs = r.ts;
    if (r.pos === 'top' && !g.firstTopTs) g.firstTopTs = r.ts;
  });

  const buckets = {};
  BUCKET_ORDER.forEach((b) => { buckets[b] = 0; });
  let nSent = 0, nSentAndOpened = 0, nSentNeverOpened = 0;
  Object.keys(byRcpt).forEach((rcpt) => {
    const g = byRcpt[rcpt];
    if (!g.sentTs) return; // bo qua nguoi chi co "top" ma khong co "sent" (session tao boi click, hiem)
    nSent++;
    if (!g.firstTopTs) { nSentNeverOpened++; return; }
    nSentAndOpened++;
    const gapS = Math.round((new Date(g.firstTopTs) - new Date(g.sentTs)) / 1000);
    buckets[bucketize(gapS)]++;
  });

  console.log('Tong nguoi co "sent": ' + nSent);
  console.log('Trong do CHUA TUNG mo lan nao: ' + nSentNeverOpened + ' (' + Math.round(nSentNeverOpened / nSent * 100) + '%)');
  console.log('Trong do DA mo it nhat 1 lan: ' + nSentAndOpened + ' (' + Math.round(nSentAndOpened / nSent * 100) + '%)\n');
  console.log('Phan bo khoang cach sent -> lan mo DAU TIEN (trong so ' + nSentAndOpened + ' nguoi da mo):');
  BUCKET_ORDER.forEach((b) => {
    if (buckets[b] === 0 && b === 'am (top truoc sent - loi du lieu)') return;
    const pct = nSentAndOpened > 0 ? Math.round(buckets[b] / nSentAndOpened * 100) : 0;
    console.log('  ' + b.padEnd(32) + ' | ' + String(buckets[b]).padStart(6) + ' nguoi | ' + pct + '%');
  });

  console.log('\nDoc ket qua: neu cum "0-60 giay" hoac "1-5 phut" chiem TY LE RAT CAO');
  console.log('(vd >30-40% tong so nguoi da mo) MOT CACH DONG DEU bat ke chien dich/thoi diem gui,');
  console.log('day la dau hieu manh cua 1 co che tu dong tai anh NGAY KHI GUI (quet bao mat, gateway...),');
  console.log('KHONG lien quan gi den viec nguoi nhan co thuc su doc email hay khong.');
  console.log('Neu phan bo trai deu qua nhieu khung gio/ngay (giong hanh vi doc that, ai doc luc nao doc)');
  console.log('thi phan lon la nguoi that, khong phai tu dong.');

  runBurstCheck(rows);
  runCommonPatternCheck(rows);

  if (!opts.keepConnection) await dbClient.end().catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────
// CHE DO F — DOI CHIEU TRUC TIEP LOG CUA NHUNG NGUOI MO CAO BAT THUONG:
// tim xem cac luot mo cua ho co gi GIONG NHAU. Neu la may sinh hang loat
// thi NHIEU NGUOI KHAC NHAU se co luot mo trung DUNG CUNG MOT KHOANH KHAC
// (chenh nhau vai giay). Nguoi that mo mail khong the trung khoanh khac
// voi hang chuc nguoi khac, lap di lap lai.
//
// Khac Che do E (dem so dot tren toan bo campaign), che do nay bam theo
// TUNG NGUOI: dem duoc bao nhieu luot mo cua ho la "trung khoanh khac voi
// nguoi khac" (= gan nhu chac chan do may) va bao nhieu la "rieng le"
// (= co the la mo that) -> ra duoc SO LUOT MO THAT UOC TINH cho tung nguoi.
function runCommonPatternCheck(rows) {
  const tops = rows.filter((r) => r.pos === 'top' && r.rcpt && r.ts)
    .map((r) => ({ rcpt: r.rcpt, ua: r.ua || '', ms: new Date(String(r.ts).replace(' ', 'T') + 'Z').getTime(), ts: r.ts }))
    .filter((r) => !isNaN(r.ms))
    .sort((a, b) => a.ms - b.ms);
  if (tops.length < 10) return;

  // Voi moi luot mo: dem so NGUOI NHAN KHAC NHAU co luot mo trong +/- 2 giay.
  // Dung DUNG tieu chi da duoc kiem chung tren du lieu that o Che do E:
  // tu 10 NGUOI NHAN KHAC NHAU tro len trong cung 60 giay. Muc nay da xac
  // dinh la bat kha thi voi nguoi that (du lieu that co toi 246 dot nhu vay,
  // dot manh nhat 90 nguoi/60 giay). Khong tu dat nguong moi.
  const NEAR_MS = 30000;   // +/- 30 giay = cua so 60 giay
  const MIN_SHARED = 10;
  let lo = 0, hi = 0;
  for (let i = 0; i < tops.length; i++) {
    while (tops[lo].ms < tops[i].ms - NEAR_MS) lo++;
    while (hi + 1 < tops.length && tops[hi + 1].ms <= tops[i].ms + NEAR_MS) hi++;
    const seen = new Set();
    for (let k = lo; k <= hi; k++) seen.add(tops[k].rcpt);
    tops[i].sharedWith = seen.size;
    tops[i].shared = seen.size >= MIN_SHARED;
  }

  const byRcpt = {};
  tops.forEach((t) => {
    if (!byRcpt[t.rcpt]) byRcpt[t.rcpt] = { total: 0, shared: 0, uas: new Set() };
    const g = byRcpt[t.rcpt];
    g.total++;
    if (t.shared) g.shared++;
    g.uas.add(t.ua);
  });

  const list = Object.keys(byRcpt).map((rcpt) => {
    const g = byRcpt[rcpt];
    return { rcpt, total: g.total, shared: g.shared, unique: g.total - g.shared, nUa: g.uas.size };
  }).sort((a, b) => b.total - a.total).slice(0, 15);

  console.log('\n' + '='.repeat(70) + '\n');
  console.log('=== CHE DO F: doi chieu log cua nhung nguoi mo cao nhat - cai gi GIONG NHAU? ===\n');
  console.log('Cach doc: "trung khoanh khac" = luot mo do nam trong 1 cua so 60 giay ma co TU 10');
  console.log('NGUOI NHAN KHAC NHAU tro len cung co luot mo. Day la nguong da kiem chung o Che do E:');
  console.log('nguoi that mo mail khong the dong bo kieu do, gan nhu chac chan do MAY sinh ra.\n');
  console.log('rcpt | tong luot mo | trung khoanh khac (GIA) | rieng le (co the THAT) | % gia');
  list.forEach((r) => {
    const pct = r.total > 0 ? Math.round(r.shared / r.total * 100) : 0;
    console.log('  ' + r.rcpt + ' | ' + r.total + ' | ' + r.shared + ' | ' + r.unique + ' | ' + pct + '%');
  });

  const totalAll = tops.length;
  const sharedAll = tops.filter((t) => t.shared).length;
  console.log('\nTOAN BO du lieu: ' + totalAll + ' luot mo, trong do ' + sharedAll +
    ' luot trung khoanh khac (' + Math.round(sharedAll / totalAll * 100) + '%), ' +
    (totalAll - sharedAll) + ' luot rieng le (' + Math.round((totalAll - sharedAll) / totalAll * 100) + '%).');

  // In vai VI DU khoanh khac bi trung nhieu nguoi nhat, kem danh sach nguoi
  // nhan - de nhin tan mat "cai gi giong nhau" giua cac log.
  const examples = tops.filter((t) => t.sharedWith >= 10)
    .sort((a, b) => b.sharedWith - a.sharedWith);
  const shownTs = new Set();
  let shown = 0;
  console.log('\n--- Vi du cac khoanh khac bi TRUNG nhieu nguoi nhat ---');
  for (const ex of examples) {
    const key = Math.floor(ex.ms / 60000);
    if (shownTs.has(key)) continue;
    shownTs.add(key);
    const names = tops.filter((t) => Math.abs(t.ms - ex.ms) <= NEAR_MS).map((t) => t.rcpt);
    const uniqNames = Array.from(new Set(names));
    console.log('\n  ' + fmtVN(ex.ts) + ' — ' + uniqNames.length + ' nguoi nhan khac nhau cung "mo" trong 60 giay:');
    console.log('    ' + uniqNames.slice(0, 12).join(', ') + (uniqNames.length > 12 ? ' ... (+' + (uniqNames.length - 12) + ' nguoi nua)' : ''));
    shown++;
    if (shown >= 3) break;
  }
  if (!shown) console.log('  (khong co khoanh khac nao bi trung tu 10 nguoi tro len)');

  console.log('\n=> Cot "rieng le" la uoc tinh SO LUOT MO THAT cua tung nguoi.');
  console.log('   Neu cot "trung khoanh khac" chiem phan lon -> so "Da mo" tren dashboard dang');
  console.log('   bi thoi phong dung bang so do, va co the tru ra de co so gan dung hon.');
}

// ─────────────────────────────────────────────────────────────────────────
// CHE DO E — PHEP KIEM TRA QUYET DINH cho gia thuyet "mo gia do ban luu
// trong Sent Items cua NGUOI GUI":
//
// Moi nguoi nhan co pixel rieng (eid rieng, xem tools/CampaignTracker.bas:
// eid = eid0 & Format(i, "0000")). Ban mail gui cho tung nguoi duoc luu vao
// Sent Items cua NGUOI GUI - KEM pixel mang eid cua CHINH nguoi nhan do.
// Vi vay MOI LAN nguoi GUI cuon qua/xem lai thu muc Sent Items, Outlook ve
// lai cac mail do -> pixel ban di -> he thong ghi nhan nham thanh "nguoi
// nhan X vua mo email".
//
// DAU HIEU QUYET DINH: neu dung la nguoi gui cuon Sent Items, se thay NHIEU
// NGUOI NHAN KHAC NHAU co luot mo DON CUC trong cung vai giay (cuon tu mail
// nay sang mail kia). Nguoi nhan that mo email thi KHONG co ly do gi de 20
// nguoi khac nhau cung mo trong vong 30 giay, lap di lap lai nhieu lan.
//
// Day la phep kiem tra NHANH NHAT: dung ngay du lieu da co, khong can gui
// mail test, khong can recall, khong can doi.
function runBurstCheck(rows) {
  const tops = rows.filter((r) => r.pos === 'top' && r.rcpt && r.ts)
    .map((r) => ({ rcpt: r.rcpt, id: r.id || '', ua: r.ua || '', ms: new Date(String(r.ts).replace(' ', 'T') + 'Z').getTime(), ts: r.ts }))
    .filter((r) => !isNaN(r.ms))
    .sort((a, b) => a.ms - b.ms);

  if (tops.length < 2) return;

  const WINDOW_MS = 60 * 1000; // cua so 60 giay
  const clusters = [];
  let lo = 0;
  for (let hi = 0; hi < tops.length; hi++) {
    while (tops[hi].ms - tops[lo].ms > WINDOW_MS) lo++;
    const seen = new Set();
    for (let k = lo; k <= hi; k++) seen.add(tops[k].rcpt);
    if (seen.size >= 3) {
      clusters.push({ startMs: tops[lo].ms, startTs: tops[lo].ts, nRcpt: seen.size, nEvent: hi - lo + 1, lo: lo, hi: hi });
    }
  }

  // Gom cac cua so chong lan nhau, chi giu dinh cao nhat cua tung dot
  const peaks = [];
  clusters.forEach((c) => {
    const last = peaks[peaks.length - 1];
    if (last && c.startMs - last.startMs <= WINDOW_MS * 2) {
      if (c.nRcpt > last.nRcpt) peaks[peaks.length - 1] = c;
    } else {
      peaks.push(c);
    }
  });
  peaks.sort((a, b) => b.nRcpt - a.nRcpt);

  console.log('\n' + '='.repeat(70) + '\n');
  console.log('=== CHE DO E: kiem tra "nhieu NGUOI NHAN KHAC NHAU cung mo trong 60 giay" ===\n');
  console.log('Y nghia: neu mot may (Outlook cua NGUOI GUI) cuon qua thu muc Sent Items,');
  console.log('pixel cua NHIEU NGUOI NHAN khac nhau se ban di don cuc trong vai giay.');
  console.log('Nguoi nhan that mo mail thi khong the dong bo kieu do.\n');

  if (!peaks.length) {
    console.log('KHONG tim thay dot nao co tu 3 nguoi nhan khac nhau tro len trong cung 60 giay.');
    console.log('=> KHONG ung ho gia thuyet "nguoi gui cuon Sent Items". Luot mo co ve phan tan tu nhien.');
    return;
  }

  const top10 = peaks.slice(0, 10);
  console.log('10 dot don cuc manh nhat (sap theo so NGUOI NHAN khac nhau trong 1 cua so 60 giay):');
  console.log('thoi diem bat dau | so NGUOI NHAN khac nhau | tong so su kien');
  top10.forEach((c) => {
    console.log('  ' + fmtVN(c.startTs) + ' | ' + c.nRcpt + ' nguoi | ' + c.nEvent + ' su kien');
  });

  // PHAN BIET CO CHE: event_id ma hoa THU TU GUI (eid0 + so thu tu 4 chu so).
  // Neu trong 1 dot, cac event_id LIEN TIEP nhau theo thu tu gui -> may dang
  // di TUAN TU qua danh sach mail cua chien dich (Sent Items cua nguoi gui,
  // hoac vong lap gui). Neu event_id RAI RAC ngau nhien -> khong phai di tuan
  // tu, co the la co che khac (quet hang loat phia server...).
  const probe = top10[0];
  if (probe && probe.lo !== undefined) {
    const ids = [];
    for (let k = probe.lo; k <= probe.hi; k++) if (tops[k].id) ids.push(String(tops[k].id));
    const suffixes = ids.map((s) => parseInt(s.slice(-4), 10)).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    if (suffixes.length >= 5) {
      let consecutive = 0;
      for (let k = 1; k < suffixes.length; k++) if (suffixes[k] - suffixes[k - 1] === 1) consecutive++;
      const pctConsec = Math.round(consecutive / (suffixes.length - 1) * 100);
      console.log('\n--- Kiem tra THU TU GUI trong dot manh nhat (' + fmtVN(probe.startTs) + ') ---');
      console.log('So thu tu gui (4 chu so cuoi cua event_id), da sap xep:');
      console.log('  ' + suffixes.slice(0, 40).join(', ') + (suffixes.length > 40 ? ' ... (+' + (suffixes.length - 40) + ' nua)' : ''));
      console.log('Ty le cap LIEN TIEP nhau (chenh dung 1 don vi): ' + pctConsec + '%');
      if (pctConsec >= 60) {
        console.log('=> LIEN TIEP RO RET: may dang di TUAN TU qua danh sach mail cua chien dich.');
        console.log('   Khop chinh xac voi gia thuyet Outlook cua NGUOI GUI ve lai cac ban luu Sent Items');
        console.log('   (hoac vong lap gui tu render) - KHONG phai nguoi nhan tu mo.');
      } else {
        console.log('=> KHONG lien tiep ro ret: may co the quet theo cach khac (khong theo thu tu gui).');
      }
    }
  }

  const maxRcpt = top10[0].nRcpt;
  const bigClusters = peaks.filter((p) => p.nRcpt >= 10).length;
  console.log('\nTong so dot co tu 10 nguoi nhan khac nhau tro len trong 60 giay: ' + bigClusters);
  console.log('Dot manh nhat: ' + maxRcpt + ' nguoi nhan khac nhau trong vong 60 giay.');
  if (maxRcpt >= 10) {
    console.log('\n=> KET LUAN: gan nhu CHAC CHAN co mot may tu dong ve lai hang loat mail.');
    console.log('   ' + maxRcpt + ' nguoi khac nhau khong the tu mo email trong cung 60 giay mot cach ngau nhien.');
    console.log('   Khop voi gia thuyet: Outlook cua NGUOI GUI ve lai cac ban luu trong Sent Items.');
    console.log('   Kiem chung cuoi cung: hoi nguoi gui campaign xem ho co mo/cuon thu muc Sent Items');
    console.log('   vao dung cac thoi diem liet ke o tren khong.');
  } else {
    console.log('\n=> Chua du manh de ket luan. Cac dot chi gom vai nguoi, co the trung hop that.');
  }
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

  // In SO PHIEN BAN ngay dau log: da nhieu lan chay that bai vi file tren
  // GitLab con la ban cu (Replace nham file trong thu muc Downloads). Nhin
  // dong nay la biet ngay dang chay ban nao, khong phai doan.
  console.log('>>> db_inspect_opens ' + TOOL_VERSION + '\n');

  const sel = 'pos,campaign,ua,ts';

  if (!RCPT && process.env.UACHECK) {
    return runUACheck();
  }

  // Khong con doi bien OPENTIME: phan tich thoi diem mo (Che do D) chay TU
  // DONG truoc bang TOP 20 (Che do B) trong CUNG 1 lan chay. Ly do: qua nhieu
  // lan chay bi that bai chi vi bien CI khong duoc dien/khong duoc nhan - bo
  // han phu thuoc vao bien la cach chac chan nhat.
  if (!RCPT) {
    await runOpenTiming({ keepConnection: true });
    console.log('\n' + '='.repeat(70) + '\n');
  }

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
        console.log(fmtVN(r.ts) + '  ' + String(r.pos).padEnd(6) + '  campaign=' + (r.campaign || '') + '  ua="' + (r.ua || '') + '"' + gapNote);
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
    const path = '/rest/v1/events?select=rcpt,' + encodeURIComponent(sel) + '&pos=eq.top&order=ts.asc';
    let rows = await fetchAll(path);
    rows = rows.filter(matchesCampaign);

    if (!rows.length) {
      console.log('Khong co du lieu pos=top nao khop dieu kien.');
    } else {
      // Giu nguyen TOAN BO ts (khong chi min/max) cho tung rcpt de tinh luon do
      // DEU DAN cua nhip mo trong CHINH lan chay nay - tranh phai chay rieng
      // Che do A cho tung nguoi nghi ngo (cham + de sot). Vi rows da order=
      // ts.asc nen list ts cua tung rcpt tu nhien da sap xep, khong can sort lai.
      const byRcpt = {};
      rows.forEach((r) => {
        if (!byRcpt[r.rcpt]) byRcpt[r.rcpt] = { uaSet: new Set(), daySet: new Set(), tsList: [] };
        const g = byRcpt[r.rcpt];
        g.uaSet.add(r.ua || '');
        g.daySet.add(vnDateKey(r.ts)); // ngay theo lich VN, khong phai ngay UTC (xem ham fmtVN)
        g.tsList.push(r.ts);
      });

      // Do DEU DAN nhip mo: he so bien thien (stddev/mean) cua khoang cach giua
      // cac lan mo lien tiep. He so THAP (gan 0) = khoang cach GAN NHU BANG
      // NHAU tuyet doi -> dac trung ro ret cua may/gateway tu dong (con nguoi
      // khong doc lai email theo dung chu ky co dinh). He so CAO = khoang cach
      // that thuong -> giong hanh vi nguoi that hon.
      function gapStats(tsList) {
        if (tsList.length < 3) return null; // can >=2 khoang cach de tinh do bien thien
        const gaps = [];
        for (let i = 1; i < tsList.length; i++) {
          gaps.push((new Date(tsList[i]) - new Date(tsList[i - 1])) / 1000);
        }
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        if (mean <= 0) return null;
        const variance = gaps.reduce((a, b) => a + (b - mean) * (b - mean), 0) / gaps.length;
        const cv = Math.sqrt(variance) / mean;
        return { meanGapS: Math.round(mean), cv };
      }

      const list = Object.keys(byRcpt).map((rcpt) => {
        const g = byRcpt[rcpt];
        const gs = gapStats(g.tsList);
        return {
          rcpt, n: g.tsList.length, nUa: g.uaSet.size, nDays: g.daySet.size,
          first: g.tsList[0], last: g.tsList[g.tsList.length - 1], gapStats: gs,
        };
      }).sort((a, b) => b.n - a.n).slice(0, 20);

      console.log('Tong so nguoi co it nhat 1 lan mo (khop dieu kien): ' + Object.keys(byRcpt).length + '\n');
      console.log('rcpt | so_lan_top | so_UA_khac_nhau | so_ngay_khac_nhau | lan_dau | lan_cuoi | nhip_mo_TB(s) | do_deu(cv) | KET LUAN');
      list.forEach((r) => {
        const burst = r.n >= 15 && r.nDays <= 2;
        let verdict, meanS = '-', cv = '-';
        if (r.gapStats) {
          meanS = r.gapStats.meanGapS;
          cv = r.gapStats.cv.toFixed(2);
          if (r.nUa <= 1 && r.gapStats.cv < 0.25) {
            verdict = 'RAT CO THE TU DONG (1 UA, nhip deu - dac trung mail client/gateway tu tai lai)';
          } else if (burst) {
            verdict = 'NGHI NGO (don dap trong it ngay, nhip khong deu ro ret - can xem raw event)';
          } else {
            verdict = 'CO THE MO THAT (UA/nhip da dang, trai nhieu ngay)';
          }
        } else {
          verdict = burst ? 'NGHI NGO (qua it diem du lieu de do do deu, can xem raw event)' : 'CO THE MO THAT';
        }
        console.log(r.rcpt + ' | ' + r.n + ' | ' + r.nUa + ' | ' + r.nDays + ' | ' + fmtVN(r.first) + ' | ' + fmtVN(r.last) + ' | ' + meanS + ' | ' + cv + ' | ' + verdict);
      });
      console.log('\nKET LUAN chi la GOI Y tu heuristic (nguong/cong thuc chua qua kiem chung dai han) -');
      console.log('dong "NGHI NGO"/CO THE MO THAT van nen doi chieu them neu can chac chan tuyet doi.');
      console.log('Chi chay lai job nay voi bien RCPT=<email> (Che do A) khi can xem TUNG DONG raw event that.');
    }
  }

  await dbClient.end().catch(() => {});
}

main().catch((err) => {
  console.error('LOI:', err.code || '(no code)', '-', err.message);
  process.exit(1);
});
