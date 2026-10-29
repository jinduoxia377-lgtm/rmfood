# Stop the backend process on port 8000
$proc = netstat -ano | findstr ":8000" | findstr "LISTENING"
if ($proc) {
    $pid = ($proc -split '\s+')[-1]
    Write-Host "Stopping process $pid..."
    Stop-Process -Id $pid -Force
    Start-Sleep -Seconds 2
}
Write-Host "Starting backend..."
$env:PYTHONIOENCODING = "utf-8"
# cd to backend dir so relative venv path resolves correctly
Set-Location -Path $PSScriptRoot
# 使用 backend\venv（实际依赖环境；.venv 为过期空壳无 fastapi）
& venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
