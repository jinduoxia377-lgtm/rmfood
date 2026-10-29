# RMFOOD One-Click Startup Script
# Usage: .\start.ps1

$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$PythonExe = Join-Path $BackendDir "venv\Scripts\python.exe"

# 开发环境固定密钥（避免后端每次启动提示 SECRET_KEY 缺失；生产环境请通过系统环境变量覆盖）
$env:SECRET_KEY = "rmfood-development-secret-key-change-in-production-with-random-32-char-string"
$env:ENV = "development"

function Get-PortPids {
    param([int]$Port)
    $pids = @()
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conns) { $pids += $conns.OwningProcess | Select-Object -Unique }
    } catch {}
    # Fallback: netstat -ano 解析（兼容未启用 WinRM 的环境）
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

# 查找残留的本项目后端服务进程（含 uvicorn --reload 的 reloader 父进程，其不占端口、杀端口后会自动重生）
function Get-ServicePids {
    $found = @()
    $procs = Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='pythonw.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        $cmd = [string]$p.CommandLine
        if ([string]::IsNullOrEmpty($cmd)) { continue }
        # 后端 uvicorn reloader：venv python -m uvicorn app.main:app
        if ($cmd -match [regex]::Escape('app.main:app')) {
            $found += [int]$p.ProcessId
        }
    }
    return $found
}

function Kill-ByPort {
    param([int[]]$Ports)
    # 收集端口监听者 + 已知服务进程，连同整棵进程树一起清理
    $targets = @()
    foreach ($port in $Ports) {
        foreach ($procId in (Get-PortPids -Port $port)) {
            if ($procId -eq 0 -or $procId -eq 4) { continue }  # 跳过空闲地址占位(System/4)
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
        } catch {
            # 进程可能已退出或属于系统，忽略
        }
    }
}

# 打印后端启动错误日志末尾，用于超时/启动失败时快速定位（路径基于项目根目录）
function Show-BackendErrTail {
    param([int]$Tail = 25)
    $logFile = Join-Path $ProjectRoot "logs\backend-start.err.log"
    if (-not (Test-Path $logFile)) {
        Write-Host ("  Log not found: " + $logFile) -ForegroundColor DarkYellow
        return
    }
    if ((Get-Item $logFile).Length -eq 0) {
        Write-Host "  backend-start.err.log is empty — 进程可能未真正启动或已被清理" -ForegroundColor DarkYellow
        return
    }
    Write-Host ("  --- last " + $Tail + " lines of logs\backend-start.err.log ---") -ForegroundColor Yellow
    Get-Content $logFile -Tail $Tail | ForEach-Object { Write-Host ("    " + $_) -ForegroundColor Yellow }
    Write-Host ("  Full log: " + $logFile) -ForegroundColor DarkYellow
}

