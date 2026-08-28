# RMFOOD Frontend Fix Script
# Run this script to fix broken node_modules

Write-Host "Step 1: Removing broken node_modules..." -ForegroundColor Cyan
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Write-Host "  node_modules removed" -ForegroundColor Green

Write-Host "Step 2: Installing dependencies from package-lock.json..." -ForegroundColor Cyan
npm install --no-audit --no-fund 2>&1
Write-Host "  Installation complete" -ForegroundColor Green

Write-Host "Step 3: Verifying critical packages..." -ForegroundColor Cyan
$checks = @(
    @{Name="rolldown"; Path="node_modules/rolldown/package.json"},
    @{Name="react"; Path="node_modules/react/package.json"},
    @{Name="react-dom"; Path="node_modules/react-dom/package.json"},
    @{Name="vite"; Path="node_modules/vite/package.json"},
    @{Name="tailwind-merge"; Path="node_modules/tailwind-merge/package.json"}
)

foreach ($check in $checks) {
    if (Test-Path $check.Path) {
        Write-Host "  OK: $($check.Name)" -ForegroundColor Green
    } else {
        Write-Host "  MISSING: $($check.Name)" -ForegroundColor Red
    }
}

Write-Host "`nFix complete! You can now start the dev server with: npm run dev" -ForegroundColor Yellow
