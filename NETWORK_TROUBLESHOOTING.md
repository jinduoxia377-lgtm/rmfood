# 🔧 RMFOOD 配方平台 - 局域网访问故障排查指南

## 问题诊断

### 症状：同一局域网中的其他设备无法访问

**原因分析**：
1. ❌ 后端未在外部接口监听（只在 127.0.0.1:8000）
2. ⚠️ 防火墙阻止外部访问
3. ⚠️ 前端 API 地址配置错误
4. ⚠️ 网络隔离或 VLAN 问题

---

## ✅ 已修复的问题

### 问题 1：后端只监听本地接口

**症状**：`netstat` 显示 `127.0.0.1:8000` 而非 `0.0.0.0:8000`

**原因**：后端启动参数 `--host` 不正确

**解决方案**：
```bash
# 正确的启动命令
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**验证**：
```bash
# 应该看到 0.0.0.0:8000 LISTENING
netstat -ano | findstr ":8000"
```

✅ **状态**：已修复 - 后端现在在 0.0.0.0:8000 监听

---

## 📊 当前网络配置检查

### 前端服务
```
✅ 正在监听：0.0.0.0:3001
✅ 所有网络接口可访问
✅ IP 地址：192.168.137.1, 172.28.128.1, 172.31.80.1, 172.20.3.122
```

### 后端服务
```
✅ 正在监听：0.0.0.0:8000
✅ 所有网络接口可访问
✅ 支持外部连接
```

---

## 🔍 故障排查步骤

### 步骤 1：验证服务运行

```bash
# 检查前端端口
netstat -ano | findstr ":3001"
# 应该看到：TCP    0.0.0.0:3001    LISTENING

# 检查后端端口
netstat -ano | findstr ":8000"
# 应该看到：TCP    0.0.0.0:8000    LISTENING
```

### 步骤 2：验证网络连接

**在同一局域网的其他设备上**：

```bash
# Windows PowerShell
Test-NetConnection -ComputerName 192.168.137.1 -Port 3001
Test-NetConnection -ComputerName 192.168.137.1 -Port 8000

# Linux/Mac
nc -zv 192.168.137.1 3001
nc -zv 192.168.137.1 8000

# 或 ping
ping 192.168.137.1
```

### 步骤 3：检查防火墙

**Windows 防火墙**：
```powershell
# 允许前端
netsh advfirewall firewall add rule name="RMFOOD Frontend" dir=in action=allow protocol=tcp localport=3001 profile=private

# 允许后端
netsh advfirewall firewall add rule name="RMFOOD Backend" dir=in action=allow protocol=tcp localport=8000 profile=private
```

**Linux 防火墙**：
```bash
sudo ufw allow 3001/tcp
sudo ufw allow 8000/tcp
```

### 步骤 4：直接访问 API

**在浏览器中测试**：

```
http://192.168.137.1:8000/api/v1
http://192.168.137.1:8000/health
http://192.168.137.1:8000/docs
```

**使用 curl 测试**：

```bash
curl http://192.168.137.1:8000/api/v1
curl http://192.168.137.1:8000/health
```

### 步骤 5：检查前端 API 配置

**查看浏览器控制台**（F12）：

```javascript
// 在控制台输入
fetch('http://192.168.137.1:8000/api/v1')
  .then(r => r.json())
  .then(d => console.log('✅ API 连接成功:', d))
  .catch(e => console.error('❌ API 连接失败:', e))
```

---

## 🛡️ 防火墙配置

### Windows Defender 防火墙

**打开防火墙规则管理**：

1. 按 Win+X，选择"Windows Defender 防火墙"
2. 点击"允许应用通过防火墙"
3. 点击"更改设置"
4. 点击"允许另一个应用"
5. 添加 Python 和 Node.js

**或使用命令**：

```powershell
# 允许所有应用通过 3001 端口（开发环境）
New-NetFirewallRule -DisplayName "RMFOOD Frontend" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001

# 允许所有应用通过 8000 端口（开发环境）
New-NetFirewallRule -DisplayName "RMFOOD Backend" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000

# 验证规则
Get-NetFirewallRule -DisplayName "RMFOOD*"

# 删除规则
Remove-NetFirewallRule -DisplayName "RMFOOD Backend"
```

### 其他防火墙

- **McAfee/Norton**：添加例外
- **Kaspersky**：允许应用访问网络
- **公司代理**：请联系 IT 部门

---

## 🌐 网络诊断

### 检查本机 IP

```bash
# Windows
ipconfig | findstr "IPv4"

# Linux/Mac
ifconfig | grep "inet "
# 或
ip addr show
```

**预期的主要 IP**：`192.168.137.1`

### 检查其他设备可达性

```bash
# 在其他设备上 ping 主机
ping 192.168.137.1

