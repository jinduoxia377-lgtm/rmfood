/**
 * 快捷键帮助组件
 *
 * 显示当前可用的键盘快捷键列表
 */

import { useState } from'react';
import { Keyboard, X, Command } from'lucide-react';
import { SHORTCUTS } from'@/hooks/useKeyboardShortcuts.tsx';
import type { ShortcutDefinition } from'@/hooks/useKeyboardShortcuts.tsx';

/** 格式化快捷键键位显示 */
function formatShortcut(def: ShortcutDefinition): string {
 return def.keys;
}

interface ShortcutHelpProps {
 shortcuts?: ShortcutDefinition[];
}

export function ShortcutHelp({ shortcuts }: ShortcutHelpProps) {
 const [isOpen, setIsOpen] = useState(false);

 const allShortcuts = shortcuts || SHORTCUTS;

 // 按类别分组
 const groupedShortcuts: Record<string, ShortcutDefinition[]> = {
 导航: allShortcuts.filter((s: ShortcutDefinition) => s.group ==='navigation'),
 操作: allShortcuts.filter((s: ShortcutDefinition) => s.group ==='action'),
 通用: allShortcuts.filter((s: ShortcutDefinition) => s.group ==='general'),
 };

 return (
 <>
 {/* 快捷键帮助按钮 */}
 <button
 onClick={() => setIsOpen(true)}
 className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 transition-all duration-200"
 style={{ color:'var(--text-secondary)' }}
 title="快捷键帮助"
 >
 <Keyboard className="w-4 h-4" />
 <span className="text-xs font-medium">快捷键</span>
 </button>

 {/* 快捷键帮助弹窗 */}
 {isOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 {/* 背景遮罩 */}
 <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"  role="button" tabIndex={0} onClick={() => setIsOpen(false)} />

 {/* 内容面板 */}
 <div className="relative surface-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
 {/* 头部 */}
 <div
 className="flex items-center justify-between p-4 border-b"
 style={{ borderColor:'var(--border-color)' }}
 >
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
 <Keyboard className="w-4 h-4 text-primary-600" />
 </div>
 <h3 className="font-semibold" style={{ color:'var(--text-primary)' }}>
 键盘快捷键
 </h3>
 </div>
 <button
 onClick={() => setIsOpen(false)}
 className="p-2 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 transition-colors"
 >
 <X className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
 </button>
 </div>

 {/* 快捷键列表 */}
 <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
 {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
 <div key={category}>
 <h4 className="text-xs font-medium mb-2 px-1" style={{ color:'var(--text-muted)' }}>
 {category}
 </h4>
 <div className="space-y-2">
 {shortcuts.map((shortcut: ShortcutDefinition) => (
 <div
 key={shortcut.keys}
 className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-default/50 transition-colors"
 >
 <span className="text-sm" style={{ color:'var(--text-secondary)' }}>
 {shortcut.label}
 </span>
 <div className="flex items-center gap-1">
 {formatShortcut(shortcut)
 .split('+')
 .map((part: string, i: number) => (
 <span
 key={i}
 className="px-2 py-1 rounded-md text-xs font-mono bg-neutral-100 dark:bg-neutral-800"
 style={{ color:'var(--text-primary)' }}
 >
 {part}
 </span>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>

 {/* 底部提示 */}
 <div className="p-4 border-t" style={{ borderColor:'var(--border-color)' }}>
 <p className="text-xs text-center" style={{ color:'var(--text-muted)' }}>
 <Command className="w-3 h-3 inline mr-1" />
 在输入框中部分快捷键可能不可用
 </p>
 </div>
 </div>
 </div>
 )}
 </>
 );
}

export default ShortcutHelp;
