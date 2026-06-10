/**
 * Material Design 3 圆角系统（Shape System）
 *
 * 基于 Material Design 3 规范，定义组件的圆角样式
 * 圆角值基于 4px 递增原则
 */

// 圆角令牌接口
export interface ShapeTokens {
  // 基础圆角值
  none: string;     // 0px
  xs: string;       // 4px
  sm: string;       // 8px
  md: string;       // 12px
  lg: string;       // 16px
  xl: string;       // 24px
  '2xl': string;    // 32px
  full: string;     // 9999px (圆形)

  // 组件专用圆角
  component: {
    button: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      full: string;
    };
    card: {
      sm: string;
      md: string;
      lg: string;
    };
    input: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
    };
    dialog: {
      sm: string;
      md: string;
      lg: string;
    };
    chip: {
      sm: string;
      md: string;
      full: string;
    };
    avatar: {
      sm: string;
      md: string;
      lg: string;
      full: string;
    };
    badge: {
      sm: string;
      md: string;
      full: string;
    };
  };

  // 形状变体
  variant: {
    rounded: {
      sm: string;
      md: string;
      lg: string;
    };
    pill: string;
    circle: string;
    square: string;
  };
}

// 默认圆角令牌
export const DEFAULT_SHAPE_TOKENS: ShapeTokens = {
  // 基础圆角值
  none: '0',
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  '2xl': '2rem',    // 32px
  full: '9999px',   // 圆形

  // 组件专用圆角
  component: {
    button: {
      xs: '0.25rem',    // 4px
      sm: '0.5rem',     // 8px
      md: '0.75rem',    // 12px
      lg: '1rem',       // 16px
      full: '9999px',   // 胶囊形
    },
    card: {
      sm: '0.5rem',     // 8px
      md: '0.75rem',    // 12px
      lg: '1rem',       // 16px
    },
    input: {
      xs: '0.25rem',    // 4px
      sm: '0.5rem',     // 8px
      md: '0.75rem',    // 12px
      lg: '1rem',       // 16px
    },
    dialog: {
      sm: '0.75rem',    // 12px
      md: '1rem',       // 16px
      lg: '1.5rem',     // 24px
    },
    chip: {
      sm: '0.5rem',     // 8px
      md: '1rem',       // 16px
      full: '9999px',   // 胶囊形
    },
    avatar: {
      sm: '0.5rem',     // 8px
      md: '1rem',       // 16px
      lg: '1.5rem',     // 24px
      full: '9999px',   // 圆形
    },
    badge: {
      sm: '0.25rem',    // 4px
      md: '0.5rem',     // 8px
      full: '9999px',   // 胶囊形
    },
  },

  // 形状变体
  variant: {
    rounded: {
      sm: '0.5rem',     // 8px
      md: '0.75rem',    // 12px
      lg: '1rem',       // 16px
    },
    pill: '9999px',
    circle: '50%',
    square: '0',
  },
};

// 圆角尺寸选项（用于设置界面）
export const SHAPE_SIZE_OPTIONS = [
  { value: 4, label: '4px', desc: '极小' },
  { value: 8, label: '8px', desc: '小' },
  { value: 12, label: '12px', desc: '默认' },
  { value: 16, label: '16px', desc: '大' },
  { value: 24, label: '24px', desc: '特大' },
  { value: 9999, label: '胶囊', desc: '圆角' },
];

// 生成圆角 CSS 变量
export function generateShapeVariables(tokens: ShapeTokens): Record<string, string> {
  const variables: Record<string, string> = {};

  // 基础圆角
  variables['--radius-none'] = tokens.none;
  variables['--radius-xs'] = tokens.xs;
  variables['--radius-sm'] = tokens.sm;
  variables['--radius-md'] = tokens.md;
  variables['--radius-lg'] = tokens.lg;
  variables['--radius-xl'] = tokens.xl;
  variables['--radius-2xl'] = tokens['2xl'];
  variables['--radius-full'] = tokens.full;

  // 组件圆角
  variables['--radius-button'] = tokens.component.button.md;
  variables['--radius-card'] = tokens.component.card.md;
  variables['--radius-input'] = tokens.component.input.md;
  variables['--radius-dialog'] = tokens.component.dialog.md;
  variables['--radius-chip'] = tokens.component.chip.md;
  variables['--radius-avatar'] = tokens.component.avatar.md;

  return variables;
}
