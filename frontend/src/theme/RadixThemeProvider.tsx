/**
 * RMFOOD 设计系统 — Radix UI Themes Provider
 *
 * 集成 @radix-ui/themes 专业设计系统
 * - 映射 RMFOOD 品牌色到 Radix Theme Tokens
 * - 支持 Light/Dark 双模式
 * - 保留现有 Zustand theme store 集成
 */
'use client'

import * as React from 'react'
import { Theme, Section, Container } from '@radix-ui/themes'
import { useTheme } from '@/stores/theme.storage'

interface RadixThemeProviderProps {
  children: React.ReactNode
  /** Force appearance override (for testing) */
  forceAppearance?: 'light' | 'dark'
}

export function RadixThemeProvider({ children, forceAppearance }: RadixThemeProviderProps) {
  const { appearance, toggleAppearance, isDark } = useTheme()

  // Sync document class for Tailwind dark mode
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  return (
    <Theme
      // Brand color mapping: Forest Green → cyan (closest Radix semantic)
      accentColor="cyan"
      grayColor="mauve"
      radius="medium"       // 8px — matches --radius-md
      scaling="100%"
      appearance={forceAppearance ?? appearance}
      panelBackground="translucent"
    >
      {/* Custom CSS for brand token overrides */}
      <style>{`
        :root {
          /* Override Radix default cyan with RMFOOD Forest Green */
          --accent-1: #ecfdf5;
          --accent-2: #d1fae5;
          --accent-3: #a7f3d0;
          --accent-4: #6ee7b7;
          --accent-5: #34d399;
          --accent-6: #0066cc;
          --accent-7: #059669;
          --accent-8: #047857;
          --accent-9: #065f46;
          --accent-10: #064e3b;
          --accent-11: #022c22;
          --accent-12: #047857;

          /* Secondary color: Ocean Blue */
          --secondary-6: #3b82f6;
          --secondary-7: #2563eb;
          --secondary-8: #1d4ed8;

          /* Success/Warning/Error: Keep brand colors */
          --success-6: #10b981;
          --warning-6: #f59e0b;
          --error-6: #ef4444;
        }

        .dark {
          --accent-6: #34d399;
          --accent-7: #059669;
          --accent-8: #065f46;
        }
      `}</style>

      <Section paddingTop="large" paddingBottom="large">
        <Container size="4">{children}</Container>
      </Section>
    </Theme>
  )
}

export { Section, Container }
export type { RadixThemeProviderProps }
