@echo off
REM RMFOOD 依赖服务启动脚本

setlocal

echo =========================================
echo RMFOOD 依赖服务启动脚本
echo =========================================
echo 此脚本将尝试启动以下依赖服务：
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
    echo 将跳过容器化服务的启动
    goto skip_docker
)

echo 正在启动 Redis 服务...
docker run --name rmfood-redis -d -p 6379:6379 redis:latest
if %errorlevel% neq 0 (
    echo 警告: Redis 服务启动失败
) else (
    echo Redis 服务启动成功
)

echo 正在启动 ElasticSearch 服务...
docker run --name rmfood-elasticsearch -d -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" elasticsearch:7.17.0
if %errorlevel% neq 0 (
    echo 警告: ElasticSearch 服务启动失败
) else (
    echo ElasticSearch 服务启动成功
)

echo 正在启动 Neo4j 服务...
docker run --name rmfood-neo4j -d -p 7474:7474 -p 7687:7687 -e "NEO4J_AUTH=neo4j/%NEO4J_AUTH_PASSWORD%" neo4j:4.4
if %errorlevel% neq 0 (
    echo 警告: Neo4j 服务启动失败
) else (
    echo Neo4j 服务启动成功
)

:skip_docker

echo =========================================
echo 依赖服务启动完成

echo 服务访问地址：
echo Redis: redis://localhost:6379
 echo ElasticSearch: http://localhost:9200
echo Neo4j: http://localhost:7474 (用户名: neo4j, 密码: %NEO4J_AUTH_PASSWORD%)
echo =========================================

echo 正在更新 .env 文件，配置依赖服务连接信息...

REM 更新 .env 文件中的依赖服务配置
if exist ".env" (
    REM 备份原始 .env 文件
    copy ".env" ".env.bak" >nul 2>&1
    
    REM 更新 Redis 配置
    findstr /v "REDIS_URL" ".env" > ".env.tmp"
    echo REDIS_URL=redis://localhost:6379/0 >> ".env.tmp"
    
    REM 更新 ElasticSearch 配置
    findstr /v "ELASTICSEARCH_URL" ".env.tmp" > ".env.tmp2"
    echo ELASTICSEARCH_URL=http://localhost:9200 >> ".env.tmp2"
    
    REM 更新 Neo4j 配置
    findstr /v "NEO4J_URI" ".env.tmp2" > ".env.tmp3"
    echo NEO4J_URI=bolt://localhost:7687 >> ".env.tmp3"
    
    findstr /v "NEO4J_PASSWORD" ".env.tmp3" > ".env.tmp4"
    echo NEO4J_PASSWORD=%NEO4J_AUTH_PASSWORD% >> ".env.tmp4"
    
    REM 替换原文件
    move ".env.tmp4" ".env" >nul 2>&1
    del ".env.tmp" ".env.tmp2" ".env.tmp3" >nul 2>&1
    
    echo .env 文件更新成功
) else (
    echo 警告: .env 文件不存在
)

echo =========================================
echo 提示：
echo 1. 如果需要停止这些服务，请运行 stop_services.bat 脚本
echo 2. 如果服务启动失败，请检查 Docker 是否正在运行
echo 3. 服务启动可能需要一些时间，请耐心等待
echo =========================================

pause
endlocal