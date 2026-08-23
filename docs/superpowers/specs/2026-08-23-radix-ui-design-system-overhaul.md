# RMFOOD Design System Overhaul — Radix UI / shadcn/ui Migration

**Date**: 2026-08-23
**Status**: Draft
**Owner**: Frontend Team
**Related ADRs**: ADR-017, ADR-018, ADR-019 (previous UI/UX audits)

---

## 1. Executive Summary

Replace the current hand-rolled UI component library (~38 components, ~5,100 lines) with a shadcn/ui-based design system built on Radix UI primitives. The migration is **phased** to minimize risk to the active product. All existing design tokens, brand colors, and accessibility commitments are preserved.

**Outcome**: Professional, accessible, maintainable UI with:
- Radix UI primitives for all interactive components (dialogs, selects, tabs, etc.)
- shadcn/ui component templates styled with existing RMFOOD design tokens
- WCAG 2.2 AA compliance maintained and improved
- Gradual, verifiable migration per phase

---

## 2. Current State Analysis

### 2.1 Existing Stack
| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | React 18 + TypeScript | Stable, no changes needed |
| Styling | Tailwind v4 + CSS custom props | Keep; shadcn uses Tailwind |
| Icons | lucide-react | Already in use, no migration |
| Animation | framer-motion | Still needed for page transitions |
| State | zustand + TanStack Query | Architecture stays |
| UI Library | Custom (~5,100 lines) + partial antd | **Target for replacement** |
| Radix UI | Not installed | New dependency |
| shadcn/ui | Not installed | New tooling |

### 2.2 Existing UI Components (38 files, ~5,117 lines)
Located at `frontend/src/components/ui/`:

| Component | Lines | Replacement Path |
|-----------|-------|-----------------|
| Button.tsx | ~100 | shadcn `button` (customized) |
| Dialog/Modal.tsx | varies | Radix `@radix-ui/react-dialog` |
| Select.tsx | varies | Radix `@radix-ui/react-select` |
| Tabs.tsx | varies | Radix `@radix-ui/react-tabs` |
| Input.tsx | varies | shadcn `input` (customized) |
| Checkbox.tsx | varies | Radix `@radix-ui/react-checkbox` |
| Switch.tsx | varies | Radix `@radix-ui/react-switch` |
| Slider.tsx | varies | Radix `@radix-ui/react-slider` |
| Progress.tsx | varies | Radix `@radix-ui/react-progress` |
| Badge.tsx | ~50 | shadcn `badge` (customized) |
| Card.tsx | varies | shadcn `card` (customized) |
| Alert.tsx | varies | Radix `@radix-ui/react-alert-dialog` |
| Tooltip.tsx | varies | Radix `@radix-ui/react-tooltip` |
| Toast.tsx | ~200 | Radix `@radix-ui/react-toast` |
| CommandPalette.tsx | 425 | Radix `@radix-ui/react-command` |
| Skeleton.tsx | 380 | shadcn `skeleton` |
| Divider.tsx | ~30 | Simple CSS, keep or use shadcn |
| StatCard.tsx | varies | Custom card variant |
| PageHeader.tsx | varies | Custom layout component |
| EmptyState.tsx | ~250 | Custom, keep as-is |
| LoadingSpinner.tsx | varies | Custom, keep as-is |
| FocusRing.tsx | varies | CSS utility, keep |
| ...and 17 more | | |

### 2.3 Design Tokens to Preserve
From `frontend/src/styles/tokens/base.css` and `dark.css`:

- **Primary**: Forest Green (`#10B981` / `#0066cc` mid-tone)
- **Secondary**: Ocean Blue (`#3B82F6`)
- **Accent**: Bio Purple (`#8B5CF6`)
- **Semantic**: success, warning, error, info colors
- **Typography scale**: Already defined in `typography.css`
- **Elevation system**: Already defined
- **Dark mode**: Full token parity via `.dark` class

### 2.4 Accessibility Baseline
Current project already has:
- WCAG 2.2 AA focus ring system (`FocusRing.tsx`)
- `prefers-reduced-motion` media query support
- `aria-*` attributes on most components
- High contrast mode support in `environment.css`

**Goal**: Meet or exceed current baseline; Radix primitives provide built-in ARIA.

---

## 3. Migration Strategy

### 3.1 Why shadcn/ui?

