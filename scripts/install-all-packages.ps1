# RMFOOD Frontend Package Fix Script
# Run this script to install all missing npm packages

Write-Host "=== Installing Missing npm Packages ===" -ForegroundColor Cyan
Write-Host ""

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
    $dest = Join-Path "node_modules" $name

    if (Test-Path "$dest/package.json") {
        Write-Host "  [SKIP] $name (already installed)" -ForegroundColor Gray
        continue
    }

    try {
        Write-Host "  [INSTALL] $pkg ..." -ForegroundColor Yellow
        $output = npm install $pkg --no-audit --no-fund --save 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) {
            if (Test-Path "$dest/package.json") {
                Write-Host "  [OK] $name" -ForegroundColor Green
                $installed++
            } else {
                Write-Host "  [FAIL] $name (installed but not found)" -ForegroundColor Red
                $failed++
            }
        } else {
            Write-Host "  [FAIL] $name: npm exit code $LASTEXITCODE" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "  [ERROR] $name : $_" -ForegroundColor Red
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
