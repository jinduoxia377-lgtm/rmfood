cd D:\RMFOODFP\frontend
$proc = Start-Process -FilePath "node" -ArgumentList "node_modules/vite/bin/vite.js --port 3000" -WorkingDirectory "D:\RMFOODFP\frontend" -PassThru -NoNewWindow
Write-Host "Started PID: $($proc.Id)"
Start-Sleep -Seconds 8
if ($proc.HasExited) {
    Write-Host "Process exited with code: $($proc.ExitCode)"
} else {
    Write-Host "Process still running after 8s"
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 3 -UseBasicParsing
        Write-Host "Port 3000: $($r.StatusCode)"
    } catch {
        Write-Host "Port 3000: no response"
    }
    Stop-Process -Id $proc.Id -Force
}
