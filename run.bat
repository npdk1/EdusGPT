@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title EdusGPT - one click launcher

rem ============================================================
rem  EdusGPT - cham 1 lan, chay tren localhost:3000
rem
rem  File nay tu kiem tra va TU TAI het thu thieu truoc khi chay:
rem    - Node.js 22+      (ban portable, nem vao .runtime\node)
rem    - npm packages     (npm install)
rem    - .env             (tu .env.example)
rem    - ffmpeg           (.runtime\ffmpeg - de ghi MP3)
rem    - Python + venv    (.runtime\venv + piper-tts)
rem    - giong Viet       (data\voices\vi_VN-vais1000-medium.onnx)
rem
rem  KHONG dung Docker, va KHONG cai gi len may: moi thu duoc
rem  tai vao thu muc .runtime ngay canh project. Python chay
rem  trong venv rieng nen khong lan vao Python cua may.
rem
rem  Nhung thu sau deu "pha": thieu thi canh bao roi chay tiep,
rem  vi app tu dung API mien phi khi giong tren may chua san sang.
rem ============================================================

cd /d "%~dp0"

set "RUNTIME=%CD%\.runtime"
set "DL=%RUNTIME%\downloads"
set "NODE_SERIES=latest-v24.x"
set "PY_VERSION=3.12.10"
set "VOICE=vi_VN-vais1000-medium"

echo.
echo  ======================================================
echo    EdusGPT  ^|  giang bai AI chay ngay tren may
echo  ======================================================
echo.

if not exist "%RUNTIME%" mkdir "%RUNTIME%" >nul 2>&1
if not exist "%DL%" mkdir "%DL%" >nul 2>&1

rem ---------------------------------------------------------------- 1. Node.js
echo  [1/7] Node.js
set "NODE_HOME="
call :node_major "node"
if !NODE_MAJOR! GEQ 22 (
  set "NODE_HOME="
  echo       [OK] ban cai san !NODE_FULL!
  goto :node_done
)
if exist "%RUNTIME%\node\node.exe" (
  call :node_major "%RUNTIME%\node\node.exe"
  if !NODE_MAJOR! GEQ 22 (
    set "NODE_HOME=%RUNTIME%\node"
    set "PATH=!NODE_HOME!;%PATH%"
    echo       [OK] dung ban portable da tai: !NODE_FULL!
    goto :node_done
  )
)
echo       [..] may chua co Node.js 22 tro len - dang tai ban portable.
call :download "https://nodejs.org/dist/%NODE_SERIES%/SHASUMS256.txt" "%DL%\node-shasums.txt"
if errorlevel 1 goto :node_fail
set "NODE_ZIP="
for /f "tokens=2" %%f in ('findstr /C:"-win-x64.zip" "%DL%\node-shasums.txt"') do (
  if not defined NODE_ZIP set "NODE_ZIP=%%f"
)
if not defined NODE_ZIP goto :node_fail
call :download "https://nodejs.org/dist/%NODE_SERIES%/%NODE_ZIP%" "%DL%\%NODE_ZIP%"
if errorlevel 1 goto :node_fail
echo       [..] dang giai nen...
if exist "%RUNTIME%\node" rmdir /s /q "%RUNTIME%\node"
mkdir "%RUNTIME%\node-unpack" >nul 2>&1
call :extract "%DL%\%NODE_ZIP%" "%RUNTIME%\node-unpack"
rem  Ban nen gom trong mot thu muc con (node-v24.x-win-x64), nen chuyen
rem  noi dung thu muc do ra .runtime\node cho gon. Truong hop ban nen
rem  giai ra phang thi chuyen thang cung noi dung.
if not exist "%RUNTIME%\node-unpack\node.exe" (
  for /d %%d in ("%RUNTIME%\node-unpack\*") do xcopy /E /I /Q /Y "%%d" "%RUNTIME%\node\" >nul
) else (
  xcopy /E /I /Q /Y "%RUNTIME%\node-unpack\*" "%RUNTIME%\node\" >nul
)
rmdir /s /q "%RUNTIME%\node-unpack" >nul 2>&1
if not exist "%RUNTIME%\node\node.exe" goto :node_fail
set "NODE_HOME=%RUNTIME%\node"
set "PATH=%RUNTIME%\node;%PATH%"
call :node_major "%RUNTIME%\node\node.exe"
echo       [OK] da tai Node.js !NODE_FULL! vao .runtime\node
:node_done
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo  [LOI] Khong tim thay npm.
  pause
  exit /b 1
)

rem ------------------------------------------------------- 2. npm packages
echo  [2/7] Thu vien du an
if exist "node_modules" (
  echo       [OK] node_modules da co
) else (
  echo       [..] chua co node_modules - dang cai. Vui long doi.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [LOI] npm install that bai.
    echo         Chay lai voi mang tot hon, hoac xoa package-lock.json.
    echo.
    pause
    exit /b 1
  )
)
echo.

rem ------------------------------------------------------------- 3. .env
echo  [3/7] File .env
if exist ".env" (
  echo       [OK] .env da co ^(key cua ban nam o day^)
) else (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo       [OK] da tao .env tu .env.example
  ) else (
    echo       [..] khong co .env.example - bo qua
  )
)
echo.

