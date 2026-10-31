# 智能对话专业配方输出-五期验证报告

- **项目**：RMFOOD 食源性药食同源配方平台
- **验证范围**：智能对话「专业配方输出」五期（502 修复 + 原料库富化）集成验证
- **验证人**：QA 验证工程师（qa-phase4）
- **关联任务**：task-15（QA：五期集成验证（502修复+原料库富化）与回归报告）
- **验证日期**：2026-10-23
- **总体结论**：✅ **通过**。静态核验全部符合；后端 80 个用例、前端 6 个用例、tsc 全部通过；流式降级实测确认 `chat_stream` 遇 429 时降级为非流式输出、不再抛 `UnboundLocalError`；专项核查确认 `_enrich_ingredients_with_food_material` 输出完整的 `platform_data` 结构。无阻断性缺陷。所有命令由 QA 本人复跑确认，与 Lead 复跑结果一致。

---

## 1. 改动清单（供静态核验）

### 后端（五期）

| 文件 | 改动内容 | 核验结果 |
|---|---|---|
| `backend/app/services/llm_service.py` | `chat_stream` 流式调用遇 HTTP 429 时降级为非流式调用（`self.chat`），再用 `_split_text_into_chunks` 切分输出以模拟 SSE 分片；内层 `except Exception as parse_exc` 修复变量遮蔽，避免外层 `raise ... from e` 抛 `UnboundLocalError`（此前把真实 429 掩盖成 502「对话服务暂时不可用」） | ✅ 存在且符合（L820、L828-842、L893-896） |
| `backend/app/api/formulas.py` | 新增 `_enrich_ingredients_with_food_material`：用 `_match_food_material` 以 FoodMaterial 富化 `composition.ingredients` 每行的 `platform_data`（matched_name / food_homology / safe_dose_range / effects / active_ingredients / contraindications / toxicity_class / source）；`create_formula` 保存前调用富化，未匹配或 DB 异常保持原样不阻断保存 | ✅ 存在且符合（L34-83、L364-371） |
| `backend/tests/api/test_formula_intelligence.py` | 新增 `TestEnrichIngredientsWithFoodMaterial`（3 用例：富化添加 platform_data、空 composition、DB 异常保持原样）；全文件用例数 77 → 80 | ✅ 存在，3 个新用例，全文件 80 个用例 |

---

## 2. 静态核验结论（逐项）

1. **429 降级链路**：`chat_stream` 在 `resp.raise_for_status()` 捕获 HTTP 状态错误后，`status_code == 429` 分支调用非流式 `self.chat(messages, model=model, temperature=temperature)`，将 `content` 经 `_split_text_into_chunks(content, size=24)` 切分后逐块 `yield`，最后 `return`，保证前端收到 SSE 分片且不再看到 502。
2. **UnboundLocalError 修复**：内层错误体解析使用 `except Exception as parse_exc`（而非 `e`），避免覆盖外层 `httpx.HTTPStatusError as e` 变量；后续 `raise RuntimeError(...) from e` 引用的是外层 `e`，不再出现 `UnboundLocalError: cannot access local variable 'e'`。
3. **`_split_text_into_chunks`**：独立函数 `_split_text_into_chunks(text: str, size: int = 24) -> list[str]`，按固定长度切分文本并返回列表（空文本返回 `[""]`）。
4. **原料库富化**：`_enrich_ingredients_with_food_material(db, composition)` 对每个非空 name 的成分调用 `_match_food_material`，匹配成功则注入 `platform_data`（8 个字段）；未匹配/异常/空 composition 均保持原样。`create_formula` 在 `service.create_formula` 前调用富化并用 `data.model_copy(update={"composition": enriched})` 更新请求，富化异常仅记日志不阻断保存。
5. **测试用例**：`TestEnrichIngredientsWithFoodMaterial` 覆盖富化成功（黄芪命中 + 未知成分保持原样）、空 composition、DB 异常降级三条路径。

