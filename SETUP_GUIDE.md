# SHB CM Dashboard — Hướng dẫn deploy GitLab (v3 — Jira Direct)

## Kiến trúc mới (đơn giản hơn rất nhiều)

```
Jira SHB / hadfreelancer.atlassian.net
    ↓
GitLab CI/CD (mỗi 30') — sync.js:
    gọi Jira REST API trực tiếp
    → buildEpicMap (2-pass) + detectLoai + normalizeHangMuc
    → xuất public/data.json
    ↓
GitLab Pages → index.html + data.json
    ↓
Nhân viên xem dashboard
```

**Bỏ hoàn toàn:** Power Automate, OneDrive, Azure App, Files.Read.All permission.

---

## BƯỚC 1: Tạo Jira API Token

1. Truy cập: **https://id.atlassian.com** → Sign in
2. **Security** → **API tokens** → **Create API token**
3. Label: `gitlab-cm-dashboard`
4. Copy token value (chỉ hiện 1 lần — lưu lại ngay!)

---

## BƯỚC 2: Tạo GitLab Repo

### Test trên gitlab.com cá nhân:
1. Vào https://gitlab.com → **New project** → **Create blank project**
2. Project name: `cm-dashboard`
3. Visibility: **Private** ← quan trọng (data nội bộ)
4. Untick "Initialize repository with a README"
5. **Create project**

> ⚠️ Lần đầu dùng GitLab.com CI, cần verify tài khoản (thêm thẻ hoặc SĐT)
> để dùng shared runner. Vào **Settings > Usage Quotas** để kiểm tra.

---

## BƯỚC 3: Push Code Lên GitLab

### Clone và push:
```bash
git clone https://gitlab.com/<your-username>/cm-dashboard.git
cd cm-dashboard

# Copy toàn bộ file từ gói này vào
cp -r /path/to/cm-dashboard-gitlab/* .

git add .
git commit -m "CM Dashboard v3 — Jira Direct"
git push origin main
```

---

## BƯỚC 4: Cấu Hình CI/CD Variables

GitLab repo → **Settings** → **CI/CD** → **Variables** → Add variable:

| Key | Value | Protected | Masked |
|---|---|---|---|
| `JIRA_DOMAIN` | `hadfreelancer.atlassian.net` (test) | ✅ | ❌ |
| `JIRA_EMAIL` | email đăng nhập Atlassian của bạn | ✅ | ❌ |
| `JIRA_TOKEN` | token vừa tạo ở Bước 1 | ✅ | ✅ |
| `JIRA_PROJECT` | `CM` hoặc `CMTEST` (tùy project test) | ✅ | ❌ |

> Khi chuyển sang SHB production: đổi `JIRA_DOMAIN` → `shbbank.atlassian.net`
> và `JIRA_PROJECT` → `CCM` (hoặc key project SHB thật)

---

## BƯỚC 5: Bật GitLab Pages

GitLab Pages tự động bật khi pipeline có job tên `pages` với artifact path `public/`.
Không cần cấu hình thêm trên gitlab.com.

URL sau khi deploy: `https://<username>.gitlab.io/cm-dashboard/`

---

## BƯỚC 6: Chạy Pipeline Đầu Tiên

1. GitLab repo → **Build** → **Pipelines** → **Run pipeline**
2. Branch: `main` → **Run pipeline**
3. Theo dõi logs:
   - `sync_data` job: phải thấy `[Done] public/data.json — X issues`
   - `pages` job: phải thấy `Deploying GitLab Pages`
4. Sau khi pipeline xanh → truy cập URL GitLab Pages

---

## BƯỚC 7: Tạo Scheduled Pipeline (Tự Động 30 Phút)

GitLab repo → **Build** → **Pipeline schedules** → **New schedule**:

| Field | Value |
|---|---|
| Description | `Sync Jira → data.json` |
| Interval Pattern | `*/30 * * * *` |
| Timezone | `Asia/Ho_Chi_Minh` |
| Target Branch | `main` |
| Active | ✅ |

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `HTTP 401` | Sai JIRA_EMAIL hoặc JIRA_TOKEN | Tạo lại token, kiểm tra email |
| `HTTP 403` | Token không có quyền đọc project | Kiểm tra project visibility trong Jira |
| `HTTP 404` | JIRA_DOMAIN hoặc JIRA_PROJECT sai | Kiểm tra chính xác giá trị |
| `0 issues` | JIRA_PROJECT sai hoặc project rỗng | Kiểm tra key project trong Jira |
| `No runner` | gitlab.com cần verify tài khoản | Vào Settings > Usage Quotas |
| Pages 404 | Pages chưa deploy | Chờ pipeline xanh xong |
| Dashboard trống | data.json rỗng | Kiểm tra log sync_data job |
| `Loai = Khac` toàn bộ | Tên Epic không bắt đầu bằng "Squad"/"Dự án"/"Văn hóa" | Kiểm tra tên Epic trên Jira |

---

## Khi Chuyển Sang GitLab Nội Bộ SHB

Cần xác nhận với IT:
1. **Runner** khả dụng (shared runner hoặc group runner)
2. **GitLab Pages** bật ở cấp instance
3. **Runner có outbound** tới `shbbank.atlassian.net` + `registry.npmjs.org`

Nếu runner không có internet → chỉ cần cài `node_modules` vào repo (commit vendor) hoặc dùng npm proxy nội bộ. Không cần Azure, không cần admin consent.

---

## Files trong Repo

```
cm-dashboard/
├── .gitlab-ci.yml        ← CI/CD pipeline (sync + pages)
├── sync.js               ← Gọi Jira → transform → data.json
├── package.json          ← node-fetch dependency
├── public/
│   ├── index.html        ← Dashboard (đã sửa sẵn 8 chỗ)
│   ├── config.json       ← Config dashboard
│   └── data.json         ← Placeholder (CI ghi đè)
├── EXCEL_SCHEMA.js       ← Tham khảo (không dùng nữa)
├── INDEX_PATCH.js        ← Tham khảo (đã áp sẵn)
└── SETUP_GUIDE.md        ← File này
```
