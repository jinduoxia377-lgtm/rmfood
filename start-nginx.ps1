# RMFOOD 本地开发 - 启动 nginx SSL 代理
# 用法: 双击此文件，或在 PowerShell 中运行 .\start-nginx.ps1

$nginxExe = "C:\tools\nginx-1.31.4\nginx.exe"
$confPath = "C:\tools\nginx-1.31.4\conf\rmfood.conf"
$projectDir = "D:\RMFOODFP"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  RMFOOD 本地开发 - 启动 nginx SSL 代理" -ForegroundColor Cyan
Write-Host "  域名: https://agnet.ltd" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. 停止所有 nginx 实例
Write-Host "[1/4] 停止现有 nginx 进程..." -ForegroundColor Yellow
$nginxProcs = Get-Process nginx -ErrorAction SilentlyContinue
if ($nginxProcs) {
    $nginxProcs | ForEach-Object {
        Write-Host "  停止 PID $($_.Id)"
    }
    Stop-Process -Name nginx -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "  nginx 已停止" -ForegroundColor Green
} else {
    Write-Host "  无 nginx 进程在运行" -ForegroundColor Gray
}

# 2. 确保临时目录存在
Write-Host ""
Write-Host "[2/4] 检查临时目录..." -ForegroundColor Yellow
$tempDirs = @(
    "$projectDir\temp\client_body_temp",
    "$projectDir\temp\proxy_temp",
    "$projectDir\temp\fastcgi_temp",
    "$projectDir\temp\uwsgi_temp",
    "$projectDir\temp\scgi_temp",
    "$projectDir\logs"
)
foreach ($dir in $tempDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  创建: $dir"
    }
}
Write-Host "  临时目录就绪" -ForegroundColor Green

# 3. 测试配置
Write-Host ""
Write-Host "[3/4] 测试 nginx 配置..." -ForegroundColor Yellow
$configTest = & $nginxExe -t -c $confPath 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  配置测试通过 ✓" -ForegroundColor Green
} else {
    Write-Host "  配置测试失败 ✗" -ForegroundColor Red
    Write-Host $configTest
    exit 1
}

# 4. 启动 nginx
Write-Host ""
Write-Host "[4/4] 启动 nginx..." -ForegroundColor Yellow
& $nginxExe -c $confPath 2>&1 | Out-Null
Start-Sleep -Seconds 1

# 验证启动
$port80 = netstat -ano | Select-String ":80\s" | Select-String "LISTENING"
$port443 = netstat -ano | Select-String ":443\s" | Select-String "LISTENING"

if ($port80 -and $port443) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  nginx 启动成功！" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  访问地址:" -ForegroundColor Cyan
    Write-Host "    前端: https://agnet.ltd" -ForegroundColor Green
    Write-Host "    后端: https://agnet.ltd/api/v1" -ForegroundColor Green
    Write-Host "    Swagger: https://agnet.ltd/docs" -ForegroundColor Green
    Write-Host "    健康检查: https://agnet.ltd/health" -ForegroundColor Green
    Write-Host ""
    Write-Host "  首次访问会显示证书警告（自签名证书）" -ForegroundColor Gray
    Write-Host "  点击'高级' → '继续访问'即可" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  管理命令:" -ForegroundColor Cyan
    Write-Host "    重载配置: C:\tools\nginx-1.31.4\nginx.exe -s reload" -ForegroundColor White
    Write-Host "    停止服务: C:\tools\nginx-1.31.4\nginx.exe -s stop" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "  启动失败，请检查日志: D:\RMFOODFP\logs\nginx-error.log" -ForegroundColor Red
    exit 1
}
