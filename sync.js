'use strict';
/*
 * Build tĩnh cho GitLab CI/CD Schedule (§3.2, §4 kế hoạch): gọi lại đúng handler
 * hiện có của mỗi route (không sửa code trong api/*.js) với req/res giả lập, chụp
 * lại HTML trả về, ghi ra dist/ để nginx phục vụ như file tĩnh — không có DB/secret
 * nào lộ ra ở tầng phục vụ trang.
 *
 * Route KHÔNG bake tĩnh: /api/track, /api/ingest (đã tách sang server/ingest-server.js,
 * là service Node chạy thường trực vì cần ghi DB theo thời gian thực).
 *
 * TODO (mở, cần quyết định trước khi migrate DB thật): api/*-dashboard.js hiện đọc
 * dữ liệu qua Supabase PostgREST (`sbGet`/`https.request` tới /rest/v1/...). DB nội bộ
 * SHB là schema MySQL (kế hoạch §6 câu 1), không có PostgREST. Cần 1 trong 2:
 *   (a) dựng PostgREST trỏ vào DB nội bộ (nếu DB nội bộ thực chất là Postgres), hoặc
 *   (b) viết lại các hàm `sbGet`/`loadData()` trong từng api/*-dashboard.js dùng driver
 *       MySQL/Postgres trực tiếp thay vì gọi REST.
 * sync.js không tự quyết việc này — chỉ cần các handler tiếp tục export
 * `module.exports = async (req,res) => { ... res.end(html) }` là gọi được, không quan
 * trọng bên trong đọc DB bằng cách nào.
 */
const fs = require('fs');
const path = require('path');
const { wrap } = require('./server/vercel-compat');

const ROUTES = [
  { file: './api/portal.js', out: 'index.html' },
  { file: './api/fb-dashboard.js', out: 'api/facebook.html' },
  { file: './api/email-dashboard.js', out: 'api/email.html' },
  { file: './api/leader-dashboard.js', out: 'api/leader.html' },
];

const OUT_DIR = path.join(__dirname, 'dist');

function fakeReq(url) {
  return Object.assign(
    require('stream').Readable.from([]),
    { method: 'GET', url, headers: {} }
  );
}

function captureRes() {
  const chunks = [];
  const res = {
    statusCode: 200,
    headersSent: false,
    _headers: {},
    setHeader(k, v) { this._headers[k] = v; },
    writeHead(code, headers) { this.statusCode = code; if (headers) Object.assign(this._headers, headers); this.headersSent = true; },
    end(chunk) { if (chunk) chunks.push(Buffer.from(chunk)); this._done = true; },
    write(chunk) { chunks.push(Buffer.from(chunk)); },
  };
  res.getBody = () => Buffer.concat(chunks).toString('utf8');
  return res;
}

async function buildOne({ file, out }) {
  const handler = wrap(require(path.join(__dirname, file)));
  const req = fakeReq('/');
  const res = captureRes();
  await handler(req, res);
  const body = res.getBody();
  if (!body) throw new Error(`Handler ${file} không trả nội dung nào (kiểm tra loadData()/DB env)`);
  const outPath = path.join(OUT_DIR, out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body);
  console.log(`[sync] ${file} -> dist/${out} (${body.length} bytes)`);
}

async function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const route of ROUTES) {
    await buildOne(route);
  }
  console.log('[sync] done.');
}

main().catch((e) => {
  console.error('[sync] FAILED:', e && e.stack || e);
  process.exit(1);
});
