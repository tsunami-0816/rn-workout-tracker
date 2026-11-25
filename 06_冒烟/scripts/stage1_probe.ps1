# stage1_probe.ps1：第 6 步阶段一 · P0 用户操作路径探活（带字段值断言）
# 用法：& 06_冒烟\scripts\stage1_probe.ps1
# 说明：除了 status/code，必须断言关键字段值（G6 口径：禁止只断 200）
$BaseUrl = "http://127.0.0.1:8094"
$MetroUrl = "http://127.0.0.1:8096"
$DemoCode = "123456"
$AdminPhone = "13800138000"
$UserPhone = "13900139000"
$DevPhone = "137" + (Get-Date -Format "MMddHHmm")   # 每次唯一，避开 60s 频控残留

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$logDir = Join-Path $projectRoot "06_冒烟\evidence"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force $logDir | Out-Null }
$logFile = Join-Path $logDir ("stage1_probe_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".log")
$script:lines = @()
$script:failures = 0
$script:records = @()

function Write-Log([string]$text) { $script:lines += $text; Write-Output $text }

function Assert-Field([bool]$condition, [string]$name, [string]$actual) {
  if ($condition) { Write-Log ("PASS  " + $name + "   [" + $actual + "]") }
  else { $script:failures++; Write-Log ("FAIL  " + $name + "   [" + $actual + "]") }
}

function Invoke-Api {
  param([string]$Method, [string]$Path, [string]$Token = "", $Body = $null, [string]$Base = "")
  if (-not $Base) { $Base = $BaseUrl }
  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $uri = "$Base$Path"
  try {
    $params = @{ Uri = $uri; Method = $Method; Headers = $headers; TimeoutSec = 30; UseBasicParsing = $true; ErrorAction = "Stop" }
    if ($null -ne $Body) {
      $params["ContentType"] = "application/json"
      $params["Body"] = ($Body | ConvertTo-Json -Compress)
    }
    $resp = Invoke-WebRequest @params
    $text = $resp.Content
    if ($text -is [byte[]]) { $text = [Text.Encoding]::UTF8.GetString($text) }
    $json = $null
    try { $json = $text | ConvertFrom-Json } catch { }
    return [pscustomobject]@{ Status = [int]$resp.StatusCode; Content = $text; Json = $json; Length = $resp.RawContentLength }
  } catch {
    $response = $_.Exception.Response
    if ($null -ne $response) {
      $code = [int]$response.StatusCode
      $text = $_.ErrorDetails.Message
      if (-not $text) {
        try { $stream = $response.GetResponseStream(); $text = (New-Object System.IO.StreamReader($stream)).ReadToEnd() } catch { $text = "" }
      }
      $json = $null
      try { $json = $text | ConvertFrom-Json } catch { }
      return [pscustomobject]@{ Status = $code; Content = $text; Json = $json; Length = 0 }
    }
    return [pscustomobject]@{ Status = 0; Content = $_.Exception.Message; Json = $null; Length = 0 }
  }
}

Write-Log ("=== stage1_probe " + (Get-Date -Format "s") + " base=" + $BaseUrl + " ===")

# 0. 自清理：admin 当日训练（保证本脚本可重复执行；不动其他账号数据）
$cleanSql = "DELETE FROM set_logs WHERE workout_log_id IN (SELECT id FROM workout_logs WHERE user_id=(SELECT id FROM users WHERE phone='13800138000') AND log_date=CURRENT_DATE); DELETE FROM workout_logs WHERE user_id=(SELECT id FROM users WHERE phone='13800138000') AND log_date=CURRENT_DATE;"
$cleanOut = docker exec rn-workout-pg psql -U postgres -d rn_workout -c $cleanSql 2>&1
Write-Log ("[0] 清理 admin 当日训练：" + ($cleanOut -join " | "))

# A. 验证码频控（T-205）：首发成功、60s 内重发 42901
$sc1 = Invoke-Api -Method POST -Path "/api/auth/send-code" -Body @{ phone = $DevPhone }
$sc2 = Invoke-Api -Method POST -Path "/api/auth/send-code" -Body @{ phone = $DevPhone }
Assert-Field ($sc1.Status -eq 200 -and $sc1.Json.code -eq 0) "send-code 首发 200/code0" ("status=" + $sc1.Status + " code=" + $sc1.Json.code)
Assert-Field ($sc2.Status -eq 429 -and $sc2.Json.code -eq 42901) "send-code 60s 内重发 → 429/42901" ("status=" + $sc2.Status + " code=" + $sc2.Json.code)

# B. 两个角色各登录一次 + /me 脱敏与角色
$loginAdmin = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ phone = $AdminPhone; code = $DemoCode }
$loginUser = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ phone = $UserPhone; code = $DemoCode }
$adminToken = $loginAdmin.Json.data.token
$userToken = $loginUser.Json.data.token
$meAdmin = Invoke-Api -Method GET -Path "/api/auth/me" -Token $adminToken
$meUser = Invoke-Api -Method GET -Path "/api/auth/me" -Token $userToken
Assert-Field ($loginAdmin.Json.data.token.Length -gt 20 -and $loginUser.Json.data.token.Length -gt 20) "admin/普通用户均登录拿到 token" ("adminLen=" + $adminToken.Length + " userLen=" + $userToken.Length)
Assert-Field ($meAdmin.Json.data.role -eq "admin") "admin /me role=admin" ("role=" + $meAdmin.Json.data.role)
Assert-Field ($meUser.Json.data.role -eq "user") "普通用户 /me role=user" ("role=" + $meUser.Json.data.role)
Assert-Field ($meAdmin.Json.data.phoneMasked -match "^\d{3}\*{4}\d{4}$") "admin /me 手机号脱敏（phoneMasked）" ("phoneMasked=" + $meAdmin.Json.data.phoneMasked)
Assert-Field ($meAdmin.Content -notmatch "13800138000") "/me 响应不含完整手机号" ("len=" + $meAdmin.Content.Length)

