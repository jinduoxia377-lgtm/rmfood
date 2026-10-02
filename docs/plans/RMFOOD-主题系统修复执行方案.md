# RMFOOD 主题系统修复执行方案

| 项目 | 内容 |
|:-----|:-----|
| **文档编号** | RMFOOD-DS-THEME-001-PLAN |
| **版本** | v1.0.0 |
| **状态** | 待评审 → 待执行 |
| **依据规范** | [RMFOOD-主题系统设计规范.md](../design/RMFOOD-主题系统设计规范.md) v1.1.0 |
| **缺陷来源** | 规范 §11（52 项，9 项 P0）、§17 渲染取证 |
| **制定日期** | 2026-10-01 |
| **责任人** | 前端架构组 |

---

## 0. 方案概要

### 0.0 执行进度（滚动更新）

**当前阶段：M3（架构收口）进行中** —— T-G1（死代码清理）✅ + T-G3（样板与僵尸键）✅ 已完成；余 T-G2（令牌语义化）/ T-T1（测试覆盖）。

| 里程碑 | 状态 | 门禁 |
|:-------|:-----|:-----|
| **M0** 门禁（T-H1） | ✅ 完成 | 断言 9 → **12 项** |
| **M1** 止血 | ✅ 完成 | `--milestone M1` 退出码 0 |
| **M2** 一致性 | ✅ **8/8 完成** | **全量门禁通过 11 / 失败 0 / 跳过 0，退出码 0**（T-B2b 收口后复验） |
| M3 架构收口 | 🔶 进行中 — **T-G1 ✅（24 孤岛文件删除）+ T-G3 ✅（样板收敛 14→1 + 僵尸键清理 + 版本历史删除）**；余 T-G2（令牌语义化）/ T-T1（测试覆盖） | M4 治理 | ⏳ 未开始 |

#### M2 任务状态

| 任务 | 状态 | 覆盖缺陷 | 验证证据 |
|:-----|:-----|:---------|:---------|
| **T-B1** 品牌色双源收敛 | ✅ | **D-2 / D-3** | 新增 `preset-align.mjs`（逐令牌对比「内联注入值」与「移除注入后的 L0 计算值」，含颜色/长度归一化）。同义不同值 **32 → 0**；`--color-primary` === `--color-primary-main`（亮 `#10b981` / 暗 `#34d399`）。顺带修 T11 违规（字体族链/缓动在 base 与 dark 取值不一致） |
| **T-D5** 缓动/字重命名 | ✅ | **D-23** | `var(--ease-*)` **51 处消费者** vs `var(--easing-*)`/`var(--weight-*)` **各 0 处**；`Easing` 键名改为 `{standard,spring,elegant}` 与 L0 对齐；移除死导出 `--weight-*` |
| **T-S1** 状态一致性 | ✅ 6/6 | **D-34/35/36/37/38/40** | D-34（原使用户首次系统切换后永久退出 system 模式）、D-37（`effectiveMode` 原只用于打日志 → 冷启动不跟随 OS）、D-35（协议拆分）、D-36（导入规范化）、D-38（已随 T-R1）、D-40（`useTheme` 唯一化）。新增 `verify-d34-d37.mjs`、`verify-d35-d36.mjs`、`verify-d40.mjs` |
| **T-W1** 无障碍属性刷新 | ✅（提前于 M1） | **D-39 / D-57** | D-57 把同步移入 `applyThemeWithTransition()`（全部 7 条路径唯一汇聚点）；`verify-d57.mjs` 逐场景断言 |
| **T-B2a** 生成器改用 L0 名 | ✅ | **D-2/D-3 终局** | **解锁自定义主题**：自定义 `primary.main` 后 `--color-primary` 由 `#10b981` → `#ff0000`（此前纹丝不动） |
| **T-E1** 图表取色单通道 | ✅ | **D-4 / D-43 / D-45** | 迁入 `chartTheme.ts` 并补全 fallback；修两处 `useMemo(…, [])`；删 3 个废弃模块。GATE-08 三阶段收敛 **153 → 98 → 14 → 0** |
| **T-F1a** 对话区暗色驱动 | ✅ | **D-13 / D-26** | 全 src `@media (prefers-color-scheme: dark)` 块 **22 → 0**；并修正 **14 条自作用域死规则**为后代选择器。`verify-tf1a.mjs` 双场景判别 |
| **T-W2** 无障碍覆盖缺口 | ✅ | **D-32** | 阅读模式补 `--bg-canvas`（48 处消费者）；高对比 `--border-default` → `--border-color`（**147 vs 2**）；`color-blind` 按 A-15 用 Okabe-Ito 落地 |
| **T-B2b** 去冗余注入 + 四角色映射 | ✅ **完成**（收口 M2） | **D-2/D-3 终局 / D-53 配对** | 两步提交：**Step 1** 四角色映射（`success/error/warning/info` 的 main/background/text → L0 名，12 条，37 项静态断言全过）；**Step 2** 内置预设去注入（新增 `isCleanBuiltinPreset`，`light-default`/`dark-default` 时 `<html>` 内联自定义属性 **86 → 0**，无障碍变体仍注入 86 个使 Okabe-Ito 语义色生效） |

> **M2 期间新增缺陷 4 项**（均由对抗性复核发现）：**D-54**（P0，`.surface-primary:hover` 暗色 1.13:1，D-50 修复自身引入的回归）、**D-55**（P0，`@theme` 未桥接 `secondary` 整族 → 104 处类 0 生成）、**D-56**（P1，`info` 族非色阶）、**D-53**（P2，10 个 camelCase 令牌名被白名单拒绝）。

#### M1 任务状态（已完成）

| 任务 | 状态 | 覆盖缺陷 | 门禁/渲染证据 |
|:-----|:-----|:---------|:--------------|
| **T-H1** 门禁脚本 | ✅ 完成 | — | 交付 12 项断言（GATE-01~GATE-12）+ 5 个 npm script；在未修复代码上正确判失败 |
| **T-C2** 清除循环引用令牌 | ✅ 完成 | **D-51** | GATE-09 由 `fail` → `warn`；编译产物 `--color-blue-500` 不再等于 `var(--color-blue-500)` |
| **T-C1** 清理孤儿 `:root` | ✅ 完成 | D-21, D-22, D-12b, **D-52** | GATE-02 → ✅；GATE-06 → ✅（徽章 1.26:1 → **5.26:1**，六枚徽章全部 ≥ 4.65:1）；`--bg-surface-variant` 由空 → `#f8fafc`/`#020617` |
| **T-D3** 暗色 `--background` | ✅ 完成 | D-9 | 实测暗色 `--background` 由 `#f0fdf4` → **`#020617`** |
| **T-D1** 首屏闪烁 | ✅ 完成 | D-11, D-49, **D-39** | 时间线：`.dark` 生效时刻 **1516ms → 153ms**；首个 body 背景 `rgb(2,6,23)`（暗）出现在 **1766ms < FCP 1888ms** → 无 FOUC；GATE-07 → ✅（刷新后 `a11y=reading reading=sepia`） |
| **T-D2** 消除 CSS 注入 | ✅ 完成 | D-33 | 改用 `setProperty` + 白名单；**59/59 断言通过**，10 种注入形态全部阻断（浏览器内调用真实 `isSafeToken`） |
| **T-D4** 移除全页 opacity 过渡 | ✅ 完成 | D-8 | 6 次切换（fade/slide/scale × 亮/暗）实测 `<html>` 上 **0 处** inline opacity/transform；`.theme-transition` 类正确挂载与卸载 |
| **T-R1** Radix Themes 前置条件 | ✅ 完成 | **D-41**, **D-10** | 采用**方案乙（移除）**：移除 `@radix-ui/themes` 依赖 + `RadixThemeProvider`，包装层改项目原生实现并补齐 `role="status"`。实测：`/radix-demo` 可达、**0 个 Radix 残留节点**、**13 个 Badge 具备 role=status**、0 页面错误。新增门禁 **GATE-10** 防「引入但样式表未加载」复发 |
| **T-A2** 页头实底对比度 | ✅ 完成 | **D-50** | 新增 `--color-primary-surface`/`--color-on-primary-surface` + `.surface-primary`；**23 个文件**替换（22 个 `p-6` + 1 个 `p-5`）+ `MainLayout` 侧边栏 Logo；GATE-04/GATE-05 → ✅ |
| **T-A1** `dark:` 变体归属 | ✅ 完成 | **D-1** | 加入 `@custom-variant dark`；GATE-01、GATE-03 → ✅（编译产物媒体查询内 `.dark\:` **1467 → 0**） |
| **T-A3** 实底按钮对比度 | ⏸️ 免做 | D-50 余量 | 门禁在 **12 路由 × 22 个白字实底元素 × 双模式**下未发现失败实例。静态 105 处条件类字符串仍属残余风险，建议随 M2 语义化迁移处理 |

**T-A1 视觉回归复核**（before/after 截图逐像素对比，6 路由 × 双模式）：

