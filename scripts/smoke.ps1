# 5A 最小启动冒烟 (T-901): 真实 HTTP 调用, 6+ 断言, 全 2xx 且业务 code=0
# 用法: & scripts\smoke.ps1
$BaseUrl = "http://127.0.0.1:8094"
$UserPhone = "13900139000"
$AdminPhone = "13800138000"
$DemoCode = "123456"

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$evidenceDir = Join-Path $projectRoot "05_代码\backend\evidence"
if (-not (Test-Path $evidenceDir)) { New-Item -ItemType Directory -Force $evidenceDir | Out-Null }
$logFile = Join-Path $evidenceDir "smoke_latest.log"
$script:lines = @()
$script:failures = 0

function Write-Log([string]$text) {
  $script:lines += $text
  Write-Output $text
}

function Assert-True([bool]$condition, [string]$name) {
  if ($condition) { Write-Log ("PASS  " + $name) }
  else { $script:failures++; Write-Log ("FAIL  " + $name) }
}

function Invoke-Api {
  param([string]$Method, [string]$Path, [string]$Token = "", $Body = $null)
  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $uri = "$BaseUrl/api$Path"
  try {
    $params = @{
      Uri = $uri; Method = $Method; Headers = $headers; TimeoutSec = 20
      UseBasicParsing = $true; ErrorAction = "Stop"
    }
    if ($null -ne $Body) {
      $params["ContentType"] = "application/json"
      $params["Body"] = ($Body | ConvertTo-Json -Compress)
    }
    $resp = Invoke-WebRequest @params
    $json = $null
    try { $json = $resp.Content | ConvertFrom-Json } catch { }
    return [pscustomobject]@{ Status = [int]$resp.StatusCode; Content = $resp.Content; Json = $json }
  } catch {
    $response = $_.Exception.Response
    if ($null -ne $response) {
      $code = [int]$response.StatusCode
      # PowerShell 5.1 的响应流可能已被消费，错误体优先从 ErrorDetails 取
      $text = $_.ErrorDetails.Message
      if (-not $text) {
        try {
          $stream = $response.GetResponseStream()
          $reader = New-Object System.IO.StreamReader($stream)
          $text = $reader.ReadToEnd()
        } catch { $text = "" }
      }
      $json = $null
      try { $json = $text | ConvertFrom-Json } catch { }
      return [pscustomobject]@{ Status = $code; Content = $text; Json = $json }
    }
    return [pscustomobject]@{ Status = 0; Content = $_.Exception.Message; Json = $null }
  }
}

Write-Log ("=== smoke.ps1 " + (Get-Date -Format "s") + " base=$BaseUrl ===")

# 1 健康检查
$health = Invoke-Api -Method GET -Path "/health"
Assert-True ($health.Status -eq 200 -and $health.Json.code -eq 0 -and $health.Json.data.db -eq "up") "health 200 且 db=up"

# 2 未登录访问受保护接口 → 40101
$noToken = Invoke-Api -Method GET -Path "/plans"
Assert-True ($noToken.Status -eq 401 -and $noToken.Json.code -eq 40101) "无 token 访问 /plans → 401/40101"

# 3 登录（普通用户）
$login = Invoke-Api -Method POST -Path "/auth/login" -Body @{ phone = $UserPhone; code = $DemoCode }
Assert-True ($login.Status -eq 200 -and $login.Json.code -eq 0 -and $login.Json.data.token.Length -gt 20) "普通用户登录成功拿 token"
$token = $login.Json.data.token

# 4 错误验证码 → 40102
$bad = Invoke-Api -Method POST -Path "/auth/login" -Body @{ phone = $UserPhone; code = "000000" }
Assert-True ($bad.Status -eq 401 -and $bad.Json.code -eq 40102) "错验证码 → 401/40102"

# 5 计划列表
$plans = Invoke-Api -Method GET -Path "/plans" -Token $token
Assert-True ($plans.Status -eq 200 -and $plans.Json.code -eq 0 -and $plans.Json.data.list.Count -ge 3) "计划列表 ≥3 张卡"
$planId = $plans.Json.data.list[0].id

# 6 路径参数接口
$exercises = Invoke-Api -Method GET -Path "/plans/$planId/exercises" -Token $token
Assert-True ($exercises.Status -eq 200 -and $exercises.Json.data.list.Count -ge 1) "路径参数 /plans/{id}/exercises 可达"

# 7 开始训练（同日复用）
$start1 = Invoke-Api -Method POST -Path "/workouts/start" -Token $token -Body @{ planId = $planId }
Assert-True ($start1.Status -ge 200 -and $start1.Status -lt 300 -and $start1.Json.data.workoutId -gt 0) "开始训练拿到 workoutId"
$start2 = Invoke-Api -Method POST -Path "/workouts/start" -Token $token -Body @{ planId = $planId }
Assert-True ($start2.Json.data.workoutId -eq $start1.Json.data.workoutId) "同日重复 start 复用同一 workoutId"
$workoutId = $start1.Json.data.workoutId
$exerciseId = $exercises.Json.data.list[0].id

# 8 幂等提交三次 → 数据库 1 行
$setNo = 2
for ($i = 1; $i -le 3; $i++) {
  Invoke-Api -Method POST -Path "/workouts/$workoutId/sets" -Token $token -Body @{
    exerciseId = $exerciseId; setNo = $setNo; weight = 40; reps = 10; done = $true
  } | Out-Null
}
$detail = Invoke-Api -Method GET -Path "/workouts/$workoutId" -Token $token
$sameSets = @($detail.Json.data.sets | Where-Object { $_.exerciseId -eq $exerciseId -and $_.setNo -eq $setNo })
Assert-True ($sameSets.Count -eq 1) "连点 3 次同组 → DB 仍 1 行"
Assert-True ($detail.Json.data.totalVolume -gt 0) "容量按 Σ(weight*reps) 计算"

# 9 统计与版本
$stats = Invoke-Api -Method GET -Path "/stats/weekly" -Token $token
Assert-True ($stats.Status -eq 200 -and $stats.Json.data.series.Count -eq 4) "本周统计返回 4 周序列"
$version = Invoke-Api -Method GET -Path "/app/version"
Assert-True ($version.Status -eq 200 -and $version.Json.data.buildNo -ge 1) "版本接口公开可达"

# 10 admin 正向 + 普通用户越权
$adminLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{ phone = $AdminPhone; code = $DemoCode }
$adminToken = $adminLogin.Json.data.token
$adminList = Invoke-Api -Method GET -Path "/admin/workouts?page=1&size=5" -Token $adminToken
Assert-True ($adminList.Status -eq 200 -and $adminList.Json.code -eq 0) "admin 查全站 200"
Assert-True ($adminList.Content -notmatch "1[3-9]\d{9}") "admin 响应无完整手机号（脱敏）"
$forbidden = Invoke-Api -Method GET -Path "/admin/workouts" -Token $token
Assert-True ($forbidden.Status -eq 403 -and $forbidden.Json.code -eq 40301) "普通用户越权 → 403/40301"

Write-Log ("=== 结果：失败 " + $script:failures + " 项 ===")
$script:lines | Out-File -FilePath $logFile -Encoding UTF8
if ($script:failures -gt 0) { exit 1 }
exit 0
