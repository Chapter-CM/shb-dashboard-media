# HANDOFF — SHB CM Dashboard (HỢP NHẤT Email + Facebook, cập nhật 06/07/2026)

> Repo này giờ là **bản hợp nhất 1 repo + 1 Vercel** cho cả 2 dashboard CM.
> Live (portal): https://shb-fb-dashboard.vercel.app/ → tab **Facebook | Email**.
> Quy trình: branch dev → PR vào `claude/loving-planck-y6lw57` (production, Vercel auto-deploy).
> Branch dev gần nhất: `claude/email-reading-time-measurement-nrytc2` (PR #56–61, đã merge hết).

## 🚧 ĐANG DỞ — Merge vào `cm-dashboard` (GitLab nội bộ) — CHỐT NGÀY 06/07/2026

**Bối cảnh:** Thực hiện §7c trong `KE_HOACH_MIGRATION.md` — mở rộng repo `cm-dashboard`
(Jira dashboard nội bộ, `gitlab-nhs.shb.com.vn/cm/cm-dashboard`) thành portal 3 tab
Facebook | Email | Jira, thay vì xin repo/domain mới.

### Trạng thái 2 repo — cập nhật 07/07/2026

**GitHub `shb-dashboard-media`**: ✅ **Đã merge PR #76 vào `claude/loving-planck-y6lw57`** (production,
Vercel auto-deploy) — 7 commit tối 06/07 (portal fix, Jira embed, rà soát 6 lỗi, snapshot
cm-dashboard gốc...) đã lên bản mới nhất trên GitHub. = NGUỒN CHUẨN, chứa bản MỚI NHẤT của mọi thứ:
- Hạ tầng: `sync.js` v4 (gộp Jira + Email/FB), `lib/db-client.js` (đọc **và ghi** MySQL,
  fallback Supabase), `server/ingest-server.js`, `Dockerfile.dashboard/.ingest`,
  `nginx.conf`, `.gitlab-ci.yml` (khớp pattern thật: AWS ECR + argocd restart + vendors + needs).
- UI: portal 3 tab (route `/api/facebook|/api/email|/api/jira/`), logo bấm về tab mặc định,
  badge thời điểm build, font thương hiệu nhúng base64 (`lib/fonts.js`).
- Jira SPA (`reference/cm-dashboard-original/public/index.html`): chế độ embed cho portal
  (dải 63px cho thanh tab, ẩn brand trùng; mở trực tiếp y nguyên) — đã test 2 chế độ bằng
  chromium, đủ tính năng (⌘K, Tuỳ chỉnh, CSV/PDF, modal...).
- Tổng rà soát tối 06/07 bắt + fix 6 lỗi deploy (đường ghi MySQL cho beacon/ingest, guard
  mock 3 dashboard, needs sync_data, pin babel@7, Dockerfile.ingest thiếu lib, đối chiếu
  schema) — chi tiết ở commit `ddfa274`.

**GitLab `cm-dashboard`** (nhánh `merge-email-facebook`, **MR `!3` đang mở**, pipeline PASS):
= ĐANG TỤT HẬU so với GitHub. Đã có: code merge đợt đầu + DEVOPS_NOTES.md + portal
sửa route + font. **CHƯA có:**
- 9 file fix của đợt rà soát tối 06/07 (danh sách + lệnh copy: `GITLAB_COPY_LIST.md`).
- 2 file bổ sung gửi sau đó cùng tối: `index.html` (Jira SPA — thêm chế độ embed, đồng bộ
  masthead 63px với 2 dashboard kia) → đích `public/api/jira/index.html`, và `.gitlab-ci.yml`
  (thêm bước tạo `/vendors/` trong job `sync_data`, thiếu bước này thì tab Jira sẽ trắng trơn
  khi build thật) → đích `.gitlab-ci.yml`.

### ✅ VIỆC ĐẦU TIÊN — CHƯA XONG
1. Giải nén `gitlab-sync.zip` (đã gửi trong chat 06/07 tối; nguồn cũng nằm trong repo này)
   vào `Downloads\gitlab-sync`, rồi làm đúng theo **`GITLAB_COPY_LIST.md`** (9 lệnh copy +
   commit + push có sẵn từng dòng).
2. Copy tiếp 2 file bổ sung ở trên (`index.html`, `.gitlab-ci.yml`) — ghi đè bản vừa copy ở
   bước 1 nếu trùng tên.
