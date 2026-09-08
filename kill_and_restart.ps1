# Kill backend (port 8000) and frontend (port 3000) processes
# Skip PostgreSQL (port 5432)

$ports = @(3000, 8000)
$killed = @()

foreach ($port in $ports) {
    $conns = netstat -ano | Select-String "LISTENING.*:$port " | ForEach-Object {
        $_.ToString() -replace '.*\s(\d+)\s*$', '$1' | Where-Object { $_ -match '^\d+$' }
    }
    foreach ($pid in $conns) {
        try {
            $proc = Get-Process -Id $pid -ErrorAction Stop
            Write-Host "Killing PID $pid ($($proc.Name)) on port $port"
            Stop-Process -Id $pid -Force -ErrorAction Stop
            $killed += $pid
        } catch {
            Write-Host "Failed to kill PID $pid"
        }
    }
}

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Remaining listeners on ports 3000/8000:"
netstat -ano | Select-String "LISTENING.*:(3000|8000) " | Select-Object -First 10

Write-Host ""
Write-Host "Done. Killed PIDs: $($killed -join ', ')"
