# OAuth2 增强认证系统 - CURL 测试命令

## 前置条件
确保后端服务运行在: http://localhost:8000

---

## 1️⃣ 用户注册（强密码）

```bash
curl -X POST "http://localhost:8000/api/v1/auth/oauth2/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "testuser@example.com",
    "password": "StrongPass123",
    "full_name": "测试用户"
  }'
```

**预期响应 (201):**
```json
{
  "message": "注册成功",
  "detail": "欢迎加入RMFOOD配方设计平台！您的账户 testuser 已创建"
}
```

---

## 2️⃣ 弱密码注册（应失败）

```bash
curl -X POST "http://localhost:8000/api/v1/auth/oauth2/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "weakuser",
    "email": "weakuser@example.com",
    "password": "123",
    "full_name": "弱密码用户"
  }'
```

**预期响应 (400):**
```json
{
  "detail": {
    "error_code": "WEAK_PASSWORD",
    "message": "密码不符合要求：至少包含一个大写字母；至少包含一个小写字母；至少包含一个数字",
    "hint": "密码需要至少8位，包含大写字母、小写字母和数字"
  }
}
```

---

## 3️⃣ 用户登录

```bash
curl -X POST "http://localhost:8000/api/v1/auth/oauth2/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "StrongPass123"
  }'
```

**预期响应 (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900
}
```

**保存返回的 Token 用于后续测试！**

---

## 4️⃣ 使用 Access Token 访问受保护资源

将 `<YOUR_ACCESS_TOKEN>` 替换为上一步获取的 token：

```bash
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

**预期响应 (200):**
```json
{
  "id": 1,
  "username": "testuser",
  "email": "testuser@example.com",
  "full_name": "测试用户",
  "role": "researcher",
  "is_active": true
}
```

---

## 5️⃣ 刷新 Token

将 `<YOUR_REFRESH_TOKEN>` 替换为登录时获取的 refresh_token：

```bash
curl -X POST "http://localhost:8000/api/v1/auth/oauth2/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "<YOUR_REFRESH_TOKEN>"
  }'
```

**预期响应 (200) - 返回新的 Token 对：**
```json
{
  "access_token": "new_access_token...",
  "refresh_token": "new_refresh_token...",
  "token_type": "bearer",
  "expires_in": 900
}
```

**注意:** 旧的 Refresh Token 会自动失效！

---

## 6️⃣ 用户登出（Token 黑名单）

同时注销 Access Token 和 Refresh Token：

```bash
curl -X POST "http://localhost:8000/api/v1/auth/oauth2/logout" \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "<YOUR_REFRESH_TOKEN>"
  }'
```

**预期响应 (200):**
```json
{
  "message": "登出成功",
  "detail": "已注销 2 个认证令牌"
}
```

---

## 7️⃣ 使用已注销的 Token 访问（应失败 - 返回401）

```bash
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer <YOUR_LOGGED_OUT_TOKEN>"
```

**预期响应 (401):**
```json
{
  "detail": "认证令牌已失效，请重新登录"
}
```

---

## 8️⃣ 错误密码登录（应失败 - 返回401）

```bash
curl -X POST "http://localhost:8000/api/v1/auth/oauth2/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "WrongPassword999"
  }'
```

**预期响应 (401):**
```json
{
  "detail": "用户名或密码错误",
  ...
}
```

---

## 9️⃣ 使用无效 Token 访问（应失败 - 返回401）

```bash
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer this.is.an.invalid.token"
```

**预期响应 (401):**
```json
{
  "detail": "认证令牌无效或格式错误"
}
```

---

## 📋 完整测试流程（一键复制）

```bash
# 配置变量
BASE="http://localhost:8000/api/v1"
AUTH="$BASE/auth/oauth2"

echo "=== 1. 注册用户 ==="
curl -s -X POST "$AUTH/register" -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@test.com","password":"Test123456","full_name":"Test"}' | jq .

echo -e "\n=== 2. 登录 ==="
LOGIN=$(curl -s -X POST "$AUTH/login" -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test123456"}')
echo $LOGIN | jq .
ACCESS_TOKEN=$(echo $LOGIN | jq -r '.access_token')
REFRESH_TOKEN=$(echo $LOGIN | jq -r '.refresh_token')

echo -e "\n=== 3. 访问受保护资源 ==="
curl -s "$BASE/auth/me" -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

echo -e "\n=== 4. 刷新Token ==="
REFRESH=$(curl -s -X POST "$AUTH/refresh" -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")
echo $REFRESH | jq .
ACCESS_TOKEN=$(echo $REFRESH | jq -r '.access_token')

echo -e "\n=== 5. 登出 ==="
curl -s -X POST "$AUTH/logout" -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" | jq .

echo -e "\n=== 6. 使用已注销Token访问（应401）==="
curl -s "$BASE/auth/me" -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

echo -e "\n✅ 测试完成！"
```

---

## 🔒 安全特性验证清单

- [x] **密码强度验证**: 最少8位 + 大小写字母 + 数字
- [x] **IP限流**: 每分钟最多10次登录尝试
- [x] **账号锁定**: 5次失败后锁定15分钟
- [x] **Token黑名单**: 登出后Token立即失效
- [x] **JWT唯一标识**: 每个Token包含jti用于追踪
- [x] **Refresh Token单次使用**: 刷新后旧Token自动失效
- [x] **多设备支持**: 默认最多5个设备同时在线
- [x] **详细错误信息**: 不泄露内部实现细节

---

## ⚠️ 常见问题排查

### Q1: 连接被拒绝 (Connection refused)
**解决方案:** 确保后端服务已启动
```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

### Q2: 429 Too Many Requests
**原因:** 触发了IP限流
**解决:** 等待60秒后重试，或修改配置 `max_login_attempts_per_ip`

### Q3: 423 Locked (账号锁定)
**原因:** 多次登录失败导致锁定
**解决:** 等待15分钟（默认），或联系管理员解锁

### Q4: Token过期但刷新也失败
**可能原因:**
- Refresh Token已被使用（单次有效）
- Refresh Token已在黑名单中
- 账号已被禁用

**解决:** 重新登录获取新的Token对

---

📝 **测试时间:** 2026-05-20  
🔧 **系统版本:** RMFOOD v1.0.0 - OAuth2增强版  
👤 **测试人员:** AI Assistant
