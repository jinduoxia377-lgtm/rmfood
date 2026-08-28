# Frontend Package Fix Script
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
    "@react-three/fiber@8.15.17",
    "@react-three/drei@9.92.0",
    "d3@7.9.0",
    "@types/d3@7.4.3",
    "@dnd-kit/core@6.3.1",
    "@dnd-kit/sortable@10.0.0",
    "@dnd-kit/utilities@3.2.2",
    "@use-gesture/react@10.3.1",
    "@tanstack/react-query@5.101.0",
    "@tanstack/react-table@8.21.3",
    "@tanstack/react-virtual@3.13.24",
    "@sentry/react@10.66.0",
    "@sentry/tracing@7.120.4",
    "web-vitals@5.2.0",
    "@ant-design/icons@6.3.2"
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
        npm install $pkg --no-audit --no-fund 2>&1 | Out-Null

        if (Test-Path "$dest/package.json") {
            Write-Host "  [OK] $name" -ForegroundColor Green
            $installed++
        } else {
            Write-Host "  [FAIL] $name" -ForegroundColor Red
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
Write-Host "To start the dev server:" -ForegroundColor Cyan
Write-Host "  npm run dev"
