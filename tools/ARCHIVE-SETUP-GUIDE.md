# Hướng dẫn cài đặt Auto-Archive cho SHB Campaign Tracker

Tính năng: tự động chuyển các mail chiến dịch (gửi bằng macro `SendCampaign`
trong `CampaignTracker.bas`) từ Sent Items sang folder Archive riêng, để
giải phóng dung lượng hộp thư — vừa có nút bấm tay, vừa có lịch chạy ngầm
tự động, không cần Windows Task Scheduler.

File liên quan: `tools/ArchiveModule.bas` (module VBA độc lập, không đụng
vào `CampaignTracker.bas`/`Module1`).

---

## 1. Chuẩn bị hòm Archives trên máy (làm 1 lần/máy)

Folder đích là 1 file `.pst` lưu **cục bộ trên từng máy** — không đồng bộ
qua server, nên **phải setup riêng trên mỗi thiết bị**.

1. Outlook → `File → Account Settings → Account Settings... → tab Data Files`.
2. Nếu **chưa có** dòng nào tên `Archives` trong danh sách:
   - Bấm **Add...** → chọn nơi lưu, đặt tên file bất kỳ (vd `Archives.pst`) → **OK**.
   - PST mới xuất hiện trong danh sách Data Files → chọn nó → **Settings...**
     (hoặc chuột phải folder đó trong khung điều hướng Outlook →
     **Data File Properties**) → ô **Name** → xóa tên mặc định, gõ đúng:
     `Archives` → OK.
     > Lưu ý: ô "File name" lúc tạo (bước Add) chỉ là tên file trên ổ đĩa,
     > không quan trọng. Ô **Name** trong Data File Properties mới là thứ
     > code dùng để tìm ra đúng folder.
3. Bên trong PST `Archives` đó, tạo 1 folder con tên **"Mục đã Gửi"**
   (chuột phải vào PST → New Folder). Nếu PST vốn đã có sẵn folder tên
   "Mục đã Gửi" hoặc "Sent Items" thì dùng luôn, không cần tạo thêm.

Code có cơ chế dự phòng: nếu không tìm thấy đúng tên `Archives`/`Mục đã
Gửi` (do gõ sai hoặc dấu bị lỗi khi copy/paste), sẽ tự dò theo từ khóa
không dấu (`archiv`, `da gui`) — nhưng nên đặt đúng tên ngay từ đầu cho
chắc chắn.

---

## 2. Cài macro vào Outlook (làm 1 lần/máy)

### Bước 1 — Import `ArchiveModule.bas`

1. `Alt+F11` mở VBA Editor.
2. `File → Import File...` → chọn file `tools/ArchiveModule.bas`.
3. VBA sẽ tạo ra 1 module mới (tên tự động, vd `Module2`) — **ghi nhớ tên
   module này**, sẽ cần dùng ở bước 2.
4. `Debug → Compile VBAProject` để kiểm tra không lỗi.

### Bước 2 — Tự động khởi động (thêm vào `ThisOutlookSession`)

1. Trong Project Explorer: `Microsoft Outlook Objects → ThisOutlookSession`
   → double-click để mở code pane.
2. Nếu **đã có sẵn** `Sub Application_Startup` → chỉ cần thêm 1 dòng gọi
   vào bên trong. Nếu **chưa có** → thêm mới:

   ```vba
   Private Sub Application_Startup()
       Call Module2.StartArchiveAutoTimer   ' đổi "Module2" thành đúng
   End Sub                                   ' tên module ở Bước 1
   ```

3. `Debug → Compile VBAProject` → `Ctrl+S`.
4. **Đóng hẳn Outlook rồi mở lại** — `Application_Startup` chỉ chạy lúc
   khởi động Outlook.

### Bước 3 (tuỳ chọn) — Gắn nút bấm tay `ArchiveNow`

`File → Options → Customize Ribbon` (hoặc Quick Access Toolbar) → cột
trái "Choose commands from:" chọn **Macros** → chọn `ArchiveNow` → **Add
>>** → đặt tên/icon tuỳ ý → OK.

---

## 3. Cách hoạt động

