-- Migration 05 — Thời gian đọc email (dwell)
-- ⚠️ Chạy trong SQL editor của Supabase EMAIL (EMAIL_SUPABASE_URL),
--    KHÔNG phải Supabase Facebook (SUPABASE_URL).
--
-- api/email-track.js v3.6 stream pixel bottom nhỏ giọt: client giữ kết nối
-- chừng nào email còn mở → đo được thời gian đọc, ghi event pos='dwell'
-- kèm số giây vào cột dwell_s (cap tại EMAIL_DWELL_CAP_S, mặc định 25s).

alter table events add column if not exists dwell_s integer;

-- Nếu bảng events có CHECK constraint trên cột pos, cần cho phép giá trị mới:
-- alter table events drop constraint if exists events_pos_check;
-- alter table events add constraint events_pos_check
--   check (pos in ('sent','top','bottom','click','read','dwell'));
