# RMFOOD 项目重启脚本 - PowerShell 版本
$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "   RMFOOD 项目重启"
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: 停止前端服务
Write-Host "`n[1/3] 停止前端服务..." -ForegroundColor Yellow
try {
    $frontendPid = netstat -ano | findstr ":3000.*LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1
    if ($frontendPid -and $frontendPid -match '^\d+$') {
        Stop-Process -Id $frontendPid -Force -ErrorAction SilentlyContinue
        Write-Host "  已停止前端进程 PID: $frontendPid"
    }
} catch {
    Write-Host "  停止前端时出错: $_"
}

# Step 2: 启动后端服务
Write-Host "`n[2/3] 启动后端服务 (端口 8000)..." -ForegroundColor Yellow
try {
    $backendScript = {
        cd D:\RMFOODFP\backend
        .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    }
    $backendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $backendScript -WindowStyle Minimized -PassThru
    Write-Host "  后端正在启动 (PID: $($backendProcess.Id))..."
    Start-Sleep -Seconds 10

    # 检查后端健康
    $healthCheck = try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 3
        $response.StatusCode -eq 200
    } catch { $false }

    if ($healthCheck) {
        Write-Host "  [OK] 后端健康检查通过" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] 后端可能还在启动中..." -ForegroundColor Red
    }
} catch {
    Write-Host "  启动后端失败: $_"
}

# Step 3: 启动前端服务
Write-Host "`n[3/3] 启动前端服务 (端口 3000)..." -ForegroundColor Yellow
try {
    $frontendScript = {
        cd D:\RMFOODFP\frontend
        npm run dev -- --host 0.0.0.0 --port 3000
    }
    $frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $frontendScript -WindowStyle Minimized -PassThru
    Write-Host "  前端正在启动 (PID: $($frontendProcess.Id))..."
    Start-Sleep -Seconds 8

    # 检查前端
    $frontendCheck = try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 3
        $response.StatusCode -eq 200
    } catch { $false }

    if ($frontendCheck) {
        Write-Host "  [OK] 前端已启动" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] 前端可能还在构建中..." -ForegroundColor Red
    }
} catch {
    Write-Host "  启动前端失败: $_"
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   重启完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`n访问地址:"
Write-Host "  - 前端:      http://localhost:3000"
Write-Host "  - 后端 API:  http://localhost:8000"
Write-Host "  - API文档:   http://localhost:8000/docs"
Write-Host ""
