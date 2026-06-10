# AI 智能对话模块升级实施计划

> **For agentic workers:** 使用 inline execution 方式实施

**Goal:** 修复前端 ChatTab 调用后端 API 的 404 错误，新增缺失的 AI 聊天端点

**Architecture:** 后端新增 3 个端点桥接到现有 generation service；前端修复 auth token 获取

**Tech Stack:** FastAPI (backend), React (frontend), SSE streaming

---

### Task 1: 新增 POST /api/v1/ai/chat 端点

**Files:** Modify `backend/app/api/v1/ai_router.py`

在 ai_router.py 末尾新增 chat 端点，桥接到现有的 `_handle_prompt_generation`

### Task 2: 新增 POST /api/v1/ai/chat/stream 流式端点

**Files:** Modify `backend/app/api/v1/ai_router.py`

在 ai_router.py 末尾新增流式 chat 端点，复用 `/generate/stream` 逻辑

### Task 3: 新增 GET /api/v1/ai/models/status 端点

**Files:** Modify `backend/app/api/v1/ai_router.py`

在 ai_router.py 末尾新增模型状态端点

### Task 4: 修复前端 chatService Auth Token 获取

**Files:** Modify `frontend/src/components/ai/features/services/chatService.ts`

修复 `getAuthToken()` 方法，确保从 auth store 正确获取 token
