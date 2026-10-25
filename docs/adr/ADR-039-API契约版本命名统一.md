# ADR-039: API 契约版本命名统一

> **状态**：📋 提案　**日期**：2026-10-25　**领域**：工程治理 / REST API 契约
> **关联**：ADR-038（语义化版本发布体系，本 ADR 是其「明确排除」项的独立处理）、README 已知技术债务 P1（L1065）、`docs/release/README.md` §1、`docs/release/CHECKLIST.md` §5.4；`backend/app/api/api_version.py`

## 背景与问题

ADR-038 建立两个正交版本轴时，把轴 B（REST API 契约版本）的内部不一致登记为 P1 债务并明确「留待独立 ADR 处理」：

> **REST API 契约版本的治理**：`CURRENT_API_VERSION = "1.0.0"` 与 `API_MATRIX` 的 `v1`/`v2` 键名不完全对齐（`1.0.0` vs `v1`）。这是轴 B 的内部一致性问题，改动会影响读取 `X-API-Version` 的下游客户端，**风险高于收益，留待独立 ADR 处理**。（ADR-038 L154-156）

ADR-038 的发布提交严格限定在 17 个版本治理文件，刻意不触碰 `api_version.py`，以避免在同一提交中混合「发布体系建立」与「API 契约重构」两个独立决策。本 ADR 即该独立处理。

### 实测证据（精读 `backend/app/api/api_version.py`，229 行）

| 位置 | 代码 | 暴露值 | 备注 |
|:-----|:-----|:-------|:-----|
| L38 | `CURRENT_API_VERSION = "1.0.0"` | `"1.0.0"` | 纯 SemVer，**无** `v` 前缀；`str` 类型 |
| L40 | `API_MATRIX = { "v1": {...} }` | 键 `"v1"` | 带 `v` 前缀的短标签 |
| L59 | `    "v2": {...}` | 键 `"v2"` | 同上 |
| L90 | `"current_version": "v1"` | `"v1"` | **硬编码字面量**，与 `CURRENT_API_VERSION` 完全脱钩 |
| L117 | `"api_version": CURRENT_API_VERSION` | `"1.0.0"` | `api_info()` 响应字段 |
| L145 | `"api_version": CURRENT_API_VERSION` | `"1.0.0"` | `health_check()` 响应字段 |
| L167 | `response.headers["X-API-Version"] = CURRENT_API_VERSION` | `"1.0.0"` | `APIVersionMiddleware` 注入 |
| L216 | `f"当前版本 v{CURRENT_API_VERSION}"` | `"v1.0.0"` | 启动日志，**第三种格式** |

### 同一概念、三种格式

同一个「当前 API 契约版本」概念在代码中以三种不同字符串暴露：

1. **纯 SemVer** `"1.0.0"` — `CURRENT_API_VERSION`、`X-API-Version` 响应头、`api_info`/`health_check` 的 `api_version` 字段
2. **带 v 前缀的短标签** `"v1"` — `API_MATRIX` 键、`api_root` 的 `current_version` 字段
3. **带 v 前缀的 SemVer** `"v1.0.0"` — 启动日志格式串

下游若同时消费 `/api`（读到 `current_version: "v1"` 与 `api_versions` 矩阵键 `v1`/`v2`）与 `/api/v1/info`（读到 `api_version: "1.0.0"`）或响应头 `X-API-Version: "1.0.0"`，会看到**同一概念、三种字符串**，无法判断 `"v1"` 与 `"1.0.0"` 是否指向同一版本。

### 附加实测：三处 `X-API-Version` 注入点、三种取值

| 文件:行 | 注入值 | 状态 |
|:--------|:-------|:-----|
| `backend/app/api/api_version.py:167` | `CURRENT_API_VERSION` = `"1.0.0"` | ✅ **唯一生效**（由 `main.py:615` 的 `register_version_middleware(app)` 注册） |
| `backend/app/core/api_framework/api_docs.py:187` | 硬编码 `"v1.0.0"` | ❌ **死代码**（`SchemaValidationMiddleware` 未被 `app.add_middleware` 注册，见 L542-544 注释「跳过」） |
| `backend/app/core/api_framework/api_versioning.py:706` | `self.current_version` 默认 `"1.0.0"` | ❌ **未注册**（`register_versioning` 函数在 `main.py` 从未调用，`api_versioning` 模块全仓 0 import） |

### 附加实测：废弃期字段已过期

