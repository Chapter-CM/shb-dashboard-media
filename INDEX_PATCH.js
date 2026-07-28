// ============================================================
// INDEX.HTML — Hướng dẫn sửa (v2 — fixed)
// 4 chỗ cần sửa trong index.html
// ============================================================

// ═══════════════════════════════════════════════════════════
// SỬA 1: Thay fetchSheetData() — XÓA toàn bộ đoạn cũ
// ═══════════════════════════════════════════════════════════
//
// TÌM và XÓA từ dòng:
//   const SHEET_ID = "1wPUTzB9Wtgx...";
// ĐẾN hết function fetchSheetData() { ... }
//
// THAY BẰNG:

const DATA_JSON_URL = "./data.json";

function parseDateField(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0, 16);
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const d = String(dmy[1]).padStart(2, "0");
    const mo = String(dmy[2]).padStart(2, "0");
    const y = dmy[3].length === 2 ? "20" + dmy[3] : dmy[3];
    return y + "-" + mo + "-" + d;
  }
  return s;
}

async function fetchSheetData() {
  try {
    const resp = await fetch(DATA_JSON_URL + "?t=" + Date.now());
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const json = await resp.json();

    console.log("[Dashboard] data.json loaded:", json.count, "issues, synced:", json.lastSync);

    return (json.data || []).map(function(d) {
      return {
        key:             d.key || "",
        loai:            d.loai || "",
        doi_tuong:       d.doi_tuong || "",
        nhom:            d.nhom || "",
        hang_muc:        d.hang_muc || "",
        hang_muc_chuan:  d.hang_muc_chuan || "",
        hang_muc_con:    d.hang_muc_con || "",
        assignee:        d.assignee || "Unassigned",
        status:          d.status || "",
        due:             parseDateField(d.due || ""),
        // FIX #1: Thêm created — dashboard dùng cho date picker "Ngày tạo"
        created:         parseDateField(d.created || ""),
        updated:         parseDateField(d.updated || "") || parseDateField(d.created || ""),
        note:            d.note || "",
        work_type:       d.work_type || ""
      };
    });
  } catch (err) {
    console.error("data.json Error:", err);
    return [];
  }
}


// ═══════════════════════════════════════════════════════════
// SỬA 2: Đổi CONFIG_API_URL
// ═══════════════════════════════════════════════════════════
//
// TÌM:
//   const CONFIG_API_URL = "/api/config";
//
// FIX #5: Config giờ là file tĩnh — chỉ đọc, không save realtime.
// Để sửa config → sửa config.json trong repo GitLab → push.
// THAY BẰNG:

const CONFIG_API_URL = null; // GitLab Pages không có backend — config đọc từ file tĩnh


// ═══════════════════════════════════════════════════════════
// SỬA 3: Sửa useEffect load config
// ═══════════════════════════════════════════════════════════
//
// TÌM đoạn useEffect fetch CONFIG_API_URL (load config on mount):
//   useEffect(()=>{
//     fetch(CONFIG_API_URL+"?t="+Date.now(), ...
//
// THAY BẰNG:

// useEffect(()=>{
//   fetch("./config.json?t="+Date.now())
//     .then(r=>r.ok?r.json():null)
//     .then(res=>{
//       if(res&&Object.keys(res).length>0){
//         setCfg(prev=>({...DEFAULT_CONFIG,...res}));
//       }
//     })
//     .catch(()=>{});
// },[]);


// ═══════════════════════════════════════════════════════════
// SỬA 4: Sửa useEffect save config
// ═══════════════════════════════════════════════════════════
//
// TÌM đoạn useEffect save config to API:
//   useEffect(()=>{
//     try{localStorage.setItem(...
//     const timer=setTimeout(()=>{
//       setConfigSaving(true);
//       fetch(CONFIG_API_URL, { method:"POST", ...
//
// THAY BẰNG (chỉ lưu localStorage, bỏ API call):

// useEffect(()=>{
//   try{localStorage.setItem("cm_cfg_v10",JSON.stringify(cfg));}catch{}
// },[cfg]);


// ═══════════════════════════════════════════════════════════
// SỬA 5: Xóa Jira Sync button
// ═══════════════════════════════════════════════════════════
//
// TÌM và XÓA:
//   const JIRA_SYNC_URL = "https://script.google.com/macros/s/...";
//   const[jiraSyncing,setJiraSyncing]=useState(false);
//   const[jiraLastSync,setJiraLastSync]=useState(null);
//   const doJiraSync = async()=>{ ... };
//
// TÌM và XÓA nút Jira trong header:
//   <button onClick={doJiraSync} ...>
//     ... Jira ...
//   </button>
//
// (Jira sync giờ do Power Automate lo — không cần nút trên dashboard)


// ═══════════════════════════════════════════════════════════
// SỬA 6: Thêm created vào inRange filter
// ═══════════════════════════════════════════════════════════
//
// TÌM:
//   const inRange=d=>{
//     const dt=dateField==="due"?d.due:dateField==="created"?(d.created||""):d.updated;
//
// Đoạn này đã đúng — d.created giờ có data từ data.json. Không cần sửa.
// Chỉ cần đảm bảo fetchSheetData trả về field `created` (đã fix ở Sửa 1).

