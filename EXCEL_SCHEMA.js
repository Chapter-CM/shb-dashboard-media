// ============================================================
// EXCEL HEADERS — Cấu trúc file DATA_ALL1.xlsx trên OneDrive
// Power Automate ghi 10 cột raw này
// sync.js sẽ tính thêm 4 cột còn lại
// ============================================================

// 10 CỘT POWER AUTOMATE GHI:
// ─────────────────────────────────────────────────────────────
// A: Issue_key        → key
// B: Work_type        → fields.issuetype.name  
// C: Summary          → fields.summary
// D: Parent_key       → fields.parent.key (hoặc "" nếu Epic)
// E: Parent_summary   → fields.parent.fields.summary (hoặc "" nếu Epic)
// F: Nhom             → join(fields.labels, ', ')
// G: Status           → fields.status.name
// H: Assignee         → fields.assignee.displayName
// I: Due_date         → fields.duedate
// J: Ngay_tao         → fields.created
// K: Note             → "" (để trống, sync.js xử lý sau nếu cần)
// L: Updated          → fields.updated

// 4 CỘT SYNC.JS TÍNH (không cần trong Excel):
// ─────────────────────────────────────────────────────────────
// Loai           → detectLoai(epicName) — tính từ buildEpicMap
// Doi_tuong      → Epic→summary, Task→parent.summary, Sub-task→epic name
// Hang_muc       → Task→summary, Sub-task→parent.summary, Epic→""
// Hang_muc_chuan → normalizeHangMuc(hangMuc) — match 40 patterns
// Hang_muc_con   → Sub-task→summary, khác→""

// ── POWER AUTOMATE EXPRESSIONS ──────────────────────────────
// Dùng trong "Add a row into a table":

const EXPRESSIONS = {
  Issue_key:       "items('Apply_to_each')?['key']",
  Work_type:       "items('Apply_to_each')?['fields']?['issuetype']?['name']",
  Summary:         "items('Apply_to_each')?['fields']?['summary']",
  Parent_key:      "items('Apply_to_each')?['fields']?['parent']?['key']",
  Parent_summary:  "items('Apply_to_each')?['fields']?['parent']?['fields']?['summary']",
  Nhom:            "join(items('Apply_to_each')?['fields']?['labels'], ', ')",
  Status:          "items('Apply_to_each')?['fields']?['status']?['name']",
  Assignee:        "items('Apply_to_each')?['fields']?['assignee']?['displayName']",
  Due_date:        "items('Apply_to_each')?['fields']?['duedate']",
  Ngay_tao:        "items('Apply_to_each')?['fields']?['created']",
  Note:            "''",
  Updated:         "items('Apply_to_each')?['fields']?['updated']"
};
