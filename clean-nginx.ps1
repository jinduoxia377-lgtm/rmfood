# Complete nginx cleanup and restart
$nginxPath = "C:\tools\nginx-1.31.4\nginx.exe"
$confPath = "D:\RMFOODFP\conf\nginx.conf"

Write-Host "=== Step 1: Kill ALL nginx ===" -ForegroundColor Yellow
Get-Process nginx -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Stopping PID $($_.Id) ($($_.CommandLine))"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=== Step 2: Verify all stopped ===" -ForegroundColor Yellow
$count = (Get-Process nginx -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "  Remaining nginx: $count"
if ($count -gt 0) {
    Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "=== Step 3: Create dirs ===" -ForegroundColor Yellow
$dirs = @(
    "D:\RMFOODFP\logs",
    "D:\RMFOODFP\temp\client_body_temp",
    "D:\RMFOODFP\temp\proxy_temp",
    "D:\RMFOODFP\temp\fastcgi_temp"
)
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
        Write-Host "  Created: $d"
    }
}

Write-Host ""
Write-Host "=== Step 4: Test config ===" -ForegroundColor Yellow
$result = & $nginxPath -t -c $confPath 2>&1
$result | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "=== Step 5: Start nginx ===" -ForegroundColor Yellow
& $nginxPath -c $confPath 2>&1 | ForEach-Object { Write-Host "  $_" }
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=== Step 6: Verify ===" -ForegroundColor Yellow
$count = (Get-Process nginx -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "  Nginx processes: $count"
netstat -ano | Select-String ":80\s.*LISTENING" | Select-Object -First 1
netstat -ano | Select-String ":443\s.*LISTENING" | Select-Object -First 1

Write-Host ""
Write-Host "=== PIDs ===" -ForegroundColor Cyan
Get-Process nginx -ErrorAction SilentlyContinue | Select-Object Id, CommandLine | Format-Table -AutoSize

Write-Host ""
Write-Host "DONE!" -ForegroundColor Green
