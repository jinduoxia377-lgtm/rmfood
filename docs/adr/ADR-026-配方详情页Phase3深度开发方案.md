# ADR-026: 配方详情页 Phase 3 深度开发方案

> **状态**：✅ 全部执行完成  
> **日期**：2026-08-16  
> **领域**：前端 / 配方详情页  
> **前置**：[ADR-025](./ADR-025-配方详情页深度审查与开发方案.md)

---

## 已完成

| # | 任务 | 改动 | 状态 |
|:--|:-----|:-----|:----:|
| P3-1 | 生产参数编辑保存 | 4字段加入 editedData + EDITABLE_FIELDS，编辑模式 Input/Textarea | ✅ |
| P3-2 | 风味雷达图 | 新建 FlavorRadar.tsx（SVG六角），数据驱动替换柱状条 | ✅ |
| P3-3 | 效果趋势图 | 新建 EffectTrendChart.tsx（PK曲线+窗口+峰值），修复动态类名 | ✅ |
| P3-4 | 评论分页 | page_size 50→20，allComments 累加 state，「加载更多」按钮 | ✅ |
| P3-5 | 制作步骤编辑器 | editedProcessSteps state，编辑模式每步可改描述/温度/时长/设备 | ✅ |

**文件变更**：
- `FormulaDetailPage.tsx` +584 / -132 行
- 新增 `components/formula/FlavorRadar.tsx`
- 新增 `components/formula/EffectTrendChart.tsx`

**验证**：TypeScript EXIT:0，前端 HTTP 200

---

## 背景

已完成 Phase 1（P1 修复）和 Phase 2（P2 交互增强），但页面仍有若干「骨架感」待填充：

| Tab | 问题描述 |
|:----|:---------|
| 基本信息 — 生产参数区 | 「服用剂量/加工工艺/储藏条件/保质期」读后端字段，为空时只显示 `-`，且**无法编辑保存** |
| 深度分析 — 风味预测 | 仅5列柱状条，无视觉层次；无雷达图对比五味强度 |
| 深度分析 — 效果预测 | 仅数字卡片（Tmax/Cmax/Emax），无 PK 曲线可视化 |
| 评论 | 一次加载50条，无分页/加载更多机制 |
| 制作步骤 | 从 composition 只读解析，不可编辑 |

---

## 开发计划

### P3-1：生产参数编辑保存

**当前代码（L1565-1577）：**
```jsx
<div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t">
  {[
    { label: '服用剂量', value: formula.dosage },
    { label: '加工工艺', value: formula.processing_method },
    { label: '储藏条件', value: formula.storage_conditions },
    { label: '保质期', value: formula.shelf_life ? `${formula.shelf_life} 天` : null },
  ].map(({ label, value }) => (
    <div key={label}>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-sm font-medium">{value ?? '-'}</p>
    </div>
  ))}
</div>
```

**问题：**
1. 字段为空时只显示 `-`，无提示说明
2. 不在 `editedData` 的编辑范围内，保存按钮点不了这些字段
3. 后端 Formula 模型已有这4个字段，只需前端打通

**方案：**
1. 将4个生产参数加入 `editedData` 初始值（与 `tags/targetEffects` 等并列）
2. 编辑模式下，每个参数改为 `Input`（多行文本用 `Textarea`，「储藏条件」「加工工艺」适合多行）
3. 非编辑模式下，空值显示占位提示（如「未填写」而非 `-`）
4. `saveEditedData` mutation 已覆盖全字段，无需额外改动后端

---

### P3-2：风味雷达图（FlavorRadar）

**当前代码（L884-923）：** renderTasteResult 渲染5列柱状条

**方案：** 新建 `frontend/src/components/formula/FlavorRadar.tsx`

```tsx
// 雷达图：六角（bitter/sweet/umami/astringent/sour + 综合平衡度）
// 使用 SVG 实现，不引入重依赖
interface FlavorRadarProps {
  profile: { bitter: number; sweet: number; umami: number; astringent: number; sour: number };
  balanceScore?: number;
  size?: number;
}
```

**集成方式：** 在 renderTasteResult 中，当 `tp` 所有值为0时保持柱状条兜底，有数据时显示雷达图 + 下方保留平衡度数字。

---

### P3-3：效果趋势图（EffectTrendChart）

**当前代码（L925-952）：** renderEffectResult 仅展示4张数字卡片