# C. 计划页（T-301/T-302）：3 张卡 + 今日推荐 + todayWorkoutPlanId + 动作 12 条有序
$plans = Invoke-Api -Method GET -Path "/api/plans" -Token $userToken
$planList = @($plans.Json.data.list)
Assert-Field ($planList.Count -eq 3) "计划列表 3 张卡" ("count=" + $planList.Count)
$dayTypes = ($planList | ForEach-Object { $_.dayType }) -join "/"
Assert-Field ($dayTypes -eq "推/拉/腿") "3 张卡 dayType = 推/拉/腿（与前端 types.ts 一致）" ("dayTypes=" + $dayTypes)
Assert-Field ($null -ne $plans.Json.data.PSObject.Properties["todayWorkoutPlanId"]) "/plans 返回 todayWorkoutPlanId 字段" ("value=" + $plans.Json.data.todayWorkoutPlanId)
$current = Invoke-Api -Method GET -Path "/api/plans/current" -Token $userToken
Assert-Field ($current.Status -eq 200 -and @("推","拉","腿") -contains $current.Json.data.dayType) "/plans/current 返回合法 dayType" ("dayType=" + $current.Json.data.dayType + " name=" + $current.Json.data.name)
$planId = [int]$planList[0].id
$exercises = Invoke-Api -Method GET -Path "/api/plans/$planId/exercises" -Token $userToken
$exList = @($exercises.Json.data.list)
Assert-Field ($exList.Count -eq 12) "推日动作 12 条" ("count=" + $exList.Count)
$orders = ($exList | ForEach-Object { [int]$_.orderNo })
$isAsc = $true
for ($i = 1; $i -lt $orders.Count; $i++) { if ($orders[$i] -le $orders[$i-1]) { $isAsc = $false } }
Assert-Field ($isAsc -and $orders[0] -eq 1) "动作按 orderNo 升序 1..12" ("orders=" + ($orders -join ","))
$exName = $exList[0].name
Assert-Field ($exName -match "[\u4e00-\u9fa5]") "动作名为中文非占位" ("name=" + $exName)