rem ------------------------------------------------------------ 4. ffmpeg
rem  Khong bat buoc: thieu ffmpeg thi giong tren may van doc duoc,
rem  chi phat WAV thay vi MP3. Download 110 MB nen luon co duong lui.
echo  [4/7] ffmpeg ^(de ghi MP3^)
where ffmpeg >nul 2>&1
if not errorlevel 1 (
  echo       [OK] ffmpeg da co tren may
  goto :ffmpeg_done
)
if exist "%RUNTIME%\ffmpeg\bin\ffmpeg.exe" (
  set "PATH=%RUNTIME%\ffmpeg\bin;%PATH%"
  echo       [OK] dung ban portable da tai
  goto :ffmpeg_done
)
echo       [..] chua co ffmpeg - dang tai ban portable.
call :download "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" "%DL%\ffmpeg.zip"
if errorlevel 1 goto :ffmpeg_warn
if exist "%RUNTIME%\ffmpeg" rmdir /s /q "%RUNTIME%\ffmpeg"
mkdir "%RUNTIME%\ffmpeg-unpack" >nul 2>&1
call :extract "%DL%\ffmpeg.zip" "%RUNTIME%\ffmpeg-unpack"
mkdir "%RUNTIME%\ffmpeg\bin" >nul 2>&1
for /r "%RUNTIME%\ffmpeg-unpack" %%f in (ffmpeg.exe) do (
  copy /y "%%f" "%RUNTIME%\ffmpeg\bin\" >nul
  copy /y "%%~dpffmpeg.exe" "%RUNTIME%\ffmpeg\bin\" >nul 2>&1
  goto :ffmpeg_have
)
:ffmpeg_have
rmdir /s /q "%RUNTIME%\ffmpeg-unpack" >nul 2>&1
if not exist "%RUNTIME%\ffmpeg\bin\ffmpeg.exe" goto :ffmpeg_warn
set "PATH=%RUNTIME%\ffmpeg\bin;%PATH%"
echo       [OK] da tai ffmpeg vao .runtime\ffmpeg
goto :ffmpeg_done
:ffmpeg_warn
call :warn "khong tai duoc ffmpeg - giong tren may se phat WAV."
echo       [!!] khong tai duoc ffmpeg - van chay duoc, chi phat WAV.
:ffmpeg_done
echo.

rem ------------------------------------------- 5. Python + venv + piper-tts
echo  [5/7] Python cho giong doc tren may
set "PY_EXE="
call :py_probe "python"
call :py_ok
if defined PY_OK set "PY_EXE=python"
if not defined PY_EXE (
  call :py_probe "py -3"
  call :py_ok
  if defined PY_OK set "PY_EXE=py -3"
)
if defined PY_EXE (
  echo       [OK] Python tren may: !PY_FULL!
) else if exist "%RUNTIME%\python\python.exe" (
  set "PY_EXE=%RUNTIME%\python\python.exe"
  echo       [OK] dung Python da tai vao .runtime\python
) else (
  echo       [..] chua co Python - dang tai ban cai cho rieng project.
  call :download "https://www.python.org/ftp/python/%PY_VERSION%/python-%PY_VERSION%-amd64.exe" "%DL%\python-installer.exe"
  if errorlevel 1 goto :python_warn
  echo       [..] dang cai, im lang mot luc...
  start /wait "" "%DL%\python-installer.exe" /quiet InstallAllUsers=0 TargetDir="%RUNTIME%\python" PrependPath=0 Include_launcher=0 Include_test=0 Shortcuts=0 AssociateFiles=0
  rem  Ban cai mac dinh co the bo qua TargetDir khi cai cho ca may, nen
  rem  thu them thu muc mac dinh cua chinh nguoi dung truoc khi ket luan.
  call :wait_file "%RUNTIME%\python\python.exe" 30
  if not exist "%RUNTIME%\python\python.exe" if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
  if not defined PY_EXE goto :python_warn
  echo       [OK] da cai Python ^(xem !PY_EXE!^)
)
goto :venv_step
:python_warn
set "PY_EXE="
call :warn "khong cai duoc Python - se dung API mien phi de doc."

:venv_step
set "VENV_PY="
if defined PY_EXE (
  set "VENV_PY=%RUNTIME%\venv\Scripts\python.exe"
  if not exist "!VENV_PY!" (
    echo       [..] tao venv tai .runtime\venv...
    !PY_EXE! -m venv "%RUNTIME%\venv"
  )
  if not exist "!VENV_PY!" (
    set "VENV_PY="
    call :warn "khong tao duoc venv o .runtime."
  )
)
if not defined VENV_PY goto :voice_step
"%VENV_PY%" -c "import piper" >nul 2>&1
if not errorlevel 1 (
  echo       [OK] piper-tts da co trong venv
) else (
  echo       [..] dang cai piper-tts trong venv. Vui long doi.
  "%VENV_PY%" -m pip install --disable-pip-version-check --no-input --quiet piper-tts
  if errorlevel 1 (
    set "VENV_PY="
    call :warn "cai piper-tts that bai."
    echo       [!!] cai piper-tts that bai
  ) else (
    echo       [OK] da cai piper-tts
  )
)
echo.

