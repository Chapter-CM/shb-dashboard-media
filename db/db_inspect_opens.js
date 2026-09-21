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

async function runOpenTiming() {
  console.log('=== CHE DO D: phan bo khoang cach tu SENT den LAN MO DAU TIEN ' +
    (CAMPAIGN ? '(loc gan dung campaign chua "' + CAMPAIGN + '")' : '(toan bo DB)') + ' ===\n');
  const path = '/rest/v1/events?select=rcpt,campaign,pos,ts&pos=in.(sent,top)&order=ts.asc';
  let rows = await fetchAll(path);
  rows = rows.filter(matchesCampaign);

  if (!rows.length) {
    console.log('Khong co du lieu sent/top nao khop dieu kien.');
    await dbClient.end().catch(() => {});
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

  await dbClient.end().catch(() => {});
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

  if (!RCPT && process.env.UACHECK) {
    return runUACheck();
  }
  if (!RCPT && process.env.OPENTIME) {
    return runOpenTiming();
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
