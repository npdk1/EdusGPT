@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title EdusGPT - one click launcher

rem ============================================================
rem  EdusGPT - chay 1 cham de mo web tren localhost:3000
rem  - tu cai npm install neu thieu
rem  - tao .env tu .env.example neu chua co
rem  - giai phong cong 3000 neu bi chiem
rem  - tu mo trinh duyet
rem ============================================================

cd /d "%~dp0"

echo.
echo  ======================================================
echo    EdusGPT  ^|  GSAP + Three.js + Gemini
echo  ======================================================
echo.

rem --- 1. Node.js -------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo  [LOI] Khong tim thay Node.js.
  echo         Cai Node.js 22 tro len tai https://nodejs.org
  echo         roi mo lai run.bat.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODEMAJOR=%%v
for /f "tokens=*" %%v in ('node -p "process.versions.node"') do set NODEV=%%v
echo  [OK] Node.js !NODEV!

if !NODEMAJOR! LSS 22 (
  echo  [LOI] Node.js phai tu 22 tro len. Ban dang co !NODEV!
  echo.
  pause
  exit /b 1
)

rem --- 2. npm -----------------------------------------------------------
where npm >nul 2>&1
if errorlevel 1 (
  echo  [LOI] Khong tim thay npm.
  echo         Cai lai Node.js ^(bao gom npm^).
  echo.
  pause
  exit /b 1
)
echo  [OK] npm san co
echo.

rem --- 3. Dependencies ---------------------------------------------------
if not exist "node_modules" (
  echo  [..] Chua co node_modules - dang cai dat. Vui long doi.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [LOI] npm install that bai.
    echo         Thu chay lai voi mang tot hon, hoac xoa file package-lock.json.
    echo.
    pause
    exit /b 1
  )
  echo.
) else (
  echo  [OK] node_modules da co
  echo.
)

rem --- 4. File .env --------------------------------------------------------
if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo  [OK] Da tao .env tu .env.example
  ) else (
    echo  [..] Khong tim thay .env.example - bo qua buoc nay
  )
  echo.
)

rem --- 5. Giai phong cong 3000 ------------------------------------------
rem  Chi lay 1 PID duy nhat: may in ca IPv4 va IPv6 cho cung mot process,
rem  nen phai loc de tranh taskkill chay trung.
set "BUSY_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"TCP .*:3000 .*LISTENING"') do (
  if not defined BUSY_PID set "BUSY_PID=%%p"
)
if defined BUSY_PID (
  echo  [..] Cong 3000 dang bi chiem ^(PID %BUSY_PID%^) - dang dong lai...
  taskkill /F /PID %BUSY_PID% >nul 2>&1
  rem  ping thay cho `timeout`: `timeout` loi khi chay khong co console that
  ping -n 2 127.0.0.1 >nul
)
echo.

rem --- 6. Mo trinh duyet -------------------------------------------------
rem  Cho server 2-3 giay de len truoc khi mo tab, neu khong tab chi
rem  hien trang thoi trong (van chay binh thuong).
ping -n 2 127.0.0.1 >nul
start "" http://localhost:3000

rem --- 7. Dev server -----------------------------------------------------
echo  [OK] Dang khoi dong server...
echo.
echo  ------------------------------------------------------
echo   Web     : http://localhost:3000
echo   Cai key : http://localhost:3000/setup
echo   Bai AI  : http://localhost:3000/studio
echo   Tua hai chieu: http://localhost:3000/lesson
echo.
echo   Bam Ctrl+C de dung
echo  ------------------------------------------------------
echo.

call npm run dev

echo.
echo  Server da dung.
echo.
pause
