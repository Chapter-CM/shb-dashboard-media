# Bản gốc `cm-dashboard` (nhánh `main`, GitLab nội bộ) — lưu tham khảo

Snapshot toàn bộ file gốc của repo `cm-dashboard` (dashboard Jira nội bộ team CM,
`gitlab-nhs.shb.com.vn/cm/cm-dashboard`) **trước khi merge** thêm Email/Facebook
dashboard — lưu lại ở đây để tham khảo/đối chiếu, khỏi phải tải lại từ GitLab.

**Lưu ý:** đây là bản chụp tại 1 thời điểm (06/07/2026), không tự động đồng bộ.
Nếu `cm-dashboard` gốc thay đổi thêm, bản này sẽ lỗi thời — chỉ dùng để tra cứu
lịch sử/đối chiếu, KHÔNG dùng để deploy hay copy đè lên bản đã merge.

Bối cảnh merge: xem `KE_HOACH_MIGRATION.md` mục 7c và `HANDOFF.md` trong repo này.

## Nội dung
- `.gitlab-ci.yml`, `Dockerfile`, `nginx.conf`, `package.json` — pipeline/hạ tầng gốc.
- `sync.js` — script fetch Jira REST API, ghi `public/data.json`.
- `EXCEL_SCHEMA.js` — tài liệu cấu trúc cột Excel (nguồn Power Automate, tiền thân của `sync.js`).
- `INDEX_PATCH.js` — ghi chú các chỗ đã sửa trong `index.html` (chuyển từ đọc Google Sheet sang đọc `data.json` tĩnh).
- `SETUP_GUIDE.md` — hướng dẫn cũ (đã lỗi thời theo xác nhận của người dùng 06/07/2026, không dùng được nữa).
- `public/index.html`, `public/config.json` — SPA React + cấu hình giao diện.
- `public/data.json` — rỗng trong bản chụp này (chưa từng sync hoặc đã bị xoá trước khi export).