`API_MATRIX["v1"]["deprecates"] = "2026-01-01"`（L43），但项目当前发布日期为 2026-10-25（ADR-038），v1 实际仍在服务且 `status: "current"`。该字段语义模糊：是「计划废弃日」还是「强制废弃截止日」？在 v1 仍为唯一可用版本时无实际意义。

### 命名易混淆的历史实证

`docs/release/CHECKLIST.md:570-571` 记录了一处历史笔误：`backend/app/version.py` L26 曾把常量误写成 `CURRENT_API_API_VERSION`（双写错字），实际为 `CURRENT_API_VERSION`。该笔误已修复，但说明在「版本」概念密集的代码中，命名确实容易混淆。

### 引用点统计

| 符号 | 定义/引用位置数 | 明细 |
|:-----|:---------------:|:-----|
| `CURRENT_API_VERSION` | 7 | 定义 L38；响应 L117、L145；响应头 L167；日志 L216；注释 `config.py:697`、`version.py:26` |
| `API_MATRIX` | 4 | 定义 L39；`api_root` L89；`api_info` L120；注释 `version.py:26` |
| `X-API-Version` | 3 注入点 | 1 生效 + 1 死代码 + 1 未注册模块 |
| `/api/v1` 路由前缀 | 955 路由装饰器 | `backend/app/api/`（535）、`v1/`（266）、`db_modules/`（88）、`ai_modules/`（66） |
| 前端 `api/v1` URL 引用 | 184 | `frontend/src` 1457 文件中 |
| 小程序 `api/v1` URL 引用 | 127 | `miniprogram` 344 文件中 |
| 前端/小程序读 `X-API-Version` | **0** | 全仓 0 引用 |

### 下游消费方式实测

- **前端 / 小程序 100% 走 URL 前缀** `/api/v1`（共 311 处 URL 引用），**不读 `X-API-Version` 响应头**、**不读** `/api` 或 `/api/v1/info` 的版本字段。
- 路由分发完全由 URL 前缀决定（`main.py:338` 的 `_eff_api_prefix`），**无版本协商逻辑**。
- 仓库内无消费者 ≠ 无外部消费者；`X-API-Version` 是项目唯一的对外契约信号，外部集成方可能已消费，无法枚举。

## 明确取舍边界

本 ADR **只治理轴 B 的命名与自描述一致性**，明确排除：

- ❌ **不改变任何端点行为**：不重命名任何路由、不删除任何字段、不改变任何 HTTP 状态码。
- ❌ **不废弃 v1**：v1 仍是唯一 current 版本，`API_MATRIX` 保留 `v1`/`v2` 条目。
- ❌ **不引入破坏性变更**：`X-API-Version` 响应头取值**保持 `"1.0.0"` 不变**；`/api` 与 `/api/v1/info` 响应的**所有现有字段名与取值均不变**，仅做**新增字段**（向后兼容）。
- ❌ **不合并轴 A 与轴 B**：两轴仍正交（ADR-038 §2 的不变量）。

之所以如此保守，是因为 `X-API-Version` 是项目唯一的对外契约信号。任何对该响应头取值的修改都是对外可见变更，需走独立发布流程与通知窗口。

## 候选方案

### 方案一：保留 `"1.0.0"`，把 `API_MATRIX` 键改为与之一致

**做法**：把 `API_MATRIX` 的键 `"v1"`/`"v2"` 改为 `"1.0.0"`/`"2.0.0"`（或增加别名键）。

**优点**：
- 概念唯一：全代码库只有 `"1.0.0"` 一种格式。
- 对齐 `CURRENT_API_VERSION`。

**缺点**：
- **破坏性**：`/api` 响应的 `api_versions` 字段键从 `v1` 变 `1.0.0`，任何读 `api_versions.v1.features` 的客户端会拿不到值。
- 失去语义：`"1.0.0"` 是纯版本字符串，键名不再表达「API v1 协议」的语义，人读性差。
- 需同步改 `api_info` L120 的 `API_MATRIX["v1"]["features"]` 引用。

**下游影响面**：读 `/api` 的 `api_versions` 字段的客户端（仓库内 0 个，外部未知）。

### 方案二：把 `CURRENT_API_VERSION` 对齐为 `"v1"` 短标签

**做法**：把 `CURRENT_API_VERSION = "1.0.0"` 改为 `"v1"`。

