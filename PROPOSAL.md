# SHB Facebook Dashboard — Đề xuất cấu trúc dữ liệu & layout

> Tài liệu đề xuất (chưa code). Mục tiêu: dashboard đo hiệu quả truyền thông
> Fanpage SHB, dùng chung design system với `email-tracker-data` để sau này
> gộp **1 link – 2 trang** (`[ Email ] [ Facebook ]`).
>
> Phạm vi bản này: **TRANG FANPAGE** (Page Graph API, tự động). Trang Group
> tạm gác (xem §8 — lý do & hướng xử lý sau).
>
> Cập nhật theo thực trạng API **22/06/2026**.

---

## 1. Ràng buộc nền tảng (đã kiểm chứng — đọc trước khi build)

| Sự kiện | Hiệu lực | Ảnh hưởng |
|---|---|---|
| **Groups API khai tử hoàn toàn** | 22–23/04/2024 | Không đọc được feed/engagement group qua API. Trang Group phải nhập tay/CSV → **tạm gác**. |
| `impressions` → **`views`**; `page_fans` bỏ | 15/11/2025 | Không dùng Impressions/page_fans nữa. Trục đo là **Views**. |
| **Reach, Video/Story Impressions, 3-sec video views bỏ** | **15/06/2026 (ĐÃ QUA)** | Không còn `post_reach`/`post_impressions_unique`. Thay bằng **Media Views / Media Viewers**. **Không còn tách paid vs organic** cho reach — chỉ còn tổng unique views. |

**Hệ quả cốt lõi #1 — chỉ có Page API là tự động.** Toàn bộ trang Fanpage build
được hoàn toàn tự động. Group không có đường API hợp lệ.

**Hệ quả cốt lõi #2 — Graph API KHÔNG có lịch sử.** Mọi endpoint chỉ trả **số
tại thời điểm gọi** (current totals). Vì vậy mọi chỉ số dạng *trend / tăng
trưởng / velocity theo thời gian* **bắt buộc phải tự lưu snapshot định kỳ**.
→ Kiến trúc phải có một **cron fetcher** ghi snapshot vào Supabase, đúng tinh
thần `track.js` của email-tracker (tích lũy theo thời gian).

---

## 2. Kiến trúc đề xuất (soi gương email-tracker)

```
                  ┌─────────────────────────────────────────┐
   Cron (Vercel)  │  api/fetch.js   (chạy mỗi 1–3h)           │
   ──────────────►│  Page Graph API → chuẩn hoá → Supabase   │
                  └─────────────────────────────────────────┘
                                   │  (posts + snapshots tích lũy)
                                   ▼
                          Supabase Postgres
                                   │
                  ┌─────────────────────────────────────────┐
   Người xem ────►│  api/facebook.js  (serverless)           │
                  │  đọc Supabase → render 1 trang HTML       │
                  │  (CÙNG CSS/JS design system email-tracker)│
                  └─────────────────────────────────────────┘
```

| File | Vai trò | Tương đương email-tracker |
|---|---|---|
| `api/fetch.js` | Cron: gọi Page API, ghi `fb_posts` + `fb_snapshots` | `api/track.js` (ingest) |
| `api/facebook.js` | Render dashboard từ Supabase | `api/dashboard.js` |
| `lib/process.js` *(tuỳ chọn)* | Tính các chỉ số phái sinh | `process()` trong dashboard.js |

**Gộp 1 link – 2 trang:** thêm segmented control `.seg` (class đã có sẵn) trên
masthead: `[ Email ] [ Facebook ]`. Cùng 1 Vercel project, route `?page=fb`
hoặc 2 function chia sẻ shell CSS/JS. Theme/density/command-palette dùng chung.

---

## 3. Data model (Supabase)

Tách **dữ liệu tĩnh của post** (metadata) khỏi **chuỗi snapshot** (để dựng
trend/velocity). Đây là điểm mấu chốt để có "lịch sử" mà API không cho.

```
fb_posts                      -- 1 dòng / 1 bài (metadata, ít đổi)
  post_id PK, page_id, message, created_time, type, permalink,
  attachments(jsonb), author(jsonb), topic_tag

fb_snapshots                  -- 1 dòng / 1 bài / 1 lần fetch (time-series)
  id PK, post_id FK, captured_at,
  views, media_viewers, clicks(jsonb by_type),
  reactions(jsonb: total+like+love+haha+wow+sad+angry),
  comments_count, shares_count,
  video(jsonb: media_views, avg_watch_time, completion_rate, reels_replays)

fb_comments                   -- (tuỳ chọn) để phân tích comment chi tiết
  comment_id PK, post_id FK, author, message, created_time, reply_count

fb_page_snapshots             -- page-level theo thời gian
  id PK, page_id, captured_at, followers_count, page_views
```

