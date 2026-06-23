-- Migration 02 — Bài viết Group "SHB Một Nhà" (nguồn: Professional Dashboard
-- Content Library, nạp qua userscript -> /api/ingest). Groups API công khai đã bị
-- Meta gỡ 22/04/2024 nên đây là nguồn dữ liệu duy nhất còn lại.
-- Chạy trong Supabase SQL editor.

-- 1. Số liệu HIỆN TẠI mỗi bài (upsert theo post_id)
create table if not exists fb_group_posts (
  post_id      text primary key,          -- id từ permalink (vd 1520493865973124)
  group_id     text,
  title        text,
  permalink    text,
  created_time timestamptz,
  post_type    text,                       -- subtype nếu có
  reach        bigint default 0,
  viewers      bigint default 0,           -- unique người xem
  engagement   bigint default 0,
  comments     int    default 0,
  source       text   default 'prodash',   -- 'prodash' | 'csv'
  updated_at   timestamptz default now()
);

-- 2. Lịch sử snapshot -> dựng trend
create table if not exists fb_group_post_snapshots (
  id          bigserial primary key,
  post_id     text references fb_group_posts(post_id) on delete cascade,
  captured_at timestamptz default now(),
  reach       bigint,
  viewers     bigint,
  engagement  bigint,
  comments    int
);
create index if not exists fb_group_post_snap_time on fb_group_post_snapshots (post_id, captured_at);