3. Kiểm tra pipeline MR `!3` PASS sau khi push.

### Sau đó — chờ/thực hiện theo phản hồi anh Quang (đã hỏi 3 việc qua Teams 06/07)
- [ ] Nhận **MySQL credentials** → điền CI/CD Variables (`Settings → CI/CD → Variables`):
      `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `INGEST_SECRET`
      (INGEST_SECRET tự sinh được: `powershell -Command "[guid]::NewGuid().ToString()"`).
- [ ] Nhờ Quang **chạy `db/schema.mysql.sql`** (đối chiếu bảng `events` với schema gốc trước).
- [ ] Quang xác nhận **APP_NAME ArgoCD** cho ingest (`cm-dashboard-ingest` là tên đề xuất)
      + **tên DNS service nội bộ** của ingest → sửa `ingest-service` trong `nginx.conf` cho đúng.
- [ ] Đủ 3 điều trên → **merge MR `!3` vào `main`** → theo dõi `docker_build_ecr` +
      `update_manifest_*` (LẦN ĐẦU chạy thật, chỉ chạy trên main) → mở URL nội bộ
      `cm-dashboard.dev-saha.aws.shb.com.vn` kiểm tra portal 3 tab.
- [ ] Sau deploy OK: test beacon email + userscript ghi vào MySQL thật (checklist §11 kế hoạch).

### Ghi chú cho phiên mai
- User thao tác GitLab qua git CLI trên máy Windows (`%USERPROFILE%\cm-dashboard`, đã cài
  git + có PAT); KHÔNG dùng Web IDE upload (từng lỗi âm thầm). Copy file → `git add` →
  commit → push là quy trình chuẩn.
- Claude KHÔNG truy cập được GitLab nội bộ — mọi thay đổi sang GitLab đều qua tay user
  (gửi file → user copy). Sửa code luôn làm ở repo GitHub này trước rồi đóng gói gửi.
- PR #76 trên GitHub có thể merge lúc nào cũng được (chỉ là đồng bộ tài liệu/code nội bộ team).
- Vercel production (`shb-fb-dashboard.vercel.app`) KHÔNG bị ảnh hưởng bởi mọi thay đổi
  trên — fallback Supabase giữ nguyên hành vi cũ khi không có `MYSQL_HOST`.

## 🧩 Cấu trúc HỢP NHẤT (1 repo + 1 Vercel) — PR #33
Tên file = **route**; đặt theo sản phẩm để mở ra hiểu ngay. URL cũ giữ nguyên qua `rewrites` (không cần sửa VBA/userscript).

| File (route) | Vai trò | Env / nguồn | Alias URL cũ (rewrite) |
|---|---|---|---|
| `api/portal.js` | **Portal** — header SHB + tab Facebook/Email (iframe, `#hash`) | — | `/` |
| `api/fb-dashboard.js` | Dashboard Facebook (**file UI chính**) | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | `/api/facebook` |
| `api/email-dashboard.js` | Dashboard Email (copy từ email-tracker-data/dashboard.js) | `EMAIL_SUPABASE_URL`, `EMAIL_SUPABASE_SERVICE_KEY` | `/api/email` |
| `api/fb-ingest.js` | Nạp bài Group từ userscript (FB) | `SUPABASE_*` + `INGEST_SECRET` | `/api/ingest` |
| `api/email-track.js` | **Beacon Email** (pixel/click/read) — v3.5 | `EMAIL_SUPABASE_*` | `/api/track` |
| `vercel.json` | rewrites giữ URL cũ; maxDuration | — | — |

> ✅ **06/07/2026**: đã xoá hẳn `api/fb-fetch.js` + cron tương ứng trong `vercel.json` (Phương án A, `KE_HOACH_MIGRATION.md` §3.1) — post-insights Graph đã chết, `fb-dashboard.js` không cần dữ liệu này, server hết egress ra Internet.
- **1 Vercel project** `shb-fb-dashboard` chạy tất cả. URL công khai (qua rewrite) giữ nguyên: `/` · `/api/facebook` · `/api/email` · `/api/ingest` · `/api/track`. Userscript (`/api/ingest`) & VBA (`/api/track`) KHÔNG cần đổi.
- ⚠️ **Đồng bộ**: `api/email-dashboard.js` + `api/email-track.js` là **bản copy** từ repo `email-tracker-data`. Sửa gốc thì đồng bộ lại (hoặc ngược lại). Sau migration nội bộ repo email gốc nghỉ hẳn.
- ✅ **VBA đã cập nhật**: `CampaignTracker.bas` v4.9 (repo email-tracker-data) đã đổi `TRACK_URL` → `shb-fb-dashboard.vercel.app/api/track`. User cần cài bản này vào Outlook + test trước khi tắt Vercel email cũ.
- 🧹 Nhánh `claude/cm-portal` + `claude/friendly-cannon-m06mlh` — xoá thủ công trên GitHub (đã merge/cũ).

