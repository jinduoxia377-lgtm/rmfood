# 移动端适配 QA 报告（2026-10-19）

## 结论（约 150 字）
构建通过、无横向溢出、字号达标。`tsc -b` 通过（exit 0）；`npm run build` 通过（exit 0，23.6s）。复用 audit-all 全路由结果：**0 横向溢出**；本次 iPhone 13 实测 /login、/landing overflow=0。body 17px（≥15✓）、最小字号 12px（≥11✓）、主按钮 44/48px（≥44✓）、页面边距 ≤20px✓。生产 CSS 已含 `main h1:20px`、`surface-primary` 移动端 padding 16px，横幅/标题达标。**待修复（引用审计，需后端恢复后复测）**：19 页存在 <44px 按钮（chip 类 `text-xs py-1.5`、文档工具按钮 24–42px）；/formulas/new 标题 36px 过大。

## 逐项结果

| # | 检查项 | 结果 | 数据 |
|---|--------|------|------|
| 1 | `npx tsc -b` | ✅ 通过 | exit 0，无类型错误 |
| 2 | `npm run build` | ✅ 通过 | exit 0，23.55s；仅有 chunk 体积/动态导入警告 |
| 3 | 全路由 375px 横向溢出 | ✅ 通过 | 复用 scripts/audit-all.log（10-18 登录态全路由）：overflow=0 offenders=0，问题页面 0 |
| 4 | 本次实测（iPhone 13） | ✅ 通过 | /login overflow=0、/landing overflow=0；/dashboard 因后端 8000 不可达重定向 /login，无法直接复测（历史审计为 0） |
| 5 | diagnose-broad.mjs | ⚠️ 未取得有效新数据 | 本次运行登录超时（`waitForURL dashboard` 15s 超时，exit 1），根因：后端 8000 未监听；历史 diagnose-broad-output.txt（11:38）maxH=0 属无效数据（页面未加载） |
| 6 | body 字号（计算样式） | ✅ 通过 | 实测 17px（`--text-body-apple`）≥15px |
| 7 | 最小文本字号 | ✅ 通过 | 实测 12px（text-xs）≥11px；审计建议移动端提升至 13px |
| 8 | 页面边距 | ✅ 通过 | 页面根容器 px 类 8–17px，实测 ≤20px |
| 9 | 主按钮高度 | ✅ 通过 | /login submit 48px、/landing CTA 44px，≥44px |
| 10 | 横幅高度 | ✅ 通过 | 生产 CSS 含 `.surface-primary...p-[...]` 移动端 padding:16px!important；无 >380px 超高块报告 |
| 11 | 超大标题 | ✅ 通过（CSS 兜底） | 生产 CSS 含 `main h1{font-size:20px!important}`、`main h2{font-size:18px!important}`；/ai h1=text-xl(20px) |

## 待修复项（依据 MOBILE_TYPOGRAPHY_AUDIT.md，后端恢复后需复测确认）

1. **触控目标 <44px（19 页）**：筛选/状态 chip `px-[var(--space-apple-sm)] py-1.5 text-xs`（28–30px）、文档/标签工具按钮（36px）、文字型按钮（16–24px）。建议：补 `min-h-[44px] inline-flex items-center` 或 chip 改 `py-2`。
2. **/formulas/new 页标题**：`.h1` 实测 36px。建议：移动端 `text-2xl/text-xl`（现已由 `main h1{20px!important}` 兜底，需复测确认）。
3. **12px 辅助文本**：移动端偏小，建议 `text-xs` → `text-[13px]`。

## 环境备注

- 后端 `http://localhost:8000` 未监听（health 连接失败），导致登录类脚本无法完成；未 kill/重启任何 node 进程。
- 仅新增本报告文件，未修改任何源码。