# Kế hoạch Chuyển dịch & Hợp nhất 2 Dashboard CM vào Hạ tầng Nội bộ SHB
## Email Tracker + Facebook Dashboard → 1 hệ thống trên GitLab Nội bộ SHB

**Người soạn:** Change Management Team
**Ngày:** 25/06/2026
**Trạng thái:** Chờ phê duyệt
**Ghi chú:** Hợp nhất 2 kế hoạch riêng (Email Tracker — bản 21/06; Facebook Dashboard — bản 25/06). Xin **hạ tầng dùng chung** một lần để khỏi migrate 2 lần rồi gộp lại.

---

## 1. Tổng quan

### 1.1 Mục đích
Hai dashboard đo hiệu quả truyền thông nội bộ của team Change Management:
- **Email Tracker** — đo reach/engagement email campaign gửi từ Outlook.
- **Facebook Dashboard** — đo hiệu quả bài Group "SHB Một Nhà".

Cả hai đang chạy trên hạ tầng ngoài (GitHub, Vercel, Supabase — Singapore). Chuyển vào nội bộ SHB để: **bảo mật dữ liệu, tuân thủ chính sách IT, ổn định (không phụ thuộc dịch vụ ngoài), dễ bảo trì (IT hỗ trợ trực tiếp)**.

### 1.2 Định hướng: chuyển dịch ĐỒNG THỜI và HỢP NHẤT
Thay vì migrate 2 hệ thống độc lập rồi mới gộp, ta **xin hạ tầng dùng chung ngay từ đầu** (1 DB, 1 GitLab repo, 1 pipeline, 1 DNS) và gộp thành **1 dashboard 2 tab (Email / Facebook)**. Cả hai vốn dùng **cùng design system** và đều là Node module in ra 1 trang HTML → gộp tự nhiên.

---

## 2. Hệ thống hiện tại

### 2.1 Email Tracker
```
VBA Macro (Outlook Desktop) ──gửi beacon (sent/open/click/read)──►
  api/track.js  ← Vercel  ──ghi──►  Supabase (events)
  api/dashboard.js ← Vercel ◄─đọc──  Supabase
```

### 2.2 Facebook Dashboard
```
[Nguồn CHÍNH] Userscript Tampermonkey (trình duyệt admin, đăng nhập facebook.com)
   ──hook fetch/XHR bắt GraphQL Professional Dashboard, POST kèm secret──►
  api/ingest.js ← Vercel ──ghi──►  Supabase (fb_group_posts, fb_page_insights)
  api/facebook.js ← Vercel ◄─đọc── Supabase
[Nguồn PHỤ] api/fetch.js ← Vercel cron → graph.facebook.com (Page token) → Supabase
```

| | Source | Hosting | DB | URL |
|---|---|---|---|---|
| Email | GitHub | Vercel | Supabase | `email-tracker-vercel-rho.vercel.app` |
| Facebook | GitHub | Vercel | Supabase | `shb-fb-dashboard.vercel.app` |

---

## 3. Phân tích cốt lõi: 2 cách lấy dữ liệu khác nhau

Đây là điểm KHÁC quan trọng nhất giữa 2 dashboard — nhưng **cả hai đều quy về cùng một mô hình "bộ thu thập bên ngoài, chỉ đổi URL đích"**:

| | Email Tracker | Facebook Dashboard |
|---|---|---|
| Bộ thu thập | **VBA macro** (Outlook) | **Userscript Tampermonkey** (trình duyệt) |
| Cơ chế | Outlook **tự fetch** beacon URL → server ghi log | Admin đăng nhập facebook.com, userscript hook GraphQL nội bộ → POST |
| Phụ thuộc phiên đăng nhập | Không | **Có** (cookie admin facebook.com) |
| Yếu tố con người | Tự động khi gửi | **Thủ công** (admin mở Pro Dashboard, Ctrl+Shift+Y) |
| Để migrate, bộ thu thập cần | **Đổi URL beacon** | **Đổi URL `INGEST` + `@connect`** |

**Kết luận quan trọng:** Userscript (giống VBA) **không cần và không thể đưa "vào trong"** — nó bắt buộc chạy ở trình duyệt admin vì Meta đã gỡ Groups API công khai (22/04/2024) và post-insights Graph đã chết. Nhưng điều đó **KHÔNG cản trở migration**: ta chỉ đổi URL đích của nó sang nội bộ, y như VBA. Toàn bộ phần server (ingest/track/dashboard/DB) migrate vào trong bình thường.