function Wait-ForService {
    param([string]$Url, [string]$Name, [int]$TimeoutSec = 90, [System.Diagnostics.Process]$Proc = $null)
    Write-Host ("  Waiting for " + $Name + "...") -NoNewline
    $start = Get-Date
    $attempt = 0
    while ((Get-Date) -lt $start.AddSeconds($TimeoutSec)) {
        $attempt++
        # 进程已退出 → 启动即失败（如 app 导入期抛异常），无需空等超时，快速失败并直接看日志
        if ($null -ne $Proc -and $Proc.HasExited) {
            Write-Host (" FAILED (process exited, code " + $Proc.ExitCode + ")") -ForegroundColor Red
            if ($Name -eq "Backend") { Show-BackendErrTail }
            return $false
        }
        Start-Sleep -Seconds 1
        $ok = $false
        $info = ""
        # 首选 Invoke-WebRequest（PS5.1 默认可用；不传 -NoProxy/-HttpVersion 以免参数绑定异常）
        try {
            $r = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing -MaximumRedirection 3
            $code = [int]$r.StatusCode
            $ok = ($code -eq 200 -or $code -lt 500)
            $info = ("http " + $code)
        } catch {
            # 捕获 HTTP 错误（如 4xx）——说明服务已响应
            if ($_.Exception.Response) {
                $code = [int]$_.Exception.Response.StatusCode
                $ok = ($code -lt 500)
                $info = ("http " + $code)
            }
        }
        # 兜底：纯 TCP 连接测试（Invoke-WebRequest 被代理/SSL 干扰时仍可能误判）
        if (-not $ok) {
            try {
                $parts = [System.Uri]::Parse($Url)
                $port = if ($parts.Port) { $parts.Port } else { if ($parts.Scheme -eq "https") { 443 } else { 80 } }
                $tcp = New-Object System.Net.Sockets.TcpClient
                $null = $tcp.Connect($parts.DnsHost, $port)
                $tcp.Close()
                if ($tcp.Connected) { $ok = $true; $info = "tcp" }
            } catch {}
        }
        if ($ok) {
            Write-Host (" OK (attempt " + $attempt + ", " + $info + ")") -ForegroundColor Green
            return $true
        }
        if ($attempt % 10 -eq 0) {
            Write-Host "." -NoNewline
        }
    }
    Write-Host " TIMEOUT" -ForegroundColor Red
    if ($Name -eq "Backend") { Show-BackendErrTail }
    return $false
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RMFOOD Platform - One Click Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean up
Write-Host "[1/4] Cleaning up..." -ForegroundColor Yellow
Kill-ByPort -Ports @(3000, 8000)
Start-Sleep -Seconds 2
Kill-ByPort -Ports @(3000, 8000)
Write-Host "  Done." -ForegroundColor Green

# Step 2: Check dependencies
Write-Host "[2/4] Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path $PythonExe)) {
    Write-Host "  ERROR: Python venv not found" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "  Installing npm dependencies..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    npm install --legacy-peer-deps 2>&1 | Out-Null
    Pop-Location
}
Write-Host "  Done." -ForegroundColor Green

# Step 3: Start services
Write-Host "[3/4] Starting services..." -ForegroundColor Yellow
$backendLog = Join-Path $ProjectRoot "logs\backend-start.log"
$backendErr = Join-Path $ProjectRoot "logs\backend-start.err.log"
New-Item -ItemType Directory -Force -Path (Split-Path $backendLog) | Out-Null
$bproc = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m","uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--reload" `
    -WorkingDirectory $BackendDir -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $backendLog -RedirectStandardError $backendErr
$fproc = Start-Process -FilePath "npx.cmd" `
    -ArgumentList "vite","--port","3000","--host","0.0.0.0","--mode","development" `
    -WorkingDirectory $FrontendDir -WindowStyle Hidden -PassThru
Write-Host ("  Backend  PID: " + $bproc.Id) -ForegroundColor Gray
Write-Host ("  Frontend PID: " + $fproc.Id) -ForegroundColor Gray

# Step 4: Wait and verify
Write-Host "[4/4] Verifying services..." -ForegroundColor Yellow
# 后端启动需完成建表/种子数据/AI 服务初始化，耗时较长，超时上限放宽到 5 分钟
# 验证时给后端更充裕的启动时间（含建表/种子/AI 初始化），前端 180s
$bOk = Wait-ForService -Url "http://127.0.0.1:8000/api/v1/health" -Name "Backend" -TimeoutSec 480 -Proc $bproc
$fOk = Wait-ForService -Url "http://127.0.0.1:3000" -Name "Frontend" -TimeoutSec 120 -Proc $fproc

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($bOk -and $fOk) {
    Write-Host "  STARTED SUCCESSFULLY!" -ForegroundColor Green
} elseif ($bOk -or $fOk) {
    Write-Host "  PARTIAL - check logs" -ForegroundColor Yellow
} else {
    Write-Host "  START FAILED" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  App:    http://localhost:3000" -ForegroundColor White
Write-Host "  API:    http://localhost:8000/api/v1" -ForegroundColor White
Write-Host "  Docs:   http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Stop:   .\stop.ps1" -ForegroundColor Gray
Write-Host ""
