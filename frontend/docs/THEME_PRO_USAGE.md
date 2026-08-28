# Theme Pro Plugin — 使用指南

## 快速开始

### 方式一：通过 cordis_run 加载（推荐）

```bash
# 1. 在 DSH 中定义插件
# 2. 运行插件
cordis_run --pluginId theme-pro --packageId <packageId> --mode run
```

### 方式二：添加到 Agent Preset（持久化）

在 `~/.dsh/.agent-presets/<your-preset>/agent.cordis.yml` 中添加：

```yaml
- id: theme-pro
  name: './src/theme-pro/index.js'
```

### 方式三：通过 cordis.patch.yml 加载

编辑 `~/.dsh/profiles/web/cordis.patch.yml`：

```yaml
- id: theme-pro
  name: './src/theme-pro/index.js'
```

---

## 功能说明

### 1. theme_pro_analyze 工具

在对话中直接调用：

```
theme_pro_analyze(check: "gaps")
theme_pro_analyze(check: "contrast", color1: "#111827", color2: "#ffffff")
theme_pro_analyze(check: "css-vars")
theme_pro_analyze(check: "snapshot")
```

### 2. Settings 侧栏面板

加载插件后，DSH 设置侧栏会新增 **"Theme Pro"** 标签，包含：

| 标签 | 功能 |
|------|------|
| Overview | 合规评分、快捷统计、优先级操作 |
| Gaps | 设计差距详情（已修复状态） |
| Contrast | 对比度检查器（输入两个 HEX 颜色） |
| Colors | 品牌色/知识图谱色/配方状态色板 |
| CSS Vars | CSS 变量覆盖率报告 |

---

## 新增 CSS 变量用法

### 在 CSS 中直接使用

```css
.formula-card {
  background: var(--bg-surface, #fff);
  border-left: 3px solid var(--color-state-approved, #10b981);
}

.status-badge.approved {
  color: var(--color-state-approved, #10b981);
}

.kn-node.herb {
  fill: var(--color-kn-herb, #10b981);
}
```

### 在 React 组件中使用

```tsx
// 方式1: 内联样式
<div style={{ color: 'var(--color-state-pending)' }}>
  待审核
</div>

// 方式2: Tailwind（需先配置）
<span className="text-state-approved bg-state-approved/10">
  已批准
</span>

// 方式3: Hook
import { useTheme } from '@/theme';
const { theme } = useTheme();
```

### 在 TypeScript 中使用

```typescript
import { FORMULA_STATE_COLORS } from '@/types/formula-state-colors';
import { KNOWLEDGE_GRAPH_COLORS } from '@/types/knowledge-graph-colors';

// 获取配色
const approvedColor = FORMULA_STATE_COLORS.approved.main; // '#10b981'
const herbColor = KNOWLEDGE_GRAPH_COLORS.herb.main;       // '#10b981'
```

---

## 文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| Host 半 | `src/theme-pro/host/plugin.js` | themePro Service + 动态工具 |
| Client 半 | `src/theme-pro/client/plugin.js` | Settings 面板 UI |
| 入口 | `src/theme-pro/index.js` | Cordis 插件入口 |
| 配置 | `src/theme-pro/package.json` | NPM 包描述 |
| 报告 | `docs/THEME_PRO_ANALYSIS.md` | 完整分析报告 |
| 样式修复 | `design-system/rmfood/theme.css` | 新增 16 个 CSS 变量 |

---

## 注意事项

1. **主题切换后自动生效**：所有新增 CSS 变量随 `data-theme`/`data-mode` 属性自动切换明暗
2. **向后兼容**：旧变量名不受影响，新增为补充
3. **Tailwind 集成**：如需 Tailwind 类名支持，需在 `tailwind.config.js` 中添加扩展
4. **浏览器兼容性**：CSS 变量支持所有现代浏览器（IE 不支持）