`fb_snapshots` cho phép tính **delta giữa 2 lần fetch** → ra velocity, trend,
tăng trưởng — thứ API không bao giờ trả trực tiếp.

---

## 4. ⭐ Bảng map TỪNG chỉ số → cách lấy tự động

> Ký hiệu khả thi:
> **✅ Auto** = fetch trực tiếp 1 lần gọi · **🟡 Tính** = dashboard tự tính từ
> dữ liệu thô (deterministic) · **🟠 Snapshot** = cần chuỗi snapshot theo thời
> gian · **🔴 Hạn chế** = cần NLP hoặc không lấy được qua API.
>
> ⚠️ = tên field string cần đối chiếu lại Graph API reference **phiên bản đang
> dùng tại thời điểm code** (đợt 15/06/2026 vừa đổi tên hàng loạt — tôi không
> khẳng định string khi chưa fetch được docs).

### POST METADATA
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| ID, nội dung, thời gian đăng | ✅ | Post object: `id, message, created_time` |
| Loại bài (text/photo/video/link/reel) | ✅ | `status_type` + suy ra từ `attachments` |
| Tác giả bài | ✅ | `from{ name, id }` |
| Link / media đính kèm | ✅ | `attachments{ media, type, url, title, target }` |

### REACTIONS
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| Tổng reactions | ✅ | `reactions.summary(total_count).limit(0)` — **edge, ổn định, không phụ thuộc Insights** |
| Like/Love/Haha/Wow/Sad/Angry (+Care) | ✅ | Lặp `reactions.type(LOVE).limit(0).summary(total_count).as(love)` cho từng loại |
| Sentiment Score (reaction-based) | 🟡 | Tính: `(love+haha+wow+care − sad−angry) / total`. Deterministic, không cần NLP |

### COMMENTS
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| Tổng comments | ✅ | `comments.summary(true)` → `total_count` |
| Nội dung + tác giả + thời gian từng comment | ✅* | `comments{ message, from, created_time }`. *`from` có thể null nếu không phải bài của Page hoặc thiếu quyền (quirk thật) |
| Replies cấp 2 | ✅ | Mỗi comment có `comment_count` (số reply) |
| Comment Depth (replies/comments) | 🟡 | Tính từ `comment_count` các comment |
| Thời gian comment đầu tiên sau đăng | 🟡 | `min(created_time)` comments − `created_time` post |
| Admin/Page response rate | 🟡 | % comment có reply từ `from.id == page_id` |
| Comment Sentiment (phân tích text) | 🔴 | Text lấy được, nhưng **sentiment phải tự chạy NLP/LLM** — không phải metric API. Đề xuất: tuỳ chọn, batch lexicon tiếng Việt hoặc LLM |

### SHARES
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| Tổng shares | ✅* | `shares{ count }`. *Đáng tin với bài của chính Page |
| Virality Score | 🟡 | Tính: `shares / engagement` (hoặc `shares / views`) |

### VIEWS & REACH  *(vùng biến động — hậu 15/06/2026)*
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| Post Views *(thay Impressions)* | ✅⚠️ | Insights metric "views" (post_impressions đã bỏ). **Xác nhận string** |
| Media Viewers *(thay Reach)* | ✅⚠️ | Reach cũ đã bỏ 15/06; dùng "Media Viewers / Page Viewer". **Xác nhận string** |
| Reach Rate | 🟡 | `media_viewers / followers_count` |
| Paid Reach (tách paid/organic) | 🔴 | **Meta đã bỏ tách paid vs organic** cho reach. Chỉ còn tổng unique views. Muốn số paid → cần **Marketing/Ads Insights API** (luồng khác) |

### CLICKS
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| Link clicks | ✅⚠️ | `post_clicks` (insights — **xác nhận còn sống sau 06/2026**) |
| Click type breakdown | ✅⚠️ | `post_clicks_by_type` (xác nhận) |

