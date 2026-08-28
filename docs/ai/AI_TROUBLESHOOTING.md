# AI 大模型集成 — 故障排查手册

> **适用版本**: RMFOOD v1.0+ | **更新日期**: 2026-06-08

---

## 快速诊断决策树

```
问题: 模型状态显示 "inactive" 或连接失败
│
├─ Step 1: 打开浏览器开发者工具 (F12) → Console
│   查找 [ERROR] WebSocket 或 AI 相关日志
│
├─ Step 2: 访问 http://localhost:8000/docs → 测试 GET /api/v1/ai/models/status
│   查看 diagnostic 字段中的三级检测结果
│
├─ Step 3: 根据检测结果定位原因
│   │
│   ├─ C-01 fail → API Key 未配置或无效
│   │   → 前端 ModelConfigPanel 或 .env 中配置
│   │
│   ├─ N-03 HTTP 401 → Key 已过期或余额不足
│   │   → 到提供商后台重新生成/充值
│   │
│   ├─ N-03 HTTP 429 → 请求频率超限
│   │   → 降低使用频率或升级套餐
│   │
│   ├─ N-01/N-02 fail → 网络不通
│   │   → 检查代理/防火墙/DNS
│   │
│   └─ P-01 fail → 模型推理异常
│       → 检查模型名是否正确
│
└─ Step 4: 使用 POST /api/v1/ai/diagnostics/run 手动触发完整诊断
```

## 错误码速查表

| 错误码 | 含义 | 用户可见消息 | 解决步骤 |
|--------|------|-------------|---------|
| `AI_LLM_AUTH_001` | API Key 格式无效 | "API Key 格式可能不正确" | 1. 重新复制完整 Key 2. 确认以 sk- 开头 |
| `AI_LLM_AUTH_002` | Key 已过期/撤销 | "API Key 已失效" | 1. 登录提供商后台 2. 重新生成 Key |
| `AI_LLM_QUOTA_001` | RPM 超限 | "请求太频繁" | 1. 等待 60s 冷却 2. 升级套餐 |
| `AI_LLM_QUOTA_002` | TPM 超限 | "Token 用量超限" | 减少 max_tokens 或降低并发 |
| `AI_LLM_QUOTA_003` | 余额不足 | "账户余额不足" | 前往提供商控制台充值 |
| `AI_LLM_NET_001` | DNS 解析失败 | "无法解析服务器地址" | 1. 检查 Base URL 2. 检查 DNS |
| `AI_LLM_NET_002` | TCP 连接超时 | "连接 AI 服务超时" | 1. 检查网络 2. 检查代理设置 |
| `AI_LLM_MODEL_001` | 模型不存在 | "模型名称有误" | 1. 使用模板库 2. 检查拼写 |
| `AI_LLM_MODEL_003` | 上下文过长 | "输入内容超出限制" | 清空对话历史或分批发送 |
| `AI_LLM_SERVER_001` | 服务端 5xx 错误 | "服务暂时不可用" | 稍后重试，通常为临时故障 |
| `AI_LLM_STREAM_001` | SSE 流中断 | "响应传输中断" | 自动重试，无需手动操作 |

## 各 Provider 配置参考

### OpenAI
- Base URL: `https://api.openai.com/v1`
- 推荐模型: `gpt-4o-mini` (性价比) / `gpt-4o` (最强)
- Key 格式: `sk-proj-...` (48+ 字符)
- 免费额度: 新用户 $5 (有效期 3 个月)
- 控制台: https://platform.openai.com/api-keys

### DeepSeek
- Base URL: `https://api.deepseek.com/v1`
- 推荐模型: `deepseek-chat` (V3) / `deepseek-reasoner` (推理)
- Key 格式: `sk-...` (40+ 字符)
- 免费额度: 注册即送 ¥500 (约 $70)
- 控制台: https://platform.deepseek.com/api_keys

### 智谱 AI (Zhipu)
- Base URL: `https://open.bigmodel.cn/api/paas/v4`
- 推荐模型: `glm-4-flash` (免费) / `glm-4-plus` (付费)
- Key 格式: 以 `.xxxxxxxxxxxxxxx` 结尾 (32+ 字符)
- 免费额度: GLM-4-Flash 免费，GLM-4-Plus 送 ¥50
- 控制台: https://open.bigmodel.cn/usercenter/apikeys

### 通义千问 (Qwen)
- Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- 推荐模型: `qwen-turbo` (快速) / `qwen-max` (强力)
- Key 格式: `sk-...` (32+ 字符)
- 免费额度: qwen-turbo 免费额度充足
- 控制台: https://dashscope.console.aliyun.com/apiKey

### Ollama 本地部署
- Base URL: `http://localhost:11434/v1`
- 安装: `winget install Ollama.Ollama` (Windows)
- 拉取模型: `ollama pull qwen2.5:7b`
- 特点: 完全离线、零成本、隐私安全

## 常见 FAQ

### Q: 配置了 API Key 但仍显示 inactive?
A: 这说明 Key 存在但实际调用失败。请访问 `/docs` 页面测试 `POST /ai/diagnostics/run`，查看三级诊断结果中 N-03 或 P-01 的具体错误信息。

### Q: 如何切换到其他 AI 提供商?
A:
1. 前端: ChatTab → 设置图标 → ModelConfigPanel → 选择 Provider → 输入对应 API Key
2. 后端: 修改 `.env` 文件中的 `LLM_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`LLM_MODEL`

### Q: 支持同时配置多个 Provider 作为备用吗?
A: 支持。系统会自动将 vLLM/Ollama 作为 Backup Provider。当主 Provider 失败时自动切换到备用链。

### Q: 如何查看 AI 调用的详细指标?
A: 访问 MonitorDashboard 组件（管理员页面）或直接调用 `GET /api/v1/ai/metrics` API。

### Q: WebSocket 连接一直报错怎么办?
A: WS 连接需要有效的 JWT Token。确保已登录且 Token 未过期。WS 错误不影响核心功能（聊天走 HTTP/SSE），可暂时忽略。
