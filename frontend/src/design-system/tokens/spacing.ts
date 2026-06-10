/**
 * Material Design 3 间距系统
 *
 * 基于 Material Design 3 规范，使用 8px 作为基础单位
 * 间距值遵循 4px 递增原则，确保布局一致性
 */

// 间距令牌接口
export interface SpacingTokens {
  // 基础间距值（基于 8px 基准）
  none: string;    // 0px
  xs: string;      // 4px  - 紧凑元素内间距
  sm: string;      // 8px  - 小间距，元素内
  md: string;      // 16px - 标准间距，元素间
  lg: string;      // 24px - 大间距，区块间
  xl: string;      // 32px - 特大间距，页面区域
  '2xl': string;   // 48px - 极大间距，页面级
  '3xl': string;   // 64px - 超大间距
  '4xl': string;   // 80px - 最大间距

  // 水平间距
  inline: {
    none: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };

  // 垂直间距
  stack: {
    none: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };

  // 内边距预设
  padding: {
    none: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };

  // 外边距预设
  margin: {
    none: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    auto: string;
  };

  // 组件专用间距
  component: {
    button: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
    };
    card: {
      padding: string;
      gap: string;
    };
    input: {
      padding: string;
      gap: string;
    };
    dialog: {
      padding: string;
      gap: string;
    };
    list: {
      gap: string;
      padding: string;
    };
  };

  // 布局间距
  layout: {
    page: {
      padding: string;
      maxWidth: string;
    };
    section: {
      gap: string;
      padding: string;
    };
    container: {
      gap: string;
      padding: string;
    };
  };

  // 网格间距
  grid: {
    gap: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
    column: {
      gap: string;
    };
    row: {
      gap: string;
    };
  };

  // 触摸目标最小尺寸（WCAG 要求）
  touchTarget: {
    minWidth: string;
    minHeight: string;
  };
}

// 默认间距令牌
export const DEFAULT_SPACING_TOKENS: SpacingTokens = {
  // 基础间距值
  none: '0',
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
  '4xl': '5rem',    // 80px

  // 水平间距
  inline: {
    none: '0',
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
  },

  // 垂直间距
  stack: {
    none: '0',
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
  },

  // 内边距预设
  padding: {
    none: '0',
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
  },

  // 外边距预设
  margin: {
    none: '0',
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    auto: 'auto',
  },

  // 组件专用间距
  component: {
    button: {
      xs: '0.25rem 0.5rem',    // 4px 8px
      sm: '0.5rem 1rem',       // 8px 16px
      md: '0.5rem 1.5rem',     // 8px 24px
      lg: '0.75rem 2rem',      // 12px 32px
    },
    card: {
      padding: '1rem',         // 16px
      gap: '1rem',             // 16px
    },
    input: {
      padding: '0.5rem 0.75rem', // 8px 12px
      gap: '0.5rem',             // 8px
    },
    dialog: {
      padding: '1.5rem',        // 24px
      gap: '1rem',              // 16px
    },
    list: {
      gap: '0.5rem',            // 8px
      padding: '0.5rem',        // 8px
    },
  },

  // 布局间距
  layout: {
    page: {
      padding: '1rem',          // 16px
      maxWidth: '75rem',        // 1200px
    },
    section: {
      gap: '2rem',              // 32px
      padding: '1.5rem',        // 24px
    },
    container: {
      gap: '1.5rem',            // 24px
      padding: '1rem',          // 16px
    },
  },

  // 网格间距
  grid: {
    gap: {
      xs: '0.25rem',   // 4px
      sm: '0.5rem',    // 8px
      md: '1rem',      // 16px
      lg: '1.5rem',    // 24px
      xl: '2rem',      // 32px
    },
    column: {
      gap: '1rem',     // 16px
    },
    row: {
      gap: '0.5rem',   // 8px
    },
  },

  // 触摸目标最小尺寸（符合 WCAG 2.1 标准）
  touchTarget: {
    minWidth: '2.5rem',   // 40px
    minHeight: '2.5rem',  // 40px
  },
};

// 间距实用函数

/**
 * 计算响应式间距
 */
export function getResponsiveSpacing(
  baseSpacing: string,
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl',
): string {
  const scale: Record<string, number> = {
    xs: 0.75,
    sm: 0.875,
    md: 1,
    lg: 1.125,
    xl: 1.25,
  };

  const match = /([\d.]+)(rem|px)/.exec(baseSpacing);
  if (!match) return baseSpacing;

  const value = parseFloat(match[1]);
  const unit = match[2];

  return `${value * scale[breakpoint]}${unit}`;
}

/**
 * 生成间距 CSS 变量
 */
export function generateSpacingVariables(tokens: SpacingTokens): Record<string, string> {
  const variables: Record<string, string> = {};

  // 基础间距
  variables['--spacing-none'] = tokens.none;
  variables['--spacing-xs'] = tokens.xs;
  variables['--spacing-sm'] = tokens.sm;
  variables['--spacing-md'] = tokens.md;
  variables['--spacing-lg'] = tokens.lg;
  variables['--spacing-xl'] = tokens.xl;
  variables['--spacing-2xl'] = tokens['2xl'];
  variables['--spacing-3xl'] = tokens['3xl'];
  variables['--spacing-4xl'] = tokens['4xl'];

  // 内边距
  variables['--padding-xs'] = tokens.padding.xs;
  variables['--padding-sm'] = tokens.padding.sm;
  variables['--padding-md'] = tokens.padding.md;
  variables['--padding-lg'] = tokens.padding.lg;
  variables['--padding-xl'] = tokens.padding.xl;

  // 外边距
  variables['--margin-xs'] = tokens.margin.xs;
  variables['--margin-sm'] = tokens.margin.sm;
  variables['--margin-md'] = tokens.margin.md;
  variables['--margin-lg'] = tokens.margin.lg;
  variables['--margin-xl'] = tokens.margin.xl;

  // 触摸目标
  variables['--touch-target-min-width'] = tokens.touchTarget.minWidth;
  variables['--touch-target-min-height'] = tokens.touchTarget.minHeight;

  return variables;
}