| Factor | Decision |
|--------|----------|
| **Speed** | Pre-built component templates save weeks of implementation |
| **Quality** | Community-vetted, accessibility-first primitives |
| **Control** | Components are copy-pasted into the project — full ownership |
| **Integration** | Works natively with Tailwind v4 and CSS custom properties |
| **Risk** | Each component can be migrated independently |

### 3.2 Approach: Selective Replacement

We do NOT rewrite all 38 components at once. Instead:

1. Install shadcn/ui with brand token configuration
2. Add components one phase at a time
3. Replace imports in consuming code
4. Verify visually and via tests
5. Deprecate old component file

### 3.3 Token Mapping Strategy

shadcn/ui uses CSS variables like `--primary`, `--background`, etc. We map existing RMFOOD tokens:

```css
/* After shadcn init, override in globals.css */
:root {
  --background: var(--color-surface-light, #ffffff);
  --foreground: var(--color-text-primary, #1a1a2e);
  --primary: var(--color-primary-600, #059669);
  --primary-foreground: var(--color-primary-text, #047857);
  --secondary: var(--color-secondary-500, #3b82f6);
  --accent: var(--color-accent-500, #8b5cf6);
  --success: var(--color-success-main, #10b981);
  --warning: var(--color-warning-main, #f59e0b);
  --destructive: var(--color-error-main, #ef4444);
  --muted: var(--color-neutral-200, #e2e8f0);
  --muted-foreground: var(--color-text-secondary, #64748b);
  --border: var(--color-neutral-300, #cbd5e1);
  --radius: var(--radius-md, 0.5rem);
}
```

---

## 4. Phased Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal**: Install shadcn/ui, configure theme tokens, migrate 6 core primitives.

#### Tasks
1. **Install shadcn/ui**
   ```bash
   npx shadcn@latest init -d
   ```
   - Select Tailwind v4, CSS variables, Base UI
   - Overwrite existing `globals.css` carefully (preserve custom tokens)

2. **Configure theme tokens**
   - Map RMFOOD brand colors to shadcn variable names
   - Ensure dark mode parity
   - Test with `pnpm dev`

3. **Migrate core primitives**
   - `Button` → shadcn button (preserve all variants: primary, secondary, ghost, danger, ai, outline, glass)
   - `Dialog` → Radix `@radix-ui/react-dialog` (replaces Modal.tsx)
   - `Select` → Radix `@radix-ui/react-select` (replaces Select.tsx)
   - `Tabs` → Radix `@radix-ui/react-tabs` (replaces Tabs.tsx)
   - `Checkbox` → Radix `@radix-ui/react-checkbox` (replaces Checkbox.tsx)
   - `Switch` → Radix `@radix-ui/react-switch` (replaces Switch.tsx)

4. **Update index.ts exports**
   - Add new shadcn components
   - Keep backward-compatible re-exports during transition

#### Verification
- [ ] All 6 components render correctly in light and dark mode
- [ ] Existing pages using these components still work
- [ ] No TypeScript errors
- [ ] axe-core accessibility scan passes

---

### Phase 2: Surface Components (Week 2)

**Goal**: Migrate input-type and display components.

#### Tasks
1. **Migrate input components**
   - `Input` → shadcn input (preserve sizes, validation states)
   - `Textarea` → shadcn textarea
   - `Slider` → Radix `@radix-ui/react-slider`

2. **Migrate display components**
   - `Badge` → shadcn badge (preserve all variants)
   - `Card` → shadcn card (preserve StatCard integration)
   - `Skeleton` → shadcn skeleton (preserve preset variants)
   - `Progress` → Radix `@radix-ui/react-progress`

3. **Migrate feedback components**
   - `Tooltip` → Radix `@radix-ui/react-tooltip`
   - `Toast` → Radix `@radix-ui/react-toast` (replace Toast.tsx + ToastContainer.tsx)
   - `Alert` → Radix `@radix-ui/react-alert-dialog` + alert styling

4. **Update all consumer pages**
   - Run TypeScript compiler to find broken imports
   - Fix import paths gradually

#### Verification
- [ ] All form inputs work with keyboard navigation
- [ ] Toast notifications fire correctly
- [ ] Badge variants render with correct colors
- [ ] Card layouts match existing designs

---

### Phase 3: Complex Widgets (Week 3)

