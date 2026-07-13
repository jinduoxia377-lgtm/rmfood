/**
 * RMFOOD — 全局键盘快捷键系统
 * useKeyboardShortcuts hook + KeyboardShortcutsHelp 帮助面板
 *
 * 快捷键列表:
 *  Ctrl+K / Cmd+K  — 全局搜索 (CommandPalette)
 *  Ctrl+N / Cmd+N  — 新建配方
 *  Ctrl+Shift+N    — 新建实验
 *  Ctrl+/          — 显示快捷键帮助
 *  Ctrl+,          — 打开设置
 *  Alt+H           — 回到工作台
 *  Escape          — 关闭弹窗/面板
 */
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════
   快捷键定义
   ═══════════════════════════════════════════ */

export interface ShortcutDefinition {
  /** 快捷键描述（如 "Ctrl+K"） */
  keys: string
  /** 功能描述 */
  label: string
  /** 所属分组 */
  group: 'navigation' | 'action' | 'general'
  /** 是否需要管理员权限 */
  adminOnly?: boolean
}

export const SHORTCUTS: ShortcutDefinition[] = [
  // 导航
  { keys: 'Ctrl+K', label: '全局搜索', group: 'navigation' },
  { keys: 'Alt+H', label: '回到工作台', group: 'navigation' },
  { keys: 'Ctrl+,', label: '打开设置', group: 'navigation' },

  // 操作
  { keys: 'Ctrl+N', label: '新建配方', group: 'action' },
  { keys: 'Ctrl+Shift+N', label: '新建实验', group: 'action' },

  // 通用
  { keys: 'Ctrl+/', label: '快捷键帮助', group: 'general' },
  { keys: 'Escape', label: '关闭弹窗 / 面板', group: 'general' },
]

const GROUP_LABELS: Record<string, string> = {
  navigation: '导航',
  action: '操作',
  general: '通用',
}

/* ═══════════════════════════════════════════
   快捷键帮助面板 Context
   ═══════════════════════════════════════════ */

interface HelpContextValue {
  showHelp: boolean
  openHelp: () => void
  closeHelp: () => void
  toggleHelp: () => void
}

const HelpContext = createContext<HelpContextValue | null>(null)

export function useShortcutHelp() {
  const ctx = useContext(HelpContext)
  if (!ctx) throw new Error('useShortcutHelp must be used within ShortcutHelpProvider')
  return ctx
}

/* ═══════════════════════════════════════════
   useKeyboardShortcuts Hook
   ═══════════════════════════════════════════ */

interface UseKeyboardShortcutsOptions {
  /** 用户角色，用于过滤 adminOnly 快捷键 */
  userRole?: string
  /** CommandPalette 是否打开（避免快捷键冲突） */
  commandPaletteOpen?: boolean
  /** 任意 Modal 是否打开（避免快捷键冲突） */
  modalOpen?: boolean
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { userRole, commandPaletteOpen, modalOpen } = options
  const navigate = useNavigate()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 如果 CommandPalette 或 Modal 打开，只处理 Escape
    if (commandPaletteOpen || modalOpen) {
      if (e.key === 'Escape') {
        // Escape 处理由各组件自行管理（Modal / CommandPalette）
      }
      return
    }

    const isMod = e.metaKey || e.ctrlKey

    // Ctrl+K — 已由 CommandPalette 自行处理
    // Ctrl+N — 新建配方
    if (isMod && !e.shiftKey && e.key === 'n') {
      e.preventDefault()
      navigate('/formulas/new')
      return
    }

    // Ctrl+Shift+N — 新建实验
    if (isMod && e.shiftKey && e.key === 'N') {
      e.preventDefault()
      navigate('/experiments/new')
      return
    }

    // Ctrl+/ — 快捷键帮助（通过自定义事件触发）
    if (isMod && e.key === '/') {
      e.preventDefault()
      document.dispatchEvent(new CustomEvent('rmfood:toggle-shortcut-help'))
      return
    }

