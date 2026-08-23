@echo off
chcp 65001 >nul
echo ========================================
echo    RMFOOD 项目重启
echo ========================================

echo.
echo [1/3] 停止所有服务...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo 已停止。

echo.
echo [2/3] 启动后端 (端口 8000)...
start "RMFOOD Backend" cmd /c "cd /d D:\RMFOODFP\backend && .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 6 /nobreak >nul

echo.
echo [3/3] 启动前端 (端口 3000)...
start "RMFOOD Frontend" cmd /c "cd /d D:\RMFOODFP\frontend && npm run dev -- --host 0.0.0.0 --port 3000"
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo    重启完成！
echo ========================================
echo 访问地址:
echo   - 前端:   http://localhost:3000
echo   - 后端:   http://localhost:8000
echo   - API文档: http://localhost:8000/docs
echo.