| 路由 | 暗色差异 | 亮色差异 |
|:-----|---:|---:|
| `/ai` | 21.0% | 0.0% |
| `/settings` | 14.0% | 0.0% |
| `/users` | 3.8% | 0.0% |
| `/formulas` | 3.6% | 0.0% |
| `/dashboard` | 0.2% | 0.3% |
| `/login` | 0.2% | 0.3% |
| **平均** | **7.1%** | **0.1%** |

> 签名符合预期：变化集中在**暗色**（`dark:` 此前完全未生效，现激活），
> **亮色模式几乎零变化**（0.1%）——证明未引入非预期回归。
> `/dashboard`、`/login` 变化极小，因其主要依赖手写 `.dark .X` 规则（此前已工作）。

**M1 门禁状态**：当时 `通过 7 / 失败 0 / 跳过 0`，退出码 **0**（`npm run theme:gate:m1`）。
> **注**：该数字为 M1 收尾时的快照。门禁断言此后由 10 项增至 **12 项**（M2 新增 GATE-11/12），
> 故当前 M1 范围实测为 **通过 9 / 失败 0 / 跳过 0**，退出码仍为 **0**。
> GATE-09 为 `warn`（冗余自引用，**无循环引用**）；GATE-08 已在 **M2 关闭**（现为 ✅）。

**M1 全部任务项完成**：T-H1 / T-C1 / T-C2 / T-D1 / T-D2 / T-D3 / T-D4 / T-R1 / T-A1 / T-A2（含 T-A3 判定免做）。
门禁断言由 9 项增至 **10 项**（新增 GATE-10 Radix 前置条件）。

**M1 期间新增缺陷**（由门禁首次运行发现，均已修复或记录）：
- **D-51**（P0）`--color-blue-50..900` 循环引用 → 约 347 处 `blue-*` 工具类失去颜色 → **已修复**
- **D-52**（P1）亮色徽章配色自身低于 AA（被 D-21 掩盖）→ **已修复**
- **D-12b**（P1）`--color-primary-text` 缺暗色值 → **已修复**

**已知环境问题**（非本方案引入，影响验证方式）：
- `vitest` 的 pnpm 嵌套 `vite` 目录残缺（仅含 `node_modules`，无 `package.json`）→ `npx vitest` 不可用。
  已改用「浏览器内 import 真实模块 + 断言」的方式执行单元测试（`scripts/theme-audit/verify-token-safety.mjs`）。
  形态正确的 vitest 用例已写入 `src/stores/__tests__/theme.presets.test.ts`，待环境修复后即可直接运行。
- 后台 dev server 会被环境周期性回收（实测每 5–15 分钟一次，exit 1）。
  渲染类验证须在单个脚本会话内完成。

---

### 0.1 目标

把主题系统从「**两套命名体系并存、`dark:` 不生效、页头暗色不可读、无障碍刷新即失效**」修复到「**符合规范 v1.1.0 全部阻塞级检查项（CHK-01 ~ CHK-25）**」。

### 0.2 范围

| 在范围内 | 不在范围内 |
|:---------|:-----------|
| `frontend/src/` 全部主题相关代码 | 微信小程序主题（另见 `docs/theme-system-spec.md`） |
| `frontend/index.html` 预置脚本 | 后端/API |
| `frontend/scripts/` 校验与门禁 | 设计稿视觉改版（仅修复对比度与一致性） |
| 主题文档治理（ADR/废弃标记） | Radix Themes 的**全量**迁移（仅修令牌缺失） |

### 0.3 交付定义（DoD）

一个批次视为完成，必须同时满足：

1. 该批次全部任务项通过 **§5.2 逐项验证命令**；
2. 阶段门禁脚本 `npm run theme:gate` **退出码 0**；
3. `npm run build` 与 `npx tsc -b` **零错误**；
4. 关键路由亮/暗双模式**截图 diff 已人工复核**（无意外回归）；
5. 规范 §11 对应缺陷行的「状态」更新为「已修复」，并附验证证据。

### 0.4 关键前提：执行前必须建立的基线

> **这是整个方案的第一道工序，不可跳过。**

当前项目**没有可用的自动化门禁**：

| 治理设施 | 现状 | 影响 |
|:---------|:-----|:-----|
| `npm run lint`（`eslint .`） | ❌ **无任何 ESLint 配置**（frontend 根、仓库根、`package.json.eslintConfig` 均无） | 命令实际不可用 |
| `.husky/pre-commit` → `npx lint-staged` | ❌ **无 lint-staged 配置** | 钩子空转 |
| `scripts/theme-validate.ts` | ⚠️ 存在但**未注册**为 npm script | 不可执行 |
| 同上，其规则 | ⚠️ **已过时**：`SPEC_COLORS.primary_main = '#059669'`、`secondary_main = '#2563eb'`，与规范 §13 权威值冲突；只查硬编码 hex，**不查** `dark:` 归属、反转色阶配白字、孤儿 `:root`、失效 `var()` | 即使注册也会给出错误结论 |
| CI | 未确认 | — |

**因此 T-H1（门禁脚本）是阶段 0 的前置任务，不是收尾任务。** 没有它，后续每个批次都只能靠人工判断「有没有变好」。

---

## 1. 现状对执行的关键影响

| # | 发现 | 对方案的影响 |
|:--|:-----|:-------------|
| 1 | 页头模式 `rounded-xl bg-primary-600 p-6 text-white shadow-sm` 在 **22 个页面文件中逐字重复**，且**不存在共享页头组件** | **极高杠杆点**：一个语义类 + 一次批量替换即可修复 22 个 P0 站点（T-A2） |
| 2 | `bg-primary-{500,600,700}` 与 `text-white` 同处出现共 **105 行 / 67 文件** | 除页头外还有约 83 处按钮类需处理，可按批次推进 |
| 3 | `applyThemeToDOM` 有 **5 处调用点**（`themeStore.ts:525, 547, 571, 594, 626`），均在 `themeStore` 内 | 改签名需同步 5 处；**推荐不改签名**（见 T-D3） |
| 4 | 手写 `.dark .X` 规则共 **131 处**，特异度 (0,2,0) **高于** `dark:` 工具类经 `@custom-variant` 后的 (0,1,0) | **好消息**：修复 D-1（T-A1）时，手写规则仍会胜出，回归面小于预期 |
| 5 | `mode` 默认 `'system'`，`ThemeProvider` 依 `matchMedia` 写 `.dark` | **解释为何缺陷长期未被发现**：开发者若 OS 为暗色，`.dark` 类与媒体查询**同时成立**，`dark:` 表现正常。缺陷只在「应用选择与 OS 分歧」时暴露 |
| 6 | `dark.css` 孤儿 `:root{}`（381-448）中的 44 条里，26 条与 base.css **同值**、21 条**异值**、3 条为间距（无关） | T-C1 应**删除同值重复**、只把异值移入 `.dark{}`，而非整体搬移 |
| 7 | 孤儿块中的 `--bg-surface-variant` 覆盖了 base.css 的正确别名 | **D-22 无需单独修**：T-C1 完成即自动修复（依赖关系，见 §2.2） |
| 8 | 后端与 dev server 后台进程会被环境回收（实测 exit 1） | 渲染类验证**必须**在同一脚本会话内完成，或改用 `vite preview` + 静态产物 |

---

## 2. 工作流分解

### 2.1 工作流清单

| WS | 名称 | 覆盖缺陷 | 阶段 | 可并行 |
|:---|:-----|:---------|:-----|:------:|
| **WS-H1** | 门禁脚本与校验基建 | — | **阶段 0 前置** | 否（阻塞全部） |
| **WS-A** | Tailwind 暗色变体契约 | D-1 | 阶段 0 | 是 |
| **WS-A2** | 页头/实底对比度 | **D-50** | 阶段 0 | 是 |
| **WS-C1** | 孤儿 `:root` 与令牌污染 | D-21, D-22, D-12 | 阶段 0 | 是 |
| **WS-D** | 运行时契约与安全 | D-33, D-11, D-49, D-9, D-8 | 阶段 0 | 是 |
| **WS-R** | Radix Themes 前置条件 | **D-41(P0)**, D-10 | 阶段 0 | 是（需决策） |
| **WS-B** | 令牌双源收敛 | D-2, D-3, D-24 | 阶段 1 | 否（依赖 WS-A） |
| **WS-W** | 无障碍修复 | D-39, D-32 | 阶段 1 | 是 |
| **WS-E** | 图表取色统一 | D-4, D-43, D-45 | 阶段 1 | 是 |
| **WS-F** | 模块令牌边界 | D-13, D-26, U-8~U-12 | 阶段 1–2 | 是 |
| **WS-S** | 状态一致性 | D-34, D-35, D-36, D-37, D-38, D-40 | 阶段 1 | 是 |
| **WS-D5** | 动效令牌命名对齐 | D-23 | 阶段 1 | 是 |
| **WS-G** | 死代码与死文件清理 | D-18, D-19, D-25, D-27, D-30, D-42, D-48 | 阶段 2 | 是 |
| **WS-G3** | 重复样板与僵尸存储键 | D-28, D-44 | 阶段 2 | 是 |
| **WS-T** | 测试覆盖 | D-46 | 阶段 2 | 是 |
| **WS-H2** | 治理与文档 | G-1~G-9, ADR 去重, 废弃文档 | 阶段 3 | 是 |

