@echo off
taskkill /F /IM python.exe 2>nul
taskkill /F /IM node.exe 2>nul
timeout /t 3 >nul
echo All processes killed
pause
