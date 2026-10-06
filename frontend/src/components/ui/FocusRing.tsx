/**
 * FocusRing 组件 - 院士级设计系统
 *
 * 为所有交互元素提供统一的焦点可视化
 * 符合 WCAG 2.2 AA 标准
 */
import * as React from'react';
import { cn } from'@/lib/utils';

interface FocusRingProps extends React.HTMLAttributes<HTMLDivElement> {
 /** 焦点环颜色 (默认使用品牌色) */
 color?: string;
 /** 焦点环宽度 (默认 2px) */
 width?: number;
 /** 是否始终显示焦点环 (默认 false) */
 alwaysShow?: boolean;
}

export const FocusRing: React.FC<FocusRingProps> = ({
 className,
 color ='var(--color-primary)',
 width = 2,
 alwaysShow = false,
 children,
 ...props
}) => {
 return (
 <div
 className={cn(
'relative',
 alwaysShow
 ? `outline-none ring-2 ring-offset-2`
 :'focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2',
 className,
 )}
 style={alwaysShow ? ({'--ring-color': color,'--ring-width': `${width}px` } as React.CSSProperties) : undefined}
 {...props}
 >
 {children}
 </div>
 );
};

/**
 * 全局焦点样式钩子
 * 为所有可聚焦元素添加 focus-visible 样式
 */
export function useFocusStyles() {
 React.useEffect(() => {
 const style = document.createElement('style');
 style.textContent = `
 /* 全局 focus-visible 样式 */
 *:focus-visible {
 outline: 2px solid var(--color-primary);
 outline-offset: 2px;
 }

 /* 按钮焦点样式 */
 button:focus-visible,
 a:focus-visible {
 outline: 2px solid var(--color-primary);
 outline-offset: 2px;
 border-radius: var(--radius-sm);
 }

 /* 输入框焦点样式 */
 input:focus-visible,
 textarea:focus-visible,
 select:focus-visible {
 outline: 2px solid var(--color-primary);
 outline-offset: 1px;
 border-color: var(--color-primary);
 }

 /* 减少动画模式 */
 @media (prefers-reduced-motion: reduce) {
 *:focus-visible {
 outline-offset: 0;
 }
 }
 `;
 document.head.appendChild(style);
 return () => {
 document.head.removeChild(style);
 };
 }, []);
}
