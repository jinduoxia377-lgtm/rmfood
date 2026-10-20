# 测试隔离清单（Test Quarantine）

> 目的：让 `test-frontend` CI（`npx vitest run -c vitest.ci.config.ts`）保持**稳定可用**。
> 以下文件因「实现重构后测试未同步（API 漂移）」或「环境/时序依赖」被从 CI 单测中排除，
> 不代表实现无缺陷——**请按本清单逐文件修复后移出隔离**。
>
> 修复原则：优先将测试**对齐当前实现 API**（而非放宽断言），参考已修复范例：
> `MessageList.test.tsx`、`clipboardAttachmentService.test.ts`、`useChatTabOrchestrator.test.ts`、
> `formulaParser.test.ts`、`useFormulaAnalysis.test.ts`。

## 隔离原因分类

| 代号 | 含义 |
|:----:|:-----|
| API 漂移 | 测试引用已移除/变更的 API（如函数变布尔、受控组件化、功能删除） |
| 时序依赖 | React 19 + fake timers 调度差异，同步状态未在断言前 flush |
| 环境依赖 | 依赖浏览器/图片解码/网络等 jsdom 不提供的能力 |
| 慢/重 | 收集或执行极慢，导致 CI 超时或流水线卡死 |

## 隔离清单（2026-10-18 状态）

**当前无隔离测试文件** —— 原始 26 个漂移文件已全部修复并移出隔离（见下方清单）。

## 额外排除（CI 稳定性）

| 目录 | 原因 |
|:-----|:-----|
| `**/__tests__/e2e/**` | Playwright E2E，由 `npm run test:e2e` 独立运行 |
| `**/__tests__/integration/**` | 重量级集成测试，收集/执行极慢，易导致 CI 卡死 |

## Lint 债务（2026-10-18 更新）