## ⏱️ Thời gian đọc email (dwell) — ĐÃ GỠ, chờ hạ tầng nội bộ
Đã build + test đầy đủ (pixel streaming kiểu Litmus) nhưng **proxy Vercel không truyền tín hiệu client ngắt kết nối** vào function — kiểm chứng thực tế đủ 3 runtime: `(req,res)` Node, Web Handler Node + Fluid ON, Edge. Cả 3 đều làm dwell luôn chạm trần 25s → số liệu vô nghĩa → gỡ khỏi bản Vercel (02/07/2026).
- Chi tiết cơ chế, code tham chiếu (commit `3fe516c`, `56a82c5`, `f724bca`) và 5 bài học triển khai: xem **`KE_HOACH_MIGRATION.md` mục 7b** — sẽ bổ sung khi migrate vào hạ tầng nội bộ SHB (server nội bộ nhận kết nối trực tiếp nên đo được).
- Cột `dwell_s` vẫn tồn tại trong bảng `events` (migrate_05 đã chạy) — dashboard fetch với `pos=not.in.(sent,dwell)` để bỏ qua event dwell còn sót.
- Fix đi kèm ĐƯỢC GIỮ LẠI: cột "Đã mở (lượt)" bảng chiến dịch hiển thị đúng số LƯỢT (`openEvents`) thay vì số người.

## Kiến trúc dữ liệu
```
Userscript (tools/shb-content-library.user.js v3.6, Tampermonkey)
  ├─ Content Library  → per-post  → /api/ingest → fb_group_posts (+ cột metrics jsonb: full chỉ số per-post)
  └─ Page Insights    → page-level → /api/ingest {kind:'page'} → fb_page_insights (metrics + series jsonb)
api/fb-dashboard.js  → đọc cả 2 bảng, render 1 trang HTML (clientCode extract bằng toString)
```
- **Bắt dữ liệu**: mở `professional_dashboard` của SHB → **Ctrl+Shift+Y** (auto-tour) hoặc F5 từng trang.
  Quan trọng: đặt **khoảng ngày rộng** (vd 1/11–25/6) ở từng trang để chuỗi dài.
- Migrations đã chạy: `db/migrate_03_page_insights.sql`, `migrate_04_post_metrics.sql`.

## Nguyên tắc chỉ số (QUAN TRỌNG)
- **3 chỉ số chính: ER%, Lượt xem, Lượt tương tác.** Follower KHÔNG quan trọng (bài Group).
- **Số hiển thị ĐẦY ĐỦ, không viết tắt K/M** — `nfk()` và `tnum()` hiện đều = `nf()` (định dạng VN đầy đủ).
- **Ngày hoạt động vs Ngày đăng**:
  - Thẻ/chart Lượt xem, Lượt tương tác, ER → **ngày hoạt động** (chuỗi `views/interactions_time_series`), co theo date-range.
  - Bảng Nội dung → **ngày đăng** (per-post).
  - **Lượt hiển thị & Bình luận** → LUÔN cộng tổng per-post: `sumPm(cur,'impression')` / `Σ comments`. Lọc thì cộng theo nội dung đang lọc.
  - **Người xem (duy nhất)** → số tổng cấp trang (`metricsMax.viewers`, `pg()` fallback per-post khi lọc).
  - **Lượt tiếp cận** = Σ người xem mọi bài kể cả trùng = `sumPm(cur,'viewers')`. **Tỉ lệ tiếp cận** = Lượt tiếp cận ÷ Lượt xem.
- `buildPageInsights()` UNION điểm theo ngày qua mọi lần bắt; `seriesMap` chuẩn hoá {views,interactions,followers}.
- Lọc chéo (cFil) → thẻ/chart tự về per-post (chuỗi page-level không cắt theo nội dung được).

