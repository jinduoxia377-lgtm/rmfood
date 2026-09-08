# Kill processes on ports 3000 and 8000 (skip 5432 PostgreSQL)
$ports = @(3000, 8000)
$toKill = @()

foreach ($port in $ports) {
    $lines = netstat -ano | Select-String "LISTENING.*:$port "
    foreach ($line in $lines) {
        $parts = $line -split '\s+'
        $pid = $parts[-1]
        if ($pid -match '^\d+$' -and [int]$pid -gt 0) {
            if ($toKill -notcontains [int]$pid) {
                $toKill += [int]$pid
                try {
                    $proc = Get-Process -Id [int]$pid -ErrorAction Stop
                    Write-Host "Killing PID $($proc.Id) ($($proc.Name))"
                    Stop-Process -Id [int]$pid -Force -ErrorAction Stop
                } catch {
                    Write-Host "Failed to kill PID $pid"
                }
            }
        }
    }
}

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=== Remaining listeners ==="
netstat -ano | Select-String "LISTENING.*:(3000|8000) " | Select-Object -First 10

Write-Host ""
Write-Host "=== Python processes still running ==="
Get-Process python -ErrorAction SilentlyContinue | Select-Object Id,StartTime | Format-Table -AutoSize