---

## 3. 复跑命令与结论

### 3.1 后端 pytest

命令：

```bash
cd backend
venv/Scripts/python -m pytest tests/api/test_formula_intelligence.py -x -q -o addopts=
```

结果（QA 本人复跑）：

```
80 passed, 1 warning in 33.26s
PYTEST_EXIT=0
```

- ✅ **80 passed，退出码 0**（与 Lead 复跑结果一致）。
- 仅剩 1 条 `UserWarning`（`jieba/_compat.py` 中 `pkg_resources is deprecated`），与五期改动无关。

### 3.2 流式降级实测（llm_service.chat_stream）

用临时脚本直接调用 `LLMService.chat_stream`（mock HTTP 客户端返回 429 响应，monkeypatch 非流式 `chat` 返回固定内容，不打印任何真实密钥）：

```
[chat_stream] HTTP 状态错误: status=429, detail=rate limited (mock)
[chat_stream] 流式触发限流(429)，降级为非流式: rate limited (mock)
CHUNKS_COUNT: 2
FULL_CONTENT: 这是429降级后的非流式输出内容，用于验证降级链路是否正常。
PASS: chat_stream 429 降级正常，未抛 UnboundLocalError，输出内容与非流式一致
STREAM_EXIT=0
```

- ✅ **429 时成功降级为非流式输出**：内容切分为 2 个 chunk（每 chunk ≤ 24 字符，符合 `_split_text_into_chunks` 默认 size=24），拼接后与非流式响应内容一致。
- ✅ **不再抛 `UnboundLocalError`**：脚本正常完成，退出码 0。
- 502 修复链路确认：**流式 429 → 捕获后降级非流式 → 切分 yield → 前端收到内容**，不再把 429 掩盖成 502「对话服务暂时不可用」。

### 3.3 前端 tsc（回归抽查）

命令：

```bash
cd frontend
npx tsc --noEmit -p tsconfig.json
```

结果：`TSC_EXIT=0` ✅（QA 本人复跑，与 Lead 一致）。

### 3.4 前端 vitest（回归抽查）

命令：

```bash
npx vitest run src/components/ai/features/__tests__/unit/formulaExtractorProfessional.test.ts
```

结果（QA 本人复跑）：

```
✓ src/components/ai/features/__tests__/unit/formulaExtractorProfessional.test.ts (6 tests) 14ms
 Test Files  1 passed (1)
      Tests  6 passed (6)
VITEST_EXIT=0
```

- ✅ **6 passed，退出码 0**（与 Lead 复跑结果一致）。五期未改动前端，此结果为四期能力回归抽查。

---

## 4. 专项核查

### 4.1 _enrich_ingredients_with_food_material 输出结构

用 Python 直接调用 `app.api.formulas._enrich_ingredients_with_food_material`（mock db 返回 FoodMaterial「黄芪」），实测输出：

```json
{
  "matched_name": "黄芪",
  "food_homology": true,
  "safe_dose_range": { "min_g": 9.0, "max_g": 30.0 },
  "effects": ["补气升阳", "固表止汗"],
  "active_ingredients": ["黄芪多糖", "黄芪甲苷 IV"],
  "contraindications": ["表实邪盛者不宜"],
  "toxicity_class": "无毒",
  "source": "平台原料库"
}
```

- ✅ `platform_data` 8 个字段全部正确注入（matched_name / food_homology / safe_dose_range / effects / active_ingredients / contraindications / toxicity_class / source）。
- ✅ 未匹配成分（「未知成分」）保持原样不注入 `platform_data`。
- ✅ 空 composition / DB 异常路径由 `TestEnrichIngredientsWithFoodMaterial` 覆盖（pytest 通过）。
- 专项脚本退出码 `ENRICH_EXIT=0`。

### 4.2 502 修复链路确认

