# HANDOFF — SHB Facebook Dashboard (cập nhật 24/06/2026)

> Dashboard đo hiệu quả bài đăng Group "SHB Một Nhà" (change management / truyền thông nội bộ).
> Live: https://shb-fb-dashboard.vercel.app/api/facebook · Branch dev: `claude/friendly-cannon-m06mlh` → PR vào `claude/loving-planck-y6lw57` (production, Vercel auto-deploy).

## Kiến trúc dữ liệu
```
Userscript (tools/shb-content-library.user.js v3.6, Tampermonkey)
  ├─ Content Library  → per-post  → /api/ingest → fb_group_posts (+ cột metrics jsonb: full chỉ số per-post)
  └─ Page Insights    → page-level → /api/ingest {kind:'page'} → fb_page_insights (metrics + series jsonb)
api/facebook.js  → đọc cả 2 bảng, render 1 trang HTML (clientCode extract bằng toString)
```
- **Bắt dữ liệu**: mở `professional_dashboard` của SHB → **Ctrl+Shift+Y** (auto-tour) hoặc F5 từng trang.
  Quan trọng: đặt **khoảng ngày rộng** (vd 1/11–24/6) ở từng trang để chuỗi dài.
- Migrations đã chạy: `db/migrate_03_page_insights.sql`, `migrate_04_post_metrics.sql`.

## Nguyên tắc chỉ số (QUAN TRỌNG)
- **3 chỉ số chính: ER%, Lượt xem, Lượt tương tác.** Follower KHÔNG quan trọng (bài Group) — đã gỡ.
- **Ngày hoạt động vs Ngày đăng**:
  - Thẻ/chart Lượt xem, Lượt tương tác, ER → **ngày hoạt động** (chuỗi `views/interactions_time_series`), co theo date-range.
  - Bảng Nội dung → **ngày đăng** (per-post).
  - Người xem/Lượt hiển thị/Bình luận → số tổng cấp trang, lấy **MAX qua các lần bắt** (`metricsMax`) ≈ khoảng rộng nhất.
  - **Lượt tiếp cận** = Σ người xem mọi bài (kể cả trùng) = `sumPm(cur,'viewers')`. Tỉ lệ tiếp cận = /Lượt xem.
- `buildPageInsights()` UNION điểm theo ngày qua mọi lần bắt; `seriesMap` chuẩn hoá {views,interactions,followers}.
- Lọc theo bài/loại (cFil) → thẻ+chart tự về per-post (chuỗi page-level không cắt theo bài được).

## Đã làm (Lô 1–19)
Pipeline bắt per-post + page-level; phân biệt activity/post-date; date-range picker (chips+popover); 
chart Lượt xem/Tương tác/ER theo ngày; phễu; ma trận Phủ×Sức hút; period-over-period; executive summary; 
dọn dữ liệu giả (reaction/sentiment/velocity...); tôn 3 chỉ số chính, gỡ Follower; thẻ Lượt tiếp cận; 
fix toggle lọc chéo + giữ scroll; visual polish (eyebrow bar, KPI label).

## ⚠️ Việc cần làm tiếp (mai)
1. **Kiểm tra "Lượt hiển thị" (impression)** — đang nghi sai khi KHÔNG lọc (dùng `metricsMax.impression`).
   So với số FudFB thật; nếu lệch, cân nhắc lấy từ trang cụ thể hoặc bỏ.
2. **Roadmap UX (đã chốt thứ tự): #1 lưới KPI có icon + đơn vị + màu ngữ nghĩa → #4 design tokens →
   #2 bento grid → #5 số rút gọn (132,7K) → #8 annotation chart → #10 View Dự án/Sáng kiến + Goal tracking.**
3. **Dọn code chết**: `reactionPanel, engagementPanel, videoSection, groupSection, timingPanelMini` (định nghĩa nhưng không gọi).
4. Khi cần dữ liệu mới: nhắc user bắt lại ở **khoảng ngày rộng** trên cả 3 trang (Lượt xem / Lượt tương tác / Đối tượng).

## Lưu ý kỹ thuật
- Sửa `api/facebook.js` xong: `node --check api/facebook.js`.
- Browser code nằm trong `clientCode()` (extract bằng toString) — không dùng Node API; chỉ nhận `DATA, TARGET_ER, MIN_N`.
- Deploy = tạo PR `friendly-cannon` → merge vào `loving-planck` (production).
</content>
