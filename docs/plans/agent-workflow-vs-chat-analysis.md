# Agent 工作流 vs 智能对话 - 重构方案

## 问题诊断

### 重叠度分析
| 维度 | 重叠度 | 说明 |
|------|--------|------|
| 代码量 | 99% | 443行 vs 434行，几乎相同 |
| API 调用 | 80% | 共用 agentApi, workflowApi |
| UI 组件 | 60% | 工具调用日志、阶段显示 |
| 状态管理 | 70% | messages, tools, stages |

### 核心问题
1. **重复实现**：两者都实现了消息列表、工具调用显示
2. **API 耦合**：共享相同的底层执行逻辑
3. **用户困惑**：不知道应该用哪个模块

---

## 重构方案

### 阶段一：快速修复（本周）
- [ ] 统一导航样式
- [ ] 添加模块间跳转链接
- [ ] 消除明显重复代码

### 阶段二：组件抽取（2周内）
- [ ] 创建 `SharedAgentComponents` 目录
- [ ] 抽取 `ToolCallDisplay.tsx`
- [ ] 抽取 `StageProgress.tsx`
- [ ] 抽取 `AgentMessageList.tsx`

### 阶段三：架构合并（1个月内）
- [ ] 合并为统一入口 `AIAssistantPage`
- [ ] 添加模式切换器（工作流/对话）
- [ ] 统一状态管理

---

## 决策矩阵

| 方案 | 工作量 | 收益 | 风险 | 推荐度 |
|------|--------|------|------|--------|
| 保持现状 | 低 | 低 | 中（技术债） | ⭐⭐ |
| 组件抽取 | 中 | 高 | 低 | ⭐⭐⭐⭐ |
| 完全合并 | 高 | 极高 | 中（用户习惯） | ⭐⭐⭐ |
| 渐进合并 | 高 | 极高 | 低 | ⭐⭐⭐⭐⭐ |

---

## 推荐：渐进式合并

### Step 1: 抽取共享组件
```typescript
// shared/AgentComponents.tsx
export { ToolCallDisplay, StageProgress, AgentMessageList }
```

### Step 2: 统一入口
```typescript
// AIAssistantPage.tsx
<Tabs>
  <Tab value="chat">智能对话</Tab>
  <Tab value="workflow">Agent 工作流</Tab>
</Tabs>

// 内部统一使用 useUnifiedAgent hook
```

### Step 3: 智能路由
```typescript
// 根据用户意图自动选择模式
if (用户提到"工作流"/"流水线") → 工作流模式
else if (用户需要多轮对话) → 对话模式
else → 默认对话模式，支持手动切换
```

---

## 验收标准

- [ ] 代码重复率 < 30%
- [ ] 用户认知负荷降低（A/B 测试）
- [ ] 维护成本降低 40%
- [ ] 新功能开发效率提升 50%
