@echo off
setlocal enabledelayedexpansion

:: RMFOOD OpenFoodFacts 数据导入 - 调试版
:: 执行过程会保持窗口打开，便于查看错误信息

cd /d %~dp0
chcp 65001 >nul

echo ============================================================================
echo   🚀 RMFOOD 数据导入 - 调试版本
echo ============================================================================
echo.

:: 运行 Python 包装器
python import_debug_wrapper.py

:: 强制保持窗口打开
if %errorlevel% neq 0 (
    echo ❌ 发生错误，错误码: %errorlevel%
) else (
    echo ✅ 完成！
)

echo.
echo =============================
echo 操作完成，按任意键关闭
echo =============================
pause

endlocal
