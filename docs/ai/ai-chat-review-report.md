# AI 智能对话 — 院士级审查报告

## 发现的 6 个关键问题

| # | 问题 | 位置 | 严重度 | 说明 |
|---|------|------|--------|------|
| 1 | 重复 import | `chat_engine.py:142,177` | 🟢 | `provider_factory` import 重复 |
| 2 | 增强调用 max_tokens 过大 | `chat_engine.py:204` | 🟡 | 原调用失败后用 16384 不合理 |
| 3 | 死代码 200+ 行 | `ai_router.py:732-970` | 🟡 | 旧实现未清理 |
| 4 | 正则不匹配 LLM 格式 | `EnhancedContentRenderer.tsx:21` | 🟡 | `###` 前缀未考虑 |
| 5 | 侧边栏仅 xl 显示 | `ChatSidebarV4.tsx` | 🟢 | 响应式问题 |
| 6 | 流式使用旧路径 | `chatService.ts:165` | 🟡 | API_ENDPOINTS 路径问题 |

## 修复计划

- Issue 1,2: chat_engine.py 代码优化
- Issue 3: ai_router.py 清理死代码
- Issue 4: EnhancedContentRenderer 正则增强
- Issue 6: chatService 流式端点修复
