# 启动后端服务
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 等待3秒后检查服务状态
Start-Sleep -Seconds 3

# 测试API端点
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET
    Write-Host "健康检查成功: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "健康检查失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 测试API v1端点
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1" -Method GET
    Write-Host "API v1端点成功" -ForegroundColor Green
    Write-Host "API版本: $($response.version)" -ForegroundColor Yellow
} catch {
    Write-Host "API v1端点失败: $($_.Exception.Message)" -ForegroundColor Red
}