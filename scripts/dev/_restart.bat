@echo off
echo ========================================
echo    RMFOOD 项目重启脚本
echo ========================================

echo [1/4] 停止所有服务...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo 已停止所有服务。

echo.
echo [2/4] 启动后端服务...
start "RMFOOD Backend" cmd /c "cd /d D:\RMFOODFP\backend && .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 5 /nobreak >nul
echo 后端已启动 (http://localhost:8000)

echo.
echo [3/4] 启动前端服务...
start "RMFOOD Frontend" cmd /c "cd /d D:\RMFOODFP\frontend && npm run dev -- --host 0.0.0.0 --port 3000"
timeout /t 5 /nobreak >nul
echo 前端已启动 (http://localhost:3000)

echo.
echo [4/4] 验证服务状态...
echo.
echo 访问地址:
echo   - 前端:   http://localhost:3000
echo   - 后端:   http://localhost:8000
echo   - API文档: http://localhost:8000/docs
echo.
echo ========================================
echo    重启完成！
echo ========================================
pause