### 3.1 Quyết định về `api/fetch.js` (Graph cron) — Phương án A: BỎ
- `fetch.js` là **nguồn PHỤ**, chỉ nuôi bảng legacy `fb_posts`/`fb_page_snapshots`; **post-insights Graph đã chết** (#100, probe 23/06/2026).
- Đã kiểm tra `loadData()` của `facebook.js`: có nhánh `!hasPage && hasGroup → mapSupabase([], …)` → **dashboard chạy đầy đủ chỉ với dữ liệu userscript** (`fb_group_posts` + `fb_page_insights`).
- ➡️ **Bỏ hẳn `fetch.js`.** Hệ quả tích cực: **không còn phụ thuộc egress ra Internet** từ server nội bộ → migration sạch y như Email (server hoàn toàn không gọi ra ngoài). Câu hỏi egress với IT trở nên **không cần thiết**.

---

## 4. Kiến trúc hợp nhất sau migration

```
[Bên ngoài — bộ thu thập, chỉ đổi URL]
  VBA macro (Outlook) ───POST/GET beacon──────────┐
  Userscript TM (browser admin) ──POST /api/ingest─┤
                                                   ▼
┌──────────────────────────────────────────────────────────────┐
│             AWS EKS Nội bộ SHB                                │
│   cm-dashboard.dev-saha.aws.shb.com.vn                        │
│   nginx (80)                                                  │
│   ├── GET  /api/track   → Node Ingest Server (:3001) ──┐      │
│   ├── POST /api/ingest  → Node Ingest Server (:3001) ──┤ghi   │
│   └── GET  /            → Dashboard HTML tĩnh (2 tab)   ▼      │
└──────────────────────────────────────────────────────  DB nội bộ
                         ▲ build theo schedule (1h)
        GitLab CI/CD Schedule → sync.js đọc DB → index.html (data baked-in)
```

- **1 DB nội bộ** chứa cả `events` (email) lẫn `fb_group_posts`/`fb_page_insights` (facebook).
- **1 Node ingest server** phục vụ cả `/api/track` (email beacon) và `/api/ingest` (facebook userscript).
- **1 trang dashboard** 2 tab Email / Facebook, build tĩnh bằng **1 `sync.js`** chung.
- **1 GitLab repo, 1 pipeline, 1 DNS.**

---

## 5. So sánh trước / sau

| | Hiện tại (×2 hệ thống) | Sau migration (hợp nhất) |
|---|---|---|
| Source | 2 repo GitHub | 1 GitLab repo nội bộ |
| Hosting | 2 dự án Vercel | 1 cụm AWS EKS |
| Database | 2 Supabase | 1 DB nội bộ |
| Dashboard | 2 trang real-time | 1 trang 2 tab, cập nhật schedule (≤1h) |
| Bộ thu thập | VBA + Userscript (đổi URL) | Giữ nguyên, chỉ đổi URL về nội bộ |
| Egress Internet của server | Email: không · FB: có (fetch.js) | **Không** (bỏ fetch.js) |

---

## 6. Xác nhận từ IT/DevOps (đã hợp nhất, loại trùng)

| # | Câu hỏi | Người xác nhận | Trạng thái |
|---|---|---|---|
| 1 | Cấp **PostgreSQL/MySQL nội bộ** (~100MB cho cả 2) | Nam Tran Hoang (DevOps) | Chờ |
| 2 | **EKS pods** connect được DB đó | Nam Tran Hoang | Chờ |
| 3 | **GitLab CI runner** connect được DB đó | Nam Tran Hoang | Chờ |
| 4 | Deploy **1 Node server (:3001)** song song nginx | Nam Tran Hoang | Chờ |
| 5 | Tạo **GitLab repo** nội bộ + cấp quyền | Quang Doan Van (GitLab Admin) | Chờ |
| 6 | Cấp **DNS subdomain** nội bộ (1 domain chung) | Mạnh (System) | Chờ |
| 7 | Máy **admin chạy userscript** reach được domain nội bộ để POST `/api/ingest` | CM Team | ✅ **CÓ** (đã xác nhận) |
| ~~8~~ | ~~Egress tới graph.facebook.com~~ | — | **Không cần** (đã bỏ `fetch.js` — Phương án A) |

**Lưu ý:** egress Internet không còn là điều kiện chặn nhờ bỏ `fetch.js`. Beacon Email (Outlook) và POST userscript (browser admin) đều phát từ **trong mạng SHB** tới domain nội bộ — đã xác nhận khả thi (câu 7).

---

## 7. Kế hoạch thực hiện

### Giai đoạn 0 — Chuẩn bị (1–2 tuần)
- [ ] Họp Nam: xác nhận DB nội bộ + connectivity (câu 1–4).
- [ ] Họp Quang: tạo 1 GitLab repo hợp nhất.
- [ ] Thống nhất 1 DNS chung với Mạnh.
- [ ] Export toàn bộ data: Supabase Email (`events`, ~40k) + Supabase FB (`fb_group_posts`, `fb_page_insights`).
- **Điều kiện sang G1:** câu 1–4 ✅.

### Giai đoạn 1 — Code migration + hợp nhất (5–7 ngày)
| Task | Mô tả |
|---|---|
| Gộp repo | 1 repo: `tracker/` (Node ingest cho cả track + ingest), `dashboard/` (sync.js + HTML 2 tab) |
| `track.js` | Vercel → Node HTTP server (thêm `url.parse()` thủ công ~10 dòng) |
| `ingest.js` | Vercel → cùng Node server, giữ check `x-ingest-secret` |
| **Bỏ `fetch.js`** | Theo Phương án A — userscript là nguồn FB duy nhất |
| `sync.js` chung | Đọc DB nội bộ (events + fb_*) → `index.html` 2 tab, data baked-in |
| Hợp nhất UI | 2 dashboard cùng design system → 1 trang, tab Email / Facebook |
| `Dockerfile` + `.gitlab-ci.yml` | tracker (Node :3001) + dashboard (nginx) + schedule sync |
| Font | Google Fonts → font nội bộ/system |
| Cập nhật bộ thu thập | VBA: đổi URL beacon · Userscript: đổi `INGEST` URL + `@connect` |
| Test | Toàn bộ chức năng trên dev |

### Giai đoạn 2 — Deploy & kiểm thử (2–3 ngày)
- [ ] Pipeline chạy lần đầu → ECR → ArgoCD deploy EKS.
- [ ] Mạnh cấp DNS.
- [ ] Test email: gửi thử → beacon ghi DB nội bộ.
- [ ] Test facebook: chạy userscript → ingest ghi DB nội bộ.
- [ ] Test schedule: chờ 1 chu kỳ → data tự cập nhật, cả 2 tab.

### Giai đoạn 3 — Chạy song song & cutover (1 tuần)
- [ ] Ngày 1–5: bộ thu thập gửi tới CẢ 2 đích (Vercel + nội bộ).
- [ ] Ngày 5: so dữ liệu 2 hệ thống.
- [ ] Ngày 6: chuyển VBA + userscript chỉ còn URL nội bộ.
- [ ] Ngày 7: tắt Vercel + Supabase (cả 2 dự án).

---

## 8. Rủi ro & xử lý (hợp nhất)

| Rủi ro | Mức độ | Xử lý |
|---|---|---|
| VBA + userscript cần đổi URL | Trung bình | Thao tác một lần, có hướng dẫn |
| Userscript reach domain nội bộ | Thấp | Đã xác nhận CÓ (câu 7); sửa `@connect` + giữ CORS+secret ở ingest |
| Dashboard không real-time | Thấp | Delay ≤1h — chấp nhận được |
| Data migration từ 2 Supabase | Thấp | Export → import một lần (events + fb_* kèm cột jsonb) |
| Google Fonts bị chặn | Thấp | Font nội bộ |
| Bỏ `fetch.js` mất số Graph | Thấp | Dashboard không dùng tới (đã kiểm chứng loadData). Nếu sau cần: mở rộng userscript bắt thêm — không cần egress server |
| Gián đoạn khi cutover | Trung bình | Chạy song song 1 tuần trước khi tắt |

---

## 9. Tổng thời gian
| Giai đoạn | Thời gian |
|---|---|
| G0 Chuẩn bị | 1–2 tuần |
| G1 Code + hợp nhất | 5–7 ngày |
| G2 Deploy | 2–3 ngày |
| G3 Cutover | 1 tuần |
| **Tổng** | **~4–5 tuần** |

**Không cần:** mua license, đổi quy trình gửi email, training lại người dùng (giao diện giữ nguyên, chỉ thêm tab).

---

## 10. Phương án dự phòng
Nếu **không cấp được DB nội bộ** (câu 1 = ❌): **Hybrid** — migrate dashboard hợp nhất + `sync.js` vào nội bộ (đọc Supabase lúc build), giữ track.js + ingest.js + Supabase ở ngoài. Đưa được giao diện vào kiểm soát nội bộ; dữ liệu vẫn qua ngoài.

---

## 11. Checklist trước khi tắt Vercel
```
□ Pipeline GitLab chạy thành công
□ Docker image trong ECR; ArgoCD deploy pod EKS
□ URL nội bộ accessible từ mạng SHB
□ Tắt internet → dashboard vẫn load (không CDN ngoài)
□ Email: gửi test → event ghi DB nội bộ
□ Facebook: userscript → ingest ghi DB nội bộ
□ Dashboard hiển thị đúng cả 2 tab sau 1 chu kỳ schedule
□ Data cũ từ 2 Supabase đã import đầy đủ
□ VBA + userscript đã đổi URL nội bộ
□ Không lỗi browser console
□ Thông báo team CM URL mới
```

---

*Tài liệu hợp nhất từ 2 kế hoạch migration. Câu 7 = CÓ; bỏ `fetch.js` (Phương án A) nên không cần egress Internet. Trình phê duyệt một lần cho cả 2 dashboard.*