# D. 管理端主路径用 admin 账号走（避免消耗普通用户当日状态）
$adminPlans = Invoke-Api -Method GET -Path "/api/plans" -Token $adminToken
$adminPlanId = [int]@($adminPlans.Json.data.list)[0].id
$start = Invoke-Api -Method POST -Path "/api/workouts/start" -Token $adminToken -Body @{ planId = $adminPlanId }
$workoutId = [int]$start.Json.data.workoutId
Assert-Field ($workoutId -gt 0) "admin 开始训练拿 workoutId" ("workoutId=" + $workoutId)
$start2 = Invoke-Api -Method POST -Path "/api/workouts/start" -Token $adminToken -Body @{ planId = $adminPlanId }
Assert-Field ([int]$start2.Json.data.workoutId -eq $workoutId) "同日重复 start 复用同一 workoutId" ("workoutId2=" + $start2.Json.data.workoutId)
$adminEx = Invoke-Api -Method GET -Path "/api/plans/$adminPlanId/exercises" -Token $adminToken
$exerciseId = [int]@($adminEx.Json.data.list)[0].id

# E. 记录页写链路（T-402/T-403）：录入→容量→改→删→再来一次
$post = Invoke-Api -Method POST -Path "/api/workouts/$workoutId/sets" -Token $adminToken -Body @{ exerciseId = $exerciseId; setNo = 1; weight = 60; reps = 10; done = $true }
Assert-Field ($post.Status -ge 200 -and $post.Status -lt 300) "录入第 1 组 60kg×10" ("status=" + $post.Status)
$detail1 = Invoke-Api -Method GET -Path "/api/workouts/$workoutId" -Token $adminToken
$sets1 = @($detail1.Json.data.sets)
Assert-Field ($sets1.Count -eq 1 -and [double]$sets1[0].weight -eq 60 -and [int]$sets1[0].reps -eq 10 -and $sets1[0].done -eq $true) "回查 1 行且 weight=60/reps=10/done=true" ("count=" + $sets1.Count + " w=" + $sets1[0].weight + " r=" + $sets1[0].reps + " done=" + $sets1[0].done)
Assert-Field ([double]$detail1.Json.data.totalVolume -eq 600) "容量 60×10=600" ("totalVolume=" + $detail1.Json.data.totalVolume)
$setId = [int]$sets1[0].id
$patch = Invoke-Api -Method PATCH -Path "/api/workouts/$workoutId/sets/$setId" -Token $adminToken -Body @{ weight = 70 }
$detail2 = Invoke-Api -Method GET -Path "/api/workouts/$workoutId" -Token $adminToken
Assert-Field ([double]$detail2.Json.data.totalVolume -eq 700) "改重量 70 后容量 700" ("totalVolume=" + $detail2.Json.data.totalVolume)
$dup = Invoke-Api -Method POST -Path "/api/workouts/$workoutId/sets" -Token $adminToken -Body @{ exerciseId = $exerciseId; setNo = 1; weight = 65; reps = 10; done = $true }
$detail3 = Invoke-Api -Method GET -Path "/api/workouts/$workoutId" -Token $adminToken
$sets3 = @($detail3.Json.data.sets)
Assert-Field ($sets3.Count -eq 1 -and [double]$sets3[0].weight -eq 65) "同组重提 = upsert（仍 1 行且 weight=65）" ("count=" + $sets3.Count + " w=" + $sets3[0].weight)
Assert-Field ([double]$detail3.Json.data.totalVolume -eq 650) "upsert 后容量 650" ("totalVolume=" + $detail3.Json.data.totalVolume)
$del = Invoke-Api -Method DELETE -Path "/api/workouts/$workoutId/sets/$setId" -Token $adminToken
Assert-Field ($del.Status -ge 200 -and $del.Status -lt 300) "删除该组 2xx" ("status=" + $del.Status)
$detail4 = Invoke-Api -Method GET -Path "/api/workouts/$workoutId" -Token $adminToken
Assert-Field (@($detail4.Json.data.sets).Count -eq 0 -and [double]$detail4.Json.data.totalVolume -eq 0) "删组后 0 行、容量回落 0" ("count=" + @($detail4.Json.data.sets).Count + " total=" + $detail4.Json.data.totalVolume)

