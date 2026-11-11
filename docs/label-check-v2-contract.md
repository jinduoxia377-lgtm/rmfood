# 配料表核查 v2 — 功能与契约规范（团队共享单一事实源）

- 版本：v2.1（2026-11-11）
- 关联页面：`frontend/src/pages/label/LabelCheckPage.tsx`
- 关联 API 客户端：`frontend/src/api/labelCheck.ts`
- 关联后端：`backend/app/api/v1/label_check_router.py`、`backend/app/services/label_check/label_check_service.py`
- 关联合规边界：`docs/ingredient-label-check-compliance-wording.md`（**话术红线，必须遵守**）

> 本文件是配料表核查 v2 深度开发的**唯一契约源**。前端字段名、后端响应键、i18n key
> 必须与此文件逐字一致。任何改动先改本文件，再改代码。历史上该平台多次因
> 「前端访问后端不存在的字段」导致整页空白（P0），故立此契约。

---

## 一、合规红线（不可违反，来自 wording 规范）

1. **禁止绝对化合规判定**：不得出现「合规✅」「通过」「合格」「可放心食用」。
2. **禁止出具检测/认证结论**：平台无 CMA/CNAS 资质。
3. **禁止功效声称**：不得声称预防/治疗疾病或保健功能。
4. **所有「未收录」成分一律提示人工核实**，不自动推断合法/非法。
5. **禁用/风险物质**：仅客观陈述「出现在 XX 法规禁用品清单中」，以官方解释为准。
6. 固定免责声明必须始终展示，不可省略。

---

## 二、后端响应契约（`check_label_text` / `check_ingredient_names` 返回的 `data` 对象）

v2 在 v1 基础上**只增不改**既有键，保证向后兼容。

```ts
interface LabelCheckResult {
  report_id: string;                       // 已有 lc_<hex12>
  summary: string;                         // 已有，自然语言摘要
  ingredients: LabelIngredient[];          // 已有，见下
  category_counts: Record<string, number>; // 已有
  unknown_count: number;                   // 已有
  warning_count: number;                   // 已有
  allergen_ingredients: Array<{ name: string; group: string }>; // 已有
  disclaimer: string;                      // 已有，固定免责声明

  // ── v2 新增 ──
  // 🔴红线修正（领域审查🔴-2）：不得输出「风险等级/安全等级」这类绝对化定级结论
  // （平台无 CMA/CNAS 资质，且「低风险」会被消费者等同「安全/可放心」，触碰话术红线第1条）。
  // 改用中性「目录比对提示分」+「需人工核实项计数」。risk_score 仅内部参考，UI 不得称「安全评分」。
  risk_score: number;            // 0-100 整数，**目录比对提示分**（非安全评分）；禁用项一票置顶，不复利稀释
  needs_review_count: number;    // 需人工核实项数（unknown + note 级），UI 主展示此字段而非「风险等级」
  parse_warnings: string[];      // 解析阶段告警（如「检测到未闭合括号」「嵌套超过2层已截断」）
  stats: {
    total: number;               // 识别成分总数
    matched: number;             // 命中任一目录数
    unmatched: number;           // 未收录数（= unknown_count）
    allergen_count: number;      // 致敏项数
    compound_expanded: number;   // 被展开的复合配料数
  };
}

interface LabelIngredient {
  name: string;                  // 已有，标准化名称
  raw_name?: string;             // v2 新增：解析前的原始片段
  category: string;              // 已有：food_homology|new_food_resource|food_additive|nutrition_enricher|ordinary_food|prohibited|unknown
  category_label: string;        // 已有，中文展示名（后端给，前端兜底）
  level: 'info'|'note'|'warning';// 已有
  message: string;               // 已有
  allergen: boolean;             // 已有
  allergen_group?: string;       // 已有
  max_dosage_mg_per_day?: number;// 已有（药食同源）
  function?: string;             // 已有（添加剂/强化剂）
  max_usage?: string;            // 已有（添加剂）
  source?: string;               // 已有（禁用项 source_law）

  // ── v2 新增 ──
  match_confidence: number;      // 0.0-1.0，精确=1.0，别名=0.9，模糊=0.85-0.95（保守），无=0
  match_method: 'exact'|'alias'|'fuzzy'|'none';
  aliases?: string[];            // 命中的别名链（如 蔗糖→白砂糖）
  risk_contribution?: number;    // 该成分对 risk_score 的贡献分（前端须逐项可解释展示）
  is_compound?: boolean;         // 是否为复合配料（展开而来）
  sub_ingredients?: string[];    // 复合配料展开后的子成分名
  caution?: string;              // v2 新增：人群禁忌/安全提示（如白果"儿童慎用不宜生食"、当归"孕妇慎用"、西红花"孕妇禁用"）
}
```

