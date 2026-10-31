# 对话输出截断根因专项审查报告

- **审查对象**：RMFOOD `/ai` 智能对话输出截断问题（max_tokens 链路 / Provider 上限 / 前端渲染 / 历史恢复）
- **审查方式**：只读代码审查 + 数据库只读查询 + LLM 直连实测
- **审查人**：QA 验证工程师（qa-phase4）
- **关联任务**：task-36（专项审查：对话输出截断根因）
- **审查日期**：2026-10-25
- **总体结论**：**P0 根因已定位并修复：数据库持久化旧值 max_tokens=4096 覆盖代码默认 16000，导致 LLM 每次输出上限 4096 tokens，专业配方设计卡超长即被截断**。Lead 已先后修复两处数据库存储：①`ai_model_configs` 表 7 条记录已全部改为 16000；②`SystemConfig("llm_runtime_config")`（主对话路径实际读取）已由 4096 改为 16000（config_value 为 JSON 字符串，用 Python 解析后写回）。**当前数据库两处均已为 16000**，**需重启后端 8000 进程后生效**。前端渲染与历史恢复**未发现截断**。Provider（agnes-3.0-flash）实测接受 max_tokens=16000。

---

## 1. max_tokens 配置链路核查（重点）

### 1.1 配置来源与优先级

代码路径（`backend/app/services/llm_service.py`）：

1. **LLMService 初始化优先级**（L322-342）：显式参数 > 数据库持久化（`load_config_from_db`）> settings 环境变量。
2. **数据库持久化加载**（`load_config_from_db`，L213-251）：从 `SystemConfig` 表读取键 `llm_runtime_config`，其中 `max_tokens=v.get("max_tokens", 16000)`（L242）——**若数据库存了旧值，直接覆盖代码默认 16000**。
3. **settings 默认值**（`backend/app/core/config.py` L405）：`AIServiceConfig.max_tokens: int = Field(default=16000, ge=1, le=100000)`。
4. **环境变量/代码 fallback**（`_build_config_from_settings`，L467-471）：`AI_MAX_TOKENS` → `settings.ai_max_tokens` → `ai_service.max_tokens` → **16000**。
5. **请求构造最终取值**（`_build_payload`，L667-671）：`"max_tokens": self.config.max_tokens`——`self.config.max_tokens` 即最终生效值。

### 1.2 数据库实测（P0 证据）

只读查询本地 PostgreSQL `rmfood` 库：

| 存储位置 | 修复前 | 修复后（Lead 两轮 UPDATE 后复查） |
|---|---|---|
| `ai_model_configs` 表（7 条记录：llm/formula_gpt/synergy_net/safety_checker/taste_predictor/stability_model/peptide_scorer） | 全部 **4096** | 全部 **16000** ✅ |
| `SystemConfig("llm_runtime_config")`（主对话路径实际读取） | **4096** | **16000** ✅（Lead 用 Python 解析 JSON 字符串后写回） |

实测输出（修复后复查）：

```
llm_runtime_config: {"provider": "openai", "model": "agnes-3.0-flash", "max_tokens": 16000, "temperature": 0.7}
ai_model_configs 记录数: 7
  - id=3 formula_gpt  ... max_tokens=16000
  - id=4 synergy_net  ... max_tokens=16000
  ...
  - id=1 llm        ... max_tokens=16000
```

### 1.3 主路径最终取值逻辑

- 主对话路径：`chat.py` 的 `/chat` 与 `/chat/stream` 直接调用 `llm_service.chat / chat_stream` → `_build_payload` → `"max_tokens": self.config.max_tokens`。
- `self.config` 来自 `load_config_from_db()`（SystemConfig `llm_runtime_config`），修复后该值为 **16000**。
- **重启后端 8000 进程后**，`LLMService` 重新从数据库加载配置，主对话路径实际请求 max_tokens=16000，截断问题解除。
- `ai_model_config_service.get_config`（L348-366）从 `ai_model_configs` 表读取 `max_tokens=record.max_tokens`，修复后返回 **16000** ✅——该服务是「前端兼容」的配置管理 API，与 chat 主路径共用同一目标值。

---

## 2. Provider 实际输出上限核查

### 2.1 Provider 配置

- Provider：`openai` 兼容格式，`base_url=https://apihub.agnes-ai.com/v1`，`model=agnes-3.0-flash`（`.env` + 数据库 `llm_runtime_config` 一致）。
- 数据库持久化的 max_tokens 旧值 4096 是**配置层限制**，并非 Provider 硬上限的证据。

### 2.2 直连实测（临时覆盖 max_tokens=16000）

```
is_available: True
provider: openai model: agnes-3.0-flash
max_tokens(临时覆盖): 16000 原值: 4096
OK content_len: 46 model: agnes-3.0-flash
content_preview: 药食同源指某些食物与药物来源相同，既能食用又具有预防或治疗疾病功效，体现了中医"食疗"理念。
```

- ✅ Provider **接受 max_tokens=16000 参数**，未报错、未 429（本次探测未触发限流）。
- 说明 agnes-3.0-flash 至少允许请求 16000 max_tokens；此前用户看到的截断主因是**数据库 4096 旧值**而非 Provider 上限。

---

## 3. 前端渲染截断核查

