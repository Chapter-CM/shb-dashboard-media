# HANDOFF — SHB Facebook Dashboard (cập nhật 23/06/2026)

> Đọc file này + `docs/group-feeder.md` trước khi làm tiếp.

## 0. Trạng thái hiện tại (ĐANG CHẠY)
- Dashboard **live**: https://shb-fb-dashboard.vercel.app — badge `● live`, đã gộp bài Group vào KPI tổng quan + bảng Hiệu quả nội dung.
- Feeder userscript **đã chạy thật**: nạp được ~19 bài Group qua Tampermonkey → `/api/ingest` → Supabase.
- ✅ Bài "PHÍA SAU EDOC" verify đúng 18/3/5/2 (Lượt xem/Người xem/Tương tác/Bình luận).

## 1. Kiến trúc (chốt, không làm lại)
```
Userscript (Tampermonkey, máy admin) bắt response Content Library
   └─ hoặc CSV (tools/csv-upload.html)
        → POST /api/ingest (auth x-ingest-secret) → Supabase fb_group_posts
            → api/facebook.js gộp vào DATA.posts + section #s-group
```
**API Graph đã chết hoàn toàn cho group** — đã chứng minh 90+ call (xem `docs/group-feeder.md`). KHÔNG thử lại API.

## 2. Repo / deploy
- Repo: `Chapter-CM/shb-dashboard-Facebook`. **KHÔNG có branch `main`.**
- **Default/production branch = `claude/loving-planck-y6lw57`** (Vercel deploy từ đây).
- Branch dev của Claude: `claude/friendly-cannon-m06mlh` → PR vào `loving-planck`.
- Đã merge: PR #1 (feeder+section), PR #2 (userscript v2 + gộp group).

## 3. Hạ tầng
- Supabase project `yuasevsgsgpatmpeayrk`: bảng `fb_group_posts`, `fb_group_post_snapshots` (+ fb_posts/fb_snapshots/fb_page_snapshots cũ).
- Env Vercel: `INGEST_SECRET` (đã set), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
- ⚠️ `INGEST_SECRET` đã lộ trong ảnh chụp lúc setup → **nên rotate** (đổi ở Vercel env + dòng `SECRET` trong userscript).

## 4. Cấu trúc response thật (Content Library GraphQL)
- Endpoint: XHR tới `/api/graphql/`, response có tiền tố `for(;;);`.
- Path: `data.node.prodash_content_library.edges[].node`.
- Field 1 node:
  - `title`
  - `story.url` (permalink, chứa `/permalink/{id}/`), `story.creation_time` (epoch giây), `story.target_group.id`
  - `tofu_entity.entity_id` = **post_id sạch**
  - `tofu_entity.entity_insights.{views,viewers,engagement,comment,impression,reach,net_interaction,video_*}.value`
- Userscript hook bằng **`unsafeWindow`** (sandbox bị trượt — đây là điểm mấu chốt).

## 5. Map số liệu (đang dùng)
| Dashboard | Nguồn |
|---|---|
| Lượt xem (`views`) | `entity_insights.views` |
| Người xem (`mediaViewers`) | `entity_insights.viewers` |
| Reactions | `engagement − comments` (≈, vì FB không tách) |
| Comments | `entity_insights.comment` |
| Shares | 0 (chưa tách được) |
| Tương tác tổng | = engagement (chính xác) |

## 6. VIỆC CẦN LÀM TIẾP (ưu tiên)
1. **Nạp đủ hết bài** (đang dở — mới ~19 bài). Userscript chỉ bắt các trang đã lazy-load. Cần:
   - Mở Content Library, chọn dải ngày rộng (28→90 ngày), để auto-scroll chạy hết.
   - **Cân nhắc nâng userscript**: đọc `page_info.has_next_page`/`end_cursor` để biết còn trang → chủ động cuộn/đợi đến khi `has_next_page=false`. Hiện auto-scroll dừng sau 6 nhịp tĩnh, có thể dừng sớm.
2. **Nhãn phân biệt bài Group** trong bảng Hiệu quả nội dung (đã có cờ `isGroup` trên post — chỉ cần render badge "Group").
3. Xem lại **Reactions/Shares xấp xỉ** — quyết định giữ heuristic hay ẩn 2 cột này cho bài Group.
4. **Trend chart** cấp page còn phẳng (mới 1 snapshot). Sẽ đầy dần khi cron `api/fetch.js` chạy hằng ngày (đã sửa lấy page_views_total/page_post_engagements/page_daily_follows v25).
5. **Rotate INGEST_SECRET** (mục 3).
6. **CSV path** (`tools/csv-upload.html`) chưa test với file thật — verify ánh xạ cột khi cần dùng CSV.

## 7. File chính
- `api/facebook.js` — dashboard (server in HTML, client trong `clientCode()`). `groupAsPosts()` map group→post; `groupSection()` section riêng; `mapGroupPosts()`.
- `api/ingest.js` — endpoint nạp.
- `api/fetch.js` — cron page-level (đã bỏ post-insights chết).
- `tools/shb-content-library.user.js` — userscript v2 (unsafeWindow).
- `tools/csv-upload.html` — uploader CSV.
- `db/migrate_02_group_posts.sql` — schema group.
