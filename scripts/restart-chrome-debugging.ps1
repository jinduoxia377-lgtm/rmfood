# Chrome Remote Debugging Launcher
# 重启 Chrome 并启用远程调试端口

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$chromeUserData = "$env:LOCALAPPDATA\Google\Chrome\User Data"
$debugPort = 9222

Write-Host "=== Chrome 远程调试启动器 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "步骤 1: 关闭现有 Chrome 进程..." -ForegroundColor Yellow
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

Write-Host "步骤 2: 启动 Chrome 并启用远程调试端口 $debugPort..." -ForegroundColor Yellow
Start-Process $chromePath -ArgumentList "--remote-debugging-port=$debugPort", "--user-data-dir=""$chromeUserData"""

Write-Host ""
Write-Host "Chrome 已重启，远程调试端口: $debugPort" -ForegroundColor Green
Write-Host "等待 Chrome 完全启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 验证调试端口是否可用
$connected = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$debugPort/json" -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $connected = $true
            Write-Host "成功连接到 Chrome 调试端口!" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "等待 Chrome 启动... ($($i+1)/10)" -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if (-not $connected) {
    Write-Host "警告: 无法连接到 Chrome 调试端口" -ForegroundColor Red
    Write-Host "请确保 Chrome 已完全启动" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 完成 ===" -ForegroundColor Cyan
Write-Host "现在可以使用 browser_inspect 工具访问您的浏览器页面" -ForegroundColor Green
