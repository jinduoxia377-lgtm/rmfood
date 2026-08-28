# RMFOOD Design System Overhaul — Radix UI Themes Integration

**Date**: 2026-08-24
**Status**: Draft
**Related**: ADR-027 (shadcn/ui migration completed)

---

## 1. Executive Summary

This plan extends the completed shadcn/ui migration (ADR-027) by integrating **Radix UI Themes** — a professional, production-ready component library built on top of Radix primitives. Radix Themes provides:

- Pre-styled components with consistent design tokens
- Professional typography system (3 styles: "default", "modern", "classic")
- Dark mode support built-in
- Color customization via CSS variables
- Responsive and accessible by default

**Goal**: Transform RMFOOD from a Material Design 3 hybrid UI into a cohesive, professional enterprise design system using Radix UI Themes as the foundation, while preserving existing brand tokens and business logic.

---

## 2. Current State Analysis

### 2.1 Existing Stack
| Layer | Technology | Status |
|-------|-----------|--------|
| Framework | React 18 + TypeScript | ✅ Stable |
| Styling | Tailwind v4 + CSS vars (234 vars) | ✅ Active |
| UI Library | shadcn/ui + Radix primitives | ✅ Migrated (16 components) |
| Icons | lucide-react | ✅ In use |
| Animation | framer-motion | ✅ Still needed |
| State | zustand + TanStack Query | ✅ Architecture stays |
| Layout | Material Design 3 (MainLayout v5.0) | ⚠️ Needs refresh |
| Theme | Custom light/dark system | ⚠️ Merge with Radix Themes |

### 2.2 Design Token Inventory (234 CSS Variables)
**Primary (Forest Green)**: `--color-primary-50` through `--color-primary-950`, `--color-primary`, `--color-primary-rgb`, `--color-primary-hover`, `--color-primary-container`, `--color-primary-text`

**Secondary (Ocean Blue)**: `--color-secondary-50` through `--color-secondary-950`, `--color-secondary`, `--color-secondary-rgb`, `--color-secondary-hover`, `--color-secondary-container`

**Accent (Bio Purple)**: `--color-accent-50` through `--color-accent-950`, `--color-accent`, `--color-accent-rgb`, `--color-accent-hover`

**Semantic**: success, warning, error, info (each with 10-shade scale)

**Neutral**: `--color-neutral-default`, `--color-neutral-subtle`, `--color-neutral-muted` (light/dark variants)

**Typography Scale**: h1–h6, body-lg/md/sm, caption, overline

**Radius Scale**: xs(4px), sm(6px), md(8px), lg(12px), xl(16px), 2xl(20px), full/pill

**Elevation**: shadow-sm/md/lg/xl with light/dark variants

**Spacing**: 4px baseline grid (xs/s/m/l/xl)

**Z-Index Layer**: overlay(300), sidebar(301), header(100), modal-backdrop(1000), toast(1200), tooltip(1300)

### 2.3 Radix UI Themes Overview

Radix Themes (by WorkOS) provides:
- **18 pre-built components**: AppLayout, Avatars, Badge, Button, Card, Checkbox, Code, Dialog, DropdownMenu, Field, IconButton, Link, List, RadioGroup, Select, Switch, Table, TextArea, Textfield
- **Typography system**: 3 styles (default/modern/classic)
- **Color system**: 10 semantic colors + configurable CSS variables
- **Dimension system**: px/576/1024/1440 breakpoints
- **Dark mode**: Built-in via `data-radix-color-scheme="dark"`
- **Animation**: CSS transitions for hover/focus/open/close states

### 2.4 Mapping Strategy