### 2.2 依赖关系图

```
                    ┌─────────────────┐
                    │ WS-H1 门禁脚本  │  ← 前置，阻塞全部验收
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┬──────────────┐
        ▼                    ▼                    ▼              ▼
  ┌───────────┐      ┌─────────────┐      ┌───────────┐  ┌────────────┐
  │ WS-A D-1  │      │ WS-A2 D-50  │      │ WS-C1 D-21│  │ WS-D D-33  │
  │ @custom-  │      │ 页头对比度  │      │ 孤儿:root │  │ 安全注入   │
  │ variant   │      │  (DEC-1)    │      │  + D-22   │  │ +FOUC+暗底 │
  └─────┬─────┘      └─────────────┘      └───────────┘  └────────────┘
        │                                          （D-22 随 D-21 自动修复）
        │                                          ┌────────────┐
        │                                          │ WS-R D-41  │
        │                                          │ Radix 前置 │
        │                                          │  (DEC-2)   │
        │                                          └────────────┘
        │  D-1 修复后 dark: 才可信，
        │  C-24 方案 C（dark:显式深底）才可用
        ▼
  ┌───────────┐      ┌─────────────┐      ┌───────────┐
  │ WS-B 双源 │◀─────│ WS-W 无障碍 │      │ WS-E 图表 │
  │  B1 对齐  │      │  D-39/D-32  │      │  取色统一 │
  │  B2 改名  │      └─────────────┘      └───────────┘
  └─────┬─────┘
        │  B1 完成后才能安全地进行 B2 改名
        │  （否则 Apple 绿会覆盖权威令牌）
        ▼
  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
  │ WS-S 状态 │  │ WS-F 边界 │  │ WS-G 清理 │  │ WS-T 测试 │
  │           │  │           │  │  + WS-G3  │  │   D-46    │
  └───────────┘  └───────────┘  └───────────┘  └───────────┘
        └──────────────┬──────────────┘
                       ▼
              ┌─────────────────┐
              │ WS-H2 治理收口  │
              └─────────────────┘
```

**三项硬依赖（不可颠倒）：**

1. **WS-H1 → 全部**：没有门禁就无法验收任何修复。
2. **WS-B1 → WS-B2**：`theme.presets.ts` 的色值必须先对齐规范 §13，之后才能把生成器的输出命名改为 L0 名称。若顺序颠倒，运行时会把 Apple 绿 `#34C759` 以内联样式写到 `--color-primary` 上，**覆盖权威值，使问题恶化**。
3. **WS-A → WS-B/WS-S 中一切依赖 `dark:` 的写法**：`dark:` 在 D-1 修复前不可信（如 C-24 方案 C）。
4. **DEC-1 → T-A2**、**DEC-2 → T-R1**、**DEC-3 → T-G1 的主题 UI 部分**：需先决策再动手。

---

## 3. 详细任务

> 每项格式：**目标 / 文件 / 变更 / 验证 / 回滚 / 工时 / 风险**

### 阶段 0 — 止血

---

#### T-H1 · 建立渲染门禁脚本【前置，阻塞全部验收】

- **目标**：把规范 §10 的阻塞级检查变成可执行、可退出码判定的脚本。
- **文件**：
  - 新建 `frontend/scripts/theme-audit/theme-gate.mjs`（复用现有 8 个审计脚本的测量逻辑）
  - 修改 `frontend/package.json` → 新增 `"theme:gate": "node scripts/theme-audit/theme-gate.mjs"`
- **必须断言的检查项**：

  | 断言 | 方法 | 依据 |
  |:-----|:-----|:-----|
  | GATE-01 `@custom-variant dark` 存在 | 读 `src/index.css` 文本 | CHK-05 |
  | GATE-02 `dark.css` 无裸 `:root{}` 令牌块 | 解析 `dark.css`，找块外 `:root` | CHK-17 |
  | GATE-03 编译产物中 `.dark\:` 全部位于 `.dark` 作用域、**不在** `prefers-color-scheme` 内 | 花括号深度追踪 `dist/assets/index-*.css` | CHK-22 / I5 |
  | GATE-04 无「`bg-primary-*` + `text-white`」元素 | DOM 扫描（登录后） | **CHK-23 / D-50** |
  | GATE-05 页头横幅亮/暗对比度均 ≥ 4.5:1（大文本 ≥ 3:1） | 像素采样 | **CHK-24 / A-2** |
  | GATE-06 徽章亮色对比度 ≥ 4.5:1 | 合成探针 + 半透明合成 | CHK-24 / D-21 |
  | GATE-07 无障碍属性在刷新后仍存在 | 设置 → reload → 读属性 | **CHK-25 / D-39** |
  | GATE-08 引用的 `var(--x)` 均可用 | 计算样式探测白名单变量 | CHK-18 |

- **验证**：`npm run build && npm run theme:gate` → 当前代码**必须失败**（预期 GATE-01/GATE-03/GATE-04/GATE-05/GATE-06/GATE-07 失败）。这是门禁有效性的证明。
- **回滚**：删除脚本与 script 条目（无副作用）。
- **工时**：2–3 人日
- **风险**：低。需注意渲染类断言（GATE-04~GATE-07）依赖运行中的前后端，CI 中需 provision 服务；无服务时降级为「跳过并警告」而非「通过」。

---

#### T-A1 · 修复 `dark:` 变体归属【D-1，最高优先级】

- **目标**：让 14 912 处 `dark:` 工具类随应用主题开关切换。
- **文件**：`frontend/src/index.css`
- **变更**：在第 7 行 `@import "tailwindcss";` 之后插入：

```css
/* dark: 变体绑定到 .dark 类（Tailwind v4 默认绑定 @media prefers-color-scheme） */
@custom-variant dark (&:where(.dark, .dark *));
```

- **验证**：
  1. `npm run build`，对 `dist/assets/index-*.css` 跑 GATE-03：`.dark\:` 在媒体查询内计数必须为 **0**；
  2. `node scripts/theme-audit/theme-audit-isolation.mjs`：条件 B（`.dark` 类有、系统亮）下 `bg-white dark:bg-neutral-900` 的 `background-color` 必须**不再是** `rgb(255,255,255)`；
  3. 手工：`Ctrl+Shift+T` 切暗色（OS 保持亮色），确认 `dark:` 元素变色。
- **回滚**：删除该行（单行，零成本）。
- **工时**：0.5 人日（改动）+ 1–2 人日（回归甄别）
- **风险**：**中高**。一次性激活 14 912 处此前未生效的样式。
  - **缓解 1**：§1 发现 4 —— 131 处手写 `.dark .X` 特异性更高，仍会胜出，这部分不会回归。
  - **缓解 2**：`/dashboard`、`/formulas`、`/settings`、`/users`、`/ai`、`/login` 六条路由的亮/暗截图 **改动前先存基线**，改动后逐张 diff。
  - **缓解 3**：分两步提交 —— 先加 `@custom-variant` 但**不合并**，跑截图 diff 收集回归清单；确认后再合并。

---

#### T-A2 · 修复实底对比度【D-50，P0】

- **目标**：页头横幅与实底按钮在亮/暗双模式下对比度 ≥ 4.5:1。
- **文件**：
  - `frontend/src/styles/tokens/base.css`（新增令牌）
  - `frontend/src/styles/tokens/dark.css`（新增令牌）
  - `frontend/src/styles/components/semantic-utils.css`（新增语义类）
  - **22 个页面文件**（批量替换，清单见 §6.2）
- **变更 1 · 新增「主色表面」令牌对**（`base.css`，追加到 `:root` 内）：

```css
  /* ── 主色表面（实底 + 白字，两模式都不参与色阶反转）── */
  --color-primary-surface: #047857;      /* Emerald-700；白字对比度 5.55:1 ✅ AA */
  --color-on-primary-surface: #ffffff;
```

- **变更 2**（`dark.css` 的 `.dark { }` 块内）：

```css
  --color-primary-surface: #065f46;      /* Emerald-800；白字对比度 7.78:1 ✅ AAA */
  --color-on-primary-surface: #ffffff;
```

- **变更 3**（`semantic-utils.css`，新增）：

```css
.surface-primary {
  background-color: var(--color-primary-surface);
  color: var(--color-on-primary-surface);
}
.surface-primary:hover { background-color: var(--color-primary-hover); }
```

- **变更 4 · 批量替换**（22 个文件，逐字同一模式）：

```
- <div className="rounded-xl bg-primary-600 p-6 text-white shadow-sm">
+ <div className="surface-primary rounded-xl p-6 shadow-sm">
```

- **变更 5 · 图标/头像圆**（`flex items-center justify-center text-white shrink-0`，实测暗色 1.92:1）：
  需要人工定位其背景类（多为 `bg-primary-500`/`bg-primary-600` 或内联 gradient），改为 `surface-primary` 或按 T-A2 令牌取值。**输出一份逐处清单**。

