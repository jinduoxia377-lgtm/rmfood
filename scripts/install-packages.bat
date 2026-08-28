@echo off
echo === Installing missing npm packages ===
echo.

:: Install all missing packages
npm install lucide-react --no-audit --no-fund 2>nul
npm install zustand --no-audit --no-fund 2>nul
npm install axios --no-audit --no-fund 2>nul
npm install antd --no-audit --no-fund 2>nul
npm install react-router-dom --no-audit --no-fund 2>nul
npm install framer-motion --no-audit --no-fund 2>nul
npm install recharts --no-audit --no-fund 2>nul
npm install date-fns --no-audit --no-fund 2>nul
npm install lodash-es --no-audit --no-fund 2>nul
npm install dompurify --no-audit --no-fund 2>nul
npm install fuse.js --no-audit --no-fund 2>nul
npm install exceljs --no-audit --no-fund 2>nul
npm install jspdf --no-audit --no-fund 2>nul
npm install jspdf-autotable --no-audit --no-fund 2>nul
npm install html2canvas --no-audit --no-fund 2>nul
npm install qrcode --no-audit --no-fund 2>nul
npm install docx --no-audit --no-fund 2>nul
npm install i18next --no-audit --no-fund 2>nul
npm install react-i18next --no-audit --no-fund 2>nul
npm install tailwind-merge --no-audit --no-fund 2>nul
npm install clsx --no-audit --no-fund 2>nul
npm install three --no-audit --no-fund 2>nul
npm install @react-three/fiber --no-audit --no-fund 2>nul
npm install @react-three/drei --no-audit --no-fund 2>nul
npm install d3 --no-audit --no-fund 2>nul
npm install @types/d3 --no-audit --no-fund 2>nul
npm install @dnd-kit/core --no-audit --no-fund 2>nul
npm install @dnd-kit/sortable --no-audit --no-fund 2>nul
npm install @dnd-kit/utilities --no-audit --no-fund 2>nul
npm install @use-gesture/react --no-audit --no-fund 2>nul
npm install @tanstack/react-query --no-audit --no-fund 2>nul
npm install @tanstack/react-table --no-audit --no-fund 2>nul
npm install @tanstack/react-virtual --no-audit --no-fund 2>nul
npm install @sentry/react --no-audit --no-fund 2>nul
npm install @sentry/tracing --no-audit --no-fund 2>nul
npm install web-vitals --no-audit --no-fund 2>nul
npm install @ant-design/icons --no-audit --no-fund 2>nul

echo.
echo === Verification ===
if exist node_modules\lucide-react\package.json (
    echo lucide-react: OK
) else (
    echo lucide-react: MISSING
)
if exist node_modules\zustand\package.json (
    echo zustand: OK
) else (
    echo zustand: MISSING
)

echo.
echo Done! Run: npm run dev
pause