### VIDEO & REELS  *(vùng biến động — hậu 15/06/2026)*
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| Video Media Views | ✅⚠️ | `/{VIDEO_ID}/video_insights?metric=total_video_views` — **thay 3-sec views** (deprecated 06/2026). Tổng lượt xem video |
| **Người xem video (unique)** | ✅⚠️ | `total_video_views_unique` — số người xem duy nhất = "Người xem" của video |
| Autoplay Views | ✅⚠️ | `total_video_views_autoplayed` — lượt autoplay (cuộn qua, thụ động) |
| Click-to-play Views | ✅⚠️ | `total_video_views_clicked_to_play` — lượt xem chủ động (bấm play) |
| Avg Watch Time | ✅⚠️ | `total_video_avg_time_watched` (ms → đổi ra giây khi hiển thị) |
| Total Watch Time | ✅⚠️ | `total_video_view_time` (ms) — tổng thời gian xem tích luỹ |
| Xem hết video (unique) | ✅⚠️ | `total_video_complete_views_unique` — người xem đến cuối |
| Completion Rate | 🟡 | Tính: `complete_views_unique ÷ views_unique`. Không cần API thêm |
| Retention Curve | ✅⚠️ | `total_video_retention_graph` — mảng % người còn xem theo từng % video |
| Reels Views | ✅⚠️ | Reels có metric riêng (tên chính xác xác nhận tại Graph v23+) |
| Reels Replays | ✅⚠️ | Reels insights — số lần xem lại |

> **Cách fetch video insights:** Gọi `/{POST_ID}/video_insights?metric=...` (không phải `/insights`) cho post dạng Video/Reel. Tolerant error — nếu lỗi metric thì ghi vào `errors[]`, không làm hỏng cả lần fetch (đã áp dụng cùng pattern).

### LIVESTREAM
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| Danh sách buổi live | ✅ | `GET /{PAGE_ID}/live_videos?fields=id,title,status,live_status,created_time` |
| **Peak Concurrent Viewers** | ✅⚠️ | `/{LIVE_VIDEO_ID}/live_video_insights?metric=peak_concurrent_viewers` — đỉnh người xem đồng thời |
| **Tổng Views (trong + sau live)** | ✅⚠️ | `total_video_views` qua `live_video_insights` |
| **Người xem duy nhất (live)** | ✅⚠️ | `total_video_views_unique` qua `live_video_insights` |
| Thời lượng broadcast | 🟡 | `updated_time − created_time` khi `live_status = VOD` |
| Live Reactions | ✅ | Edge expansion trên live video object (cùng cơ chế post thường, ổn định) |
| Live Comments | ✅ | `comments.summary(true)` — edge expansion ổn định |
| VOD sau broadcast | 🟡 | Khi live kết thúc, video tồn tại như regular video → có đủ `video_insights` |
| Scheduled live (sắp phát) | ✅ | `live_status = SCHEDULED_LIVE` trong `live_videos` feed |
| Tần suất live / tháng | 🟡 | Đếm buổi từ `created_time` trong kỳ |

### ENGAGEMENT TỔNG HỢP
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| Engagement Score | 🟡 | `reactions + comments + shares` |
| Engagement Rate | 🟡 | `score / followers_count` |
| Engagement Velocity (theo giờ sau đăng) | 🟠 | **Cần snapshot**: delta engagement giữa các lần fetch. Không có snapshot → không dựng được đường velocity |
| Response Rate (% bài có ≥1 comment) | 🟡 | Trên tập post |
| % bài không có tương tác | 🟡 | Trên tập post |

### TIMING ANALYSIS
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| Giờ/ngày tương tác cao nhất | 🟡 | Từ `created_time` post + comments (reaction **không** có timestamp/cái → dùng post time & comment time) |
| Posting frequency | 🟡 | Đếm post / khoảng thời gian |
| Trend tăng/giảm theo tuần/tháng | 🟠 | **Cần snapshot** để có lịch sử |
| So sánh kỳ này vs kỳ trước | 🟡 | Cửa sổ `cl` vs `pl` (đã có pattern ở email-tracker) |

### CONTENT ANALYSIS
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| Hiệu quả theo loại bài | 🟡 | Group theo `status_type` |
| Hiệu quả theo chủ đề/topic | 🟡 | Cần gắn `topic_tag` (nhập tay/keyword) — API không có "topic" |
| Content mix ratio | 🟡 | Tỉ lệ loại bài |
| Top posts theo từng metric | 🟡 | Sort tập post |

### PAGE-LEVEL
| Chỉ số | Khả thi | Cách lấy |
|---|:--:|---|
| Follower growth *(thay page_fans)* | 🟠 | `followers_count` hiện tại ✅, nhưng **growth cần `fb_page_snapshots`** theo thời gian |

### GROUP-LEVEL → **tạm gác** (không có API hợp lệ, xem §8)