**优点**：
- 与 `API_MATRIX` 键、`api_root` 的 `current_version` 字段完全一致。
- 人读性好，与路由前缀 `/api/v1` 视觉一致。

**缺点**：
- **破坏性**：`X-API-Version` 响应头值从 `"1.0.0"` 变为 `"v1"`，所有读该头的客户端会误判版本。
- 失去 SemVer 语义：`"v1"` 是短标签，无法做程序化比较（`"v10" < "v2"` 字符串比较会出错）。
- 与 ADR-038 轴 A 的 SemVer 范式（`2.0.0`）形成风格冲突。
- 需改 `register_version_routes` L216 的日志格式串 `v{CURRENT_API_VERSION}`（会变成 `vv1`）。

**下游影响面**：读 `X-API-Version` 响应头的客户端（仓库内 0 个，外部未知）。

### 方案三（推荐）：双轨制 — SemVer 主版本 + 规范化标签

**做法**：
1. `CURRENT_API_VERSION` **保持 `"1.0.0"` 不变**（SemVer 主版本号，用于机器比较与 `X-API-Version` 响应头）。
2. `API_MATRIX` 每个版本条目**新增两个字段**：
   - `semver`: `"1.0.0"` — 完整 SemVer 版本字符串（与 `CURRENT_API_VERSION` 对齐）
   - `label`: `"v1"` — 规范化的人类可读标签（与路由前缀 `/api/v1` 对齐）
3. `api_root()` 的硬编码 `"current_version": "v1"` 改为从 `API_MATRIX` 派生（如 `API_MATRIX[current_key]["label"]`），**暴露值仍为 `"v1"`**（无行为变化）。
4. 修复 `register_version_routes` L216 日志格式串，去除多余 `v` 前缀（直接输出 `CURRENT_API_VERSION`）。
5. 删除或标注 `api_docs.py:187` 的死代码（硬编码 `"v1.0.0"`，从未生效）。
6. 文档（README、`docs/release/README.md`）定义映射规则：`label` 与 `semver` 的对应关系。

**优点**：
- **零破坏**：`X-API-Version` 响应头值不变（`"1.0.0"`）；`/api` 与 `/api/v1/info` 响应字段全部保留。
- 自描述：下游可同时读到 `label: "v1"` 与 `semver: "1.0.0"`，明确知道二者指向同一版本。
- 兼顾机器与人类：`semver` 用于版本比较（`1 < 2`），`label` 用于人类阅读与路由对齐（`v1`、`v2`）。
- 对齐行业实践：OpenAPI 3.0、RFC 7807、Stripe API 等都采用「主版本号 + 标签」双轨。
- 修复所有三种格式混用：`api_root` 硬编码、日志 `v{...}` 双写、死代码 `"v1.0.0"` 统一收敛。

**缺点**：
- `API_MATRIX` 条目从 5 字段增至 7 字段，体积略增。
- 需要下游理解「两个字段指向同一版本」的新约定。

**下游影响面**：无破坏。新增字段 `semver`/`label` 对现有客户端透明（可忽略）。

### 方案四（备选）：不做任何改动，只登记文档

**做法**：不修改代码，仅在 README 与 `docs/release/README.md` 加注释说明「`v1` 与 `1.0.0` 指向同一版本」。

**优点**：零风险。
**缺点**：不解决根因；新增版本时仍会重复出现混乱。**不推荐**。

## 推荐方案与理由

**推荐方案三（双轨制）**。理由落到实测：

1. **`X-API-Version` 是唯一的对外契约信号**。仓库内 0 个消费者（实测 `frontend/src` 1457 文件 + `miniprogram` 344 文件共 0 引用），但外部集成方无法枚举。任何对该响应头取值的修改都是对外可见变更，需独立发布流程。方案三是**唯一「零响应头取值变化」**的方案。
2. **实测下游消费方式是 URL 前缀**：前端/小程序 100% 走 `/api/v1` URL 路径（311 处引用），不读 `X-API-Version` 头、不读 `/api` 或 `/api/v1/info` 的版本字段。`label: "v1"` 与 URL 前缀 `/api/v1` 视觉一致，降低下游理解成本。
3. **`API_MATRIX` 键名是内部实现细节**：实测 `API_MATRIX` 仅在 3 处被引用（定义 L39、`api_root` L89、`api_info` L120），改键名的影响面可控（仅 `api_info` L120 需同步改），但**对外暴露的 `api_versions` 字段键会变**，属于破坏性变更。保留原键名更安全。
4. **新增字段是向后兼容的**：`semver` 与 `label` 是新增字段，现有客户端读取 `api_versions.v1.features` 等路径不受影响。
5. **修复三种格式混用**：方案三顺带解决 `api_root` 硬编码、日志 `v{...}` 双写、死代码 `"v1.0.0"` 三个衍生问题，收敛为「SemVer 主版本 + 规范化标签」两种正交格式。

