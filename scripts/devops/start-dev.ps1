# RMFOOD 本地开发 - 启动所有服务
# 用法: 双击此文件

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  RMFOOD 本地开发 - 启动所有服务" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. 启动 nginx
Write-Host "[1/3] 启动 nginx..." -ForegroundColor Yellow
.\start-nginx.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "nginx 启动失败，请检查上方错误信息" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  下一步: 启动开发服务器" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  请在新终端窗口中运行:" -ForegroundColor Cyan
Write-Host "    cd D:\RMFOODFP\backend && python -m uvicorn app.main:app --port 8000 --reload" -ForegroundColor White
Write-Host ""
Write-Host "    cd D:\RMFOODFP\frontend && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  然后访问 https://agnet.ltd 进行测试" -ForegroundColor Green
Write-Host ""
