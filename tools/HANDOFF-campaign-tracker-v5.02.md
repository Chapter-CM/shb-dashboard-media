# Handoff — SHB CM Campaign Tracker v5.02

Phiên 16/09/2026. Xử lý sự cố thật xảy ra giữa lúc gửi campaign 6700 người:
**đang gửi thì hộp thư đầy, Exchange chặn gửi, đợt gửi đứt giữa chừng.**

`tools/CampaignTracker.bas` hiện tại: **v5.02**.
**Chưa compile, chưa test trong Outlook** — xem mục Rủi ro.

---

# Objective

Làm cho việc gửi campaign hàng nghìn người chạy được từ đầu đến cuối mà
không cần người vận hành canh chừng, **đồng thời giữ nguyên khả năng thu
hồi (recall)** và **không đổi bất kỳ dữ liệu nào dashboard đang dùng**.

---

# Business Context

- Bản tin CDS số 3 gửi cho ~6700 CBNV qua macro VBA trên Outlook Classic.
- Dashboard đo tỉ lệ mở/click theo phòng ban, cấp bậc, chi nhánh — dữ liệu
  này là đầu ra chính của cả hệ thống, không được phép sai lệch.
- Recall là yêu cầu bắt buộc của nghiệp vụ: bản tin nội bộ gửi nhầm phải
  thu hồi được.

---

# Current Status

Đã sửa xong và push lên nhánh `claude/zen-shannon-4gsric`. Chuỗi 9 commit,
3 file thay đổi. Chưa nạp vào Outlook để compile/test.

Đợt gửi ngày 16/09 vẫn đang chạy dở (~2500 mail còn trong Outbox lúc bàn
giao). Người dùng sẽ test bản mới ở campaign kế tiếp.

---

# Key Assumptions

- Mail campaign nặng ~4 MB/bản do **ảnh nhúng** (Insert Picture), không phải
  do file đính kèm. Suy ra từ Properties của mail thật trong Sent Items.
- Quota hộp thư khoảng 1.2 GB → chứa được ~300 bản chưa rút gọn.
- Tốc độ Exchange truyền mail ~2 giây/mail → 6700 người mất **vài tiếng**,
  trong khi vòng lặp VBA chỉ mất ~30 phút để đẩy hết vào Outbox.
- Giới hạn 4 MB/mail của Exchange nội bộ (xác nhận qua banner lỗi thật ở
  phiên trước, xem handoff v4.94).

---

# Key Decisions Made

## 1. Nguyên nhân gốc — xác định qua 3 vòng, 2 vòng đầu SAI

| Bản | Giả thuyết | Kết quả |
|---|---|---|
| v4.96 | Shrink quét chậm → tối ưu thuật toán | Đúng nhưng **không phải gốc** — chỉ kéo dài thời điểm thua |
| v4.97 | Không lưu bản sao Sent Items nữa | **Bị bác bỏ** — mất recall, không chấp nhận được |
| v4.98 | Timer rút gọn chỉ sống **12 phút** | **Đúng gốc** |

Gốc rễ: `SHRINK_TIMER_MAX_ATTEMPTS = 12` → cơ chế rút gọn sống ~12 phút sau
khi vòng lặp kết thúc. Nhưng vòng lặp kết thúc **rất sớm** so với lúc đợt gửi
thực sự xong — nó chỉ đẩy mail vào Outbox, còn Outlook truyền đi mất vài
tiếng, và **mỗi mail truyền xong mới sinh ra một bản sao 4 MB**. Toàn bộ
3-4 tiếng sau đó không có gì rút gọn → hộp thư đầy → Exchange chặn gửi.

Điều kiện dừng `shrunk >= target` cũng sai: mỗi lần quét đếm cả mail **đã**
rút gọn từ trước (vẫn khớp slug), nên con số đó không phản ánh còn việc hay
không.

## 2. Recall và an toàn dung lượng không loại trừ nhau

Bản rút gọn (~14 KB) **vẫn recall được bình thường** — đây là thiết kế có
chủ đích từ v4.44. Nên hướng đúng là **rút gọn cho kịp**, không phải bỏ bản
sao. Quyết định này bác bỏ hướng v4.97.

