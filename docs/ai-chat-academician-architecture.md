# AI 智能对话院士级深度架构文档

## 当前系统状态 (Phase 1 已完成)

### AcademicianChatEngine 核心链路

```
用户输入 → ChatTab → useChatSendMessage → chatService.sendMessage()
  ↓
POST /api/v1/ai/chat → ai_router.py → AcademicianChatEngine.chat()
  ↓
├─ 院士级系统提示词 (1166字, 6章节结构)
├─ 直接 LLM 调用 (bypass AIGenerationService)
├─ 三级 Token 降级 (8192→4096→2048)
├─ 质量检查 + 自动扩展 (min_response_length=800)
├─ 贝叶斯配方优化 (配方问题自动触发)
├─ 内容完整性补全 (安全/法规/服用/禁忌)
└─ 终极保底回复 (所有链路失败保障)
  ↓
ChatResponse { content, formulas, thinking_steps }
  ↓
前端: MarkdownRenderer + EnhancedContentRenderer + ChatSidebarV4
├─ EnhancedRoleCards: 君臣佐使角色
├─ EnhancedRatioChart: 功效成分占比
├─ EnhancedFeatureCards: 配方特色总结
└─ ChatSidebarV4: 算法标签 + 置信度进度条
```

## Phase 2 深度开发规划

### 1. 多轮对话上下文整合

当前问题：每次对话独立，不携带历史上下文
```python
# 计划: chat_engine.py 接收 history 参数
class ChatRequest(BaseModel):
    question: str
    context: Optional[str] = None  # 现有字段
    history: Optional[List[Dict]] = None  # 新增: 对话历史
```

### 2. 数据库知识增强

当前降级使用内置 20 种药材知识库
计划：连接 PostgreSQL 中的 TCMSP/DFBP 数据

```python
async def _augment_with_db(self, question: str, db_session) -> str:
    """从数据库检索相关知识增强回复"""
    # 查询 tcm_herbs 表 → 匹配药材
    # 查询 bioactive_peptides 表 → 匹配肽
    # 查询 kg_nodes/kg_edges → 图谱推理
```

### 3. 流式 SSE 输出

当前 `/chat/stream` 端点已注册但前端 chatService 未完整实现
计划：前端完善流式渲染

### 4. 结果质量评分体系

```python
@dataclass
class QualityMetrics:
    content_length: int
    section_coverage: float  # 6章节覆盖率 0~1
    response_time_ms: int
    confidence_score: float
```

### 5. 专业报告生成

从对话内容提取结构化数据生成专业报告：
- 配方设计方案卡
- 安全评估摘要
- 参考文献列表

## 技术债务与优化项

| 项 | 优先级 | 说明 |
|----|--------|------|
| enhanced_question 未使用 context 字段 | 中 | 来自前端的历史上下文未传递给 LLM |
| provider_factory 导入路径 | 低 | 已修复 `...core.config` |
| chatService 流式实现 | 低 | fetch 方式可增强为 EventSource |
| ChatSidebarV4 响应式 | 低 | 仅 xl 屏幕显示 |
