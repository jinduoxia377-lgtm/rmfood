/**
 * 智能调色板生成器
 * 基于 HSL 色轮的颜色理论算法
 * - 类似色 (Analogous): 色相偏移 ±30°
 * - 互补色 (Complementary): 色相偏移 180°
 * - 三角色 (Triadic): 色相偏移 ±120°
 */

/** 将 HEX 转为 HSL */
function hexToHsl(hex: string): [number, number, number] {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
	if (!result) return [0, 0, 0]
	const r = parseInt(result[1], 16) / 255
	const g = parseInt(result[2], 16) / 255
	const b = parseInt(result[3], 16) / 255

	const max = Math.max(r, g, b), min = Math.min(r, g, b)
	let h = 0, s = 0, l = (max + min) / 2

	if (max !== min) {
		const d = max - min
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
		switch (max) {
			case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
			case g: h = ((b - r) / d + 2) / 6; break
			case b: h = ((r - g) / d + 4) / 6; break
		}
	}
	return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

/** 将 HSL 转为 HEX */
function hslToHex(h: number, s: number, l: number): string {
	h = ((h % 360) + 360) % 360
	s = Math.max(0, Math.min(100, s)) / 100
	l = Math.max(0, Math.min(100, l)) / 100

	const c = (1 - Math.abs(2 * l - 1)) * s
	const x = c * (1 - Math.abs((h / 60) % 2 - 1))
	const m = l - c / 2
	let r = 0, g = 0, b = 0

	if (h < 60)       { r = c; g = x; b = 0 }
	else if (h < 120) { r = x; g = c; b = 0 }
	else if (h < 180) { r = 0; g = c; b = x }
	else if (h < 240) { r = 0; g = x; b = c }
	else if (h < 300) { r = x; g = 0; b = c }
	else              { r = c; g = 0; b = x }

	const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** 根据亮度判断是否为深色背景 */
function isDarkLuminance(l: number): boolean {
	return l < 50
}

/** 生成浅色模式表面色 */
function generateSurfaceColors(luminance: number, mode: 'light' | 'dark'): { background: string; surface: string } {
	if (mode === 'light') {
		return {
			background: '#ffffff',
			surface: '#f8fafc',
		}
	}
	// dark mode: use near-black based on primary luminance
	const bgL = Math.max(2, luminance - 40)
	return {
		background: hslToHex(220, 15, Math.round(bgL)),
		surface: hslToHex(220, 12, Math.round(bgL + 4)),
	}
}

export type PaletteMode = 'analogous' | 'complementary' | 'triadic'

export interface GeneratedPalette {
	mode: PaletteMode
	label: string
	primary: string
	secondary: string
	tertiary: string
	background: string
	surface: string
	swatchHexes: string[]
}

/**
 * 根据主色和配色模式生成和谐调色板
 * @param primaryHex 主色调 HEX（如 '#0066cc'）
 * @param mode 配色模式
 * @param isDarkMode 是否为深色模式
 */
export function generateHarmoniousPalette(
	primaryHex: string,
	mode: PaletteMode = 'analogous',
	isDarkMode = false,
): GeneratedPalette {
	const [h, s, l] = hexToHsl(primaryHex)
	const baseLabel = mode === 'analogous' ? '类似色' : mode === 'complementary' ? '互补色' : '三角色'

	let secondaryH = h
	let tertiaryH = h

	switch (mode) {
		case 'analogous':
			secondaryH = h + 30
			tertiaryH = h - 30
			break
		case 'complementary':
			secondaryH = h + 180
			tertiaryH = h + 150
			break
		case 'triadic':
			secondaryH = h + 120
			tertiaryH = h + 240
			break
	}

	// Secondary: slightly desaturated, same lightness
	const secondaryS = Math.max(20, s - 10)
	const secondaryL = l
	const secondary = hslToHex(secondaryH, secondaryS, secondaryL)

	// Tertiary: more desaturated, slight lightness shift
	const tertiaryS = Math.max(15, s - 20)
	const tertiaryL = Math.min(85, Math.max(25, l + 8))
	const tertiary = hslToHex(tertiaryH, tertiaryS, tertiaryL)

	const { background, surface } = generateSurfaceColors(l, isDarkMode ? 'dark' : 'light')

	return {
		mode,
		label: baseLabel,
		primary: primaryHex,
		secondary,
		tertiary,
		background,
		surface,
		swatchHexes: [primaryHex, secondary, tertiary, background, surface],
	}
}

/**
 * 一键生成所有三种配色方案
 */
export function generateAllPalettes(
	primaryHex: string,
	isDarkMode = false,
): GeneratedPalette[] {
	return [
		generateHarmoniousPalette(primaryHex, 'analogous', isDarkMode),
		generateHarmoniousPalette(primaryHex, 'complementary', isDarkMode),
		generateHarmoniousPalette(primaryHex, 'triadic', isDarkMode),
	]
}
