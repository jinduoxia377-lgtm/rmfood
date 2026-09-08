# RMFOOD One-Click Startup Script
# Usage: .\start.ps1

$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$PythonExe = Join-Path $BackendDir ".venv\Scripts\python.exe"

function Kill-ByPort {
    param([int[]]$Ports)
    foreach ($port in $Ports) {
        $output = netstat -ano
        foreach ($line in $output) {
            if ($line -match ":${port}\s.*LISTENING\s+(?<pid>\d+)") {
                $targetPid = [int]$Matches["pid"]
                try { Stop-Process -Id $targetPid -Force -ErrorAction Stop } catch {}
            }
        }
    }
}

function Wait-ForService {
    param([string]$Url, [string]$Name, [int]$TimeoutSec = 90)
    Write-Host ("  Waiting for " + $Name + "...") -NoNewline
    $start = Get-Date
    $attempt = 0
    while ((Get-Date).AddSeconds(-$TimeoutSec) -lt $start) {
        $attempt++
        Start-Sleep -Seconds 1
        try {
            $r = Invoke-WebRequest -Uri $Url -TimeoutSec 3 -UseBasicParsing
            if ($r.StatusCode -eq 200) {
                Write-Host (" OK (attempt " + $attempt + ")") -ForegroundColor Green
                return $true
            }
        } catch {
            # continue waiting
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
$bproc = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m","uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--reload" `
    -WorkingDirectory $BackendDir -WindowStyle Hidden -PassThru
$fproc = Start-Process -FilePath "npx.cmd" `
    -ArgumentList "vite","--port","3000","--host","0.0.0.0","--mode","development" `
    -WorkingDirectory $FrontendDir -WindowStyle Hidden -PassThru
Write-Host ("  Backend  PID: " + $bproc.Id) -ForegroundColor Gray
Write-Host ("  Frontend PID: " + $fproc.Id) -ForegroundColor Gray

# Step 4: Wait and verify
Write-Host "[4/4] Verifying services..." -ForegroundColor Yellow
$bOk = Wait-ForService -Url "http://127.0.0.1:8000/api/v1/health" -Name "Backend" -TimeoutSec 90
$fOk = Wait-ForService -Url "http://127.0.0.1:3000" -Name "Frontend" -TimeoutSec 60

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