| 检查项 | 结论 | 证据 |
|---|---|---|
| MessageBubble 是否裁剪消息内容 | 无 line-clamp / max-height / 字数截断；结构化内容优先走 `StructuredMessageRenderer`，非结构化走 MarkdownRenderer | `MessageBubble.tsx` L336-344、L407-414 |
| StructuredMessageRenderer 是否裁切长 blocks | 无 max-height/overflow 截断；`DataTableBlock` 长表格支持响应式横向滚动（overflow-x-auto） | `DataTableBlock.tsx` L171 |
| TypewriterText 打字机 | 内容 >800 字符**自动跳过动画**直接渲染完整内容；支持点击跳过；动画完成渲染全文 | `TypewriterText.tsx` L50-54、L58-67、L112-118 |
| 消息区容器 | flex-1 overflow-y-auto（滚动而非截断） | `ChatTab.tsx` L457 |

结论：✅ **前端渲染无截断**。打字机不会导致长内容「看似未完成」。

---

## 4. 历史消息恢复截断核查

| 检查项 | 结论 | 证据 |
|---|---|---|
| IndexedDB 保存 | 消息 `content` 完整写入，无长度截断 | `ChatStorageService.ts` L252 `content: m.content` |
| 云端同步 | `syncToServer` 上传完整消息 content | `ChatStorageService.ts` L318、L359 |
| 恢复读取 | 完整 content 回填 | `ChatStorageService.ts` L312-318 |
| 仅有的 slice | 会话**标题**/预览截断（`slice(0,30)` / `slice(0,50)`），不影响消息正文 | `ChatStorageService.ts` L384-386 |

结论：✅ **历史消息恢复无截断**（仅会话标题/预览截断，属正常 UI 行为）。

---

## 5. 结论：截断根因

**最可能的截断根因（P0）：数据库持久化旧值 `max_tokens=4096` 覆盖了代码默认 16000。**

- 主对话路径 `llm_service.config.max_tokens` 来自 `SystemConfig("llm_runtime_config")`，当前值为 **4096**；
- 专业配方设计卡（辨证分析 + 配方组成六列 + 性味归经/功效成分/机理 + 服用周期 + SOP + 参考文献）输出常超过 4096 tokens；
- 因此 LLM 在输出约 4096 tokens 后被 Provider 截断，用户看到「只输出一部分就结束」。
- 前端渲染与历史恢复无截断，Provider 接受 16000。

---

## 6. 问题清单

| 级别 | 问题 | 证据 | 状态 |
|---|---|---|---|
| **P0-1** | 数据库持久化旧值 `max_tokens=4096` 覆盖 16000，主对话路径实际请求 max_tokens=4096，专业配方卡超长被截断 | `llm_service.py` L237-245（load_config_from_db 读取旧值）、L322-342（数据库优先）、L667-671（payload 使用 config.max_tokens）；数据库实测修复前 `llm_runtime_config.max_tokens=4096` | **已修复**（两处数据库均已改为 16000） |
| **P0-2** | 修复遗漏：`ai_model_configs` 表先改为 16000，但主对话路径读取的 `SystemConfig("llm_runtime_config")` 最初未更新 | 数据库复查过程记录：`llm_runtime_config` 曾仍为 4096 | **已补充修复**（Lead 用 Python 解析 JSON 字符串写回为 16000） |
| P1-1 | `ai_model_configs` 表的 `server_default=4096` 与代码默认 16000 不一致，未来新建记录可能再次写入 4096 | `ai_model_config_service.py` L34 默认 16000 vs 表结构 server_default 4096（Lead 已确认） | 待处理：建议修改表默认值为 16000 |
| P2-1 | 配置管理页（ai_model_configs）与聊天主路径（llm_runtime_config）双份配置，易出现不一致 | 两处存储并存 | 建议统一配置源或启动时同步 |

---

## 7. 修复建议（Lead 已执行，剩重启生效）

1. ✅ **已执行**：`ai_model_configs` 表 7 条记录 `max_tokens` 4096 → **16000**（Lead UPDATE）。
2. ✅ **已执行**：`SystemConfig("llm_runtime_config")` `max_tokens` 4096 → **16000**（config_value 为 JSON 字符串，`jsonb_set` 不支持 text 类型，Lead 用 Python 解析后写回）。
3. ⏳ **待执行：重启后端 8000 进程**，使 `LLMService` 重新从数据库加载配置，主对话路径实际请求 max_tokens=16000。
4. 可选：修改 `ai_model_configs` 表 `max_tokens` 列默认值为 16000，避免新建记录再次写入 4096。
5. 可选：统一 `SystemConfig("llm_runtime_config")` 与 `ai_model_configs` 的配置来源，消除双份配置漂移。

---

## 8. 验证环境

- 工作目录：`D:\RMFOODFP`
- 数据库：本地 PostgreSQL `rmfood`（`postgresql+asyncpg://localhost:5432/rmfood`），只读查询
- LLM 直连：`llm_service.chat` 临时覆盖 `max_tokens=16000`，不打印密钥、不修改数据库
- 前端代码审查：`MessageBubble.tsx` / `StructuredMessageRenderer` / `TypewriterText.tsx` / `ChatStorageService.ts`