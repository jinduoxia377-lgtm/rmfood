// ⑦ 字体方案真实 L0 正文令牌注入表（compact / standard / relaxed → [body, body-sm, caption]）
// 对齐 base.css/dark.css 的 --text-body(0.9375rem)/--text-body-sm(0.875rem)/--text-caption(0.75rem)
/**
 * ⑧ 配色方案：参照 Apple HIG 系统色板（明暗双值）
 * light/dark = 主色 500 档（当前模式 --color-primary-500）
 * hover = 600 档、pressed = 700 档（Apple HIG 同族加深）
 * sub/subDark = 浅色变体（--color-primary-300/200 语义）
 * contrastText = 主色实底上的前景（WCAG AA）
 */
export interface HIGPalette {
  key: string; name: string; light: string; dark: string;
  hover: string; pressed: string; sub: string; subDark: string;
  contrastText: string; note: string;
}
export const APPLE_HIG_PALETTES: HIGPalette[] = [
  { key: 'green', name: '默认绿', light: '#10B981', dark: '#34D399', hover: '#059669', pressed: '#047857', sub: '#6EE7B7', subDark: '#A7F3D0', contrastText: '#052E16', note: '品牌默认（明暗双值）' },
  { key: 'blue', name: '苹果蓝', light: '#007AFF', dark: '#0A84FF', hover: '#0066CC', pressed: '#00518F', sub: '#64B5F6', subDark: '#5AC8FA', contrastText: '#FFFFFF', note: 'Apple HIG systemBlue（#007AFF 亮 / #0A84FF 暗）' },
  { key: 'purple', name: '紫色', light: '#AF52DE', dark: '#BF5AF2', hover: '#8E3DA8', pressed: '#6D2E84', sub: '#D29BF5', subDark: '#DA7FFF', contrastText: '#FFFFFF', note: 'Apple HIG systemPurple' },
  { key: 'orange', name: '橙色', light: '#FF9500', dark: '#FF9F0A', hover: '#C86F00', pressed: '#9C5700', sub: '#FFB84D', subDark: '#FFB340', contrastText: '#FFFFFF', note: 'Apple HIG systemOrange' },
  { key: 'red', name: '红色', light: '#FF3B30', dark: '#FF453A', hover: '#D70015', pressed: '#A50011', sub: '#FF7A6E', subDark: '#FF6458', contrastText: '#FFFFFF', note: 'Apple HIG systemRed' },
];

export const FONT_SCALES: Record<string, { body: string; bodySm: string; caption: string }> = {
  compact: { body: '0.8125rem', bodySm: '0.75rem', caption: '0.6875rem' },
  standard: { body: '0.9375rem', bodySm: '0.875rem', caption: '0.75rem' },
  relaxed: { body: '1.125rem', bodySm: '1rem', caption: '0.875rem' },
};
