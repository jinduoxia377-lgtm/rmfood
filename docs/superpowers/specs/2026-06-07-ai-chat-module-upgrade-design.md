# AI 智能对话模块升级设计文档

## 问题分析
前端 ChatTab 调用 `POST /api/v1/ai/chat` 和 `GET /api/v1/ai/models/status`，但后端仅存在 `/api/v1/ai/generate` 路由，导致 404 错误。

## 方案：后端新增路由 + 前端适配

### 后端变更
1. **新增 `POST /api/v1/ai/chat`** — 桥接到现有 `generate` 逻辑
2. **新增 `POST /api/v1/ai/chat/stream`** — SSE 流式对话
3. **新增 `GET /api/v1/ai/models/status`** — 模型状态

### 前端变更
1. 修复 chatService token 获取
2. 增强错误处理

### 不变内容
- 不修改现有 ChatTab 组件结构
- 不修改现有 `useChatMessages` / `useChatSendMessage` hooks
- 不修改 Pro 组件
