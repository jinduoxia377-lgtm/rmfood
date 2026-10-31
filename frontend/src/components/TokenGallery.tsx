/**
 * 设计 Token 可视化文档组件 (v2.0 - 完整版)
 *
 * 显示所有设计 token 的可视化预览
 * 包括颜色、字体、间距、圆角、阴影等
 *
 * 使用方式：
 *   import { TokenGallery } from '@/components/TokenGallery'
 *   <TokenGallery />
 */

import React from 'react';
import { DESIGN_SYSTEM } from '@/types/design-tokens';

const TokenGallery: React.FC = () => {
  const {
    colors,
    sizes,
    lineHeights,
    weights,
    letterSpacings: _letterSpacings,
    spacing,
    radius,
    shadows,
  } = DESIGN_SYSTEM;

  // 间距像素值转换函数
  const remToPx = (rem: string): number => {
    const match = rem.match(/^([\d.]+)rem$/);
    return match ? parseFloat(match[1]) * 16 : 0;
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-12 max-w-7xl mx-auto">
      {/* 标题 */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">RMFOOD 设计 Token 文档</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">可视化参考所有设计系统令牌</p>
      </div>

      {/* 颜色系统 */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">颜色系统 (Colors)</h2>

        {/* 品牌主色 */}
        <div>
          <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-3">品牌主色 - Emerald Green</h3>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Object.entries(colors.brand.primary).map(([shade, hex]) =>
              shade.match(/^\d{3}$/) ? (
                <div key={shade} className="text-center">
                  <div
                    className="w-full aspect-square rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700"
                    style={{ backgroundColor: hex }}
                  />
                  <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{shade}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{hex}</div>
                </div>
              ) : null,
            )}
          </div>
        </div>

        {/* 品牌辅色 */}
        <div>
          <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-3">品牌辅色 - Ocean Blue</h3>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Object.entries(colors.secondary.secondary).map(([shade, hex]) =>
              shade.match(/^\d{3}$/) ? (
                <div key={shade} className="text-center">
                  <div
                    className="w-full aspect-square rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700"
                    style={{ backgroundColor: hex }}
                  />
                  <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{shade}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{hex}</div>
                </div>
              ) : null,
            )}
          </div>
        </div>

        {/* 品牌强调色 */}
        <div>
          <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-3">品牌强调色 - Bio Purple</h3>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Object.entries(colors.accent.accent).map(([shade, hex]) =>
              shade.match(/^\d{3}$/) ? (
                <div key={shade} className="text-center">
                  <div
                    className="w-full aspect-square rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700"
                    style={{ backgroundColor: hex }}
                  />
                  <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{shade}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{hex}</div>
                </div>
              ) : null,
            )}
          </div>
        </div>

        {/* 功能色 */}
        <div>
          <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-3">功能色 (Functional Colors)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(colors.functional).map(([name, color]) => (
              <div key={name} className="text-center space-y-2">
                <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 capitalize">{name}</div>
                <div
                  className="w-full h-12 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700"
                  style={{ backgroundColor: color.main }}
                />
                <div className="text-xs text-neutral-500 dark:text-neutral-400">{color.main}</div>
                <div className="text-xs text-neutral-400 dark:text-neutral-400">BG: {color.bg}</div>
                <div className="text-xs text-neutral-400 dark:text-neutral-400">TEXT: {color.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 字体系统 */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">字体系统 (Typography)</h2>

        {/* 字体大小 */}
        <div>
          <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-3">字体大小</h3>
          <div className="space-y-3">
            {Object.entries(sizes).map(([name, size]) => (
              <div key={name} className="flex items-center gap-4">
                <div className="w-32 text-sm text-neutral-600 dark:text-neutral-400 font-mono">--text-{name}</div>
                <div className="flex-1 text-neutral-900 dark:text-white" style={{ fontSize: size }}>
                  设计系统 {name} - {size}
                </div>
                <div className="w-24 text-right text-xs text-neutral-500 dark:text-neutral-400 font-mono">{size}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 行高 */}
        <div>
          <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-3">行高 (Line Heights)</h3>
          <div className="space-y-2">
            {Object.entries(lineHeights).map(([name, lh]) => (
              <div key={name} className="flex items-center gap-4">
                <div className="w-32 text-sm text-neutral-600 dark:text-neutral-400 font-mono">--lh-{name}</div>
                <div
                  className="flex-1 text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 p-2 rounded"
                  style={{ lineHeight: lh }}
                >
                  示例文本 - {name} ({lh})
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 字重 */}
        <div>
          <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-3">字重 (Font Weights)</h3>
          <div className="space-y-2">
            {Object.entries(weights).map(([name, weight]) => (
              <div key={name} className="flex items-center gap-4">
                <div className="w-32 text-sm text-neutral-600 dark:text-neutral-400 font-mono">--fw-{name}</div>
                <div className="flex-1 text-neutral-900 dark:text-white" style={{ fontWeight: weight }}>
                  示例文本 - {name} ({weight})
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 间距系统 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">间距系统 (Spacing)</h2>

        <div className="space-y-2">
          {Object.entries(spacing).map(([name, value]) => {
            if (name === '0') return null;
            const pxValue = remToPx(value);
            return (
              <div key={name} className="flex items-center gap-4">
                <div className="w-24 text-sm text-neutral-600 dark:text-neutral-400 font-mono">--spacing-{name}</div>
                <div className="h-4 bg-primary-500 rounded" style={{ width: `${pxValue}px` }} />
                <div className="w-20 text-right text-xs text-neutral-500 dark:text-neutral-400 font-mono">{value}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 圆角系统 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">圆角系统 (Border Radius)</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(radius).map(([name, value]) => (
            <div key={name} className="text-center">
              <div
                className="w-16 h-16 bg-primary-500 mx-auto"
                style={{ borderRadius: value }}
              />
              <div className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">{name}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 阴影系统 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">阴影系统 (Shadows)</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(shadows).map(([name, value]) => (
            <div key={name} className="text-center">
              <div
                className="w-16 h-16 bg-white dark:bg-neutral-800 mx-auto flex items-center justify-center"
                style={{ boxShadow: value }}
              >
                <div className="w-8 h-8 bg-primary-500" />
              </div>
              <div className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">{name}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 break-all">{value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export { TokenGallery };
export default TokenGallery;
