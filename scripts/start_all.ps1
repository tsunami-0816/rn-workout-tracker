# start_all.ps1：一条命令起全套（PG → 迁移 → seed → 后端 → 探活）
# 用法：& scripts\start_all.ps1
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $projectRoot "05_代码\backend"
$runDir = Join-Path $projectRoot ".run"
if (-not (Test-Path $runDir)) { New-Item -ItemType Directory -Force $runDir | Out-Null }

# 原生命令执行器：docker/prisma/npm 会把提示写到 stderr（pwsh 下会变成 NativeCommandError），
# 因此临时降级 EAP，只按退出码判定成败
function Invoke-Native {
  param([string]$Label, [scriptblock]$Command)
  $old = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $code = 0
  try { & $Command } finally { $code = $LASTEXITCODE; $ErrorActionPreference = $old }
  if ($code -ne 0) { throw "$Label 失败（exit=$code）" }
}

Set-Location $projectRoot

# [0/5] 端口断言（T-904 / D-49）：env_preflight.py --ports 5434,8094,8096
# 被本项目自身进程占用（重启场景）放行；被他人占用则报红并给 PID
$repoRoot = Split-Path -Parent (Split-Path -Parent $projectRoot)
$preflight = Join-Path $repoRoot "scripts\env_preflight.py"
Write-Output "[0/5] 端口与环境断言（5434/8094/8096）"
$portOk = $true
if (Test-Path $preflight) {
  python $preflight --ports 5434,8094,8096 | Out-Host
  if ($LASTEXITCODE -ne 0) { $portOk = $false }
} else {
  Write-Output "  WARN 未找到 $preflight，跳过端口断言（仅本机开发可接受）"
}
if (-not $portOk) {
  # 端口被占不一律判死：8094 / 5434 归属本项目时按「重启场景」放行；8096 被占一律报红
  $ownPid = 0
  $pidFile = Join-Path $runDir "backend.pid"
  if (Test-Path $pidFile) { $ownPid = [int](Get-Content $pidFile -Raw).Trim() }
  $ownBackend = ($ownPid -gt 0) -and [bool](Get-Process -Id $ownPid -ErrorAction SilentlyContinue)
  $ErrorActionPreference = "Continue"
  $ownPg = ((docker ps --filter "name=rn-workout-pg" --filter "status=running" --format "{{.Names}}") -match "rn-workout-pg")
  $ErrorActionPreference = "Stop"
  $busy8094 = [bool](Get-NetTCPConnection -LocalPort 8094 -State Listen -ErrorAction SilentlyContinue)
  $busy5434 = [bool](Get-NetTCPConnection -LocalPort 5434 -State Listen -ErrorAction SilentlyContinue)
  $busy8096 = [bool](Get-NetTCPConnection -LocalPort 8096 -State Listen -ErrorAction SilentlyContinue)
  if ($busy5434 -and -not $ownPg) { throw "5434 被非本项目容器占用（见上方 PID）：先停占位进程或改端口" }
  if ($busy8094 -and -not $ownBackend) { throw "8094 被非本项目进程占用（见上方 PID）：先停占位进程或改端口" }
  if ($busy8096) { throw "8096（Metro）已被占用：先停已有 Metro 或改端口" }
  Write-Output "  INFO 端口被本项目自身占用（backend pid=$ownPid / rn-workout-pg），按重启处理继续"
}

Write-Output "[1/5] 启动 PostgreSQL 容器（宿主 5434）"
# docker 把进度写到 stderr，pwsh 下会被当成 NativeCommandError；临时降级 EAP 再按退出码判定
$ErrorActionPreference = "Continue"
docker compose up -d pg 2>&1 | Out-Null
$upCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"
if ($upCode -ne 0) { throw "docker compose up -d pg 失败（exit=$upCode），检查 Docker Desktop 是否运行" }
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  $ErrorActionPreference = "Continue"
  docker exec rn-workout-pg pg_isready -U postgres -d rn_workout 2>&1 | Out-Null
  $readyCode = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($readyCode -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { throw "PostgreSQL 60 秒内未就绪，请看 docker logs rn-workout-pg" }

Set-Location $backend
if (-not (Test-Path ".env")) { throw ".env 不存在：复制 .env.example 后填 JWT_SECRET / DEMO_CODE" }
if (-not (Test-Path "node_modules")) {
  Write-Output "[2/5] 首次安装依赖（npm install）"
  Invoke-Native "npm install" { npm install --no-audit --no-fund }
} else {
  Write-Output "[2/5] 依赖已存在，跳过安装"
}

Write-Output "[3/5] Prisma 生成 + 迁移 + seed"
if (-not (Test-Path "src\generated\prisma")) { Invoke-Native "prisma generate" { npx prisma generate } }
Invoke-Native "prisma migrate deploy" { npx prisma migrate deploy }
Invoke-Native "seed" { npx ts-node --transpile-only prisma/seed.ts }

Write-Output "[4/5] 编译并重启后端"
Invoke-Native "npm run build" { npm run build }
$pidFile = Join-Path $runDir "backend.pid"
if (Test-Path $pidFile) {
  $oldPid = [int](Get-Content $pidFile -Raw).Trim()
  Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
}
$proc = Start-Process -FilePath "node" -ArgumentList "dist/main.js" -WorkingDirectory $backend -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $backend "logs\stdout.log") -RedirectStandardError (Join-Path $backend "logs\stderr.log")
Set-Content -Path $pidFile -Value $proc.Id -Encoding ASCII

Write-Output "[5/5] 等待健康检查"
$up = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8094/api/health" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $up = $true; break }
  } catch { }
}
if (-not $up) { throw "后端 20 秒内未健康，见 05_代码\backend\logs\stderr.log" }
Write-Output "OK backend=http://127.0.0.1:8094/api pid=$($proc.Id) db=up"