| | `ArchiveNow` (nút bấm tay) | Timer tự động (mỗi 3 tiếng) |
|---|---|---|
| Kích hoạt | Người dùng bấm nút | Tự chạy ngầm, không cần thao tác |
| Mail chưa đủ 24h | **Vẫn chuyển** (bỏ qua ngưỡng tuổi) | Bỏ qua, chỉ chuyển mail đã quá 24h |
| Thông báo | Hiện MsgBox kết quả | Chạy im lặng, chỉ ghi log |

- Chỉ archive mail **gửi bằng macro `SendCampaign`** (nhận diện qua
  UserProperty `CMSlug`, gắn tự động cho cả 2 chế độ Đầy đủ và Nhanh) —
  không đụng đến mail thường bạn tự soạn gửi tay.
- Quét **Sent Items của tất cả account** trong profile Outlook (không
  chỉ account mặc định), tự nhận diện theo loại folder chứ không theo tên
  hiển thị (nên dù account đặt tên "Sent Items" hay "Mục đã Gửi" đều quét
  đúng).
- Bên trong `Archives > Mục đã Gửi`, tự tạo **subfolder riêng cho từng
  account gửi** (đặt tên theo địa chỉ email), không dồn chung 1 chỗ.
- Timer chỉ chạy khi Outlook đang mở (giống Task Scheduler cũng cần máy
  bật) — nhưng không sao nếu Outlook bị tắt giữa chừng: mỗi lần chạy lại
  đều tự kiểm tra tuổi thật của từng mail (`SentOn`), không dựa vào "đã
  đợi đủ giờ chưa", nên không bao giờ bỏ sót.
- File log: `C:\SHBTrackerLogs\archive-log.txt` — dùng để kiểm tra các
  lần chạy ngầm đã archive được bao nhiêu mail.

---

## 4. Sự cố thường gặp

- **Compile error "Only comments may appear after End Sub..."**: thường
  do dấu `'` đầu dòng comment hoặc dấu tiếng Việt bị hỏng khi copy/paste
  qua nhiều lớp (trình duyệt → clipboard → VBA Editor). Cách khắc phục
  chắc ăn nhất: xóa hẳn module đang lỗi (`Remove Module...`), tạo module
  mới hoàn toàn trống, rồi paste lại. Nên mở file `.bas` bằng **Notepad**
  (không dùng Word/WordPad) trước khi copy, để tránh tính năng tự động
  sửa dấu nháy (Smart Quotes).
- **Compile error "Overflow"**: nếu tự sửa `ARCHIVE_TIMER_INTERVAL_MS`
  bằng công thức nhân (vd `3 * 60 * 60 * 1000`), VBA tính theo kiểu
  `Integer` (giới hạn 32767) trước khi gán `Long` nên bị tràn số. Luôn
  viết thẳng số đã tính sẵn (vd `10800000` cho 3 tiếng), không viết công
  thức nhân trực tiếp trong khai báo `Const`.
- **Archive không tìm thấy mail nào dù mail đã cũ**: kiểm tra mail đó có
  thật sự gửi qua `SendCampaign` không — mail Fast Mode gửi trước khi
  cập nhật `CampaignTracker.bas` lên bản có gắn tag Fast Mode sẽ không
  bao giờ được nhận diện (không có UserProperty `CMSlug`), phải xóa/move
  tay các mail cũ đó.
- **Không tìm thấy folder Archive đích**: kiểm tra lại đúng tên `Archives`
  (Data File Properties → Name) và có folder `Mục đã Gửi`/`Sent Items`
  bên trong chưa — xem lại Mục 1.

---

## 5. Lặp lại trên máy khác

1. Làm lại Mục 1 (setup Archives PST) trên máy đó.
2. Làm lại Mục 2 (import `ArchiveModule.bas` + thêm dòng gọi vào
   `ThisOutlookSession`) — tên module sinh ra có thể khác (`Module1`,
   `Module2`, `ArchiveModule`...), nhớ đối chiếu đúng tên khi viết dòng
   `Call <TenModule>.StartArchiveAutoTimer`.
3. Không cần cài Windows Task Scheduler hay bất kỳ file script ngoài
   nào — toàn bộ nằm gọn trong 1 file `.bas` + 1 dòng code.
