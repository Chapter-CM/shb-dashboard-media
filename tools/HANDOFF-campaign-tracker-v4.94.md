# Handoff — SHB CM Campaign Tracker (Fix đầy hộp thư khi gửi campaign lớn)

Phiên làm việc này xử lý vấn đề gốc: gửi ~6000 mail/lần, hòm thư 1.8GB đầy
chỉ sau ~300 mail dù cơ chế Shrink đã có sẵn. Đã xác định + vá đúng
nguyên nhân, và xác nhận qua test thực tế (không chỉ đọc code).
`tools/CampaignTracker.bas` hiện tại: **v4.94**.

## 1. File liên quan

| File | Vai trò |
|---|---|
| `tools/CampaignTracker.bas` | Module chính (Module1) — `SendCampaign`, `RecallCampaign`, `ShrinkCampaignSentItems`. Hiện tại: **v4.94**. |
| `tools/ArchiveModule.bas` | Module độc lập (Module2) — Auto-Archive Sent Items, timer 3h, nút `ArchiveNow`. Không đổi trong phiên này. |
| `tools/ARCHIVE-SETUP-GUIDE.md` | Hướng dẫn cài đặt Auto-Archive. Không đổi. |
| `tools/RecallNotifWatcher.cls` | Class module theo dõi thông báo Recall Success/Failure. Không đổi. |
| `tools/TestHarness.bas` | **Đã xoá khỏi repo** sau khi hoàn tất test Tầng 2 (xem mục 4). |

## 2. Nguyên nhân gốc đã xác định

`ShrinkCampaignSentItems()` (được `SendCampaign` gọi định kỳ mỗi
`SHRINK_EVERY` mail trong lúc gửi, và gọi lại 1 lần cuối) **trước giờ chỉ
ghi đè `itm.HTMLBody` thành 1 dòng placeholder text**, không hề đụng vào
`itm.Attachments`. Nếu mail nặng chủ yếu do **file đính kèm thật** hoặc
**ảnh chèn kiểu Insert Picture** (khác với ảnh host ngoài dạng
`<img src="link">`), thì "rút gọn" chỉ xoá được vài KB chữ, còn phần nặng
nhất (ảnh/file, ~2MB/mail) vẫn nằm nguyên trong bản lưu Sent Items —
giải thích đúng hiện tượng người dùng gặp (dung lượng gần như không giảm
dù Shrink vẫn chạy đúng lịch).

## 3. Đã sửa (v4.94)

- **Thêm vòng lặp xoá `itm.Attachments`** trong `ScanFolderForShrink()`,
  chạy ngay sau khi gán `HTMLBody` placeholder, trước `itm.Save`. Áp dụng
  chung cho cả file đính kèm thật lẫn ảnh Insert Picture (Outlook lưu cả
  2 loại trong cùng 1 collection `Attachments`, không cần code riêng).
- **Giảm `SHRINK_EVERY` từ 100 xuống 50** — rút gọn sớm hơn, giảm dung
  lượng tích luỹ giữa 2 lần rút gọn, đổi lấy thêm chút thời gian gửi (mỗi
  lần `ShrinkCampaignSentItems` quét lại toàn bộ Sent Items, không chỉ
  batch mới — folder càng nhiều mail cũ thì quét càng chậm dần).

## 4. Đã test thực tế (không chỉ đọc code)

**Tầng 1 — nội dung/HTML/click tracking**: gửi thật 1 mail test tới vài
địa chỉ nội bộ qua `SendCampaign`. Xác nhận qua Outlook: `Properties`
(`Alt+Enter`) của mail sau rút gọn chỉ còn **11 KB** (từ mail gốc có
ảnh/đính kèm ~2MB), không còn icon đính kèm.

**Tầng 2 — dung lượng hộp thư ở quy mô lớn**: dùng module tạm
`tools/TestHarness.bas` (đã xoá sau khi xong, xem dưới) để tạo thẳng 500
mail giả (~1GB, đính kèm 2MB/mail) trực tiếp vào Sent Items — **không
qua SMTP, không gửi thật** — nhằm test `ShrinkCampaignSentItems()` trong
vài giây thay vì phải gửi thật hàng nghìn mail và đợi hàng giờ (vấn đề
người dùng từng gặp khi test trước đây). Kết quả:

- Dung lượng **Server Data** (số quyết định quota thật, không phải
  **Local Data** — Local là cache OST trên máy, có thể lệch/trễ so với
  server): trước seed 9994 KB → sau seed 789.148 KB → **sau rút gọn
  356.317 KB → sau khi Outlook đồng bộ xong (~30s sau F9) trở về mức
  bình thường**, banner "MAILBOX FULL" tự hết.
- Xác nhận method rút gọn hoạt động **độc lập theo từng campaign**
  (khớp theo `CMSlug`/slug truyền vào, không đụng mail campaign khác)
  và **quét tất cả account trong profile Outlook** (không chỉ account
  mặc định) — nên khi switch hòm mail hoặc switch campaign, cơ chế vẫn
  hoạt động đúng mà không cần chỉnh gì thêm.

`tools/TestHarness.bas` đã bị xoá khỏi repo sau khi hoàn tất test Tầng 2
— không còn trong `tools/`. Nếu cần test lại tương tự sau này, xem lịch
sử git (`git log -- tools/TestHarness.bas`) để khôi phục.

## 5. Rủi ro đã phát hiện, CHƯA vá vào code (người dùng chủ động tự quản lý)

**Giới hạn dung lượng gửi thật của Exchange nội bộ SHB: 4MB/mail**
(xác nhận qua banner lỗi thật khi test: *"This 12,6 MB email message
cannot be sent because it exceeds the 4 MB outgoing message size
limit."*). Đây là lỗi **âm thầm**: `m.send()` không báo lỗi ngay,
`sentOK` vẫn tăng, MsgBox cuối cùng của `SendCampaign` vẫn báo "Thành
công" — nhưng mail thực tế **kẹt trong Outbox, không tới tay người
nhận**. Người dùng xác nhận sẽ tự kiểm tra dung lượng draft trước khi
gửi mỗi campaign (`Alt+Enter` xem Size, phải dưới ~3.5-4MB), **chưa yêu
cầu thêm cảnh báo tự động vào code** — nếu làm tiếp, nên thêm bước kiểm
tra dung lượng draft đầu `SendCampaign`, cảnh báo trước khi vào vòng lặp
gửi hàng loạt.

## 6. Lỗi nhỏ đã biết, CHƯA sửa (không chặn sản xuất)

`CleanupFakeSentItems()` (trong `TestHarness.bas`, đã xoá — chỉ còn
trong lịch sử git) chỉ quét Sent Items của **account mặc định**, không
loop qua tất cả account như `ShrinkCampaignSentItems()` — không ảnh
hưởng code sản xuất vì đây là hàm test-only đã bị xoá.

## 7. Việc chưa test / cần theo dõi thêm

- Gửi campaign thật đúng quy mô 6000 người nhận (đã test logic ở quy mô
  giả lập 500 mail, chưa test thật ở đúng 6000 — có thể seed giả 6000
  qua cách tương tự Tầng 2 nếu cần độ tin cậy cao hơn trước khi gửi thật).
- `DoFastMode` (Gửi Nhanh) và đa tài khoản — kế thừa từ handoff phiên
  trước (`HANDOFF-campaign-tracker-v4.93.md`), vẫn chưa test lại trong
  phiên này.

## 8. Ghi chú vận hành

- Mọi thay đổi trong phiên này đều nằm trong `tools/CampaignTracker.bas`
  — người dùng tự paste-replace thủ công vào Module1 trong VBA Editor
  của Outlook (không có cơ chế đồng bộ tự động).
- File nguồn duy nhất là repo GitHub `Chapter-CM/shb-dashboard-media`,
  nhánh `claude/ecstatic-hopper-mj1v2x` — không phải GitLab Internal SHB
  (xem CLAUDE.md mục 7A/7B).
