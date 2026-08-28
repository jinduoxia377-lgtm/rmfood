@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: RMFOOD OpenFoodFacts 数据导入 - Windows 一键实施程序
:: 此脚本将自动设置环境、验证配置、执行 Dry-run 并提供最终指令
:: ============================================================================

echo ============================================================================
echo   🚀 RMFOOD 数据导入 - Windows 一键实施程序
echo ============================================================================
echo.

:: 获取脚本所在目录（scripts 文件夹）
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 设置 Python 编码以避免中文乱码
chcp 65001 >nul

:: ================================================
:: 步骤 1: 检查并生成 SECRET_KEY（如果缺失）
:: ================================================
echo [1/5] 检查环境配置...

:: 检查是否已存在 SECRET_KEY 环境变量
if defined SECRET_KEY (
    set /a len=!SECRET_KEY!
    if !len! GEQ 32 (
        echo   ✅ SECRET_KEY 已设置 (长度: %len%)
    ) else (
        echo   ⚠️  SECRET_KEY 过短 (%len% 字符)，正在生成新密钥...
        python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))" > temp_key.txt
        for /f "tokens=2 delims==" %%k in (temp_key.txt) do set NEW_SECRET=%%k
        set SECRET_KEY=!NEW_SECRET!
        echo   ✅ 已生成新 SECRET_KEY (长度: !NEW_SECRET!.:)=!)
        del temp_key.txt
    )
) else (
    echo   ⚠️  SECRET_KEY 未找到，正在生成...
    python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))" > temp_key.txt
    for /f "tokens=2 delims==" %%k in (temp_key.txt) do set NEW_SECRET=%%k
    set SECRET_KEY=!NEW_SECRET!
    echo   ✅ 已生成新 SECRET_KEY
    del temp_key.txt
)

:: 设置其他必要环境变量
set ENV=development
set DEBUG=False
set LOG_LEVEL=INFO
set ADMIN_USERNAME=admin_import
set ADMIN_PASSWORD=
set DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/rmfood

echo   ENV=%ENV%
echo   SECRET_KEY 长度: %SECRET_KEY%.:=
echo   DATABASE_URL=%DATABASE_URL%
echo.

:: ================================================
:: 步骤 2: 运行 Dry-run 扫描
:: ================================================
echo [2/5] 执行 CSV 文件扫描 (Dry-run)...

python final_import_implementer.py --dry-run

if %errorlevel% neq 0 (
    echo ❌ Dry-run 失败！
    pause
    exit /b 1
)
echo.

:: ================================================
:: 步骤 3: 显示小批量测试选项
:: ================================================
echo [3/5] 准备小规模测试导入...

choice /C YT /N /M "是否立即执行小规模测试导入 (5000行)? (Y/N)"
if %errorlevel% equ 1 (
    echo   用户选择跳过小规模测试
) else (
    echo   正在执行小规模测试导入 (5000行，安全模式)...
    cd /d "%SCRIPT_DIR%\..\backend"
    python scripts\import_openfoodfacts_csv.py ^
      --csv "%SCRIPT_DIR%\..\openfoodfacts\en.openfoodfacts.org.products.csv" ^
      --test-limit 5000 ^
      --no-drop-index

    if %errorlevel% neq 0 (
        echo ❌ 小规模测试导入失败！
        pause
        exit /b 1
    )
    echo   小规模测试导入成功！
)
echo.

:: ================================================
:: 步骤 4: 显示最终操作指南
:: ================================================
echo [4/5] 生成最终操作指南...

echo ============================================================================
echo 📋 最终实施指南 - 请保存或打印此页面
echo ============================================================================
echo.
echo 1. 验证导入结果 (在 psql 中执行):
echo    SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts_csv';
echo.
echo 2. 全量正式导入 (首次运行使用安全模式):
echo    cd D:\RMFOOD配方平台\backend
echo    python scripts\import_openfoodfacts_csv.py ^
echo      --csv "D:\RMFOOD配方平台\openfoodfacts\en.openfoodfacts.org.products.csv" ^
echo      --no-drop-index
echo.
echo 3. 后续加速导入 (DROP/RECREATE 唯一索引):
echo    python scripts\import_openfoodfacts_csv.py ^
echo      --csv "D:\RMFOOD配方平台\openfoodfacts\en.openfoodfacts.org.products.csv" ^
echo      --drop-index
echo.
echo 4. 前端 API 测试:
echo    http://localhost:8000/docs
echo.
echo ============================================================================
echo   ✅ 实施准备完成！请按上述指南继续。
echo ============================================================================
echo.

:: 保存关键配置信息到文件
echo 当前配置环境变量 > config_info.txt
echo SECRET_KEY=%SECRET_KEY% >> config_info.txt
echo DATABASE_URL=%DATABASE_URL% >> config_info.txt
echo ENV=%ENV% >> config_info.txt
echo 配置文件位置: %SCRIPT_DIR%\config_info.txt
echo.

endlocal
pause
