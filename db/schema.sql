-- SHB Facebook Dashboard — Supabase schema
-- Chạy trong Supabase SQL editor. Tách metadata + số liệu hiện tại (fb_posts)
-- khỏi lịch sử snapshot (fb_snapshots / fb_page_snapshots) để dựng trend/velocity.

-- 1. Bài viết + số liệu HIỆN TẠI (upsert mỗi lần fetch)
create table if not exists fb_posts (
  post_id           text primary key,
  page_id           text,
  message           text,
  created_time      timestamptz,
  type              text,                 -- Ảnh | Video | Reel | Text | Link (đã chuẩn hoá)
  permalink         text,
  topic             text,
  views             bigint  default 0,    -- Views (thay Impressions 11/2025)
  like_count        int     default 0,
  love_count        int     default 0,
  haha_count        int     default 0,
  wow_count         int     default 0,
  sad_count         int     default 0,
  angry_count       int     default 0,
  comments          int     default 0,
  replies           int     default 0,    -- (làm giàu sau: cần fetch comments sâu)
  page_replies      int     default 0,    -- (làm giàu sau)
  shares            int     default 0,
  clicks            int     default 0,
  first_comment_min int,                   -- (làm giàu sau)
  video             jsonb,                 -- {mediaViews,avgWatch,completion,replays}
  vel               jsonb,                 -- {h1,h3,h6,h24} — tính từ fb_snapshots
  updated_at        timestamptz default now()
);

-- 2. Lịch sử snapshot từng bài (append mỗi lần fetch) -> trend & velocity
create table if not exists fb_snapshots (
  id          bigserial primary key,
  post_id     text references fb_posts(post_id) on delete cascade,
  captured_at timestamptz default now(),
  views       bigint,
  reactions   int,
  comments    int,
  shares      int,
  clicks      int,
  engagement  int
);
create index if not exists fb_snapshots_post_time on fb_snapshots (post_id, captured_at);

-- 3. Lịch sử cấp Page (append mỗi lần fetch) -> follower growth
create table if not exists fb_page_snapshots (
  id          bigserial primary key,
  page_id     text,
  captured_at timestamptz default now(),
  followers   bigint,
  views       bigint,
  engagement  bigint
);
create index if not exists fb_page_snapshots_time on fb_page_snapshots (captured_at);
