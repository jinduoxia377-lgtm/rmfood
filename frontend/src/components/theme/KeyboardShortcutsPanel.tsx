import { useState } from 'react'
import { Keyboard } from 'lucide-react'

interface KeyboardShortcutsPanelProps {
	onClose?: () => void
}

const SHORTCUTS = [
	{ keys: ['Ctrl', 'Shift', 'T'], action: '切换主题模式 (浅/深/自动)', desc: '快速在三种模式间循环切换' },
	{ keys: ['Ctrl', 'K'], action: '打开颜色选择器', desc: '当焦点在颜色输入框时触发' },
	{ keys: ['Escape'], action: '关闭弹窗/面板', desc: '关闭主题编辑器、版本历史等浮层' },
	{ keys: ['Enter'], action: '确认应用主题', desc: '在预览浮层中按回车应用当前主题' },
]

export function KeyboardShortcutsPanel({ onClose }: KeyboardShortcutsPanelProps) {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<>
			<button
				onClick={() => setIsOpen(true)}
				className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
				aria-label="快捷键参考"
				title="查看快捷键"
			>
				<Keyboard className="w-4 h-4 text-neutral-500" />
			</button>

			{isOpen && (
				<>
					<div
						className="fixed inset-0 bg-black/30 z-50"
						 role="button" tabIndex={0} onClick={() => { onClose?.(); setIsOpen(false) }}
						aria-hidden="true"
					/>
					<div
						className="fixed inset-y-0 right-0 w-80 surface-card shadow-2xl z-50 flex flex-col border-l border-neutral-200"
						role="dialog"
						aria-modal="true"
						aria-label="快捷键参考"
					>
						{/* Header */}
						<div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
							<div className="flex items-center gap-2">
								<Keyboard className="w-4 h-4 text-neutral-500" />
								<h2 className="text-sm font-semibold text-neutral-900 dark:text-white">快捷键参考</h2>
							</div>
							<button
								onClick={() => { onClose?.(); setIsOpen(false) }}
								className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
								aria-label="关闭"
							>
								<span className="text-neutral-400 text-lg leading-none">&times;</span>
							</button>
						</div>

						{/* Shortcuts list */}
						<div className="flex-1 overflow-auto p-4 space-y-3">
							{SHORTCUTS.map((s, i) => (
								<div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
									<div className="flex gap-1 flex-shrink-0">
										{s.keys.map((key) => (
											<kbd
												key={key}
												className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 shadow-sm"
											>
												{key}
											</kbd>
										))}
									</div>
									<div className="min-w-0">
										<div className="text-xs font-medium text-neutral-800 dark:text-neutral-200">{s.action}</div>
										<div className="text-[10px] text-neutral-500 mt-0.5">{s.desc}</div>
									</div>
								</div>
							))}
						</div>

						{/* Footer */}
						<div className="px-5 py-3 border-t border-neutral-200 text-[10px] text-neutral-400">
							按 Escape 关闭此面板
						</div>
					</div>
				</>
			)}
		</>
	)
}
