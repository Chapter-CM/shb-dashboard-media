-- Migration 01: add media_viewers column to fb_posts
-- Chạy trong Supabase SQL editor NẾU bạn đã tạo fb_posts trước ngày 23/06/2026.
-- (Nếu chưa chạy schema.sql lần nào, dùng schema.sql thay thế — đã có cột này rồi.)

ALTER TABLE fb_posts
  ADD COLUMN IF NOT EXISTS media_viewers bigint DEFAULT 0;

COMMENT ON COLUMN fb_posts.media_viewers IS
  'Unique people who saw this post (Media Viewers — replaces Reach after 06/2026 deprecation). Source: Insights API post-06/2026.';
