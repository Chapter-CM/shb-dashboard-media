// ============================================================
// SHB CM Dashboard — sync.js v3
// Gọi thẳng Jira REST API → buildEpicMap + transform → data.json
// Chạy trong GitLab CI/CD scheduled job
// ============================================================

'use strict';
const fs = require('fs');

// ── ENV VARS (GitLab CI/CD Variables) ────────────────────────────────────────
const JIRA_DOMAIN  = process.env.JIRA_DOMAIN;
const JIRA_EMAIL   = process.env.JIRA_EMAIL;
const JIRA_TOKEN   = process.env.JIRA_TOKEN;
const JIRA_PROJECT = process.env.JIRA_PROJECT || 'CM';
const OUTPUT       = 'public/data.json';

if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_TOKEN) {
  console.error('[Error] Thiếu biến môi trường: JIRA_DOMAIN, JIRA_EMAIL, JIRA_TOKEN');
  process.exit(1);
}

const JIRA_AUTH = 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
const JIRA_URL  = `https://${JIRA_DOMAIN}/rest/api/3/search/jql`;
const FIELDS    = ['summary','issuetype','status','assignee','duedate','created','updated','labels','parent'];

// ── HANG MUC PATTERNS ────────────────────────────────────────────────────────
// Quy tắc thứ tự: cụ thể (dài) trước, chung (ngắn) sau, "khac" cuối cùng
// Nếu đổi thứ tự → kết quả mapping thay đổi
const HANG_MUC_PATTERNS = [

  // ── Kế hoạch (specific → general) ────────────────────────────────────────
  "ke hoach quan ly thay doi tong quan",   // phải trước "ke hoach quan ly thay doi"
  "ke hoach quan ly stakeholder",
  "ke hoach quan ly khang cu",
  "ke hoach chuyen giao ve bau",           // phải trước "len ke hoach"
  "ke hoach truyen thong",                 // phải trước "truyen thong"
  "ke hoach dao tao",                      // phải trước "dao tao"

  // ── Bản tin (specific → general) ─────────────────────────────────────────
  "ban tin nhip dap chuyen doi",
  "ban tin tam diem",
  "ban tin shb new",
  "ban tin du an",

  // ── Post ─────────────────────────────────────────────────────────────────
  "post facebook",
  "post teams",

  // ── Đào tạo (specific → general) ─────────────────────────────────────────
  "bang ma loi va huong dan luong xu ly",
  "q&a huong dan xu ly tinh huong",        // phải trước "q&a"
  "to trinh dao tao",                      // phải trước "dao tao"
  "to chuc dao tao",                       // phải trước "dao tao"
  "tai lieu dao tao",                      // phải trước "tai lieu" và "dao tao"
  "tai lieu hdsd",                         // phải trước "tai lieu"

  // ── Kịch bản (specific → general) ────────────────────────────────────────
  "kich ban ho tro khach hang",            // phải trước "xay dung kich ban"

  // ── Theo dõi / Quản lý (specific) ────────────────────────────────────────
  "theo doi hanh vi nguoi dung tren cac kenh",
  "quan ly kenh phan hoi nguoi dung",
  "quan ly stakeholder khoi",
  "quan ly hieu qua cong viec team cm",

  // ── Đánh giá / Phân tích ─────────────────────────────────────────────────
  "danh gia muc do thay doi cua stakeholder va ke hoach trien khai tiep theo",
  "phan tich tac dong",
  "danh gia du lieu",

  // ── Báo cáo (specific → general) ─────────────────────────────────────────
  "bao cao chuyen giao",                   // phải trước "bao cao"
  "bao cao ket qua",                       // phải trước "bao cao"

  // ── General (sau tất cả specific) ────────────────────────────────────────
  "hub",
  "sitevisit",
  "khao sat",
  "q&a",
  "xay dung kich ban",
  "to chuc su kien",
  "len ke hoach",
  "bao cao",
  "tai lieu",
  "quy trinh",
  "truyen thong",
  "dao tao",

  // ── Catch-all ─────────────────────────────────────────────────────────────
  "khac"
];

