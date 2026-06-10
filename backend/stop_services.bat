@echo off
REM RMFOOD 依赖服务停止脚本

setlocal

echo =========================================
echo RMFOOD 依赖服务停止脚本
echo =========================================
echo 此脚本将停止并删除以下依赖服务容器：
echo 1. Redis 缓存服务
 echo 2. ElasticSearch 搜索引擎
 echo 3. Neo4j 图数据库
echo =========================================

REM 检查是否以管理员身份运行
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 请以管理员身份运行此脚本
    pause
    exit /b 1
)

REM 检查 Docker 是否安装
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 警告: Docker 未安装或未添加到环境变量
    echo 将跳过容器化服务的停止
    goto end
)

echo 正在停止 Redis 服务...
docker stop rmfood-redis >nul 2>&1
docker rm rmfood-redis >nul 2>&1
if %errorlevel% neq 0 (
    echo 警告: Redis 服务停止失败或不存在
) else (
    echo Redis 服务停止成功
)

echo 正在停止 ElasticSearch 服务...
docker stop rmfood-elasticsearch >nul 2>&1
docker rm rmfood-elasticsearch >nul 2>&1
if %errorlevel% neq 0 (
    echo 警告: ElasticSearch 服务停止失败或不存在
) else (
    echo ElasticSearch 服务停止成功
)

echo 正在停止 Neo4j 服务...
docker stop rmfood-neo4j >nul 2>&1
docker rm rmfood-neo4j >nul 2>&1
if %errorlevel% neq 0 (
    echo 警告: Neo4j 服务停止失败或不存在
) else (
    echo Neo4j 服务停止成功
)

:end
echo =========================================
echo 依赖服务停止完成

echo 提示：
echo 1. 如果需要重新启动这些服务，请运行 start_services.bat 脚本
 echo 2. 服务停止后，相关数据将被删除（因为使用的是临时容器）
echo =========================================

pause
endlocal