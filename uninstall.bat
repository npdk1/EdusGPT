@echo off
setlocal enabledelayedexpansion
title EdusGPT - Trinh Don Dep va Go Cai Dat

cd /d "%~dp0"

rem ------------------------------------------------------------
rem  Thiet lap mau sac ANSI (Tuong thich moi may Windows 10/11)
rem ------------------------------------------------------------
reg add "HKCU\Console" /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>&1
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"

set "C_RESET=!ESC![0m"
set "C_BOLD=!ESC![1m"
set "C_DIM=!ESC![2m"
set "C_RED=!ESC![91m"
set "C_GREEN=!ESC![92m"
set "C_YELLOW=!ESC![93m"
set "C_BLUE=!ESC![94m"
set "C_CYAN=!ESC![96m"
set "C_WHITE=!ESC![97m"
set "C_GRAY=!ESC![90m"

rem ------------------------------------------------------------
rem  Kiem tra tham so dong lenh (Cho phep chay tu dong)
rem ------------------------------------------------------------
set "AUTO_YES=0"
if /i "%~2"=="-y" set "AUTO_YES=1"
if /i "%~2"=="--yes" set "AUTO_YES=1"
if /i "%~2"=="/y" set "AUTO_YES=1"
if /i "%~1"=="-y" (set "AUTO_YES=1" & set "CLI_ACT=2") else (set "CLI_ACT=%~1")

if "%CLI_ACT%"=="1" goto CLEAN_CACHE
if "%CLI_ACT%"=="2" (
  if "!AUTO_YES!"=="1" goto DO_UNINSTALL_KEEP_COURSES
  goto UNINSTALL_KEEP_COURSES
)
if "%CLI_ACT%"=="3" (
  if "!AUTO_YES!"=="1" goto DO_UNINSTALL_ALL_WIPE
  goto UNINSTALL_ALL_WIPE
)
if "%CLI_ACT%"=="4" (
  if "!AUTO_YES!"=="1" goto DO_WIPE_COURSES_ONLY
  goto WIPE_COURSES_ONLY
)

:MENU
cls
echo.
echo  !C_CYAN!======================================================!C_RESET!
echo    !C_BOLD!!C_WHITE!EdusGPT!C_RESET!  !C_GRAY!^|!C_RESET!  !C_CYAN!Trinh Don Dep va Go Cai Dat!C_RESET!
echo  !C_CYAN!======================================================!C_RESET!
echo.
echo  !C_WHITE!Vui long chon thao tac ban muon thuc hien:!C_RESET!
echo.
echo    !C_CYAN![1]!C_RESET! !C_BOLD!!C_WHITE!Don dep nhanh cache ^& file tam!C_RESET! !C_GREEN!(Khuyen dung)!C_RESET!
echo        !C_GRAY!- Xoa cache .next, cache giong tts-cache, log rac va file tam.!C_RESET!
echo        !C_GRAY!- GIU NGUYEN: Bai giang (data\courses\), Key API (.env), node_modules.!C_RESET!
echo.
echo    !C_YELLOW![2]!C_RESET! !C_BOLD!!C_WHITE!Go cai dat he thong!C_RESET! !C_YELLOW!(GIU LAI BAI GIANG)!C_RESET!
echo        !C_GRAY!- Xoa node_modules, .runtime, .next, cache am thanh va log rac.!C_RESET!
echo        !C_GRAY!- GIU NGUYEN: Bai giang (data\courses\), Key API (.env), source code.!C_RESET!
echo        !C_GRAY!- Sau do co the chay run.bat de cai dat lai 1-click.!C_RESET!
echo.
echo    !C_RED![3]!C_RESET! !C_BOLD!!C_WHITE!Go cai dat TOAN BO + XOA SACH DATA BAI GIANG!C_RESET! !C_RED!(CANH BAO)!C_RESET!
echo        !C_GRAY!- Xoa node_modules, .runtime, .next, cache am thanh.!C_RESET!
echo        !C_GRAY!- XOA TOAN BO bai giang da tao trong data\courses\ va chi muc.!C_RESET!
echo        !C_GRAY!- GIU NGUYEN: Source code goc, Key API (.env).!C_RESET!
echo.
echo    !C_CYAN![4]!C_RESET! !C_BOLD!!C_WHITE!Chi xoa toan bo data bai giang!C_RESET! !C_GRAY!(Reset thu vien)!C_RESET!
echo        !C_GRAY!- Xoa sach tat ca bai giang trong data\courses\ va tts-cache.!C_RESET!
echo        !C_GRAY!- GIU NGUYEN: node_modules, .runtime, .next, .env, source code.!C_RESET!
echo.
echo    !C_GRAY![5] Thoat (Khong lam gi ca)!C_RESET!
echo.
echo  !C_CYAN!======================================================!C_RESET!
set "CHOICE="
set /p "CHOICE=  Nhap lua chon cua ban (1, 2, 3, 4 hoac 5): "
if defined CHOICE set "CHOICE=!CHOICE: =!"