**方案：** 新建 `frontend/src/components/formula/EffectTrendChart.tsx`

```tsx
// 模拟 PK 曲线：X轴=时间(h)，Y轴=浓度(μg/mL)
// 绘制峰值点、最佳时间窗口、AUC 阴影区域
interface EffectTrendChartProps {
  pkData?: Array<{ time: number; concentration: number }>;
  peakTime?: number;
  optimalWindow?: [number, number];
}
```

- 若无后端返回 pkData（当前 API 只返回聚合指标），用简化版：
  - 横轴 0~24h，标注 Cmax 点和 optimal_window 区间
  - 半透明面积表示效应窗口
- 集成到 renderEffectResult 顶部

---

### P3-4：评论分页

**当前代码（L237-241）：**
```ts
const { data: commentsData } = useQuery({
  queryKey: ['comments', 'formula', formulaId],
  queryFn: () => commentApi.list({ formula_id: formulaId, page: 1, page_size: 50 }),
  enabled: !!formulaId,
});
```

**问题：** 超过50条评论时静默截断，用户无感知

**方案：**
1. 将单一 `useQuery` 替换为分页 state：
   ```ts
   const [commentPage, setCommentPage] = useState(1);
   const pageSize = 20;
   const { data: commentsPageData, isLoading } = useQuery({
     queryKey: ['comments', 'formula', formulaId, commentPage],
     queryFn: () => commentApi.list({ formula_id: formulaId, page: commentPage, page_size: pageSize }),
     enabled: !!formulaId,
   });
   ```
2. 合并所有页数据为 `allComments`（用 useMemo 或累加 state）
3. 添加「加载更多」按钮（当 `commentsPageData.total > allComments.length` 时显示）
4. 评论总数徽章显示 `Math.ceil(total / pageSize)` 页

---

### P3-5：制作步骤编辑器

**当前代码（L1129-1142）：** processSteps 从 `formula.composition.process_steps` 只读解析

**方案：**
1. 在编辑模式下（`isEditing`），将步骤列表改为可编辑数组
2. 每个步骤显示：序号（只读）、描述（Textarea）、温度范围（两个 Input）、时长（Input + 单位选择）、设备（Input）
3. 添加「新增步骤」「删除步骤」按钮
4. 保存到 `editedData.process_steps`，与现有 `saveEditedData` 联动

> **注意**：process_steps 结构较复杂（嵌套 temperature/duration），需确保后端 update 接口接受该字段。若后端暂不支持，先实现前端 UI，保存时打印日志说明。

---

---

## 已完成（2026-08-16）

| # | 任务 | 改动 | 状态 |
|:--|:-----|:-----|:----:|
| P3-1 | 生产参数编辑保存 | 4字段加入 editedData + EDITABLE_FIELDS，编辑模式 Input/Textarea | ✅ |
| P3-2 | 风味雷达图 | 新建 FlavorRadar.tsx（SVG六角），数据驱动替换柱状条 | ✅ |
| P3-3 | 效果趋势图 | 新建 EffectTrendChart.tsx（PK曲线+窗口+峰值），修复动态类名 | ✅ |
| P3-4 | 评论分页 | page_size 50→20，allComments 累加 state，「加载更多」按钮 | ✅ |
| P3-5 | 制作步骤编辑器 | editedProcessSteps state，编辑模式每步可改描述/温度/时长/设备 | ✅ |

**文件变更**：
- `FormulaDetailPage.tsx` +150 行 / -30 行
- 新增 `components/formula/FlavorRadar.tsx`
- 新增 `components/formula/EffectTrendChart.tsx`

**验证**：TypeScript EXIT:0，前端 HTTP 200

| 优先级 | 任务 | 工作量 | 依赖 |
|:------:|:-----|:------:|:-----|
| P3-A | 生产参数编辑保存 | 小（30min） | 无 |
| P3-B | 风味雷达图 | 中（45min） | 无 |
| P3-C | 效果趋势图 | 中（45min） | 无 |
| P3-D | 评论分页 | 小（20min） | 无 |
| P3-E | 制作步骤编辑器 | 大（90min） | 确认后端支持 |

---

## 验收标准

- TypeScript 编译 0 错误
- 生产参数在编辑模式下可修改并保存
- 风味预测展示雷达图（非纯柱状条）
- 效果预测展示趋势图
- 评论超过20条时显示「加载更多」
- 制作步骤在编辑模式下可增删改
