# SHB Facebook Dashboard

Dashboard đo hiệu quả truyền thông Fanpage SHB. Dùng chung design system với
`email-tracker-data` để sau gộp **1 link – 2 trang** (`[ Email ] [ Facebook ]`).
Chi tiết thiết kế & bảng map chỉ số: xem [`PROPOSAL.md`](./PROPOSAL.md).

## Kiến trúc
```
Vercel Cron ─► api/fetch.js ─► Supabase ─► api/facebook.js ─► trang HTML
              (Page Graph API)  (3 bảng)    (render, fallback mock)
```
- `api/facebook.js` — render dashboard. **Tự fallback mock** khi chưa có env (preview chạy ngay).
- `api/fetch.js` — cron ingest Page API → Supabase (lõi reactions/comments/shares bằng edge expansion; views/clicks qua Insights, resilient).
- `db/schema.sql` — schema Supabase (`fb_posts`, `fb_snapshots`, `fb_page_snapshots`).
- Không build step, không framework — Node + vanilla JS thuần.

## Go-live (4 bước)
1. **Supabase:** chạy `db/schema.sql` trong SQL editor.
2. **Env vars** (Vercel Project Settings): copy từ `.env.example` — `FB_PAGE_ID`,
   `FB_PAGE_TOKEN`, `GRAPH_VERSION`, `FB_INSIGHT_METRICS`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
3. **Deploy** lên Vercel — cron (`vercel.json`) tự gọi `/api/fetch` mỗi 2h. Gọi tay
   `/api/fetch` một lần để nạp dữ liệu đầu tiên.
4. Mở `/` (hoặc `/api/facebook`) — số liệu thật hiện ngay; mock biến mất.

## ⚠️ Lưu ý quan trọng
- **Field Insights biến động:** đợt 15/06/2026 đã đổi tên metric (reach→media viewers…).
  Xác nhận `FB_INSIGHT_METRICS` với Graph API reference đúng version trước khi tin số.
- **Trend/velocity/follower-growth cần thời gian:** chúng dựng từ snapshot tích luỹ —
  càng nhiều lần fetch, biểu đồ càng đầy. Lần đầu chỉ có 1 điểm.
- **Group dashboard tạm gác:** Groups API đã chết 04/2024 — chỉ nhập tay/CSV.

## Dev
```bash
node --check api/facebook.js              # luôn check trước khi push
node -e "require('./api/facebook.js')({},{setHeader(){},send(s=>...)})"  # render thử
```
Branch phát triển: `claude/loving-planck-y6lw57`.
