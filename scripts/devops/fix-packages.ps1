# RMFOOD Frontend Package Fix Script
# This script installs all missing npm packages

Write-Host "=== Installing Missing npm Packages ===" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Install all missing packages using npm
$packages = @(
    "lucide-react@0.525.0",
    "zustand@5.0.5",
    "axios@1.10.0",
    "antd@6.5.1",
    "react-router-dom@7.6.1",
    "framer-motion@12.40.0",
    "recharts@2.15.3",
    "date-fns@4.1.0",
    "lodash-es@4.18.1",
    "dompurify@3.4.2",
    "fuse.js@7.3.0",
    "exceljs@4.4.0",
    "jspdf@4.2.1",
    "jspdf-autotable@5.0.7",
    "html2canvas@1.4.1",
    "qrcode@1.5.4",
    "docx@9.6.1",
    "i18next@26.2.0",
    "react-i18next@14.1.2",
    "tailwind-merge@3.3.0",
    "clsx@2.1.1",
    "three@0.160.0",
    "d3@7.9.0",
    "web-vitals@5.2.0"
)

$installed = 0
$failed = 0

foreach ($pkg in $packages) {
    $name = $pkg -replace '@.*', ''
    Write-Host "Installing $pkg..." -NoNewline -ForegroundColor Yellow

    try {
        $output = npm install $pkg --no-audit --no-fund --save 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0 -and Test-Path "node_modules\$name\package.json") {
            Write-Host " OK" -ForegroundColor Green
            $installed++
        } else {
            Write-Host " FAIL" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host " ERROR: $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Installed: $installed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) {"Red"} else {"Green"})

$count = (Get-ChildItem node_modules -Directory | Where-Object { $_.Name -notlike '.*' }).Count
Write-Host "Total packages: $count" -ForegroundColor Yellow
Write-Host ""
Write-Host "Frontend should now be working at http://localhost:3000" -ForegroundColor Green
