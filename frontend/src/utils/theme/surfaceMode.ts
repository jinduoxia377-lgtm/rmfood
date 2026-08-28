/**
 * SurfaceMode 工具 — 管理 Flat / Glass / Neumorphic 表面风格
 */

export type SurfaceMode = 'flat' | 'glass' | 'neumorphic'

export const SURFACE_MODES: { value: SurfaceMode; label: string; desc: string }[] = [
	{ value: 'flat', label: '扁平', desc: '纯色表面 + 细边框' },
	{ value: 'glass', label: '毛玻璃', desc: 'backdrop-blur + 半透明' },
	{ value: 'neumorphic', label: '新拟态', desc: '内外阴影软质感' },
]

/** 根据 surfaceMode 返回对应的 CSS class 组合 */
export function getSurfaceClasses(mode: SurfaceMode, base = ''): string {
	switch (mode) {
		case 'glass':
			return `${base} backdrop-blur-xl bg-white/70 dark:bg-neutral-900/70 border border-white/30 dark:border-neutral-700/30`
		case 'neumorphic':
			return `${base} bg-neutral-50 dark:bg-neutral-900 shadow-[4px_4px_8px_rgba(0,0,0,0.08),_-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.3),_-4px_-4px_8px_rgba(255,255,255,0.05)]`
		case 'flat':
		default:
			return `${base} bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800`
	}
}

/** 将 surfaceMode 写入 DOM CSS 变量 */
export function applySurfaceMode(mode: SurfaceMode): void {
	const root = document.documentElement
	root.setAttribute('data-surface-mode', mode)
	// Glass mode needs backdrop-filter on surfaces
	if (mode === 'glass') {
		root.style.setProperty('--surface-backdrop', 'blur(20px) saturate(180%)')
		root.style.setProperty('--surface-opacity', '0.72')
	} else if (mode === 'neumorphic') {
		root.style.setProperty('--surface-shadow', '4px 4px 8px rgba(0,0,0,0.08), -4px -4px 8px rgba(255,255,255,0.8)')
	} else {
		root.style.setProperty('--surface-backdrop', 'none')
		root.style.setProperty('--surface-opacity', '1')
		root.style.setProperty('--surface-shadow', 'none')
	}
}

export function getSavedSurfaceMode(): SurfaceMode {
	try {
		const saved = localStorage.getItem('rmfood-surface-mode')
		if (saved === 'glass' || saved === 'neumorphic' || saved === 'flat') return saved
	} catch {}
	return 'flat'
}

export function saveSurfaceMode(mode: SurfaceMode): void {
	localStorage.setItem('rmfood-surface-mode', mode)
	applySurfaceMode(mode)
}
