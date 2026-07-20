@echo off
setlocal
chcp 65001 >nul

REM ============================================================
REM Day 2 file ingest-bridge len GitLab (chay tren may cong ty).
REM SUA 2 DONG DUOI cho dung may roi double-click hoac chay trong CMD.
REM ============================================================
set REPO=C:\Users\dungha4\cm-dashboard
set DL=%USERPROFILE%\Downloads

if not exist "%REPO%\.git" (
  echo [LOI] Khong thay repo git o "%REPO%" — sua dong "set REPO=" trong file nay
  echo        thanh duong dan thu muc cm-dashboard da clone tu GitLab.
  pause & exit /b 1
)
if not exist "%DL%\nginx.conf" echo [LOI] Thieu "%DL%\nginx.conf" — tai file tu chat ve Downloads truoc. & pause & exit /b 1
if not exist "%DL%\ingest-server.js" echo [LOI] Thieu "%DL%\ingest-server.js" — tai file tu chat ve Downloads truoc. & pause & exit /b 1

cd /d "%REPO%" || (pause & exit /b 1)

echo === 1. Cap nhat main...
git checkout main || (pause & exit /b 1)
git pull origin main || (pause & exit /b 1)

echo === 2. Tao nhanh feat/ingest-bridge...
git checkout -B feat/ingest-bridge || (pause & exit /b 1)

echo === 3. Copy de 2 file...
copy /Y "%DL%\nginx.conf" nginx.conf >nul || (pause & exit /b 1)
copy /Y "%DL%\ingest-server.js" server\ingest-server.js >nul || (pause & exit /b 1)

echo === 4. Kiem tra noi dung moi da vao (phai thay 'ingest-bridge' o CA 2 file):
powershell -Command "Select-String -Path nginx.conf,server\ingest-server.js -Pattern 'ingest-bridge' -Encoding utf8 | Select-Object Path,LineNumber"

echo === 5. Commit + push...
git add nginx.conf server/ingest-server.js || (pause & exit /b 1)
git commit -m "Them /ingest-bridge: cau noi postMessage cho userscript Facebook (CSP facebook.com chan fetch truc tiep)" || (pause & exit /b 1)
git push -u origin feat/ingest-bridge || (pause & exit /b 1)

echo.
echo === XONG. Mo link "create a merge request" ma GitLab vua in o tren,
echo === tao MR feat/ingest-bridge -^> main, merge, doi pipeline xanh het.
echo === Test sau deploy: mo https://cm-dashboard.dev-saha.aws.shb.com.vn/ingest-bridge
pause
