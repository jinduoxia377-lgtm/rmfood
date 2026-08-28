@echo off
setlocal enabledelayedexpansion

:: RMFOOD 数据导入实施脚本
:: 功能：验证配置环境并准备导入流程

echo ========================================
echo RMFOOD 数据导入 - 实施准备脚本
echo ========================================

:: 检查 Python 是否可用
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Python 未找到，请确保 Python 已添加到 PATH
    pause
    exit /b 1
)

echo Python: python --version
python --version
echo.

:: 设置工作目录
cd /d %~dp0\..\backend
set BACKEND_DIR=%cd%
echo 后端目录: %BACKEND_DIR%
echo.

:: 加载 .env 环境变量
for /f "tokens=1,* delims==" %%a in ('delimitby^= type ..\.env ^| findstr /v "^$" ^| findstr /v "^:"') do (
    set line=%%a
    set line=!line:* =%!
    if not "!line!"=="" (
        set key=!line: =!
        set value=%%b
        echo 设置环境变量: !key!=!value!
        setx !key! !value! /M >nul 2>&1
    )
)

echo.
echo 环境变量已加载
echo SECRET_KEY 长度: %ERRORLEVEL% (此处不显示实际值出于安全考虑)
echo.

:: 执行验证脚本
echo 正在执行环境验证...
cd /d %~dp0\..\scripts
python verify_env.py || (
    echo 验证失败，请检查配置
    pause
    exit /b 1
)

echo.
echo ========================================
echo 环境验证通过！准备就绪。
echo 下一步：运行正式导入脚本
echo   cd backend
echo   python scripts/import_openfoodfacts_csv.py [选项]
echo ========================================

pause