const HANG_MUC_STANDARDS = [

  // ── Kế hoạch ──────────────────────────────────────────────────────────────
  "Kế hoạch quản lý thay đổi tổng quan",
  "Kế hoạch quản lý stakeholder",
  "Kế hoạch quản lý kháng cự",
  "Kế hoạch chuyển giao về BAU",
  "Kế hoạch truyền thông",
  "Kế hoạch đào tạo",

  // ── Bản tin ───────────────────────────────────────────────────────────────
  "Bản tin nhịp đập chuyển đổi",
  "Bản tin tâm điểm",
  "Bản tin SHB New",
  "Bản tin dự án",

  // ── Post ──────────────────────────────────────────────────────────────────
  "Post Facebook",
  "Post Teams",

  // ── Đào tạo ───────────────────────────────────────────────────────────────
  "Bảng mã lỗi và hướng dẫn luồng xử lý",
  "Q&A hướng dẫn xử lý tình huống",
  "Tờ trình đào tạo",
  "Tổ chức đào tạo",
  "Tài liệu đào tạo",
  "Tài liệu hdsd",

  // ── Kịch bản ──────────────────────────────────────────────────────────────
  "Kịch bản hỗ trợ khách hàng",

  // ── Theo dõi / Quản lý ───────────────────────────────────────────────────
  "Theo dõi hành vi người dùng trên các kênh",
  "Quản lý kênh phản hồi người dùng",
  "Quản lý Stakeholder khối",
  "Quản lý hiệu quả công việc team CM",

  // ── Đánh giá / Phân tích ─────────────────────────────────────────────────
  "Đánh giá mức độ thay đổi của Stakeholder và kế hoạch triển khai tiếp theo",
  "Phân tích tác động",
  "Đánh giá dữ liệu",

  // ── Báo cáo ───────────────────────────────────────────────────────────────
  "Báo cáo chuyển giao",
  "Báo cáo kết quả",

  // ── General ───────────────────────────────────────────────────────────────
  "Hub",
  "Sitevisit",
  "Khảo sát",
  "Q&A",
  "Xây dựng kịch bản",
  "Tổ chức sự kiện",
  "Lên kế hoạch",
  "Báo cáo",
  "Tài liệu",
  "Quy trình",
  "Truyền thông",
  "Đào tạo",

  // ── Catch-all ─────────────────────────────────────────────────────────────
  "Khác"
];

// ── HELPER FUNCTIONS ──────────────────────────────────────────────────────────
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
  if (n.indexOf("squad")   === 0) return "Squad";
  if (n.indexOf("du an")   === 0) return "Du_an";
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

