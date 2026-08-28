# Clean nginx restart for RMFOOD
$nginxPath = "C:\tools\nginx-1.31.4\nginx.exe"
$confPath = "D:\RMFOODFP\conf\nginx.conf"

Write-Host "=== Stopping all nginx processes ===" -ForegroundColor Yellow
Get-Process nginx -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Stopping PID $($_.Id)..."
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=== Creating required directories ===" -ForegroundColor Yellow
$dirs = @(
    "D:\RMFOODFP\logs",
    "D:\RMFOODFP\temp\client_body_temp",
    "D:\RMFOODFP\temp\proxy_temp",
    "D:\RMFOODFP\temp\fastcgi_temp",
    "D:\RMFOODFP\temp\uwsgi_temp",
    "D:\RMFOODFP\temp\scgi_temp"
)
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
        Write-Host "  Created: $d"
    }
}

Write-Host ""
Write-Host "=== Testing config ===" -ForegroundColor Yellow
& $nginxPath -t -c $confPath 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host "Config test FAILED!" -ForegroundColor Red
    exit 1
}
Write-Host "  Config OK" -ForegroundColor Green

Write-Host ""
Write-Host "=== Starting nginx ===" -ForegroundColor Yellow
& $nginxPath -c $confPath 2>&1 | ForEach-Object { Write-Host "  $_" }
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Yellow
$nginxCount = (Get-Process nginx -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "  Nginx processes: $nginxCount"

$port80 = netstat -ano | Select-String ":80\s.*LISTENING"
$port443 = netstat -ano | Select-String ":443\s.*LISTENING"
Write-Host "  Port 80: $(if ($port80) {'LISTENING'} else {'FREE'})"
Write-Host "  Port 443: $(if ($port443) {'LISTENING'} else {'FREE'})"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  RMFOOD nginx started successfully!" -ForegroundColor Green
Write-Host "  https://agnet.ltd" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
