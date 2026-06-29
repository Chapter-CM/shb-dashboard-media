# Kế hoạch Chuyển dịch SHB Facebook Dashboard
## Từ GitHub + Vercel + Supabase → GitLab Nội bộ SHB

**Người soạn:** Change Management Team
**Ngày:** 25/06/2026
**Trạng thái:** Chờ phê duyệt
**Tham chiếu:** Mirror kế hoạch `KE_HOACH_MIGRATION.md` của Email Tracker — dùng chung khuôn mẫu, đánh dấu rõ các điểm KHÁC.

---

## 1. Tổng quan

### 1.1 Mục đích
Facebook Dashboard đo hiệu quả truyền thông Group "SHB Một Nhà" của team Change Management. Hiện chạy trên hạ tầng ngoài (GitHub, Vercel, Supabase). Lý do chuyển vào nội bộ giống hệt Email Tracker: **bảo mật dữ liệu, tuân thủ IT, ổn định, dễ bảo trì**.

### 1.2 Hệ thống hiện tại
```
[Nguồn CHÍNH] Userscript Tampermonkey (trình duyệt admin, đăng nhập facebook.com)
    │  hook fetch/XHR → bắt response GraphQL Professional Dashboard
    │  (Content Library group + Page Insights), POST kèm secret
    ▼
api/ingest.js   ← Vercel (Singapore)   ──ghi──►  Supabase
                                                  (fb_group_posts, fb_page_insights)
[Nguồn PHỤ]  api/fetch.js  ← Vercel cron → gọi graph.facebook.com (Page token) ──ghi──► Supabase
api/facebook.js ← Vercel (Singapore)   ◄─đọc──   Supabase
```

| Thành phần | Dịch vụ | Vị trí |
|---|---|---|
| Source code | GitHub | Nước ngoài |
| Hosting API | Vercel Serverless | Singapore |
| Database | Supabase PostgreSQL | Singapore |
| Tracking/ingest URL | `shb-fb-dashboard.vercel.app` | Nước ngoài |

---

## 2. Phân tích kỹ thuật — ĐIỂM KHÁC CỐT LÕI so với Email Tracker

### 2.1 Khác biệt căn bản về cách lấy dữ liệu

| | Email Tracker | Facebook Dashboard |
|---|---|---|
| Cơ chế nạp | Outlook **tự fetch** beacon URL → server ghi log. Không cần phiên đăng nhập, không cần trình duyệt | Phải có **admin đăng nhập facebook.com**, userscript hook GraphQL nội bộ rồi POST |
| Bộ thu thập | VBA macro (Outlook) | **Userscript Tampermonkey** (trình duyệt) |
| Phụ thuộc Internet ra ngoài của server | **KHÔNG** | `api/fetch.js` cần egress tới `graph.facebook.com` |
| Yếu tố con người | Tự động khi gửi email | **Thủ công**: admin mở Professional Dashboard, Ctrl+Shift+Y để bắt |

### 2.2 Bốn thành phần (Email chỉ có 2)

