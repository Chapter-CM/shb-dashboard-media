# Feeder bài Group "SHB Một Nhà"

Bài đăng trong Group **không lấy được qua Facebook Graph API** (Groups API bị Meta gỡ
22/04/2024; đã xác minh bằng 90+ call thực tế ngày 23/06/2026 — xem §"Bằng chứng").
Dữ liệu per-post (reach/người xem/tương tác) chỉ còn ở **Thư viện nội dung của
Professional Dashboard**. Feeder này nạp dữ liệu đó vào dashboard, tách rời nguồn nạp
khỏi phần hiển thị.

```
[Content Library]
   ├─ Xuất CSV ──► tools/csv-upload.html ──┐
   └─ Userscript bắt response ─────────────┤──► POST /api/ingest ──► Supabase fb_group_posts ──► dashboard (#s-group)
```

## 1. Tạo bảng (1 lần)
Chạy `db/migrate_02_group_posts.sql` trong Supabase SQL editor.

## 2. Env trên Vercel project `shb-fb-dashboard`
- `INGEST_SECRET` — chuỗi ngẫu nhiên mạnh (vd `openssl rand -hex 24`). Bắt buộc.
- (tuỳ chọn) `FB_GROUP_ID` — mặc định `503009407721580`.

Secret **chỉ** nằm ở: (1) env Vercel, (2) máy admin (trong uploader/userscript). KHÔNG commit.

## 3a. Nạp bằng CSV (sạch ToS — khuyến nghị)
1. Content Library → **Xuất dữ liệu** → tải CSV.
2. Mở `tools/csv-upload.html` bằng trình duyệt (file cục bộ).
3. Dán `INGEST_SECRET`, chọn CSV → công cụ tự nhận diện cột, xem trước → **Đẩy lên dashboard**.

## 3b. Nạp bằng userscript (tự động hơn — ToS xám)
1. Cài Tampermonkey, thêm `tools/shb-content-library.user.js`.
2. Sửa `SECRET` trong script = `INGEST_SECRET`.
3. Mở trang Content Library → script tự cuộn, bắt response, đẩy lên `/api/ingest`.

## 4. Endpoint `/api/ingest`
- `POST`, header `x-ingest-secret` phải khớp `INGEST_SECRET` (sai → 401).
- Body: mảng `[{post_id,title,permalink,created_time,reach,viewers,engagement,comments,source}]`
  hoặc `{posts:[...]}`. Chuẩn hoá phòng thủ, upsert `fb_group_posts` + append snapshot.

## 5. Hiển thị
`api/facebook.js` đọc `fb_group_posts` (order reach desc) → section **#s-group** (KPI + bảng
sort/search). Trống → empty-state hướng dẫn nạp.

## Bằng chứng API không lấy được (probe 23/06/2026)
- `/{group}`, `/{group}/feed` → `#3 Missing Permission` (v21 + v25).
- Bài group theo ID: tiền tố `{page}_`, `{group}_`, ID thuần → đều `#10`/không tồn tại.
- `/me/feed|posts|published_posts` kèm `to,target,place` → chỉ trả 1 bài timeline (ảnh bìa);
  field group bị drop.
- Post-level insights (kể cả bài timeline) → `#100 not a valid insights metric`.
- Còn sống: `followers_count`, `page_views_total`, `page_post_engagements`, `page_daily_follows`
  (cấp page/ngày — dùng cho trend trong `api/fetch.js`).
