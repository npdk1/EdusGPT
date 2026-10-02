# ============================================================================
# EdusGPT - smoke test  (ASCII only: Windows PowerShell 5.1 reads .ps1
# files as ANSI when they have no BOM, so keep this file accent-free.)
#
# Usage: start the server (npm run dev / npm start) then:
#   powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1 -BaseUrl http://localhost:3001
# ============================================================================
param([string]$BaseUrl = "http://localhost:3000")

$ErrorActionPreference = "Continue"
$results = @()

function Add-Result([string]$name, $status, $expected) {
  $ok = if ($expected -is [array]) { $expected -contains [int]$status } else { [int]$status -eq [int]$expected }
  $script:results += [pscustomobject]@{ Test = $name; Status = $status; Expected = $expected; OK = $ok }
}

function Invoke-Checked([string]$method, [string]$path, $body, $contentType) {
  $uri = "$BaseUrl$path"
  try {
    if ($null -ne $body) {
      $response = Invoke-WebRequest -Uri $uri -Method $method -Body $body -ContentType $contentType -UseBasicParsing -TimeoutSec 30
    } else {
      $response = Invoke-WebRequest -Uri $uri -Method $method -UseBasicParsing -TimeoutSec 30
    }
    return @{ Status = [int]$response.StatusCode; Content = $response.Content }
  } catch {
    $status = 0
    if ($_.Exception.Response -ne $null) { $status = [int]$_.Exception.Response.StatusCode.value__ }
    return @{ Status = $status; Content = "" }
  }
}

# ---- pages -----------------------------------------------------------------
foreach ($path in @("/", "/lesson", "/setup", "/studio", "/api/health")) {
  $result = Invoke-Checked "GET" $path $null $null
  Add-Result "GET $path" $result.Status 200
}


# ---- the player page must really contain the seekable timeline -------------
$player = Invoke-Checked "GET" "/lesson" $null $null
if ($player.Status -eq 200) {
  Add-Result "player html has scene layers" ([bool]($player.Content -match 'data-scene="0"')) $true
  Add-Result "player html has scrub slider" ([bool]($player.Content -match 'role="slider"')) $true
  Add-Result "player html has A-B loop controls" ([bool]($player.Content -match 'A.B')) $true
}

# ---- key endpoints: must answer politely while no key is configured --------
$result = Invoke-Checked "GET" "/api/settings/gemini" $null $null
Add-Result "GET /api/settings/gemini" $result.Status 200

$result = Invoke-Checked "GET" "/api/ai/models" $null $null
Add-Result "GET /api/ai/models (no provider param)" $result.Status @(428, 200)

$result = Invoke-Checked "POST" "/api/gemini/lesson" "{}" "application/json"
Add-Result "POST /api/gemini/lesson (no key)" $result.Status @(400, 428)

$fakeKey = @{ apiKey = "AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE0"; dryRun = $true } | ConvertTo-Json -Compress
$result = Invoke-Checked "POST" "/api/settings/gemini" $fakeKey "application/json"
Add-Result "POST /api/settings/gemini (fake key rejected)" $result.Status @(400, 502)

# ---- export round-trip -----------------------------------------------------
$lesson = @{
  lesson = @{
    id        = "smoke-test"
    title     = "Smoke test lesson"
    subject   = "QA"
    language  = "vi"
    fps       = 30
    duration  = 0
    source    = "sample"
    createdAt = "2026-01-01T00:00:00.000Z"
    chapters  = @()
    scenes    = @(
      @{ kind = "cover"; accent = "brand"; title = "Open"; subtitle = "hello"; bullets = @("one", "two"); narration = "welcome"; duration = 6 },
      @{ kind = "formula"; accent = "gold"; title = "Formula"; bullets = @("F = m a"); formula = "F = m a"; narration = "the law"; duration = 7 },
      @{ kind = "summary"; accent = "ember"; title = "Close"; bullets = @("done"); narration = "bye"; duration = 5 }
    )
  }
} | ConvertTo-Json -Depth 10 -Compress

$result = Invoke-Checked "POST" "/api/export/html" $lesson "application/json"
Add-Result "POST /api/export/html" $result.Status 200
if ($result.Status -eq 200) {
  $html = $result.Content
  Add-Result "export: inline lesson JSON blob" ([bool]($html -match 'id="lesson-data"')) $true
  Add-Result "export: two-way seek code" ([bool]($html -match 'tl\.time\(current\)')) $true
  Add-Result "export: every scene rendered" ([bool]($html -match 'data-scene="2"')) $true
  Add-Result "export: range scrubber" ([bool]($html -match 'input type="range" id="scrub"')) $true
  Add-Result "export: A-B loop control" ([bool]($html -match 'id="loop"')) $true
  Add-Result "export: gsap from CDN" ([bool]($html -match 'gsap\.min\.js')) $true
}

$result = Invoke-Checked "POST" "/api/export/json" $lesson "application/json"
Add-Result "POST /api/export/json" $result.Status 200
if ($result.Status -eq 200) {
  Add-Result "export json has lesson body" ([bool]($result.Content -match 'eduai-studio/lesson@1')) $true
}

# ---- report ----------------------------------------------------------------
$results | Format-Table -AutoSize
$failed = @($results | Where-Object { -not $_.OK })
if ($failed.Count -gt 0) {
  Write-Host ("FAILED: " + $failed.Count + " checks") -ForegroundColor Red
  $failed | ForEach-Object { Write-Host ("  - " + $_.Test + " -> " + $_.Status) }
  exit 1
}
Write-Host ("OK: all " + $results.Count + " checks passed") -ForegroundColor Green

