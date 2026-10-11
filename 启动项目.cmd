@echo off
REM RMFOOD one-click start (double-clickable).
REM Wraps start.ps1 with the execution-policy bypass it needs.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
echo.
pause