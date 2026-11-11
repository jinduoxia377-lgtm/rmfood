/**
 * RMFOOD 配方平台 - Motion 工具函数
 *
 * 所有动画均使用 compositor-friendly 属性 (transform, opacity)
 * 时长和缓动曲线来自设计系统 token (tokens.css)
 * 符合 prefers-reduced-motion 无障碍要求
 */

/**
 * 淡入动画
 * @param duration - 动画持续时间 (毫秒)
 * @returns CSS transition 字符串
 */
export function fadeIn(duration: number = 300): string {
 return `opacity ${duration}ms var(--ease-out-expo)`;
}

/**
 * 淡出动画
 * @param duration - 动画持续时间 (毫秒)
 * @returns CSS transition 字符串
 */
export function fadeOut(duration: number = 300): string {
 return `opacity ${duration}ms var(--ease-standard)`;
}

/**
 * 上滑进入动画
 * @param distance - 初始偏移距离 (像素)
 * @param duration - 动画持续时间 (毫秒)
 * @returns CSS transform transition 字符串
 */
export function slideUp(distance: number = 20, duration: number = 300): string {
 void distance;
 return `transform ${duration}ms var(--ease-out-expo)`;
}

/**
 * 下滑进入动画
 * @param distance - 初始偏移距离 (像素)
 * @param duration - 动画持续时间 (毫秒)
 * @returns CSS transform transition 字符串
 */
export function slideDown(distance: number = 20, duration: number = 300): string {
 void distance;
 return `transform ${duration}ms var(--ease-out-expo)`;
}

/**
 * 缩放脉冲动画
 * @param scale - 缩放比例
 * @param duration - 动画持续时间 (毫秒)
 * @returns CSS transform transition 字符串
 */
export function scalePulse(scale: number = 1.05, duration: number = 200): string {
 void scale;
 return `transform ${duration}ms var(--ease-standard)`;
}

/**
 * 获取当前动画配置
 * @param motionToken - 设计系统 motion token 名称
 * @returns CSS transition 配置对象
 */
export function getMotionConfig(motionToken: string): {
 duration: number;
 easing: string;
 transition: string;
} {
 const tokenMap: Record<string, { duration: number; easing: string }> = {
 fast: { duration: 150, easing:'var(--ease-standard)' },
 normal: { duration: 300, easing:'var(--ease-out-expo)' },
 slow: { duration: 500, easing:'var(--ease-standard)' },
 };

 const config = tokenMap[motionToken] || tokenMap['normal'];
 return {
 ...config,
 transition: `all ${config.duration}ms ${config.easing}`,
 };
}

/**
 * 检查是否应该禁用动画 (用户偏好减少动画)
 */
export function shouldReduceMotion(): boolean {
 if (typeof window !=='undefined') {
 const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
 return mediaQuery.matches;
 }
 return false;
}