| Radix Themes Token | RMFOOD Current Token | Action |
|-------------------|---------------------|--------|
| `cyan` | `--color-primary` (#059669) | Reconfigure |
| `blue` | `--color-secondary` (#3b82f6) | Keep |
| `gold` | `--color-warning` (#f59e0b) | Keep |
| `red` | `--color-error` (#ef4444) | Keep |
| `green` | `--color-success` (#10b981) | Keep |
| `mauve` | `--color-neutral-*` | Keep |
| `slate` | `--color-text-*` | Keep |
| `gray` | `--color-muted-*` | Keep |
| `opacity` | `opacity-*` | Keep |
| `radius` | `--radius-*` | Keep |
| `typography.fontFamily` | `--font-sans` etc. | Keep |

---

## 3. Migration Phases

### Phase 1: Foundation Setup (2-3 days)

**Goal**: Install Radix Themes, configure tokens, verify build.

#### Tasks
1. **Install Radix Themes**
   ```bash
   pnpm add @radix-ui/themes
   pnpm add -D @radix-ui/react-visually-hidden
   ```
2. **Configure ThemeProvider**
   - Create `src/theme/RadixThemeProvider.tsx` wrapping existing app
   - Map RMFOOD CSS variables to Radix Theme tokens
   - Configure `accentColor="cyan"` → maps to Forest Green
   - Configure `appearance="light"` / `"dark"` with toggle
   - Set `radius="medium"` (8px = rmfood --radius-md)
   - Set `scaling="100%"` (no scaling)
3. **Typography Configuration**
   - Use Radix Typography with `fontFamily="system"` (maps to Inter/Noto Sans SC)
   - Keep existing heading hierarchy
   - Add Radix Typography styles to `index.css`
4. **Build Verification**
   - Run `pnpm build` and verify green
   - Run `pnpm exec tsc --noEmit` and verify 0 new errors
   - Verify dev server renders correctly

#### Deliverables
- `src/theme/RadixThemeProvider.tsx`
- Updated `src/main.tsx` with Radix ThemeProvider
- Updated `src/index.css` with Radix Typography
- `pnpm build` passes
- `tsc --noEmit` clean (0 new errors)

---

### Phase 2: Layout Transformation (3-4 days)

**Goal**: Replace MainLayout with Radix AppLayout, create consistent page shell.

#### Tasks
1. **Analyze Current MainLayout**
   - Sidebar: 264px collapsed to 72px
   - Header: 56px height
   - Navigation: 12+ routes with icons
   - ThemeSwitcher: light/dark toggle
   - NotificationBell: real-time alerts
   - CommandPalette: Cmd+K global search
   - WebSocketStatus: connection indicator

2. **Create New Layout with Radix AppLayout**
   ```tsx
   import { Theme, AppLayout } from '@radix-ui/themes'
   
   <Theme accentColor="cyan" radius="medium" scaling="100%">
     <AppLayout
       sidebarHeader={<Logo />}
       sidebarNav={<MainNav />}
       sidebarFooter={<UserMenu />}
       header={<TopBar />}
       banner={<AnnouncementBanner />}
     >
       <Outlet />
     </AppLayout>
   </Theme>
   ```
3. **Migrate Navigation Items**
   - Map existing NavLink items to Radix NavItems
   - Preserve icons (lucide-react → Radix icon mapping)
   - Keep active state styling with brand colors
4. **Preserve Functionality**
   - Theme switching (light/dark) → Radix appearance prop
   - CommandPalette → Radix Dialog (or keep custom)
   - NotificationBell → Radix Toast notifications
   - WebSocketStatus → Badge with color status
5. **Responsive Breakpoints**
   - Use Radix dimension system: px/576/1024/1440
   - Map to existing: mobile(<768), tablet(768-1024), desktop(>1024)

#### Deliverables
- `src/components/layout/MainLayout.tsx` → uses Radix AppLayout
- `src/components/layout/Sidebar.tsx` → Radix NavItems
- `src/components/layout/Header.tsx` → Radix AppLayout header
- `src/components/layout/UserMenu.tsx` → Radix DropdownMenu
- All existing features preserved

---

### Phase 3: Component Migration (5-7 days)

**Goal**: Replace key shadcn components with Radix Themes equivalents where beneficial.

#### Priority 1: Core Components (Days 1-2)

| Component | Current | Radix Equivalent | Notes |
|-----------|---------|-----------------|-------|
| Button | shadcn button | `Button` | Keep shadcn for custom variants (ai, glass) |
| Card | shadcn card | `Card` | Map props: hoverable→hover, glass→appearance="ghost" |
| Dialog/Modal | shadcn dialog | `Dialog` | Drop-in replacement, same API shape |
| Select | shadcn select | `Select` | Keep shadcn (more flexible) |
| Tabs | shadcn tabs | `Tabs` | Keep shadcn (better API) |
| Checkbox | shadcn checkbox | `Checkbox` | Drop-in replacement |
| Switch | shadcn switch | `Switch` | Drop-in replacement |

#### Priority 2: Form Components (Days 3-4)

| Component | Current | Radix Equivalent | Notes |
|-----------|---------|-----------------|-------|
| Input | shadcn input | `TextField` | Keep shadcn input (more features) |
| Textarea | shadcn textarea | `TextArea` | Keep shadcn |
| Badge | shadcn badge | `Badge` | Drop-in replacement |
| Alert | shadcn alert | `Text` + `Box` | Re-implement with Radix Box |

#### Priority 3: Data Display (Days 5-7)

| Component | Current | Radix Equivalent | Notes |
|-----------|---------|-----------------|-------|
| DataTable | custom | `Table` | Major rework — Radix Table is simpler |
| StatCard | custom | `Card` + `Text` | Use Radix Card + custom content |
| Skeleton | shadcn skeleton | `Box` + animation | Keep shadcn (simpler) |
| Progress | shadcn progress | `Progress` | Drop-in replacement |
| Tooltip | shadcn tooltip | `Tooltip` | Drop-in replacement |
| Toast | shadcn toast | `Toasts` | Keep shadcn (more features) |

#### Decision Criteria
- **Use Radix Themes when**: Simpler API, better default styles, brand consistency
- **Keep shadcn when**: More features needed, custom variants, complex interactions

---

### Phase 4: Page-Level Enhancement (5-7 days)

**Goal**: Update 3 representative pages to showcase new design system.

#### Dashboard Page (`/dashboard`)
- Use Radix Grid for card layout
- Replace StatCard with Radix Card + custom content
- Use Radix Typography for headings
- Add Radix Badge for status indicators
- Preserve all existing data and interactions

#### Formula Editor (`/formula/new` & `/formula/:id`)
- Use Radix Field for form inputs
- Use Radix Button for actions
- Use Radix Tabs for sections
- Use Radix Select for model/formula type selection
- Preserve all AI features and state management

#### AI Chat (`/ai/chat`)
- Use Radix Dialog for settings
- Use Radix TextField for input
- Use Radix Button for actions
- Preserve WebSocket and streaming features

#### Key Pages to Refresh (in priority order)
1. `/dashboard` — Main landing page
2. `/formula` — Core product page
3. `/ai/chat` — AI interface
4. `/database` — Data management
5. `/settings` — User preferences
6. `/organizations` — Multi-tenant management

---

### Phase 5: Polish & Accessibility (3-4 days)

**Goal**: Final polish, accessibility audit, performance optimization.

#### Tasks
1. **Visual Polish**
   - Verify all brand colors render correctly in both themes
   - Check dark mode parity for all migrated components
   - Test responsive breakpoints (mobile/tablet/desktop)
   - Verify hover/focus/active states
2. **Accessibility Audit**
   - Run axe-core on all migrated pages
   - Test keyboard navigation (Tab, Enter, Escape, Arrow keys)
   - Verify screen reader support (NVDA/VoiceOver)
   - Check color contrast ratios (WCAG AA minimum)
3. **Performance**
   - Measure bundle size impact
   - Verify code splitting still works
   - Check Lighthouse scores (target: Performance ≥90, A11y ≥95)
4. **Documentation**
   - Update ADR-027 with Radix Themes integration notes
   - Create component usage guide
   - Document design token mapping

#### Deliverables
- `docs/adr/ADR-028-Radix-UI-Themes-Integration.md`
- Accessibility report
- Performance report
- Component usage guide

---

## 4. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Radix Themes API breaks existing layouts | Medium | High | Each phase independently deployable |
| Design token mismatch causes visual regression | Low | Medium | Parallel CSS variable test |
| Bundle size increase >20% | Low | Medium | Monitor with rollup-plugin-visualizer |
| Radix Themes keyboard nav conflicts | Low | High | axe-core testing each phase |
| Existing Zustand stores incompatible | None | Low | State layer untouched |
| React Router v7 compatibility issues | Low | Medium | Test all routes after migration |

---

## 5. Success Criteria

| Criterion | Target |
|-----------|--------|
| Components migrated | 12/38 core + 16 shadcn (total 28) |
| TypeScript errors (new) | **0** |
| Vite Build | **Green** |
| Lighthouse Accessibility | ≥95 |
| Lighthouse Performance | ≥85 |
| Bundle size delta | <10% increase |
| Dark mode parity | All migrated components |
| Brand tokens preserved | 100% (Forest Green primary) |

---

## 6. Package Dependencies

### Already Installed (from ADR-027)
```
@radix-ui/react-dialog, react-select, react-tabs, react-checkbox,
react-switch, react-tooltip, react-toast, react-alert-dialog,
react-progress, react-slider, class-variance-authority, tailwindcss-animate
```

### To Add (Radix Themes)
```
@radix-ui/themes          # Main themes package
@radix-ui/react-visually-hidden  # Accessibility utility
```

### Unchanged
- lucide-react (icons)
- framer-motion (animations)
- zustand (state management)
- @tanstack/react-query (server state)
- react-router-dom v7 (routing)
- tailwindcss v4 (styling)

---

## 7. Implementation Order

```
Phase 1 (Foundation)    → Days 1-3
  ├─ Install @radix-ui/themes
  ├─ Create ThemeProvider
  ├─ Configure tokens
  └─ Verify build

Phase 2 (Layout)        → Days 4-7
  ├─ Migrate MainLayout to AppLayout
  ├─ Migrate Sidebar to NavItems
  ├─ Migrate Header to TopBar
  └─ Preserve all functionality

Phase 3 (Components)    → Days 8-14
  ├─ Priority 1: Button, Card, Dialog, Checkbox, Switch
  ├─ Priority 2: Badge, Progress, Tooltip
  └─ Priority 3: Table, StatCard

Phase 4 (Pages)         → Days 15-21
  ├─ Dashboard
  ├─ Formula Editor
  ├─ AI Chat
  └─ Database (partial)

Phase 5 (Polish)        → Days 22-25
  ├─ Visual polish
  ├─ Accessibility audit
  ├─ Performance optimization
  └─ Documentation
```

---

## 8. Out of Scope

- Backend API changes
- Database schema changes
- Full page rewrite (only component-level changes)
- Mobile-specific native app (web-only)
- Third-party integration changes (OpenFoodFacts, etc.)
- Removal of all antd dependencies (separate effort)
