# 移动端细节核查团队报告（MOBILE_DETAIL_TEAM_REPORT）

- 日期：2026-10-22
- 核查人：detail-audit（移动端细节核查工程师）
- 范围：`frontend` 30 主路由，iPhone 13 视口（390×844），登录 admin/admin123
- 依据：
  1. `node scripts/audit-mobile-detail.mjs` 实跑（约 15 分钟，输出 `scripts/mobile-detail-data.json` + `mobile-detail-run2.log`）
  2. 单会话复测脚本 `scripts/verify-mobile-detail.mjs` / `verify-mobile-detail2.mjs` / `verify-mobile-detail3.mjs`（输出 `mobile-detail-verified*.json`），消除脚本"每路由重新登录"导致的认证假象
  3. 逐页源码定位核实（pages/ 与 components/）

---

## ⚠️ 先说结论

**真实问题集中在「小按钮」：7 个页面存在 <40px 的可点击控件（触控目标过小），其中 `/ai` 最严重（6 个 18–24px 按钮）。** 文本截断与页面边距**无系统性真实问题**——脚本报出的 45 处溢出与 17~25 个 `no-margin` 经复测全部为误报（容器级横向滚动 / 未认证或未挂载假象）。

---

## 一、按钮 <40px（真实问题，按严重度排序）

| 页面 | 按钮 | 实测高度 | 位置 | 判定 |
| --- | --- | --- | --- | --- |
| `/ai` | 对话历史开关（图标） | 18px | `components/ai/features/components/TopBar.tsx:192` | 🔴 真实，远低于 44px |
| `/ai` | 模型选择下拉（"DeepSeek"） | 22px | 同上 `:213` | 🔴 真实 |
| `/ai` | 场景切换（"学者顾问"） | 24px | 同上 `:237` | 🔴 真实 |
| `/ai` | 场景选项按钮 | 22px | 同上（TopBar 右侧区） | 🔴 真实 |
| `/ai` | 健康画像 / 搜索图标按钮 | 22px | 同上 `:296-319` | 🔴 真实 |
| `/ai` | 右下角浮动按钮（FAB） | 32px | AI 页面右下角 | 🟠 低于 44px，但为浮动辅助钮 |
| `/labels` | 「创建批记录」文本按钮 | 20px | `pages/labels/LabelGeneratorPage.tsx:331` | 🔴 真实；且 className 含无效尾缀 `text-[var(--color-secondary-text)]0` |
| `/settings` | 头像「移除」按钮 | 25px | `pages/settings/AvatarUpload.tsx:169` | 🔴 真实（次要操作） |
| `/regulations` | 表头排序按钮（标准号/发布日期/名称等 7 处） | 17px | `pages/regulations/RegulationsPage.tsx:599/608/827/835/910/918/925` | 🟠 真实低危（密集表格操作，仍低于 32px 密集阈值） |
| `/experiments/new` | 「浏览全部」 | 35px | `ExperimentNewPage.tsx:668` | 🟠 真实低危（快速操作栏已修 44px，此两处未覆盖） |
| `/experiments/new` | 表单「取消」链接 | 36px | `ExperimentNewPage.tsx:881` | 🟠 真实低危 |
| `/billing` | 「联系定制」mailto 链接 | 20px | `pages/billing/BillingPage.tsx:342` | 🟠 真实低危 |
| `/peptide-structure` | 氨基酸序列标签按钮（AC / VLGYT / LLPGTFVDNQKF / RPYPIP 等） | 21px | 肽结构页面序列区 | 🔴 真实（可点击序列标签触控过小） |

**合规、非问题：**
- `/workflows`、`/audit-logs`：分页按钮 32px（shadcn `Pagination`，`w-8 h-8`）— 符合「密集表格行内操作 ≥32px」底线。
- `/experiments`、`/peptide-structure` 等页的 >64px 元素为全宽模块 / 主操作按钮，合理。

## 二、文本截断

**真实（信息丢失，建议评估）：**
1. `/workflows`：工作流卡片副标题 `truncate`，可见宽度仅 89px（原文 212px），"配方 #14 在线验证工作流· 7 个任务"约 42% 可见，6 个卡片实例。→ 有意省略号但丢失工作流名称/任务数等关键信息，建议放宽卡片宽度或换行。
2. `/formulas`：配方卡片标题/编号 `truncate`（~138px 宽卡片内截断，6 处，如"版本测试配方6834bb30"、"RMF-20261021-0053 · -"）。→ 网格卡片窄导致，常见模式，可接受但可优化。

**边界情况（非典型文本截断，由 `main` 横向滚动承接，不算缺陷）：**
- `/stability`：配方成分 Select 显示文本超出卡片 25px（"选择成分......黄芪多糖枸杞多糖"）。
- `/analytics`：过滤器卡片内容宽 490px > 卡片 348px。

