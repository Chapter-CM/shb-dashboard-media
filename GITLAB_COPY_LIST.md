# Danh sách file cần copy sang `cm-dashboard` (nhánh `main`)

> **Cập nhật 06/10/2026** — đợt mới nhất nằm ngay dưới. Chi tiết xem `HANDOFF.md` (mục 06/10/2026).

## Đợt 06/10 — Dự án/Squad Facebook, Group mail Email

| # | Nguồn (repo này) | Đích (`cm-dashboard`) | Lý do |
|---|---|---|---|
| 1 | `api/fb-dashboard.js` | `api/fb-dashboard.js` | Phân loại dự án theo hashtag + tên, bảng nhiều cột, sort 2 chiều, phân trang, tooltip caption |
| 2 | `api/email-dashboard.js` | `api/email-dashboard.js` | Tab Group mail, gộp Squad Transformation Talk, đổi vị trí bảng Squad/Dự án |
| 3 | `lib/db-client.js` | `lib/db-client.js` | Tự nâng `fb_group_posts.title` lên MEDIUMTEXT (đã deploy) |
| 4 | `db/schema.mysql.sql`, `db/migrate_07_group_title_text.sql` | `db/...` | Schema mới / dự phòng |
| 5 | *(file riêng, KHÔNG có trong GitHub)* `group_mail_members.csv` | `data/group_mail_members.csv` | Danh sách thành viên group mail (xuất bằng macro `tools/ExportGroupMembers.bas`) — đã upload |

`tools/*` (macro Outlook, scraper, bookmarklet) chạy trên máy/trình duyệt, KHÔNG deploy lên GitLab.
Sau khi copy: chạy lại pipeline + job `sync_data`.

---


> Cập nhật 20/07/2026 — **1 file mới** cần đồng bộ (fix Lượt tương tác hụt số),
> nguồn nhánh `claude/luot-tuong-tac-sai-gym1kg`. Danh sách 14/07 giữ bên dưới
> nếu chưa đồng bộ đợt đó.

## Đợt 20/07 — fix "Lượt tương tác" hụt so với Facebook

| # | Nguồn (repo này) | Đích (`cm-dashboard`) | Lý do |
|---|---|---|---|
| 1 | `api/fb-dashboard.js` | `api/fb-dashboard.js` | Thẻ KPI Lượt tương tác hiện cảnh báo "⚠ thiếu N ngày" khi chuỗi interactions_time_series quét sót ngày (nguyên nhân số hụt 10.655 vs 49.159 Facebook) |

2 file `tools/shb-content-library.console.js` + `tools/shb-bookmarklet.txt`
cũng đổi đợt này nhưng chạy TRỰC TIẾP trên trình duyệt (dán Console/Bookmark),
KHÔNG deploy lên GitLab — chỉ cần dùng bản mới trong repo này khi quét.

Lệnh copy + push (Command Prompt):

```
copy /Y %USERPROFILE%\Downloads\gitlab-sync\fb-dashboard.js %USERPROFILE%\cm-dashboard\api\fb-dashboard.js
cd %USERPROFILE%\cm-dashboard
findstr /C:"engMiss" api\fb-dashboard.js
git add api/fb-dashboard.js
git commit -m "Them canh bao thieu ngay cho KPI Luot tuong tac (chuoi interactions quet sot ngay lam tong hut so voi Facebook)"
git push origin main
```

`findstr` phải ra kết quả (xác nhận copy thật). Push xong job `sync_data` tự
bake lại `public/index.html` — không cần copy HTML tay.

---

## Đợt 14/07 (cũ — bỏ qua nếu đã đồng bộ)

## 3 file cần copy (nguồn → đích trong `cm-dashboard`)

| # | Nguồn (repo này) | Đích (`cm-dashboard`) | Lý do |
|---|---|---|---|
| 1 | `.gitlab-ci.yml` | `.gitlab-ci.yml` | `dependencies: []` (xem mục dưới) — nếu đã copy 10/07 thì bỏ qua |
| 2 | `api/portal.js` | `api/portal.js` | Fix UI 14/07: giờ "Cập nhật" hiện UTC thay vì giờ VN (thiếu `timeZone`) + thêm listener `hashchange` để link `#email`/`#jira` và nút Back/Forward chuyển tab được |
| 3 | `api/email-dashboard.js` | `api/email-dashboard.js` | Fix UI 14/07: thông báo "Chưa có dữ liệu" hết trỏ nhầm sang Supabase/Vercel trên bản nội bộ (giờ ghi rõ cả 2 nguồn MySQL nội bộ / Vercel) |

Sau khi copy 2 file `api/*`: job `sync_data` trên GitLab sẽ tự bake lại
`public/index.html` + `public/api/email.html` — không cần copy HTML tay.
Verify nhanh sau copy: `findstr "Asia/Ho_Chi_Minh" api\portal.js` và
`findstr "hashchange" api\portal.js` phải ra kết quả.

## Vì sao cần copy lại

Commit `a08547b` (10/07) thêm `dependencies: []` vào job template
`.update_manifest_template` (dùng chung cho `update_manifest_aws_dev` **và**
`update_manifest_ingest_aws_dev`) — job restart ArgoCD chỉ cần gọi
`argocd app actions run ... restart`, không cần file `public/` nào, nên khai
báo rỗng để khỏi tự tải artifact của `sync_data` (mặc định GitLab tải hết job
trước đó, từng gây `403 Forbidden ... FATAL: permission denied` khi artifact
hết hạn/thiếu quyền — chính là lỗi job #626730 nêu trong HANDOFF.md mục tồn
đọng #1).

**Chưa xác nhận file này đã có mặt bên GitLab hay chưa** — nếu bạn đã copy
`.gitlab-ci.yml` mới nhất trong lần đồng bộ 10/07 chiều rồi thì bỏ qua, việc
này coi như đã xong.

## Lệnh copy (Command Prompt)

```
copy /Y %USERPROFILE%\Downloads\gitlab-sync\gitlab-ci.yml %USERPROFILE%\cm-dashboard\.gitlab-ci.yml
cd %USERPROFILE%\cm-dashboard
findstr /C:"dependencies: []" .gitlab-ci.yml
```
(Dùng `copy /Y` để tự ghi đè, không cần trả lời Y/N tay — rồi `findstr` xác
nhận nội dung đã đổi thật trước khi commit, tránh lặp lại lỗi "tưởng đã copy
nhưng thực ra không" đã ghi trong HANDOFF.md.)

## Commit + push

```
git add .gitlab-ci.yml
git commit -m "Them dependencies: [] cho job update_manifest, tranh 403 tai artifact thua"
git push origin main
```

Push xong kiểm tra Pipeline job `update_manifest_ingest_aws_dev` — phải PASS,
hết lỗi 403 tải artifact (job cũ lỗi là #626730).

---

## Đã đồng bộ xong (không cần copy lại)

Các file sau đã copy sang GitLab ở các lần trước (06/07–10/07), không có thay
đổi mới kể từ đó:
`api/email-track.js` · `api/fb-ingest.js` · `api/email-dashboard.js` ·
`api/fb-dashboard.js` · `api/leader-dashboard.js` · `lib/db-client.js` ·
`Dockerfile.ingest` · `reference/cm-dashboard-original/public/index.html`
(→ `public/api/jira/index.html`) · `sync.js` (vendor pin babel@7 + needs
sync_data trong `docker build ecr`).
