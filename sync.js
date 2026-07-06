// ============================================================
// SHB CM Dashboard — sync.js hợp nhất (v4)
// Phần 1: Jira Direct (copy nguyên từ cm-dashboard v3, KHÔNG sửa logic)
//         -> public/api/jira/data.json
// Phần 2: Email + Facebook (gọi lại handler api/*.js qua vercel-compat)
//         -> public/index.html (portal 3 tab), public/api/facebook.html,
//            public/api/email.html, public/api/leader.html
// Chạy trong GitLab CI/CD scheduled job (stage sync_data).
// ============================================================

'use strict';
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');

// ────────────────────────────────────────────────────────────
// PHẦN 1 — JIRA (copy nguyên từ cm-dashboard/sync.js v3, không đổi logic)
// ────────────────────────────────────────────────────────────
const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_TOKEN = process.env.JIRA_TOKEN;
const JIRA_PROJECT = process.env.JIRA_PROJECT || 'CM';
const JIRA_OUTPUT = path.join(PUBLIC_DIR, 'api/jira/data.json');

const HANG_MUC_PATTERNS = [
  "ke hoach quan ly thay doi tong quan", "ke hoach quan ly stakeholder", "ke hoach quan ly khang cu",
  "ke hoach chuyen giao ve bau", "ke hoach truyen thong", "ke hoach dao tao",
  "ban tin nhip dap chuyen doi", "ban tin tam diem", "ban tin shb new", "ban tin du an",
  "post facebook", "post teams",
  "bang ma loi va huong dan luong xu ly", "q&a huong dan xu ly tinh huong", "to trinh dao tao",
  "to chuc dao tao", "tai lieu dao tao", "tai lieu hdsd",
  "kich ban ho tro khach hang",
  "theo doi hanh vi nguoi dung tren cac kenh", "quan ly kenh phan hoi nguoi dung",
  "quan ly stakeholder khoi", "quan ly hieu qua cong viec team cm",
  "danh gia muc do thay doi cua stakeholder va ke hoach trien khai tiep theo",
  "phan tich tac dong", "danh gia du lieu",
  "bao cao chuyen giao", "bao cao ket qua",
  "hub", "sitevisit", "khao sat", "q&a", "xay dung kich ban", "to chuc su kien",
  "len ke hoach", "bao cao", "tai lieu", "quy trinh", "truyen thong", "dao tao",
  "khac"
];

const HANG_MUC_STANDARDS = [
  "Kế hoạch quản lý thay đổi tổng quan", "Kế hoạch quản lý stakeholder", "Kế hoạch quản lý kháng cự",
  "Kế hoạch chuyển giao về BAU", "Kế hoạch truyền thông", "Kế hoạch đào tạo",
  "Bản tin nhịp đập chuyển đổi", "Bản tin tâm điểm", "Bản tin SHB New", "Bản tin dự án",
  "Post Facebook", "Post Teams",
  "Bảng mã lỗi và hướng dẫn luồng xử lý", "Q&A hướng dẫn xử lý tình huống", "Tờ trình đào tạo",
  "Tổ chức đào tạo", "Tài liệu đào tạo", "Tài liệu hdsd",
  "Kịch bản hỗ trợ khách hàng",
  "Theo dõi hành vi người dùng trên các kênh", "Quản lý kênh phản hồi người dùng",
  "Quản lý Stakeholder khối", "Quản lý hiệu quả công việc team CM",
  "Đánh giá mức độ thay đổi của Stakeholder và kế hoạch triển khai tiếp theo",
  "Phân tích tác động", "Đánh giá dữ liệu",
  "Báo cáo chuyển giao", "Báo cáo kết quả",
  "Hub", "Sitevisit", "Khảo sát", "Q&A", "Xây dựng kịch bản", "Tổ chức sự kiện",
  "Lên kế hoạch", "Báo cáo", "Tài liệu", "Quy trình", "Truyền thông", "Đào tạo",
  "Khác"
];

