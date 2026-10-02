<#
.SYNOPSIS
    Cài Antigravity CLI (binary "agy") cho EdusGPT.

.DESCRIPTION
    Antigravity CLI là agent chạy trên máy bạn, không cần API key. Sau khi cài,
    bạn đăng nhập MỘT LẦN (interactive), rồi EdusGPT gọi nó ở chế độ headless.

    Script này chỉ cài binary và kiểm tra `agy --version`. Bước đăng nhập phải
    làm tay vì cần trình duyệt/interactive terminal.

.PARAMETER Force
    Cài lại dù đã có agy.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/install-antigravity.ps1
    powershell -ExecutionPolicy Bypass -File scripts/install-antigravity.ps1 -Force
#>

[CmdletBinding()]
param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$Binary = if ($env:AGY_BINARY) { $env:AGY_BINARY } else { 'agy' }

# Windows PowerShell 5.1 still writes console output as UTF-16LE with `>`, so a
# redirected run (`.\install-antigravity.ps1 > setup.log`) ends up half-illegible:
# every Vietnamese message turns into "Ho?Q%V%c?t". Forcing the console to UTF-8
# here keeps those logs readable. PowerShell 7 already does this.
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
}
catch {
  Write-Verbose 'Khong doi duoc OutputEncoding, bo qua.'
}

function Get-CommandPath([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

Write-Host ''
Write-Host '== Antigravity CLI cho EdusGPT ==' -ForegroundColor Cyan
Write-Host ''

# --- 1. Đã có sẵn? -------------------------------------------------------------
$existing = Get-CommandPath $Binary
if ($existing -and -not $Force) {
  Write-Host "Đã thấy '$Binary' tại $existing" -ForegroundColor Green
}
else {
  # --- 2. Thử npm trước (nhanh nhất, không cần admin) -------------------------
  Write-Host 'Thử cài qua npm...' -ForegroundColor DarkGray
  $npm = Get-CommandPath 'npm'
  if (-not $npm) {
    throw "Không thấy npm. Cài Node.js 22+ trước: https://nodejs.org — hoặc tải agy thủ công rồi đặt vào PATH (đặt AGY_BINARY trong .env)."
  }

  $pkg = 'antigravity-cli'
  & $npm install -g $pkg
  if ($LASTEXITCODE -ne 0) {
    Write-Host "npm không cài được '$pkg'. Nếu tên package khác, cài thủ công:" -ForegroundColor Yellow
    Write-Host "  npm view antigravity-cli     # xem package có tồn tại không" -ForegroundColor Yellow
    Write-Host "  # hoặc tải binary từ trang chủ Antigravity, giải nén, đưa agy.exe vào PATH" -ForegroundColor Yellow
    exit 1
  }
}

# --- 3. Kiểm tra binary trả lời -----------------------------------------------
$existing = Get-CommandPath $Binary
if (-not $existing) {
  throw "'$Binary' vẫn không có trong PATH sau khi cài. Mở PowerShell mới rồi chạy lại, hoặc đặt AGY_BINARY=/đường/dẫn/agy trong .env."
}

Write-Host ''
Write-Host "Đường dẫn : $existing" -ForegroundColor Green

$version = (& $Binary --version 2>&1 | Select-Object -First 1)
if ($LASTEXITCODE -ne 0 -or -not $version) {
  Write-Host "Chạy '$Binary --version' không thành công." -ForegroundColor Yellow
  Write-Host 'Thử chạy tay: & agy --version' -ForegroundColor Yellow
} else {
  Write-Host "Phiên bản  : $version" -ForegroundColor Green
}

# --- 4. Hướng dẫn bước đăng nhập (làm tay) ------------------------------------
Write-Host ''
Write-Host '== Bước còn lại: đăng nhập 1 LẦN (bắt buộc, làm tay) ==' -ForegroundColor Cyan
Write-Host ''
Write-Host "  1. Mở terminal MỚI (để nạp PATH vừa cài)"
Write-Host "  2. Chạy:  $Binary          # đăng nhập theo hướng dẫn của Antigravity"
Write-Host "  3. Đóng terminal đó lại"
Write-Host ''

# --- 5. Cấp quyền đọc tài liệu cho agent --------------------------------------
# Làm được ngay, không cần login: nó chỉ thêm rule vào settings.json của CLI.
Write-Host '== Cấp quyền cho agent đọc slide (chạy được ngay) ==' -ForegroundColor Cyan
$permissionsScript = Join-Path $PSScriptRoot 'antigravity-permissions.mjs'
if (Test-Path $permissionsScript) {
  Write-Host "  node scripts/antigravity-permissions.mjs"
  Write-Host ''
  Write-Host '  Bỏ qua bước này thì chế độ headless sẽ chặn mọi lệnh đọc tài liệu và' -ForegroundColor DarkGray
  Write-Host '  trợ giảng trả về rỗng. Không cấp được thì chạy lệnh trên từ project root.' -ForegroundColor DarkGray
} else {
  Write-Host "  (không thấy $permissionsScript — chạy tay sau khi cd vào project root)" -ForegroundColor Yellow
}
Write-Host ''

Write-Host 'Đăng nhập xong, mở http://localhost:3000/setup, chọn card "Antigravity CLI",'
Write-Host 'rồi bấm "Dùng nhà cung cấp này". Không cần dán key.'
Write-Host ''
Write-Host 'Kiểm tra nhanh:  npm run agy:doctor'
Write-Host 'Chi tiết, khắc phục lỗi, và công thức multi-agent Orca: docs/ANTIGRAVITY.md'
Write-Host ''