**Goal**: Migrate the heaviest components.

#### Tasks
1. **CommandPalette** (425 lines)
   - Replace with Radix `@radix-ui/react-command`
   - Preserve search functionality, keyboard shortcuts
   - This is the single largest component — allocate extra time

2. **DataTable enhancements**
   - Integrate with `@tanstack/react-table` (already installed)
   - Add shadcn table styling
   - Preserve sorting, filtering, pagination

3. **OperationFeedback** (381 lines)
   - Refactor using Radix primitives internally
   - Preserve animation patterns (framer-motion)

4. **EmptyState** (~250 lines)
   - Keep custom implementation (no Radix equivalent needed)
   - Style updates only if needed

5. **Dependency cleanup**
   - Remove unused antd imports
   - Audit remaining direct antd usage

#### Verification
- [ ] CommandPalette opens/closes with keyboard
- [ ] DataTable sorts and filters correctly
- [ ] No visual regressions in complex pages
- [ ] Bundle size impact assessed

---

### Phase 4: Page-Level Migration & Polish (Week 4)

**Goal**: Full visual audit of 3 representative pages, accessibility certification.

#### Tasks
1. **Dashboard page**
   - Update all chart containers, stat cards, tables
   - Verify responsive breakpoints

2. **Formula Editor page**
   - Migrate all form inputs, tabs, dialogs
   - Verify data binding still works

3. **AI Chat page**
   - Migrate chat input, message bubbles, sidebar
   - Verify WebSocket/status indicators

4. **Full accessibility audit**
   - Run axe-core on all migrated pages
   - Keyboard navigation test across all flows
   - Screen reader test (NVDA or VoiceOver)

5. **Documentation**
   - Update `components.json` documentation
   - Add component usage guide
   - Update ADR-027 with migration decisions

#### Verification
- [ ] All critical user flows pass manual testing
- [ ] Lighthouse accessibility score ≥ 95
- [ ] No console warnings or errors in production build
- [ ] Build passes `pnpm build` with zero errors

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing page layouts | Medium | High | Phase-by-phase rollout; keep old components as fallback |
| Design token mismatch | Low | Medium | Parallel CSS variable test before each phase |
| Bundle size increase | Low | Low | shadcn components tree-shake well; monitor with `rollup-plugin-visualizer` |
| antd removal breaks hidden usages | Medium | Medium | grep all antd imports before removal |
| Keyboard navigation regressions | Low | High | Run axe-core after each phase |
| TypeScript prop mismatches | Medium | Low | Strict mode catches most; incremental migration helps |

---

## 6. Success Criteria

| Criterion | Target |
|-----------|--------|
| Components migrated | 24 of 38 (phased) |
| TypeScript errors | 0 after each phase |
| Lighthouse accessibility | ≥ 95 |
| Build success | `pnpm build` green |
| Test coverage | ≥ 80% on migrated components |
| Bundle size delta | < 15% increase |
| Dark mode parity | All migrated components support both modes |

---

## 7. Out of Scope (for this spec)

- Backend API changes
- Database schema changes
- Full page rewrite (only component-level changes)
- Mobile-specific native app (web-only)
- Third-party integrations (OpenFoodFacts, etc.)

---

## 8. Appendix: Package Dependencies to Add

```json
{
  "@radix-ui/react-dialog": "^1.1.14",
  "@radix-ui/react-select": "^2.2.5",
  "@radix-ui/react-tabs": "^1.1.12",
  "@radix-ui/react-checkbox": "^1.3.2",
  "@radix-ui/react-switch": "^1.2.5",
  "@radix-ui/react-slider": "^1.3.5",
  "@radix-ui/react-progress": "^1.1.7",
  "@radix-ui/react-tooltip": "^1.2.7",
  "@radix-ui/react-toast": "^1.2.14",
  "@radix-ui/react-alert-dialog": "^1.1.14",
  "@radix-ui/react-command": "^1.1.16",
  "class-variance-authority": "^0.7.1",
  "tailwindcss-animate": "^1.0.7"
}
```

Existing dependencies retained:
- `clsx` + `tailwind-merge` (already installed, used by shadcn)
- `lucide-react` (already installed)
- `framer-motion` (already installed, still needed)
- `@tanstack/react-table` (already installed)
- `zustand` (already installed)