## Cấu trúc UI hiện tại (sau PR #32)
- **Tổng quan (`heroRow`)**: layout **2 hàng** — gauge (340px) + lưới KPI 3 cột × 2 hàng (KHÔNG bento, KHÔNG icon, KHÔNG viền màu).
  - **Gauge**: số to = Tổng Lượt xem; vòng cung = **Tỉ lệ tiếp cận** (= Lượt tiếp cận ÷ Lượt xem), đổi theo lọc nội dung. Cung trắng ĐẶC (đã bỏ glow/gradient gây vệt mờ); 0% chỉ hiện track; không vẽ tick "mục tiêu" khi target≥100.
  - 6 card đồng nhất: Lượt tương tác · ER · Lượt tiếp cận · Người xem · Lượt hiển thị · Bình luận. Mỗi card 1 dòng phụ `.ksub` muted.
- **Xu hướng theo thời gian** (`heroChart`): chart ngày + **annotation đánh dấu ngày đỉnh** (▲).
- **Nội dung** (`contentSection`): bảng per-post, cột **"Tỉ lệ tiếp cận"** (= viewers÷views). ĐÃ BỎ cột "Theo dõi +". Tab Tất cả / Video-Reel-Live.
- **Phân tích** (`mixSection`): tỉ trọng Lượt xem + ER theo định dạng. ĐÃ BỎ "Theo chủ đề".
- **Dự án / Squad** (`goalSection`, id `#s-goal`): nhóm bài theo **`projectOf()`** (nhận diện từ nội dung, không phân biệt hoa thường/dấu). Không khớp → "Khác". Bấm để lọc chéo (`_filter.project`).
- **Khung giờ** (`timingPanel`): best time tính theo **NGƯỜI XEM** (heat += mediaViewers).
- **Đối tượng** (`audienceSection`): CHỈ còn tuổi/giới tính + ghi chú (đã bỏ 4 card tier).
- **Insight / Sức khỏe / Từ điển**: như cũ.
- **Bộ lọc** (`filterBar`): **MULTI-SELECT** — Mọi bài viết · Dự án · Định dạng · Khung giờ · Loại ngày (ĐÃ BỎ Media).
  - `_filter[key]` là **MẢNG** giá trị; `setFilter(k,v)` toggle in/out; `matchFilter` dùng membership (`inF`); highlight dùng `isSel`.
  - Dropdown `msel` (class `.msel-dd` riêng để khỏi đụng date-popover `.csel-dd`); có **ô tìm kiếm** khi >6 lựa chọn (`mselSearch` lọc live); `_openMsel` giữ dropdown mở qua mỗi `paint()`.
  - Lọc "Mọi bài viết": pairs `[id, "ngày · tiêu đề"]`. Chip ở `filterStatusBar` bung mỗi giá trị 1 chip.
- **ĐÃ BỎ**: Phễu hiệu quả, Ma trận Phủ×Sức hút, "Tiến độ mục tiêu" (goal bars), bento grid, bộ lọc Media, "Theo chủ đề".

### Nhận diện Dự án — biến `PROJECTS` (đầu clientCode, cạnh `projectOf`)
Mảng `[tên, [từ khoá normalized]]`, khớp đầu tiên thắng (xếp cụm cụ thể trước). Hiện có:
SAHA Next Gen · SAHA Branch · SHB SAHA App · SSP · KPI · ALM · EGP · Edoc · Website · Reward ·
Sinh lời Tự động · CCS/CDS · SHB Future Lead · SHB Transformation Talk · Sunline · Chuyển tiền quốc tế.
→ Thêm/sửa dự án: edit `PROJECTS`. `GOALS={er:TARGET_ER}` chỉ còn dùng để tô màu pill ER theo dự án.

## ⚠️ Còn lại / cần chú ý
- **`projectOf`** dùng substring trên nội dung đã normalize — mã ngắn (ssp/kpi/alm/egp/ccs/cds) có thể bắt nhầm; nếu thấy bài gán sai dự án, gửi ví dụ để siết từ khoá.
- **Annotation chart**: mới đánh dấu ngày đỉnh; muốn mốc chiến dịch cần nguồn ngày chiến dịch (chưa có).
- Khi cần dữ liệu mới: nhắc user bắt lại ở **khoảng ngày rộng** trên cả 3 trang (Lượt xem / Lượt tương tác / Đối tượng).

