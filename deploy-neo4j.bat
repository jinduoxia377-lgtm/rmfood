@echo off
chcp 65001 >nul
title RMFOOD - Neo4j 图数据库部署工具
color 0A

echo ══════════════════════════════════════════════════════════════
echo   RMFOOD 配方平台 - Neo4j 图数据库部署向导
echo ══════════════════════════════════════════════════════════════
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] 请以管理员身份运行此脚本！
    pause
    exit /b 1
)

echo [步骤 1/5] 检查系统环境...
echo.

:: 检查 Docker 是否已安装
docker --version >nul 2>&1
if %errorLevel% equ 0 (
    echo [✓] Docker 已安装
    for /f "tokens=3" %%i in ('docker --version') do echo     版本: %%i
) else (
    echo [!] Docker 未检测到，将使用直接安装方式
)
echo.

echo [步骤 2/5] 选择部署方式...
echo.
echo   请选择部署方式:
echo.
echo   [1] Docker 部署（推荐） - 需要 Docker Desktop
echo   [2] 直接安装        - 下载并安装 Neo4j Community Edition
echo   [3] 取消
echo.

set /p choice="请输入选项 (1/2/3): "

if "%choice%"=="1" goto :deploy_docker
if "%choice%"=="2" goto :deploy_direct
if "%choice%"=="3" goto :end

echo [错误] 无效选项
pause
exit /b 1

:deploy_docker
echo.
echo ══════════════════════════════════════════════════════════════
echo   方式一: Docker 部署 Neo4j
echo ══════════════════════════════════════════════════════════════
echo.

:: 检查 Docker 是否运行
docker info >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] Docker 未运行！请先启动 Docker Desktop
    echo.
    echo 提示: 
    echo   1. 从开始菜单启动 "Docker Desktop"
    echo   2. 等待 Docker 完全启动（托盘图标稳定）
    echo   3. 重新运行此脚本
    pause
    exit /b 1
)

echo [信息] 正在拉取 Neo4j 镜像...
docker pull neo4j:5-community
if %errorLevel% neq 0 (
    echo [错误] 拉取镜像失败！请检查网络连接
    pause
    exit /b 1
)

echo.
echo [信息] 创建数据持久化目录...
if not exist "D:\RMFOOD配方平台\data\neo4j" mkdir "D:\RMFOOD配方平台\data\neo4j"

echo.
echo [信息] 启动 Neo4j 容器...
docker run -d ^
    --name rmfood-neo4j ^
    -p 7474:7474 ^
    -p 7687:7687 ^
    -v "D:\RMFOOD配方平台\data\neo4j:/data" ^
    -e NEO4J_AUTH=neo4j/Rmfood2024Secure! ^
    -e NEO4J_PLUGINS='["apoc"]' ^
    --restart unless-stopped ^
    neo4j:5-community

if %errorLevel% neq 0 (
    echo [错误] 容器启动失败！
    pause
    exit /b 1
)

echo.
echo [✓] Neo4j 容器已成功启动！
echo.
echo   访问地址:
echo     HTTP接口: http://localhost:7474
echo     Bolt协议: bolt://localhost:7687
echo.
echo   默认账号: neo4j
echo   默认密码: Rmfood2024Secure!
echo.
goto :configure_backend

:deploy_direct
echo.
echo ══════════════════════════════════════════════════════════════
echo   方式二: 直接安装 Neo4j Community Edition
echo ══════════════════════════════════════════════════════════════
echo.

set NEO4J_VERSION=5.15.0
set DOWNLOAD_URL=https://dist.neo4j.org/neo4j-community-%NEO4J_VERSION%-windows.zip
set INSTALL_DIR=D:\neo4j

echo [信息] Neo4j 版本: %NEO4J_VERSION%
echo [信息] 下载地址: %DOWNLOAD_URL%
echo [信息] 安装目录: %INSTALL_DIR%
echo.

:: 检查是否已安装
if exist "%INSTALL_DIR%\bin\neo4j.bat" (
    echo [!] 检测到已有 Neo4j 安装
    set /p reinstall="是否重新安装? (y/n): "
    if /i not "%reinstall%"=="y" goto :start_neo4j_service
)

echo [信息] 正在下载 Neo4j（约200MB，请耐心等待）...
echo.

:: 使用 PowerShell 下载
powershell -Command "& {
    Write-Host '正在下载 Neo4j...' -ForegroundColor Yellow
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile 'neo4j.zip'
    Write-Host '下载完成' -ForegroundColor Green
}"