### 🔴 模糊匹配安全护栏（领域审查🔴-1，强制实现）
C 端食品安全入口，容错原则：**宁漏判为 unknown，绝不错判为安全**。
1. 禁用品清单及剧毒/毒性药材（马钱子/马兜铃/曼陀罗/蟾酥/川乌/草乌/附子/砒霜/巴豆/河豚/雷公藤等）建立**「禁用 fuzzy」黑名单标志**。
2. 凡命中或疑似命中禁用/剧毒成员的成分，**一律禁止 fuzzy 归并到非禁用类目**，也不允许把安全成分 fuzzy 成禁用品（避免误伤恐慌）。
3. 模糊匹配置信度 **<0.85 一律输出 `match_method:'none'`** + 强制「人工核实」提示，绝不落入 `ordinary_food`/`food_homology`。
4. **三类成分绝不可模糊归并**：①禁用/剧毒类 ②过敏原类（致敏判定只走明确成员词，不靠 fuzzy）③形近药食同源对（白扁豆vs巴豆、赤小豆vs相思豆、茯苓vs茯苓皮）。

## 三、后端新增/扩展端点

| 方法 | 路径 | 说明 | 请求 | 响应 |
|------|------|------|------|------|
| POST | `/api/v1/label-check` | 已有，增强返回 | `{text}` | `LabelCheckResult`（v2 字段） |
| POST | `/api/v1/label-check/ocr` | 已有，增强返回 | `file` | `{success,ocr_text,data,message}` |
| POST | `/api/v1/label-check/ingredients` | 已有，增强返回 | `{ingredients:[]}` | `LabelCheckResult`（v2 字段） |
| GET  | `/api/v1/label-check/templates` | **v2 新增**：示例配料表模板 | — | `{templates:[{id,name,description,text,tag}]}` |
| GET  | `/api/v1/label-check/directory-stats` | **v2 新增**：内置目录规模统计 | — | `{food_homology,new_food,additives,enrichers,prohibited,common_food,allergen_groups}` 各为数量 |

> 历史记录（history）与导出（export）在**前端 localStorage + 客户端生成**实现，
> 不新增后端端点（C端 MVP 无用户体系，避免无谓持久化与隐私风险）。

---

## 四、前端功能模块清单

- **M1 智能解析增强**：多层嵌套复合配料、数量/规格提取、解析告警展示。
- **M2 模糊/别名匹配**：降低「未收录」率，展示匹配方式与置信度。
- **M3 目录比对看板**：risk_score 中性仪表（称「目录比对提示分」，**无 low/medium/high 风险等级**，见🔴-2）+ 需人工核实项 needs_review_count + 分类分布 + 致敏分组视图。
- **M4 成分明细升级**：每项可展开，显示匹配方式/置信度/别名链/限量/来源法规/子成分。
- **M5 历史记录**：localStorage 持久化最近 20 条，可复查/删除/清空。
- **M6 导出**：导出 Markdown / JSON 报告（客户端生成下载）。
- **M7 示例模板**：一键填入典型配料表（来自 `/templates`）。
- **M8 过滤/搜索**：结果按分类、级别、致敏筛选 + 关键词搜索。

## 五、i18n key 命名规范

新增 key 统一挂在 `pages.labelCheck.*` 下，三语言（zh-CN/en-US/de-DE）同步。
命名建议：`riskScore`（中性「目录比对提示分」）、`needsReviewCount`、`caution`、
`matchExact|Alias|Fuzzy|None`、`history`、`export`、`templates`、`filter*`、`stats*`、`parseWarnings` 等。
**禁止**出现 `riskLevel*` / 「低风险」/「安全评分」类 key（见🔴-2 红线）。

---

## 六、变更记录
- v2.1（2026-11-11）：领域审查🔴红线修正——①移除 risk_level，改中性 needs_review_count +「目录比对提示分」口径；②模糊匹配备案（禁用/剧毒黑名单禁 fuzzy、置信度<0.85 归 none、三类不可归并）；③LabelIngredient 增 caution 人群禁忌字段；④模糊置信度区间收窄为 0.85-0.95。
- v2.0（2026-11-11）：创建 v2 契约草案，定义新增字段、端点、功能模块清单。