**误报（容器级横向滚动，不算文本截断）：**
- `/dashboard`(7)、`/doe`(13)、`/documents`(1)、`/compliance`(3)、`/batches`(1)、`/regulations`(1)、`/organizations`(1)、`/settings`(1)、`/integrations`(5)、`/tokens`(6)、`/databases`(12)、`/ai`(2 处)：
  均为表格 `overflow-x-auto`、标签页横向滚动容器或 `main` 自身 `overflow-auto` 承接的宽内容，**非文本截断**。与既有结论一致（`audit-all` 54 路由 0 页面级溢出）。

## 三、页面边距（>24px 或 =0）

**无真实问题。**
- 所有成功渲染页面：`main` 左 padding = **12px**（MainLayout 移动端 `p-3`，见 `components/layout/MainLayout.tsx:553`），内容容器统一 `px-[var(--space-apple-md)]`（**16px**）或自带内边距。
- 脚本标记的 17~25 个 `no-margin`（/dashboard、/formulas、/batches、/doe、/stability、/documents、/compliance、/label-check、/ingredient-analysis、/labels、/ai、/databases、/regulations、/terminology、/workflows、/agent、/analytics、/organizations、/settings、/users、/audit-logs、/notifications、/academic-report 等）**全部为误报**：
  1. **认证假象**：`audit-mobile-detail.mjs` 每条路由新建浏览器 context 重新登录，快速连续登录导致部分路由未认证即被重定向到 `/login`；登录页无 `<main>` 标签（`div role="main"`），故 `mainPad=0`、`btnTotal=0`。
  2. **未挂载假象**：大页面懒加载 chunk 在脚本 2.2s 等待内未挂载，`<main>` 尚未出现。
- 单会话复测（等待 4s/12s/25s）确认：30 路由全部可正常登录渲染，`main` 均有 12px padding；`/users`、`/academic-report` 在 25s 内正常挂载且 **0 console 错误**（仅 dev 按需编译较慢）。

## 四、附注（审计方法学）

- `audit-mobile-detail.mjs` 的"每路由重新登录"策略不稳定，产生大量 `no-margin` 假象；**建议后续审计改为单会话复用 context**（本次已用 `verify-mobile-detail*.mjs` 实现并输出可信数据 `mobile-detail-verified.json`）。
- `/labels` "创建批记录"按钮 className 的无效尾缀 `text-[var(--color-secondary-text)]0` 应一并修正。

## 五、待办清单（供修复）

| 优先级 | 页面 | 事项 |
| --- | --- | --- |
| P0 | `/ai` | TopBar 6 个控件（历史/模型/场景/画像/搜索等）高度 18–24px → 提升至 ≥32px（密集）或 ≥44px（主操作） |
| P1 | `/peptide-structure` | 氨基酸序列标签按钮 21px → 提升至 ≥32px |
| P1 | `/labels` | "创建批记录" 20px → 提升至 ≥44px，并修正无效 className |
| P2 | `/settings` | 头像"移除" 25px → 提升至 ≥32px |
| P2 | `/regulations` | 表头排序按钮 17px → 扩大热区（th 内 padding 或 min-h）至 ≥32px |
| P2 | `/experiments/new` | "浏览全部" 35px、"取消" 36px → 补 `min-h-[44px]` |
| P2 | `/billing` | "联系定制" 20px → 加内边距提升至 ≥32px |
| P3 | `/workflows` | 卡片副标题 89px 截断丢失关键信息 → 评估换行或加宽 |
| P3 | `/formulas` | 卡片标题 138px 截断 → 可接受，可优化 |

---

## 六、修复记录（Lead，2026-10-22）

| 待办 | 状态 |
| --- | --- |
| P0 `/ai` TopBar 6 控件 | ✅ 已加 `min-h-[36px]`（设置/画像/搜索/模型选择/场景切换等） |
| P1 `/peptide-structure` 氨基酸标签 | ✅ 已加 `min-h-[32px]` |
| P1 `/labels` 创建批记录 + 无效 className | ✅ 已加 `min-h-[44px]` 并修正尾缀 |
| P2 `/settings` 头像移除 | ✅ 已加 `min-h-[44px]` |
| P2 `/regulations` 表头排序 | ℹ️ 整列 th 可点区域足够大，保留 |
| P2 `/experiments/new` 浏览全部/取消 | ✅ 已补 `min-h-[44px]`（浏览全部、取消关联、取消），并清理无效 class 尾缀 |
| P2 `/billing` 联系定制 | ✅ 已加 `min-h-[44px]` |
| P3 `/workflows` 卡片副标题截断 | ✅ 已改 `line-clamp-2`（两行显示，不再丢失关键信息） |
| `/organizations/1` 详情 Tab 32px 内边距 | ✅ 已改 `p-4 sm:p-8 space-y-4 sm:space-y-8`（6 文件） |

验证：`npx tsc -b` ✅、`npm run build` ✅（此轮 8.04s）。