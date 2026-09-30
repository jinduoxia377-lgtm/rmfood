# 后端服务启动报告

> 时间: 2026-09-21  
> 状态: ✅ 已启动

---

## 一、问题诊断

### 1.1 错误原因

```
获取配方列表失败
```

**根本原因**: 后端服务未启动

### 1.2 日志分析

```
【startup_stderr.log】
ERROR: [Errno 10048] error while attempting to bind on address ('0.0.0.0', 8000)
        [winerror 10048] 通常每个套接字地址只允许使用一次

【error.log】
ModuleNotFoundError: No module named 'click'
```

**问题1**: 端口8000被占用（之前启动的后端进程未清理）  
**问题2**: uvicorn缺少click依赖

---

## 二、解决方案

### 2.1 清理残留进程

```powershell
# 杀掉所有Python进程
Get-Process python | Stop-Process -Force

# 清理端口
netstat -ano | Select-String ":8000.*LISTENING"
taskkill /F /PID <PID>
```

### 2.2 安装依赖

```powershell
# 安装缺失的依赖
python -m pip install uvicorn click --quiet
```

### 2.3 启动后端

```powershell
# 启动命令
cd D:\RMFOODFP\backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 三、验证结果

```
✅ 健康检查: HTTP 200
✅ 配方API: HTTP 200
✅ 配方数量: 12
```

---

## 四、一键启动脚本

项目已提供启动脚本 `start.ps1`，可直接使用：

```powershell
cd D:\RMFOODFP
.\start.ps1
```

这将自动：
1. 清理端口3000和8000
2. 检查依赖
3. 启动后端（端口8000）
4. 启动前端（端口3000）
5. 验证服务就绪

---

## 五、常用命令

| 操作 | 命令 |
|:-----|:-----|
| 启动所有服务 | `.\start.ps1` |
| 停止所有服务 | `.\stop.ps1` |
| 仅启动后端 | `cd backend && .\venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --reload` |
| 检查后端状态 | `Invoke-WebRequest http://localhost:8000/api/v1/health` |
| 查看API文档 | `http://localhost:8000/docs` |

---

## 六、后端API端点

| 端点 | 说明 |
|:-----|:-----|
| `/api/v1/health` | 健康检查 |
| `/api/v1/formulas` | 配方列表 |
| `/api/v1/herbs` | 药材列表 |
| `/api/v1/compliance` | 合规标准 |
| `/docs` | Swagger API文档 |
| `/redoc` | ReDoc API文档 |

---

> **修复完成时间**: 2026-09-21  
> **报告版本**: v1.0
