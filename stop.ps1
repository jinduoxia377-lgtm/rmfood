# RMFOOD One-Click Stop Script
# Usage: .\stop.ps1

function Get-PortPids {
    param([int]$Port)
    $pids = @()
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conns) { $pids += $conns.OwningProcess | Select-Object -Unique }
    } catch {}
    # Fallback: netstat -ano 解析
    if (-not $pids) {
        $output = & netstat -ano
        foreach ($line in $output) {
            if ($line -match [regex]::Escape(":$Port") + '\s+.*LISTENING\s+(\d+)') {
                $pids += [int]$Matches[1]
            }
        }
    }
    return $pids
}

function Kill-ByPort {
    param([int[]]$Ports)
    $killed = 0
    foreach ($port in $Ports) {
        foreach ($procId in (Get-PortPids -Port $port)) {
            if ($procId -eq 0 -or $procId -eq 4) { continue }  # 跳过 System/空闲占位
            try {
                Stop-Process -Id $procId -Force -ErrorAction Stop
                $killed++
            } catch {}
        }
    }
    return $killed
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RMFOOD - Stopping all services" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""

Write-Host "Stopping services..." -ForegroundColor Yellow
$total = Kill-ByPort -Ports @(3000, 8000)
Start-Sleep -Seconds 2
$retry = Kill-ByPort -Ports @(3000, 8000)

Write-Host "  Done. ($($total + $retry) processes stopped)" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Services stopped" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "  To start: run .\start.ps1" -ForegroundColor Gray
Write-Host ""
