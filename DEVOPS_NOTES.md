# Ghi chú hạ tầng — Merge Email + Facebook Dashboard vào `cm-dashboard`

> Tài liệu này tóm tắt phần hạ tầng thay đổi khi mở rộng `cm-dashboard` thêm 2 dashboard mới —
> không đi sâu logic nghiệp vụ dashboard, chỉ tập trung: cái gì mới, tại sao cần, ảnh hưởng gì
> tới pipeline/deploy hiện có.

## 1. Bối cảnh 1 câu

`cm-dashboard` (hiện chỉ có Jira dashboard) được mở rộng thêm 2 dashboard nữa (Email Tracker +
Facebook), gộp chung 1 portal 3 tab — dùng lại đúng pipeline/registry/ArgoCD pattern đang có,
**thêm đúng 1 thành phần hạ tầng mới**: 1 service Node chạy thường trực.

## 2. Trước / sau

| | Trước (chỉ Jira) | Sau (Jira + Email + Facebook) |
|---|---|---|
| Số dashboard | 1 (Jira) | 3 (Jira, Email, Facebook) — 1 portal, 3 tab |
| Nguồn dữ liệu | Jira REST API (đọc lúc build) | + MySQL nội bộ (đọc lúc build) |
| Số Docker image | 1 (`Dockerfile`) | 2 (`Dockerfile.dashboard` giữ vai trò như `Dockerfile` cũ, + `Dockerfile.ingest` **mới**) |
| Thành phần chạy thường trực | Không (chỉ nginx phục vụ file tĩnh) | **Thêm 1 Node service (:3001)** — lý do ở mục 3 |
| DB | Không cần (Jira đọc trực tiếp qua API) | Cần 1 schema MySQL mới (~ít, xem `db/schema.mysql.sql`) |

## 3. Vì sao cần thêm 1 service chạy thường trực (điểm khác biệt DUY NHẤT về kiến trúc)

Jira dashboard chỉ cần *đọc* dữ liệu theo lịch (cron `sync_data`) — không có gì ghi vào lúc
runtime nên hoàn toàn tĩnh.

Email + Facebook thì khác: có 2 nguồn liên tục *ghi* dữ liệu real-time vào hệ thống:
- **VBA macro Outlook** gửi beacon (pixel mở email/click) → cần 1 endpoint HTTP nhận GET liên tục.
- **Userscript Tampermonkey** (Facebook admin) POST dữ liệu bài Group → cần 1 endpoint HTTP nhận POST.

2 việc này **không thể làm bằng file tĩnh** — bắt buộc phải có 1 service luôn lắng nghe request.
Đó là lý do có `server/ingest-server.js`, đóng gói thành image `Dockerfile.ingest`, cần 1
Deployment riêng chạy thường trực trên EKS (khác `cm-dashboard` hiện tại chỉ cần Pod chạy nginx
tĩnh, có thể scale-to-zero hoặc restart tuỳ ý mà không mất gì).

**Khuyến nghị:** tách 1 ArgoCD Application riêng cho service này (đề xuất tên
`cm-dashboard-ingest`) thay vì gộp chung Deployment với `cm-dashboard` — để tránh việc restart
dashboard tĩnh theo lịch (mỗi ≤1h) làm rớt request đang gửi tới ingest service.

## 4. File mới cần biết (theo mức độ liên quan tới hạ tầng, giảm dần)

| File | Cần quan tâm gì |
|---|---|
| `.gitlab-ci.yml` | Thêm biến `DOCKER_IMAGE_INGEST_NAME`; thêm bước build+push ECR cho `Dockerfile.ingest`; thêm job `update_manifest_ingest_aws_dev` (deploy app `cm-dashboard-ingest`) |
| `Dockerfile.ingest` | Image mới, base `node:20-alpine-amd` (cùng registry nội bộ), expose port 3001, không cần `npm install` (chỉ dùng Node builtin) |
| `Dockerfile.dashboard` | Thay thế đúng vai trò `Dockerfile` cũ — base `node:20-nginx-amd`, KHÔNG chạy `sync.js` trong lúc build (khác `Dockerfile` cũ) vì cần giữ credential MySQL ngoài image, xem mục 6 |
| `nginx.conf` | Thêm 2 `location` mới: `/api/track`, `/api/ingest` → `proxy_pass http://ingest-service:3001/...` — **cần tên service DNS nội bộ thật** của Deployment ingest để sửa lại `ingest-service` cho đúng |
| `db/schema.mysql.sql` | DDL tạo bảng — chạy 1 lần trên schema MySQL mới cấp |
| `lib/db-client.js` | Không cần đọc kỹ — chỉ cần biết: code tự fallback an toàn nếu thiếu `MYSQL_HOST`, không có rủi ro crash pod nếu thiếu biến môi trường |

## 5. Biến môi trường (CI/CD Variables) cần thêm

Đã có sẵn (không đổi): `JIRA_DOMAIN`, `JIRA_EMAIL`, `JIRA_TOKEN`, `JIRA_PROJECT`,
`ARGO_ADMIN_USER`, `ARGO_ADMIN_PASS`.

**Cần thêm mới:**
```
MYSQL_HOST=
MYSQL_PORT=3306
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
INGEST_SECRET=       # tự sinh 1 chuỗi random dài, dùng để xác thực userscript -> ingest-server
```

## 6. Vì sao `Dockerfile.dashboard` KHÔNG chạy `sync.js` trong lúc build (khác `Dockerfile` gốc)

`Dockerfile` gốc của Jira dashboard chạy `node sync.js` ngay trong bước build Docker, nhận
`JIRA_TOKEN` qua `ARG` — nghĩa là token đó bị ghi vào layer/history của image.

Với `MYSQL_PASSWORD` (nhạy cảm hơn), cách này không nên lặp lại. Thay vào đó, `sync.js` chạy
trong 1 CI stage riêng (`sync_data`, đã có sẵn) *trước* bước build Docker, ghi kết quả ra
`public/`, rồi `Dockerfile.dashboard` chỉ `COPY public/` vào — image cuối cùng không chứa bất
kỳ secret DB nào.

→ Điểm cần góp ý: cách này có ổn theo chuẩn bảo mật nội bộ đang áp dụng không, hay có pattern
khác đang dùng cho các service tương tự cần theo cho nhất quán?

## 7. Việc CI/CD Pipeline đã tự test được (trên nhánh `merge-email-facebook`, MR đang mở)

- ✅ Stage `sync_data`: chạy được cả phần Jira (668 issues) lẫn phần Email/Facebook (bake HTML,
  tự fallback vì chưa có `MYSQL_HOST`) — **PASS**.
- ✅ Stage `pages`, `aws-authen-cicd` — **PASS**.
- ⬜ Stage `docker_build_ecr`, `update_helm_value*` — chỉ chạy trên `main` (rule `only: main`),
  nên **chưa test được** cho tới khi merge.

## 8. Tóm tắt việc cần xác nhận/quyết định trước khi merge

1. Thông tin kết nối MySQL (`MYSQL_HOST/PORT/USER/PASSWORD/DATABASE`) — điền vào CI/CD Variables.
2. Chạy (hoặc cấp quyền chạy) `db/schema.mysql.sql` trên DB đó 1 lần.
3. Xác nhận cách tách ArgoCD App `cm-dashboard-ingest` ở mục 3 có đúng chuẩn không, và tên
   service DNS nội bộ thật để sửa `nginx.conf` (mục 4).
4. Góp ý cách né bake secret vào Docker image ở mục 6 (có cần đổi gì không).