    // Ctrl+, — 设置
    if (isMod && e.key === ',') {
      e.preventDefault()
      navigate('/settings')
      return
    }

    // Alt+H — 工作台
    if (e.altKey && e.key === 'h') {
      e.preventDefault()
      navigate('/dashboard')
      return
    }
  }, [navigate, commandPaletteOpen, modalOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/* ═══════════════════════════════════════════
   KeyboardShortcutsHelp 帮助面板组件
   ═══════════════════════════════════════════ */

export function ShortcutHelpProvider({ children }: { children: ReactNode }) {
  const [showHelp, setShowHelp] = useState(false)

  const openHelp = useCallback(() => setShowHelp(true), [])
  const closeHelp = useCallback(() => setShowHelp(false), [])
  const toggleHelp = useCallback(() => setShowHelp((v) => !v), [])

  // 监听自定义事件
  useEffect(() => {
    const handler = () => toggleHelp()
    document.addEventListener('rmfood:toggle-shortcut-help', handler)
    return () => document.removeEventListener('rmfood:toggle-shortcut-help', handler)
  }, [toggleHelp])

  // ESC 关闭
  useEffect(() => {
    if (!showHelp) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeHelp()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showHelp, closeHelp])

  return (
    <HelpContext.Provider value={{ showHelp, openHelp, closeHelp, toggleHelp }}>
      {children}
      {showHelp && <KeyboardShortcutsHelp onClose={closeHelp} />}
    </HelpContext.Provider>
  )
}

/** 快捷键标签（用于 UI 展示） */
function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className={cn(
      'inline-flex items-center justify-center min-w-[24px] h-6 px-1.5',
      'rounded-md text-[11px] font-medium font-mono',
      'bg-neutral-100 dark:bg-neutral-800',
      'border border-neutral-200 dark:border-neutral-700',
      'text-neutral-600 dark:text-neutral-400',
      'shadow-[0_1px_0_1px_rgba(0,0,0,0.04)]',
    )}>
      {children}
    </kbd>
  )
}

/** 格式化快捷键显示 */
function formatKeys(keys: string): ReactNode[] {
  const parts = keys.replace(/Ctrl/g, '\u2318').replace(/Cmd/g, '\u2318').split('+')
  // 保留原始文本但分别用 Kbd 包裹
  const rawParts = keys.split('+')
  return rawParts.map((part, i) => (
    <span key={i} className="flex items-center gap-0.5">
      {i > 0 && <span className="text-neutral-300 dark:text-neutral-600 text-[10px] mx-px">+</span>}
      <Kbd>{part}</Kbd>
    </span>
  ))
}

function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  // 按分组归类
  const groups = SHORTCUTS.reduce<Record<string, ShortcutDefinition[]>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = []
    acc[s.group].push(s)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="键盘快捷键">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* 面板 */}
      <div className={cn(
        'relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl',
        'border border-neutral-200 dark:border-neutral-700 shadow-2xl',
        'animate-scale-in overflow-hidden',
      )}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M8 16h8" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">键盘快捷键</h2>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">提高工作效率的快捷操作</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="关闭"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 快捷键列表 */}
        <div className="px-6 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {Object.entries(groups).map(([group, shortcuts]) => (
            <div key={group}>
              <p className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2.5">
                {GROUP_LABELS[group] ?? group}
              </p>
              <div className="space-y-1">
                {shortcuts.map((s) => (
                  <div
                    key={s.keys}
                    className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors group"
                  >
                    <span className="text-sm text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white">
                      {s.label}
                    </span>
                    <div className="flex items-center">
                      {formatKeys(s.keys)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/20">
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center">
            按 <Kbd>ESC</Kbd> 关闭 &middot; 按 <Kbd>Ctrl+/</Kbd> 随时打开
          </p>
        </div>
      </div>
    </div>
  )
}
