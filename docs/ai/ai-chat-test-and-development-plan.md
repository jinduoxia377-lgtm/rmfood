# AI 智能对话 — 测试方案 & 深度开发计划

## 第一部分：逐步测试方案

### 测试 1：后端基础链路
```bash
curl -s http://localhost:8000/health
```
期望：`{"status":"healthy"}`

### 测试 2：登录获取 Token
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```
期望：返回 `access_token`

### 测试 3：AI 对话 — 简单问题
```bash
curl -s -X POST http://localhost:8000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {TOKEN}" \
  -d '{"question":"黄芪有什么功效？"}'
```
期望：content 不为空，包含功效说明

### 测试 4：AI 对话 — 配方设计
```bash
curl -s -X POST http://localhost:8000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {TOKEN}" \
  -d '{"question":"设计一款增强免疫的固体饮料配方"}'
```
期望：6 章节完整输出，>2000 字

### 测试 5：AI 对话 — 流式 SSE
```bash
curl -s -N -X POST http://localhost:8000/api/v1/ai/chat/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {TOKEN}" \
  -d '{"question":"黄芪的功效"}' | head -20
```
期望：SSE 流式数据

### 测试 6：贝叶斯配方生成
```bash
curl -s -X POST http://localhost:8000/api/v1/ai/generate/bayesian \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {TOKEN}" \
  -d '{"target_effects":["免疫调节","抗氧化"],"count":3}'
```
期望：返回 3 个配方候选

### 测试 7：前端加载
浏览器打开 http://localhost:3000/ai，登录后检查：
- 页面无 404/500 网络错误
- 右侧 AI 思考面板显示
- 输入问题后内容完整显示

---

## 第二部分：深度开发计划

### Phase 2.1 — 多轮对话上下文增强

**目标**：使 AI 能利用对话历史，支持追问和上下文继承

**改动文件**：
- `backend/app/services/ai/chat_engine.py` — 新增 `history` 参数
- `backend/app/api/v1/ai_router.py` — 传递 `request.context` 到 chat engine

**核心代码**（chat_engine.py 新增）：
```python
if history:
    # 将历史对话插入消息序列
    history_messages = []
    for msg in history[-6:]:  # 最近 6 轮
        role = "user" if msg["role"] == "user" else "assistant"
        history_messages.append({"role": role, "content": msg["content"]})
    messages = [system_msg] + history_messages + [user_msg]
```

### Phase 2.2 — 数据库知识增强

**目标**：从 PostgreSQL 的 tcm_herbs、bioactive_peptides、kg_nodes 表检索真实数据增强回复

**改动文件**：
- `backend/app/services/ai/chat_engine.py` — 新增 `_db_augment()` 方法
- `backend/app/api/v1/ai_router.py` — 传递 `db` session

**数据流**：
```
用户问题 → 提取药材名 → 查询 tcm_herbs 表 → 获取功效/配伍数据
  → 注入 LLM 上下文 → 生成基于真实数据的回复
```

### Phase 2.3 — 流式 SSE 输出完善

**目标**：前端实时显示 AI 生成过程

**改动文件**：
- `frontend/src/components/ai/features/services/chatService.ts` — 完善 SSE 客户端
- `frontend/src/components/ai/features/hooks/useChatMessages.ts` — 流式消息处理

### Phase 2.4 — 结果质量评分

**目标**：为每条回复计算质量评分并可视化

**新增文件**：
- `backend/app/services/ai/quality_scorer.py`

```python
@dataclass
class QualityScore:
    overall: float          # 综合评分 0~100
    section_coverage: float # 章节覆盖率
    depth_score: float      # 专业深度
    evidence_score: float   # 证据充分性
```

### Phase 2.5 — 专业报告生成

**目标**：从 AI 对话内容一键生成结构化的配方报告（PDF/Markdown）

**新增文件**：
- `backend/app/services/ai/report_generator.py`

---

## 第三部分：实施路线图

```
Phase 2.1  多轮对话上下文    →  2天  ← 优先级最高
Phase 2.2  数据库知识增强    →  3天  ← 回复质量关键
Phase 2.3  流式 SSE 输出    →  2天  ← 用户体验
Phase 2.4  质量评分          →  1天  ← 可信度
Phase 2.5  报告生成          →  3天  ← 产品价值
```

## 第四部分：待办技术债务

| 问题 | 位置 | 影响 |
|------|------|------|
| 死代码未清理 | ai_router.py:732+ | 无影响但冗余 |
| `enhanced` 变量在质量检查中未使用 | chat_engine.py:199 | 增强机制未生效 |
| context 字段未传递给 LLM | ai_router.py | 历史上下文丢失 |
| ScoreCards 组件导入检查 | ChatMessages.tsx:33 | 需确认组件是否存在 |
