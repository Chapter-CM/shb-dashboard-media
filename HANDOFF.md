# HANDOFF — SHB CM Dashboard (HỢP NHẤT Email + Facebook, cập nhật 25/06/2026)

> Repo này giờ là **bản hợp nhất 1 repo + 1 Vercel** cho cả 2 dashboard CM.
> Live (portal): https://shb-fb-dashboard.vercel.app/ → tab **Facebook | Email**.
> Branch dev: `claude/laughing-ride-5tk6cn` → PR vào `claude/loving-planck-y6lw57` (production, Vercel auto-deploy).

## 🧩 Cấu trúc HỢP NHẤT (1 repo + 1 Vercel) — PR #33
Tên file = **route**; đặt theo sản phẩm để mở ra hiểu ngay. URL cũ giữ nguyên qua `rewrites` (không cần sửa VBA/userscript).

| File (route) | Vai trò | Env / nguồn | Alias URL cũ (rewrite) |
|---|---|---|---|
| `api/portal.js` | **Portal** — header SHB + tab Facebook/Email (iframe, `#hash`) | — | `/` |
| `api/fb-dashboard.js` | Dashboard Facebook (**file UI chính**) | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | `/api/facebook` |
| `api/email-dashboard.js` | Dashboard Email (copy từ email-tracker-data/dashboard.js) | `EMAIL_SUPABASE_URL`, `EMAIL_SUPABASE_SERVICE_KEY` | `/api/email` |
| `api/fb-ingest.js` | Nạp bài Group từ userscript (FB) | `SUPABASE_*` + `INGEST_SECRET` | `/api/ingest` |
| `api/fb-fetch.js` | Cron Graph API FB (phụ; migration nội bộ sẽ bỏ) | `SUPABASE_*` + `FB_*` | (cron) |
| `api/email-track.mjs` | **Beacon Email** (pixel/click/read + **dwell**) — Web Handler v4.0 | `EMAIL_SUPABASE_*` | `/api/track` |
| `vercel.json` | rewrites giữ URL cũ; cron `/api/fb-fetch`; maxDuration | — | — |
- **1 Vercel project** `shb-fb-dashboard` chạy tất cả. URL công khai (qua rewrite) giữ nguyên: `/` · `/api/facebook` · `/api/email` · `/api/ingest` · `/api/track`. Userscript (`/api/ingest`) & VBA (`/api/track`) KHÔNG cần đổi.
- ⚠️ **Đồng bộ**: `api/email-dashboard.js` + `api/email-track.js` là **bản copy** từ repo `email-tracker-data`. Sửa gốc thì đồng bộ lại (hoặc ngược lại). Sau migration nội bộ repo email gốc nghỉ hẳn.
- ✅ **VBA đã cập nhật**: `CampaignTracker.bas` v4.9 (repo email-tracker-data) đã đổi `TRACK_URL` → `shb-fb-dashboard.vercel.app/api/track`. User cần cài bản này vào Outlook + test trước khi tắt Vercel email cũ.
- 🧹 Nhánh `claude/cm-portal` + `claude/friendly-cannon-m06mlh` — xoá thủ công trên GitHub (đã merge/cũ).

## ⏱️ Thời gian đọc email (dwell) — v3.6
Outlook tải mọi ảnh cùng lúc khi mở mail → delta pixel top/bottom vô nghĩa. Giải pháp = **pixel streaming kiểu Litmus**:
- `api/email-track.mjs` (v4.0, **Web Handler** `Request→Response`) với `pos=top` (và `bottom` nếu email cũ còn) KHÔNG trả pixel ngay mà **stream nhỏ giọt** qua `ReadableStream` (GIF thiếu trailer + comment-block mỗi 2s). Event top vẫn ghi NGAY khi request đến (lượt mở không chậm). Email còn mở → client còn giữ kết nối; đóng email → client hủy tải → `stream.cancel()`/`request.signal` bắn → server đo được số giây, ghi event `pos='dwell'` + cột `dwell_s`. Cap `EMAIL_DWELL_CAP_S` (mặc định 25s; `vercel.json` maxDuration 30s). VBA hiện chỉ nhúng 1 pixel top — dwell đo trên top.
- ⚠️ **Phải là Web Handler + Fluid compute**: bản cũ kiểu `(req,res)` KHÔNG nhận được tín hiệu client ngắt qua proxy Vercel → dwell luôn chạm trần 25s (đã kiểm chứng thực tế). Ghi dwell được giữ sống bằng `waitUntil` (`@vercel/functions`, xem `package.json`) + `await` trong `cancel()`. Nếu dwell lại toàn 25s → kiểm tra Project Settings → Functions → **Fluid Compute = ON**.
- Dashboard tách nhóm **"Chạm trần ≥25s"** khỏi median (Outlook mobile tải ảnh ngầm không ngắt kết nối → luôn 25s, không phân biệt được với đọc lâu).
- Proxy (GoogleImageProxy/gateway) tải hộ → nhận pixel thường, không đo (regex `isImageProxy`).
- **Go-live cần**: chạy `db/migrate_05_email_dwell.sql` trong Supabase **EMAIL** (thêm cột `dwell_s`). Chưa chạy migration → insert dwell fail (log lỗi, không ảnh hưởng tracking cũ); dashboard fetch dwell bằng query RIÊNG nên không vỡ.
- Dashboard: panel "Thời gian đọc email" (median + Đọc kỹ ≥8s / Đọc lướt 2–8s / Liếc qua <2s — chuẩn Litmus), cột "Đọc TB" trong bảng chiến dịch, mục từ điển. `readSec` mỗi session = max(dwell). VBA **không cần đổi**.

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

## 🔭 Migration vào nội bộ SHB (định hướng lớn)
`KE_HOACH_MIGRATION.md` (có ở CẢ 2 repo `shb-dashboard-Facebook` + `email-tracker-data`, branch `claude/laughing-ride-5tk6cn`) = **kế hoạch HỢP NHẤT** chuyển 2 dashboard (Email + Facebook) vào hạ tầng nội bộ SHB (GitLab/EKS/DB nội bộ) và gộp thành 1 trang 2 tab.
- Userscript TM ↔ VBA macro: "bộ thu thập ngoài, chỉ đổi URL" — KHÔNG cần đưa vào trong.
- Câu 7 (admin reach domain nội bộ) = **CÓ**. Câu 8 (egress facebook.com): chọn **Phương án A = BỎ `api/fetch.js`** (đã kiểm chứng `loadData` chạy đủ với dữ liệu userscript) → server không cần egress.
- Xin hạ tầng DÙNG CHUNG 1 lần (1 DB/repo/pipeline/DNS) để khỏi migrate 2 lần rồi gộp.
- Bước tiếp đề xuất: chốt domain/người phụ trách/mốc với IT; (tuỳ chọn) phác schema DB chung cho phần gộp.

## Lưu ý kỹ thuật
- Sửa `api/facebook.js` xong: `node --check api/facebook.js`.
- Test UI nhanh: render server-side ra HTML rồi mở bằng headless Chromium (`/opt/pw-browsers`, `NODE_PATH=/opt/node22/lib/node_modules`) bắt lỗi JS — mock data nên một số chỉ số per-post = 0 và dự án gom "Khác".
- Browser code nằm trong `clientCode()` (extract bằng toString) — không dùng Node API; chỉ nhận `DATA, TARGET_ER, MIN_N`.
- Deploy = tạo PR `laughing-ride` → merge vào `loving-planck` (Vercel auto-deploy). **Lưu ý merge ĐÚNG commit cuối** — trước đây từng merge sớm làm sót commit.
