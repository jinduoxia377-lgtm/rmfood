# AI 对话框架修复实施计划 - Phase 1

> 基于 ADR-029 的详细实施指南  
> 优先级: P0 紧急修复  
> 预计工期: 1-2 周

---

## 任务清单

### 任务 1: 统一后端 AI API 入口

**目标**: 消除双入口混乱，建立清晰的路由层

#### 1.1 创建统一 API 控制器

**新建文件**: `backend/app/api/v1/controllers/ai_controller.py`

```python
"""
AI 对话控制器 - 统一入口
"""
import logging
from typing import AsyncIterator
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...services.ai.orchestration.chat_engine import get_chat_engine
from ...services.ai.shared.inference_queue import inference_queue
from ...models import User
from ...api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["AI"])


class ChatRequest(BaseModel):
    question: str
    history: list = []
    scenario_mode: str = "standard"


class ChatResponse(BaseModel):
    content: str
    model: str
    thinking_steps: list
    formulas: list


@router.post("/chat")
async def chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """非流式对话接口"""
    engine = get_chat_engine()
    result = await engine.chat(req.question, req.history)
    return ChatResponse(
        content=result.content,
        model=result.model,
        thinking_steps=result.thinking_steps,
        formulas=result.formulas,
    )


@router.post("/chat/stream")
async def chat_stream(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """流式对话接口"""
    engine = get_chat_engine()
    return await engine.chat_stream(req.question, req.history)


@router.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok", "service": "ai-chat"}
```

#### 1.2 更新主路由注册

**修改文件**: `backend/app/api/v1/__init__.py`

```python
# 移除旧的分散导入
# from ..ai import router as ai_router

# 添加新的统一导入
from .controllers.ai_controller import router as ai_router
```

#### 1.3 清理旧入口文件

```bash
# 标记为废弃（保留但添加弃用警告）
# backend/app/services/ai/conversation_service/main.py
# backend/app/services/ai/main.py
```

**验收标准**:
- [ ] `GET /api/v1/ai/health` 返回 200
- [ ] `POST /api/v1/ai/chat` 正常工作
- [ ] `POST /api/v1/ai/chat/stream` 正常工作
- [ ] 旧入口文件已标记为废弃

---

### 任务 2: 统一 SSE 事件格式

**目标**: 消除前后端思考步骤不同步问题

#### 2.1 定义标准事件协议

**新建文件**: `backend/app/services/ai/orchestration/sse_events.py`

```python
"""
SSE 事件标准协议
"""
from enum import Enum
from typing import Any, Optional
import json


class SSEEventType(str, Enum):
    THINKING_STEP = "thinking_step"
    CONTENT = "content"
    FORMULA = "formula"
    DONE = "done"
    ERROR = "error"


class SSEEvent:
    def __init__(
        self,
        event_type: SSEEventType,
        data: Any,
        id: Optional[str] = None,
    ):
        self.event_type = event_type
        self.data = data
        self.id = id
    
    def format(self) -> str:
        """格式化为 SSE 行"""
        lines = []
        if self.id:
            lines.append(f"id: {self.id}")
        lines.append(f"event: {self.event_type.value}")
        lines.append(f"data: {json.dumps(self.data, ensure_ascii=False)}")
        lines.append("")  # 空行分隔
        return "\n".join(lines)
    
    def __str__(self):
        return self.format()


# 便捷构造函数
def thinking_step_event(step: str, content: str, status: str = "processing"):
    return SSEEvent(
        SSEEventType.THINKING_STEP,
        {"step": step, "content": content, "status": status},
    )


def content_event(content: str):
    return SSEEvent(SSEEventType.CONTENT, {"content": content})


def formula_event(name: str, value: float, unit: str = "分"):
    return SSEEvent(
        SSEEventType.FORMULA,
        {"name": name, "value": value, "unit": unit},
    )


def done_event():
    return SSEEvent(SSEEventType.DONE, {})


def error_event(message: str):
    return SSEEvent(
        SSEEventType.ERROR,
        {"message": message},
    )
```

#### 2.2 重构 chat_engine.py 使用标准事件

**修改文件**: `backend/app/services/ai/orchestration/chat_engine.py`

