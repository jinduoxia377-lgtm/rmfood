# ADR-023 — 公式详情页 React Hooks 顺序错误修复

**状态**：✅ 已执行  
**日期**：2026-08-16  
**领域**：前端 / React / TypeScript  
**前置**：[ADR-020](./ADR-020-TypeScript错误修复-配方案例页面.md)、[ADR-022](./ADR-022-InvalidTimeValue错误修复.md)

---

## 问题

访问 `http://localhost:3000/formulas/14` 时报错：

```
Rendered more hooks than during the previous render.
错误 ID: err_1786879044938_8hkc7bna
```

---

## 根因分析

`FormulaDetailPage.tsx` 存在 **18 个 React Hooks**（15 个 `useCallback` + 3 个 `useMemo`）被定义在组件函数体内的 **early return 之后**（L364–L1068），违反了 React Hooks 规则。

### 问题结构

```
L98–321  : 所有 useState/useMemo/useEffect 等 hooks ✅（在 early return 之前）
L322–345 : Early returns (isLoading, !formula) ⚠️
L347–1081: 混入了 18 个 hooks（useCallback/useMemo）❌ + 普通函数
L1083    : return ( JSX
```

当 `isLoading=true` 时，组件在 L324 提前返回，**不会执行 L364+ 的 hooks**。  
当下一次渲染 `isLoading=false` 时，这些 hooks 才会执行，导致两次渲染的 hook 数量不一致 → React 抛出错误。

### 受影响的 Hooks

| 行号 | Hook | 名称 |
|:----:|:----:|:-----|
| L364 | useCallback | getChangedFields |
| L379 | useCallback | isFieldChanged |
| L389 | useCallback | startEditing |
| L402 | useCallback | cancelEditing |
| L409 | useCallback | saveEditedData |
| L454 | useCallback | updateEditedField |
| L493 | useCallback | loadRecommendations |
| L513 | useCallback | toggleIngredientExpand |
| L523 | useCallback | copyIngredientListToClipboard |
| L585 | useCallback | runAllAnalyses |
| L624 | useCallback | runOptimizeLP |
| L641 | useCallback | runExportFormula |
| L669 | useCallback | runApplyOptimization |
| L685 | useCallback | runSaveAnalysis |
| L695 | useCallback | runAnalysis |
| L1037 | useCallback | handleTabChange |
| L1059 | useMemo | totalDosage |
| L1068 | useMemo | processSteps |

---

## 修复内容

### 1. FormulaDetailPage.tsx — Hooks 重排

将所有 18 个 hooks 从 early return 之后（L347–1081）移至 early return 之前（L322 之前），确保每次渲染 hook 调用顺序一致。

同时添加 `formula` 空值守卫以避免 TypeScript 类型错误：

```tsx
// startEditing — 添加 null guard
const startEditing = useCallback(() => {
  if (!formula) return;  // ← 新增
  setEditedData({ ... });
}, [formula]);

// saveEditedData — 添加 null guard
const saveEditedData = useCallback(async () => {
  if (!formula) return;  // ← 新增
  ...
}, [editedData, formula, ...]);

// loadRecommendations — 添加 null guard + 可选链依赖
const loadRecommendations = useCallback(async () => {
  if (!formula) return;  // ← 新增
  ...
}, [formula?.targetEffects, addToast]);  // ← 可选链
```

### 2. FormulaListPage.tsx — 移除重复导入

之前脚本引入的重复 lucide-react 导入：
- `TrendingUp` 重复导入（L18 和 L36）
- `Clock` 重复导入（L19 和 L45）

### 3. FormulaCasesPage.tsx — 修复 CaseStats 类型冲突

移除了与 `api/formula.ts` 不兼容的本地 `CaseStats` 接口定义，改用 TypeScript 自动推断 `useQuery` 返回值类型。

---

## 验证结果

| 检查项 | 结果 |
|:-------|:----:|
| TypeScript 编译错误 | **0** ✅ |
| FormulaDetailPage hooks 位置 | 全部在 early return 之前 ✅ |
| 前端服务 http://localhost:3000 | HTTP 200 ✅ |
| 后端服务 http://localhost:8000 | HTTP 200 ✅ |
| 重复导入清理 | TrendingUp: 1次, Clock: 1次 ✅ |