- **⚠️ 需设计会签**：变更 1 会把亮色页头从 `#059669` 变为 `#047857`（略深），以满足正文级 4.5:1。
  **替代方案（保持亮色观感）**：亮色 `--color-primary-surface: #059669`（3.77:1），同时把页头内**小于 24px 且非粗体**的文字改为 `--color-on-primary-surface-muted` 并单独满足对比度 —— 复杂度更高，**不推荐**。
- **验证**：GATE-04 通过（无 `bg-primary-* + text-white` 元素）；GATE-05 通过（亮/暗对比度均达标）。
- **回滚**：`git revert` 单个提交（令牌新增 + 批量替换同处一个提交）。
- **工时**：1.5 人日 + 0.5 人日会签
- **风险**：低-中。替换为纯机械操作，可用脚本；风险主要在「22 处之外的 83 处按钮」是否同批处理 —— **建议本任务只做 22 处页头 + 头像圆，按钮另开 T-A3**。

---

#### T-A3 · 修复实底按钮对比度【D-50 余量】

- **目标**：`bg-primary-{500,600,700}` + `text-white` 的另外约 83 行。
- **文件**：按扫描清单逐文件。
- **变更**：`bg-primary-600 text-white hover:bg-primary-700` → `surface-primary hover:bg-primary-hover`（`--color-primary-hover` 已存在）。
- **验证**：GATE-04 通过。
- **工时**：1 人日
- **风险**：低。

---

#### T-C1 · 清理 `dark.css` 孤儿 `:root` 块【D-21 + 自动修复 D-22】- **目标**：消除暗色值对亮色模式的污染。
- **文件**：`frontend/src/styles/tokens/dark.css`（行 381–448）
- **变更（三分类处理，禁止整体搬移）**：

  | 分类 | 数量 | 处理 |
  |:-----|-----:|:-----|
  | 与 `base.css` **同值**的重复声明（`--hero-dark-*` 7、`--z-*` 6、`--space-sm/md/lg/xl` 4、`--scrollbar-thumb*` 2、`--surface-overlay`、`--border-divider`、`--text-h{3,4}-tracking` 等） | 26 | **直接删除**（纯噪音） |
  | 与 `base.css` **异值**的声明（18 个 `--badge-*-{bg,text,border}`、`--gradient-text-shadow`、`--color-primary-text` 等） | 21 | **按语义二选一**：<br>· 若为**暗色专用值** → 移入 `.dark { }`（行 7–345）<br>· 若本应是**亮色值** → 保留亮色值在 `base.css`，删除此处覆盖 |
  | 与主题无关的间距（`--space-0_5/1_5/2_5`） | 3 | 删除（`base.css` 已定义） |

  **关键判定**：`--badge-{draft,pending,approved,rejected,revision,archived}-*` 已有专属的 `-dark` 后缀族（`--badge-draft-bg-dark` 等，`dark.css:321-338`，被 `badges-tabs.css:28-33` 消费）。因此孤儿块中的这 18 个**无后缀**声明**本应只存在于 `base.css`** → **全部删除**，让 `base.css:400-418` 的亮色值重新生效。

- **预期副作用（正向）**：删除后 `--bg-surface-variant` 的覆盖消失，`base.css:354` 的 `var(--bg-surface-container-low)` 别名恢复生效 → **D-22 一并修复，无需单独任务**。
- **验证**：
  1. GATE-02 通过；
  2. GATE-06 通过（徽章亮色对比度 ≥ 4.5:1；预期 `--badge-draft-text` 恢复 `#6E6E73`，实测对比度由 **1.26:1 → ≥ 4.5:1**）；
  3. 渲染断言：亮色模式下 `getComputedStyle(html).getPropertyValue('--badge-draft-text')` === `#6E6E73`；
  4. 渲染断言：亮/暗两模式下 `--bg-surface-variant` 均**非空**。
- **回滚**：`git revert`（单文件）。
- **工时**：1 人日
- **风险**：低-中。删错会导致亮色徽章变色，需截图复核徽章显示。

---

#### T-C2 · 清除 `@theme` 循环引用令牌【D-51，P0 — 门禁新发现】

- **发现来源**：交付 T-H1 门禁后，断言 **GATE-09** 首次运行即告警。
- **目标**：恢复 `blue-*` 工具类族的颜色。
- **现状（双重确证）**：
  - 编译产物中 `--color-blue-500:var(--color-blue-500)`（循环引用）；对照组 `--color-pink-500` = `oklch(65.6% .241 354.308)` 正常；
  - 浏览器实测 `--color-blue-50..900` **全部解析为空**；
  - 成因：`index.css:62-71` 的 `@theme` 声明**替换**了 Tailwind v4 的默认蓝色阶，而 `base.css`/`dark.css` **从未定义** `--color-blue-*` → 全部声明皆为自引用。
- **影响**：全项目约 **347 处** `bg-blue-*` / `text-blue-*` / `border-blue-*` / `ring-blue-*` / `from-blue-*` / `to-blue-*` 工具类**失去颜色**（透明背景 / 继承文字色 / 无边框）。
- **文件**：`frontend/src/index.css`（行 62-71）
- **变更（二选一，需决策）**：

  **方案甲（推荐，最小改动）**：**删除**这 10 行悬空桥接 → Tailwind 默认蓝色阶恢复。
  ```diff
  -  --color-blue-50: var(--color-blue-50);
  -  --color-blue-100: var(--color-blue-100);
  -  …（共 10 行，行 62-71）
  ```
  代价：`blue-*` 恢复为 Tailwind 原生蓝，而非品牌 Ocean Blue。属"恢复功能"，不引入设计变更。

  **方案乙（品牌一致）**：把这 10 行改为指向项目既有的 Ocean Blue 色阶：
  ```css
  --color-blue-50: var(--color-secondary-50);
  --color-blue-500: var(--color-secondary-500);
  /* … */
  ```
  代价：**改变约 347 处元素的颜色**（Tailwind 蓝 → 品牌蓝），需设计会签与全站截图复核。

- **建议**：先做**方案甲**恢复功能（阶段 0，可立即交付）；把 `blue-*` → `bg-secondary-*`/`bg-info-container` 的语义化迁移纳入 T-A3 同类批量替换（规范 §4.5 已列映射）。
- **验证**：
  1. **GATE-09 通过**（无循环引用令牌；冗余自引用降为 warn）；
  2. 编译产物中 `--color-blue-500` 不再等于 `var(--color-blue-500)`；
  3. 浏览器断言：合成 `<div class="bg-blue-500">` 的 `background-color` **非透明**。
- **回滚**：`git revert`（10 行）。
- **工时**：0.25 人日（方案甲）
- **风险**：低（方案甲）。删除后**不会**影响 `--color-primary-*`/`--color-secondary-*` 等有真实定义的令牌。

---

#### T-D1 · 修复首屏闪烁【D-11 + D-49】

- **文件**：`frontend/index.html`
- **变更 1**（行 26–37 的预置脚本整体替换）：

```html
    <script>
      (function () {
        try {
          var raw = localStorage.getItem('rmfood-theme-storage');
          if (!raw) return;
          var mode = JSON.parse(raw) && JSON.parse(raw).state && JSON.parse(raw).state.mode;
          var dark = mode === 'dark' ||
            (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          if (dark) document.documentElement.classList.add('dark');
        } catch (e) {}
      })();
    </script>
```

- **变更 2**（`frontend/src/stores/themeStore.ts:78`）：`transitionType: 'fade'` → **`transitionType: 'none'`**，并在 `initialize()` 完成后（首帧渲染之后）再恢复用户偏好。
- **验证**：
  1. 预置 `rmfood-theme-storage` = `{state:{mode:'dark'},version:4}`，冷启动采样：**首次出现 `body` 背景色时即应为暗色**，且早于 `first-contentful-paint`；
  2. `localStorage['rmfood-theme-settings-v2']` 不再被引用（`rg 'rmfood-theme-settings-v2' frontend/` = 0）。
- **回滚**：恢复原脚本（单文件）。
- **工时**：0.5 人日
- **风险**：低。注意 `JSON.parse` 需容错（上面已处理）。

---

#### T-D2 · 消除 CSS 注入向量【D-33，安全】

- **文件**：`frontend/src/stores/theme.presets.ts`（`applyThemeToDOM` 行 549–596）
- **变更**：按规范 §7.3 的规范实现重写。核心三点：

```ts
// 1) 禁止字符串拼接；逐属性 setProperty（值先白名单校验）
const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,%\s/]+\)|hsla?\([\d.,%\s/deg]+\)|var\(--[a-z0-9-]+\)|linear-gradient\([^;{}]*\))$/;
for (const [name, value] of Object.entries(generateCSSVariables(theme))) {
  if (!/^--[a-z0-9-]+$/.test(name)) continue;
  if (!SAFE_COLOR.test(String(value).trim())) { logger.warn('拒绝不安全令牌值', name); continue; }
  root.style.setProperty(name, value);
}
// 2) 过渡交给 CSS 类，删除 opacity/transform 操作（见 T-D4）
// 3) 无障碍属性同步由 T-W1 处理
```

