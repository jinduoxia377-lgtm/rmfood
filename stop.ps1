# RMFOOD One-Click Stop Script
# Usage: .\stop.ps1

function Kill-ByPort {
    param([int[]]$Ports)
    $killed = 0
    foreach ($port in $Ports) {
        $output = netstat -ano
        foreach ($line in $output) {
            # Port appears BEFORE LISTENING in netstat output
            if ($line -match ":${port}\s.*LISTENING\s+(?<pid>\d+)") {
                $targetPid = [int]$Matches["pid"]
                try {
                    Stop-Process -Id $targetPid -Force -ErrorAction Stop
                    $killed++
                } catch {}
            }
        }
    }
    return $killed
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RMFOOD - Stopping all services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping services..." -ForegroundColor Yellow
$total = Kill-ByPort -Ports @(3000, 8000)
Start-Sleep -Seconds 2
Kill-ByPort -Ports @(3000, 8000)  # double check

Write-Host "  Done. ($total processes stopped)" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Services stopped" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To start: run .\start.ps1" -ForegroundColor Gray
Write-Host ""