- ✅ **src/components/database/** 已专项清零（240 errors → 0，tsc 通过）。
- ✅ **src 区域 Top 38 文件已清零**（五批共消除 **648 errors**）。
- ⚠️ 剩余约 **1525 处 lint error**，分布在 500+ 文件，需后续多轮继续清理。
- CI 的 ESLint 步骤保持 `continue-on-error: true`（非阻塞）。
- 待全项目 lint 债务清理后，应：
  1. 移除 `.github/workflows/ci-cd.yml` 中 ESLint 步骤的 `continue-on-error`；
  2. 从本文件删除此节。

## 已修复并移出隔离（2026-10-17）

- `src/components/ai/features/components/__tests__/MessageList.test.tsx`（8 项：打字机动画时序 + 过时选择测试 + 性能阈值）
- `src/components/ai/features/services/__tests__/clipboardAttachmentService.test.ts`（5 项：jsdom 图片缩略图 mock + 断言对齐）
- `src/components/ai/features/hooks/__tests__/useChatTabOrchestrator.test.ts`（2 项：对齐 v12 精简 API）
- `src/utils/__tests__/formulaParser.test.ts`（2 项：修复 extractAllFormulas 允许未命名配方）
- `src/hooks/__tests__/useFormulaAnalysis.test.ts`（23 项：fake timers 先推进后 await + React flush + 受控 API）
- `src/components/ai/features/__tests__/unit/i18nAiMerge.test.ts`（3 项：修复 src/i18n.ts 改用模块化语言包，补齐 AI 模块翻译）
- `src/components/ai/features/utils/__tests__/agentTeams.test.ts`（1 项：修复 TaskDAG.topologicalSort 错误的 .reverse()，依赖顺序颠倒）
- `src/utils/__tests__/fileSecurity.test.ts`（3 项：修复 sanitizeFileName 路径遍历检测被字符替换绕过；对齐空字节/控制字符语义；修正 DataURL 边界测试）
- `src/components/ai/features/utils/__tests__/workflowEngine.test.ts`（1 项：工具节点缺少 config.tool 校验；测试改用 condition 节点验证执行链路）
- `src/components/ai/features/__tests__/unit/services/storageService.test.ts`（1 项：非 JSON 信封内容视为脏数据返回 null）
- `src/services/professional/peptideService.test.ts`（2 项：'INVALID' 实为合法氨基酸序列，改用真非法序列；组成断言 V=2 修正）
- `src/components/ai/features/FormulaIngredientInput/utils.test.ts`（1 项：createNewIngredient 中 require('./types') 在 ESM 环境失败，改为顶部 import）
- `src/stores/__tests__/exportStore.test.ts`（1 项：过时的 mock.context() API 调用移除）
- `src/components/ai/features/hooks/__tests__/useChatCallbacks.test.ts`（1 项：异步回调未 await 的 act 污染后续用例）
- `src/__tests__/components/ui/shadcn-components.test.tsx`（2 项：aria-checked 不设置 DOM checked；缺席断言改用 queryByRole）
- `src/components/ai/features/utils/__tests__/waterfall.test.ts`（6 项：jest.fn 改为 vi.fn）
- `src/components/ai/features/utils/__tests__/sessionManager.test.ts`（9 项：require('./tokenEstimator') 改 ES import + mock EventSourcedSession 避免 IndexedDB）
- `src/stores/__tests__/reviewStore.test.ts`（3 项：ReviewStatus/StageStatus 补 'rejected'；拒绝即整体拒绝；canAdvance 语义修正；失败时设置 error）
- `src/__tests__/components/ui/a11y-compliance.test.tsx`（1 项：aria-checked 不设置 DOM checked，改断言 ARIA 属性）
- `src/tests/KnowledgeGraph.test.tsx`（1 项：组件渲染 SVG 无「知识图谱」标题，改断言 svg 存在）
- `src/tests/accessibility/Button.a11y.test.tsx`（1 项：Button 补 aria-disabled 属性）
- `src/__tests__/frontend-core.test.ts`（2 项：fake timers 下用 advanceTimersByTimeAsync；custom 为 Record 非数组）
- `src/stores/__tests__/collaborationStore.test.ts`（19 项：mock WebSocket 握手 + undo/redo 权限检查 + disconnect 清权限 + getActiveParticipants 排除当前用户 + syncOperations 测试修正）
- `src/components/ai/features/hooks/__tests__/useChatInputState.test.ts`（17 项：修复 useChatInputBehavior 的 initialValue effect 覆盖用户输入、useChatInputState 的 errorMessage 恒空、triggerDeepThinking 打开面板；重写测试适配受控 API）
- `src/hooks/__tests__/usePermissions.test.ts`（12 项：usePermissions 已重构为纯用户权限派生 hook，重写测试适配新 API）
- `src/components/ai/features/__tests__/unit/FormulaVisualization.test.tsx`（12 项：ResizeObserver mock 解决 recharts；修正多匹配/性能阈值/候选卡片交互断言；FormulaWizard 保存按钮补 aria-label）
- `src/components/ai/features/hooks/__tests__/useChatMessages.test.ts`（11 项：hook 已重构为流式 sendMessage + retractMessage，重写测试适配新 API）
- `src/components/ai/features/__tests__/unit/services/deepThinkingService.test.ts`（11 项：服务已重构为 V2（deepThinkingServiceV2），重写测试适配 V2 API）
- `src/__tests__/excel-export.test.ts`（10 项：修复 exportService 解构导出丢失 this 的真实生产缺陷；空数据行为、样式导出（exportWithStyles）、性能断言对齐当前 API）
- `src/tests/LoginPage.test.tsx`（9 项：useAuthStore mock 需提供完整 state（clearTwoFactor 等）；登录调用第三参为 undefined 的断言修正）
- `src/tests/accessibility/LoginPage.a11y.test.tsx`（6 项：useAuthStore mock 需用 mockImplementation 模拟 selector 语义）
- `src/components/ai/features/utils/__tests__/subagent.test.ts`（3 项：mock fetchWithCsrf 避免真实网络；修复 SubagentImpl id 在同一毫秒重复导致 map 覆盖的真实缺陷）