**Tổng kết khả thi:** trong toàn bộ bảng bạn gửi, **chỉ 2 mục thật sự không tự
động được**: (a) *Comment Sentiment* (cần NLP — có thể thêm bước LLM tuỳ chọn),
(b) *Paid Reach tách bạch* (Meta đã bỏ; chỉ Ads API mới có). Mọi mục còn lại
**đều tự động được** — với điều kiện có **cron snapshot** cho nhóm 🟠
(velocity/trend/growth).

---

## 5. Layout & Design — tái dụng nguyên hệ email-tracker

### 5.0 Nghiên cứu thị trường (top tool + UX research)

Đã khảo sát các dashboard marketing/social hàng đầu 2025–2026 (Sprout Social,
Hootsuite+Talkwalker, Brandwatch, Sprinklr, Meta Business Suite, Databox,
Geckoboard, Whatagraph, Looker Studio, Klipfolio, Emplifi) + nghiên cứu UX
(Nielsen Norman, Smashing, UXPin). **5 nguyên tắc hội tụ** áp dụng cho ta:

1. **Inverted pyramid + F-pattern.** Người dùng quét ngang trên cùng rồi xuống
   trái. → KPI quan trọng nhất đặt **top, trên màn hình đầu** (above the fold).
2. **6–8 KPI cốt lõi, KHÔNG dàn đều 30 số.** Tạo phân cấp bằng *kích cỡ – màu –
   vị trí*. Mỗi KPI: số lớn + nhãn + mũi tên trend + sparkline + so kỳ trước.
3. **Bento grid** — khối module gọn, dễ quét, mobile-friendly.
4. **3 tầng chiều dọc:** trên = KPI tổng quan · giữa = biểu đồ xu hướng/time-series
   · dưới = bảng chi tiết (progressive disclosure — đào sâu khi cần).
5. **Tabs theo định dạng** (Meta Business Suite: Posts / Reels / Video) +
   **so sánh kỳ vs kỳ** + **benchmark vs trung bình của chính mình**.

> Tin tốt: email-tracker **đã** hiện thực gần hết bộ này (gauge, KPI card +
> sparkline, area chart, tier, bảng search/pagination, cửa sổ `cl` vs `pl`, 2
> view operational/executive, cross-filter). Ta kế thừa một bộ khung
> best-in-class và chỉ cần sắp lại theo inverted pyramid + thêm tabs định dạng.

### 5.1 Layout chốt (theo inverted pyramid)

```
┌─ MASTHEAD ── [SHB ▸] [ Email | Facebook ] ···· [7d 30d 90d] [◐ theme] [⌘K] [Operational|Executive] [● cập nhật 2h trước]
├─ FILTER BAR ── [Khoảng ngày] [Loại bài ▾] [Topic/Chiến dịch ▾] [Định dạng ▾]
│
├─ TẦNG 1 · ABOVE THE FOLD ───────────────────────────────────────────
│   ┌──────────────┐  ┌── HERO KPI (6–8, bento) ──────────────────────┐
│   │  RADIAL GAUGE │  │ Views │ Reactions │ Comments │ Shares          │
│   │  Engagement   │  │ New Followers │ Engagement Rate │ Click Rate   │
│   │  Rate vs mục  │  │ (mỗi card: số lớn + ▲% vs kỳ trước + spark)    │
│   └──────────────┘  └────────────────────────────────────────────────┘
│
├─ TẦNG 2 · XU HƯỚNG (giữa) ──────────────────────────────────────────
│   [ Area chart: Views/Engagement theo thời gian (snapshot) ]
│   [ Heatmap giờ×ngày: best time ]   [ Donut: sentiment reactions ]
│
├─ TẦNG 3 · HIỆU QUẢ NỘI DUNG (tabs) ─────────────────────────────────
│   ( Posts | Reels/Video )  bảng sort + search + pagination
│   → click 1 dòng = drill xuống chi tiết bài
│
├─ TẦNG 4 · PHÂN TÍCH ────────────────────────────────────────────────
│   [ Theo loại bài ] [ Theo topic ] [ Content mix ] [ Engagement velocity ]
│
├─ TẦNG 5 · AUDIENCE / PAGE ──────────────────────────────────────────
│   [ Follower growth (snapshot) ] [ Demographics nếu có ]
│
└─ TẦNG 6 · HEALTH ── tuổi snapshot · field lỗi · cảnh báo deprecation
```

**Executive view** (rút gọn cho lãnh đạo): gauge + 4 hero KPI + 1 area chart +
top-5 posts + 1 insight callout. Bấm `Operational|Executive` để đổi (`_mode`).

