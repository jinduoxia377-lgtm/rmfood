@echo off
REM RMFOOD 后端服务停止脚本

setlocal

REM 查找并停止 uvicorn 进程
echo 正在查找并停止 RMFOOD 后端服务...

for /f "tokens=2" %%i in ('tasklist /fi "imagename eq python.exe" /fo list /v ^| findstr "uvicorn"') do (
    echo 停止进程 ID: %%i
    taskkill /PID %%i /F
    if %errorlevel% equ 0 (
        echo 服务已成功停止
    ) else (
        echo 停止服务失败
    )
)

echo 操作完成
pause

endlocal