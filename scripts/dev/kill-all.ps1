powershell -ExecutionPolicy Bypass -Command "Stop-Process -Name python,node -Force -ErrorAction SilentlyContinue; Write-Host 'killed'"