- 修复前：`chat_stream` 内层 `except Exception as e` 遮蔽外层 `httpx.HTTPStatusError as e`，后续 `raise RuntimeError(...) from e` 引用未定义变量抛 `UnboundLocalError`，被上层包装成 502「对话服务暂时不可用」。
- 修复后：内层改用 `parse_exc`（L820），429 分支显式降级调用非流式 `chat` 并切分输出（L828-842）；实测确认 429 时正常输出内容，不再抛 `UnboundLocalError`，前端不再显示 502。

---

## 5. 遗留问题与风险

| 编号 | 类别 | 描述 | 影响 | 建议 |
|---|---|---|---|---|
| R1 | 中 | Provider 对流式接口单独限流时，每次 429 都会降级为非流式调用；非流式接口本身也可能被限流（此时返回「非流式降级失败」错误） | 限流频繁时降级路径被高频触发，仍可能最终报错 | 可增加退避重试或请求排队；在 UI 层提示「当前访问量大，已降级输出」 |
| R2 | 低 | 富化依赖 FoodMaterial 数据覆盖：原料库缺失或名称不一致的成分无法匹配，`platform_data` 不会注入 | 部分配方成分无可溯源数据 | 持续扩充原料库（三期已有 seed 脚本），并在前端展示「平台未收录」提示 |
| R3 | 低 | `_match_food_material` 使用 `ILIKE` 模糊匹配（`%name%`），可能存在同名字段误匹配（如「黄芪」匹配到「炙黄芪」） | 富化数据可能来自近似原料 | 后续可优先精确匹配（name_cn 全等）再模糊匹配，或增加别名权重 |
| R4 | 低 | 富化仅在 `create_formula` 时执行，已存在的历史配方不会回填 `platform_data` | 历史配方仍无可溯源数据 | 可提供后台回填脚本或迁移任务 |
| R5 | 低 | 后端 pytest 仍有 1 条 `UserWarning`（jieba `pkg_resources is deprecated`），非五期引入 | 无功能影响，仅输出噪音 | 后续升级 setuptools 或替换 jieba 依赖时处理 |

---

## 6. 五期能力提升

1. **502 根因修复**：真实 429 不再被 `UnboundLocalError` 掩盖成 502「对话服务暂时不可用」，用户可见错误与真实原因一致。
2. **流式限流自动降级**：流式接口遇 429 时自动降级为非流式调用，并通过 `_split_text_into_chunks` 模拟 SSE 分片输出，前端无需任何改动即可继续收到回复。
3. **工程缺陷修复**：内层 `except` 变量遮蔽问题被根除（`parse_exc`），同类 `from e` 引用不再可能触发 `UnboundLocalError`。
4. **配方成分可溯源**：`create_formula` 保存时自动用平台原料库（FoodMaterial）富化每个成分的 `platform_data`（药食同源标记、安全剂量范围、功效、活性成分、禁忌、毒性等级、来源），让 AI 对话等入口保存的配方成分可溯源到平台真实数据。
5. **测试资产增长**：后端测试用例 77 → 80，新增 `TestEnrichIngredientsWithFoodMaterial` 覆盖富化成功/空输入/DB 异常三条路径；前端四期 6 个用例回归通过。

---

## 7. 验证环境

- 工作目录：`D:\RMFOODFP`
- 后端：Python venv `backend/venv`（`venv/Scripts/python`），pytest 剥离覆盖率参数（`-o addopts=`）
- 前端：Node/npx，vitest v3.2.6，tsc `--noEmit -p tsconfig.json`
- 流式降级实测：临时脚本 mock HTTP 429 响应 + monkeypatch 非流式 `chat`，调用真实 `chat_stream` 代码路径（不打印真实密钥）
- 专项核查：临时脚本直接调用 `_enrich_ingredients_with_food_material`（mock db + 不落库 FoodMaterial）
- 数据库：验证环境无可用 PostgreSQL 实例；后端用例不依赖真实数据库（测试自行建表清理）