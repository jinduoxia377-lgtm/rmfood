/**
 * 主题组件包装器
 * 提供 ThemedComponent、ThemedPage、ThemedCard、ThemedButton 等包装组件
 */

import React, { ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';

interface ThemedComponentProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface ThemedPageProps extends ThemedComponentProps {
  title?: string;
  description?: string;
}

interface ThemedCardProps extends ThemedComponentProps {
  variant?: 'default' | 'elevated' | 'outlined';
}

interface ThemedButtonProps extends ThemedComponentProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 主题化组件包装器
 */
export const ThemedComponent: React.FC<ThemedComponentProps> = ({
  children,
  className = '',
  style,
}) => {
  const { mode } = useTheme();
  
  return (
    <div
      className={`themed-component ${className}`}
      data-theme={mode}
      data-mode={mode}
      style={style}
    >
      {children}
    </div>
  );
};

/**
 * 主题化页面包装器
 */
export const ThemedPage: React.FC<ThemedPageProps> = ({
  children,
  className = '',
  title,
  description,
  style,
}) => {
  const { mode } = useTheme();
  
  return (
    <div
      className={`themed-page ${className}`}
      data-mode={mode}
      style={style}
    >
      {(title || description) && (
        <header className="themed-page-header">
          {title && <h1 className="themed-page-title">{title}</h1>}
          {description && <p className="themed-page-description">{description}</p>}
        </header>
      )}
      <main className="themed-page-content">{children}</main>
    </div>
  );
};

/**
 * 主题化卡片包装器
 */
export const ThemedCard: React.FC<ThemedCardProps> = ({
  children,
  className = '',
  variant = 'default',
  style,
}) => {
  const { mode } = useTheme();
  
  return (
    <div
      className={`themed-card themed-card--${variant} ${className}`}
      data-mode={mode}
      style={style}
    >
      {children}
    </div>
  );
};

/**
 * 主题化按钮包装器
 */
export const ThemedButton: React.FC<ThemedButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  style,
  ...props
}) => {
  const { mode } = useTheme();
  
  return (
    <button
      className={`themed-button themed-button--${variant} themed-button--${size} ${className}`}
      data-mode={mode}
      style={style}
      {...props}
    >
      {children}
    </button>
  );
};

/**
 * 主题化容器包装器
 */
export const ThemedContainer: React.FC<ThemedComponentProps> = ({
  children,
  className = '',
  style,
}) => {
  const { mode } = useTheme();
  
  return (
    <div
      className={`themed-container ${className}`}
      data-mode={mode}
      style={style}
    >
      {children}
    </div>
  );
};

/**
 * 批量应用主题包装
 */
export function withTheme<T extends object>(
  Component: React.ComponentType<T & { theme?: any }>
): React.FC<T> {
  return function ThemedWrapper(props: T) {
    const { mode } = useTheme();
    
    return (
      <Component
        {...props}
        theme={{ mode }}
      />
    );
  };
}

export default ThemedComponent;





