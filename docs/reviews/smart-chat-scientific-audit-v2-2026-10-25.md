# 智能对话功能模块 — 科学性与专业性深度核查报告（第二次）

**核查日期：** 2026-10-25  
**核查范围：** 全链路（后端提示词 → LLM 调用 → 安全过滤 → 前端渲染）  
**前置说明：** 第一轮核查发现的 P0 级问题（绝对安全用语、主路径无安全过滤、剂量无校验）已**部分修复**。本报告基于修复后的代码状态重新核查，聚焦**仍存在的严重问题**。

---

## 修复情况确认 ✅

| 问题 | 状态 | 备注 |
|------|------|------|
| 「绝对安全」绝对化用语 | ✅ 已修复 | `chat_engine.py:43` 改为「【安全优先】」；`default.yaml:93` 同步修改 |
| 目录数量过时（110→114） | ✅ 已修复 | `chat_engine.py:30,35` 已更新为"2023版114种" |
| 主路径无 `check_output()` | ✅ 已修复 | 非流式 `chat.py:647-656`、流式 `chat.py:905-930` 均已集成 |
| 剂量预校验（单味药） | ✅ 已修复 | `_append_dosage_warnings()` 已实现，超标时追加红色警示 |
| 强制免责声明 | ✅ 已修复 | `default.yaml:94` 已添加「本建议仅供参考，不能替代专业医师诊断」 |
| 幻觉检测（编造数据） | ✅ 已修复 | `default.yaml:71` 已添加「严禁编造数据」指令 |

---

## 🔴 P0 — 阻塞级问题（仍需修复）

### 问题 1：输出安全检查不覆盖幻觉性内容（核心风险）

**位置：** `backend/app/services/ai/safety/output_filter.py`  
**现象：** `check_output()` 仅检测以下四类风险：

```python
# output_filter.py 中的检测规则
_SENSITIVE_PATTERNS = [
    (r"(?i)(api[_-]?key|access[_-]?token|...)", "api_key", ...),   # API Key
    (r"\d{11}", "phone", ...),                                      # 手机号
    (r"(?i)[\w.+-]+@[\w-]+\.[\w.-]+", "email", ...),               # 邮箱
    (r"\d{17}[\dXx]", "id_card", ...),                              # 身份证号
]
_SENSITIVE_KEYWORDS = [
    ("密码", ...), ("密钥", ...), ("内部系统", ...),
]  # 敏感关键词
```

**未发现：** 针对以下医疗AI幻觉场景的检测规则：
- **虚构文献/DOI**（如"根据《中国药典》2025年版，黄芪多糖...，DOI:10.1234/huangqi"）
- **虚假临床数据**（如"临床研究显示有效率达98%"）
- **不当医疗替代声明**（如"本品可替代降压药物治疗高血压"）

**测试结果（实际验证）：**
```
输入："根据《中国药典》2025年版，黄芪多糖对免疫调节有效，DOI:10.1234/huangqi"
→ risk=low, is_safe=True, findings=[]   ← 未被拦截！

输入："建议每日服用黄芪50g以达到最佳疗效"
→ 超出 _COMMON_HERB_DOSAGE["黄芪"]=(9,30) 上限，被 _append_dosage_warnings 警告
  但 check_output 本身不检测此问题
```

**科学影响：**
- LLM 可自由输出看似权威的虚构引用，`check_output()` 完全无法识别
- 用户（研发人员）可能将虚假文献作为参考来源，造成学术误导
- 与 agent 工作流中 `react_chain.py:150` 使用同一 `check_output()` 函数，但该函数本身就不具备幻觉检测能力

**建议修复：**
在 `output_filter.py` 中增加医疗幻觉检测规则：
```python
# 新增：虚构文献/DOI 检测
(r"(?i)DOI:\s*\d+\.\d{4,}/", "hallucinated_doi", "hallucination", 0.7),
(r"(?i)(中国药典|中华医学)\s*.*\s*\d{4}年版.*?(显示|证实|表明)", "hallucinated_ref", "hallucination", 0.6),

# 新增：医疗替代声明检测
(r"(?i)(替代|代替|取代).*?(药物|药品|处方药|治疗)", "medical_claim", "medical_safety", 0.9),
(r"(?i)(可治愈|根治|康复).*?(糖尿病|高血压|癌症)", "medical_claim", "medical_safety", 0.95),
```
同时在 `chat.py` 中，当 `check_output` 检测到医疗类高风险时，追加警示 Callout。

---

### 问题 2：总剂量无聚合校验（跨成分累积风险）

**位置：** `backend/app/api/ai_modules/chat.py:253-340`（`_append_dosage_warnings`）  
**现象：** 剂量预校验仅检查**单味药**是否超出各自安全上限：

```python
# chat.py:331-338
safe_dose = _COMMON_HERB_DOSAGE.get(herb)
if safe_dose is None:
    continue
min_g, max_g = safe_dose
if max_g is not None and dosage > max_g:
    warnings.append(f"> ⚠️ **剂量警示**：{herb} {dosage:g}g 超出常规安全上限...")
```

