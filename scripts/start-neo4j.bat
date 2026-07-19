@echo off
chcp 65001 >nul
title Neo4j 快速启动工具
color 0B

echo ══════════════════════════════════════════════════════════════
echo   RMFOOD - Neo4j 图数据库快速启动工具
echo ══════════════════════════════════════════════════════════════
echo.

:: 设置 Java 环境
set JAVA_HOME=D:\jdk-17.0.18+8
set PATH=%JAVA_HOME%\bin;%PATH%

:: 验证 Java
java -version >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] Java 未找到！请先运行完整部署脚本
    pause
    exit /b 1
)

echo [✓] Java 环境就绪: 
java -version 2>&1 | findstr "version"
echo.

:: 进入 Neo4j 目录
cd /d D:\neo4j\bin

:: 检查 Neo4j 是否已运行
tasklist | findstr /i "java.exe" >nul 2>&1
if %errorLevel% equ 0 (
    echo [信息] 检测到 Neo4j 可能正在运行...
    set /p action="是否重启? (y/n): "
    if /i "%action%"=="y" (
        call neo4j.bat stop
        timeout /t 3 /nobreak >nul
    ) else (
        goto :open_browser
    )
)

echo.
echo [信息] 启动 Neo4j 图数据库...
echo.
echo   📍 访问地址:
echo     • Web界面: http://localhost:7474
echo     • Bolt协议: bolt://localhost:7687
echo.
echo   🔑 登录凭据:
echo     • 用户名: neo4j
echo     • 密码:   Rmfood2024Secure!
echo.
echo   按 Ctrl+C 停止服务
echo ══════════════════════════════════════════════════════════════
echo.

:: 启动 Neo4j（控制台模式）
call neo4j.bat console

:open_browser
echo.
echo [信息] 正在打开浏览器...
start http://localhost:7474

pause
