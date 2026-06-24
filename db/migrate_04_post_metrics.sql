-- Migration 04 — lưu TẤT CẢ chỉ số per-post (Lượt hiển thị, Số người theo dõi thực,
-- Lượt phân phối, watch time, ≥3s/≥1ph...) dưới dạng jsonb để bảng Nội dung đủ chỉ số.
-- Chạy trong Supabase SQL editor.

alter table fb_group_posts add column if not exists metrics jsonb default '{}'::jsonb;
