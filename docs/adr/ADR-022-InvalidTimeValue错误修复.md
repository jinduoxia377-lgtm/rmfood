# ADR-022 — Invalid time value 错误修复（公式详情页日期安全格式化）

**状态**：✅ 已执行  
**日期**：2026-08-16  
**领域**：前端 / TypeScript / 错误修复  
**前置**：[ADR-020](./ADR-020-TypeScript错误修复-配方案例页面.md)、[ADR-021](./ADR-021-配方管理页面UIUX深度审计与语义化修复.md)

---

## 问题

访问 `http://localhost:3000/formulas/14` 时出现运行时错误：

```
Invalid time value
错误 ID: err_1786877758043_1x2iraih
```

错误由错误边界捕获（`ErrorBoundary`），导致页面渲染中断。

## 根因分析

多处代码直接调用 `new Date(字段).toLocaleString()` / `.toLocaleDateString()`，未处理以下情况：

| 场景 | 后果 |
|:-----|:-----|
| `formula.createdAt` 为 `undefined`（API 未返回） | `new Date(undefined)` → `Invalid Date` → `.toLocaleDateString()` 抛出 |
| `formula.updatedAt` 为 `null` 或空字符串 | 同上 |
| `v.created_at` 在版本历史中为空 | 同上 |
| `activity.timestamp` 缺失 | ActivityTimeline 崩溃 |
| `comment.created_at` 缺失 | CommentItem 崩溃 |

后端 API 对某些字段可能返回 `null` 或省略该字段，前端代码假设其始终存在。

---

## 修复内容

### 新增：`lib/utils.ts` 安全日期工具

```ts
export function formatDate(
  dateInput: string | number | Date | null | undefined,
  locale = 'zh-CN',
  options?: Intl.DateTimeFormatOptions,
): string {
  if (dateInput == null) return '-'
  const d = new Date(dateInput)
  if (Number.isNaN(d.getTime())) return '-'
  try {
    return d.toLocaleString(locale, options)
  } catch {
    return String(dateInput)
  }
}

export function formatDateShort(dateInput, ...): string  // 仅日期
export function formatTime(dateInput, ...): string       // 仅时间
```

### 修改文件

| 文件 | 修改 |
|:-----|:-----|
| `pages/formula/FormulaDetailPage.tsx` | 5 处 `new Date(...)` → `formatDate(...)` |
| `pages/formula/components/ActivityTimeline.tsx` | 3 处 `new Date(...)` → `formatDate(...)` |
| `pages/formula/components/FormulaQuickView.tsx` | 1 处 `new Date(...)` → `formatDate(...)` |
| `pages/formula/components/CommentItem.tsx` | 2 处 `new Date(...)` → `formatDate(...)` |
| `lib/utils.ts` | 新增 `formatDate`、`formatDateShort`、`formatTime` |

---

## 验证结果

| 检查项 | 结果 |
|:-------|:----:|
| TypeScript 编译错误 | **0** ✅ |
| `new Date(x).toLocaleString()` 直接调用 | **0**（全部改为 formatDate） |
| 前端服务 http://localhost:3000 | HTTP 200 ✅ |
