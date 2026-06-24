-- Migration 03 — Số liệu cấp TRANG (page-level) từ Professional Dashboard Insights.
-- Userscript bắt generic mọi metric {value} + time-series rồi đẩy lên. Lưu dạng jsonb
-- để linh hoạt (Facebook đổi key thường xuyên); dashboard map field nào nhận ra.
-- Chạy trong Supabase SQL editor.

create table if not exists fb_page_insights (
  id          bigserial primary key,
  captured_at timestamptz default now(),
  date_range  text,                 -- vd LAST_28D / CUSTOM...
  metrics     jsonb default '{}'::jsonb,   -- {total_interactions:5323, total_reactions:..., comments:..., shares:..., views:..., viewers:..., followers:..., net_follower:...}
  series      jsonb default '{}'::jsonb    -- {views_time_series:{points:[{t,value}]}, ...}
);
create index if not exists fb_page_insights_time on fb_page_insights (captured_at desc);
