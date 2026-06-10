/**
 * Material Design 3 动画系统（Motion System）
 *
 * 基于 Material Design 3 规范，定义动画时长和缓动曲线
 */

// 动画时长接口
export interface MotionDuration {
  instant: string;   // 0ms - 即时
  fast: string;      // 50ms - 快速交互
  normal: string;    // 100ms - 标准交互
  slow: string;      // 150ms - 稍慢交互
  slower: string;    // 200ms - 慢速交互
  slowest: string;   // 250ms - 最慢交互

  // 组件专用时长
  enter: string;     // 进入动画
  exit: string;      // 退出动画（通常比进入快）
  transition: string; // 过渡动画
}

// 动画缓动接口
export interface MotionEasing {
  standard: string;     // 标准缓动
  emphasized: string;   // 强调缓动（用于重要操作）
  decelerated: string;  // 减速缓动（进入动画）
  accelerated: string;  // 加速缓动（退出动画）
  spring: string;       // 弹簧效果
}

// 动画延迟接口
export interface MotionDelay {
  none: string;
  short: string;
  medium: string;
  long: string;
}

// 完整动画令牌接口
export interface MotionTokens {
  duration: MotionDuration;
  easing: MotionEasing;
  delay: MotionDelay;

  // 组件专用动画
  component: {
    button: {
      press: string;
      release: string;
    };
    card: {
      lift: string;
      settle: string;
    };
    dialog: {
      enter: string;
      exit: string;
    };
    drawer: {
      enter: string;
      exit: string;
    };
    fab: {
      lift: string;
      settle: string;
    };
    tooltip: {
      enter: string;
      exit: string;
    };
    snackbar: {
      enter: string;
      exit: string;
    };
  };

  // 过渡属性
  transition: {
    all: string;
    colors: string;
    transform: string;
    opacity: string;
  };
}

// 默认动画令牌
export const DEFAULT_MOTION_TOKENS: MotionTokens = {
  // 动画时长
  duration: {
    instant: '0ms',
    fast: '50ms',
    normal: '100ms',
    slow: '150ms',
    slower: '200ms',
    slowest: '250ms',
    enter: '250ms',
    exit: '150ms',
    transition: '200ms',
  },

  // 动画缓动曲线
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerated: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerated: 'cubic-bezier(0.4, 0, 1, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },

  // 动画延迟
  delay: {
    none: '0ms',
    short: '50ms',
    medium: '100ms',
    long: '200ms',
  },

  // 组件专用动画
  component: {
    button: {
      press: '100ms cubic-bezier(0.4, 0, 0.2, 1)',
      release: '150ms cubic-bezier(0.2, 0, 0, 1)',
    },
    card: {
      lift: '200ms cubic-bezier(0.2, 0, 0, 1)',
      settle: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
    dialog: {
      enter: '250ms cubic-bezier(0.2, 0, 0, 1)',
      exit: '150ms cubic-bezier(0.4, 0, 1, 1)',
    },
    drawer: {
      enter: '250ms cubic-bezier(0.2, 0, 0, 1)',
      exit: '200ms cubic-bezier(0.4, 0, 1, 1)',
    },
    fab: {
      lift: '200ms cubic-bezier(0.2, 0, 0, 1)',
      settle: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
    tooltip: {
      enter: '150ms cubic-bezier(0.2, 0, 0, 1)',
      exit: '100ms cubic-bezier(0.4, 0, 1, 1)',
    },
    snackbar: {
      enter: '200ms cubic-bezier(0.2, 0, 0, 1)',
      exit: '150ms cubic-bezier(0.4, 0, 1, 1)',
    },
  },

  // 过渡属性
  transition: {
    all: 'all 200ms cubic-bezier(0.2, 0, 0, 1)',
    colors: 'color 150ms cubic-bezier(0.2, 0, 0, 1), background-color 150ms cubic-bezier(0.2, 0, 0, 1), border-color 150ms cubic-bezier(0.2, 0, 0, 1)',
    transform: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
    opacity: 'opacity 150ms cubic-bezier(0.2, 0, 0, 1)',
  },
};

// 动画选项
export const MOTION_DURATION_OPTIONS = [
  { value: 50, label: '50ms', desc: '快速' },
  { value: 100, label: '100ms', desc: '标准' },
  { value: 150, label: '150ms', desc: '适中' },
  { value: 200, label: '200ms', desc: '慢速' },
  { value: 250, label: '250ms', desc: '最慢' },
];

// 生成动画 CSS 变量
export function generateMotionVariables(tokens: MotionTokens): Record<string, string> {
  const variables: Record<string, string> = {};

  // 时长
  variables['--motion-duration-instant'] = tokens.duration.instant;
  variables['--motion-duration-fast'] = tokens.duration.fast;
  variables['--motion-duration-normal'] = tokens.duration.normal;
  variables['--motion-duration-slow'] = tokens.duration.slow;
  variables['--motion-duration-slower'] = tokens.duration.slower;
  variables['--motion-duration-slowest'] = tokens.duration.slowest;
  variables['--motion-duration-enter'] = tokens.duration.enter;
  variables['--motion-duration-exit'] = tokens.duration.exit;

  // 缓动曲线
  variables['--motion-easing-standard'] = tokens.easing.standard;
  variables['--motion-easing-emphasized'] = tokens.easing.emphasized;
  variables['--motion-easing-decelerated'] = tokens.easing.decelerated;
  variables['--motion-easing-accelerated'] = tokens.easing.accelerated;
  variables['--motion-easing-spring'] = tokens.easing.spring;

  // 过渡
  variables['--transition-all'] = tokens.transition.all;
  variables['--transition-colors'] = tokens.transition.colors;
  variables['--transition-transform'] = tokens.transition.transform;
  variables['--transition-opacity'] = tokens.transition.opacity;

  return variables;
}
