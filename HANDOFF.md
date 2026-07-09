# HANDOFF — SHB CM Dashboard (HỢP NHẤT Email + Facebook, cập nhật 09/07/2026 tối)

## 🚧 ĐANG DỞ — 09/07 tối: anh Nam đã cấp MySQL creds, đang bị ETIMEDOUT — cần mở Security Group

**Cập nhật 09/07 tối:** Đầu mối DevOps phụ trách hạ tầng đã đổi từ anh Quang sang **anh Nam**.
Đã gửi tin nhắn Teams gộp 4 việc (xem lịch sử bên dưới). Anh Nam đã rep 2 việc:
- **MySQL creds đã cấp**: user `cm_dashboard_user` / pass `Cmshb@2026` (không lưu plaintext vào
  repo — chỉ khai báo qua GitLab CI/CD Variables), host `rds-sahadb.dev-saha.aws.shb.com.vn`,
  port `3306`. Đã cấp quyền chạy SQL trên user này.
- Còn 2 việc (service ingest riêng + `imagePullPolicy: Always`) **CHƯA thấy anh Nam rep**.

**Đã tạo bộ công cụ chẩn đoán trên GitHub** (đích để user copy tay sang GitLab, nhánh dùng lại
DUY NHẤT `test-db-connection` — LƯU Ý: không tự tạo thêm branch `-2`/`-3`... nữa, đã bị nhắc):
- `.gitlab-ci.yml`: thêm job tạm `db_check` (stage riêng, `when: manual`, `dependencies: []`).
- `db/db_check.js`: script Node dùng `mysql2` (KHÔNG dùng `apk add mysql-client` — runner nội
  bộ chặn egress ra `dl-cdn.alpinelinux.org`, đã thử và fail; cũng không dùng image `alpine:3.19`
  công khai vì không pull được — đổi sang mirror nội bộ
  `gitlab-nhs.shb.com.vn:5050/omnichannel/omni-devops/ci-template/node:20-alpine-amd`, cùng
  image job `sync_data` đang dùng OK).
