$ErrorActionPreference = 'Continue'
Write-Host '=== Expo / EAS 登录窗口 ===' -ForegroundColor Cyan
Write-Host '下面会提示输入 Expo 账号邮箱和密码（2FA 会再提示一次）。'
Write-Host '看到 Logged in as <你的账号> 就表示成功，可以直接关窗口。'
Write-Host ''
Set-Location 'D:\lg\project\工作流测试\projects\rn-mobile-app-release\05_代码\frontend'
npx --yes eas-cli@latest login
Write-Host ''
if ($LASTEXITCODE -eq 0) {
  Write-Host '登录成功。请回到对话回复「已登录」。' -ForegroundColor Green
} else {
  Write-Host '登录未成功（退出码 ' + $LASTEXITCODE + '）。把窗口里的红字截图发给助手。' -ForegroundColor Yellow
}
Read-Host '按回车关闭窗口'