# F. 结束训练后写入被拒（T-401）：40002
$postAgain = Invoke-Api -Method POST -Path "/api/workouts/$workoutId/sets" -Token $adminToken -Body @{ exerciseId = $exerciseId; setNo = 1; weight = 60; reps = 10; done = $true }
$finish = Invoke-Api -Method POST -Path "/api/workouts/$workoutId/finish" -Token $adminToken
Assert-Field ($finish.Status -ge 200 -and $finish.Status -lt 300) "结束训练 2xx（已录 1 组）" ("status=" + $finish.Status + " code=" + $finish.Json.code)
$afterFinish = Invoke-Api -Method POST -Path "/api/workouts/$workoutId/sets" -Token $adminToken -Body @{ exerciseId = $exerciseId; setNo = 2; weight = 60; reps = 10; done = $true }
Assert-Field ($afterFinish.Status -eq 400 -and $afterFinish.Json.code -eq 40002) "结束后再加组 → 400/40002" ("status=" + $afterFinish.Status + " code=" + $afterFinish.Json.code)
$detailFin = Invoke-Api -Method GET -Path "/api/workouts/$workoutId" -Token $adminToken
Assert-Field ($detailFin.Json.data.finished -eq $true) "workout 回查 finished=true" ("finished=" + $detailFin.Json.data.finished)

# G. 统计（T-501）：4 周序列数值口径
$weekly = Invoke-Api -Method GET -Path "/api/stats/weekly" -Token $adminToken
$series = @($weekly.Json.data.series)
Assert-Field ($series.Count -eq 4) "weekly 返回 4 周序列" ("count=" + $series.Count)
Assert-Field ($null -ne $weekly.Json.data.days -and $null -ne $weekly.Json.data.totalVolume) "weekly 含 days/totalVolume" ("days=" + $weekly.Json.data.days + " total=" + $weekly.Json.data.totalVolume)
$lastWeek = $series[3]
Assert-Field ([double]$lastWeek.volume -eq 600) "本周最后一根柱 = 600（与刚录入一致）" ("week=" + $lastWeek.weekStart + " volume=" + $lastWeek.volume)
$history = Invoke-Api -Method GET -Path "/api/stats/history" -Token $adminToken
Assert-Field ($history.Status -eq 200 -and $null -ne $history.Json.data.list) "history 可达且含 list" ("status=" + $history.Status + " count=" + @($history.Json.data.list).Count)

# H. admin 端（T-602）：分页、脱敏、size 上限、users、summary
$aw = Invoke-Api -Method GET -Path "/api/admin/workouts?page=1&size=5" -Token $adminToken
$awList = @($aw.Json.data.list)
Assert-Field ($aw.Status -eq 200 -and $awList.Count -le 5 -and [int]$aw.Json.data.size -eq 5) "admin workouts 分页 size=5 生效" ("count=" + $awList.Count + " total=" + $aw.Json.data.total)
Assert-Field ($aw.Content -notmatch "1[3-9]\d{9}") "admin workouts 无完整手机号" ("len=" + $aw.Content.Length)
$badSize = Invoke-Api -Method GET -Path "/api/admin/workouts?page=1&size=51" -Token $adminToken
Assert-Field ($badSize.Status -eq 200 -and [int]$badSize.Json.data.size -eq 50) "size=51 被钳制到上限 50（非报错语义）" ("status=" + $badSize.Status + " size=" + $badSize.Json.data.size)
$au = Invoke-Api -Method GET -Path "/api/admin/users" -Token $adminToken
Assert-Field ($au.Status -eq 200 -and @($au.Json.data.list).Count -ge 2) "admin users 列表 ≥2" ("count=" + @($au.Json.data.list).Count)
Assert-Field ($au.Content -notmatch "1[3-9]\d{9}") "admin users 无完整手机号" ("len=" + $au.Content.Length)
$as = Invoke-Api -Method GET -Path "/api/admin/stats/summary" -Token $adminToken
Assert-Field ($as.Status -eq 200 -and $as.Json.code -eq 0) "admin stats/summary 200/code0" ("data=" + ($as.Content.Substring(0, [Math]::Min(120, $as.Content.Length))))
$userForbidden = Invoke-Api -Method GET -Path "/api/admin/users" -Token $userToken
Assert-Field ($userForbidden.Status -eq 403 -and $userForbidden.Json.code -eq 40301) "普通用户访问 admin/users → 403/40301" ("status=" + $userForbidden.Status + " code=" + $userForbidden.Json.code)

