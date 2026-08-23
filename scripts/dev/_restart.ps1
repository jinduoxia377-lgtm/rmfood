# RMFOOD 重启脚本
$ErrorActionPreference = 'Stop'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   RMFOOD 项目重启" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Kill existing processes
Write-Host "`n[1/4] 停止所有服务..." -ForegroundColor Yellow
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "  已停止所有服务。" -ForegroundColor Green

# Step 2: Start backend
Write-Host "`n[2/4] 启动后端服务..." -ForegroundColor Yellow
$backendPath = "D:\RMFOODFP\backend"
$startBackend = {
    cd $backendPath
    .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
}
Start-Process powershell -ArgumentList "-NoProfile", "-WindowStyle Normal", "-Command", $startBackend
Start-Sleep -Seconds 8
Write-Host "  后端已启动 (http://localhost:8000)" -ForegroundColor Green

# Step 3: Start frontend
Write-Host "`n[3/4] 启动前端服务..." -ForegroundColor Yellow
$frontendPath = "D:\RMFOODFP\frontend"
$startFrontend = {
    cd $frontendPath
    npm run dev -- --host 0.0.0.0 --port 3000
}
Start-Process powershell -ArgumentList "-NoProfile", "-WindowStyle Normal", "-Command", $startFrontend
Start-Sleep -Seconds 8
Write-Host "  前端已启动 (http://localhost:3000)" -ForegroundColor Green

# Step 4: Verify
Write-Host "`n[4/4] 验证服务状态..." -ForegroundColor Yellow
$backendOk = $false
$frontendOk = $false

try {
    $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) {
        $backendOk = $true
        Write-Host "  [OK] 后端健康检查通过" -ForegroundColor Green
    }
} catch {
    Write-Host "  [FAIL] 后端未响应" -ForegroundColor Red
}

try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) {
        $frontendOk = $true
        Write-Host "  [OK] 前端已启动" -ForegroundColor Green
    }
} catch {
    Write-Host "  [FAIL] 前端未响应" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   重启完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址:" -ForegroundColor White
Write-Host "  - 前端:   http://localhost:3000" -ForegroundColor White
Write-Host "  - 后端:   http://localhost:8000" -ForegroundColor White
Write-Host "  - API文档: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