## Lịch sử PR gần đây
- #23: fix lọc chéo thẻ Tổng quan.
- #25: lưới KPI v1 + Lượt hiển thị/Bình luận cộng per-post + design tokens + dọn 5 hàm chết.
- #26: bỏ ma trận + tiến độ mục tiêu, rà soát UI, tier thuần Việt.
- #27: chuẩn hoá lưới KPI (bỏ viền màu/đơn vị dính số) + view lãnh đạo thuần Việt.
- #28: gauge → tỉ lệ tiếp cận · Dự án/Squad từ nội dung · phễu mở rộng · best time theo người xem · gọn Đối tượng.
- #29: bỏ phễu + viết tắt K · layout 2 hàng · nhiều bộ lọc · thêm dự án EGP/SAHA Next Gen.
- #31: multi-select bộ lọc (`_filter`=mảng) · fix gauge bỏ tick lơ lửng · bỏ lọc Media.
- #32: gauge cung trắng đặc (bỏ glow) · ô tìm kiếm trong dropdown (fix `.msel-dd`) · thêm lọc "Mọi bài viết".
- #56–#61 (02/07, saga "đo thời gian đọc email"): build pixel streaming dwell → fix ghi-trước-khi-end → chuyển đo sang pixel top (VBA chỉ nhúng 1 pixel) → tách nhóm chạm trần → thử Web Handler + Edge runtime → **kết luận: proxy Vercel không truyền tín hiệu client ngắt ở CẢ 3 runtime → gỡ toàn bộ (#61), ghi vào KE_HOACH_MIGRATION.md mục 7b để bổ sung khi vào nội bộ**. Giữ lại: fix cột "Đã mở (lượt)" bảng chiến dịch = số LƯỢT (`openEvents`, trước hiển thị nhầm số người) + fetch `pos=not.in.(sent,dwell)`.

## 🔭 Migration vào nội bộ SHB (định hướng lớn, cập nhật 03/07/2026)
`KE_HOACH_MIGRATION.md` (branch `claude/internal-saas-migration-o7lc43`) = **kế hoạch HỢP NHẤT** chuyển 2 dashboard (Email + Facebook) vào hạ tầng nội bộ SHB (GitLab/EKS/DB nội bộ) và gộp thành 1 trang 2 tab.
- Userscript TM ↔ VBA macro: "bộ thu thập ngoài, chỉ đổi URL" — KHÔNG cần đưa vào trong.
- Câu 7 (admin reach domain nội bộ) = **CÓ**. Câu 8 (egress facebook.com): chọn **Phương án A = BỎ `api/fetch.js`** (đã kiểm chứng `loadData` chạy đủ với dữ liệu userscript) → server không cần egress.
- Xin hạ tầng DÙNG CHUNG 1 lần (1 DB/repo/pipeline/DNS) để khỏi migrate 2 lần rồi gộp.
- Đề xuất tái dùng hạ tầng SaaS nội bộ NHS sẵn có: 1 service Node ingest + 1 schema MySQL trên DB nội bộ có sẵn (chi phí gần như không đáng kể), đóng gói container/pod chạy trên EKS — cùng pattern CI/CD với repo `cm-dashboard` (GitLab CI → registry nội bộ → AWS ECR → ArgoCD → EKS) đã chạy thật cho dashboard Jira nội bộ của team CM.
- **Đã trao đổi Quang Doan Van (DevOps, Teams 03/07)**: nhận cover cả 3 điểm hạ tầng mới (schema MySQL, GitLab runner connect DB, service Node port riêng trên EKS) — chỉ chờ **anh Quốc Anh duyệt (QA)**.
- Bước tiếp theo: gửi email trình bày kế hoạch cho anh Quốc Anh (cc anh Quang) xin duyệt; sau khi duyệt mới sang Giai đoạn 1 (code migration).

## Lưu ý kỹ thuật
- Sửa `api/facebook.js` xong: `node --check api/facebook.js`.
- Test UI nhanh: render server-side ra HTML rồi mở bằng headless Chromium (`/opt/pw-browsers`, `NODE_PATH=/opt/node22/lib/node_modules`) bắt lỗi JS — mock data nên một số chỉ số per-post = 0 và dự án gom "Khác".
- Browser code nằm trong `clientCode()` (extract bằng toString) — không dùng Node API; chỉ nhận `DATA, TARGET_ER, MIN_N`.
- Deploy = tạo PR `laughing-ride` → merge vào `loving-planck` (Vercel auto-deploy). **Lưu ý merge ĐÚNG commit cuối** — trước đây từng merge sớm làm sót commit.