**未发现：** 以下风险场景无任何检测：
1. **总剂量超限**：10味药各用15g，总重150g/天，远超合理日用量
2. **配伍毒性叠加**：多味寒凉药叠加（如大量菊花+金银花+蒲公英），产生寒性损伤
3. **功效拮抗**：补气药（人参）与泄气药（薤白）同用，药效相互抵消

**科学影响：**
- 单味药安全 ≠ 复方安全。中医"君臣佐使"配伍理论的核心就是整体安全性
- 用户可能在对话中看到"每味药都在安全范围内"的配方，但总剂量不合理
- `_COMMON_HERB_DOSAGE` 字典仅覆盖46味药材，其余68味（114-46）无安全数据，LLM 输出的其他药材剂量完全无校验

---

### 问题 3：药材剂量数据库严重不足（46/114，覆盖率40%）

**位置：** `backend/app/api/ai_modules/chat.py:253-270`（`_COMMON_HERB_DOSAGE`）  
**现象：** 内置安全剂量表仅覆盖46味药材，而2023版药食同源目录共114种：

```python
_COMMON_HERB_DOSAGE = {
    "黄芪": (9, 30), "当归": (6, 12), "人参": (3, 9), ...  # 仅46味
}
```

**未覆盖的常见药材（示例）：**
- 西洋参、红参、太子参（人参变种，剂量不同）
- 山茱萸、女贞子、旱莲草（补益类）
- 莲子心、淡竹叶、木贼（清热类）
- 酸枣仁（已覆盖）、远志（未覆盖）

**科学影响：**
- LLM 输出这68味药材的任何剂量时，`_append_dosage_warnings` 均返回空结果（`safe_dose is None → continue`）
- 用户看到的"无警告"不代表"安全"，只是"未知"
- 建议在启动时从 `conf/prompts/default.yaml` 或其他权威源加载完整剂量表，而非硬编码

---

## 🟡 P1 — 严重问题

### 问题 4：YAML 中"严禁编造数据"指令无法被 LLM 可靠执行

**位置：** `backend/conf/prompts/default.yaml:71`  
**现象：**
```
- 【格式】优先使用上面的 "blocks" 结构；如信息不足，允许在字段中使用「待补充/需进一步验证」占位，严禁编造数据
```

**问题分析：**
- 该指令依赖 LLM 自我约束，无后端强制校验
- 当前 `check_output()` 不检测虚构数据（见问题1）
- 当 LLM 需要填充 `nature_flavor`（性味归经）或 `mechanism`（作用机理）字段时，若无确切知识，仍可能编造

**建议：**
- 在 `detectStructuredContent()` 中增加字段完整性校验：若 `mechanism` 字段包含明显编造特征（如随机 DOI），标记为需验证
- 或在 `_build_system_prompt()` 中增加："若知识库中无某成分的性味归经/机理数据，该字段填「待考证」，禁止推测"

---

### 问题 5：结构化输出 JSON schema 缺少剂量单位约束

**位置：** `backend/conf/prompts/default.yaml:40-65`（blocks schema）  
**现象：** `data-table` 的 `dosage` 字段定义：
```json
{"key": "dosage", "label": "用量(g)"}
```
类型说明为字符串（如"10"），但：
- 无格式约束（可以是"10"、"10g"、"十克"、"10-15"）
- 无单位归一化（g/kg/mg 混用）
- 前端 `parseDosage()` 仅提取数字，不处理单位转换

**科学影响：**
- LLM 可能输出"黄芪 0.01kg"（=10g，正确但格式异常）
- LLM 可能输出"黄芪 10000mg"（=10g，但超出剂量表上限显示逻辑）
- 剂量校验 `_append_dosage_warnings` 的正则仅匹配"g"后缀，"mg/kg"等变体无法识别

**建议：**
- 在 schema 中明确 dosage 格式为 `"^\\d+(?:\\.\\d+)?g$"`
- 在前端解析时增加单位归一化（mg→g÷1000，kg→g×1000）
- 在后端校验时扩展正则，覆盖多种单位

---

### 问题 6：辨证分析（dialectics）未接入用户画像增强

**位置：** `backend/app/api/ai_modules/chat.py:698-701`  
**现象：**
```python
try:
    from ...services.ai.dialectics_service import analyze_dialectics
    dialectics = await analyze_dialectics(req.question)  # 只传 question
    yield _format_sse_event("dialectics", dialectics)
```

**问题：** `analyze_dialectics()` 仅接收 `question` 字符串，未传入：
- `user_profile_context`（用户画像：过敏史、体质、慢性病史）
- `db`（平台知识库，无法检索用户相关药材禁忌）

**科学影响：**
- 辨证结果可能与用户实际情况不符（如用户有肝病史，但辨证未考虑）
- 与 agent 工作流中 `compliance_tool.py` 的 `user_profile` 参数化设计不一致

