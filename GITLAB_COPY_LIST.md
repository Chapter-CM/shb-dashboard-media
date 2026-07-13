# Danh sách file cần copy sang `cm-dashboard` (nhánh `main`)

> Cập nhật 13/07/2026 — chỉ còn **1 file** cần đồng bộ (các lần trước đã copy xong).
> Nguồn nằm trong repo GitHub `shb-dashboard-media`, nhánh `claude/loving-planck-y6lw57`.

## 1 file cần copy (nguồn → đích trong `cm-dashboard`)

| # | Nguồn (repo này) | Đích (`cm-dashboard`) |
|---|---|---|
| 1 | `.gitlab-ci.yml` | `.gitlab-ci.yml` |

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
