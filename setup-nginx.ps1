# Check and stop nginx, then start fresh
$nginxPath = "C:\tools\nginx-1.31.4\nginx.exe"
$confPath = "C:\tools\nginx-1.31.4\conf\rmfood.conf"

Write-Host "=== Step 1: Kill all nginx ==="
Get-Process nginx -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Killing PID $($_.Id)..."
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=== Step 2: Verify all stopped ==="
$remaining = Get-Process nginx -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "WARNING: $($remaining.Count) nginx processes still running"
    $remaining | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}
Write-Host "Nginx processes remaining: $((Get-Process nginx -ErrorAction SilentlyContinue | Measure-Object).Count)"

Write-Host ""
Write-Host "=== Step 3: Test config ==="
& $nginxPath -t -c $confPath 2>&1 | ForEach-Object { Write-Host $_ }

Write-Host ""
Write-Host "=== Step 4: Start nginx ==="
& $nginxPath -c $confPath 2>&1 | ForEach-Object { Write-Host $_ }
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "=== Step 5: Verify ==="
$port80 = netstat -ano | Select-String ":80\s" | Select-String "LISTENING"
$port443 = netstat -ano | Select-String ":443\s" | Select-String "LISTENING"
Write-Host "Port 80 listening: $(if ($port80) {'YES'} else {'NO'})"
Write-Host "Port 443 listening: $(if ($port443) {'YES'} else {'NO'})"
Write-Host ""
Write-Host "=== DONE ==="
