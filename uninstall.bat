@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title EdusGPT - uninstall

rem ============================================================
rem  EdusGPT - goi y cai lai tu dau, con lai source thoi
rem
rem  XOA HET thu duoc tai ve:
rem    - node_modules\        npm packages
rem    - .next\               ban build
rem    - .runtime\            Node portable, Python cai rieng, venv
rem                           (piper-tts + vieneu), ffmpeg, downloads
rem    - data\voices\         mo hinh giong tren may (~60 MB)
rem    - data\tts-cache\      giong da doc, tu sinh lai
rem    - data\courses\*.json  bai gia da sinh
rem    - data/library-text\   chi muc thu vien
rem    - data\*.json          trang thai (tts-settings, model-trust,
rem                           token-limits, course-library)
rem    - .env                 -> luu lai thanh .env.bak truoc
rem
rem  GIU LAI: source, .git, public\logo.png, src\app\icon.png,
rem           data\ai-settings.json (provider + model ban chon)
rem
rem  Sau do: chay run.bat 1 click de cai lai tu dau.
rem  VieNeu-TTS (nang vai tram MB): cai lai tren web tai
rem  http://localhost:3000/setup, muc "Giong doc".
rem ============================================================

cd /d "%~dp0"

echo.
echo  ======================================================
echo    EdusGPT  ^|  Goi y cai lai
echo  ======================================================
echo.
echo  Se XOA ~2 GB:
echo    - node_modules\        (tai lai: run.bat)
echo    - .next\               (build lai)
echo    - .runtime\            Node portable, Python, venv ^&
echo                            piper-tts / vieneu, ffmpeg)
echo    - data\voices\         mo hinh giong tren may
echo    - data\tts-cache\      giong da doc
echo    - data\courses\*.json  BAI GIANG DA SINH
echo    - data\*.json          trang thai, chi muc thu vien
echo    - .env                 (luu lai thanh .env.bak)
echo.
echo  Se GIU:
echo    - source + .git, logo, data\ai-settings.json
echo.

set /p CONFIRM="  Chac chan xoa? Go Y de tiep tuc: "
if /i not "%CONFIRM%"=="Y" (
  echo.
  echo  Da huy, khong xoa gi ca.
  echo.
  pause
  exit /b 0
)
echo.

rem --- 1. dung dev server dang giu file --------------------------------------
rem  Khong dung taskkill /IM node.exe: nguoi dung dang mo Next.js o cua so
rem  khac, va giong tren may doc file trong .runtime\venv nen phai dung het
rem  moi xoa duoc. Chi dung PID o cong 3000.
set "BUSY_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"TCP .*:3000 .*LISTENING"') do (
  if not defined BUSY_PID set "BUSY_PID=%%p"
)
if defined BUSY_PID (
  echo  [1/6] Dang dung server cong 3000 ^(PID %BUSY_PID%^)...
  taskkill /F /PID %BUSY_PID% >nul 2>&1
  ping -n 3 127.0.0.1 >nul
) else (
  echo  [1/6] Cong 3000 trong
)

rem --- 2. luu .env ----------------------------------------------------------
rem  Key API la thu cong phai nhin, mat di thi phai vao vendor lay lai.
rem  Giu lai mot ban de doi ten nguoc lai duoc.
if exist ".env" (
  copy /y ".env" ".env.bak" >nul 2>&1
  del /q ".env" 2>nul
  if exist ".env" (
    echo       [!!] .env chua xoa duoc - kiem tra no co bi khoa khong
  ) else (
    echo       [OK] Da luu .env thanh .env.bak va xoa .env ^(doi ten nguoc lai de dung^)
  )
) else (
  echo  [2/6] Khong co .env
)

rem --- 3. xoa cac thu muc lon ----------------------------------------------
echo  [3/6] Dang xoa thu muc da cai...
if exist "node_modules" (
  rmdir /s /q "node_modules" 2>nul
  if exist "node_modules" echo       [!!] node_modules con lai - may bao ve tep, xoa lai tay
)
if exist ".next" rmdir /s /q ".next" 2>nul
if exist ".runtime" (
  rem  Python vua cai rieng cho project nen phai doi chieu trong file cua no
  rem  truoc, neu khong Windows giu lai con tro trong AppData\Local\Temp.
  if exist ".runtime\python\python.exe" (
    ".runtime\python\python.exe" -c "import shutil,os,nt;nt._exit(0)" >nul 2>&1
  )
  rmdir /s /q ".runtime" 2>nul
  if exist ".runtime" echo       [!!] .runtime con lai - may bao ve tep, xoa lai tay
)
if exist "data\voices" rmdir /s /q "data\voices" 2>nul
if exist "data\tts-cache" rmdir /s /q "data\tts-cache" 2>nul
if exist "data\library-text" rmdir /s /q "data\library-text" 2>nul
if exist "tsconfig.tsbuildinfo" del /q "tsconfig.tsbuildinfo" 2>nul
echo       [OK] Xoa xong cac thu muc

rem --- 4. xoa bai giang va trang thai ---------------------------------------
echo  [4/6] Dang xoa bai giang va trang thai...
if exist "data\courses" del /q "data\courses\*.json" 2>nul
for %%f in (course-library.json model-trust.json token-limits.json tts-settings.json) do (
  if exist "data\%%f" del /q "data\%%f" 2>nul
)
echo       [OK] Xoa xong

rem --- 5. bao cao dung luong -------------------------------------------------
echo  [5/6] Kiem tra lai...
set "LEFT=0"
for %%d in (node_modules .next .runtime data\voices data\tts-cache) do (
  if exist "%%d" (
    set /a LEFT+=1
    echo       [!!] con %%d
  )
)
if "%LEFT%"=="0" echo       [OK] Khong con thu muc cai nao
dir /b "data\courses\*.json" >nul 2>&1
if not errorlevel 1 echo       [!!] con bai gia trong data\courses

rem --- 6. ket thuc -----------------------------------------------------------
echo  [6/6] Xong.
echo.
echo  ------------------------------------------------------
echo   Con lai source thoi. Chay run.bat de cai lai 1 click.
echo.
echo   Giong doc nang (VieNeu-TTS, vai tram MB): cai lai tren web
echo   tai http://localhost:3000/setup - muc "Giong doc".
echo.
echo   Key API: .env.bak, doi ten thanh .env
echo  ------------------------------------------------------
echo.
pause
exit /b 0