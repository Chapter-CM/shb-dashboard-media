-- Migration 05 — Thời gian đọc email (dwell) [ĐÃ CHẠY trên Supabase EMAIL 02/07/2026]
-- ⚠️ Tính năng đo dwell đã GỠ khỏi bản Vercel: proxy Vercel không truyền tín
--    hiệu client ngắt kết nối (kiểm chứng đủ 3 runtime) → dwell luôn chạm trần.
--    Cột dwell_s GIỮ LẠI để bổ sung khi migrate vào hạ tầng nội bộ SHB —
--    chi tiết cơ chế + code tham chiếu: KE_HOACH_MIGRATION.md mục 7b.

alter table events add column if not exists dwell_s integer;

-- Dọn event dwell thử nghiệm (tuỳ chọn):
-- delete from events where pos = 'dwell';
-- delete from events where campaign = 'test-dwell';
