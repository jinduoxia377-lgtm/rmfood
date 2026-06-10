# 🚀 Neo4j 图数据库完整部署指南

## 📋 部署概览

本文档提供两种方式部署 Neo4j 图数据库：
- ✅ **方式一：Docker 部署**（推荐）- 简单快速
- ✅ **方式二：直接安装** - 适合无 Docker 环境

---

## 🔧 前置要求

### 系统要求
- Windows 10/11 (64位)
- 最少 4GB RAM（推荐 8GB）
- 至少 2GB 可用磁盘空间

### 已完成的准备工作
✅ JDK 17 已下载并解压至 `D:\jdk-17.0.18+8`
✅ Neo4j Community Edition 5.15.0 已下载并解压至 `D:\neo4j`
✅ 后端配置文件模板已准备就绪

---

## 📦 方式一：Docker 部署（推荐）

### 步骤 1：安装 Docker Desktop

1. 访问 [Docker Desktop 官网](https://www.docker.com/products/docker-desktop/)
2. 下载 Windows 版本
3. 运行安装程序，按提示完成安装
4. 重启计算机
5. 启动 Docker Desktop（从开始菜单）
6. 等待 Docker 完全启动（托盘图标变为稳定状态）

### 步骤 2：使用 Docker Compose 启动 Neo4j

打开 PowerShell 或命令提示符，执行：

```bash
# 进入项目目录
cd D:\RMFOOD配方平台

# 使用 Docker Compose 启动 Neo4j
docker-compose -f docker-compose.neo4j.yml up -d

# 查看容器状态
docker ps | findstr neo4j
```

### 步骤 3：验证 Neo4j 运行状态

```bash
# 检查容器日志
docker logs rmfood-neo4j

# 测试 HTTP 接口
curl http://localhost:7474
```

### 步骤 4：首次登录配置

1. 打开浏览器访问：http://localhost:7474
2. 默认账号：`neo4j`
3. 默认密码：`neo4j`（首次登录会要求修改密码）
4. **建议修改为**：`Rmfood2024Secure!`

---

## 💻 方式二：直接安装（无需 Docker）

### 步骤 1：配置 Java 环境变量

以**管理员身份**打开 PowerShell，执行：

```powershell
# 设置 JAVA_HOME（永久生效）
[Environment]::SetEnvironmentVariable("JAVA_HOME", "D:\jdk-17.0.18+8", "Machine")

# 添加到 Path（永久生效）
$oldPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$newPath = "$oldPath;D:\jdk-17.0.18+8\bin"
[Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")

# 验证安装
$env:JAVA_HOME = "D:\jdk-17.0.18+8"
java -version
```

**重要**：设置环境变量后，**必须重启所有终端窗口**才能生效！

### 步骤 2：初始化 Neo4j 目录结构

```powershell
# 创建必要目录
New-Item -ItemType Directory -Path "D:\neo4j\logs" -Force
New-Item -ItemType Directory -Path "D:\neo4j\run" -Force
New-Item -ItemType Directory -Path "D:\neo4j\data" -Force
New-Item -ItemType Directory -Path "D:\neo4j\certificates" -Force

# 创建空日志文件（解决 Log4j 配置问题）
$logFiles = @("neo4j.log", "debug.log", "http.log", "query.log", "security.log")
foreach ($file in $logFiles) {
    New-Item -ItemType File -Path "D:\neo4j\logs\$file" -Force
}
```

### 步骤 3：修改 Neo4j 配置

编辑配置文件 `D:\neo4j\conf\neo4j.conf`，在末尾添加：

```properties
# RMFOOD 自定义配置
server.default_listen_address=0.0.0.0
dbms.security.auth_enabled=true
dbms.memory.heap.initial_size=512m
dbms.memory.heap.max_size=1G
dbms.memory.pagecache.size=256m
```

### 步骤 4：启动 Neo4j 服务

#### 方法 A：控制台模式（开发调试用）

```powershell
# 设置环境变量
$env:JAVA_HOME = "D:\jdk-17.0.18+8"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

# 进入 Neo4j 目录
cd D:\neo4j\bin

# 以控制台模式启动（显示详细日志）
.\neo4j.bat console
```

#### 方法 B：Windows 服务模式（生产环境推荐）

```powershell
# 安装为 Windows 服务
cd D:\neo4j\bin
.\neo4j.bat install-service

# 启动服务
.\neo4j.bat start

# 查看服务状态
.\neo4j.bat status

# 其他管理命令
# .\neo4j.bat stop        # 停止服务
# .\neo4j.bat restart     # 重启服务
# .\neo4j.bat uninstall   # 卸载服务
```

### 步骤 5：验证 Neo4j 启动成功

等待约 30 秒让 Neo4j 完全启动，然后：

```powershell
# 测试 HTTP 接口（浏览器访问）
Start-Process "http://localhost:7474"

# 使用 curl 测试
curl http://localhost:7474
```

看到 Neo4j 登录页面即表示启动成功！

---

## 🔗 步骤 5：配置后端连接 Neo4j

### 编辑后端 .env 文件

打开 `D:\RMFOOD配方平台\backend\.env`，添加或修改以下配置：

```ini
# ── 图数据库 (Neo4j) ───────────────────────────────────────
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=Rmfood2024Secure!
```

### 重启后端服务

```bash
# 在运行后端的终端中按 Ctrl+C 停止
# 然后重新启动
cd D:\RMFOOD配方平台\backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## ✅ 步骤 6：验证集成

### 1. 检查后端健康状态

访问：http://localhost:8000/health

预期结果中应包含：
```json
{
  "services": {
    "neo4j": "available"  // ← 应该变为 available
  }
}
```

### 2. 测试 Neo4j 连接

在 Neo4j Browser（http://localhost:7474）中执行测试查询：

```cypher
// 返回版本信息
RETURN 1 AS test;

// 创建测试节点
CREATE (:TestNode {name: 'RMFOOD', timestamp: datetime()});

// 查询刚创建的节点
MATCH (n:TestNode) RETURN n;
```

---

## 🛠️ 常见问题排查

### 问题 1：端口被占用

**错误**：`Address already in use`

**解决方案**：
```bash
# 查找占用端口的进程
netstat -ano | findstr :7474
netstat -ano | findstr :7687

# 终止进程（替换 PID）
taskkill /PID <进程ID> /F
```

### 问题 2：Java 未找到

**错误**：`Unable to determine the path to java.exe`

**解决方案**：
```bash
# 检查 JAVA_HOME
echo %JAVA_HOME%

# 检查 Java 版本
java -version

# 如果未设置，重新执行步骤 1 的环境变量配置
```

### 问题 3：内存不足

**错误**：`OutOfMemoryError: Java heap space`

**解决方案**：
编辑 `D:\neo4j\conf\neo4j.conf`，调整内存设置：
```properties
dbms.memory.heap.initial_size=256m    # 减小初始堆内存
dbms.memory.heap.max_size=512m         # 减小最大堆内存
dbms.memory.pagecache.size=128m        # 减小页面缓存
```

### 问题 4：无法写入日志文件

**错误**：`Unable to write to stream ... neo4j.log`

**解决方案**：
```powershell
# 检查目录权限
icacls D:\neo4j\logs /grant Everyone:F

# 或手动创建日志文件并赋予完全控制权限
$logFiles = @("neo4j.log", "debug.log", "http.log", "query.log", "security.log")
foreach ($file in $logFiles) {
    $path = "D:\neo4j\logs\$file"
    if (-not (Test-Path $path)) { New-Item -ItemType File -Path $path -Force }
    icacls $path /grant Everyone:F
}
```

### 问题 5：后端连接失败

**错误**：`Connection refused to bolt://localhost:7687`

**检查清单**：
1. ✅ Neo4j 是否已启动？访问 http://localhost:7474
2. ✅ Bolt 端口 7687 是否监听？`netstat -an | findstr 7687`
3. ✅ .env 配置是否正确？
4. ✅ 防火墙是否允许端口？

---

## 📊 性能优化建议

### 内存配置（根据服务器资源调整）

| 服务器内存 | heap 初始值 | heap 最大值 | 页面缓存 |
|-----------|------------|-----------|---------|
| 4 GB      | 256m       | 512m      | 128m    |
| 8 GB      | 512m       | 1G        | 256m    |
| 16 GB     | 1G         | 2G        | 512m    |
| 32 GB+    | 2G         | 4G        | 1G      |

### 生产环境安全加固

1. **修改默认密码**
   ```cypher
   // 在 Neo4j Browser 中执行
   ALTER CURRENT USER SET PASSWORD FROM 'neo4j' TO 'your-strong-password';
   ```

2. **启用 SSL/TLS**
   编辑 `neo4j.conf`：
   ```properties
   dbms.ssl.policy.bolt.enabled=true
   dbms.ssl.policy.bolt.base_directory=certificates/bolt
   dbms.ssl.policy.bolt.private_key=private.key
   dbms.ssl.policy.bolt.certificate=public.crt
   ```

3. **IP 白名单**（如需要）
   ```properties
   server.default_listen_address=0.0.0.0
   # 仅允许特定 IP 访问（取消注释并修改）
   # server.default_advertised_address=your-server-ip
   ```

---

## 🎯 下一步操作

Neo4j 部署完成后，您可以：

1. **探索 Neo4j Browser**
   - 访问 http://localhost:7474
   - 尝试示例查询和可视化功能

2. **学习 Cypher 查询语言**
   - 官方文档：https://neo4j.com/docs/cypher-manual/current/

3. **集成到项目**
   - 查看 `backend/app/services/data_sources/graph_service.py` 了解如何使用图数据
   - 开发知识图谱、关系分析等高级功能

4. **备份数据**
   ```bash
   # 导出备份
   cd D:\neo4j\bin
   .\neo4j-admin dump --database=neo4j --to=D:\backup\neo4j-backup.dump
   
   # 导入备份
   .\neo4j-admin load --from=D:\backup\neo4j-backup.dump --database=neo4j --force
   ```

---

## 📞 技术支持

如果遇到问题，请检查：

1. **日志文件位置**：`D:\neo4j\logs\`
   - `neo4j.log` - 主日志
   - `debug.log` - 调试日志
   - `http.log` - HTTP 请求日志

2. **官方文档**：https://neo4j.com/docs/

3. **社区论坛**：https://community.neo4j.com/

---

## 🎉 部署完成清单

- [ ] Java/JDK 17 安装完成
- [ ] 环境变量配置正确
- [ ] Neo4j 服务正常启动
- [ ] 可访问 http://localhost:7474
- [ ] 成功登录 Neo4j Browser
- [ ] 后端 .env 配置已更新
- [ ] 后端健康检查显示 `neo4j: available`
- [ ] 测试查询执行成功

恭喜！🎊 Neo4j 图数据库已成功部署并集成到您的项目中！

---

**最后更新时间**: 2026-05-01  
**适用版本**: Neo4j Community Edition 5.15.0 + JDK 17  
**作者**: AI Assistant
