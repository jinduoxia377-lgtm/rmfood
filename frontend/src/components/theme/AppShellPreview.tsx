import React, { useMemo } from 'react'
import type { ThemeStyles } from '@/types/theme-mode'

interface AppShellPreviewProps {
	config: ThemeStyles
	viewMode?: 'samples' | 'context' | 'full'
}

/**
 * AppShellPreview — 迷你版 RMFOOD 应用预览
 * 展示主题在实际应用中的效果：侧边栏 + 导航栏 + 内容区
 */
export function AppShellPreview({ config, viewMode = 'context' }: AppShellPreviewProps) {
	const colors = config.colors || {}
	const font = config.font || {}
	const spacing = config.spacing || {}
	const radius = (spacing?.borderRadius as Record<string, string>) || {}

	const style = useMemo(() => ({
		'--preview-bg': colors.background || '#ffffff',
		'--preview-surface': colors.surface || '#f8fafc',
		'--preview-primary': colors.primary || '#0066cc',
		'--preview-text': colors.text || '#1d1d1f',
		'--preview-text-muted': (colors.text as any)?.secondary || '#6b7280',
		'--preview-border': colors.border ? ((colors.border as any)?.default || '#e5e7eb') : '#e5e7eb',
		'--preview-font': font.fontFamily || "'Inter', system-ui, sans-serif",
		'--preview-radius': radius.lg || '12px',
	}), [colors, font, spacing, radius])

	const borderColor = (colors.border as any)?.default || '#e5e7eb'
	const textColor = (colors.text as any)?.primary || '#1d1d1f'
	const textMuted = (colors.text as any)?.secondary || '#6b7280'
	const primaryColor = colors.primary || '#0066cc'
	const bgColor = colors.background || '#ffffff'
	const surfaceColor = colors.surface || '#f8fafc'
	const fontSize = font.fontSize?.base || '16px'
	const fontFamily = font.fontFamily || "'Inter', system-ui, sans-serif"

	if (viewMode === 'samples') {
		return (
			<div className="space-y-4 p-4" style={{ backgroundColor: bgColor, color: textColor, fontFamily }}>
				{/* Buttons */}
				<div>
					<div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: textMuted }}>按钮</div>
					<div className="flex gap-2 flex-wrap">
						<button style={{ backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '9999px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
							主要操作
						</button>
						<button style={{ backgroundColor: 'transparent', color: primaryColor, border: `1.5px solid ${primaryColor}`, borderRadius: '9999px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
							次要操作
						</button>
						<button style={{ backgroundColor: surfaceColor, color: textColor, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
							幽灵按钮
						</button>
					</div>
				</div>

				{/* Input */}
				<div>
					<div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: textMuted }}>输入框</div>
					<input
						placeholder="输入框示例..."
						className="w-full max-w-sm"
						style={{
							backgroundColor: bgColor,
							color: textColor,
							border: `1px solid ${borderColor}`,
							borderRadius: '9999px',
							padding: '8px 16px',
							fontSize,
							fontFamily,
							outline: 'none',
						}}
					/>
				</div>

				{/* Cards */}
				<div>
					<div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: textMuted }}>卡片</div>
					<div className="flex gap-3">
						{['配方总数', '待审核', '本月新增'].map((label, i) => (
							<div key={label} style={{ backgroundColor: surfaceColor, border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '12px 16px', minWidth: 100 }}>
								<div className="text-xs mb-1" style={{ color: textMuted }}>{label}</div>
								<div className="text-lg font-semibold" style={{ color: ['#10b981', '#d97706', '#0066cc'][i] }}>
									{['128', '23', '+12'][i]}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Typography */}
				<div>
					<div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: textMuted }}>排版</div>
					<h4 style={{ fontSize: '18px', fontWeight: 600, margin: 0, lineHeight: 1.2 }}>{fontFamily.includes('PingFang') ? '中文标题测试' : 'Heading'}</h4>
					<p style={{ fontSize, lineHeight: 1.47, margin: '4px 0 0', color: textColor, opacity: 0.85 }}>
						正文内容展示当前主题的字体大小、颜色和行高效果。{fontFamily.includes('PingFang') ? '中英文混排效果一目了然。' : 'The quick brown fox jumps over the lazy dog.'}
					</p>
					<p style={{ fontSize: '12px', color: textMuted, margin: '4px 0 0' }}>
						辅助说明文字，用于补充信息
					</p>
				</div>
			</div>
		)
	}

	// Context / Full mode: mini app shell
	return (
		<div style={{ ...style, width: '100%', height: 320, borderRadius: '12px', overflow: 'hidden', display: 'flex', fontFamily, fontSize, color: textColor }}>
			{/* Sidebar */}
			<div style={{ width: 52, backgroundColor: 'rgba(0,0,0,0.04)', borderRight: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 4, flexShrink: 0 }}>
				<div style={{ width: 28, height: 28, borderRadius: '8px', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, marginBottom: 8 }}>R</div>
				{[{ icon: '📊', label: '仪表盘' }, { icon: '🧪', label: '配方' }, { icon: '🔬', label: '实验' }, { icon: '🤖', label: 'AI' }].map((item) => (
					<div key={item.label} style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }} title={item.label}>
						<span>{item.icon}</span>
					</div>
				))}
			</div>

			{/* Main area */}
			<div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
				{/* Top nav */}
				<div style={{ height: 40, borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, flexShrink: 0, backgroundColor: surfaceColor }}>
					<span style={{ fontSize: 12, fontWeight: 600, color: primaryColor }}>RMFOOD</span>
					{['仪表盘', '配方库', '实验记录', 'AI助手'].map((nav, i) => (
						<span key={nav} style={{ fontSize: 11, color: i === 0 ? primaryColor : textMuted, fontWeight: i === 0 ? 600 : 400, cursor: 'pointer', padding: '2px 8px', borderRadius: 4, backgroundColor: i === 0 ? `${primaryColor}15` : 'transparent' }}>
							{nav}
						</span>
					))}
					<div style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: '50%', backgroundColor: primaryColor, opacity: 0.7 }} />
				</div>

				{/* Content */}
				<div style={{ flex: 1, padding: 10, overflow: 'hidden' }}>
					{/* Stats row */}
					<div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
						{[
							{ label: '配方总数', value: '128', color: '#10b981' },
							{ label: '待审核', value: '23', color: '#d97706' },
							{ label: '本月新增', value: '+12', color: primaryColor },
						].map((s) => (
							<div key={s.label} style={{ flex: 1, backgroundColor: surfaceColor, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '6px 8px' }}>
								<div className="text-[9px]" style={{ color: textMuted, marginBottom: 2 }}>{s.label}</div>
								<div className="text-sm font-semibold" style={{ color: s.color }}>{s.value}</div>
							</div>
						))}
					</div>

					{/* Chart placeholder */}
					<div style={{ backgroundColor: surfaceColor, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: 8, marginBottom: 8 }}>
						<div className="text-[9px] font-semibold mb-1" style={{ color: textMuted }}>趋势分析</div>
						<svg viewBox="0 0 200 50" style={{ width: '100%', height: 40 }}>
							<defs>
								<linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor={primaryColor} stopOpacity={0.2} />
									<stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
								</linearGradient>
							</defs>
							<path d="M0,40 Q25,30 50,35 T100,20 T150,25 T200,10 L200,50 L0,50 Z" fill="url(#chartGrad)" />
							<path d="M0,40 Q25,30 50,35 T100,20 T150,25 T200,10" fill="none" stroke={primaryColor} strokeWidth={1.5} />
						</svg>
					</div>

					{/* Mini table */}
					<div style={{ backgroundColor: surfaceColor, border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
						<div className="text-[9px] font-semibold px-3 py-1.5" style={{ color: textMuted, borderBottom: `1px solid ${borderColor}` }}>最近配方</div>
						{[
							['VEGF抑制剂-A01', '活性优化', '已完成'],
							['免疫调节复合物', '配方设计', '审核中'],
						].map((row, i) => (
							<div key={i} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderBottom: i === 0 ? `1px solid ${borderColor}` : 'none', gap: 8 }}>
								<span className="text-[10px]" style={{ flex: 1, fontWeight: 500 }}>{row[0]}</span>
								<span className="text-[9px]" style={{ color: textMuted }}>{row[1]}</span>
								<span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: row[2] === '已完成' ? '#d1fae5' : '#fef3c7', color: row[2] === '已完成' ? '#065f46' : '#92400e' }}>{row[2]}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