- **验证**：
  1. 注入 PoC：构造含 `;position:fixed` 的 value 导入，断言 `<html>` 未出现该声明；
  2. 单元测试覆盖 `SAFE_COLOR` 的边界（`;`、`}`、`url(`、`expression(`）。
- **回滚**：`git revert`。
- **工时**：1.5 人日（含测试）
- **风险**：中。`SAFE_COLOR` 过严会静默丢弃合法值 → 必须打日志并加测试。

---

#### T-D3 · 修复暗色 `--background`【D-9】

- **文件**：`frontend/src/styles/tokens/dark.css:230`
- **变更**：

```css
- --background: var(--color-primary-950, #022c22);
+ --background: var(--bg-canvas, #020617);
```

- **验证**：暗色下计算样式 `--background` === `#020617`（当前实测为 `#f0fdf4`）。
- **工时**：0.25 人日
- **风险**：低。会影响所有使用 `bg-background` 的 shadcn 组件（修复方向正确）。

---

#### T-D4 · 移除全页 opacity 过渡【D-8】

- **文件**：`frontend/src/stores/themeStore.ts:517-644`
- **变更**：删除 `applyFadeTransition` / `applySlideTransition` / `applyScaleTransition` 三个函数及 `applyThemeWithTransition` 的动画分支；改为：

```ts
async function applyThemeWithTransition(theme, transitionType) {
  const root = document.documentElement;
  if (transitionType !== 'none') root.classList.add('theme-transition');
  applyThemeToDOM(theme);
  useThemeStore.setState({ isTransitioning: true });
  // 用 transitionend 或固定时长解除标记
  setTimeout(() => { root.classList.remove('theme-transition');
                     useThemeStore.setState({ isTransitioning: false }); }, 220);
}
```

- **验证**：主题切换时 `<html>` 的 `opacity` 与 `transform` 内联样式**始终为空**；页面无整体淡出。
- **工时**：1 人日
- **风险**：中。`.theme-transition` 类会为全站元素挂 transition，需确认不干扰既有动画（该类已存在于 `index.css:200-215`，非新增）。

---

#### T-R1 · Radix Themes 前置条件与强调色【D-41(P0) + D-10】

- **目标**：终结「引入但没生效」的中间状态；修正绿色阶中的蓝色。
- **现状（实测）**：`@radix-ui/themes` 仅被 **2 个文件**引用（`theme/RadixThemeProvider.tsx`、`components/ui/RadixComponents.tsx`）；其样式表 `@radix-ui/themes/styles.css` **全仓 0 引用**，导致 `.radix-themes` 根节点上 `--gray-1`/`--gray-12`/`--font-size-2`/`--radius-3` **全部为空**。仅有组件内联 `<style>` 写入的 `--accent-1..12` 存在，其中 `--accent-6` = **`#0066cc`（蓝色）**、`--accent-9` = `#065f46`。
- **变更（二选一，需产品/架构决策）**：

  **方案甲 · 补齐（保留 Radix Themes）**
  1. 在 `frontend/src/main.tsx`（或 `App.tsx`）**最前**导入 `import '@radix-ui/themes/styles.css';`
  2. 把 `RadixThemeProvider.tsx:44-76` 的内联 `<style>` 移到 `frontend/src/styles/tokens/radix-bridge.css`，由 `index.css` `@import`；
  3. 修正 `--accent-1..12` 为**连续绿色阶**（对齐 `--color-primary-50..950`），删除 `#0066cc`；`--accent-9` 应是主色 `#10b981`（亮）/`#34d399`（暗）。

  **方案乙 · 移除（不推荐继续维护两套）**
  1. 删除 `@radix-ui/themes` 依赖与 `RadixThemeProvider.tsx`；
  2. `RadixComponents.tsx` 的两个封装（`Badge`/`Text`）改为项目自有组件；
  3. 移除 `pages/radix-demo/`。

- **验证**：
  1. 方案甲：计算样式断言 `--gray-1`、`--font-size-2`、`--radius-3` **均非空**；`--accent-9` === `--color-primary`；
  2. 方案乙：`rg '@radix-ui/themes' src` = 0，且构建通过；
  3. 两种方案均需对使用 Radix 的页面做亮/暗截图复核。
- **回滚**：`git revert`；方案甲的导入是单行，成本极低。
- **工时**：方案甲 1.5 人日 / 方案乙 1 人日
- **风险**：方案甲 **中** —— 导入 Radix 完整样式表会引入其全部令牌与组件样式，可能与现有 CSS 冲突并改变 `.radix-themes` 子树的外观，**必须**截图复核；方案乙 **低**。
- **决策点**：建议**方案乙**（仅 2 个消费点，且有 16 个 `@radix-ui/react-*` 原语包可继续使用，无需 `@radix-ui/themes` 这一层）。

---

### 阶段 1 — 一致性

---

#### T-B1 · 对齐 `theme.presets.ts` 色值与规范 §13【D-2/D-3 前置】

- **目标**：消除运行时注入值与 L0 静态令牌**同义不同值**的分叉。
- **文件**：`frontend/src/stores/theme.presets.ts`（`lightColors` 行 27–96、`darkColors` 行 99–168）
- **变更**：逐项对齐到 `base.css` / `dark.css` 的实际值。已知必改项：

  | 字段 | 当前值 | 应对齐为 |
  |:-----|:-------|:---------|
  | `lightColors.primary.main` | `#34C759` | **`#10b981`** |
  | `lightColors.primary.light` | `#86EFAC` | `#6ee7b7`（`--color-primary-300`） |
  | `lightColors.primary.dark` | `#065F46` | `#047857`（`--color-primary-700`） |
  | `lightColors.secondary.main` | `#007AFF` | `#3b82f6` |
  | `lightColors.tertiary.main` | `#AF52DE` | `#8b5cf6` |
  | `darkColors.primary.main` | `#4ADE80` | **`#34d399`** |
  | `darkColors.secondary.main` | `#6ECAFF` | `#60a5fa` |
  | `darkColors.tertiary.main` | `#C090FF` | `#a78bfa` |
  | `…其余 ~30 个角色` | — | 逐项比对 |

- **配套交付**：一个比对脚本 `scripts/theme-audit/preset-align.mjs`，在浏览器中：
  1. 对每个预设模式，读取 `<html>` 内联注入值与 `getComputedStyle` 计算值；
  2. 输出「字段 → 注入值 vs 静态令牌值」的差异表，退出码非 0 表示仍有分叉。
- **验证**：`preset-align.mjs` 输出 **0 处差异**；实测 `--color-primary` === `--color-primary-main`（若 B2 未做）或该族已消失。
- **工时**：2 人日
- **风险**：中。修改预设色值会改变 `ThemeSwitcher` 的色块预览与 `ThemeEditor` 预览；需一并复核。

---

#### T-B2 · 收敛令牌生成器命名【D-2/D-24】

- **前置**：**T-B1 必须已完成**（否则会把 Apple 绿写到权威令牌名上）。
- **文件**：`frontend/src/stores/theme.presets.ts`（`generateCSSVariables` 行 483–543）
- **变更（两步，可分别提交）**：
  - **B2a（改名）**：输出的令牌名从 `--color-<组>-<键>` 改为 L0 命名（`--color-primary`、`--text-primary`、`--bg-canvas` …），并**补充当前遗漏的断言**：`lineHeight` / `letterSpacing` 未导出、4 个字符串型 token（`surfaceVariant`/`errorContainer`/`outline`/`outlineVariant`）被 `typeof === 'object'` 过滤静默丢弃、`--z-modalBackdrop` 驼峰与静态 `--z-modal-backdrop` 不匹配。
  - **B2b（去冗余）**：对**内置预设**（`light-default`/`dark-default`）**不再注入令牌** —— 因为 `base.css` + `dark.css` + `.dark` 类已完整实现切换，注入纯属冗余。仅在「自定义主题」与「无障碍变体」时才注入差异部分。
- **验证**：
  1. `var(--color-primary-main)` 在代码库中引用数 = 0（`rg 'color-primary-main' src`）；
  2. B2b 后，切到内置预设时 `<html>` 的内联自定义属性数应为 **0**（当前实测 104）；
  3. 自定义主题与高对比度/阅读/色盲四种模式**仍正常工作**（截图 + 计算样式断言）。
- **工时**：B2a 1 人日 + B2b 1.5 人日
- **风险**：**高**（B2b）。删除注入可能暴露此前被内联样式掩盖的 CSS 缺陷。**必须**在 T-H1 门禁就绪后执行，且分两次提交。

---

#### T-W1 · 修复无障碍属性刷新丢失【D-39】

- **文件**：`frontend/src/stores/themeStore.ts`
- **变更（不改 `applyThemeToDOM` 签名，避免 5 处调用点改动）**：抽取共享 helper 并在 `initialize()` 中调用：