## 迁移影响与兼容性

**本方案不改变响应头取值**，属于**纯内部重构 + 新增字段**，对外零行为变化。

| 项目 | 变化 | 级别 |
|:-----|:-----|:-----|
| `X-API-Version` 响应头值 | **不变**（仍为 `"1.0.0"`） | 无影响 |
| `/api` 响应字段 | 新增 `api_versions.v1.semver`、`api_versions.v1.label`、`api_versions.v2.semver`、`api_versions.v2.label`；`current_version` 取值仍为 `"v1"`（来源改为派生） | 向后兼容新增 |
| `/api/v1/info` 响应字段 | **不变** | 无影响 |
| `/health` 响应字段 | **不变** | 无影响 |
| `CURRENT_API_VERSION` 常量 | **不变**（仍为 `"1.0.0"`） | 无影响 |
| `API_MATRIX` 键名 | **不变**（仍为 `v1`/`v2`） | 无影响 |

**版本发布轴判定**：

- **轴 A（平台发布版本）**：**PATCH** — 纯内部重构 + 向后兼容新增字段，无行为变化。
- **轴 B（REST API 契约版本）**：仍为 `v1`，**不升级**。虽然 `api_root` 响应新增了 `semver`/`label` 字段，但按 ADR-038 §2 的判定表「响应体新增字段（客户端可忽略）」应记为 MINOR；但本 ADR 的变更范围仅限**内部一致性修复**，字段值为既有数据的别名而非新信息，判定为 PATCH 更准确。

> 注：若评审方认为「新增 `semver`/`label` 字段」属于 ADR-038 §2 的「响应体新增字段」应记为 MINOR，可在评审时调整为 MINOR。本 ADR 默认按 PATCH 记录。

**CHANGELOG 写法**（建议，由发布流程执行时落地）：

```markdown
### Fixed
- 统一 API 契约版本命名：`API_MATRIX` 新增 `semver` 与 `label` 字段，
  明确 `"v1"`（label）与 `"1.0.0"`（semver）指向同一契约版本。
  修复 `api_root` 响应 `current_version` 字段硬编码字面量、
  启动日志 `v{CURRENT_API_VERSION}` 双写 `v` 前缀。
  删除 `api_docs.py` 死代码（`SchemaValidationMiddleware` 从未注册）。
  详见 [ADR-039](docs/adr/ADR-039-API契约版本命名统一.md)。
```

**通知窗口**：不需要正式通知。CHANGELOG 记录即可。若存在已知外部集成方，可在下次版本发布邮件中附带一句说明。

## 后果

### 正面

- **自描述性**：下游可同时读到 `semver: "1.0.0"` 与 `label: "v1"`，明确知道二者指向同一契约版本，消除误判风险。
- **格式收敛**：从三种混用（`"1.0.0"`、`"v1"`、`"v1.0.0"`）收敛为两种正交格式（SemVer 主版本 + 规范化标签）。
- **死代码清理**：删除 `api_docs.py:187` 从未生效的 `X-API-Version` 注入，消除未来误触发的隐患。
- **命名一致性**：`api_root` 的 `current_version` 字段与 `API_MATRIX` 的 `label` 字段派生自同一来源，不再硬编码。
- **可演进性**：未来 v2 发布时，`semver: "2.0.0"` + `label: "v2"` 的约定自动生效，无需再次重构。

### 负面 / 约束

- **字段体积增加**：`API_MATRIX` 每个版本条目从 5 字段增至 7 字段。缓解：字段值均为既有数据的别名，无新信息。
- **下游需理解新约定**：读 `api_versions.v1` 的客户端若严格校验字段集合，可能需调整。缓解：新增字段是可选的，标准客户端（如 JSONPath 查询）不受影响。
- **双轨需要维护**：`semver` 与 `label` 必须人工保持一致（`v1` ↔ `1.0.0`、`v2` ↔ `2.0.0`）。缓解：在 `API_MATRIX` 添加注释声明映射规则；未来可加校验脚本。