## 3. Rút gọn theo SỰ KIỆN thay vì theo LỊCH (v5.00)

Bản sao sinh ra theo sự kiện thì phải dọn theo sự kiện. Thêm
`SentItemsWatcher.cls` nghe `Items.ItemAdd` trên Sent Items — rút gọn ngay
khi mail vừa rơi vào, không độ trễ, không phải quét cả thư mục.

**Vẫn giữ** quét định kỳ + timer làm lưới an toàn (xem Rủi ro).

## 4. Phủ mọi hòm thư, không chỉ account cấu hình (v5.02)

Từ v4.72 đến v5.01 mọi vòng quét đều duyệt `Session.Accounts`. Hòm thư dùng
chung thêm kiểu *"Open these additional mailboxes"* **không nằm trong
Accounts**, chỉ có trong `Session.Stores` → gửi từ hòm thư đó thì toàn bộ cơ
chế **im lặng không làm gì**, không báo lỗi. Gom về `AllStores()` dùng chung
cho cả 5 đường quét.

---

# Stakeholders

- **Người vận hành campaign** (chủ hộp `CCE_PROJECT@shb.com.vn`): người chạy
  macro, chịu tác động trực tiếp nếu hộp thư đầy giữa chừng.
- **Người nhận** (~6700 CBNV): không bị ảnh hưởng bởi mọi thay đổi trong
  phiên này — bản họ nhận luôn là bản đầy đủ.
- **IT/Exchange admin SHB**: nắm message tracking log (lấy được danh sách
  mail thất bại) và chính sách rate limit — chưa liên hệ.

---

# Risks & Constraints

## Chưa kiểm chứng (rủi ro cao nhất)

**Không compile được VBA trong môi trường phát triển.** Đã kiểm tra bằng
cách thay thế: cân bằng `If/End If`, `For/Next`, `Sub/End Sub`; không trùng
tên biến; mọi điểm gọi hàm còn hợp lệ. **Nhưng chưa từng chạy thật.**

## Giới hạn kỹ thuật đã biết

- `ItemAdd` của Outlook có thể **không kích hoạt** khi nhiều item vào thư mục
  cùng lúc (thường nói đến ngưỡng ~16 item). Lúc gửi thật mail cách nhau vài
  giây nên gần như không dính → đây là lý do **giữ lại** quét định kỳ.
- Watcher và Windows Timer **chỉ sống trong phiên Outlook**. Đóng Outlook là
  chết, không tự khôi phục → đã bù bằng `ResumeShrinkIfPending` trong
  `Application_Startup`.
- Nếu Trust Center chặn macro chạy lúc khởi động, `Application_Startup` không
  chạy → phải chạy tay macro `ShrinkNow`.

## Ràng buộc không được vi phạm

- **Không đổi `dept`/`role`/`loc`**: 3 trường này được `ExpandEntry` bóc từ
  display name GAL dạng `"Tên (Role - Dept - Loc)"`. Nếu nhập người nhận
  bằng **địa chỉ SMTP thô** (chưa resolve GAL) thì 3 trường rỗng →
  `api/email-dashboard.js:704` đặt `hasSeg = false` → **ẩn nguyên khối Phân
  khúc** của dashboard. Không khôi phục được sau khi đã gửi.
- **Giữ `ReDim m_Bag(0 To nLst)`** đúng bằng số người nhận — đây là fix v4.95
  cho lỗi dashboard đếm thiếu "Đã gửi" (gửi 6000 chỉ ghi nhận ~3783).

---

# Open Issues

1. **Chưa test thực tế** — toàn bộ v4.96 → v5.02.
2. **Mail vẫn nặng 4 MB.** Đây là nguyên nhân sâu xa nhất và **chưa xử lý**.
   Nén ảnh đã bị bác bỏ (vỡ chữ). Hướng còn lại: **host ảnh ngoài**
   (`<img src="https://...">`) thay vì Insert Picture — mail xuống vài chục
   KB, giải quyết cùng lúc cả dung lượng lẫn tốc độ. `nginx.conf:79-80` cho
   thấy chính host đang phục vụ `/api/track` cũng serve static, nên khả thi.
   Đánh đổi: người chặn tải ảnh ngoài sẽ thấy ô trống. Lưu ý pixel tracking
   cũng là ảnh ngoài cùng domain → tỉ lệ reach hiện tại chính là ước lượng
   sát nhất cho "bao nhiêu người sẽ thấy ảnh".