**建议：** 将 `req.user_profile_context` 和 `db` 传入辨证分析函数。

---

### 问题 7：多轮历史截断策略不统一

| 路径 | 截断逻辑 | 问题 |
|------|---------|------|
| 非流式 `/chat`（chat.py:454） | `req.history[-10:]` | 固定10条，无长度/Token估算 |
| 流式 `/chat/stream`（chat.py:679） | `req.history[-10:]` | 同上 |
| `chat_engine.py`（未使用） | `history[-15:]`，单条3000字符 | 更宽松，但从未生效 |

**科学影响：**
- 10条消息 × 3000字符 = 最多30000字符，可能超出部分模型上下文窗口
- 早期重要上下文（如用户的过敏声明）可能被截断丢失

**建议：** 改用 Token 级估算（按字符数÷4），确保总长度在模型窗口内，并保留最早的用户画像消息。

---

## 🟢 P2 — 建议改进

### 问题 8：结构化输出缺少必填字段校验

**位置：** `frontend/src/components/ai/features/components/structured/utils.ts`  
**现象：** `detectStructuredContent()` 验证 `blocks` 数组中每个 block 的 `type` 是否在白名单内，但**不验证必填字段**：

```typescript
// 当前只检查 type 存在
for (const block of parsed.blocks) {
  if (!block || typeof block !== 'object') return null
  if (!block.type || typeof block.type !== 'string') return null
  if (!validTypes.has(block.type as BlockType)) return null
}
```

**未验证：**
- `data-table` 必须有 `columns` 和 `rows`
- `metrics` 必须有 `items`
- `timeline` 必须有 `phases`
- `callout` 必须有 `content`

**建议：** 增加字段级校验，缺失必填字段时尝试修复（补默认值）或降级为纯 Markdown 渲染。

---

### 问题 9：流式 step 事件缺少中间步骤

**位置：** `backend/app/api/ai_modules/chat.py:704-710`（流式路径）  
**现象：** 当前仅在 LLM 完成后 emit 一个 `step` 事件（"生成回答"），中间过程（问题理解→知识检索→推理分析→配方设计）无实时 step 事件。

**科学影响：** 用户看不到思考过程的分步展示，只能看到最后的"完成"标记，思考过程可视化效果大打折扣。

**建议：** 在 `_build_system_prompt()` 完成后 emit "知识检索" step，LLM 调用前 emit "推理分析" step，形成完整的思考链路展示。

---

### 问题 10：配方保存前的 AI 校验失败时静默降级

**位置：** `frontend/src/components/ai/features/ChatTab.tsx:253-263`  
**现象：**
```typescript
try {
  validation = await validateAiFormula({...})
} catch (e) {
  validationSkipped = true
  logger.warn('[ChatTab] AI 配方校验服务调用失败，已跳过校验直接保存:', e)
}
```

**科学影响：** 校验服务故障时，不安全的配方可直接保存到数据库，违反"安全第一"原则。

**建议：** 校验服务不可用时，拒绝保存或仅允许以"草稿"状态保存，不得进入正式配方库。

---

## 修复优先级建议

| 优先级 | 问题 | 修复方向 | 预计工时 |
|--------|------|---------|---------|
| P0-1 | 幻觉检测缺失 | `output_filter.py` 增加 DOI/文献/医疗声明检测规则 | 1小时 |
| P0-2 | 总剂量无聚合校验 | `_append_dosage_warnings` 增加总量计算 + 配伍毒性检测 | 2小时 |
| P0-3 | 药材剂量数据库不足 | 从权威源加载完整114种剂量表，或动态从知识库查询 | 半天 |
| P1-4 | YAML指令无法可靠执行 | 增加前端字段级校验 + 后端幻觉检测 | 1小时 |
| P1-5 | 剂量单位无约束 | Schema 增加格式校验 + 前端单位归一化 | 30分钟 |
| P1-6 | 辨证分析未用画像 | 传入 `user_profile_context` 和 `db` | 30分钟 |
| P1-7 | 历史截断不统一 | 改为 Token 级估算 | 1小时 |
| P2-8~10 | 字段校验/step事件/静默降级 | 各独立修复 | 各30分钟 |

---

## 安全架构现状（修复后）

```
Agent 工作流（react_chain / agent/orchestrator）
    └── check_output() ✅ 已覆盖
         └── 仅检测：API Key、PII、敏感关键词 ❌ 无幻觉检测

主对话路径（/chat, /chat/stream）
    ├── check_output() ✅ 已接入（P0-2修复后）
    ├── _append_dosage_warnings() ✅ 已接入（单味药校验）
    │    └── 仅覆盖46/114味药材 ❌ 数据库不完整
    └── 总剂量/配伍毒性 ❌ 无校验

配方保存路径（/ai/formula/validate）
    ├── validate_formula() ✅ 有后验校验
    └── 失败时静默降级 ❌ P2-10问题

公式引擎（AcademicianChatEngine）
    └── 主路径未接入 ⚠️ 架构说明已添加注释
```
