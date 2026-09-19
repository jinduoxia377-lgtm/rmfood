import React from 'react'
import type { ThemeStyles } from '@/types/theme.types'

interface TypeScalePreviewProps {
	config: ThemeStyles
}

/**
 * TypeScalePreview — 完整排版层级可视化
 * 展示从 xs 到 4xl 的所有字号层级效果
 */
export function TypeScalePreview({ config }: TypeScalePreviewProps) {
	const font = config.font || {}
	const colors = config.colors || {}
	const textColor = (colors.text as unknown as Record<string, string>)?.primary || '#1d1d1f'
	const textMuted = (colors.text as unknown as Record<string, string>)?.secondary || '#6b7280'
	const fontFamily = font.fontFamily || "'Inter', system-ui, sans-serif"

	const typeScale = [
		{ token: 'hero-display', size: 56, weight: 600, lh: 1.07, tracking: '-0.28px', label: 'Hero Display (56px)' },
		{ token: 'display-lg', size: 40, weight: 600, lh: 1.10, tracking: '0px', label: 'Display LG (40px)' },
		{ token: 'display-md', size: 34, weight: 600, lh: 1.47, tracking: '-0.37px', label: 'Display MD (34px)' },
		{ token: 'lead', size: 28, weight: 400, lh: 1.14, tracking: '0.20px', label: 'Lead (28px)' },
		{ token: 'tagline', size: 21, weight: 600, lh: 1.19, tracking: '0.23px', label: 'Tagline (21px)' },
		{ token: 'body-strong', size: 17, weight: 600, lh: 1.24, tracking: '-0.37px', label: 'Body Strong (17px)' },
		{ token: 'body', size: 17, weight: 400, lh: 1.47, tracking: '-0.37px', label: 'Body (17px)' },
		{ token: 'caption', size: 14, weight: 400, lh: 1.43, tracking: '-0.22px', label: 'Caption (14px)' },
		{ token: 'fine-print', size: 12, weight: 400, lh: 1.00, tracking: '-0.12px', label: 'Fine Print (12px)' },
	]

	return (
		<div className="space-y-1" style={{ fontFamily, color: textColor }}>
			{typeScale.map((item) => (
				<div key={item.token} className="flex items-baseline gap-4 py-2 px-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
					<div className="w-32 shrink-0">
						<div className="text-[10px] font-mono text-neutral-400">{item.token}</div>
						<div className="text-[10px] text-neutral-300 dark:text-neutral-600">
							{item.size}px / w{item.weight}
						</div>
					</div>
					<div className="flex-1 min-w-0">
						<p
							style={{
								fontSize: `${item.size}px`,
								fontWeight: item.weight,
								lineHeight: item.lh,
								letterSpacing: item.tracking,
								margin: 0,
							}}
						>
							The quick brown fox jumps over the lazy dog. 中文标题示例
						</p>
					</div>
					<div className="w-20 shrink-0 text-right text-[10px] text-neutral-400 font-mono">
						{item.label}
					</div>
				</div>
			))}
		</div>
	)
}