if "!CHOICE!"=="1" goto CLEAN_CACHE
if "!CHOICE!"=="2" goto UNINSTALL_KEEP_COURSES
if "!CHOICE!"=="3" goto UNINSTALL_ALL_WIPE
if "!CHOICE!"=="4" goto WIPE_COURSES_ONLY
if "!CHOICE!"=="5" goto CANCEL
goto MENU

rem ============================================================
rem  1. DON DEP NHANH CACHE & FILE TAM
rem ============================================================
:CLEAN_CACHE
echo.
echo  !C_CYAN!======================================================!C_RESET!
echo    !C_BOLD!!C_WHITE!BAT DAU DON DEP NHANH CACHE ^& TEP TAM!C_RESET!
echo  !C_CYAN!======================================================!C_RESET!
echo.

echo  !C_CYAN![!C_GREEN!####!C_GRAY!----------------!C_CYAN!]!C_BOLD!!C_WHITE!  20%%!C_RESET!  Dung tien trinh server cong 3000...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
  taskkill /F /T /PID %%p >nul 2>&1
)
ping -n 2 127.0.0.1 >nul
echo       !C_GREEN![OK]!C_RESET! Tien trinh da san sang

echo  !C_CYAN![!C_GREEN!########!C_GRAY!------------!C_CYAN!]!C_BOLD!!C_WHITE!  40%%!C_RESET!  Don dep cache build .next\...
if exist ".next" (
  attrib -r -s -h ".next\*.*" /s /d >nul 2>&1
  if not exist "_empty_del" mkdir "_empty_del" >nul 2>&1
  robocopy "_empty_del" ".next" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
  rmdir /s /q ".next" >nul 2>&1
  rmdir /s /q "_empty_del" >nul 2>&1
  if exist ".next" powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath '.next' -Recurse -Force -ErrorAction SilentlyContinue" >nul 2>&1
  if exist ".next" (
    echo       !C_YELLOW![!]!C_RESET! Thu muc .next con file dang khoa
  ) else (
    echo       !C_GREEN![OK]!C_RESET! Da xoa sach .next
  )
) else (
  echo       !C_GREEN![OK]!C_RESET! Khong co .next can xoa
)

echo  !C_CYAN![!C_GREEN!############!C_GRAY!--------!C_CYAN!]!C_BOLD!!C_WHITE!  60%%!C_RESET!  Don dep cache am thanh tts-cache...
if exist "data\tts-cache" (
  del /f /q "data\tts-cache\*.*" >nul 2>&1
  echo       !C_GREEN![OK]!C_RESET! Da don sach tts-cache
)

echo  !C_CYAN![!C_GREEN!################!C_GRAY!----!C_CYAN!]!C_BOLD!!C_WHITE!  80%%!C_RESET!  Don dep log rac va tep tam...
del /f /q *.log >nul 2>&1
del /f /q temp*.* >nul 2>&1
del /f /q *.tmp >nul 2>&1
del /f /q scripts\temp*.* >nul 2>&1
del /f /q scripts\test*.* >nul 2>&1
if exist "temp-perfect-render" rmdir /s /q "temp-perfect-render" >nul 2>&1
if exist "temp-synced-render" rmdir /s /q "temp-synced-render" >nul 2>&1
if exist "temp-video-test" rmdir /s /q "temp-video-test" >nul 2>&1
if exist ".playwright-mcp" del /f /q ".playwright-mcp\*.*" >nul 2>&1
if exist "C:\Users\Admin\Downloads\Temp_File" del /f /q "C:\Users\Admin\Downloads\Temp_File\*.*" >nul 2>&1
echo       !C_GREEN![OK]!C_RESET! Da don sach cac file tam va log

echo  !C_CYAN![!C_GREEN!====================!C_CYAN!]!C_BOLD!!C_GREEN! 100%%!C_RESET!  Hoan tat don dep!
echo.
echo  !C_GREEN!======================================================!C_RESET!
echo    !C_BOLD!!C_GREEN!THANH CONG: He thong da duoc don sach se.!C_RESET!
echo    !C_WHITE!Bai giang (data\courses\) va .env duoc bao ve nguyen ven.!C_RESET!
echo  !C_GREEN!======================================================!C_RESET!
echo.
if not "!AUTO_YES!"=="1" pause
exit /b 0

rem ============================================================
rem  2. GO CAI DAT (GIU LAI BAI GIANG)
rem ============================================================
:UNINSTALL_KEEP_COURSES
echo.
echo  !C_YELLOW!======================================================!C_RESET!
echo    !C_BOLD!!C_WHITE!XAC NHAN: GO CAI DAT (GIU NGUYEN BAI GIANG)!C_RESET!
echo  !C_YELLOW!======================================================!C_RESET!
echo  Thao tac nay se xoa:
echo    !C_GRAY!- node_modules\   (khoang ~500 MB)!C_RESET!
echo    !C_GRAY!- .runtime\       (Node/Python/ffmpeg/venv ~1.5 GB)!C_RESET!
echo    !C_GRAY!- .next\          (ban build ~100 MB)!C_RESET!
echo    !C_GRAY!- Cache am thanh va cac log rac!C_RESET!
echo.
echo  !C_GREEN!GIU NGUYEN:!C_RESET!
echo    !C_GREEN!- Toan bo bai giang trong data\courses\!C_RESET!
echo    !C_GREEN!- File cau hinh Key API (.env va data\ai-settings.json)!C_RESET!
echo.
set "CONFIRM="
set /p "CONFIRM=  Ban co chac chan muon tiep tuc? (Y/N): "
if defined CONFIRM set "CONFIRM=!CONFIRM: =!"
if /i not "!CONFIRM!"=="Y" goto CANCEL

:DO_UNINSTALL_KEEP_COURSES

echo.
echo  !C_CYAN![!C_GREEN!##!C_GRAY!------------------!C_CYAN!]!C_BOLD!!C_WHITE!  10%%!C_RESET!  Dung server va tat ca tien trinh lien quan...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
  taskkill /F /T /PID %%p >nul 2>&1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = (Get-Location).Path; Get-Process python, node -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -and $_.Path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) } catch { $false } } | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1
ping -n 2 127.0.0.1 >nul
echo       !C_GREEN![OK]!C_RESET! Da dung tat ca tien trinh

echo  !C_CYAN![!C_GREEN!####!C_GRAY!----------------!C_CYAN!]!C_BOLD!!C_WHITE!  20%%!C_RESET!  Bao ve file .env va bai giang...
if exist ".env" echo       !C_GREEN![OK]!C_RESET! Da bao ve .env
if exist "data\courses" echo       !C_GREEN![OK]!C_RESET! Da bao ve data\courses\

echo  !C_CYAN![!C_GREEN!########!C_GRAY!------------!C_CYAN!]!C_BOLD!!C_WHITE!  40%%!C_RESET!  Dang xoa thu vien node_modules...
if exist "node_modules" (
  attrib -r -s -h "node_modules\*.*" /s /d >nul 2>&1
  if not exist "_empty_del" mkdir "_empty_del" >nul 2>&1
  robocopy "_empty_del" "node_modules" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
  rmdir /s /q "node_modules" >nul 2>&1
  rmdir /s /q "_empty_del" >nul 2>&1
  if exist "node_modules" powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath 'node_modules' -Recurse -Force -ErrorAction SilentlyContinue" >nul 2>&1
  if exist "node_modules" (
    echo       !C_YELLOW![!]!C_RESET! node_modules con file dang khoa
  ) else (
    echo       !C_GREEN![OK]!C_RESET! Da xoa node_modules
  )
) else (
  echo       !C_GREEN![OK]!C_RESET! Khong co node_modules
)

echo  !C_CYAN![!C_GREEN!############!C_GRAY!--------!C_CYAN!]!C_BOLD!!C_WHITE!  60%%!C_RESET!  Dang xoa cache build .next\...
if exist ".next" (
  attrib -r -s -h ".next\*.*" /s /d >nul 2>&1
  if not exist "_empty_del" mkdir "_empty_del" >nul 2>&1
  robocopy "_empty_del" ".next" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
  rmdir /s /q ".next" >nul 2>&1
  rmdir /s /q "_empty_del" >nul 2>&1
  if exist ".next" powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath '.next' -Recurse -Force -ErrorAction SilentlyContinue" >nul 2>&1
  echo       !C_GREEN![OK]!C_RESET! Da xoa .next
)

echo  !C_CYAN![!C_GREEN!###############!C_GRAY!-----!C_CYAN!]!C_BOLD!!C_WHITE!  75%%!C_RESET!  Dang xoa moi truong .runtime (Node/Python/ffmpeg)...
if exist ".runtime" (
  attrib -r -s -h ".runtime\*.*" /s /d >nul 2>&1
  if not exist "_empty_del" mkdir "_empty_del" >nul 2>&1
  robocopy "_empty_del" ".runtime" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
  rmdir /s /q ".runtime" >nul 2>&1
  rmdir /s /q "_empty_del" >nul 2>&1
  if exist ".runtime" powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath '.runtime' -Recurse -Force -ErrorAction SilentlyContinue" >nul 2>&1
  if exist ".runtime" (
    echo       !C_YELLOW![!]!C_RESET! .runtime con file dang khoa
  ) else (
    echo       !C_GREEN![OK]!C_RESET! Da xoa .runtime
  )
) else (
  echo       !C_GREEN![OK]!C_RESET! Khong co .runtime
)

echo  !C_CYAN![!C_GREEN!##################!C_GRAY!--!C_CYAN!]!C_BOLD!!C_WHITE!  90%%!C_RESET!  Xoa cache giong doc, library-text va file tam...
if exist "data\voices" rmdir /s /q "data\voices" >nul 2>&1
if exist "data\tts-cache" del /f /q "data\tts-cache\*.*" >nul 2>&1
if exist "data\library-text" rmdir /s /q "data\library-text" >nul 2>&1
if exist "tsconfig.tsbuildinfo" del /q "tsconfig.tsbuildinfo" >nul 2>&1
del /f /q *.log >nul 2>&1
del /f /q temp*.* >nul 2>&1
del /f /q *.tmp >nul 2>&1
del /f /q scripts\temp*.* >nul 2>&1
del /f /q scripts\test*.* >nul 2>&1
if exist ".playwright-mcp" del /f /q ".playwright-mcp\*.*" >nul 2>&1
if exist "C:\Users\Admin\Downloads\Temp_File" del /f /q "C:\Users\Admin\Downloads\Temp_File\*.*" >nul 2>&1
echo       !C_GREEN![OK]!C_RESET! Da xoa cache va file tam

echo  !C_CYAN![!C_GREEN!====================!C_CYAN!]!C_BOLD!!C_GREEN! 100%%!C_RESET!  Go cai dat hoan tat!
echo.
echo  !C_GREEN!======================================================!C_RESET!
echo    !C_BOLD!!C_GREEN!HOAN TAT: He thong da duoc go cai dat sach se.!C_RESET!
echo    !C_WHITE!Bai giang trong data\courses\ va file .env DUOC GIU NGUYEN.!C_RESET!
echo    !C_CYAN!Ban co the chay run.bat bat cu luc nao de cai lai 1-click.!C_RESET!
echo  !C_GREEN!======================================================!C_RESET!
echo.
if not "!AUTO_YES!"=="1" pause
exit /b 0

rem ============================================================
rem  3. GO CAI DAT TOAN BO + XOA HET DATA BAI GIANG
rem ============================================================
:UNINSTALL_ALL_WIPE
echo.
echo  !C_RED!======================================================!C_RESET!
echo    !C_BOLD!!C_RED!CANH BAO NGUY HIEM: XOA SACH TOAN BO KE CA BAI GIANG!C_RESET!
echo  !C_RED!======================================================!C_RESET!
echo  Thao tac nay se XOA HET TAT CA:
echo    !C_RED!- node_modules\, .runtime\, .next\!C_RESET!
echo    !C_RED!- TOAN BO BAI GIANG DA TAO TRONG data\courses\*.json!C_RESET!
echo    !C_RED!- Toan bo cache am thanh tts-cache, chi muc thu vien!C_RESET!
echo.
echo  !C_GREEN!CHI GIU LAI:!C_RESET!
echo    !C_GREEN!- Source code goc cua du an!C_RESET!
echo    !C_GREEN!- File cau hinh Key API (.env)!C_RESET!
echo.
set "CONFIRM="
set /p "CONFIRM=  Ban co THUC SU muon xoa sach ca bai giang? (Go YES de dong y): "
if defined CONFIRM set "CONFIRM=!CONFIRM: =!"
if /i not "!CONFIRM!"=="YES" goto CANCEL

:DO_UNINSTALL_ALL_WIPE

echo.
echo  !C_CYAN![!C_GREEN!##!C_GRAY!------------------!C_CYAN!]!C_BOLD!!C_WHITE!  10%%!C_RESET!  Dung server va tat ca tien trinh lien quan...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
  taskkill /F /T /PID %%p >nul 2>&1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = (Get-Location).Path; Get-Process python, node -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -and $_.Path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) } catch { $false } } | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1
ping -n 2 127.0.0.1 >nul
echo       !C_GREEN![OK]!C_RESET! Da dung tat ca tien trinh

echo  !C_CYAN![!C_GREEN!####!C_GRAY!----------------!C_CYAN!]!C_BOLD!!C_WHITE!  20%%!C_RESET!  Bao ve file .env...
if exist ".env" echo       !C_GREEN![OK]!C_RESET! Da bao ve .env

echo  !C_CYAN![!C_GREEN!#######!C_GRAY!-------------!C_CYAN!]!C_BOLD!!C_WHITE!  35%%!C_RESET!  Dang xoa thu vien node_modules...
if exist "node_modules" (
  attrib -r -s -h "node_modules\*.*" /s /d >nul 2>&1
  if not exist "_empty_del" mkdir "_empty_del" >nul 2>&1
  robocopy "_empty_del" "node_modules" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
  rmdir /s /q "node_modules" >nul 2>&1
  rmdir /s /q "_empty_del" >nul 2>&1
  if exist "node_modules" powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath 'node_modules' -Recurse -Force -ErrorAction SilentlyContinue" >nul 2>&1
  echo       !C_GREEN![OK]!C_RESET! Da xoa node_modules
) else (
  echo       !C_GREEN![OK]!C_RESET! Khong co node_modules
)

echo  !C_CYAN![!C_GREEN!==========!C_GRAY!----------!C_CYAN!]!C_BOLD!!C_WHITE!  50%%!C_RESET!  Dang xoa cache build .next\...
if exist ".next" (
  attrib -r -s -h ".next\*.*" /s /d >nul 2>&1
  if not exist "_empty_del" mkdir "_empty_del" >nul 2>&1
  robocopy "_empty_del" ".next" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
  rmdir /s /q ".next" >nul 2>&1
  rmdir /s /q "_empty_del" >nul 2>&1
  if exist ".next" powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath '.next' -Recurse -Force -ErrorAction SilentlyContinue" >nul 2>&1
  echo       !C_GREEN![OK]!C_RESET! Da xoa .next
)

echo  !C_CYAN![!C_GREEN!=============!C_GRAY!-------!C_CYAN!]!C_BOLD!!C_WHITE!  65%%!C_RESET!  Dang xoa moi truong .runtime...
if exist ".runtime" (
  attrib -r -s -h ".runtime\*.*" /s /d >nul 2>&1
  if not exist "_empty_del" mkdir "_empty_del" >nul 2>&1
  robocopy "_empty_del" ".runtime" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
  rmdir /s /q ".runtime" >nul 2>&1
  rmdir /s /q "_empty_del" >nul 2>&1
  if exist ".runtime" powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath '.runtime' -Recurse -Force -ErrorAction SilentlyContinue" >nul 2>&1
  echo       !C_GREEN![OK]!C_RESET! Da xoa .runtime
) else (
  echo       !C_GREEN![OK]!C_RESET! Khong co .runtime
)

echo  !C_CYAN![!C_GREEN!================!C_GRAY!----!C_CYAN!]!C_BOLD!!C_WHITE!  80%%!C_RESET!  DANG XOA TOAN BO DU LIEU BAI GIANG TRONG data\courses\...
if exist "data\courses" (
  del /f /q "data\courses\*.*" >nul 2>&1
  if not exist "_empty_del" mkdir "_empty_del" >nul 2>&1
  robocopy "_empty_del" "data\courses" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
  rmdir /s /q "_empty_del" >nul 2>&1
  echo       !C_GREEN![OK]!C_RESET! Da xoa toan bo bai giang trong data\courses\
)
if exist "data\temp_delete" rmdir /s /q "data\temp_delete" >nul 2>&1
for %%f in (course-library.json model-trust.json token-limits.json tts-settings.json) do (
  if exist "data\%%f" del /q "data\%%f" >nul 2>&1
)

echo  !C_CYAN![!C_GREEN!##################!C_GRAY!--!C_CYAN!]!C_BOLD!!C_WHITE!  90%%!C_RESET!  Xoa cache am thanh va file tam...
if exist "data\voices" rmdir /s /q "data\voices" >nul 2>&1
if exist "data\tts-cache" del /f /q "data\tts-cache\*.*" >nul 2>&1
if exist "data\library-text" rmdir /s /q "data\library-text" >nul 2>&1
if exist "tsconfig.tsbuildinfo" del /q "tsconfig.tsbuildinfo" >nul 2>&1
del /f /q *.log >nul 2>&1
del /f /q temp*.* >nul 2>&1
del /f /q *.tmp >nul 2>&1
del /f /q scripts\temp*.* >nul 2>&1
del /f /q scripts\test*.* >nul 2>&1
if exist ".playwright-mcp" del /f /q ".playwright-mcp\*.*" >nul 2>&1
if exist "C:\Users\Admin\Downloads\Temp_File" del /f /q "C:\Users\Admin\Downloads\Temp_File\*.*" >nul 2>&1
echo       !C_GREEN![OK]!C_RESET! Da xoa toan bo cache va log

echo  !C_CYAN![!C_GREEN!====================!C_CYAN!]!C_BOLD!!C_GREEN! 100%%!C_RESET!  Xoa sach se hoan tat!
echo.
echo  !C_GREEN!======================================================!C_RESET!
echo    !C_BOLD!!C_GREEN!HOAN TAT XOA TOAN BO: He thong da duoc dua ve ban dau.!C_RESET!
echo    !C_WHITE!File .env van duoc giu lai de ban khong phai nhap lai Key.!C_RESET!
echo    !C_CYAN!Chay run.bat de cai dat lai moi thu bat cu khi nao.!C_RESET!
echo  !C_GREEN!======================================================!C_RESET!
echo.
if not "!AUTO_YES!"=="1" pause
exit /b 0

rem ============================================================
rem  4. CHI XOA DATA BAI GIANG (RESET THU VIEN)
rem ============================================================
:WIPE_COURSES_ONLY
echo.
echo  !C_YELLOW!======================================================!C_RESET!
echo    !C_BOLD!!C_WHITE!XAC NHAN: CHI XOA TOAN BO DATA BAI GIANG!C_RESET!
echo  !C_YELLOW!======================================================!C_RESET!
echo  Thao tac nay se xoa:
echo    !C_GRAY!- Toan bo bai giang trong data\courses\*.json!C_RESET!
echo    !C_GRAY!- Toan bo cache am thanh giong doc trong data\tts-cache\!C_RESET!
echo    !C_GRAY!- Chi muc thu vien data\course-library.json!C_RESET!
echo.
echo  !C_GREEN!GIU NGUYEN:!C_RESET!
echo    !C_GREEN!- node_modules\, .runtime\, .next\ (Khong can cai lai)!C_RESET!
echo    !C_GREEN!- Source code va Key API (.env)!C_RESET!
echo.
set "CONFIRM="
set /p "CONFIRM=  Ban co chac chan muon xoa sach bai giang? (Y/N): "
if defined CONFIRM set "CONFIRM=!CONFIRM: =!"
if /i not "!CONFIRM!"=="Y" goto CANCEL

:DO_WIPE_COURSES_ONLY

echo.
echo  !C_CYAN![!C_GREEN!#####!C_GRAY!---------------!C_CYAN!]!C_BOLD!!C_WHITE!  25%%!C_RESET!  Dung server cong 3000 neu dang mo...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
  taskkill /F /T /PID %%p >nul 2>&1
)
ping -n 2 127.0.0.1 >nul

echo  !C_CYAN![!C_GREEN!==========!C_GRAY!----------!C_CYAN!]!C_BOLD!!C_WHITE!  50%%!C_RESET!  Dang xoa bai giang trong data\courses\...
if exist "data\courses" (
  del /f /q "data\courses\*.*" >nul 2>&1
  if not exist "_empty_del" mkdir "_empty_del" >nul 2>&1
  robocopy "_empty_del" "data\courses" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
  rmdir /s /q "_empty_del" >nul 2>&1
  echo       !C_GREEN![OK]!C_RESET! Da xoa sach toan bo bai giang
)

echo  !C_CYAN![!C_GREEN!===============!C_GRAY!-----!C_CYAN!]!C_BOLD!!C_WHITE!  75%%!C_RESET!  Dang xoa cache am thanh va chi muc...
if exist "data\tts-cache" del /f /q "data\tts-cache\*.*" >nul 2>&1
if exist "data\course-library.json" del /q "data\course-library.json" >nul 2>&1
if exist "data\temp_delete" rmdir /s /q "data\temp_delete" >nul 2>&1
if exist "data\library-text" rmdir /s /q "data\library-text" >nul 2>&1
echo       !C_GREEN![OK]!C_RESET! Da xoa sach cache am thanh

echo  !C_CYAN![!C_GREEN!====================!C_CYAN!]!C_BOLD!!C_GREEN! 100%%!C_RESET!  Xoa data bai giang hoan tat!
echo.
echo  !C_GREEN!======================================================!C_RESET!
echo    !C_BOLD!!C_GREEN!HOAN TAT: Thu vien bai giang da duoc lam moi hoan toan.!C_RESET!
echo    !C_WHITE!Moi truong chay va Key API van duoc giu nguyen ven.!C_RESET!
echo  !C_GREEN!======================================================!C_RESET!
echo.
if not "!AUTO_YES!"=="1" pause
exit /b 0

:CANCEL
echo.
echo  !C_YELLOW!Da huy thao tac. Khong co gi bi thay doi.!C_RESET!
echo.
if not "!AUTO_YES!"=="1" pause
exit /b 0
