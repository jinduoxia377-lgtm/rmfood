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

function Kill-ByPort {
    param([int[]]$Ports)
    foreach ($port in $Ports) {
        foreach ($procId in (Get-PortPids -Port $port)) {
            if ($procId -eq 0 -or $procId -eq 4) { continue }  # 跳过空闲地址占位(System/4)
            try {
                Stop-Process -Id $procId -Force -ErrorAction Stop
                Write-Host ("  Killed PID " + $procId + " on port " + $port) -ForegroundColor DarkGray
            } catch {}
        }
    }
}

function Wait-ForService {
    param([string]$Url, [string]$Name, [int]$TimeoutSec = 90)
    Write-Host ("  Waiting for " + $Name + "...") -NoNewline
    $start = Get-Date
    $attempt = 0
    while ((Get-Date) -lt $start.AddSeconds($TimeoutSec)) {
        $attempt++
        Start-Sleep -Seconds 1
        try {
            # -NoProxy: 避免系统代理导致探测挂起
            $r = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing `
                -NoProxy -HttpVersion 1.1 -MaximumRedirection 3
            if ($r.StatusCode -eq 200) {
                Write-Host (" OK (attempt " + $attempt + ")") -ForegroundColor Green
                return $true
            }
        } catch {
            # 网关返回 4xx 也说明服务已就绪（例如鉴权路由）
            if ($_.Exception.Response -and ([int]$_.Exception.Response.StatusCode) -lt 500) {
                Write-Host (" OK (attempt " + $attempt + ", http " + [int]$_.Exception.Response.StatusCode + ")") -ForegroundColor Green
                return $true
            }
        }
        if ($attempt % 10 -eq 0) {
            Write-Host "." -NoNewline
        }
    }
    Write-Host " TIMEOUT" -ForegroundColor Red
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
$bOk = Wait-ForService -Url "http://127.0.0.1:8000/api/v1/health" -Name "Backend" -TimeoutSec 300
$fOk = Wait-ForService -Url "http://127.0.0.1:3000" -Name "Frontend" -TimeoutSec 120

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