### 5.2 Tái dụng nguyên hệ email-tracker

**Design tokens (đọc trực tiếp từ `api/dashboard.js`, dùng y nguyên):**
```
--bg:#0b0916  --accent:#8b7bff  --accent-2:#5b8cff
--grad: linear-gradient(135deg,#7c5cff,#5b8cff)
--good:#34e0a1  --warn:#ffc861  --risk:#ff7d96   --r:22px
font: 'Plus Jakarta Sans' (UI) + 'Space Grotesk' (số)
glassmorphism + 4 radial orb background + dark/light theme
```
**Component tái dụng:** `radialGauge()`, `areaChart()`, `spark()`, KPI cards,
tier Hot/Warm/Cold, table controller (search + pagination), cross-filter,
command palette (⌘K), toggle theme/density, 2 view operational/executive,
tooltip delegated (`data-tip`).

**Sections trang Facebook:**
| ID | Nội dung | Chỉ số chính |
|---|---|---|
| `#s-ov` | Tổng quan | gauge engagement rate · KPI (views, reactions, comments, shares, followers) · trend |
| `#s-content` | Hiệu quả từng bài (bảng search+pagination) | top/bottom posts theo từng metric |
| `#s-react` | Reactions & sentiment | breakdown 6 loại + sentiment score |
| `#s-reach` | Views & Media Viewers | views, reach rate |
| `#s-engage` | Engagement & velocity | score, rate, **velocity (snapshot)** |
| `#s-time` | Timing | best-time heatmap, posting frequency, kỳ vs kỳ |
| `#s-video` | Video / Reels | media views, watch time, completion, reels replays |
| `#s-content-mix` | Phân tích nội dung | theo loại bài / topic / content mix |
| `#s-health` | Chất lượng dữ liệu + **cảnh báo deprecation** | tuổi snapshot, field lỗi, mốc deprecation tới |

---

## 6. ⚠️ Checklist xác nhận khi bắt đầu code (bắt buộc)

Vì đợt 15/06/2026 vừa đổi tên field, **trước khi viết `fetch.js`** phải mở
Graph API reference (version sẽ dùng, vd v23/v24) và xác nhận string thật cho:
- [ ] Metric thay cho `post_impressions` (Views) — tên chính xác
- [ ] Metric thay cho Reach (Media Viewers / Page Viewer) — tên chính xác
- [ ] `post_clicks` / `post_clicks_by_type` còn sống không
- [ ] Video: tên metric Media Views (thay 3-sec views), watch time, reels
- [ ] Page-level: `followers_count` vs metric follower mới
- [ ] Quyền cần: `pages_read_engagement`, `pages_read_user_content`, `read_insights` + Page access token dài hạn

**Nguyên tắc kỹ thuật:** ưu tiên **edge expansion** (`reactions`, `comments`,
`shares` trên post object) hơn **Insights metrics** ở đâu có thể — vì edge ổn
định, còn Insights là nhóm liên tục bị Meta cắt.

---

## 7. Deprecation watch (đưa vào `#s-health`)
- ✅ 15/11/2025 — impressions→views, bỏ page_fans *(đã áp dụng)*
- ✅ 15/06/2026 — bỏ reach/video-impressions/3-sec views *(đã áp dụng)*
- 🔭 Theo dõi blog Meta cho đợt kế tiếp; `#s-health` nên cảnh báo nếu 1 field trả "invalid metric error".

---

## 8. Vì sao tạm gác trang Group
Groups API chết từ 04/2024; không API hợp lệ nào đọc được engagement group.
Bài Page đăng *vào* group là nội dung group → cũng không lấy được qua Page API.
3 đường còn lại: nhập tay / import CSV (xuất từ Group Insights native) / Meta
Content Library (chỉ academic, phí ~$371/tháng từ 2026). Khi bạn chốt đường,
trang Group sẽ ingest theo đúng pattern này — thêm `fb_group_posts` (nhập tay)
và một section `#s-group`, dùng lại toàn bộ component sẵn có.

---

## 9. Đề xuất bước tiếp theo
1. Chốt version Graph API + lấy Page long-lived token → xác nhận §6 checklist.
2. Dựng Supabase schema §3.
3. Viết `api/fetch.js` (cron) ingest snapshot.
4. Viết `api/facebook.js` tái dụng CSS/JS email-tracker + sections §5.
5. Thêm page-switcher `[ Email ][ Facebook ]`, gộp 1 link.
6. Sau cùng: bật lại trang Group theo nguồn dữ liệu đã chốt.