```ts
function syncA11yAttributes(mode: AccessibilityMode, themeMode: ThemeMode): void {
  const root = document.documentElement;
  root.setAttribute('data-a11y-mode', mode);
  if (mode === 'reading') {
    root.setAttribute('data-reading-mode', themeMode === 'dark' ? 'dark-read' : 'sepia');
  } else {
    root.removeAttribute('data-reading-mode');
  }
}
// initialize() 内，applyThemeWithTransition 之后：
syncA11yAttributes(state.accessibilityMode, baseTheme.mode);
// setAccessibilityMode() 内改为调用同一 helper（去重复）
```

- **验证**：GATE-07 通过 —— 设为 `reading` → 刷新 → `data-a11y-mode` === `'reading'` 且 `data-reading-mode` === `'sepia'`；`--text-primary` 保持 `#5C4B37`。
- **工时**：0.5 人日
- **风险**：低。

---

#### T-W2 · 补齐无障碍模式覆盖缺口【D-32】

- **文件**：`frontend/src/styles/components/semantic-utils.css:163-201`
- **变更**：
  1. **阅读模式补背景令牌**：`[data-reading-mode="sepia"]` / `["dark-read"]` 增加 `--bg-canvas`、`--card-bg-solid`、`--bg-secondary`、`--bg-surface-container`（当前只覆盖 `--bg-primary`/`--bg-surface`，而 body 读 `--bg-canvas`）；
  2. **高对比补正确令牌**：`--border-default` → 同时设置 `--border-color`（组件实际消费的是后者，见 `index.css:195`）；
  3. **新增 `[data-a11y-mode="color-blind"]` 规则**（当前 CSS 层零响应）；
  4. **消除 CSS 与 JS 双实现**：收敛为单一来源（建议保留 JS 侧 `getAccessibilityTheme()`，CSS 只做无法在 JS 中表达的补充）。
- **验证**：GATE-06 扩展断言 —— sepia 模式下 `body` 背景色必须变化（当前实测不变）；`color-blind` 模式下 `--color-success` 变化。
- **工时**：1.5 人日
- **风险**：中。涉及两套实现，需谨慎合并。

---

#### T-E1 · 统一图表取色通道【D-4 / D-43 / D-45】

- **文件**：
  - 保留：`frontend/src/utils/chartTheme.ts`（**唯一通道**）
  - 废弃：`frontend/src/utils/color-migration.ts`、`frontend/src/components/ai/DarkModeChartTheme.tsx`、`frontend/src/utils/themeColorMapper.ts`
  - 消费方：`pages/formula/components/CompositionChart.tsx`、`components/ai/charts/ChartComponent.tsx`
- **变更**：
  1. 把 `color-migration.ts` 的 `FORMULA_ROLE_COLORS` / `FORMULA_CATEGORY_PALETTE` 迁入 `chartTheme.ts`，并把缺失的 `--color-{success,warning,error,info}-light` **替换为存在的令牌**（`-400`/`-300` 档）；把 `--color-chart-1..5` 替换为实际令牌；
  2. 修复 `ChartComponent.tsx:23` / `CompositionChart.tsx:36` 的 `useMemo(…, [])` → 加入 `isDark` 依赖；
  3. 删除三个废弃模块及其引用。
- **验证**：
  1. GATE-08 通过（无失效 `var()` 引用）；
  2. 切主题后图表颜色**立即变化**（当前实测不变化）；
  3. `rg 'color-migration|themeColorMapper|DarkModeChartTheme' src` = 0。
- **工时**：3 人日
- **风险**：中。图表配色变化需视觉复核。

---

#### T-S1 · 状态一致性修复【D-34~D-40】

- **文件**：`frontend/src/stores/themeStore.ts`、`frontend/src/hooks/useTheme.tsx`
- **变更**：
  1. `setPresetTheme`（行 221）：**删除**按 ID 前缀强写 `mode` 的逻辑；`mode` 只由 `setThemeMode` 与系统监听器改变（D-34）；
  2. `partialize`（行 430-438）：纳入重建 `activeTheme` 所需字段，或改为水合后由 `activeThemeId` 重新派生 `activeTheme`（D-37）；
  3. `.dark` 类**单一写手**：移除 `RadixThemeProvider.tsx:26-28` 的 `classList.toggle`，由 `applyThemeToDOM` 独占（D-38）；
  4. 合并 `hooks/useTheme.tsx` 与 `stores/ThemeProvider.tsx` 的同名 `useTheme`（D-40）；
  5. `?theme=` 协议拆分：`?preset=` 传预设 ID，`?theme=` 传 base64（D-35）；
  6. `ThemeImport.tsx` 传入 `{ colors: {...} }` 结构以匹配 `mergeThemeOverrides`（D-36）。
- **验证**：
  1. 设 `mode='system'` → 点一次预设 → `mode` 仍为 `'system'`（当前会被强写）；
  2. 分享链接可被正确解析（当前静默回退）；
  3. 文件导入后主题实际变化（当前静默无效果）。
- **工时**：3 人日
- **风险**：中。

---

#### T-F1 · `chatTheme.css` 分阶段收敛【D-13/D-26/U-8~U-12】

- **先做（功能性 bug，独立可交付）**：删除与 `.dark` **成对重复**的 `@media (prefers-color-scheme: dark)` 块（约 20 处，`chatTheme.css:1643` 起），使对话区尊重用户的显式浅色选择。
- **再做**：
  1. 删除 `--dsw-*` 命名空间（26 个），引用改指全局令牌；
  2. 逐块替换 316 hex + 131 rgba；
  3. 删除手写 `.dark .chat-*` 覆盖块（约 60 处）；
  4. 修正 `chatDesignSystem.ts:1-10` 与实现矛盾的注释。
- **验证**：`rg '\-\-dsw-' src` = 0；系统暗色 + 应用浅色时对话区为浅色。
- **工时**：先做 0.5 人日；全量 5 人日（**禁止一次性重写 2 904 行**）
- **风险**：中-高（全量部分）。按模块分批。

---

#### T-D5 · 对齐动效与字重令牌命名【D-23】

- **目标**：让主题面板的「缓动」与「字重」调节**真正生效**。
- **现状（实测）**：`themeStore` 经 `generateCSSVariables` 写入 `--easing-easeOut`、`--weight-regular` 等，但全项目 CSS 有 **43 处**消费者读的是 `--ease-*`（如 `badges-tabs.css:16`、`focus-scroll.css:47`），`--weight-*` **零消费者** → 两族调节 100% 无效。
- **文件**：`frontend/src/stores/theme.presets.ts:508-511, 533-535`
- **变更**：

```ts
// 前：vars[`--weight-${key}`]  /  vars[`--easing-${key}`]
// 后（对齐 L0 命名）：
vars[`--font-weight-${key}`] = String(value);   // 或直接不再导出（base.css 已定义字重）
vars[`--ease-${key}`] = value;
```

并同步更新 `theme.types.ts` 中 `ThemeAnimation.easingFunction` 的键名映射与 `ThemeEditor` 的预览消费点。
- **验证**：
  1. 渲染断言：`getComputedStyle(html).getPropertyValue('--ease-easeOut')` 有值且 `--easing-*` 已消失；
  2. `rg 'var\(--easing-|var\(--weight-' src` = 0；
  3. 主题面板改缓动后，按钮 hover 过渡曲线实际变化。
- **回滚**：`git revert`。
- **工时**：0.5 人日
- **风险**：低。

---

### 阶段 2 — 架构收口

#### T-G1 · 死代码与死文件清理【D-18/19/25/27/30/42/48】 — ✅ 完成

> **交付**（commit `eb86dff` + `dc3393d` + `eb17cfb`）：删除 **24 个零引用孤岛文件**（2580 行），
> 外加前序删除的 `useTheme.tsx` / `useThemedComponent.tsx`。新增 2 个核验工具
> `find-dead-clusters.mjs`（活跃导入链分析）+ `verify-g1.mjs`（悬挂引用扫描，26 断言全过）。
> 全量门禁 **11/0/0**，`vite build` ✅。

**删除清单**（每项经 `find-dead-clusters.mjs` 活跃导入链判定 = 0 活跃导入方）：

  | 目标 | 依据 | 状态 |
  |:-----|:-----|:-----|
  | `styles/tokens/adjustments.css`（233 行） | 未被 `index.css` 导入（D-27） | ✅ 删除 |
  | `src/docs/theme-cleanup-{guide,report}.md` | 含危险命令（§14.3）+ 已失效 | ✅ 删除 |
  | `hooks/useThemedComponent.tsx`（171 行） | 0 引用（D-25） | ✅ 删除（`dc3393d`） |
  | `hooks/useTheme.tsx`（388 行） | 0 引用（D-18/D-40） | ✅ 删除（`dc3393d`） |
  | `utils/theme/{ThemeStorageAdapter,VersionController,ThemeShare}.ts` | 死闭环（D-18） | ✅ 删除 |
  | `utils/events/ThemeEventBus.ts` + `index.ts` | 零订阅（D-42） | ✅ 删除 |
  | `themeColorMapper.ts` | T-E1 已废弃 | ✅ 删除（T-E1 时） |
  | `types/theme-mode.ts` | 已标 `@deprecated` | ✅ 删除 |
  | `theme/themeUrlParser.ts` | 自封闭死岛（0 活跃导入方） | ✅ 删除 |
  | `components/theme/` 组件族 12 文件 | 0 引用（D-25） | ✅ 删除（仅余活跃 `ThemeSwitcher.tsx`） |

  **注**：原清单中「`design-system/rmfood/*`」「仓库根 `chatTheme.css`」经核查**不存在于当前树**
  （前序已删或路径有误）；「`ThemeSettingsPage.tsx` + 组件族的产品决策（删除 or 接入
  `SettingsPage`）」中组件族已删，`ThemeSettingsPage` 仍保留（见下）。

