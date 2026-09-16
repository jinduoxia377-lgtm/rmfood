/**
 * 主题过渡动画工具
 * 提供 fade、slide、scale、none 等过渡效果
 */

export type TransitionType = 'fade' | 'slide' | 'scale' | 'none';

export interface TransitionConfig {
  type: TransitionType;
  duration: number;
  easing: string;
}

const defaultTransitions: Record<TransitionType, TransitionConfig> = {
  fade: { type: 'fade', duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  slide: { type: 'slide', duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  scale: { type: 'scale', duration: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  none: { type: 'none', duration: 0, easing: 'linear' },
};

export function applyTransition(element: Element | null, config: TransitionConfig = defaultTransitions.fade): void {
  if (!element) return;
  const { type, duration, easing } = config;
  element.classList.remove('theme-transition-fade', 'theme-transition-slide', 'theme-transition-scale');
  switch (type) {
    case 'fade': element.classList.add('theme-transition-fade'); break;
    case 'slide': element.classList.add('theme-transition-slide'); break;
    case 'scale': element.classList.add('theme-transition-scale'); break;
    case 'none': break;
  }
  (element as HTMLElement).style.transitionDuration = `${duration}ms`;
  (element as HTMLElement).style.transitionTimingFunction = easing;
  if (type !== 'none') {
    const timer = setTimeout(() => {
      element?.classList.remove('theme-transition-fade', 'theme-transition-slide', 'theme-transition-scale');
    }, duration + 50);
    // return cleanup
  }
}

export function getThemeTransitionCSS(type: TransitionType = 'fade'): string {
  const config = defaultTransitions[type];
  switch (type) {
    case 'fade':
      return `.theme-transition-fade { animation: themeFadeIn ${config.duration}ms ${config.easing} forwards; } @keyframes themeFadeIn { from { opacity: 0; } to { opacity: 1; } }`;
    case 'slide':
      return `.theme-transition-slide { animation: themeSlideIn ${config.duration}ms ${config.easing} forwards; } @keyframes themeSlideIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
    case 'scale':
      return `.theme-transition-scale { animation: themeScaleIn ${config.duration}ms ${config.easing} forwards; } @keyframes themeScaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`;
    default: return '';
  }
}

export function createThemeTransitionStyles(type: TransitionType = 'fade'): HTMLStyleElement {
  const style = document.createElement('style');
  style.setAttribute('data-theme-transition', type);
  style.textContent = getThemeTransitionCSS(type);
  document.head.appendChild(style);
  return style;
}

export function removeThemeTransitionStyles(): void {
  document.querySelectorAll('[data-theme-transition]').forEach(s => s.remove());
}

export async function transitionToTheme(element: Element | null, fromTheme: string, toTheme: string, config: TransitionConfig = defaultTransitions.fade): Promise<void> {
  return new Promise((resolve) => {
    if (!element) { resolve(); return; }
    const { duration } = config;
    element.classList.add('theme-transitioning');
    element.setAttribute('data-theme', toTheme);
    setTimeout(() => {
      element?.classList.remove('theme-transitioning');
      resolve();
    }, duration);
  });
}

export function getDefaultTransition(): TransitionConfig {
  return defaultTransitions.fade;
}

export default defaultTransitions;

