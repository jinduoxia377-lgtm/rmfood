# ADR-020 — 配方案例页面 TypeScript 错误修复

**状态**：✅ 已执行  
**日期**：2026-08-16  
**领域**：前端 / TypeScript  
**前置**：[ADR-019](./ADR-019-Dashboard-UIUX深度设计审计与执行.md)

---

## 问题

`FormulaCasesPage.tsx` 和 `FormulaCaseDetailPage.tsx` 存在多个 TypeScript 编译错误（预先存在，非本次改动引入）。

---

## 根因分析

### 1. Badge variant 值不存在

`BadgeVariant` 合法值：`'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'`

| 错误用法 | 修复 |
|:---------|:-----|
| `variant="secondary"` (L48, L187) | → `variant="info"` / `variant="neutral"` |
| `variant="outline"` (L53, L150) | → `variant="neutral"` |

### 2. Button variant 值不存在

`ButtonVariant` 合法值：`'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'outline' | 'warning' | 'glass' | 'amber'`

| 错误用法 | 修复 |
|:---------|:-----|
| `variant="destructive"` (L162) | → `variant="danger"` |

### 3. sonner 模块未安装

`import { toast } from 'sonner'` — 项目未安装 `sonner` 包，改用已有的 `useToastStore`。

### 4. Select onChange 事件类型推断异常

TypeScript 将 `onChange` 的 event 参数推断为带双重泛型的 `ChangeEvent<HTMLSelectElement, HTMLSelectElement>`，需显式添加类型注解。

---

## 修复内容

### FormulaCasesPage.tsx（4 处）

```diff
- <Badge variant="secondary" className="mb-2 text-xs">{caseItem.category}</Badge>
+ <Badge variant="info" className="mb-2 text-xs">{caseItem.category}</Badge>

- <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
+ <Badge key={tag} variant="neutral" className="text-xs">{tag}</Badge>

- onChange={(e) => setParams(prev => ({ ...prev, category: e.target.value || undefined, page: 1 }))}
+ onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParams(prev => ({ ...prev, category: e.target.value || undefined, page: 1 }))}

- onChange={(e) => setParams(prev => ({ ...prev, sort_dir: e.target.value as 'asc' | 'desc', page: 1 }))}
+ onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParams(prev => ({ ...prev, sort_dir: (e.target.value || 'desc') as 'asc' | 'desc', page: 1 }))}
```

### FormulaCaseDetailPage.tsx（4 处）

```diff
- import { toast } from 'sonner'
  (移除)

- <Badge variant="outline">AI生成</Badge>
+ <Badge variant="neutral">AI生成</Badge>

- <Button variant="destructive" size="sm" ...>
+ <Button variant="danger" size="sm" ...>

- <Badge key={tag} variant="secondary">{tag}</Badge>
+ <Badge key={tag} variant="neutral">{tag}</Badge>
```

---

## 验证结果

| 检查项 | 结果 |
|:-------|:----:|
| TypeScript 编译错误数 | **0** ✅ |
| Badge variant 全部合法 | ✅ |
| Button variant 全部合法 | ✅ |
| sonner 依赖移除 | ✅ |
| Select onChange 类型显式 | ✅ |
