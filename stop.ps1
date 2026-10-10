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

# 收集某 PID 的整棵进程树（子进程 → 孙进程 ...）
function Get-ProcessTree {
    param([int]$RootPid)
    $tree = @()
    $queue = @([int]$RootPid)
    while ($queue.Count -gt 0) {
        $cur = $queue[0]; $queue = @($queue | Select-Object -Skip 1)
        $tree += $cur
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($cur)" -ErrorAction SilentlyContinue
        foreach ($c in $children) { if ($c.ProcessId -ne 0) { $queue += [int]$c.ProcessId } }
    }
    return $tree | Select-Object -Unique
}

# 查找残留的本项目后端服务进程（含 uvicorn --reload 的 reloader 父进程）
function Get-ServicePids {
    $found = @()
    $procs = Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='pythonw.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        $cmd = [string]$p.CommandLine
        if ([string]::IsNullOrEmpty($cmd)) { continue }
        if ($cmd -match [regex]::Escape('app.main:app')) {
            $found += [int]$p.ProcessId
        }
    }
    return $found
}

function Kill-ByPort {
    param([int[]]$Ports)
    # 收集端口监听者 + 已知服务进程，连同整棵进程树一起清理，
    # 确保 uvicorn --reload 的 reloader 父进程也被终止（否则会自动重生 worker）
    $killed = 0
    $targets = @()
    foreach ($port in $Ports) {
        foreach ($procId in (Get-PortPids -Port $port)) {
            if ($procId -eq 0 -or $procId -eq 4) { continue }  # 跳过 System/空闲占位
            $targets += Get-ProcessTree -RootPid $procId
        }
    }
    foreach ($svcPid in (Get-ServicePids)) {
        $targets += Get-ProcessTree -RootPid $svcPid
    }
    foreach ($procId in ($targets | Select-Object -Unique)) {
        if ($procId -eq 0 -or $procId -eq 4) { continue }
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
            $killed++
        } catch {}
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