- **验证**：`verify-g1.mjs` 26/26 通过；`vite build` ✅；全量门禁 **11/0/0**。
  （`npx tsc -b` 因并发编辑者 `NotificationCenter.tsx:39` 类型错误阻断，非本次删除引入。）
- **保留项（需产品决策 U-1/U-2，未删）**：`pages/settings/ThemeSettingsPage.tsx` —— 0 引用，
  但方案要求「删除 or 接入 SettingsPage」二选一；`SettingsPage.tsx` 当前在并发编辑者 WIP 中，
  接入会触碰他人文件。已单独登记，待产品决策后处理。

---

#### T-G2 · 令牌层语义化【D-24，长期】

- **目标**：把 `base.css` 的语义层从「抄字面量」改为 `var()` 组合（当前 343 变量仅 44 处 `var()`）。
- **策略**：**按域分阶段，禁止一次性重写**：
  1. 颜色域：`--color-primary: var(--color-primary-500)` 等；
  2. 文字/背景域：`--text-primary: var(--color-neutral-900)`；
  3. 其他域（间距/圆角/阴影）已是别名或本就不变，跳过。
- **验证**：改 `--color-primary-500` 后 `--color-primary` **随之变化**（当前不会）。
- **工时**：3 人日
- **风险**：中。暗色反转语义下需确认别名方向正确（暗色 `--color-primary: var(--color-primary-400)` 而非 500）。

---

#### T-T1 · 建立主题系统测试覆盖【D-46】

- **目标**：从 **0 覆盖**（`tests/useTheme.test.ts` 全文注释禁用）建立回归保护。
- **文件**：新建 `frontend/src/stores/__tests__/themeStore.test.ts`、`frontend/src/stores/__tests__/theme.presets.test.ts`、`frontend/src/utils/__tests__/themeUrlParser.test.ts`
- **必须覆盖的用例**：

  | 类别 | 用例 |
  |:-----|:-----|
  | 值安全（T-D2） | `SAFE_COLOR` 拒绝含 `;` / `}` / `url(` 的值；接受 `#hex`/`rgb()`/`var(--token)` |
  | 迁移（R-13） | `getValidThemeId` 对 9 个已迁移 ID 回退到 `light-default` |
  | 持久化（R-12） | v3→v4 迁移幂等；损坏 JSON 不抛异常 |
  | 状态（T-S1） | `setPresetTheme` **不修改** `mode`；`partialize` 输出含恢复 `activeTheme` 所需字段 |
  | 无障碍（T-W1） | `initialize()` 后 `data-a11y-mode` 存在；`reading` 时 `data-reading-mode` = `sepia` |
  | URL 协议（R-22） | `?preset=` 与 `?theme=` 分别解析；base64 不再喂给 `setPresetTheme` |
  | 令牌生成（T-B2） | `generateCSSVariables` 输出名全部匹配 `/^--[a-z0-9-]+$/` 且属于 §3 白名单 |

- **验证**：`npm test` 通过；覆盖率报告中 `stores/theme*.ts` 行覆盖 ≥ 70%。
- **工时**：2 人日
- **风险**：低。需注意 `localStorage` 与 `matchMedia` 的 jsdom stub。

---

#### T-G3 · 清理重复样板与僵尸存储键【D-28 + D-44 + R-15】 — ✅ 完成（commit `b56f94e`）

> **交付**：`theme.storage.ts` 版本历史子系统删除（7 个 0 消费者方法 + `ThemeVersion` 接口，净删 ~120 行）；
> `themeStore.ts` v4 迁移后一次性清理 4 个遗留存储键；全 src `*, *::before, *::after` 全局
> reduced-motion 块 **14 → 1**（仅 `environment.css`）。`verify-g3.mjs` 21 断言全过。
> **勘误**：R-15 原文「rmfood-theme-settings-v2」键在 src 中不存在，实际僵尸键为 theme.storage.ts
> 的 4 个 `STORAGE_KEYS`，已按实际键名清理。D-28 原文「8 份」实测 14 个 CSS 文件。

- **子项 1：D-28 重复样板** — ✅ 完成。`prefers-reduced-motion` 的 `!important` 全局块
  收敛为 `environment.css` 一份（14 → 1）；特异性块（`.animate-*`、`.card-hover`、
  `.lp-reveal`、`.btn-*:active`、`micro-interactions.css` 等）保留。
- **子项 2：D-44 版本历史恒空 / 回滚无效** — ✅ 删除。`ThemeStorage` 的版本历史子系统
  （`getVersions`/`saveVersions`/`createVersion`/`getVersionHistory`/`clearVersionHistory`/
  `rollbackVersion` + `ThemeVersion` 接口）全链路 0 消费者，`rollbackVersion` 只返回
  version 对象从不应用状态，按「删除」处置（非修签名）。
- **子项 3：R-15 僵尸存储键** — ✅ 完成。`themeStore.ts` 的 v4 `migrate` 完成后增加一次性
  `localStorage.removeItem` 清理 4 个遗留键（`rmfood-custom-themes`/`rmfood-theme-state`/
  `rmfood-theme-preferences`/`rmfood-theme-versions`）。**活跃 persist 键 `rmfood-theme-storage` 保留不动**。
  `ThemeStorage` 类同步瘦身：删除 0 消费者的写方法（`saveThemeState`/`saveCustomThemes`/
  `clearAll`/`getStorageUsage`），保留 read-only 迁移方法（`loadThemeState`/`loadCustomThemes`），
  新增 `cleanLegacyKeys()`。

- **验证**：`verify-g3.mjs` 21/21 通过；`vite build` ✅；全量门禁 **11/0/0**。
- **残余**：`focus-scroll.css`（他人 D-57 WIP）中的 1 个全局块副本待其合并后删除。

---

### 阶段 3 — 治理落地

#### T-H2 · 治理与文档

| 任务 | 内容 |
|:-----|:-----|
| 重建 ESLint | 新增 `frontend/eslint.config.js`（flat config，ESLint 9），使 `npm run lint` 可用 |
| 接通 pre-commit | 新增 `.lintstagedrc.json`，至少对暂存的 `*.{ts,tsx,css}` 跑 `eslint --fix` 与 `theme:gate`（快速模式） |
| 重写 `scripts/theme-validate.ts` | ① 修正其 `SPEC_COLORS` 为规范 §13 权威值；② 扩展检查项至 §10 阻塞级清单；③ 注册为 `theme:validate` |
| 接入 CI | `npm run theme:gate` 纳入流水线；无服务时降级策略明确 |
| ADR 去重 | 修复 7 组重号（012 最紧急）；`index.md` 补登 11 个缺失文件 |
| 废弃文档标记 | 按规范 §14.3 处置 6 份文档 |
| 新增 ADR | 记录「令牌双源收敛」与「页头表面令牌」两项决策 |

- **工时**：3 人日
- **风险**：低。

---

## 4. 里程碑

| 里程碑 | 内容 | 退出条件 | 累计工时 |
|:-------|:-----|:---------|---------:|
| **M0** | 门禁就绪 | `npm run theme:gate` 可执行且**能正确判失败** | 3 pd |
| **M1** | 止血完成 | T-A1/A2/A3、T-C1、T-D1~D4、T-R1 全部完成；门禁中与 B/W/E 无关的断言全绿 | 14 pd |
| **M2** | 一致性完成 | T-B1/B2、T-W1/W2、T-E1、T-S1、T-D5、T-F1(先做) 完成 | 27 pd |
| **M3** | 架构收口 | T-G1、T-G2、T-G3、T-T1、T-F1(全量) 完成；内置预设下内联注入属性数 = 0 | 39 pd |
| **M4** | 治理落地 | T-H2 完成；CI 门禁生效；ADR/文档治理完成 | 42 pd |

---

## 5. 验证策略

### 5.1 三级验证

| 级别 | 手段 | 用于 |
|:-----|:-----|:-----|
| **L1 静态** | `rg` 断言、`tsc -b`、`theme-validate.ts` | 快速回归，pre-commit |
| **L2 编译产物** | 花括号深度追踪 `dist/assets/index-*.css` | 验证 `dark:` 归属（GATE-03） |
| **L3 渲染** | `scripts/theme-audit/*` + 截图 diff | 对比度、无障碍、视觉回归 |

### 5.2 逐项验证命令