# I. 版本与安装包（T-701/T-702/D-40）
$ver = Invoke-Api -Method GET -Path "/api/app/version"
Assert-Field ($ver.Json.data.version -eq "1.0.2" -and [int]$ver.Json.data.buildNo -eq 3) "版本接口 version=1.0.2/buildNo=3（读根 release.json）" ("v=" + $ver.Json.data.version + " build=" + $ver.Json.data.buildNo)
Assert-Field ($ver.Json.data.apkUrl -match "/apk/rn-workout-1\.0\.2\.apk") "apkUrl 指向 1.0.2 安装包" ("apkUrl=" + $ver.Json.data.apkUrl)
$apkReq = [System.Net.HttpWebRequest]::Create("$BaseUrl/apk/rn-workout-1.0.2.apk")
$apkReq.Method = "HEAD"; $apkReq.Timeout = 20000
try {
  $apkResp = $apkReq.GetResponse()
  $apkStatus = [int]$apkResp.StatusCode; $apkLen = [long]$apkResp.ContentLength
  $apkResp.Close()
} catch { $apkStatus = 0; $apkLen = 0 }
Assert-Field ($apkStatus -eq 200 -and $apkLen -gt 70000000) "/apk 静态托管 HEAD 200 且体积 >70MB" ("status=" + $apkStatus + " bytes=" + $apkLen)

# J. 前端 Metro 与 dev bundle（RN 页面入口；页面视觉留阶段二）
$statusResp = Invoke-Api -Method GET -Path "/status" -Base $MetroUrl
Assert-Field ($statusResp.Status -eq 200 -and $statusResp.Content -match "packager-status:running") "Metro /status = packager-status:running" ("status=" + $statusResp.Status + " body=" + $statusResp.Content)
$bundle = Invoke-Api -Method GET -Path "/index.bundle?platform=android&dev=true&minify=false" -Base $MetroUrl
Assert-Field ($bundle.Status -eq 200 -and $bundle.Content.Length -gt 1000000) "android dev bundle 200 且 >1MB" ("status=" + $bundle.Status + " chars=" + $bundle.Content.Length)
Assert-Field ($bundle.Content.StartsWith("var __BUNDLE_START_TIME__")) "bundle 以 Metro 运行时头开头（非错误页）" ("head=" + $bundle.Content.Substring(0, [Math]::Min(40, $bundle.Content.Length)))
Assert-Field ($bundle.Content -match "今日训练" -or $bundle.Content -match "PlansScreen") "bundle 内含业务屏代码（今日训练/PlansScreen）" ("hit=" + [bool]($bundle.Content -match "今日训练" -or $bundle.Content -match "PlansScreen"))

# K. 未知路由与参数校验
$nf = Invoke-Api -Method GET -Path "/api/not-exists" -Token $userToken
Assert-Field ($nf.Status -eq 404) "未知路由 → 404" ("status=" + $nf.Status)
$badBody = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ phone = "abc"; code = $DemoCode }
Assert-Field ($badBody.Status -eq 400 -and $badBody.Json.code -eq 40001) "手机号非法 → 400/40001" ("status=" + $badBody.Status + " code=" + $badBody.Json.code)

Write-Log ("=== 结果：失败 " + $script:failures + " 项 ===")
$script:lines | Out-File -FilePath $logFile -Encoding UTF8
Write-Log ("证据日志：" + $logFile)
if ($script:failures -gt 0) { exit 1 }
exit 0