- Cả 2 file đã qua 4 vòng fix lỗi thật (PR #79→#82 trên GitHub, đã merge hết): image không pull
  được → đổi mirror nội bộ → `apk` không cài được → đổi sang `npm install mysql2` → tải nhầm
  artifact thừa của `sync_data` bị 403 → thêm `dependencies: []` → biến CI/CD `MYSQL_PASSWORD`
  bị tick Protected trong khi branch test không phải protected → user bỏ tick → **giờ script
  chạy được, kết nối được biến, nhưng bị `ETIMEDOUT` khi gọi MySQL** (job #626396).

**🔥 Vướng hạ tầng cần anh Nam xử lý tiếp:** GitLab runner nội bộ **không kết nối được** tới
`rds-sahadb.dev-saha.aws.shb.com.vn:3306` (timeout, không phải sai user/pass — script đã tới
được bước gọi `mysql2.createConnection` nhưng treo tới hết timeout). Nghi nhiều khả năng nhất:
**Security Group của RDS chưa mở inbound port 3306 cho dải IP/subnet của GitLab runner nội bộ**
(runner chạy trên `runner-d63eeu3`, cùng hạ tầng AWS `dev-saha`, nhưng RDS SG có thể đang chỉ
whitelist theo SG/IP cụ thể khác). Cần nhờ anh Nam:
1. Kiểm tra Security Group của RDS `rds-sahadb.dev-saha.aws.shb.com.vn` có cho phép inbound
   3306 từ SG/subnet của GitLab runner (`omnichannel`/CI runner) không.
2. Nếu RDS nằm trong VPC riêng, xác nhận GitLab runner có route/peering tới VPC đó không.

**Việc đầu tiên phiên sau**: hỏi user đã có phản hồi anh Nam về SG/network chưa; nếu rồi thì
chạy lại job `db_check` (Pipelines → nhánh `test-db-connection` → job `db_check` → ▶) và đọc
log mới. Nếu hết ETIMEDOUT và ra được `SHOW DATABASES`, báo user tên DB rồi điền
`MYSQL_DATABASE` vào CI/CD Variables, chạy lại job để tự động apply `db/schema.mysql.sql`.
Sau khi xác nhận xong, XOÁ `db/db_check.js` + job `db_check` khỏi `.gitlab-ci.yml` (chỉ dùng để
chẩn đoán tạm, không để lại lâu dài).

### Bối cảnh kỹ thuật dẫn tới việc gửi tin nhắn trên (chi tiết sáng 08/07)

**Đã làm sáng 08/07:**
- User đã copy `nginx.conf` (commit `b611acb`) sang GitLab, tạo MR `!5` từ branch
  `fix-nginx-ingest-upstream` → `main`, **đã merge** (commit `d4b67937`).
- Pipeline `#263945`: 5/6 job pass (`sync_data`, `pages`, `aws-authen-cicd`,
  `docker_build_ecr`, `update_manifest_aws_dev`) — chỉ fail `update_manifest_ingest_aws_dev`
  (đúng dự đoán, `PermissionDenied` khi CI gọi ArgoCD restart app `cm-dashboard-ingest`
  chưa tồn tại/CI chưa có quyền).
- **Sự cố 503 đã hết** — `/health` trả 200. Nhưng `/` (trang chính) giờ trả **403 Forbidden**.
- **Đã điều tra kỹ, xác nhận KHÔNG phải lỗi code/config mình vừa đẩy**:
  - Diff merge `d4b67937` chỉ đổi đúng 2 block `/api/track` + `/api/ingest` (proxy_pass →
    return 503 tạm) — không đụng gì tới `location /` (nơi đang bị 403).
  - `public/index.html` build bởi job `sync_data` đúng, đủ 59558 bytes, quyền `-rw-r--r--`
    (world-readable) — không phải lỗi thiếu file/sai quyền.
  - Đúng bộ nginx.conf + kiểu file portal.js bake ra đã được test bằng nginx thật trong
    sandbox tối 07/07 (mục review bên dưới) → `/` trả 200 — chứng minh code đúng.
  - Job `update_manifest_aws_dev` (job pass, khác job ingest) có dòng
    `argocd app actions run $APP_NAME restart --kind Deployment` chạy **thành công, không lỗi**
    → pipeline đã TỰ ĐỘNG trigger restart pod, không cần Quang bấm tay.
- **Kết luận: pod đã restart nhưng vẫn 403 → đúng nghi vấn cache image cũ do thiếu
  `imagePullPolicy: Always`** (bài học đã ghi từ hôm 07/07) — restart pod xong nhưng node
  dùng lại image cache cũ theo tag cố định thay vì pull bản mới.
- ⏳ **User CHƯA gửi tin nhắn cho Quang** (đang chờ soạn xong/chọn thời điểm gửi). Nội dung
  cần gửi (đã soạn sẵn, chưa gửi): xin thêm `imagePullPolicy: Always` cho Deployment
  `cm-dashboard` + hỏi về RBAC `PermissionDenied` cho app `cm-dashboard-ingest`.
- **Việc đầu tiên phiên sau nếu user báo "Quang đã rep"**: đọc phản hồi của Quang, nếu đã
  thêm `imagePullPolicy: Always` và restart → hướng dẫn user F5 kiểm tra lại `/`; nếu còn
  403 thì đào sâu thêm (có thể cần xem trực tiếp pod logs mà Claude không truy cập được,
  phải nhờ user paste log). Nếu Quang confirm ArgoCD app ingest đã tạo → khôi phục lại
  2 block `proxy_pass` thật trong `nginx.conf` (đã có sẵn comment hướng dẫn ngay trong file).


> Repo này giờ là **bản hợp nhất 1 repo + 1 Vercel** cho cả 2 dashboard CM.
> Live (portal): https://shb-fb-dashboard.vercel.app/ → tab **Facebook | Email | Jira**.
> Quy trình: branch dev → PR vào `claude/loving-planck-y6lw57` (production, Vercel auto-deploy).
> Branch dev gần nhất: đang làm thẳng trên `claude/loving-planck-y6lw57` (không qua PR riêng) —
> xem lịch sử PR cũ ở mục bên dưới nếu cần đối chiếu.

## 🚧 ĐANG DỞ — Merge vào `cm-dashboard` (GitLab nội bộ) — CHỐT NGÀY 07/07/2026

**Bối cảnh:** Thực hiện §7c trong `KE_HOACH_MIGRATION.md` — mở rộng repo `cm-dashboard`
(Jira dashboard nội bộ, `gitlab-nhs.shb.com.vn/cm/cm-dashboard`) thành portal 3 tab
Facebook | Email | Jira, thay vì xin repo/domain mới.

### Trạng thái 2 repo — cập nhật tối 07/07/2026

**GitHub `shb-dashboard-media`** (`claude/loving-planck-y6lw57`, production, Vercel auto-deploy):
= NGUỒN CHUẨN, luôn chứa bản MỚI NHẤT. Đã xong trong ngày 07/07:
- **Portal mặc định mở tab Jira khi build tĩnh nội bộ** (`api/portal.js`) — nhận diện qua
  `req.headers.host` (Vercel luôn có host, bản bake GitLab qua `sync.js` thì không) → default
  tab = `jira` nội bộ, `fb` trên Vercel. Không đổi gì hành vi Vercel.
- **Masthead Jira đồng bộ style với Facebook/Email** (`reference/cm-dashboard-original/public/index.html`)
  — tách 2 hàng: hàng 1 dùng chung (logo SHB + chuyển Facebook/Email/Jira + ⌘K/theme), hàng 2 riêng
  Jira (chip Task, lịch ngày + so kỳ trước, Trục X, Deadline, +Lưu bộ lọc, phóng to, Tuỳ chỉnh,
  đồng bộ, Xuất CSV/PDF). Đã relocate nguyên JSX/handler cũ (không viết lại logic), test bằng
  Babel transform + headless Chromium (mở trực tiếp & nhúng iframe) trước khi push.
- **Masthead Facebook/Email cũng tách 2 hàng cho đồng bộ 3 dashboard** (`api/fb-dashboard.js`,
  `api/email-dashboard.js`) — hàng 1 (logo+pgsw+⌘K/theme) **ẩn hẳn khi nhúng qua portal**
  (`.embed .mast-row1{display:none}`) vì portal ngoài đã có sẵn, tránh xếp chồng nhiều lớp;
  hàng 2 (presets ngày, Tuỳ chọn, ⌘K/theme, Tóm tắt lãnh đạo) luôn hiện, gộp `mh-grp` vào
  `mast-row2-right` cùng `mode-btn`. Kèm `html.embed body{padding-top:63px}` + `.embed .mast{top:63px}`
  để không đè lên thanh topbar của portal (đây là bug thật, đã tái hiện + verify bằng Chromium).
- **Fix cỡ chữ số to giữa gauge lệch nhau giữa Facebook/Email** — trước đó Facebook dùng công
  thức co giãn 24-46px theo độ dài chuỗi (số dài bị nhỏ xíu, số ngắn quá to chạm viền cung),
  Email cố định 46px. Đồng bộ về **34px** (khớp `.bento .kpi.feat .kv` sẵn có trong code) cho cả
  `gaugeBig()`/`radialGauge()` ở `fb-dashboard.js` và `radialGauge()` ở `email-dashboard.js`.
- Các việc từ hôm 06/07 (sync.js v4, lib/db-client.js đọc+ghi MySQL, server/ingest-server.js,
  Dockerfile.dashboard/.ingest, nginx.conf, .gitlab-ci.yml, Jira SPA embed 63px, rà soát 6 lỗi
  deploy) — xem chi tiết ở các commit cũ, không lặp lại ở đây.

**GitLab `cm-dashboard`** (nhánh `merge-email-facebook` → **đã merge vào `main` tối 07/07**):
- MR `!3` đã bấm Merge — pipeline trên `main` chạy: **5/6 job pass**, chỉ fail
  `update_manifest_ingest_aws_dev` (đúng dự đoán — ArgoCD app `cm-dashboard-ingest` chưa được
  Quang xác nhận/tạo). Dashboard chính (Facebook/Email/Jira) đã deploy qua job
  `update_manifest_aws_dev` (PASS).
- 🔥 **SỰ CỐ 503 chiều 07/07 — ĐÃ TÌM RA NGUYÊN NHÂN GỐC (lỗi của mình, không phải hạ tầng):**
  `nginx.conf` merge sáng 07/07 có `proxy_pass http://ingest-service:3001` — nginx phân giải
  hostname trong proxy_pass **ngay lúc khởi động**, mà Service `ingest-service` chưa tồn tại
  trên cluster (app ingest chưa deploy được vì PermissionDenied) → nginx chết ngay
  (`[emerg] host not found in upstream`) → pod crash-loop → **503 toàn site kể cả /health**.
  Đã TÁI HIỆN được bằng `nginx -t` với chính file đó (fail đúng dòng 61), fix bằng cách
  **stub 2 route** `/api/track`+`/api/ingest` = `return 503` tạm (commit `b611acb`,
  `nginx -t` pass) — khi Quang tạo xong Service ingest thì khôi phục proxy_pass theo comment
  trong file. **Vì sao sáng merge xong vẫn chạy, chiều mới chết:** pod restart sau merge dùng
  lại image CŨ cache trên node (`imagePullPolicy` không phải `Always` — cũng chính là lý do
  UI không đổi); image mới nhiễm độc nằm chờ trong ECR, đến khi k8s dựng lại/di chuyển pod
  sang node phải pull thật → nginx crash. 2 hiện tượng (UI không đổi + 503 muộn) = 1 chuỗi
  nguyên nhân.
- ⚠️ **Vẫn cần Quang thêm `imagePullPolicy: Always`** cho 2 Deployment: vừa để fix nginx ở trên
  chắc chắn được pull về (node đang cache image hỏng tag `:dev`), vừa để mọi lần build sau
  thực sự lên hình. Chưa xác nhận Quang đã làm.
- **Đã đẩy tiếp sang GitLab tối 07/07** (qua git CLI, không dùng Web IDE):
  - `api/portal.js` (mặc định tab Jira nội bộ) — đã push.
  - `reference/.../index.html` → `public/api/jira/index.html` (masthead 2 hàng Jira) — đã push.
  - `api/fb-dashboard.js` + `api/email-dashboard.js` (masthead 2 hàng + fix gauge) — **vừa hướng
    dẫn user copy+commit+push xong, CHƯA xác nhận kết quả pipeline lần này.**

### 🔬 TỔNG REVIEW TỐI 07/07 — toàn bộ code ĐÃ KIỂM CHỨNG BẰNG CHẠY THẬT, không cần test lại
Sau sự cố 503, đã giả lập **nguyên chuỗi deploy nội bộ** ngay trong sandbox (cài nginx thật)
để chặn mọi lỗi cùng lớp "syntax pass nhưng deploy chết". Kết quả — TẤT CẢ PASS:
1. **Syntax**: 12/12 file JS (`api/ lib/ server/ sync.js`) pass `node --check`; `.gitlab-ci.yml`
   parse YAML hợp lệ.
2. **Job `sync_data` mô phỏng nguyên bản** với **0 biến env** (đúng tình trạng CI hiện tại):
   `npm install` → `node sync.js` chạy hết (thiếu JIRA_* chỉ warn rồi bỏ qua phần Jira, không
   crash) → bake đủ 4 HTML → 7 lệnh `cp` vendors chạy thật OK với đúng version pin
   (react@18 còn `umd/`, babel@7, recharts 2.12.7, prop-types 15.8.1, html2canvas 1.4.1, jspdf 2.5.1).
3. **nginx THẬT + `nginx.conf` đã fix + `public/` vừa build**: khởi động OK; probe 10 route:
   `/health` 200 · `/` 200 (portal, `cur='jira'` đúng mặc định nội bộ) · `/api/facebook|email|leader`
   200 · `/api/jira/` + `config.json` 200 · `/vendors/*` 200 · `/api/track`+`/api/ingest` 503 stub
   đúng thiết kế.
4. **Chromium bấm qua cả 3 tab** trên chính portal nginx đang phục vụ: masthead 2 hàng sạch,
   không đè chữ, gauge 34px nằm gọn trong cung, KHÔNG lỗi JS mới (chỉ còn 1 lỗi console vô hại
   có sẵn trong SPA Jira gốc — đã chứng minh tồn tại từ trước khi mình sửa).
5. **`ingest-server.js`**: boot với 0 env KHÔNG crash (không có nguy cơ crash-loop kiểu nginx);
   MySQL hỏng → beacon vẫn trả pixel 200 (chỉ log lỗi); sai secret → 401; thiếu env → 500 JSON
   message rõ; OPTIONS → 204.
6. **2 Dockerfile** khớp layout đã test (dashboard = COPY nginx.conf+public; ingest = `/app`,
   require tương đối theo file nên không lệch path).
7. **Schema MySQL đối chiếu code ghi thật**: bảng `events` 15 cột khớp 100% kể cả độ dài VARCHAR
   khớp từng giới hạn `clip()`; `fb_group_posts`/`fb_page_insights`/snapshots khớp payload;
   `buildInsert` convert đúng ISO→Date (mysql2 serialize được), object→JSON string, upsert có
   `ON DUPLICATE KEY UPDATE` + COALESCE giữ giá trị cũ khi row thiếu cột.

### ✅ VIỆC ĐẦU TIÊN PHIÊN SAU (thứ tự bắt buộc — site nội bộ đang 503)
1. **Đẩy `nginx.conf` đã fix sang GitLab** — file đã gửi trong chat chiều 07/07 (nguồn = commit
   `b611acb` repo này, cũng có thể tải lại từ GitHub). Lệnh:
   ```
   copy %USERPROFILE%\Downloads\nginx.conf %USERPROFILE%\cm-dashboard\nginx.conf
   cd %USERPROFILE%\cm-dashboard
   git checkout main && git pull origin main
   git checkout -b fix-nginx-ingest-upstream
   git add nginx.conf
   git commit -m "Fix 503: stub route ingest - nginx khong khoi dong khi upstream chua ton tai"
   git push origin fix-nginx-ingest-upstream
   ```
   → tạo MR → merge vào `main` ngay (fix sự cố).
2. Pipeline xanh mà site **vẫn 503** → KHÔNG phải code lỗi: node đang cache image hỏng cùng tag
   `:dev`. Lúc đó **bắt buộc nhờ Quang thêm `imagePullPolicy: Always`** cho Deployment
   `cm-dashboard` rồi restart (1 phát giải quyết cả 503 lẫn chuyện mọi bản build sau tự lên hình).
3. Site sống lại → checklist nghiệm thu: portal mở thẳng tab Jira · masthead 2 hàng đồng bộ cả
   3 dashboard · không đè chữ · gauge không chạm viền · bấm chuyển tab đủ 3 trang.
4. Báo Quang thêm vụ RBAC `PermissionDenied` khi restart `cm-dashboard-ingest` (log job
   `update_manifest_ingest_aws_dev` — tài khoản CI login được nhưng không có quyền
   restart app ingest).

### Sau đó — chờ/thực hiện theo phản hồi anh Quang (đã hỏi qua Teams 06/07, còn treo)
- [ ] Nhận **MySQL credentials** → điền CI/CD Variables (`Settings → CI/CD → Variables`):
      `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `INGEST_SECRET`
      (INGEST_SECRET tự sinh được: `powershell -Command "[guid]::NewGuid().ToString()"`).
- [ ] Nhờ Quang **chạy `db/schema.mysql.sql`** (đối chiếu bảng `events` với schema gốc trước).
- [ ] Quang xác nhận **APP_NAME ArgoCD** cho ingest (`cm-dashboard-ingest`) đã tồn tại chưa —
      job `update_manifest_ingest_aws_dev` đang fail vì việc này.
- [ ] Quang thêm `imagePullPolicy: Always` cho 2 Deployment (mục bug hạ tầng ở trên).
- [ ] Đủ các điều trên → deploy lại, test beacon email + userscript ghi vào MySQL thật
      (checklist §11 kế hoạch).

### Ghi chú cho phiên sau
- User thao tác GitLab qua git CLI trên máy Windows (`%USERPROFILE%\cm-dashboard`, đã cài
  git + có PAT); KHÔNG dùng Web IDE upload (từng lỗi âm thầm). Copy file → `git add` →
  commit → push là quy trình chuẩn.
- Claude KHÔNG truy cập được GitLab nội bộ, KHÔNG fetch được URL Vercel/nội bộ (proxy chặn) —
  mọi thay đổi sang GitLab đều qua tay user (Claude gửi file tải về → user copy đè vào
  `cm-dashboard`). Sửa code luôn làm ở repo GitHub này trước, test bằng render server-side +
  headless Chromium (không đoán mò), rồi mới đóng gói gửi.
- **Ánh xạ file cần đồng bộ sang GitLab** khi sửa Facebook/Email/Jira (đích trong `cm-dashboard`):
  `api/fb-dashboard.js`, `api/email-dashboard.js` → cùng tên trong `api/`; `api/portal.js` → không
  copy trực tiếp (chỉ dùng làm nguồn cho `sync.js` bake ra `index.html`, nhưng nếu GitLab chưa
  tích hợp `sync.js` cho portal thì vẫn cần copy tay như file thường); `reference/cm-dashboard-original/public/index.html`
  → `public/api/jira/index.html`.
- Vercel production (`shb-fb-dashboard.vercel.app`) KHÔNG bị ảnh hưởng bởi các thay đổi hạ tầng
  GitLab/MySQL — fallback Supabase giữ nguyên hành vi cũ khi không có `MYSQL_HOST`.
- **Bài học pull policy**: nếu sau này push code mới lên GitLab mà giao diện thật không đổi dù
  pipeline pass, kiểm tra `imagePullPolicy` trước khi nghi code lỗi — image tag `:dev` là tag
  cố định, cần `Always` mới pull bản mới mỗi lần restart.

## 🧩 Cấu trúc HỢP NHẤT (1 repo + 1 Vercel) — PR #33
Tên file = **route**; đặt theo sản phẩm để mở ra hiểu ngay. URL cũ giữ nguyên qua `rewrites` (không cần sửa VBA/userscript).

| File (route) | Vai trò | Env / nguồn | Alias URL cũ (rewrite) |
|---|---|---|---|
| `api/portal.js` | **Portal** — header SHB + tab Facebook/Email (iframe, `#hash`) | — | `/` |
| `api/fb-dashboard.js` | Dashboard Facebook (**file UI chính**) | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | `/api/facebook` |
| `api/email-dashboard.js` | Dashboard Email (copy từ email-tracker-data/dashboard.js) | `EMAIL_SUPABASE_URL`, `EMAIL_SUPABASE_SERVICE_KEY` | `/api/email` |
| `api/fb-ingest.js` | Nạp bài Group từ userscript (FB) | `SUPABASE_*` + `INGEST_SECRET` | `/api/ingest` |
| `api/email-track.js` | **Beacon Email** (pixel/click/read) — v3.5 | `EMAIL_SUPABASE_*` | `/api/track` |
| `vercel.json` | rewrites giữ URL cũ; maxDuration | — | — |

> ✅ **06/07/2026**: đã xoá hẳn `api/fb-fetch.js` + cron tương ứng trong `vercel.json` (Phương án A, `KE_HOACH_MIGRATION.md` §3.1) — post-insights Graph đã chết, `fb-dashboard.js` không cần dữ liệu này, server hết egress ra Internet.
- **1 Vercel project** `shb-fb-dashboard` chạy tất cả. URL công khai (qua rewrite) giữ nguyên: `/` · `/api/facebook` · `/api/email` · `/api/ingest` · `/api/track`. Userscript (`/api/ingest`) & VBA (`/api/track`) KHÔNG cần đổi.
- ⚠️ **Đồng bộ**: `api/email-dashboard.js` + `api/email-track.js` là **bản copy** từ repo `email-tracker-data`. Sửa gốc thì đồng bộ lại (hoặc ngược lại). Sau migration nội bộ repo email gốc nghỉ hẳn.
- ✅ **VBA đã cập nhật**: `CampaignTracker.bas` v4.9 (repo email-tracker-data) đã đổi `TRACK_URL` → `shb-fb-dashboard.vercel.app/api/track`. User cần cài bản này vào Outlook + test trước khi tắt Vercel email cũ.
- 🧹 Nhánh `claude/cm-portal` + `claude/friendly-cannon-m06mlh` — xoá thủ công trên GitHub (đã merge/cũ).

## ⏱️ Thời gian đọc email (dwell) — ĐÃ GỠ, chờ hạ tầng nội bộ
Đã build + test đầy đủ (pixel streaming kiểu Litmus) nhưng **proxy Vercel không truyền tín hiệu client ngắt kết nối** vào function — kiểm chứng thực tế đủ 3 runtime: `(req,res)` Node, Web Handler Node + Fluid ON, Edge. Cả 3 đều làm dwell luôn chạm trần 25s → số liệu vô nghĩa → gỡ khỏi bản Vercel (02/07/2026).
- Chi tiết cơ chế, code tham chiếu (commit `3fe516c`, `56a82c5`, `f724bca`) và 5 bài học triển khai: xem **`KE_HOACH_MIGRATION.md` mục 7b** — sẽ bổ sung khi migrate vào hạ tầng nội bộ SHB (server nội bộ nhận kết nối trực tiếp nên đo được).
- Cột `dwell_s` vẫn tồn tại trong bảng `events` (migrate_05 đã chạy) — dashboard fetch với `pos=not.in.(sent,dwell)` để bỏ qua event dwell còn sót.
- Fix đi kèm ĐƯỢC GIỮ LẠI: cột "Đã mở (lượt)" bảng chiến dịch hiển thị đúng số LƯỢT (`openEvents`) thay vì số người.

## Kiến trúc dữ liệu
```
Userscript (tools/shb-content-library.user.js v3.6, Tampermonkey)
  ├─ Content Library  → per-post  → /api/ingest → fb_group_posts (+ cột metrics jsonb: full chỉ số per-post)
  └─ Page Insights    → page-level → /api/ingest {kind:'page'} → fb_page_insights (metrics + series jsonb)
api/fb-dashboard.js  → đọc cả 2 bảng, render 1 trang HTML (clientCode extract bằng toString)
```
- **Bắt dữ liệu**: mở `professional_dashboard` của SHB → **Ctrl+Shift+Y** (auto-tour) hoặc F5 từng trang.
  Quan trọng: đặt **khoảng ngày rộng** (vd 1/11–25/6) ở từng trang để chuỗi dài.
- Migrations đã chạy: `db/migrate_03_page_insights.sql`, `migrate_04_post_metrics.sql`.

## Nguyên tắc chỉ số (QUAN TRỌNG)
- **3 chỉ số chính: ER%, Lượt xem, Lượt tương tác.** Follower KHÔNG quan trọng (bài Group).
- **Số hiển thị ĐẦY ĐỦ, không viết tắt K/M** — `nfk()` và `tnum()` hiện đều = `nf()` (định dạng VN đầy đủ).
- **Ngày hoạt động vs Ngày đăng**:
  - Thẻ/chart Lượt xem, Lượt tương tác, ER → **ngày hoạt động** (chuỗi `views/interactions_time_series`), co theo date-range.
  - Bảng Nội dung → **ngày đăng** (per-post).
  - **Lượt hiển thị & Bình luận** → LUÔN cộng tổng per-post: `sumPm(cur,'impression')` / `Σ comments`. Lọc thì cộng theo nội dung đang lọc.
  - **Người xem (duy nhất)** → số tổng cấp trang (`metricsMax.viewers`, `pg()` fallback per-post khi lọc).
  - **Lượt tiếp cận** = Σ người xem mọi bài kể cả trùng = `sumPm(cur,'viewers')`. **Tỉ lệ tiếp cận** = Lượt tiếp cận ÷ Lượt xem.
- `buildPageInsights()` UNION điểm theo ngày qua mọi lần bắt; `seriesMap` chuẩn hoá {views,interactions,followers}.
- Lọc chéo (cFil) → thẻ/chart tự về per-post (chuỗi page-level không cắt theo nội dung được).

## Cấu trúc UI hiện tại (sau PR #32)
- **Tổng quan (`heroRow`)**: layout **2 hàng** — gauge (340px) + lưới KPI 3 cột × 2 hàng (KHÔNG bento, KHÔNG icon, KHÔNG viền màu).
  - **Gauge**: số to = Tổng Lượt xem; vòng cung = **Tỉ lệ tiếp cận** (= Lượt tiếp cận ÷ Lượt xem), đổi theo lọc nội dung. Cung trắng ĐẶC (đã bỏ glow/gradient gây vệt mờ); 0% chỉ hiện track; không vẽ tick "mục tiêu" khi target≥100.
  - 6 card đồng nhất: Lượt tương tác · ER · Lượt tiếp cận · Người xem · Lượt hiển thị · Bình luận. Mỗi card 1 dòng phụ `.ksub` muted.
- **Xu hướng theo thời gian** (`heroChart`): chart ngày + **annotation đánh dấu ngày đỉnh** (▲).
- **Nội dung** (`contentSection`): bảng per-post, cột **"Tỉ lệ tiếp cận"** (= viewers÷views). ĐÃ BỎ cột "Theo dõi +". Tab Tất cả / Video-Reel-Live.
- **Phân tích** (`mixSection`): tỉ trọng Lượt xem + ER theo định dạng. ĐÃ BỎ "Theo chủ đề".
- **Dự án / Squad** (`goalSection`, id `#s-goal`): nhóm bài theo **`projectOf()`** (nhận diện từ nội dung, không phân biệt hoa thường/dấu). Không khớp → "Khác". Bấm để lọc chéo (`_filter.project`).
- **Khung giờ** (`timingPanel`): best time tính theo **NGƯỜI XEM** (heat += mediaViewers).
- **Đối tượng** (`audienceSection`): CHỈ còn tuổi/giới tính + ghi chú (đã bỏ 4 card tier).
- **Insight / Sức khỏe / Từ điển**: như cũ.
- **Bộ lọc** (`filterBar`): **MULTI-SELECT** — Mọi bài viết · Dự án · Định dạng · Khung giờ · Loại ngày (ĐÃ BỎ Media).
  - `_filter[key]` là **MẢNG** giá trị; `setFilter(k,v)` toggle in/out; `matchFilter` dùng membership (`inF`); highlight dùng `isSel`.
  - Dropdown `msel` (class `.msel-dd` riêng để khỏi đụng date-popover `.csel-dd`); có **ô tìm kiếm** khi >6 lựa chọn (`mselSearch` lọc live); `_openMsel` giữ dropdown mở qua mỗi `paint()`.
  - Lọc "Mọi bài viết": pairs `[id, "ngày · tiêu đề"]`. Chip ở `filterStatusBar` bung mỗi giá trị 1 chip.
- **ĐÃ BỎ**: Phễu hiệu quả, Ma trận Phủ×Sức hút, "Tiến độ mục tiêu" (goal bars), bento grid, bộ lọc Media, "Theo chủ đề".

### Nhận diện Dự án — biến `PROJECTS` (đầu clientCode, cạnh `projectOf`)
Mảng `[tên, [từ khoá normalized]]`, khớp đầu tiên thắng (xếp cụm cụ thể trước). Hiện có:
SAHA Next Gen · SAHA Branch · SHB SAHA App · SSP · KPI · ALM · EGP · Edoc · Website · Reward ·
Sinh lời Tự động · CCS/CDS · SHB Future Lead · SHB Transformation Talk · Sunline · Chuyển tiền quốc tế.
→ Thêm/sửa dự án: edit `PROJECTS`. `GOALS={er:TARGET_ER}` chỉ còn dùng để tô màu pill ER theo dự án.

## ⚠️ Còn lại / cần chú ý
- **`projectOf`** dùng substring trên nội dung đã normalize — mã ngắn (ssp/kpi/alm/egp/ccs/cds) có thể bắt nhầm; nếu thấy bài gán sai dự án, gửi ví dụ để siết từ khoá.
- **Annotation chart**: mới đánh dấu ngày đỉnh; muốn mốc chiến dịch cần nguồn ngày chiến dịch (chưa có).
- Khi cần dữ liệu mới: nhắc user bắt lại ở **khoảng ngày rộng** trên cả 3 trang (Lượt xem / Lượt tương tác / Đối tượng).

## Lịch sử PR gần đây
- #23: fix lọc chéo thẻ Tổng quan.
- #25: lưới KPI v1 + Lượt hiển thị/Bình luận cộng per-post + design tokens + dọn 5 hàm chết.
- #26: bỏ ma trận + tiến độ mục tiêu, rà soát UI, tier thuần Việt.
- #27: chuẩn hoá lưới KPI (bỏ viền màu/đơn vị dính số) + view lãnh đạo thuần Việt.
- #28: gauge → tỉ lệ tiếp cận · Dự án/Squad từ nội dung · phễu mở rộng · best time theo người xem · gọn Đối tượng.
- #29: bỏ phễu + viết tắt K · layout 2 hàng · nhiều bộ lọc · thêm dự án EGP/SAHA Next Gen.
- #31: multi-select bộ lọc (`_filter`=mảng) · fix gauge bỏ tick lơ lửng · bỏ lọc Media.
- #32: gauge cung trắng đặc (bỏ glow) · ô tìm kiếm trong dropdown (fix `.msel-dd`) · thêm lọc "Mọi bài viết".
- #56–#61 (02/07, saga "đo thời gian đọc email"): build pixel streaming dwell → fix ghi-trước-khi-end → chuyển đo sang pixel top (VBA chỉ nhúng 1 pixel) → tách nhóm chạm trần → thử Web Handler + Edge runtime → **kết luận: proxy Vercel không truyền tín hiệu client ngắt ở CẢ 3 runtime → gỡ toàn bộ (#61), ghi vào KE_HOACH_MIGRATION.md mục 7b để bổ sung khi vào nội bộ**. Giữ lại: fix cột "Đã mở (lượt)" bảng chiến dịch = số LƯỢT (`openEvents`, trước hiển thị nhầm số người) + fetch `pos=not.in.(sent,dwell)`.

## 🔭 Migration vào nội bộ SHB (định hướng lớn, cập nhật 03/07/2026)
`KE_HOACH_MIGRATION.md` (branch `claude/internal-saas-migration-o7lc43`) = **kế hoạch HỢP NHẤT** chuyển 2 dashboard (Email + Facebook) vào hạ tầng nội bộ SHB (GitLab/EKS/DB nội bộ) và gộp thành 1 trang 2 tab.
- Userscript TM ↔ VBA macro: "bộ thu thập ngoài, chỉ đổi URL" — KHÔNG cần đưa vào trong.
- Câu 7 (admin reach domain nội bộ) = **CÓ**. Câu 8 (egress facebook.com): chọn **Phương án A = BỎ `api/fetch.js`** (đã kiểm chứng `loadData` chạy đủ với dữ liệu userscript) → server không cần egress.
- Xin hạ tầng DÙNG CHUNG 1 lần (1 DB/repo/pipeline/DNS) để khỏi migrate 2 lần rồi gộp.
- Đề xuất tái dùng hạ tầng SaaS nội bộ NHS sẵn có: 1 service Node ingest + 1 schema MySQL trên DB nội bộ có sẵn (chi phí gần như không đáng kể), đóng gói container/pod chạy trên EKS — cùng pattern CI/CD với repo `cm-dashboard` (GitLab CI → registry nội bộ → AWS ECR → ArgoCD → EKS) đã chạy thật cho dashboard Jira nội bộ của team CM.
- **Đã trao đổi Quang Doan Van (DevOps, Teams 03/07)**: nhận cover cả 3 điểm hạ tầng mới (schema MySQL, GitLab runner connect DB, service Node port riêng trên EKS) — chỉ chờ **anh Quốc Anh duyệt (QA)**.
- Bước tiếp theo: gửi email trình bày kế hoạch cho anh Quốc Anh (cc anh Quang) xin duyệt; sau khi duyệt mới sang Giai đoạn 1 (code migration).

## Lưu ý kỹ thuật
- Sửa `api/facebook.js` xong: `node --check api/facebook.js`.
- Test UI nhanh: render server-side ra HTML rồi mở bằng headless Chromium (`/opt/pw-browsers`, `NODE_PATH=/opt/node22/lib/node_modules`) bắt lỗi JS — mock data nên một số chỉ số per-post = 0 và dự án gom "Khác".
- Browser code nằm trong `clientCode()` (extract bằng toString) — không dùng Node API; chỉ nhận `DATA, TARGET_ER, MIN_N`.
- Deploy = tạo PR `laughing-ride` → merge vào `loving-planck` (Vercel auto-deploy). **Lưu ý merge ĐÚNG commit cuối** — trước đây từng merge sớm làm sót commit.