```bash
cd frontend

# 全量门禁（L1+L2+L3 中的可自动化部分）
npm run build && npm run theme:gate

# 纯 CSS 隔离（无需服务）——验证 D-1
node scripts/theme-audit/theme-audit-isolation.mjs

# 对比度缺陷类（需服务）——验证 D-50
node scripts/theme-audit/theme-audit-whitefill2.mjs

# 页头像素级对比度（需服务）
node scripts/theme-audit/theme-audit-hero.mjs

# 无障碍刷新持久性 + 亮暗令牌全景（需服务）
node scripts/theme-audit/theme-audit-final.mjs

# 预设/L0 值一致性（T-B1 配套）
node scripts/theme-audit/preset-align.mjs
```

### 5.3 人工复核清单（每批次）

1. 六条路由（`/login`、`/dashboard`、`/formulas`、`/settings`、`/users`、`/ai`）亮/暗截图逐张对比基线；
2. 徽章（草稿/待审核/已批准/已拒绝/需修订/已归档）六种状态在两模式下的可读性；
3. 页头横幅 + 头像圆 + 主按钮在两模式下的观感；
4. 图表（趋势/饼图/柱状）切主题后即时变色；
5. 四种无障碍模式（标准/高对比/阅读/色盲）切换 + **刷新后**仍生效。

---

## 6. 附录

### 6.1 工时汇总

| 阶段 | 工时 |
|:-----|-----:|
| M0 门禁（T-H1） | 3 pd |
| M1 止血（T-A1/A2/A3、T-C1、T-D1~D4、T-R1） | 11 pd |
| M2 一致性（T-B1/B2、T-W1/W2、T-E1、T-S1、T-D5、T-F1 先做） | 13.5 pd |
| M3 架构收口（T-G1/G2/G3、T-T1、T-F1 全量） | 11.5 pd |
| M4 治理（T-H2） | 3 pd |
| **合计** | **42 人日** |

建议 2 人并行（WS-A/A2/A3/C1/D/R 可并行；**WS-B1 → WS-B2 必须串行**；WS-H1 阻塞全部验收），日历周期约 **5–6 周**。

### 6.2 T-A2 批量替换文件清单（22 个，逐字同一模式）

```
pages/academic/AcademicReportPage.tsx:205        pages/ai/AIAssistantPage.tsx:415
pages/batch/BatchDetailPage.tsx:121              pages/batch/BatchListPage.tsx:85
pages/batch/TracePage.tsx:119                    pages/compliance/ComplianceCheckPage.tsx:170
pages/dashboard/DashboardPage.tsx:559            pages/database/DatabasePage.tsx:774
pages/documents/DocumentExtractPage.tsx:136      pages/experiment/DoePage.tsx:555
pages/experiment/ExperimentListPage.tsx:184      pages/formula/FormulaListPage.tsx:900
pages/ingredient/IngredientAnalysisPage.tsx:130  pages/integrations/IntegrationsPage.tsx:234
pages/labels/LabelGeneratorPage.tsx:213          pages/notification/NotificationPage.tsx:125
pages/organizations/OrganizationsPage.tsx:346    pages/peptide-structure/PeptideStructurePage.tsx:124
pages/settings/SettingsPage.tsx:1650             pages/stability/StabilityPage.tsx:131
pages/user/UserManagementPage.tsx:760            pages/workflow/WorkflowPage.tsx:123
```

> `pages/analytics/AnalyticsPage.tsx:176` 为 `p-5` 变体，需单独处理。

### 6.3 风险登记表

| 风险 | 概率 | 影响 | 缓解 |
|:-----|:----:|:-----|:-----|
| T-A1 激活 14 912 处 `dark:` 引发大面积视觉回归 | 高 | 中 | 先存截图基线；手写 `.dark` 规则特异性更高可挡住一部分；分两次提交 |
| T-B2b 去注入暴露被掩盖的 CSS 缺陷 | 中 | 高 | 必须在门禁就绪后执行；分提交；保留回滚点 |
| T-A2 令牌取值使亮色页头变深，设计不认可 | 中 | 中 | 提前会签（**DEC-1**）；备选方案见 T-A2 |
| T-R1 方案甲导入 Radix 完整样式表引发大面积冲突 | 中 | 中 | 优先选方案乙（**DEC-2**）；若选甲则必须全站截图复核 |
| `SAFE_COLOR` 正则过严导致令牌静默丢失 | 中 | 中 | 打 warn 日志 + 单元测试边界 |
| 后台服务被环境回收导致渲染验证中断 | 高 | 低 | 每个脚本自包含登录+测量；或改用 `vite preview` |
| 22 处页头替换后仍遗漏 `p-5`/其他变体 | 中 | 中 | GATE-04 作为兜底断言，不靠人工清点 |

### 6.4 追溯矩阵（缺陷 → 任务）

| 缺陷 | 任务 | 阶段 |
|:-----|:-----|:-----|
| D-1 | T-A1 | M1 |
| D-50 | T-A2, T-A3 | M1 |
| D-21, D-22, D-12 | T-C1 | M1 |
| D-11, D-49 | T-D1 | M1 |
| D-33 | T-D2 | M1 |
| D-9 | T-D3 | M1 |
| D-8 | T-D4 | M1 |
| **D-41 (P0)** | **T-R1** | **M1** |
| D-10 | T-R1 | M1 |
| D-2, D-3 | T-B1, T-B2 | M2 |
| D-23 | T-D5 | M2 |
| D-24 | T-G2 | M3 |
| D-39 | T-W1 | M2 |
| D-32 | T-W2 | M2 |
| D-4, D-43, D-45 | T-E1 | M2 |
| D-34~D-40 | T-S1 | M2 |
| D-13, D-26 | T-F1 | M2/M3 |
| D-18, D-19, D-25, D-27, D-30, D-42, D-48 | T-G1 | M3 |
| D-28, D-44 | T-G3 | M3 |
| D-46 | T-T1 | M3 |
| D-5（**已推翻**） | **无任务**（仅记录为不良实践） | — |
| D-29, D-31, D-47 | 随 T-G1/T-G2 顺带处理 | M3 |
| G-1~G-9 / ADR / 文档 | T-H2 | M4 |
| CHK-01~CHK-25 | T-H1（门禁）+ 各任务 | M0–M4 |

> **追溯完整性**：规范 §11 登记的 **42 个缺陷 ID 全部有承接任务**（D-5 已实测推翻，明确无任务）。

---

## 7. 立即可执行的下一步

### 7.1 执行前必须做出的 3 项决策

| # | 决策点 | 选项 | 影响 | 建议 |
|:--|:-------|:-----|:-----|:-----|
| **DEC-1** | 页头表面令牌的取值（T-A2） | 甲：亮 `#047857`（白字 **5.55:1** ✅ AA）<br>乙：亮 `#059669`（白字 **3.77:1**，仅大文本达标） | 甲会**略微加深**亮色页头；乙保持现有观感但正文级不达标 | **甲**（合规优先；且页头含小字号文字） |
| **DEC-2** | Radix Themes 去留（T-R1） | 甲：补导入 `styles.css` 并修正强调色<br>乙：**移除** `@radix-ui/themes` 依赖 | 甲引入其全部令牌与样式，需大范围视觉复核；乙影响面仅 2 个文件 | **乙**（消费点仅 2 个，16 个 `@radix-ui/react-*` 原语不受影响） |
| **DEC-3** | 主题设置 UI 路线（T-G1） | 甲：删除 5 个孤儿主题组件（≈1 200 行）<br>乙：接入 `SettingsPage` | 甲减债；乙兑现 `ThemeOnboarding` 文案承诺的自定义主题能力 | 甲（除非产品明确要求自定义主题编辑器） |

### 7.2 第一个提交：T-H1

1. 新建 `frontend/scripts/theme-audit/theme-gate.mjs`，实现 GATE-01~GATE-08；
2. `frontend/package.json` 增加 `"theme:gate": "node scripts/theme-audit/theme-gate.mjs"`；
3. 在**当前未修复**代码上运行，**确认它以非 0 退出并列出预期的失败项**（至少 GATE-01/GATE-03/GATE-04/GATE-05/GATE-06/GATE-07）；
4. 提交该门禁 —— 此时流水线**应当标红**，这是期望状态，不是故障。

### 7.3 M1 推荐顺序（风险从低到高）

```
T-C1  (1.0pd) 删孤儿 :root       —— 最独立、可单文件验证、附带修复 D-22
T-D3  (0.25pd) 暗色 --background —— 单行改动
T-D1  (0.5pd) 首屏闪烁           —— 单文件
T-D2  (1.5pd) CSS 注入           —— 安全修复，带测试
T-D4  (1.0pd) 移除 opacity 过渡  —— 需复核 .theme-transition 影响
T-R1  (1.0~1.5pd) Radix 前置条件 —— 需 DEC-2
T-A2  (2.0pd) 页头对比度         —— 需 DEC-1；22 文件批量替换
T-A3  (1.0pd) 按钮对比度         —— 约 83 处
T-A1  (2.0pd) @custom-variant    —— 风险最高，放最后；先存截图基线
```

**为何把 T-A1 放在 M1 最后**：它会一次性激活 14 912 处此前未生效的 `dark:` 样式。在其余 P0 已修复、门禁与截图基线就绪之后再执行，才能把回归面控制在可甄别的范围内。

---

**文档结束**
