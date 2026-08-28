# Stop nginx gracefully and check what's restarting it
$nginxPath = "C:\tools\nginx-1.31.4\nginx.exe"

Write-Host "=== Step 1: Stop nginx gracefully ==="
& $nginxPath -s stop 2>&1 | ForEach-Object { Write-Host $_ }
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=== Step 2: Force kill any remaining ==="
Get-Process nginx -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Killing PID $($_.Id)..."
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=== Step 3: Check port 80 status ==="
$port80 = netstat -ano | Select-String ":80\s.*LISTENING"
if ($port80) {
    Write-Host "Port 80 STILL IN USE:"
    Write-Host $port80
} else {
    Write-Host "Port 80 is FREE"
}

Write-Host ""
Write-Host "=== Step 4: Start fresh with rmfood config ==="
& $nginxPath -c "C:\tools\nginx-1.31.4\conf\rmfood.conf" 2>&1 | ForEach-Object { Write-Host $_ }
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=== Step 5: Verify ==="
$nginxCount = (Get-Process nginx -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "Nginx processes: $nginxCount"
netstat -ano | Select-String ":80\s.*LISTENING" | Select-Object -First 3

Write-Host ""
Write-Host "=== Monitoring for 10 seconds (watching for restart cycles)... ==="
Start-Sleep -Seconds 10
$finalCount = (Get-Process nginx -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "Final nginx process count: $finalCount"