```python
# 导入新的事件协议
from .sse_events import (
    SSEEventType, SSEEvent,
    thinking_step_event, content_event,
    formula_event, done_event, error_event,
)

class AcademicianChatEngine:
    async def chat_stream(
        self, 
        question: str, 
        history: list = None
    ) -> AsyncIterator[str]:
        """流式对话 - 使用标准 SSE 事件"""
        
        # Step 1: 思考步骤
        yield str(thinking_step_event(
            "问题理解", 
            f"解析用户输入，长度: {len(question)}字符",
            "processing"
        ))
        
        # Step 2: LLM 调用
        try:
            content = await self._call_llm(question, history)
            
            # 发送思考步骤完成
            yield str(thinking_step_event(
                "知识检索", 
                "检索药食同源知识库",
                "completed"
            ))
            
            # 流式发送内容
            yield str(content_event(""))  # 开始内容流
            
            # 逐字发送（或按句发送）
            for i in range(0, len(content), 50):
                chunk = content[i:i+50]
                yield str(content_event(chunk))
            
            yield str(done_event())
            
        except Exception as e:
            yield str(error_event(str(e)))
```

#### 2.3 更新前端事件处理

**修改文件**: `frontend/src/components/ai/features/services/chatService.ts`

```typescript
// 移除 fallback 映射逻辑
// 原代码:
// const eventType = currentEventType || (parsed.type === "text" ? "content" : parsed.type === "thinking" ? "step" : parsed.type);

// 新代码: 直接使用 event: 前缀
for (const line of lines) {
  if (line.startsWith('event:')) {
    currentEventType = line.slice(6).trim();
    continue;
  }
  if (line.startsWith('data:')) {
    const data = JSON.parse(line.slice(5).trim());
    
    switch (currentEventType) {
      case 'thinking_step':
        yield { type: 'step', step: data.step, content: data.content, status: data.status };
        break;
      case 'content':
        yield { type: 'content', content: data.content };
        break;
      case 'formula':
        yield { type: 'formula', formula: { name: data.name, value: data.value } };
        break;
      case 'done':
        yield { type: 'done' };
        return;
      case 'error':
        throw new Error(data.message);
    }
  }
}
```

#### 2.4 移除前端本地模拟

**修改文件**: `frontend/src/components/ai/features/hooks/useThinkingProcessV3.ts`

```typescript
// 移除 startThinking 中的本地模拟逻辑
// 原代码:
// await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 250))

// 新实现: 仅用于降级场景（无后端思考步骤时）
const startThinking = useCallback(async (question: string): Promise<void> => {
  // 检查是否有后端思考步骤支持
  // 如果没有，才使用本地模拟作为降级
  const hasBackendSupport = await checkBackendThinkingSupport()
  
  if (!hasBackendSupport) {
    // 降级：本地模拟
    logger.warn('[ThinkingProcessV3] 后端思考步骤不支持，使用本地模拟')
    await this._simulateThinkingLocally(question)
  }
  // 否则等待后端 SSE 事件
}, [])
```

**验收标准**:
- [ ] SSE 事件格式统一为 `event: <type>` + `data: <json>`
- [ ] 前端无需 fallback 映射
- [ ] 思考步骤只显示一次（后端真实数据）
- [ ] 端到端测试通过

---

### 任务 3: 系统提示词配置化

**目标**: 支持热加载和动态切换

#### 3.1 创建提示词配置文件

**新建文件**: `conf/prompts/default.yaml`

```yaml
# AI 对话系统提示词配置
# 支持热加载，修改后无需重启服务

system_prompts:
  academician: |
    你是一位拥有30年药食同源功能性食品研发经验的院士级专家，中国科学院院士，博士生导师。

    ## 学术背景
    - 北京中医药大学客座教授
    - 中国食品科学技术学会常务理事
    - 《中国食品学报》编委
    - 主持国家级功能性食品研发项目20余项
    - 发表SCI论文150余篇，引用5000余次

    ## 核心回答原则
    1. 【绝对安全】所有建议必须在药食同源目录安全剂量范围内
    2. 【专业严谨】引用具体数据、科学研究和法规条文
    3. 【完整详尽】每个回答覆盖全部相关维度
    4. 【结构清晰】使用专业Markdown排版

    ... (完整提示词)
  
  junior_consultant: |
    你是一位专业的药食同源顾问，专注于为用户提供科学、实用的配方建议。
    
    ## 回答原则
    1. 语言通俗易懂，避免过多专业术语
    2. 提供具体可操作的建议
    3. 强调安全性和适用人群

    ... (完整提示词)

scenarios:
  formula_design: academician
  safety_check: academician
  general_qa: junior_consultant
  peptide_analysis: academician
  compliance_review: academician

version: "1.0"
last_updated: "2026-09-21"
```

#### 3.2 实现提示词服务

