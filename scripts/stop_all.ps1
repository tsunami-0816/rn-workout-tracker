# stop_all.ps1：停后端进程 + 停容器（保留数据卷）
# 用法：& scripts\stop_all.ps1
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot ".run\backend.pid"
if (Test-Path $pidFile) {
  $procId = [int](Get-Content $pidFile -Raw).Trim()
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Write-Output "stopped backend pid=$procId"
} else {
  Write-Output "no backend.pid（可能未通过 start_all 启动）"
}
Set-Location $projectRoot
docker compose stop pg | Out-Null
Write-Output "stopped postgres container"