function removeDiacritics(str) {
  if (!str) return "";
  return str.toLowerCase()
    .replace(/[àáâãäåăạảấầẩẫậắằẳẵặ]/g, "a")
    .replace(/[èéêëẹẻẽếềểễệ]/g, "e")
    .replace(/[ìíîïịỉĩ]/g, "i")
    .replace(/[òóôõöøơọỏốồổỗộớờởỡợ]/g, "o")
    .replace(/[ùúûüưụủũứừửữựụ]/g, "u")
    .replace(/[ýỳỵỷỹ]/g, "y")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ").trim();
}

function normalizeHangMuc(raw) {
  if (!raw) return "";
  const n = removeDiacritics(raw);
  for (let i = 0; i < HANG_MUC_PATTERNS.length; i++) {
    if (n.indexOf(HANG_MUC_PATTERNS[i]) !== -1) return HANG_MUC_STANDARDS[i];
  }
  return raw;
}

function detectLoai(epicName) {
  if (!epicName) return "Khac";
  const n = removeDiacritics(epicName);
  if (n.indexOf("squad") === 0) return "Squad";
  if (n.indexOf("du an") === 0) return "Du_an";
  if (n.indexOf("van hoa") === 0) return "Van_hoa";
  return "Khac";
}

function isSubtask(wt) {
  const w = (wt || "").toLowerCase();
  return w === "sub-task" || w === "subtask" || w === "sub task";
}

function isTask(wt) {
  const w = (wt || "").toLowerCase();
  return w === "task" || w === "story" || w === "bug";
}

function parseDate(val) {
  return val ? String(val).substring(0, 10) : null;
}

