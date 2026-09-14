// Xoá THẬT dữ liệu test khỏi bảng `events` — chạy từ job `db_cleanup_test`
// trong .gitlab-ci.yml (when: manual, bấm nút trên GitLab). Dùng khi người vận
// hành không có quyền truy cập trực tiếp database: CI đã có sẵn MYSQL_* trong
// CI/CD Variables, chỉ cần bấm chạy job.
//
// AN TOÀN — MẶC ĐỊNH CHỈ XEM, KHÔNG XOÁ:
//   - Chạy không có biến gì  -> chỉ liệt kê campaign test + số dòng sẽ xoá.
//   - Muốn xoá thật          -> chạy job với biến CONFIRM_DELETE=XOA.
//   - Muốn xoá đúng vài cái  -> thêm ONLY_CAMPAIGNS="ten-1,ten-2" (tên chính xác
//                               như trong cột campaign, không cần chuẩn hoá).
//
// Quy tắc nhận diện campaign test GIỮ GIỐNG dashboard (api/email-dashboard.js,
// hàm isHiddenCampaign) để hai bên không lệch nhau: tên sau khi bỏ dấu cách/gạch
// nối/dấu chấm mà bắt đầu bằng "test", hoặc nằm trong HIDDEN_EXACT dưới đây.
const mysql = require('mysql2/promise');

const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE,
        CONFIRM_DELETE, ONLY_CAMPAIGNS, EMAIL_HIDDEN_CAMPAIGNS, EMAIL_HIDE_TEST_PREFIX } = process.env;

if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD) {
  console.error('Thieu MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD trong CI/CD Variables.');
  process.exit(1);
}
if (!MYSQL_DATABASE) {
  console.error('Thieu MYSQL_DATABASE trong CI/CD Variables - khong biet xoa o schema nao.');
  process.exit(1);
}

const HIDE_TEST_PREFIX = EMAIL_HIDE_TEST_PREFIX !== '0';
const HIDDEN_EXACT = (EMAIL_HIDDEN_CAMPAIGNS != null
  ? EMAIL_HIDDEN_CAMPAIGNS.split(',')
  : [
      'TEST-BUFFER-FIX-KHONG-XOA-DUOC-TU-DONG',
      'Thong Bao Test Vui Long Bo Qua V2',
    ]
).map(normCamp).filter(Boolean);

function normCamp(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isTestCampaign(name) {
  const n = normCamp(name);
  if (!n) return false;
  if (HIDE_TEST_PREFIX && n.indexOf('test') === 0) return true;
  return HIDDEN_EXACT.indexOf(n) > -1;
}

async function main() {
  const conn = await mysql.createConnection({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT) || 3306,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    connectTimeout: 10000,
  });

  const [before] = await conn.query('SELECT COUNT(*) AS n FROM `events`');
  console.log('Tong so dong trong bang events truoc khi xoa: ' + before[0].n);

  // Gom theo campaign + dem so dong, roi loc bang dung quy tac cua dashboard.
  const [groups] = await conn.query(
    'SELECT campaign, COUNT(*) AS n FROM `events` GROUP BY campaign ORDER BY n DESC'
  );

  let targets;
  if (ONLY_CAMPAIGNS) {
    const wanted = ONLY_CAMPAIGNS.split(',').map((s) => s.trim()).filter(Boolean);
    targets = groups.filter((g) => wanted.indexOf(g.campaign) > -1);
    console.log('\nChe do ONLY_CAMPAIGNS: chi xu ly ' + wanted.length + ' ten duoc chi dinh.');
    const missing = wanted.filter((w) => !groups.some((g) => g.campaign === w));
    if (missing.length) console.log('KHONG TIM THAY trong DB: ' + missing.join(' | '));
  } else {
    targets = groups.filter((g) => isTestCampaign(g.campaign));
  }

  if (!targets.length) {
    console.log('\nKhong co campaign test nao khop - khong co gi de xoa.');
    await conn.end();
    return;
  }

  const totalRows = targets.reduce((a, g) => a + g.n, 0);
  console.log('\n--- CAMPAIGN TEST KHOP (' + targets.length + ' campaign / ' + totalRows + ' dong) ---');
  targets.forEach((g) => console.log(String(g.n).padStart(8) + ' dong  |  ' + g.campaign));

  // Liet ke campaign GIU LAI de doi chieu truoc khi xoa - tranh xoa nham.
  const keep = groups.filter((g) => targets.indexOf(g) === -1);
  console.log('\n--- GIU LAI (' + keep.length + ' campaign) ---');
  keep.slice(0, 30).forEach((g) => console.log(String(g.n).padStart(8) + ' dong  |  ' + g.campaign));
  if (keep.length > 30) console.log('  ... va ' + (keep.length - 30) + ' campaign khac');

  if (CONFIRM_DELETE !== 'XOA') {
    console.log('\n==========================================================');
    console.log('CHE DO XEM TRUOC - CHUA XOA GI CA.');
    console.log('Kiem tra ky 2 danh sach tren. Neu dung, chay lai job nay voi');
    console.log('bien:  CONFIRM_DELETE = XOA');
    console.log('==========================================================');
    await conn.end();
    return;
  }

  const names = targets.map((g) => g.campaign);
  const [res] = await conn.query('DELETE FROM `events` WHERE campaign IN (?)', [names]);
  const [after] = await conn.query('SELECT COUNT(*) AS n FROM `events`');
  console.log('\nDA XOA ' + res.affectedRows + ' dong.');
  console.log('Tong so dong con lai: ' + after[0].n + ' (truoc: ' + before[0].n + ')');

  await conn.end();
}

main().catch((err) => {
  console.error('LOI:', err.code || '(no code)', '-', err.message);
  process.exit(1);
});
