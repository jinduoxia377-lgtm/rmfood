@echo off
chcp 65001 >nul
echo ========================================
echo   RMFOOD Frontend Fix Script
echo ========================================
echo.

cd /d "%~dp0"

echo Step 1: Checking current state...
dir node_modules /b | find /c /v "" > nul
echo Found %errorlevel% packages in node_modules
echo.

echo Step 2: Installing missing packages from npm registry...
echo.

echo [1/36] Installing lucide-react...
npm install lucide-react@0.525.0 --no-audit --no-fund --save >nul 2>&1

echo [2/36] Installing zustand...
npm install zustand@5.0.5 --no-audit --no-fund --save >nul 2>&1

echo [3/36] Installing axios...
npm install axios@1.10.0 --no-audit --no-fund --save >nul 2>&1

echo [4/36] Installing antd...
npm install antd@6.5.1 --no-audit --no-fund --save >nul 2>&1

echo [5/36] Installing react-router-dom...
npm install react-router-dom@7.6.1 --no-audit --no-fund --save >nul 2>&1

echo [6/36] Installing framer-motion...
npm install framer-motion@12.40.0 --no-audit --no-fund --save >nul 2>&1

echo [7/36] Installing recharts...
npm install recharts@2.15.3 --no-audit --no-fund --save >nul 2>&1

echo [8/36] Installing date-fns...
npm install date-fns@4.1.0 --no-audit --no-fund --save >nul 2>&1

echo [9/36] Installing lodash-es...
npm install lodash-es@4.18.1 --no-audit --no-fund --save >nul 2>&1

echo [10/36] Installing dompurify...
npm install dompurify@3.4.2 --no-audit --no-fund --save >nul 2>&1

echo [11/36] Installing fuse.js...
npm install fuse.js@7.3.0 --no-audit --no-fund --save >nul 2>&1

echo [12/36] Installing exceljs...
npm install exceljs@4.4.0 --no-audit --no-fund --save >nul 2>&1

echo [13/36] Installing jspdf...
npm install jspdf@4.2.1 --no-audit --no-fund --save >nul 2>&1

echo [14/36] Installing jspdf-autotable...
npm install jspdf-autotable@5.0.7 --no-audit --no-fund --save >nul 2>&1

echo [15/36] Installing html2canvas...
npm install html2canvas@1.4.1 --no-audit --no-fund --save >nul 2>&1

echo [16/36] Installing qrcode...
npm install qrcode@1.5.4 --no-audit --no-fund --save >nul 2>&1

echo [17/36] Installing docx...
npm install docx@9.6.1 --no-audit --no-fund --save >nul 2>&1

echo [18/36] Installing i18next...
npm install i18next@26.2.0 --no-audit --no-fund --save >nul 2>&1

echo [19/36] Installing react-i18next...
npm install react-i18next@14.1.2 --no-audit --no-fund --save >nul 2>&1

echo [20/36] Installing tailwind-merge...
npm install tailwind-merge@3.3.0 --no-audit --no-fund --save >nul 2>&1

echo [21/36] Installing clsx...
npm install clsx@2.1.1 --no-audit --no-fund --save >nul 2>&1

echo [22/36] Installing three...
npm install three@0.160.0 --no-audit --no-fund --save >nul 2>&1

echo [23/36] Installing @react-three/fiber...
npm install @react-three/fiber@8.15.17 --no-audit --no-fund --save >nul 2>&1

echo [24/36] Installing @react-three/drei...
npm install @react-three/drei@9.92.0 --no-audit --no-fund --save >nul 2>&1

echo [25/36] Installing d3...
npm install d3@7.9.0 --no-audit --no-fund --save >nul 2>&1

echo [26/36] Installing @types/d3...
npm install @types/d3@7.4.3 --no-audit --no-fund --save >nul 2>&1

echo [27/36] Installing @dnd-kit/core...
npm install @dnd-kit/core@6.3.1 --no-audit --no-fund --save >nul 2>&1

echo [28/36] Installing @dnd-kit/sortable...
npm install @dnd-kit/sortable@10.0.0 --no-audit --no-fund --save >nul 2>&1

echo [29/36] Installing @dnd-kit/utilities...
npm install @dnd-kit/utilities@3.2.2 --no-audit --no-fund --save >nul 2>&1

echo [30/36] Installing @use-gesture/react...
npm install @use-gesture/react@10.3.1 --no-audit --no-fund --save >nul 2>&1

echo [31/36] Installing @tanstack/react-query...
npm install @tanstack/react-query@5.101.0 --no-audit --no-fund --save >nul 2>&1

echo [32/36] Installing @tanstack/react-table...
npm install @tanstack/react-table@8.21.3 --no-audit --no-fund --save >nul 2>&1

echo [33/36] Installing @tanstack/react-virtual...
npm install @tanstack/react-virtual@3.13.24 --no-audit --no-fund --save >nul 2>&1

echo [34/36] Installing @sentry/react...
npm install @sentry/react@10.66.0 --no-audit --no-fund --save >nul 2>&1

echo [35/36] Installing @sentry/tracing...
npm install @sentry/tracing@7.120.4 --no-audit --no-fund --save >nul 2>&1

echo [36/36] Installing web-vitals...
npm install web-vitals@5.2.0 --no-audit --no-fund --save >nul 2>&1

echo.
echo ========================================
echo   Verification
echo ========================================
echo.

if exist node_modules\lucide-react\package.json (
    echo [OK] lucide-react installed
) else (
    echo [FAIL] lucide-react missing
)

if exist node_modules\zustand\package.json (
    echo [OK] zustand installed
) else (
    echo [FAIL] zustand missing
)

if exist node_modules\axios\package.json (
    echo [OK] axios installed
) else (
    echo [FAIL] axios missing
)

echo.
echo ========================================
echo   Next Steps
echo ========================================
echo.
echo 1. Restart the dev server:
echo    npm run dev
echo.
echo 2. Open browser: http://localhost:3000
echo.
pause
