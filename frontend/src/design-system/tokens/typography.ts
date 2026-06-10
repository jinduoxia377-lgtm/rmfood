/**
 * Material Design 3 排版系统
 *
 * 基于 Material Design 3 排版规范，包含：
 * - 字体家族 (Font Families)
 * - 字体大小 (Font Sizes)
 * - 字重 (Font Weights)
 * - 行高 (Line Heights)
 * - 字间距 (Letter Spacing)
 * - 排版类型组合 (Type Styles)
 *
 * 符合 WCAG 2.1 AA 对比度要求
 */

// 字体家族类型
export interface FontFamily {
  id: string;
  name: string;
  family: string;
  category: 'sans-serif' | 'serif' | 'mono' | 'cjk';
  weights?: number[];
  preview?: string;
  description?: string;
}

// 字体大小配置
export interface FontSizeConfig {
  value: string;
  lineHeight: string;
  letterSpacing?: string;
}

// 字体层级
export interface TypographyLevel {
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
}

// 完整排版令牌
export interface TypographyTokens {
  // 字体家族
  fontFamily: {
    sans: string;
    serif: string;
    mono: string;
    display: string;
  };

  // 字体大小系统（基于 Major Third 比例 1.25）
  fontSize: {
    display: string;      // 57px - 品牌展示
    displaySm: string;    // 45px - 大屏主标题
    headlineLg: string;   // 36px - H1
    headlineMd: string;   // 28px - H2
    headlineSm: string;   // 24px - H3
    titleLg: string;      // 22px - H4
    titleMd: string;      // 16px - 强调文本
    titleSm: string;      // 14px - 小标题
    bodyLg: string;       // 16px - 大正文
    bodyMd: string;       // 14px - 标准正文
    bodySm: string;       // 12px - 辅助说明
    labelLg: string;      // 14px - 大标签
    labelMd: string;      // 12px - 表单标签
    labelSm: string;      // 11px - 徽章/角标
  };

  // 行高系统
  lineHeight: {
    none: string;
    tight: string;
    snug: string;
    normal: string;
    relaxed: string;
    loose: string;
  };

  // 字重系统
  fontWeight: {
    light: number;
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };

  // 字间距系统
  letterSpacing: {
    tight: string;
    normal: string;
    wide: string;
    wider: string;
  };

  // 排版类型组合
  typeStyle: {
    display: TypographyLevel;
    displaySm: TypographyLevel;
    headlineLg: TypographyLevel;
    headlineMd: TypographyLevel;
    headlineSm: TypographyLevel;
    titleLg: TypographyLevel;
    titleMd: TypographyLevel;
    titleSm: TypographyLevel;
    bodyLg: TypographyLevel;
    bodyMd: TypographyLevel;
    bodySm: TypographyLevel;
    labelLg: TypographyLevel;
    labelMd: TypographyLevel;
    labelSm: TypographyLevel;
  };

  // 图标尺寸
  iconSize: {
    xs: string;   // 14px
    sm: string;   // 16px
    md: string;   // 20px
    lg: string;   // 24px
    xl: string;   // 32px
    '2xl': string; // 40px
  };

  // 图表专用排版
  chart: {
    axisLabel: TypographyLevel;
    axisTitle: TypographyLevel;
    legendText: TypographyLevel;
    tooltipTitle: TypographyLevel;
    tooltipContent: TypographyLevel;
    dataLabel: TypographyLevel;
  };
}

// 字体选项预设
export const FONT_FAMILIES: FontFamily[] = [
  {
    id: 'system',
    name: '系统默认',
    family: "'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    description: '操作系统默认中文字体',
    preview: '微软雅黑 Aa',
  },
  {
    id: 'inter',
    name: 'Inter',
    family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    category: 'sans-serif',
    weights: [300, 400, 500, 600, 700, 800],
    description: '现代无衬线字体，适合界面显示',
    preview: 'Inter Aa',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    family: "'Roboto', 'Helvetica Neue', Arial, sans-serif",
    category: 'sans-serif',
    weights: [300, 400, 500, 700, 900],
    description: 'Material Design 标准字体',
    preview: 'Roboto Aa',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    family: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    category: 'mono',
    weights: [400, 500, 600, 700],
    description: '等宽编程字体，适合代码展示',
    preview: 'JetBrains',
  },
  {
    id: 'source-han-serif',
    name: '思源宋体',
    family: "'Source Han Serif SC', 'SimSun', serif",
    category: 'serif',
    weights: [400, 500, 600, 700],
    description: '中文衬线字体，适合正式文档',
    preview: '思源宋体',
  },
  {
    id: 'lxgwenkai',
    name: '霞鹜文楷',
    family: "'LXGWenKai', 'STKaiti', 'KaiTi', serif",
    category: 'cjk',
    weights: [400, 500, 600, 700],
    description: '中文楷体，优雅美观',
    preview: '霞鹜文楷',
  },
];

