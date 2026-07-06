# Kế hoạch Chuyển dịch & Hợp nhất 2 Dashboard CM vào Hạ tầng Nội bộ SHB
## Email Tracker + Facebook Dashboard → 1 hệ thống trên GitLab Nội bộ SHB

**Người soạn:** Change Management Team
**Ngày:** 25/06/2026 (cập nhật 03/07/2026)
**Trạng thái:** DevOps đã đồng ý phương án hạ tầng — chờ QA (anh Quốc Anh) duyệt
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

### 1.3 ✅ ĐÃ GỘP XONG Ở MÔI TRƯỜNG NGOÀI (25/06/2026) — điểm khởi đầu mới cho migration
Việc hợp nhất code đã hoàn tất TRƯỚC trên Vercel để test/demo, nên migration nội bộ giờ **chỉ cần bê NGUYÊN 1 repo unified này vào trong** (không còn 2 hệ thống rời):
- **1 repo**: `Chapter-CM/shb-dashboard-Facebook` chứa tất cả. **1 Vercel project** `shb-fb-dashboard` chạy tất cả; link demo: `shb-fb-dashboard.vercel.app/` (portal 2 tab).
- **File theo sản phẩm** (tên = route; URL cũ giữ qua `rewrites` nên VBA/userscript không phải đổi):
  `api/portal.js` (portal) · `api/fb-dashboard.js` (/api/facebook) · `api/email-dashboard.js` (/api/email) · `api/fb-ingest.js` (/api/ingest) · `api/fb-fetch.js` (cron) · `api/email-track.js` (/api/track).
- **2 Supabase tách bằng env**: FB `SUPABASE_*`; Email `EMAIL_SUPABASE_*`.
- **VBA v4.9** đã trỏ `/api/track` của project gộp; userscript vẫn `/api/ingest`.
➡️ Migration nội bộ = đưa **repo unified này** lên GitLab/EKS + đổi `SUPABASE_*`/`EMAIL_SUPABASE_*` sang DB nội bộ + chuyển dashboard sang `sync.js` build tĩnh. Repo `email-tracker-data` chỉ còn là nguồn đối chiếu (sẽ nghỉ).

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

### 3.2 Vì sao chọn build TĨNH thay vì giữ đọc ĐỘNG như hiện tại

> Bản hiện tại đọc DB mỗi lần mở trang (`api/fb-dashboard.js` → `loadData()`), nên "real-time". Sau migration, `sync.js` đọc DB theo lịch (GitLab Schedule, ≤1h) → bake dữ liệu thẳng vào HTML; nginx chỉ phục vụ file tĩnh. **Đây là lựa chọn ĐƠN GIẢN HOÁ + TĂNG BẢO MẬT có chủ đích, KHÔNG phải bị hạ tầng ép** — Phương án dự phòng (§10) vẫn đọc-lúc-build chứ không quay lại đọc động.

**Điểm mấu chốt:** "real-time" hiện tại không thật sự real-time ở tầng dữ liệu. Dashboard đọc DB mỗi lần mở trang, **nhưng dữ liệu vào DB lại theo đợt**: Facebook do admin **bấm tay** chạy userscript (Ctrl+Shift+Y) thỉnh thoảng; Email nhỏ giọt theo beacon Outlook. Vì nguồn vốn cập nhật cách nhau hàng giờ/ngày, **rebuild mỗi 1h bắt được gần như cùng độ tươi** → mất real-time trên giấy, gần như không mất gì trên thực tế (đúng đánh giá rủi ro: "Thấp — Delay ≤1h, chấp nhận được", §8).

Các lý do kỹ thuật đứng sau, xếp theo sức nặng:

| # | Lý do | Giải thích |
|---|---|---|
| 1 | **Tách tầng phục vụ trang khỏi DB (bảo mật/tuân thủ)** | HTML tĩnh → nginx **không chạm DB lúc người dùng mở trang**: không kết nối, không `service_role key` trong đường request. Kiểu động thì mỗi lượt mở trang là một pod cầm khóa DB mở kết nối → bề mặt tấn công lớn hơn, khó qua review bảo mật nội bộ. Khớp đúng mục đích migration (§1.1). |
| 2 | **Bỏ được tầng PostgREST của Supabase** | Code đọc DB qua REST Supabase (`sbGet('/rest/v1/...')`). PostgREST này **không có trên Postgres nội bộ trần**. Giữ đọc động phải dựng PostgREST nội bộ hoặc viết lại toàn bộ truy vấn sang driver PG trong đường request nóng. Cho `sync.js` đọc DB **một lần lúc build** (job CI) thì chỉ viết lớp truy cập DB một chỗ, ngữ cảnh batch. |
| 3 | **Ít thành phần động trên EKS** | Dashboard tĩnh = file + nginx: **không app server luôn chạy, không pool kết nối, không secret, không chết vì query chậm/DB sập**. Kiến trúc đích cố ý tối giản (1 Node ingest + nginx tĩnh, §4). |
| 4 | **Luôn load được** | HTML tĩnh hiện bản build cuối kể cả khi DB down/runner lỗi — không bao giờ trả trang lỗi cho lãnh đạo. Checklist có sẵn mục "Tắt internet → dashboard vẫn load" (§11). |
| 5 | **GitLab CI/CD Schedule = bản sao nội bộ của Vercel Cron** | Tận dụng công cụ dạng cron sẵn có, quen tay với IT SHB. |
| 6 | **Bỏ chi phí mỗi lượt xem** | Mỗi lần mở trang bản động query 4 bảng rồi render HTML lớn. Tĩnh trả chi phí đó 1 lần/giờ bất kể số người xem. |