- **Userscript** (`tools/shb-content-library.user.js`) — chạy **bên ngoài**, trên trình duyệt admin. Bắt response Content Library (bài Group) + Page Insights time-series. **Nguồn dữ liệu CHÍNH** (Groups API công khai đã bị Meta gỡ 22/04/2024; post-level Insights qua Graph đã chết — probe 23/06/2026 trả #100).
- **`api/ingest.js`** — endpoint nhận POST của userscript, kiểm tra header `x-ingest-secret`, upsert vào Supabase. (Tương đương `track.js` của Email.)
- **`api/fetch.js`** — cron gọi Graph API Page (reactions/comments/shares qua edge expansion; page insights v25). **Nguồn PHỤ**, cần egress Internet.
- **`api/facebook.js`** — dashboard, đọc Supabase, render HTML (Node module in ra 1 trang). (Tương đương `dashboard.js` của Email.)

### 2.3 Bảng dữ liệu Supabase
- `fb_group_posts` — per-post (title, reach, viewers, engagement, comments, cột `metrics` jsonb).
- `fb_page_insights` — page-level (`metrics` + `series` jsonb: views/interactions/followers time-series, nhân khẩu học).
- (Legacy) `fb_posts`, `fb_page_snapshots` từ `fetch.js`.
- Migrations: `db/schema.sql`, `migrate_01..04`.

### 2.4 Env cần migrate
| Biến | Dùng ở | Ghi chú |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | ingest + fetch + dashboard | → credentials DB nội bộ |
| `INGEST_SECRET` | ingest + userscript | Giữ, đồng bộ 2 nơi |
| `FB_GROUP_ID` | ingest | Giữ |
| `FB_PAGE_ID`, `FB_PAGE_TOKEN`, `GRAPH_VERSION`, `FB_*_METRICS` | fetch | Chỉ cần nếu giữ `fetch.js` |
| `TARGET_ER` (=6), `MIN_N` | dashboard | Giữ |

---

## 3. Trả lời câu hỏi: "Có chuyển userscript vào trong được không?"

**KHÔNG cần và không thể đưa userscript 'vào trong' — nhưng điều đó KHÔNG cản trở migration.**

Userscript đóng đúng vai trò của VBA macro trong kế hoạch Email: **bộ thu thập chạy bên ngoài, chỉ cần đổi URL đích**. Lý do bắt buộc chạy ngoài:
- Cần **cookie/phiên đăng nhập admin** trên facebook.com để đọc GraphQL nội bộ của Professional Dashboard.
- Không còn API công khai cho nội dung Group (Meta gỡ 22/04/2024) và post-insights Graph đã chết.

➡️ Việc migrate **chỉ đổi 1 dòng** trong userscript:
```
var INGEST = 'https://<dashboard-nội-bộ>/api/ingest';   // thay vercel.app
// và thêm @connect <domain-nội-bộ> trong header userscript
```
Giống hệt VBA macro của Email chỉ đổi URL beacon.

---

## 4. Kiến trúc đề xuất sau migration

```
[Bên ngoài, không đổi bản chất]
  Userscript TM (trình duyệt admin) ──POST /api/ingest──┐   (đổi URL + @connect)
                                                        │
┌───────────────────────────────────────────────────────────────┐
│              AWS EKS Nội bộ SHB                                │
│   fb-dashboard.dev-saha.aws.shb.com.vn                         │
│   nginx (80)                                                   │
│   ├── POST /api/ingest → Node.js Ingest Server (:3001) ──ghi──►│ DB nội bộ
│   └── GET  /           → Static Dashboard HTML                 │
└───────────────────────────────────────────────────────────────┘
                         ▲ build theo schedule
        GitLab CI/CD Schedule → sync.js đọc DB nội bộ → index.html (data baked-in)

[TUỲ CHỌN] api/fetch.js (Graph cron) — CHỈ chạy nếu có egress tới facebook.com
```

### 4.1 Luồng sau migration
- **Nạp (thủ công, như hiện tại):** admin mở Professional Dashboard → userscript POST → ingest server (nội bộ) ghi DB nội bộ.
- **Dashboard (schedule):** mỗi 1h GitLab CI chạy `sync.js` đọc DB → bake HTML → Docker → ECR → ArgoCD → EKS → nginx serve tĩnh. (Y hệt Email.)

---

## 5. Phân tích rủi ro (khác Email được tô đậm)

| Rủi ro | Mức độ | Cách xử lý |
|---|---|---|
| **Userscript cần reach domain nội bộ** | Trung bình | Máy admin phải ở mạng SHB tới được dashboard nội bộ; sửa `@connect` + giữ CORS `*` + secret ở ingest |
| **`api/fetch.js` cần egress ra facebook.com** ⚠️ KHÁC EMAIL | Trung bình | Nếu mạng nội bộ chặn outbound: **bỏ/đặt fetch.js ở nơi có egress**. Không nghiêm trọng vì nguồn chính là userscript (post-insights Graph đã chết) |
| Ingest không thể là static file | Thấp | Cần 1 Node server (:3001) như Email |
| Dashboard không real-time | Thấp | Delay ≤1h, chấp nhận được |
| Data migration từ Supabase | Thấp | Export `fb_group_posts` + `fb_page_insights` (kèm cột jsonb) → import DB nội bộ |
| Google Fonts bị chặn | Thấp | Font nội bộ / system font |
| **Con người vẫn phải bắt thủ công** | — | Không đổi; quy trình Ctrl+Shift+Y giữ nguyên |

---

## 6. Cần xác nhận từ IT/DevOps (bổ sung so với Email)

Toàn bộ câu hỏi 1–6 trong kế hoạch Email **áp dụng y nguyên** (DB nội bộ, EKS/CI connect DB, Node server :3001 song song nginx, GitLab repo, DNS subdomain). **Bổ sung riêng cho Facebook:**

| # | Câu hỏi | Tại sao |
|---|---|---|
| 7 | Máy admin (chạy userscript trên facebook.com) có **reach được domain dashboard nội bộ** để POST `/api/ingest` không? | Đường nạp dữ liệu chính |
| 8 | Có cho **egress tới `graph.facebook.com`** từ EKS/CI không? | Quyết định giữ hay bỏ `api/fetch.js` |

---

## 7. Code migration (mirror Email, 3–4 ngày)

| Task | Mô tả | Khác Email? |
|---|---|---|
| `sync.js` | Đọc DB nội bộ (`fb_group_posts` + `fb_page_insights`) → `index.html` data baked-in | Tương tự, nhưng đọc 2 bảng + cột jsonb |
| `ingest.js` | Vercel handler → Node HTTP server (parse body thủ công, giữ check secret) | Có sẵn body-parse; ít sửa |
| `fetch.js` | Giữ (nếu có egress) chạy như cron CI, hoặc loại bỏ | **Quyết định theo câu 8** |
| `facebook.js` | Serverless → `sync.js` build tĩnh (in HTML string giữ nguyên `clientCode`) | Giống `dashboard.js` Email |
| `Dockerfile` + `.gitlab-ci.yml` | tracker/ingest (Node) + dashboard (nginx) + schedule sync | Giống Email |
| Font | Google Fonts → nội bộ | Giống Email |
| Userscript | Đổi `INGEST` URL + `@connect` | Giống "VBA đổi URL" |

**Lưu ý kỹ thuật:** `api/facebook.js` là Node module in HTML; toàn bộ browser logic nằm trong `clientCode()` extract bằng `toString()` — chuyển sang sync.js không đổi logic client, chỉ thay tầng đọc dữ liệu (Supabase REST → đọc DB nội bộ).

---

## 8. Giai đoạn & cutover
Giống Email: **G0 chuẩn bị (1–2 tuần)** → **G1 code (3–4 ngày)** → **G2 deploy & test (2–3 ngày)** → **G3 chạy song song + cutover (1 tuần, userscript POST tới CẢ 2 URL rồi mới cắt Vercel)**.

---

## 9. Hướng GỘP 2 DASHBOARD (định hướng tương lai)
Sau khi cả 2 vào nội bộ, có thể hợp nhất:
- **Chung DB nội bộ** (2 nhóm bảng: `events` của Email + `fb_*` của Facebook).
- **2 đường nạp độc lập**: beacon (Outlook→track) và userscript (browser→ingest) — giữ nguyên, chỉ chung hạ tầng.
- **1 trang dashboard** có 2 tab Email / Facebook (cả hai đều là Node module in HTML string, cùng design system → gộp tự nhiên), build chung bằng 1 `sync.js`.
- 1 GitLab repo, 1 pipeline, 1 DNS.

---

## 10. Phương án dự phòng
Nếu **không cấp được DB nội bộ**: Hybrid — migrate dashboard + sync vào nội bộ, **giữ ingest.js + Supabase ngoài** (dashboard đọc Supabase lúc build). Đưa được giao diện vào kiểm soát nội bộ, dữ liệu vẫn qua ngoài.

---

*Tài liệu mirror kế hoạch Email Tracker, điều chỉnh cho đặc thù Facebook (userscript thay VBA, thêm phụ thuộc egress của fetch.js). Trình phê duyệt cùng kế hoạch Email để triển khai đồng bộ.*
