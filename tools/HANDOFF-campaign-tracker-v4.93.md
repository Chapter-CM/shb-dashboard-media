# Handoff — SHB CM Campaign Tracker (Auto-Archive + Click-Tracking fix)

Phiên làm việc này gồm 2 mảng chính: (1) hệ thống Auto-Archive cho mail
chiến dịch, và (2) chuỗi debug/sửa lỗi Click Tracking trong
`tools/CampaignTracker.bas`, từ v4.72 lên **v4.93**.

## 1. File liên quan

| File | Vai trò |
|---|---|
| `tools/CampaignTracker.bas` | Module chính (Module1 trong Outlook VBA) — `SendCampaign`, `RecallCampaign`, `ShrinkCampaignSentItems`. Hiện tại: **v4.93**. |
| `tools/ArchiveModule.bas` | Module độc lập (Module2) — Auto-Archive Sent Items, timer 3h, nút `ArchiveNow`. v1.6. |
| `tools/ARCHIVE-SETUP-GUIDE.md` | Hướng dẫn cài đặt Auto-Archive (1 lần/máy). |
| `tools/ExportDraftHTML.bas` | Macro chẩn đoán tạm thời — xuất `HTMLBody` của draft/mail đang mở ra file text để đối chiếu. Có thể xoá sau khi ổn định lâu dài, nhưng nên **giữ lại** vì hữu ích cho debug tương lai. |

## 2. Trạng thái sau phiên này

**Đã xác nhận hoạt động đúng qua test thực tế** (không chỉ đọc code):
- Click Tracking hoạt động cho link chữ, link ảnh thường (SharePoint banner), và link ảnh VML (chữ ký/tài liệu chèn kiểu Insert Picture) — kể cả nhiều ảnh/nhiều link trong 1 email.
- Không còn lỗi "mail rỗng hoàn toàn" khi bật Click Tracking.
- Ảnh gắn link mở được bình thường cho **cả người nhận nội bộ lẫn bên ngoài**.
- Auto-Archive (nút `ArchiveNow` + timer 3h) đã cài đặt, có hướng dẫn riêng.

**Đã biết và chấp nhận (không phải bug, là giới hạn nền tảng)**:
- `InputBox` trong VBA không xử lý đúng Unicode tiếng Việt có dấu (giới
  hạn ANSI/Windows-1258) — ô "Ten chien dich" phải gõ **không dấu**
  (đúng như hướng dẫn sẵn trong ô nhập), nếu không sẽ bị mất một số ký tự
  có dấu khi hiển thị trên Dashboard.
- Rút gọn Sent Items (Shrink) cần vài phút mới thấy hiệu lực do Exchange
  cần thời gian "chốt" mail mới cho sửa — có cơ chế tự thử lại sẵn
  (`StartShrinkTimer`), không cần thao tác thêm.

## 3. Lịch sử debug Click Tracking (v4.85 → v4.93) — để tránh lặp lại sai lầm