3. **Chưa hỏi IT** về Message Rate Limit trên Exchange.
4. **Rule chặn NDR** đã tạo **thủ công trong Outlook** (không nằm trong code):
   subject chứa `Undeliverable:` → permanently delete. Lý do: NDR nặng **4 MB**
   mỗi cái vì đính kèm nguyên bản mail gốc. Rule là client-side, chỉ chạy khi
   Outlook mở. Đánh đổi: mất danh sách người không nhận được — nhưng **IT lấy
   lại được** từ Exchange message tracking log.
5. Đợt gửi 16/09 còn ~2500 mail trong Outbox lúc bàn giao.

---

# Dependencies

| Thành phần | Vai trò | Ghi chú |
|---|---|---|
| `tools/CampaignTracker.bas` | Module1 | Dán đè vào code pane |
| `tools/SentItemsWatcher.cls` | **Class Module** | **Phải Import**, không dán vào module thường — `WithEvents` chỉ chạy trong class module |
| `tools/RecallNotifWatcher.cls` | Class Module | Không đổi trong phiên này |
| `tools/ArchiveModule.bas` | Module2 | Không đổi. Có `ArchiveNow` dùng khi cần giải phóng gấp |
| `ThisOutlookSession` | Bootstrap | Phải có `Call Module1.ResumeShrinkIfPending` trong `Application_Startup` |

Hướng dẫn nạp đầy đủ: `tools/ThisOutlookSession-snippet.txt`.

---

# Next Actions

## 1. Nạp và compile

- Dán `CampaignTracker.bas` đè Module1 → kiểm tra **dòng thứ 4 ghi `v5.02`**
  (từ v5.02 header và hằng `VER` được đồng bộ; trước đây header kẹt ở
  `v4.95` suốt nhiều bản khiến không kiểm tra được bằng mắt).
- Import `SentItemsWatcher.cls` → xác nhận nó nằm trong nhánh **Class
  Modules**, không phải Modules.
- Thêm `Call Module1.ResumeShrinkIfPending` vào `Application_Startup` hiện có
  (đừng tạo hàm thứ hai cùng tên).
- `Debug > Compile VBAProject` → `Ctrl+S`.
- **Verification:** mục `Compile` bị mờ đi = đã compile sạch.

## 2. Test campaign nhỏ (5-10 người) trước khi chạy quy mô lớn

- **Verification 1:** mail trong Sent Items tự rút gọn xuống ~14 KB mà không
  phải bấm gì.
- **Verification 2 (quan trọng nhất):** dashboard vẫn có dữ liệu cột **Phòng
  ban / Cấp bậc** — chứng minh `dept`/`role`/`loc` không bị ảnh hưởng.
- **Verification 3:** `RecallCampaign()` vẫn tìm và thu hồi được mail đã rút
  gọn.

## 3. Test campaign lớn

- Theo dõi dung lượng: `File > Tools > Mailbox Cleanup > View Mailbox Size`,
  xem tab **Server Data** (không phải Local Data).
- **Success criteria:** chạy hết đợt gửi mà không xuất hiện cảnh báo quota và
  không phải can thiệp tay lần nào.

## 4. Việc chiến lược còn lại

- Quyết định về **host ảnh ngoài** (Open Issue #2) — đòn bẩy lớn nhất còn lại.
- Làm việc với IT về rate limit (Open Issue #3).

---

# Ghi chú vận hành

- Source of truth: repo GitHub `Chapter-CM/shb-dashboard-media`. Nhánh mặc
  định là `claude/loving-planck-y6lw57` — **repo này không có nhánh `main`**.
- Phiên này làm trên nhánh `claude/zen-shannon-4gsric`.
- GitLab Internal SHB đồng bộ theo quy trình thủ công của team, không tự động.
- Mọi thay đổi VBA phải người dùng tự paste vào Outlook — không có cơ chế
  đồng bộ tự động.
