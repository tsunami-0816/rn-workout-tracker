# p95.ps1：混合接口压测（C12 口径 P95<=300ms，C09 版本接口 P95<=200ms）
# 用法：& scripts\p95.ps1
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$base = "http://127.0.0.1:8094/api"
$evidenceDir = Join-Path $projectRoot "05_代码\backend\evidence"
if (-not (Test-Path $evidenceDir)) { New-Item -ItemType Directory -Force $evidenceDir | Out-Null }

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" `
  -Body '{"phone":"13900139000","code":"123456"}' -TimeoutSec 10
$token = $login.data.token
$headers = @{ Authorization = "Bearer $token" }
$plans = Invoke-RestMethod -Uri "$base/plans" -Headers $headers -TimeoutSec 10
$planId = $plans.data.list[0].id
$start = Invoke-RestMethod -Uri "$base/workouts/start" -Method POST -ContentType "application/json" `
  -Headers $headers -Body ("{""planId"":" + $planId + "}") -TimeoutSec 10
$workoutId = $start.data.workoutId
$ex = Invoke-RestMethod -Uri "$base/plans/$planId/exercises" -Headers $headers -TimeoutSec 10
$exerciseId = $ex.data.list[0].id

function Measure-Request([string]$Method, [string]$Path, [string]$Token) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $h = @{}
  if ($Token) { $h["Authorization"] = "Bearer $Token" }
  try {
    $p = @{ Uri = "$base$Path"; Method = $Method; Headers = $h; UseBasicParsing = $true; TimeoutSec = 15; ErrorAction = "Stop" }
    if ($Method -eq "POST") {
      if ($Path -like "/workouts/*/sets") {
        $p["ContentType"] = "application/json"
        $p["Body"] = '{"exerciseId":' + $exerciseId + ',"setNo":3,"weight":40,"reps":10,"done":true}'
      } elseif ($Path -eq "/workouts/start") {
        $p["ContentType"] = "application/json"
        $p["Body"] = '{"planId":' + $planId + '}'
      } else {
        $p["ContentType"] = "application/json"
        $p["Body"] = '{"phone":"13900139000","code":"123456"}'
      }
    }
    Invoke-WebRequest @p | Out-Null
  } catch { }
  $sw.Stop()
  return [double]$sw.Elapsed.TotalMilliseconds
}

function Percentile([double[]]$values, [double]$p) {
  $sorted = $values | Sort-Object
  $idx = [Math]::Ceiling(($p / 100.0) * $sorted.Count) - 1
  if ($idx -lt 0) { $idx = 0 }
  if ($idx -ge $sorted.Count) { $idx = $sorted.Count - 1 }
  return [Math]::Round($sorted[$idx], 1)
}

$mixed = @()
$version = @()
$rounds = 25
Write-Output "压测开始：混合接口 $rounds 轮（每轮 4 个请求）"
for ($i = 0; $i -lt $rounds; $i++) {
  $mixed += Measure-Request "POST" "/auth/login" ""
  $mixed += Measure-Request "GET" "/stats/weekly" $token
  $mixed += Measure-Request "POST" "/workouts/$workoutId/sets" $token
  $mixed += Measure-Request "GET" "/plans/$planId/exercises" $token
  $version += Measure-Request "GET" "/app/version" ""
}

$p50 = Percentile $mixed 50
$p95 = Percentile $mixed 95
$max = [Math]::Round(($mixed | Measure-Object -Maximum).Maximum, 1)
$vP95 = Percentile $version 95

$result = [pscustomobject]@{
  samples = $mixed.Count
  p50ms = $p50
  p95ms = $p95
  maxms = $max
  versionP95ms = $vP95
  targetMixed = 300
  targetVersion = 200
  pass = ($p95 -le 300) -and ($vP95 -le 200)
}
$result | ConvertTo-Json | Out-File -FilePath (Join-Path $evidenceDir "p95_latest.json") -Encoding UTF8
Write-Output ("samples={0} p50={1}ms p95={2}ms max={3}ms versionP95={4}ms pass={5}" -f $result.samples, $p50, $p95, $max, $vP95, $result.pass)
if (-not $result.pass) { exit 1 }