// 默认排版令牌
export const DEFAULT_TYPOGRAPHY_TOKENS: TypographyTokens = {
  // 字体家族
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    serif: "'Source Han Serif SC', 'Georgia', serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    display: "'Inter', 'Roboto', sans-serif",
  },

  // 字体大小系统（基于 16px 基准，Major Third 比例）
  fontSize: {
    display: '3.5625rem',      // 57px
    displaySm: '2.8125rem',    // 45px
    headlineLg: '2.25rem',     // 36px
    headlineMd: '1.75rem',     // 28px
    headlineSm: '1.5rem',      // 24px
    titleLg: '1.375rem',       // 22px
    titleMd: '1rem',           // 16px
    titleSm: '0.875rem',       // 14px
    bodyLg: '1rem',            // 16px
    bodyMd: '0.875rem',        // 14px - 最常用
    bodySm: '0.75rem',         // 12px
    labelLg: '0.875rem',       // 14px
    labelMd: '0.75rem',        // 12px
    labelSm: '0.6875rem',      // 11px
  },

  // 行高系统
  lineHeight: {
    none: '1',
    tight: '1.2',
    snug: '1.3',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },

  // 字重系统
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // 字间距系统
  letterSpacing: {
    tight: '-0.025em',
    normal: '0em',
    wide: '0.05em',
    wider: '0.1em',
  },

  // 排版类型组合
  typeStyle: {
    display: {
      fontSize: '3.5625rem',
      lineHeight: '1.2',
      fontWeight: 700,
    },
    displaySm: {
      fontSize: '2.8125rem',
      lineHeight: '1.2',
      fontWeight: 700,
    },
    headlineLg: {
      fontSize: '2.25rem',
      lineHeight: '1.2',
      fontWeight: 700,
    },
    headlineMd: {
      fontSize: '1.75rem',
      lineHeight: '1.3',
      fontWeight: 600,
    },
    headlineSm: {
      fontSize: '1.5rem',
      lineHeight: '1.3',
      fontWeight: 600,
    },
    titleLg: {
      fontSize: '1.375rem',
      lineHeight: '1.5',
      fontWeight: 500,
    },
    titleMd: {
      fontSize: '1rem',
      lineHeight: '1.5',
      fontWeight: 500,
    },
    titleSm: {
      fontSize: '0.875rem',
      lineHeight: '1.5',
      fontWeight: 500,
    },
    bodyLg: {
      fontSize: '1rem',
      lineHeight: '1.625',
      fontWeight: 400,
    },
    bodyMd: {
      fontSize: '0.875rem',
      lineHeight: '1.5',
      fontWeight: 400,
    },
    bodySm: {
      fontSize: '0.75rem',
      lineHeight: '1.5',
      fontWeight: 400,
    },
    labelLg: {
      fontSize: '0.875rem',
      lineHeight: '1.5',
      fontWeight: 500,
    },
    labelMd: {
      fontSize: '0.75rem',
      lineHeight: '1.5',
      fontWeight: 500,
    },
    labelSm: {
      fontSize: '0.6875rem',
      lineHeight: '1.5',
      fontWeight: 500,
    },
  },

  // 图标尺寸
  iconSize: {
    xs: '14px',
    sm: '16px',
    md: '20px',
    lg: '24px',
    xl: '32px',
    '2xl': '40px',
  },

  // 图表专用排版
  chart: {
    axisLabel: {
      fontSize: '0.75rem',
      lineHeight: '1.5',
      fontWeight: 400,
    },
    axisTitle: {
      fontSize: '0.75rem',
      lineHeight: '1.5',
      fontWeight: 500,
    },
    legendText: {
      fontSize: '0.875rem',
      lineHeight: '1.5',
      fontWeight: 400,
    },
    tooltipTitle: {
      fontSize: '0.875rem',
      lineHeight: '1.5',
      fontWeight: 600,
    },
    tooltipContent: {
      fontSize: '0.75rem',
      lineHeight: '1.5',
      fontWeight: 400,
    },
    dataLabel: {
      fontSize: '0.75rem',
      lineHeight: '1.5',
      fontWeight: 500,
    },
  },
};

// 响应式字体大小配置
export const RESPONSIVE_FONT_SCALE = {
  mobile: 0.875,   // 移动端缩小 12.5%
  tablet: 1,       // 平板正常
  desktop: 1,      // 桌面正常
  large: 1.125,    // 大屏幕放大 12.5%
};

// 字体大小选项（用于设置界面）
export const FONT_SIZE_OPTIONS = [
  { value: 12, label: '12px', desc: '小号' },
  { value: 14, label: '14px', desc: '默认' },
  { value: 16, label: '16px', desc: '标准' },
  { value: 18, label: '18px', desc: '大号' },
  { value: 20, label: '20px', desc: '特大' },
];

// 字重选项
export const FONT_WEIGHT_OPTIONS = [
  { value: 300, label: '细体', desc: 'Light 300' },
  { value: 400, label: '常规', desc: 'Regular 400' },
  { value: 500, label: '中等', desc: 'Medium 500' },
  { value: 600, label: '半粗', desc: 'Semi Bold 600' },
  { value: 700, label: '粗体', desc: 'Bold 700' },
];

// 行高选项
export const LINE_HEIGHT_OPTIONS = [
  { value: 1.0, label: '紧凑', desc: '1.0' },
  { value: 1.25, label: '适中', desc: '1.25' },
  { value: 1.5, label: '标准', desc: '1.5' },
  { value: 1.75, label: '宽松', desc: '1.75' },
  { value: 2.0, label: '舒展', desc: '2.0' },
];

// 字间距选项
export const LETTER_SPACING_OPTIONS = [
  { value: -0.5, label: '紧密', desc: '-0.5px' },
  { value: 0, label: '标准', desc: '0' },
  { value: 0.5, label: '宽松', desc: '0.5px' },
  { value: 1, label: '分散', desc: '1.0px' },
];