Đây là phần quan trọng nhất cho người kế tiếp: **3 nguyên nhân độc lập**
từng gây ra hiện tượng tưởng như cùng 1 lỗi ("mail rỗng"/"ảnh không mở
được link"/"link không có tracking"), khiến quá trình debug ban đầu đi
sai hướng nhiều lần (đổ lỗi cho `WrapLinks()` string-parsing khi thực ra
không phải).

1. **v4.85–v4.87**: Nghi ngờ `WrapLinks()` (dò chuỗi HTML thủ công) làm
   vỡ cấu trúc VML khi ghi đè href gần ảnh → thêm nhiều lớp né tránh
   (bỏ qua link boc anh). Đây là suy đoán SAI — được chứng minh sau này.
2. **v4.88**: Thử đổi hẳn sang API `Word.Hyperlinks` (qua
   `MailItem.GetInspector.WordEditor`) — gây lỗi NẶNG HƠN (mail rỗng cả
   với email không có ảnh) do giới hạn độ dài field code nội bộ của Word.
   Đã **revert hoàn toàn**, không dùng lại cách này.
3. **v4.90**: Thêm `DebugDumpHTML()` — tự động ghi HTML thật ra
   `C:\SHBTrackerLogs\wraplinks-debug-*.txt` tại 3 mốc (trước wrap, sau
   wrap, HTML cuối cùng gán cho người nhận đầu tiên) mỗi khi bật Click
   Tracking. **Đây là công cụ mấu chốt** giúp tìm ra 2 nguyên nhân thật
   sau đây thay vì tiếp tục đoán.
4. **v4.91 — nguyên nhân thật #1**: `FindFirstNonLinkLine()` (gợi ý
   preview text) không nhận diện được dòng link trần dạng
   `<https://...>` (Outlook bọc link trần bằng `<` `>` trong
   `draft.body` plain-text) vì chỉ kiểm tra tiền tố `http://`/`https://`.
   Dòng link này bị chọn nhầm làm preview text mặc định, rồi bị nối
   THẲNG (không HTML-escape) vào preheader ẩn → dấu `<` mở đầu phá vỡ
   toàn bộ HTML phía sau → mail rỗng hoàn toàn. **Không liên quan gì đến
   ảnh/VML.** Sửa: escape `<`/`>`/`&` trước khi chèn (hàm `HtmlEscape`),
   và sửa `FindFirstNonLinkLine` bỏ dấu bọc trước khi kiểm tra.
5. **v4.92 — nguyên nhân thật #2**: Ảnh gắn link không mở được (không
   còn cả "Open Hyperlink") — nhưng CHỈ với người nhận **nội bộ** cùng
   tổ chức, người nhận **bên ngoài** (Gmail) vẫn mở bình thường. Đây là
   Exchange/Outlook tự động chuyển mail sang Rich Text (TNEF/winmail.dat)
   cho người nhận nội bộ — quá trình này giữ hyperlink trên văn bản
   nhưng làm mất hyperlink trên ảnh. Sửa: ép
   `m.BodyFormat = olFormatHTML` trên từng bản `.Copy()` trước khi gửi.
6. **v4.93**: Sau khi 2 nguyên nhân thật đã được sửa, lớp né-VML từ
   v4.87/v4.89 trở nên KHÔNG CẦN THIẾT NỮA và đang chặn oan link trên ảnh
   chữ ký/tài liệu. Đã gỡ bỏ hoàn toàn, chỉ giữ lại lớp bảo vệ
   "href phải đứng sau khoảng trắng" (v4.86, để không đụng vào `o:href`
   nội bộ của VML) — lớp này đã đủ an toàn, xác nhận qua dữ liệu HTML
   thật.

**Bài học cho lần sau**: khi gặp lỗi tương tự (mail rỗng / link mất /
ảnh không mở), **luôn dùng `DebugDumpHTML`/`ExportDraftHTML` để lấy HTML
thật trước khi sửa code** — đừng suy đoán cấu trúc HTML/VML. 3 vòng sửa
sai hướng (v4.85–v4.89) đều bắt nguồn từ việc đoán thay vì kiểm chứng.

## 4. Việc chưa test / cần theo dõi thêm

- Gửi campaign thật với số lượng lớn (không chỉ test 1 người nhận) —
  xác nhận Shrink/Recall hoạt động ổn định ở quy mô lớn với các thay đổi
  mới.
- `DoFastMode` (Gửi Nhanh) chưa được test lại trong phiên này.
- Đa tài khoản (gửi từ tài khoản không phải mặc định) chưa test lại.

## 5. Ghi chú vận hành

- Mọi thay đổi trong phiên này đều nằm trong `tools/CampaignTracker.bas`
  — người dùng tự paste-replace thủ công vào Module1 trong VBA Editor
  của Outlook (không có cơ chế đồng bộ tự động).
- File nguồn duy nhất là repo GitHub `Chapter-CM/shb-dashboard-media`,
  nhánh `claude/loving-planck-y6lw57` — không phải GitLab Internal SHB
  (xem CLAUDE.md mục 7A/7B).