// ── JIRA API FETCH (với pagination) ──────────────────────────────────────────
async function fetchAllIssues() {
  const all = [];
  let nextPageToken = undefined;
  let page = 0;

  do {
    page++;
    const body = {
      jql: `project = ${JIRA_PROJECT} ORDER BY created ASC`,
      fields: FIELDS,
      maxResults: 100
    };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const resp = await fetch(JIRA_URL, {
      method: 'POST',
      headers: {
        'Authorization': JIRA_AUTH,
        'Content-Type':  'application/json',
        'Accept':        'application/json'
      },
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

// ── BUILD EPIC MAP 2-PASS ─────────────────────────────────────────────────────
function buildEpicMap(issues) {
  const infoMap = {};
  for (const iss of issues) {
    const f = iss.fields;
    infoMap[iss.key] = {
      summary:   f.summary || '',
      workType:  f.issuetype?.name || '',
      parentKey: f.parent?.key || ''
    };
  }

  const epicMap = {};
  for (const key in infoMap) {
    const info = infoMap[key];
    const wt   = info.workType;

    if (wt === 'Epic') {
      epicMap[key] = info.summary;
    } else if (isTask(wt)) {
      const pKey = info.parentKey;
      epicMap[key] = (pKey && infoMap[pKey]) ? infoMap[pKey].summary : '';
    } else if (isSubtask(wt)) {
      const taskKey = info.parentKey;
      if (taskKey && infoMap[taskKey]) {
        const epicKey = infoMap[taskKey].parentKey;
        epicMap[key] = (epicKey && infoMap[epicKey])
          ? infoMap[epicKey].summary
          : infoMap[taskKey].summary;
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

// ── TRANSFORM ─────────────────────────────────────────────────────────────────
function transformIssues(issues, epicMap) {
  return issues.map(iss => {
    const f        = iss.fields;
    const workType = f.issuetype?.name || '';
    const epicName = epicMap[iss.key] || '';
    const summary  = f.summary || '';
    const parentSum = f.parent?.fields?.summary || '';

    const loai         = detectLoai(epicName);
    const doiTuong     = workType === 'Epic' ? summary : epicName;
    const hangMuc      = isTask(workType) ? summary
                       : isSubtask(workType) ? parentSum
                       : '';
    const hangMucChuan = normalizeHangMuc(hangMuc);
    const hangMucCon   = isSubtask(workType) ? summary : '';
    const nhom         = (f.labels || []).join(', ');

    return {
      key:            iss.key,
      work_type:      workType,
      loai,
      doi_tuong:      doiTuong,
      nhom,
      hang_muc:       hangMuc,
      hang_muc_chuan: hangMucChuan,
      hang_muc_con:   hangMucCon,
      status:         f.status?.name || '',
      assignee:       f.assignee?.displayName || 'Unassigned',
      due:            parseDate(f.duedate),
      created:        parseDate(f.created),
      updated:        parseDate(f.updated),
      note:           ''
    };
  });
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== SHB CM Dashboard Sync v3 (Jira Direct) ===');
  console.log(`[Config] Domain:  ${JIRA_DOMAIN}`);
  console.log(`[Config] Email:   ${JIRA_EMAIL}`);
  console.log(`[Config] Project: ${JIRA_PROJECT}`);

  try {
    console.log('\n[Step 1] Đang kéo issues từ Jira...');
    const issues = await fetchAllIssues();
    console.log(`[Step 1] Tổng: ${issues.length} issues`);

    if (issues.length === 0) {
      console.warn('[Warning] Không có issue nào — kiểm tra JIRA_PROJECT và quyền API token');
    }

    console.log('[Step 2] Building epic map...');
    const epicMap = buildEpicMap(issues);
    const resolved = Object.values(epicMap).filter(v => v).length;
    console.log(`[Step 2] ${resolved}/${issues.length} issues resolved to epic`);

    console.log('[Step 3] Transforming...');
    const data = transformIssues(issues, epicMap);

    const loaiCounts = {};
    data.forEach(d => { loaiCounts[d.loai] = (loaiCounts[d.loai] || 0) + 1; });
    console.log('[Step 3] Loai:', JSON.stringify(loaiCounts));

    const hmNorm = data.filter(d => d.hang_muc_chuan && d.hang_muc_chuan !== d.hang_muc).length;
    console.log(`[Step 3] ${hmNorm}/${data.length} hang_muc đã normalize`);

    console.log('[Step 4] Writing data.json...');
    if (!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true });

    const output = {
      lastSync: new Date().toISOString(),
      count:    data.length,
      loaiCounts,
      data
    };
    fs.writeFileSync(OUTPUT, JSON.stringify(output), 'utf8');
    const kb = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
    console.log(`\n[Done] ${OUTPUT} — ${data.length} issues, ${kb} KB`);
    console.log(`[Done] lastSync: ${output.lastSync}`);

  } catch (err) {
    console.error('\n[FATAL]', err.message);
    if (err.message.includes('401'))
      console.error('[Hint] Sai JIRA_EMAIL hoặc JIRA_TOKEN');
    if (err.message.includes('403'))
      console.error('[Hint] Token không có quyền đọc project này');
    if (err.message.includes('404'))
      console.error('[Hint] JIRA_PROJECT sai hoặc JIRA_DOMAIN sai');
    process.exit(1);
  }
}

main();