**Kết luận:** hạ tầng *cho phép* làm động; chọn tĩnh là vì gọn + an toàn hơn, hợp môi trường ngân hàng nội bộ. Nếu sau này cần tươi hơn 1h, đòn bẩy đúng **không phải** quay lại đọc động mà là **tăng tần suất schedule** (15–20'), hoặc cho ingest server **trigger build ngay sau mỗi đợt ingest**.

### 3.3 Khác biệt thao tác sử dụng (động → tĩnh)

**Thao tác TRONG trang — không đổi.** Mọi tương tác chạy client-side trên dữ liệu đã bake sẵn (`DATA`), không gọi server: lọc đa lựa chọn, đổi khoảng ngày (7d/30d/90d), sort/tìm kiếm/phân trang bảng, lọc chéo theo Dự án/Định dạng, đổi theme, ⌘K, chuyển view Operational/Executive. Sau migration **không đổi gì** — mở trang còn nhanh hơn (file tĩnh, không chờ query). Với người xem thông thường (lãnh đạo, team CM): thao tác hằng ngày **y nguyên**.

**Khác — ở việc dữ liệu mới xuất hiện thế nào:**

| | Hiện tại (động) | Sau migration (tĩnh) |
|---|---|---|
| F5 / mở lại trang | Đọc DB → ra số mới nhất **ngay** | Ra lại **bản build gần nhất**; số mới chỉ có sau khi schedule chạy (≤1h) |
| Tự reload 15' (`setInterval … location.reload`) | Mỗi reload số **nhích dần** theo DB | Reload ra **cùng một bản tĩnh** → vô nghĩa về độ tươi: **bỏ**, hoặc đổi thành reload để nhận bản build mới |
| Badge nguồn/cập nhật | Phản ánh thời điểm **đọc DB** | Phản ánh thời điểm **build** |

**Khác biệt đáng kể nhất — dành cho admin bắt dữ liệu.** Hiện tại admin có vòng lặp tức thì: mở Pro Dashboard → **Ctrl+Shift+Y** (userscript POST `/api/ingest`) → **F5 dashboard → thấy số mới ngay** để kiểm chứng. Sau migration, **động tác bắt y nguyên** (userscript chỉ đổi URL đích về nội bộ) **nhưng** POST ingest xong **không thấy ngay** — phải đợi lần build kế tiếp (≤1h). Mất vòng "bắt → F5 → kiểm chứng tức thì"; admin tin dữ liệu đã vào DB qua phản hồi userscript thay vì xác nhận bằng mắt.

→ **Hai việc cần làm khi migrate** (nếu muốn giữ trải nghiệm kiểm chứng của admin): (a) **trigger build ngay sau ingest** (ingest server gọi pipeline / chạy `sync.js`) để F5 sau ~1–2' là thấy; (b) **xử lý `setInterval reload 15'`** trong `fb-dashboard.js` — trên bản tĩnh phải bỏ hoặc đổi đúng nghĩa "tải lại để nhận bản build mới", khớp chu kỳ schedule.

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
| 1 | Cấp **schema MySQL nội bộ** mới (~100MB cho cả 2, tái dùng DB có sẵn của NHS — không xin DB riêng) | Quang Doan Van (DevOps) | 🟡 **Nhận cover** — chờ QA anh Quốc Anh duyệt |
| 2 | **GitLab CI runner** connect được DB đó (để `sync.js` đọc DB lúc build) | Quang Doan Van | 🟡 **Nhận cover** — chờ QA anh Quốc Anh duyệt |
| 3 | Deploy thêm **1 service Node (:3001)** có port riêng, chạy thường trực song song app tĩnh hiện tại (`cm-dashboard` trên ArgoCD/EKS) | Quang Doan Van | 🟡 **Nhận cover** — chờ QA anh Quốc Anh duyệt |
| 4 | Tạo/mở rộng **GitLab repo** nội bộ + cấp quyền (tái dùng pattern CI/CD của `cm-dashboard`: registry `gitlab-nhs.shb.com.vn:5050` → ECR → ArgoCD) | Quang Doan Van (GitLab Admin) | ✅ Repo mẫu đã có sẵn (`cm-dashboard`), chỉ cần mở rộng |
| 5 | Cấp **DNS subdomain** nội bộ (1 domain chung, dạng `*.dev-saha.aws.shb.com.vn`) | Mạnh (System) | Chờ |
| 6 | Máy **admin chạy userscript** reach được domain nội bộ để POST `/api/ingest` | CM Team | ✅ **CÓ** (đã xác nhận) |
| ~~7~~ | ~~Egress tới graph.facebook.com~~ | — | **Không cần** (đã bỏ `fetch.js` — Phương án A) |

**Cập nhật 03/07/2026:** Đã trao đổi với **Quang Doan Van (DevOps)** trên Teams — anh xác nhận **nhận cover cả 3 điểm hạ tầng mới** (schema MySQL, runner connect DB, service Node port riêng trên EKS), chỉ chờ **anh Quốc Anh duyệt (QA)**. → Bước tiếp theo: **gửi email trình bày kế hoạch cho anh Quốc Anh (cc anh Quang)** để xin duyệt, không cần họp riêng từng điểm kỹ thuật nữa vì DevOps đã thống nhất phương án.

**Lưu ý:** egress Internet không còn là điều kiện chặn nhờ bỏ `fetch.js`. Beacon Email (Outlook) và POST userscript (browser admin) đều phát từ **trong mạng SHB** tới domain nội bộ — đã xác nhận khả thi (câu 6). Ngoài ra, đã xác nhận repo `cm-dashboard` (dashboard Jira nội bộ có sẵn của team CM) dùng đúng pattern hạ tầng cần thiết (GitLab CI → registry nội bộ → AWS ECR → ArgoCD → EKS), nên phần build/deploy tĩnh không còn là ẩn số — chỉ cần bổ sung phần DB + service ingest thường trực.

---

## 7. Kế hoạch thực hiện

### Giai đoạn 0 — Chuẩn bị (1–2 tuần)
- [x] Trao đổi Quang (DevOps): xác nhận sẽ cover schema MySQL + runner connect DB + service Node port riêng (câu 1–3) — chờ QA.
- [ ] Gửi email trình bày kế hoạch cho anh Quốc Anh (cc anh Quang) xin duyệt (QA).
- [ ] Thống nhất 1 DNS chung với Mạnh (câu 5).
- [ ] Export toàn bộ data: Supabase Email (`events`, ~40k) + Supabase FB (`fb_group_posts`, `fb_page_insights`).
- **Điều kiện sang G1:** anh Quốc Anh duyệt (QA) ✅.

### Giai đoạn 1 — Code migration + hợp nhất (5–7 ngày)
> Bắt đầu từ repo unified `shb-dashboard-Facebook` (đã gộp ở §1.3) — KHÔNG còn bước "gộp repo".

| Task | Mô tả | Trạng thái |
|---|---|---|
| `api/email-track.js` + `api/fb-ingest.js` | Vercel handler → Node HTTP server (:3001) (thêm `url.parse()` thủ công ~10 dòng cho track); giữ check `x-ingest-secret` | ✅ `server/ingest-server.js` + `server/vercel-compat.js` — test chạy local OK |
| **Bỏ `api/fb-fetch.js`** | Theo Phương án A — userscript là nguồn FB duy nhất, server khỏi egress | ✅ **06/07/2026**: đã xoá file + cron trong `vercel.json` (repo `shb-dashboard-media`) |
| `sync.js` chung | Đọc DB nội bộ (events + fb_*) → bake HTML cho `portal/fb-dashboard/email-dashboard/leader-dashboard` (thay tầng đọc Supabase REST) | ✅ `sync.js` — gọi lại đúng handler cũ qua shim, test build ra 4 file HTML |
| Đổi env DB | `SUPABASE_*` (FB) + `EMAIL_SUPABASE_*` (Email) → credentials DB nội bộ | ✅ `lib/db-client.js` (MySQL, xác nhận với Quang 09/07 — ảnh Teams) dịch lại cú pháp PostgREST của `sbGet()`/`fbGet()`/`fetchLogs()` sang SQL; bật bằng env `MYSQL_HOST`, không set thì fallback Supabase như cũ. `db/schema.mysql.sql` — bảng `events` suy ra từ code, **đang chờ Quang xác nhận** trước khi chạy thật. Chưa test với MySQL thật |
| `Dockerfile` + `.gitlab-ci.yml` | ingest (Node :3001) + dashboard (nginx static) + schedule sync | ✅ Đã merge vào repo `cm-dashboard` thật (nhánh `merge-email-facebook`, MR `!3`) — Pipeline chạy PASS (`sync_data`/`pages`/`aws-authen-cicd`). `docker_build_ecr`/`update_helm_value` chỉ chạy trên `main` (chưa merge nên chưa test được) |
| Font | Google Fonts → font nội bộ/system | ✅ Đã bỏ hết `<link>` tới `fonts.googleapis.com`/`fonts.gstatic.com` ở 4 dashboard, fallback system-ui/monospace |
| Cập nhật bộ thu thập | VBA: đổi URL beacon sang nội bộ · Userscript: đổi `INGEST` URL + `@connect` nội bộ | ⬜ Chưa làm (chờ có DNS nội bộ thật) |
| Test | Toàn bộ chức năng (2 tab) trên dev | ⬜ Mới test cục bộ với mock data, chưa test trên môi trường EKS/MySQL thật |

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

## 7b. Tính năng BỔ SUNG khi vào nội bộ: Đo thời gian đọc email (dwell)

> **Trạng thái (02/07/2026): đã build + test xong, nhưng GỠ khỏi bản Vercel — chờ hạ tầng nội bộ.**

**Cơ chế (kiểu Litmus):** pixel `top` không trả ảnh ngay mà stream nhỏ giọt (GIF thiếu trailer + comment-block mỗi 2s). Email còn mở → client còn giữ kết nối; đóng email → client hủy tải → server đo được số giây đọc, ghi event `pos='dwell'` + cột `dwell_s`. Event `top` vẫn ghi ngay khi request đến nên lượt mở không chậm đi.

**Vì sao gỡ trên Vercel:** proxy của Vercel **không truyền tín hiệu client ngắt kết nối** vào function — đã kiểm chứng thực tế trên production đủ 3 kiểu: `(req,res)` Node, Web Handler Node + Fluid compute ON, và Edge runtime. Cả 3 đều không nhận abort → dwell luôn "chạm trần" (bằng đúng cap 25s) bất kể người dùng đóng lúc nào → số liệu vô nghĩa. Logic đo đã được test đúng ở môi trường Node thuần (ngắt 2s→ghi 2s, 3s→3s, cap→cap).

**Khi migrate vào nội bộ sẽ đo được:** server nội bộ (EKS/nginx/Node) nhận kết nối TCP trực tiếp từ Outlook desktop — sự kiện `close` bắn ngay khi người đọc đóng email. Đây chính là lý do tính năng này nằm trong kế hoạch nội bộ.

**Cách bổ sung lại (đã có sẵn hết, không phải thiết kế lại):**
- Code endpoint hoàn chỉnh: git history nhánh `claude/email-reading-time-measurement-nrytc2` — bản Node/CJS tại commit `3fe516c` (`api/email-track.js` v3.6, chạy tốt trên server thường) hoặc bản web-standard tại `56a82c5` (`api/email-track.mjs` v4.1).
- Code dashboard (panel "Thời gian đọc email" + cột "Đọc TB" + nhóm chạm trần): commit `f724bca` (`api/email-dashboard.js`).
- DB: cột `dwell_s` **đã tồn tại** trong bảng `events` (migrate_05 đã chạy trên Supabase Email) — nhớ mang theo khi export/import.

**Bài học đã trả giá (giữ lại khi bật):**
1. Loại proxy (`GoogleImageProxy`, security gateway) khỏi phép đo — chúng tải hộ, không phải người đọc.
2. Outlook mobile (iOS) tải ảnh ngầm, không ngắt kết nối khi đóng email → luôn chạm trần. Dashboard phải tách nhóm "chạm trần ≥cap" khỏi median (đã làm sẵn trong commit `f724bca`).
3. Ghi event dwell **trước khi** đóng response — ghi sau có thể bị runtime freeze nuốt mất.
4. Email đã mở từ trước sẽ bị client cache pixel → chỉ email gửi MỚI (sau khi bật) mới đo được từ lần mở đầu.
5. Dòng `dwell` xuất hiện muộn tối đa ~cap giây sau khi mở — kiểm thử phải đợi rồi mới query.

---

## 7c. Hợp nhất thêm Jira dashboard (`cm-dashboard`) vào cùng portal

> **Quyết định:** không xin repo GitLab mới, không xin domain mới. **Mở rộng repo `cm-dashboard` đã có** (tái dùng đúng pattern CI/CD: GitLab CI → registry nội bộ → ECR → ArgoCD → EKS đang chạy sẵn cho Jira dashboard) làm nơi build portal hợp nhất 3 tab **Email / Facebook / Jira**, phục vụ chung 1 URL nội bộ. Chỉ team CM xem nên gộp chung tiện theo dõi; không có rủi ro kỹ thuật đáng kể nếu tách đúng theo route.

**Đính chính (06/07/2026, sau khi xem code thật của `cm-dashboard`):** Jira dashboard **cũng build tĩnh**, không phải đọc động như dự đoán ban đầu — `sync.js` gọi thẳng Jira REST API (`/rest/api/3/search/jql`) trong CI stage `sync_data`, ghi ra `public/data.json`; `index.html` là 1 SPA React (nhúng UMD bundle React/Recharts/html2canvas/jsPDF vào `public/vendors/` ngay trong Docker build, không gọi CDN) đọc `data.json` client-side. Vậy cả 3 dashboard (Jira/Email/Facebook) đều là **static + refresh theo schedule**, chỉ khác input: Jira gọi REST API trong lúc build, Email/Facebook đọc DB nội bộ trong lúc build.

**Pattern hạ tầng thật đã xác nhận** (từ `.gitlab-ci.yml`/`Dockerfile`/`nginx.conf` gốc, xem file trong repo `shb-dashboard-media`):
- Base image nội bộ `gitlab-nhs.shb.com.vn:5050/omnichannel/omni-devops/ci-template/node:20-nginx-amd` (node+nginx gộp sẵn) và `node:20-alpine-amd` cho stage sync.
- Registry **đẩy image thật là AWS ECR** (`$AWS_ECR_CICD`), KHÔNG phải registry GitLab `:5050` (cái đó chỉ để **pull** base image) — khác với suy đoán ban đầu ở mục 6 câu 4.
- Pipeline: `sync_data` → `pages` (expose lại `public/` — dùng cho preview) → `aws-authen` (lấy token ECR qua AWS CLI) → `docker_build_ecr` (build + push ECR, chỉ chạy trên `main`) → `update_helm_value` (login ArgoCD, `argocd app actions run $APP_NAME restart --kind Deployment`) — **không phải `kubectl set image`** như bản nháp ban đầu.
- `nginx.conf` thật: cổng 80 (không phải 8080), có `/health`, gzip, security headers, SPA fallback `try_files ... /index.html`.

**Nguyên tắc hợp nhất:** portal vẫn là lớp vỏ chuyển tab, 3 dashboard là 3 route độc lập bake tĩnh theo đúng 1 pipeline chung ở trên. Khác biệt kiến trúc thật sự duy nhất so với Jira: Email/Facebook cần **1 service Node (:3001) chạy thường trực** để nhận beacon/POST real-time (Jira không cần, chỉ đọc REST theo lịch) — nên cần build/deploy thêm 1 image `Dockerfile.ingest` + 1 ArgoCD Deployment nữa, còn lại dùng chung đúng 1 pipeline/registry/ArgoCD app pattern.

**Các bước:**
1. **Thêm route thứ 3** — đưa code hiện tại của `cm-dashboard` (Jira, gồm `sync.js` phần Jira + `index.html` SPA) vào project hợp nhất dưới route riêng (vd `/api/jira` bake ra `public/api/jira/`), giữ nguyên logic gọi Jira REST API + cách chuẩn hoá hạng mục (`HANG_MUC_PATTERNS`).
2. **Sửa `portal.js`** — thêm tab thứ 3 (nút chuyển + iframe same-origin trỏ route Jira), theo đúng pattern lazy-load + giữ trạng thái đang dùng cho Email/Facebook.
3. **nginx.conf** — thêm location cho route Jira (static + `try_files` về `index.html` riêng của SPA đó vì nó tự route client-side, khác 2 dashboard kia là HTML tĩnh 1 trang).
4. **Tách secret theo namespace** — `JIRA_TOKEN`/`JIRA_EMAIL` để riêng, không chung với `MYSQL_*`/`SUPABASE_*`.
5. **1 pipeline chung, 2 image dashboard** — `sync.js` hợp nhất chạy cả phần Jira (fetch REST) lẫn phần Email/Facebook (đọc MySQL) trong cùng 1 stage `sync_data`, output vào cùng `public/`; build cùng 1 `Dockerfile.dashboard`. Thêm riêng `Dockerfile.ingest` + 1 job build/deploy cho service Node — xem TODO trong `.gitlab-ci.yml`.
6. **Test song song** — chạy thử cả 3 tab trên môi trường dev trước khi cutover.

**Không cần xin thêm so với mục 6**, nhưng cần Quang xác nhận: APP_NAME ArgoCD nào cho service Node ingest mới (dùng chung `cm-dashboard` hay tách app riêng `cm-dashboard-ingest`) — đã đánh dấu TODO trong `.gitlab-ci.yml`.

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
