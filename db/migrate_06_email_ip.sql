-- Migration 06 — thêm cột IP cho bảng events (25/09/2026)
-- Mục đích: phân biệt dứt điểm nhóm "mở rải nhiều ngày, số lượt bất thường"
-- (vd 1 người 96 lượt/9 ngày, phát hiện qua điều tra thực tế trên production —
-- xem ghi chú scatterSuspect trong api/email-dashboard.js) là do:
--   (a) 1 người dùng thật mở từ nhiều thiết bị (điện thoại+máy tính+OWA web,
--       mỗi thiết bị tự tải lại ảnh khi đồng bộ) -> nhiều IP khác nhau, ổn định
--   (b) hệ thống quét định kỳ (DLP/backup/antivirus quét hộp thư) -> 1 IP lặp lại
-- Không có cột này, dữ liệu hiện tại đã chạm trần khả năng chẩn đoán (mọi bằng
-- chứng khác đều khớp cả 2 giả thuyết như nhau).
--
-- CHÚ Ý QUAN TRỌNG VỀ THỨ TỰ DEPLOY: phải chạy migration này TRƯỚC khi deploy
-- bản api/email-track.js mới (ghi cột `ip`). Nếu deploy ngược lại, mọi INSERT
-- vào bảng events sẽ lỗi "Unknown column 'ip'" -> insertEvent() sẽ throw, bị
-- catch và log lỗi (xem api/email-track.js), nghĩa là MẤT TRẮNG toàn bộ lượt
-- mở/click/gửi cho tới khi cột được thêm. Luôn chạy .sql trước, sau đó mới
-- đồng bộ .js sang GitLab.

alter table events add column if not exists ip varchar(64);

-- Không cần index riêng cho `ip` ở giai đoạn này — mục đích là XEM (đối chiếu
-- thủ công qua /dbquery cho từng người nghi vấn), chưa cần lọc/group theo IP
-- với khối lượng dữ liệu hiện tại. Thêm index sau nếu cần truy vấn tổng hợp.
