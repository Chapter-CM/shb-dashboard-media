# Danh sách file cần copy sang `cm-dashboard` (nhánh `merge-email-facebook`)

> Cập nhật 06/07/2026 tối — sau đợt tổng rà soát code. Toàn bộ file nguồn nằm trong
> repo GitHub `shb-dashboard-media` (branch `claude/dashboard-log-repo-strategy-v2t8f1`).
> Copy xong hết thì commit 1 lần rồi push.

## 9 file cần copy (nguồn → đích trong `cm-dashboard`)

| # | Nguồn (repo này) | Đích (`cm-dashboard`) |
|---|---|---|
| 1 | `api/email-track.js` | `api/email-track.js` |
| 2 | `api/fb-ingest.js` | `api/fb-ingest.js` |
| 3 | `api/email-dashboard.js` | `api/email-dashboard.js` |
| 4 | `api/fb-dashboard.js` | `api/fb-dashboard.js` |
| 5 | `api/leader-dashboard.js` | `api/leader-dashboard.js` |
| 6 | `lib/db-client.js` | `lib/db-client.js` |
| 7 | `Dockerfile.ingest` | `Dockerfile.ingest` |
| 8 | `.gitlab-ci.yml` | `.gitlab-ci.yml` |
| 9 | `reference/cm-dashboard-original/public/index.html` | `public/api/jira/index.html` |

## Lệnh copy (Command Prompt, sau khi giải nén gói zip vào `Downloads\gitlab-sync`)

```
copy %USERPROFILE%\Downloads\gitlab-sync\email-track.js %USERPROFILE%\cm-dashboard\api\email-track.js
copy %USERPROFILE%\Downloads\gitlab-sync\fb-ingest.js %USERPROFILE%\cm-dashboard\api\fb-ingest.js
copy %USERPROFILE%\Downloads\gitlab-sync\email-dashboard.js %USERPROFILE%\cm-dashboard\api\email-dashboard.js
copy %USERPROFILE%\Downloads\gitlab-sync\fb-dashboard.js %USERPROFILE%\cm-dashboard\api\fb-dashboard.js
copy %USERPROFILE%\Downloads\gitlab-sync\leader-dashboard.js %USERPROFILE%\cm-dashboard\api\leader-dashboard.js
copy %USERPROFILE%\Downloads\gitlab-sync\db-client.js %USERPROFILE%\cm-dashboard\lib\db-client.js
copy %USERPROFILE%\Downloads\gitlab-sync\Dockerfile.ingest %USERPROFILE%\cm-dashboard\Dockerfile.ingest
copy %USERPROFILE%\Downloads\gitlab-sync\gitlab-ci.yml %USERPROFILE%\cm-dashboard\.gitlab-ci.yml
copy %USERPROFILE%\Downloads\gitlab-sync\jira-index.html %USERPROFILE%\cm-dashboard\public\api\jira\index.html
```
(Gõ `Y` mỗi lần hỏi ghi đè. Lưu ý file 8 đích có dấu chấm đầu: `.gitlab-ci.yml`;
file 9 đổi tên từ `jira-index.html` thành `index.html` ở đích.)

## Commit + push

```
cd %USERPROFILE%\cm-dashboard
git add -A
git commit -m "Fix duong ghi MySQL cho ingest, guard fallback, needs sync_data, pin babel7, jira embed"
git push origin merge-email-facebook
```

Push xong kiểm tra Pipeline trên MR `!3` — phải PASS như các lần trước.
