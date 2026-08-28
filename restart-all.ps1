# RMFOOD 重启脚本
$ErrorActionPreference = "Stop"

Write-Host "=== 停止所有旧进程 ===" -ForegroundColor Yellow

# 停止 nginx
$nginx = Get-Process nginx -ErrorAction SilentlyContinue
if ($nginx) {
    $nginx | Stop-Process -Force
    Write-Host "nginx stopped (PIDs: $($nginx.Id -join ', '))"
}

# 停止 node (只杀 RMFOOD 相关的)
$node = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Id -in @(1732, 12616, 12912) }
if ($node) {
    $node | Stop-Process -Force
    Write-Host "node stopped (PIDs: $($node.Id -join ', '))"
}

# 停止 python (只杀 RMFOOD 相关的)
$python = Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -lt (Get-Date).AddHours(1) }
# 找出占用 8000 的进程
$port8000 = netstat -ano | Select-String ":8000.*LISTENING"
if ($port8000) {
    $pid8000 = ($port8000[0] -split '\s+')[-1]
    Write-Host "Killing PID $pid8000 on port 8000"
    Stop-Process -Id $pid8000 -Force -ErrorAction SilentlyContinue
}

$port3000 = netstat -ano | Select-String ":3000.*LISTENING"
if ($port3000) {
    $pid3000 = ($port3000[0] -split '\s+')[-1]
    Write-Host "Killing PID $pid3000 on port 3000"
    Stop-Process -Id $pid3000 -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=== 清理临时目录 ===" -ForegroundColor Yellow
$tempDirs = @(
    "D:\RMFOODFP\temp\client_body_temp",
    "D:\RMFOODFP\temp\proxy_temp",
    "D:\RMFOODFP\temp\fastcgi_temp",
    "D:\RMFOODFP\temp\uwsgi_temp",
    "D:\RMFOODFP\temp\scgi_temp"
)
foreach ($d in $tempDirs) {
    if (Test-Path $d) {
        Remove-Item "$d\*" -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "=== 启动 nginx ===" -ForegroundColor Yellow
& "C:\tools\nginx-1.31.4\nginx.exe" -c "D:\RMFOODFP\conf\nginx.conf" 2>&1
Write-Host "nginx exit: $LASTEXITCODE"

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=== 启动后端 (port 8000) ===" -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "app.main:app", "--port", "8000", "--reload" -WorkingDirectory "D:\RMFOODFP\backend" -WindowStyle Hidden
Write-Host "Backend started on port 8000"

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=== 启动前端 (port 3000) ===" -ForegroundColor Yellow
Start-Process -FilePath "node" -ArgumentList "node_modules/vite/bin/vite.js", "--config", "vite.config.ts", "--port", "3000" -WorkingDirectory "D:\RMFOODFP\frontend" -WindowStyle Hidden
Write-Host "Frontend started on port 3000"

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "=== 验证服务状态 ===" -ForegroundColor Green
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "Backend: OK ($($r.Content))"
} catch {
    Write-Host "Backend: NOT READY"
}
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -UseBasicParsing
    Write-Host "Frontend: OK ($($r.StatusCode))"
} catch {
    Write-Host "Frontend: checking..."
}

Write-Host ""
Write-Host "=== 完成 ===" -ForegroundColor Cyan
Write-Host "访问地址:"
Write-Host "  前端: http://localhost:3000"
Write-Host "  后端: http://localhost:8000"
Write-Host "  文档: http://localhost:8000/docs"
Write-Host "  Nginx: http://agnet.ltd"