# 或使用 nslookup
nslookup 192.168.137.1
```

### 检查路由

```bash
# Windows
route print

# Linux/Mac
netstat -rn
```

---

## 📱 移动设备访问

### iOS/iPad

1. 确保手机和电脑在同一 WiFi
2. 打开 Safari
3. 输入：`http://192.168.137.1:3001`
4. 等待加载

### Android

1. 确保手机和电脑在同一 WiFi
2. 打开 Chrome/Firefox
3. 输入：`http://192.168.137.1:3001`
4. 等待加载

### 其他设备

- 平板电脑：与手机相同
- Smart TV：需要支持浏览器
- 其他电脑：直接访问即可

---

## 🔧 高级诊断

### 检查 DNS

```bash
# Windows
nslookup localhost
ipconfig /all

# Linux/Mac
nslookup localhost
cat /etc/resolv.conf
```

### 检查路由和网关

```bash
# Windows
ipconfig /all
route print default

# Linux
ip route show
route -n

# Mac
netstat -rn
```

### 检查 MTU

```bash
# Windows
netsh interface ipv4 show subinterfaces
```

---

## 💻 常见错误信息

### 错误 1：连接被拒绝

```
错误：无法连接到 192.168.137.1:8000
原因：后端未在 0.0.0.0 监听，只在 127.0.0.1
解决：重启后端时使用 --host 0.0.0.0
```

### 错误 2：连接超时

```
错误：请求超时
原因：防火墙阻止或网络不可达
解决：检查防火墙规则或网络连接
```

### 错误 3：CORS 错误

```
错误：Cross-Origin Request Blocked
原因：CORS 未正确配置
解决：检查 .env 中的 CORS_ORIGINS
```

### 错误 4：DNS 解析失败

```
错误：无法解析域名
原因：DNS 配置问题
解决：直接使用 IP 地址而非域名
```

---

## ✅ 快速验证清单

在访问前，逐项检查：

- [ ] 后端在 `0.0.0.0:8000` 监听
- [ ] 前端在 `0.0.0.0:3001` 监听
- [ ] 数据库运行中
- [ ] 防火墙允许 3001 和 8000 端口
- [ ] 其他设备能 ping 到 `192.168.137.1`
- [ ] 浏览器能访问 `http://192.168.137.1:3001`
- [ ] 浏览器能访问 `http://192.168.137.1:8000/api/v1`

---

## 🚀 重新启动服务

### 快速重启所有服务

```bash
# 1. 停止所有服务
stop-lan.bat

# 2. 等待 5 秒
timeout /t 5

# 3. 重新启动
start-lan.bat

# 4. 等待 10 秒
timeout /t 10

# 5. 访问
# http://192.168.137.1:3001
```

### 单独重启后端

```bash
# 1. 查找 Python 进程 ID
netstat -ano | findstr ":8000"

# 2. 停止进程（替换 PID）
taskkill /F /PID <PID>

# 3. 重启后端
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 📞 还是不行？

### 完整诊断命令

```powershell
# 运行此脚本获取完整诊断信息
Write-Host "=== RMFOOD 网络诊断 ===" -ForegroundColor Green
Write-Host ""

# 检查 IP
Write-Host "本机 IP:" -ForegroundColor Yellow
ipconfig | findstr "IPv4"

Write-Host ""
Write-Host "端口状态:" -ForegroundColor Yellow
netstat -ano | findstr ":3001"
netstat -ano | findstr ":8000"

Write-Host ""
Write-Host "进程状态:" -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -match "python|node"}

Write-Host ""
Write-Host "防火墙规则:" -ForegroundColor Yellow
Get-NetFirewallRule -DisplayName "RMFOOD*" | Select-Object DisplayName, Enabled

Write-Host ""
Write-Host "测试连接:" -ForegroundColor Yellow
Test-NetConnection -ComputerName 192.168.137.1 -Port 3001 | Select-Object ComputerName, RemotePort, TcpTestSucceeded
Test-NetConnection -ComputerName 192.168.137.1 -Port 8000 | Select-Object ComputerName, RemotePort, TcpTestSucceeded
```

---

## 📚 更多帮助

- **LAN_DEPLOYMENT.md** - 详细部署指南
- **QUICK_START.md** - 快速启动指南
- **DEPLOYMENT_SUMMARY.md** - 完整总结

---

**仍需帮助？** 请提供：
1. 错误信息的完整文本
2. `netstat -ano | findstr ":3001"` 和 `:8000` 的输出
3. 浏览器控制台（F12）的错误日志
4. 尝试过的解决方案

---

**更新时间**：2024-06-18  
**状态**：✅ 已修复 - 后端现在支持外部访问
