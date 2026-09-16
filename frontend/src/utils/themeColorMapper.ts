/**
 * 主题色映射工具
 * 将语义化颜色名称映射到具体的 CSS 变量
 */

export const colorMapping: Record<string, string> = {
  primary: 'var(--color-primary)',
  primaryForeground: 'var(--color-primary-foreground)',
  primaryMuted: 'var(--color-primary-muted)',
  primarySubtle: 'var(--color-primary-subtle)',
  primaryBold: 'var(--color-primary-bold)',
  secondary: 'var(--color-secondary)',
  secondaryForeground: 'var(--color-secondary-foreground)',
  secondaryMuted: 'var(--color-secondary-muted)',
  secondarySubtle: 'var(--color-secondary-subtle)',
  secondaryBold: 'var(--color-secondary-bold)',
  accent: 'var(--color-accent)',
  accentForeground: 'var(--color-accent-foreground)',
  accentMuted: 'var(--color-accent-muted)',
  accentSubtle: 'var(--color-accent-subtle)',
  accentBold: 'var(--color-accent-bold)',
  success: 'var(--color-success)',
  successForeground: 'var(--color-success-foreground)',
  successMuted: 'var(--color-success-muted)',
  successSubtle: 'var(--color-success-subtle)',
  successBold: 'var(--color-success-bold)',
  warning: 'var(--color-warning)',
  warningForeground: 'var(--color-warning-foreground)',
  warningMuted: 'var(--color-warning-muted)',
  warningSubtle: 'var(--color-warning-subtle)',
  warningBold: 'var(--color-warning-bold)',
  error: 'var(--color-error)',
  errorForeground: 'var(--color-error-foreground)',
  errorMuted: 'var(--color-error-muted)',
  errorSubtle: 'var(--color-error-subtle)',
  errorBold: 'var(--color-error-bold)',
  info: 'var(--color-info)',
  infoForeground: 'var(--color-info-foreground)',
  infoMuted: 'var(--color-info-muted)',
  infoSubtle: 'var(--color-info-subtle)',
  infoBold: 'var(--color-info-bold)',
  neutral: 'var(--color-neutral)',
  neutralForeground: 'var(--color-neutral-foreground)',
  neutralMuted: 'var(--color-neutral-muted)',
  neutralSubtle: 'var(--color-neutral-subtle)',
  neutralBold: 'var(--color-neutral-bold)',
  background: 'var(--color-background)',
  foreground: 'var(--color-foreground)',
  surface: 'var(--color-surface)',
  surfaceForeground: 'var(--color-surface-foreground)',
  overlay: 'var(--color-overlay)',
  border: 'var(--color-border)',
  input: 'var(--color-input)',
  ring: 'var(--color-ring)',
  muted: 'var(--color-muted)',
  mutedForeground: 'var(--color-muted-foreground)',
  destructive: 'var(--color-destructive)',
  destructiveForeground: 'var(--color-destructive-foreground)',
  card: 'var(--color-card)',
  cardForeground: 'var(--color-card-foreground)',
  popover: 'var(--color-popover)',
  popoverForeground: 'var(--color-popover-foreground)',
  chart1: 'var(--color-chart-1)',
  chart2: 'var(--color-chart-2)',
  chart3: 'var(--color-chart-3)',
  chart4: 'var(--color-chart-4)',
  chart5: 'var(--color-chart-5)',
};

export function getSemanticColor(color: string): string {
  return colorMapping[color] || 'var(--color-foreground)';
}

export function getSemanticColors(): Record<string, string> {
  return { ...colorMapping };
}

export function semanticToCSSVariable(color: string): string {
  return colorMapping[color] || 'var(--color-foreground)';
}

export function cssVariableToSemantic(variable: string): string | null {
  for (const [key, value] of Object.entries(colorMapping)) {
    if (value === variable) return key;
  }
  return null;
}

export function getChartThemeColors(): string[] {
  return ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)'];
}

export default colorMapping;