### 不做的事（明确排除）

本 ADR **不包含**以下代码改动，需另行评审：

- ❌ 不修改 `CURRENT_API_VERSION` 的值（保持 `"1.0.0"`）。
- ❌ 不修改 `API_MATRIX` 的键名（保持 `"v1"`/`"v2"`）。
- ❌ 不修改 `X-API-Version` 响应头的取值（保持 `"1.0.0"`）。
- ❌ 不引入版本协商（`Accept-Version` 请求头处理）。`api_versioning.py` 已有 `VersionNegotiationMiddleware` 实现但**从未注册**，是否启用属独立决策。
- ❌ 不引入废弃期/`Sunset` 字段到响应头。`api_versioning.py` 已有 `Deprecation`/`Sunset` 实现但**从未注册**，同上。
- ❌ 不删除 `api_versioning.py` 模块。该模块虽未注册但包含完整的版本协商与灰度发布框架，未来可能启用。
- ❌ 不重命名 `/api/v1` 路由前缀。URL 前缀是下游消费的主要方式（311 处引用），重命名属于破坏性变更。
- ❌ 不废弃 v1。v1 仍是唯一 current 版本。
- ❌ 不修改 ADR-038 或其关联文件（CHANGELOG.md、package.json 等）。本 ADR 是 ADR-038 的补充，不修改 ADR-038 的已决策内容。

## 超出本 ADR 范围，需另立 ADR

以下问题实测存在但不在本 ADR 范围，需另行决策：

1. **`api_versioning.py` 模块的处置**：该模块（795 行）包含 `VersionNegotiationMiddleware`、`DeprecationManager`、`GrayReleaseManager`、`FeatureFlagManager` 等完整框架，但 `main.py` 从未注册，全仓 0 import。是启用、删除还是保留为可选扩展？建议另立 ADR-040+ 处理「API 版本协商与废弃策略」。
2. **`API_MATRIX["v1"]["deprecates"] = "2026-01-01"` 已过期**：v1 实际仍在服务且 `status: "current"`，但声明的废弃日已过 10 个月。是更新为未来日期、改为 `null`、还是删除该字段？需产品决策「v1 何时真正废弃」。
3. **`api_root` 与 `api_info` 的字段命名不统一**：`api_root` 用 `current_version`，`api_info` 用 `api_version`。是否统一？统一为哪个？建议与「API 版本协商」ADR 一并处理。
4. **`/health` 端点的版本信息暴露**：`/health` 返回 `api_version` 字段，但健康检查通常不包含契约版本信息。是否保留？建议与「API 版本协商」ADR 一并处理。
5. **前端/小程序是否需要读取 `X-API-Version`**：实测 0 消费者，但若未来需要客户端根据契约版本做特性开关（feature flag by API version），需新增消费逻辑。建议另立 ADR 处理「客户端契约版本协商」。
6. **`version.py` 历史笔误复查**：`docs/release/CHECKLIST.md:570-571` 记录的 `CURRENT_API_API_VERSION` 双写错字已修复，但建议复查是否有类似命名笔误残留。

## 备选方案（已否决）

- **方案一（改 `API_MATRIX` 键为 SemVer）**：破坏 `/api` 的 `api_versions` 字段键，破坏性变更，否决。
- **方案二（改 `CURRENT_API_VERSION` 为 `v1` 短标签）**：破坏 `X-API-Version` 响应头取值，影响外部集成方，且失去 SemVer 比较语义，否决。
- **方案四（只登记文档不改代码）**：不解决根因，新增版本时仍会重复混乱，否决。

## 验证计划

代码实施后，按以下清单验证（本 ADR 不含代码改动，以下为建议的后续验证步骤）：

- [ ] `GET /api` 返回 `current_version: "v1"`（不变），且 `api_versions.v1.semver === "1.0.0"`、`api_versions.v1.label === "v1"`
- [ ] `GET /api/v1/info` 返回 `api_version: "1.0.0"`（不变）
- [ ] `GET /health` 返回 `api_version: "1.0.0"`（不变）
- [ ] 任意请求响应头 `X-API-Version: "1.0.0"`（不变）
- [ ] 启动日志输出 `当前版本 1.0.0`（去除多余 `v` 前缀）
- [ ] `grep "v1\.0\.0"` 在 `backend/app/core/api_framework/` 下无残留（死代码已清理）
- [ ] 前端/小程序无需任何改动（实测 0 消费者）