**新建文件**: `backend/app/services/ai/prompt_service.py`

```python
"""
提示词服务 - 支持热加载
"""
import logging
import hashlib
import time
from pathlib import Path
from typing import Optional, Dict
import yaml

logger = logging.getLogger(__name__)

class PromptService:
    def __init__(self, config_path: str = "conf/prompts/default.yaml"):
        self.config_path = Path(config_path)
        self._prompts: Dict[str, str] = {}
        self._scenario_map: Dict[str, str] = {}
        self._last_modified = 0
        self._load_config()
    
    def _load_config(self):
        """加载配置文件"""
        if not self.config_path.exists():
            logger.error(f"Prompt config not found: {self.config_path}")
            return
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        self._prompts = config.get('system_prompts', {})
        self._scenario_map = config.get('scenarios', {})
        self._last_modified = self.config_path.stat().st_mtime
        
        logger.info(f"Loaded {len(self._prompts)} system prompts")
    
    def _check_reload(self):
        """检查是否需要重新加载"""
        try:
            current_modified = self.config_path.stat().st_mtime
            if current_modified != self._last_modified:
                logger.info("Prompt config changed, reloading...")
                self._load_config()
        except Exception as e:
            logger.warning(f"Failed to check prompt config: {e}")
    
    def get_prompt(self, prompt_key: str) -> Optional[str]:
        """获取指定提示词"""
        self._check_reload()
        return self._prompts.get(prompt_key)
    
    def get_scenario_prompt(self, scenario: str) -> str:
        """根据场景获取提示词（自动 fallback）"""
        self._check_reload()
        prompt_key = self._scenario_map.get(scenario, 'academician')
        return self._prompts.get(prompt_key, self._prompts.get('academician', ''))
    
    def list_prompts(self) -> list:
        """列出所有可用提示词"""
        return list(self._prompts.keys())
    
    def list_scenarios(self) -> dict:
        """列出所有场景映射"""
        return dict(self._scenario_map)


# 全局单例
_prompt_service: Optional[PromptService] = None

def get_prompt_service() -> PromptService:
    global _prompt_service
    if _prompt_service is None:
        _prompt_service = PromptService()
    return _prompt_service
```

#### 3.3 更新 chat_engine.py 使用提示词服务

```python
# backend/app/services/ai/orchestration/chat_engine.py

from ...prompt_service import get_prompt_service

class AcademicianChatEngine:
    async def chat(self, question: str, history: list = None) -> ChatResult:
        # 获取场景提示词
        prompt_service = get_prompt_service()
        system_prompt = prompt_service.get_scenario_prompt('formula_design')
        
        messages = [{"role": "system", "content": system_prompt}]
        # ... 其余逻辑
```

**验收标准**:
- [ ] 修改 `conf/prompts/default.yaml` 后，下次请求自动生效
- [ ] `GET /api/v1/ai/prompts` 返回可用提示词列表
- [ ] 场景映射正常工作

---

## 四、测试计划

### 4.1 单元测试

```bash
# 后端测试
cd backend
python -m pytest tests/test_ai_controller.py -v
python -m pytest tests/test_prompt_service.py -v
python -m pytest tests/test_sse_events.py -v

# 前端测试
cd frontend
pnpm test -- src/components/ai/features/__tests__/
```

### 4.2 集成测试

```bash
# 启动服务
./start.ps1

# 测试 API
curl -X POST http://localhost:8000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "帮我设计一款降血糖的配方"}'

# 测试流式接口
curl -X POST http://localhost:8000/api/v1/ai/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "帮我设计一款降血糖的配方"}'
```

### 4.3 E2E 测试

访问 `http://localhost:3000/ai`，验证：
- [ ] 对话正常发送和接收
- [ ] 思考步骤正确显示（无重复）
- [ ] 错误提示正常显示
- [ ] 会话切换正常

---

## 五、回滚方案

如果修复导致线上故障：

1. **快速回滚**: 恢复 git tag `v1.0.0-ai-fix` 之前的代码
2. **Feature Flag**: 通过环境变量 `AI_CHAT_V2=false` 禁用新功能
3. **监控告警**: 设置错误率 > 5% 时自动回滚

---

## 六、文档更新

修复完成后，更新以下文档：
- [ ] `README.md` - API 接口说明
- [ ] `docs/adr/index.md` - 添加 ADR-029
- [ ] `frontend/src/components/ai/features/README.md` - 架构说明

---

**维护者**: RMFOOD AI Team  
**审查日期**: 2026-09-21
