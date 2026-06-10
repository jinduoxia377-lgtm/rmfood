# Migration Guide: v7.0 → v8.0

> **Target Audience**: Developers maintaining or extending the AI 智能配方平台  
> **Migration Complexity**: Medium (estimated 2-4 hours)  
> **Breaking Changes**: Yes (see below)  
> **Rollback Support**: Not recommended (schema changes)  

---

## Table of Contents

1. [Pre-Migration Checklist](#1-pre-migration-checklist)
2. [Breaking Changes Summary](#2-breaking-changes-summary)
3. [Step-by-Step Migration](#3-step-by-step-migration)
4. [Post-Migration Verification](#4-post-migration-verification)
5. [Troubleshooting](#5-troubleshooting)
6. [Feature Parity Table](#6-feature-parity-table)

---

## 1. Pre-Migration Checklist

Before starting migration, ensure you have:

- [ ] Backed up your current codebase (`git commit` or create a branch)
- [ ] Updated all dependencies to latest compatible versions:
  ```bash
  npm install react@18 react-dom@18
  npm install zustand@4 @tanstack/react-virtual d3@7 recharts@2 framer-motion@10
  npm install react-i18next i18next@23
  npm install prismjs katex
  ```
- [ ] Reviewed the breaking changes list below
- [ ] Allocated 2-4 hours for migration work
- [ ] Tested current build passes without errors (`npm run build`)

---

## 2. Breaking Changes Summary

| Category | Change | Impact | Effort |
|----------|--------|--------|--------|
| **State Management** | Context → Zustand | High | 30 min |
| **Plugin Architecture** | New required interfaces | Medium | 45 min |
| **Event Bus** | Strict typing enforcement | Low | 15 min |
| **i18n** | Hardcoded strings → t() calls | High | 60 min |
| **Component Props** | Some prop type changes | Low | 20 min |
| **Dependencies** | New peer dependencies | Medium | 10 min |

---

## 3. Step-by-Step Migration

### 3.1 Install New Dependencies

```bash
# Core new dependencies
npm install zustand react-i18next i18next d3@7

# Optional but recommended
npm install @tanstack/react-virtual prismjs katex
```

Update `package.json` peer dependencies if needed.

---

### 3.2 Migrate State Management (Context → Zustand)

#### Before (v7.x):

```tsx
// Old Context-based approach
import { ChatContext } from '@/contexts'

function MyComponent() {
  const { messages, sendMessage } = useContext(ChatContext)
  return <div>{messages.length} messages</div>
}
```

#### After (v8.0):

```tsx
// New Zustand-based approach
import { useGlobalStore, selectChatMessages } from '@/components/ai/features/state/store'
import { useChatMessages } from '@/components/ai/features/hooks/useChatMessages'

function MyComponent() {
  // Option A: Direct store access (optimized with selectors)
  const messages = useGlobalStore(selectChatMessages)
  
  // Option B: Through business hook (recommended)
  const { messages, sendMessage } = useChatMessages()
  
  return <div>{messages.length} messages</div>
}
```

**Key Changes**:
- Import path changed from `@/contexts` to `@/components/ai/features/state/store`
- Use selectors for performance: `selectAuth`, `selectAIConfig`, `selectWorkspace`
- Business logic hooks (`useChat*`, `useFormula*`) now handle state internally

---

### 3.3 Update Event Bus Usage

#### Before (v7.x):

```ts
eventBus.emit('chat:message-sent', { content: 'hello' })
```

#### After (v8.0):

```ts
import type { ChatEvents } from '@/components/ai/features/services/eventBus'

eventBus.emit<ChatEvents['chat:message-sent']>('chat:message-sent', {
  content: 'hello',
  timestamp: Date.now(),
  sessionId: 'current',
})
```

**Key Changes**:
- Events are now strictly typed
- Use generic type parameter `<PayloadType>` for type safety
- Event names must match predefined event type keys
- Payload objects may have additional required fields

---

### 3.4 Integrate i18n for User-Facing Strings

#### Before (v7.x):

```tsx
<button>发送消息</button>
<span>加载中...</span>
```

#### After (v8.0):

```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()
  
  return (
    <>
      <button>{t('chat.send')}</button>
      <span>{t('common.loading')}</span>
    </>
  )
}
```

**Migration Script** (semi-automated):

```bash
# Find all hardcoded Chinese strings (example patterns)
grep -r "发送\|加载\|确认\|取消\|删除\|编辑" --include="*.tsx" src/
```

**Common Translation Keys**:

| Old String | New Key |
|-----------|---------|
| 发送 | `chat.send` |
| 加载中... | `common.loading` |
| 确认 | `common.confirm` |
| 取消 | `common.cancel` |
| 删除 | `common.delete` |
| 编辑 | `common.edit` |
| 关闭 | `common.close` |
| 搜索 | `common.search` |
| 重试 | `common.retry` |
| 保存 | `common.save` |

---

### 3.5 Update Component Imports

Several components have been moved or renamed:

| Old Import Path | New Import Path | Notes |
|----------------|-----------------|-------|
| `@/components/ChatInput` | `@/components/ai/features/components/ChatInputArea` | Enhanced with smart features |
| `@/components/MessageBubble` | `@/components/ai/features/components/MemoizedChatMessage` | Now supports streaming |
| N/A (new) | `@/components/ai/features/components/SessionSidebar` | New multi-session UI |
| N/A (new) | `@/components/ai/features/components/ApiKeyConfigCenter` | New API Key management |
| N/A (new) | `@/components/ai/features/components/KnowledgeGraph` | New synergy visualization |
| N/A (new) | `@/components/ai/features/hooks/useFocusTrap` | New a11y utility hook |

---

### 3.6 Plugin System Integration (Optional)

If you were using custom feature modules, wrap them as plugins:

```tsx
// Before: Direct component usage
import MyCustomFeature from './MyCustomFeature'

// After: Plugin registration
import { AIPlugin, PluginManager } from '@/components/ai/features/plugins'

const myPlugin: AIPlugin = {
  id: 'company-my-custom-feature',
  name: 'My Custom Feature',
  version: '1.0.0',
  description: 'Custom feature description',
  capabilities: ['ui-extension'],
  component: React.lazy(() => import('./MyCustomFeature')),
  onInstall(ctx) {
    console.log('Plugin installed:', ctx.store.getState())
  },
}

// Register in app initialization
const pluginManager = new PluginManager()
pluginManager.register(myPlugin)
```

---

## 4. Post-Migration Verification

Run these checks to ensure successful migration:

### 4.1 Build Verification

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Production build
npm run build

# 3. Bundle size check (should be < 500KB gzipped)
npm run analyze  # if using webpack-bundle-analyzer
```

### 4.2 Functional Testing Checklist

- [ ] App loads without console errors
- [ ] Chat tab opens and sends messages correctly
- [ ] Streaming output renders smoothly (test with long responses)
- [ ] Session sidebar shows/hides properly
- [ ] API Key configuration saves and tests connection
- [ ] Formula generation wizard completes all steps
- [ ] Safety check displays risk indicators
- [ ] Knowledge graph renders nodes and allows interaction
- [ ] Language switcher toggles between zh-CN/en-US
- [ ] Keyboard navigation works (Tab through all interactive elements)
- [ ] Dark mode toggle functions correctly

### 4.3 Performance Baseline

```bash
# Run Lighthouse audit (target scores)
npx lighthouse http://localhost:3001/ai --only-categories=performance,accessibility --output=html

# Expected results:
# Performance: ≥ 90 (may vary from v7 baseline)
# Accessibility: ≥ 95 (significant improvement expected)
```

---

## 5. Troubleshooting

### Issue: "Cannot find module 'zustand'"

**Solution**:
```bash
npm install zustand
# Or if using yarn:
yarn add zustand
```

### Issue: "TypeScript error: Property 't' does not exist on useTranslation"

**Solution**: Ensure react-i18next is installed and types are correct:
```bash
npm install -D @types/react-i18next
```

### Issue: "EventBus generic type errors"

**Solution**: Update event emissions to include type parameter:
```ts
// Wrong:
eventBus.emit('my-event', data)

// Right:
eventBus.emit<MyEventPayload>('my-event', data)
```

### Issue: "Plugin not activating"

**Solution**: Check that all required interface properties are implemented:
```typescript
const plugin: AIPlugin = {
  id: string          // REQUIRED
  name: string        // REQUIRED
  version: string     // REQUIRED (semver)
  capabilities: []    // REQUIRED (can be empty array)
  // ... optional properties
}
```

### Issue: "Chinese text still showing after i18n integration"

**Solution**: 
1. Check that `i18n.init()` is called before React renders
2. Verify language pack files are not empty
3. Ensure `useTranslation()` hook is called in component
4. Check browser console for missing key warnings

---

## 6. Feature Parity Table

This table confirms all v7 features remain available in v8:

| v7 Feature | v8 Status | Location | Notes |
|------------|-----------|---------|-------|
| Basic Chat | ✅ Enhanced | `ChatTab.tsx` + `MemoizedChatMessage.tsx` | Added streaming + markdown |
| Message History | ✅ Enhanced | `useChatHistory.ts` | More export formats |
| Formula Generation | ✅ Enhanced | `GenerateTab.tsx` + `FormulaWizard.tsx` | Visual workflow added |
| Safety Checking | ✅ Enhanced | `SafetyTab.tsx` + safety components | Professional reports added |
| Synergy Analysis | ✅ Enhanced | `SynergyTab.tsx` + `KnowledgeGraph.tsx` | Interactive graph added |
| Taste Prediction | ✅ Enhanced | `TastePredictTab.tsx` + `FlavorWheel3D.tsx` | 3D visualization added |
| Stability Prediction | ✅ Enhanced | `StabilityPredictTab.tsx` + TimeSeries/Tornado | Advanced charts added |
| Academic Reports | ✅ Enhanced | `AcademicReportTab.tsx` + TemplateEngine | Template system added |
| Dark Mode | ✅ Unchanged | Global theme provider | No breaking changes |
| Error Handling | ✅ Enhanced | `ErrorBoundary.tsx` + `ErrorRecoveryDialog.tsx` | Better UX |
| Keyboard Shortcuts | ✅ Enhanced | `useKeyboardShortcuts.tsx` | Help modal (?) added |

**New Features in v8 (not in v7)**:
- ✅ Plugin architecture (dynamic module loading)
- ✅ Global state coordinator (Zustand)
- ✅ Multi-session management
- ✅ API Key encryption storage
- ✅ Batch safety checking
- ✅ Knowledge graph visualization
- ✅ 3D flavor wheel
- ✅ Version control for documents
- ✅ i18n (zh-CN + en-US)
- ✅ Focus trap accessibility utility
- ✅ Performance monitoring infrastructure

---

## Need Help?

If you encounter issues during migration:

1. **Check this guide** for common solutions
2. **Review ARCHITECTURE_v8.md** for system design details
3. **Examine existing implementations** in `/features/components/` for examples
4. **Open an issue** on GitHub with:
   - Error message (full stack trace if available)
   - Steps to reproduce
   - Your current package.json dependencies
   - Screenshots if UI-related

---

**Good luck with your migration! 🚀**

*Last Updated: 2026-05-12*
*Maintainer: RMFOOD Architecture Team*
