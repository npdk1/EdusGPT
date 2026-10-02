@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title EdusGPT - clean all

rem ============================================================
rem  EdusGPT - don sach de ve trang thai tai ve lan dau
rem  - xoa node_modules, .next, tsconfig.tsbuildinfo
rem  - xoa giong doc da tao (data\tts-cache)
rem  - xoa bai giang da sinh (data\courses\*.json)
rem  GIU LAI: .env, data\ai-settings.json (key cua ban),
rem           public\logo.png, src\app\icon.png
rem  Chay lai run.bat de cai lai tu dau.
rem ============================================================

cd /d "%~dp0"

echo.
echo  ======================================================
echo    EdusGPT  ^|  Don sach project
echo  ======================================================
echo.
echo  Se XOA:
echo    - node_modules\          (tai lai khi chay run.bat)
echo    - .next\                 (build lai khi chay)
echo    - tsconfig.tsbuildinfo
echo    - data\tts-cache\*       (giong doc - tu tao lai, mien phi)
echo    - data\courses\*.json    (BAI GIANG DA SINH - mat han)
echo.
echo  Se GIU:
echo    - .env, data\ai-settings.json (API key)
echo    - public\logo.png, src\app\icon.png (logo cua ban)
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

rem --- 1. Dung dev server dang giu file (neu co) ---------------------------
set "BUSY_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"TCP .*:3000 .*LISTENING"') do (
  if not defined BUSY_PID set "BUSY_PID=%%p"
)
if defined BUSY_PID (
  echo  [..] Dang dung server cong 3000 ^(PID %BUSY_PID%^)...
  taskkill /F /PID %BUSY_PID% >nul 2>&1
  ping -n 3 127.0.0.1 >nul
)

rem --- 2. Xoa ---------------------------------------------------------------
if exist "node_modules" (
  echo  [..] Dang xoa node_modules...
  rmdir /s /q "node_modules"
  echo  [OK] Da xoa node_modules
) else (
  echo  [--] Khong co node_modules
)

if exist ".next" (
  rmdir /s /q ".next"
  echo  [OK] Da xoa .next
) else (
  echo  [--] Khong co .next
)

if exist "tsconfig.tsbuildinfo" (
  del /q "tsconfig.tsbuildinfo"
  echo  [OK] Da xoa tsconfig.tsbuildinfo
)

if exist "data\tts-cache" (
  del /q "data\tts-cache\*.*" 2>nul
  for /d %%d in ("data\tts-cache\*") do rmdir /s /q "%%d" 2>nul
  echo  [OK] Da xoa data\tts-cache
) else (
  mkdir "data\tts-cache" >nul 2>&1
)

if exist "data\courses" (
  del /q "data\courses\*.json" 2>nul
  echo  [OK] Da xoa bai giang trong data\courses
) else (
  mkdir "data\courses" >nul 2>&1
)

echo.
echo  ------------------------------------------------------
echo   Xong. Mo run.bat de cai lai va chay nhu moi.
echo  ------------------------------------------------------
echo.
pause
