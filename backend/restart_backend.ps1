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
& .venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