async function fetchAllIssues() {
  const JIRA_AUTH = 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
  const JIRA_URL = `https://${JIRA_DOMAIN}/rest/api/3/search/jql`;
  const FIELDS = ['summary', 'issuetype', 'status', 'assignee', 'duedate', 'created', 'updated', 'labels', 'parent'];

  const all = [];
  let nextPageToken = undefined;
  let page = 0;

  do {
    page++;
    const body = { jql: `project = ${JIRA_PROJECT} ORDER BY created ASC`, fields: FIELDS, maxResults: 100 };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const resp = await fetch(JIRA_URL, {
      method: 'POST',
      headers: { 'Authorization': JIRA_AUTH, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Jira API HTTP ${resp.status}: ${txt.substring(0, 300)}`);
    }

    const json = await resp.json();
    const issues = json.issues || [];
    all.push(...issues);
    nextPageToken = json.nextPageToken || null;
    console.log(`[Jira] Page ${page}: ${issues.length} issues (tổng: ${all.length})`);
  } while (nextPageToken);

  return all;
}

function buildEpicMap(issues) {
  const infoMap = {};
  for (const iss of issues) {
    const f = iss.fields;
    infoMap[iss.key] = { summary: f.summary || '', workType: f.issuetype?.name || '', parentKey: f.parent?.key || '' };
  }

  const epicMap = {};
  for (const key in infoMap) {
    const info = infoMap[key];
    const wt = info.workType;

    if (wt === 'Epic') {
      epicMap[key] = info.summary;
    } else if (isTask(wt)) {
      const pKey = info.parentKey;
      epicMap[key] = (pKey && infoMap[pKey]) ? infoMap[pKey].summary : '';
    } else if (isSubtask(wt)) {
      const taskKey = info.parentKey;
      if (taskKey && infoMap[taskKey]) {
        const epicKey = infoMap[taskKey].parentKey;
        epicMap[key] = (epicKey && infoMap[epicKey]) ? infoMap[epicKey].summary : infoMap[taskKey].summary;
      } else {
        epicMap[key] = '';
      }
    } else {
      const pKey = info.parentKey;
      epicMap[key] = (pKey && infoMap[pKey]) ? infoMap[pKey].summary : '';
    }
  }
  return epicMap;
}

function transformIssues(issues, epicMap) {
  return issues.map(iss => {
    const f = iss.fields;
    const workType = f.issuetype?.name || '';
    const epicName = epicMap[iss.key] || '';
    const summary = f.summary || '';
    const parentSum = f.parent?.fields?.summary || '';

    const loai = detectLoai(epicName);
    const doiTuong = workType === 'Epic' ? summary : epicName;
    const hangMuc = isTask(workType) ? summary : isSubtask(workType) ? parentSum : '';
    const hangMucChuan = normalizeHangMuc(hangMuc);
    const hangMucCon = isSubtask(workType) ? summary : '';
    const nhom = (f.labels || []).join(', ');

    return {
      key: iss.key, work_type: workType, loai, doi_tuong: doiTuong, nhom,
      hang_muc: hangMuc, hang_muc_chuan: hangMucChuan, hang_muc_con: hangMucCon,
      status: f.status?.name || '', assignee: f.assignee?.displayName || 'Unassigned',
      due: parseDate(f.duedate), created: parseDate(f.created), updated: parseDate(f.updated), note: ''
    };
  });
}

async function syncJira() {
  if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_TOKEN) {
    console.warn('[Jira] Thiếu JIRA_DOMAIN/JIRA_EMAIL/JIRA_TOKEN — bỏ qua phần Jira.');
    return;
  }
  console.log('=== [Jira] Sync (Jira Direct) ===');
  console.log(`[Jira] Domain: ${JIRA_DOMAIN} | Project: ${JIRA_PROJECT}`);

  const issues = await fetchAllIssues();
  console.log(`[Jira] Tổng: ${issues.length} issues`);
  if (issues.length === 0) console.warn('[Jira] Không có issue nào — kiểm tra JIRA_PROJECT và quyền token');

  const epicMap = buildEpicMap(issues);
  const data = transformIssues(issues, epicMap);

  const loaiCounts = {};
  data.forEach(d => { loaiCounts[d.loai] = (loaiCounts[d.loai] || 0) + 1; });
  console.log('[Jira] Loai:', JSON.stringify(loaiCounts));

  fs.mkdirSync(path.dirname(JIRA_OUTPUT), { recursive: true });
  const output = { lastSync: new Date().toISOString(), count: data.length, loaiCounts, data };
  fs.writeFileSync(JIRA_OUTPUT, JSON.stringify(output), 'utf8');
  const kb = (fs.statSync(JIRA_OUTPUT).size / 1024).toFixed(1);
  console.log(`[Jira] Done: ${JIRA_OUTPUT} — ${data.length} issues, ${kb} KB`);
}

// ────────────────────────────────────────────────────────────
// PHẦN 2 — EMAIL + FACEBOOK (bake tĩnh qua handler api/*.js hiện có)
// ────────────────────────────────────────────────────────────
const { wrap } = require('./server/vercel-compat');

const ROUTES = [
  { file: './api/portal.js', out: 'index.html' },
  { file: './api/fb-dashboard.js', out: 'api/facebook.html' },
  { file: './api/email-dashboard.js', out: 'api/email.html' },
  { file: './api/leader-dashboard.js', out: 'api/leader.html' },
];

function fakeReq(url) {
  return Object.assign(require('stream').Readable.from([]), { method: 'GET', url, headers: {} });
}

function captureRes() {
  const chunks = [];
  const res = {
    statusCode: 200, headersSent: false, _headers: {},
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
  const outPath = path.join(PUBLIC_DIR, out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body);
  console.log(`[sync] ${file} -> public/${out} (${body.length} bytes)`);
}

async function syncEmailFacebook() {
  console.log('=== [Email/Facebook] Sync (MySQL nội bộ hoặc Supabase fallback) ===');
  for (const route of ROUTES) {
    await buildOne(route);
  }
}

// ────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  await syncJira();
  await syncEmailFacebook();
  console.log('[sync] done.');
}

main().catch((e) => {
  console.error('\n[FATAL]', e && e.message);
  if (e && e.message && e.message.includes('401')) console.error('[Hint] Sai JIRA_EMAIL hoặc JIRA_TOKEN');
  if (e && e.message && e.message.includes('403')) console.error('[Hint] Token không có quyền đọc project này');
  if (e && e.message && e.message.includes('404')) console.error('[Hint] JIRA_PROJECT sai hoặc JIRA_DOMAIN sai');
  process.exit(1);
});