rem ------------------------------------------------------------ 6. giong Viet
:voice_step
echo  [6/7] Giong doc tieng Viet
if defined VENV_PY (
  if not exist "data\voices" mkdir "data\voices" >nul 2>&1
  dir /b "data\voices\*.onnx" >nul 2>&1
  if errorlevel 1 (
    echo       [..] chua co giong - dang tai ~60 MB...
    "%VENV_PY%" -m piper.download_voices --download-dir "%CD%\data\voices" %VOICE%
    if errorlevel 1 (
      call :warn "tai giong that bai."
      echo       [!!] tai giong that bai - van chay duoc
    ) else (
      echo       [OK] da co giong %VOICE%
    )
  ) else (
    echo       [OK] da co giong tren may
  )
  rem App doc dung python nay de doc bai.
  set "EDUSGPT_PYTHON=!VENV_PY!"
) else (
  echo       [..] bo qua - dung API mien phi
)
echo.

rem ------------------------------------------------- 7.cong 3000 + trinh duyet
echo  [7/7] Khoi dong server
set "BUSY_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"TCP .*:3000 .*LISTENING"') do (
  if not defined BUSY_PID set "BUSY_PID=%%p"
)
if defined BUSY_PID (
  echo       [..] cong 3000 dang bi chiem ^(PID %BUSY_PID%^) - dang dong lai...
  taskkill /F /PID %BUSY_PID% >nul 2>&1
  ping -n 2 127.0.0.1 >nul
)
ping -n 2 127.0.0.1 >nul
start "" http://localhost:3000
echo.


echo  ------------------------------------------------------
echo   Web       : http://localhost:3000
echo   Cai key   : http://localhost:3000/setup
echo   Bai AI    : http://localhost:3000/studio
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
exit /b 0

rem ============================================================
rem  cac ham phu
rem ============================================================

rem --- node_major <duong dan node> : ra NODE_MAJOR, NODE_FULL
:node_major
set "NODE_MAJOR=0"
set "NODE_FULL=khong ro"
for /f "tokens=1,2 delims=." %%a in ('%~1 -p "process.versions.node" 2^>nul') do (
  set "NODE_MAJOR=%%a"
  set "NODE_FULL=%%a.%%b"
)
goto :eof

:node_fail
echo.
echo  [LOI] Khong tai duoc Node.js.
echo         Kiem tra mang, hoac tai Node.js 22+ tu https://nodejs.org
echo         roi chay lai run.bat.
echo.
pause
exit /b 1

rem --- py_probe <lenh> : ra PY_MAJOR, PY_MINOR, PY_FULL
rem  Dong Python khong duoc co dau nhay don: mot dau nhay se lam
rem  dong lenh trong for /f ket thuc som, va ham se im lang.
:py_probe
set "PY_MAJOR=0"
set "PY_MINOR=0"
set "PY_FULL=khong ro"
for /f "tokens=1,2,3 delims=." %%a in ('%~1 -c "import sys;print(sys.version.split()[0])" 2^>nul') do (
  set "PY_MAJOR=%%a"
  set "PY_MINOR=%%b"
  set "PY_FULL=%%a.%%b.%%c"
)
goto :eof

rem --- py_ok : PY_OK=1 khi Python >= 3.10
rem  So 3.12 voi 310 theo kieu so nguyen thi "3" < "310" va may co
rem  Python 3.12 bi coi la khong du. So phai tach tung thanh phan.
:py_ok
set "PY_OK="
if !PY_MAJOR! GEQ 4 set "PY_OK=1"
if !PY_MAJOR! EQU 3 if !PY_MINOR! GEQ 10 set "PY_OK=1"
goto :eof

rem --- warn <dong canh bao>
:warn
echo   [!] %~1
goto :eof

rem --- download <url> <file> : tra 1 neu that bai
:download
if exist "%~2" (
  echo       [OK] da co san %~nx2
  goto :eof
)
echo       tai %~nx2 ^(bat dau, dung cat nganh mang^)
where curl >nul 2>&1
if not errorlevel 1 (
  curl -L --fail --silent --show-error -o "%~2" "%~1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '%~1' -OutFile '%~2' -UseBasicParsing"
)
if errorlevel 1 (
  del "%~2" >nul 2>&1
  exit /b 1
)
goto :eof

rem --- extract <zip> <thu muc dich>
:extract
if not exist "%~2" mkdir "%~2" >nul 2>&1
where tar >nul 2>&1
if not errorlevel 1 (
  tar -xf "%~1" -C "%~2%"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%~1' -DestinationPath '%~2' -Force"
)
goto :eof

rem --- wait_file <file> <giay> : cho file xuat hien
:wait_file
set /a "_WAIT=%~2"
:wait_loop
if exist "%~1" goto :eof
if !_WAIT! LEQ 0 goto :eof
ping -n 2 127.0.0.1 >nul
set /a "_WAIT-=1"
goto :wait_loop