if not exist neo4j.zip (
    echo [错误] 下载失败！请检查网络连接或手动下载:
    echo %DOWNLOAD_URL%
    pause
    exit /b 1
)

echo.
echo [信息] 正在解压安装...
powershell -Command "Expand-Archive -Path 'neo4j.zip' -DestinationPath 'D:\' -Force"

:: 重命名目录
if exist "%INSTALL_DIR%.old" rmdir /s /q "%INSTALL_DIR%.old"
if exist "%INSTALL_DIR%" rename "%INSTALL_DIR%" "neo4j.old"
for /d %%i in (D:\neo4j-community-*) do rename "%%i" "neo4j"

:: 清理临时文件
del neo4j.zip 2>nul
rmdir /s /q "%INSTALL_DIR%.old" 2>nul

echo.
echo [✓] Neo4j 安装完成！

:start_neo4j_service
echo.
echo [信息] 配置 Neo4j 服务...

:: 设置初始密码
set NEO4J_PASSWORD=Rmfood2024Secure!

:: 更新配置文件
set CONFIG_FILE=%INSTALL_DIR%\conf\neo4j.conf
if exist %CONFIG_FILE% (
    echo # RMFOOD 自定义配置 >> %CONFIG_FILE%
    echo server.default_listen_address=0.0.0.0 >> %CONFIG_FILE%
    echo dbms.security.auth_enabled=true >> %CONFIG_FILE%
)

echo.
echo [信息] 启动 Neo4j 服务...

:: 安装并启动服务
cd /d "%INSTALL_DIR%\bin"
call neo4j.bat install-service
call neo4j.bat start

if %errorLevel% neq 0 (
    echo [!] 服务启动可能需要几秒钟...
    timeout /t 5 /nobreak >nul
)

echo.
echo [✓] Neo4j 服务已启动！
echo.
echo   访问地址:
echo     HTTP接口: http://localhost:7474
echo     Bolt协议: bolt://localhost:7687
echo.
echo   默认账号: neo4j
echo   默认密码: %NEO4J_PASSWORD%
echo.

:configure_backend
echo ══════════════════════════════════════════════════════════════
echo [步骤 3/5] 配置后端项目连接 Neo4j
echo ══════════════════════════════════════════════════════════════
echo.

set BACKEND_DIR=D:\RMFOOD配方平台\backend
set ENV_FILE=%BACKEND_DIR%\.env

echo [信息] 更新后端 .env 配置文件...
echo.

:: 备份原有配置
if exist "%ENV_FILE%" copy "%ENV_FILE%" "%ENV_FILE%.backup" >nul

:: 创建或更新 .env 文件
(
    echo # ── 图数据库 ^(Neo4j^) ───────────────────────────────────────
    echo NEO4J_URI=bolt://localhost:7687
    echo NEO4J_USER=neo4j
    echo NEO4J_PASSWORD=Rmfood2024Secure!
) >> "%ENV_FILE%"

echo [✓] 后端配置已更新！
echo.
echo   配置内容:
echo     NEO4J_URI=bolt://localhost:7687
echo     NEO4J_USER=neo4j
echo     NEO4J_PASSWORD=Rmfood2024Secure!
echo.

echo [步骤 4/5] 验证 Neo4j 连接...
echo.

:: 等待服务完全启动
echo [信息] 等待 Neo4j 服务就绪...
timeout /t 10 /nobreak >nul

:: 测试连接
curl -s http://localhost:7474 >nul 2>&1
if %errorLevel% equ 0 (
    echo [✓] Neo4j HTTP 接口正常响应
) else (
    echo [!] Neo4j 可能还在启动中，请稍后手动验证
)

echo.
echo [步骤 5/5] 完成！
echo.

echo ══════════════════════════════════════════════════════════════
echo   🎉 Neo4j 部署完成！
echo ══════════════════════════════════════════════════════════════
echo.
echo   📍 访问地址:
echo      • Web界面: http://localhost:7474
echo      • Bolt协议: bolt://localhost:7687
echo.
echo   🔑 登录凭据:
echo      • 用户名: neo4j
echo      • 密码:   Rmfood2024Secure!
echo.
echo   📋 下一步操作:
echo      1. 打开浏览器访问 http://localhost:7474
echo      2. 使用上述账号密码登录
echo      3. 重启后端服务以激活 Neo4j 连接
echo      4. 访问 http://localhost:8000/health 验证状态
echo.
echo   💡 常用命令:
echo      • Docker方式: docker ps ^| findstr neo4j
echo      • 直接安装: D:\neo4j\bin\neo4j.bat status
echo.
echo ══════════════════════════════════════════════════════════════

:end
pause
