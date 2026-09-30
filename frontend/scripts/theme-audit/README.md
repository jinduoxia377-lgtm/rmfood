# RMFOOD 主题系统 — 运行时审计工具集

> 本目录是 [`docs/design/RMFOOD-主题系统设计规范.md`](../../../docs/design/RMFOOD-主题系统设计规范.md) §17「渲染验证方法」的可执行实现。
> 全部脚本**只读**：不修改仓库代码，仅在页面内做瞬时 DOM 探针与截图。

## 为什么需要渲染级审计

本工具集的建立源于一个实证结论：**纯静态审查对主题系统既漏报也误报。**

| 结论 | 静态审查的判断 | 渲染实测的结果 |
|:-----|:---------------|:---------------|
| 内联样式是否无界累加 | ❌ 判定为 P1 缺陷（`style.cssText +=`） | **推翻**：8 次切换后声明数恒为 104、重复令牌 0 |
| `--color-*-main` 变量 | ❌ 判定为"不存在 → 颜色透明" | **更正**：存在（运行时注入），问题是**值分叉** |
| 无 `dark:` 的文件是否漏色 | ❌ 预测 4 493 处 / 392 文件 | **更正**：实测五条路由惰性元素合计约 18 个 |
| 页头横幅暗色可读性 | 未发现 | **新增 P0**：实测对比度 **1.52:1** |

因此规范 §9.3 G-5 要求建立**渲染级 CI 门禁**，本目录是其起点。

## 环境要求

| 场景 | 要求 |
|:-----|:-----|
| `theme-audit-isolation.mjs` | **无需服务**。需先 `npm run build` 生成 `frontend/dist` |
| 其余脚本 | dev server `:3000`（`npx vite`）+ 后端 `:8000`（`uvicorn app.main:app`）；登录凭据取 `frontend/.env` 的 `VITE_DEFAULT_USERNAME/PASSWORD`（默认 `admin`/`admin123`） |
| 浏览器 | Playwright + Chromium（`npx playwright install chromium`） |

## 脚本清单

| 脚本 | 用途 | 关键产出 |
|:-----|:-----|:---------|
| **`theme-audit-isolation.mjs`** | **纯 CSS 隔离矩阵**：空白页注入生产 CSS，四条件 × 12 探针 | `temp/theme-css-isolation.json`。**验证 I5/D-1 的最简手段，无需服务** |
| `theme-audit-recon.mjs` | 环境侦察：页面状态、令牌解析、内联样式长度 | 控制台 + 首屏截图 |
| `theme-audit-deep.mjs` | 第 1 轮：`dark:` 归属、徽章对比度、无障碍属性、Radix 令牌、图表变量 | `temp/theme-runtime-results.json` |
| `theme-audit-deep2.mjs` | 第 2 轮：登录后 D-1 决定性实验、内联累加、FOUC、暗色盲区扫描、亮暗截图 | `temp/theme-runtime-results2.json` |
| `theme-audit-deep3.mjs` | 第 3 轮：多路由裸调色板惰性扫描 + 截图 | `temp/theme-runtime-results3.json` |
| `theme-audit-hero.mjs` | 页头横幅定位与**像素级**对比度（渐变必须像素采样） | `temp/theme-hero-contrast.json` |
| `theme-audit-whitefill2.mjs` | 「反转色阶 + 白字」缺陷类扫描（C-24 / D-50） | `temp/theme-white-on-fill2.json` |
| `theme-audit-final.mjs` | 最终合并：多路由白字对比度 + 无障碍刷新持久性 + 登录页亮暗截图 | `temp/theme-final-results.json` |

## 用法

```bash
cd frontend

# 1) 最简、无需服务：验证 dark: 变体归属与中性色阶反转
npm run build
node scripts/theme-audit/theme-audit-isolation.mjs

# 2) 需要服务：完整渲染审计
node scripts/theme-audit/theme-audit-deep2.mjs
node scripts/theme-audit/theme-audit-whitefill2.mjs
node scripts/theme-audit/theme-audit-final.mjs
```

产物写入仓库根的 `temp/`（JSON 结果 + `temp/theme-shots/` 截图）。

## 测量方法说明（重要）

1. **渐变背景必须像素采样**：`getComputedStyle(el).backgroundColor` 对 `background-image` 渐变元素返回透明，会得出错误结论。使用 `page.screenshot({ clip })` + Canvas 读像素（见 `theme-audit-hero.mjs`）。
2. **必须排除应用自身对 `.dark` 类的写入**：应用在 `mode === 'system'` 下会监听 `matchMedia` 并**自行添加 `.dark` 类**，污染实验条件。两种规避方式：
   - 用 `theme-audit-isolation.mjs`（空白页，零应用干扰）；
   - 或先经 store 锁定为显式 `light`/`dark` 模式。
3. **DOM 快照必须用稳定标记对齐**：不要按数组下标匹配亮/暗两次快照——实时页面 DOM 变动会导致下标错位。用 `element.setAttribute('data-xxx', n)` 标记后按属性读回。
4. **不得用 `color` 属性判断元素是否随主题变化**：文字色会被父级继承，产生假阳性。应比较元素**自身设置**的 `backgroundColor` / `borderColor`。
5. **WCAG 阈值**：正文 4.5:1；大文本（≥24px 或 ≥18.66px bold）3:1；图标/边框/UI 边界 3:1。

## 已知限制

- 仅覆盖桌面视口（1680×1050），未测移动端。
- 未覆盖打印样式、`forced-colors` 实际渲染。
- 未逐一渲染全部 392 个静态候选文件（采样式覆盖 6 条路由）。
- 依赖运行中的后端数据；空数据页面的元素数与真实使用可能不同。
