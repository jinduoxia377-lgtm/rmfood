/**
 * Material Design 3 高度系统（Elevation System）
 *
 * 基于 Material Design 3 规范，定义组件的阴影层级
 * 阴影值基于 1-24dp 的层级系统
 */

// 高度层级接口
export interface ElevationLevel {
  shadow: string;
  shadowColor?: string;
  elevation: number; // dp 值
}

// 高度令牌接口
export interface ElevationTokens {
  // 基础高度层级（0-5）
  level0: ElevationLevel;   // 0dp - 无阴影
  level1: ElevationLevel;   // 1dp - 轻微悬浮
  level2: ElevationLevel;   // 3dp - 卡片
  level3: ElevationLevel;   // 6dp - 弹出层
  level4: ElevationLevel;   // 8dp - 模态框
  level5: ElevationLevel;   // 12dp - 浮层

  // 扩展高度层级（6-24）
  level6: ElevationLevel;   // 16dp
  level7: ElevationLevel;   // 20dp
  level8: ElevationLevel;   // 24dp

  // 组件专用高度
  component: {
    card: ElevationLevel;
    button: {
      resting: ElevationLevel;
      hover: ElevationLevel;
      pressed: ElevationLevel;
    };
    dialog: ElevationLevel;
    dropdown: ElevationLevel;
    tooltip: ElevationLevel;
    snackbar: ElevationLevel;
    fab: {
      resting: ElevationLevel;
      hover: ElevationLevel;
      pressed: ElevationLevel;
    };
    sheet: {
      resting: ElevationLevel;
      elevated: ElevationLevel;
    };
  };

  // 高度强度控制
  intensity: {
    low: number;
    medium: number;
    high: number;
  };
}

// 默认高度令牌（浅色模式）
export const LIGHT_ELEVATION_TOKENS: ElevationTokens = {
  // 基础高度层级
  level0: {
    shadow: 'none',
    elevation: 0,
  },
  level1: {
    shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    elevation: 1,
  },
  level2: {
    shadow: '0 2px 4px 0 rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  level3: {
    shadow: '0 4px 8px 0 rgba(0, 0, 0, 0.05), 0 6px 12px 0 rgba(0, 0, 0, 0.1)',
    elevation: 6,
  },
  level4: {
    shadow: '0 6px 12px 0 rgba(0, 0, 0, 0.07), 0 8px 16px 0 rgba(0, 0, 0, 0.1)',
    elevation: 8,
  },
  level5: {
    shadow: '0 8px 16px 0 rgba(0, 0, 0, 0.07), 0 12px 24px 0 rgba(0, 0, 0, 0.1)',
    elevation: 12,
  },

  // 扩展高度层级
  level6: {
    shadow: '0 12px 24px 0 rgba(0, 0, 0, 0.08), 0 16px 32px 0 rgba(0, 0, 0, 0.12)',
    elevation: 16,
  },
  level7: {
    shadow: '0 16px 32px 0 rgba(0, 0, 0, 0.08), 0 20px 40px 0 rgba(0, 0, 0, 0.12)',
    elevation: 20,
  },
  level8: {
    shadow: '0 20px 40px 0 rgba(0, 0, 0, 0.08), 0 24px 48px 0 rgba(0, 0, 0, 0.12)',
    elevation: 24,
  },

  // 组件专用高度
  component: {
    card: {
      shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      elevation: 1,
    },
    button: {
      resting: {
        shadow: 'none',
        elevation: 0,
      },
      hover: {
        shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        elevation: 1,
      },
      pressed: {
        shadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1), 0 4px 6px 0 rgba(0, 0, 0, 0.1)',
        elevation: 2,
      },
    },
    dialog: {
      shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      elevation: 24,
    },
    dropdown: {
      shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      elevation: 8,
    },
    tooltip: {
      shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.3)',
      elevation: 6,
    },
    snackbar: {
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      elevation: 6,
    },
    fab: {
      resting: {
        shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        elevation: 6,
      },
      hover: {
        shadow: '0 6px 10px -1px rgba(0, 0, 0, 0.1), 0 4px 5px -1px rgba(0, 0, 0, 0.06)',
        elevation: 8,
      },
      pressed: {
        shadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
        elevation: 4,
      },
    },
    sheet: {
      resting: {
        shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        elevation: 1,
      },
      elevated: {
        shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        elevation: 8,
      },
    },
  },

  // 高度强度控制
  intensity: {
    low: 0.6,
    medium: 1,
    high: 1.4,
  },
};

// 深色模式高度令牌
export const DARK_ELEVATION_TOKENS: ElevationTokens = {
  // 基础高度层级（深色模式阴影更柔和）
  level0: {
    shadow: 'none',
    elevation: 0,
  },
  level1: {
    shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.1), 0 1px 3px 0 rgba(0, 0, 0, 0.15)',
    elevation: 1,
  },
  level2: {
    shadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1), 0 4px 6px 0 rgba(0, 0, 0, 0.15)',
    elevation: 3,
  },
  level3: {
    shadow: '0 4px 8px 0 rgba(0, 0, 0, 0.1), 0 6px 12px 0 rgba(0, 0, 0, 0.15)',
    elevation: 6,
  },
  level4: {
    shadow: '0 6px 12px 0 rgba(0, 0, 0, 0.12), 0 8px 16px 0 rgba(0, 0, 0, 0.15)',
    elevation: 8,
  },
  level5: {
    shadow: '0 8px 16px 0 rgba(0, 0, 0, 0.12), 0 12px 24px 0 rgba(0, 0, 0, 0.15)',
    elevation: 12,
  },

  // 扩展高度层级
  level6: {
    shadow: '0 12px 24px 0 rgba(0, 0, 0, 0.14), 0 16px 32px 0 rgba(0, 0, 0, 0.18)',
    elevation: 16,
  },
  level7: {
    shadow: '0 16px 32px 0 rgba(0, 0, 0, 0.14), 0 20px 40px 0 rgba(0, 0, 0, 0.18)',
    elevation: 20,
  },
  level8: {
    shadow: '0 20px 40px 0 rgba(0, 0, 0, 0.14), 0 24px 48px 0 rgba(0, 0, 0, 0.18)',
    elevation: 24,
  },

  // 组件专用高度（深色模式）
  component: {
    card: {
      shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.15), 0 1px 2px 0 rgba(0, 0, 0, 0.1)',
      elevation: 1,
    },
    button: {
      resting: {
        shadow: 'none',
        elevation: 0,
      },
      hover: {
        shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.1), 0 1px 3px 0 rgba(0, 0, 0, 0.15)',
        elevation: 1,
      },
      pressed: {
        shadow: '0 2px 4px 0 rgba(0, 0, 0, 0.15), 0 4px 6px 0 rgba(0, 0, 0, 0.15)',
        elevation: 2,
      },
    },
    dialog: {
      shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
      elevation: 24,
    },
    dropdown: {
      shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
      elevation: 8,
    },
    tooltip: {
      shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
      elevation: 6,
    },
    snackbar: {
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
      elevation: 6,
    },
    fab: {
      resting: {
        shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        elevation: 6,
      },
      hover: {
        shadow: '0 6px 10px -1px rgba(0, 0, 0, 0.15), 0 4px 5px -1px rgba(0, 0, 0, 0.1)',
        elevation: 8,
      },
      pressed: {
        shadow: '0 2px 4px 0 rgba(0, 0, 0, 0.15)',
        elevation: 4,
      },
    },
    sheet: {
      resting: {
        shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.15), 0 1px 2px 0 rgba(0, 0, 0, 0.1)',
        elevation: 1,
      },
      elevated: {
        shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
        elevation: 8,
      },
    },
  },

  // 高度强度控制
  intensity: {
    low: 0.6,
    medium: 1,
    high: 1.4,
  },
};

// 高度强度选项
export const ELEVATION_INTENSITY_OPTIONS = [
  { value: 0, label: '无阴影', desc: '0' },
  { value: 1, label: '轻微', desc: '1' },
  { value: 2, label: '适中', desc: '2' },
  { value: 3, label: '明显', desc: '3' },
  { value: 4, label: '强烈', desc: '4' },
];

// 生成高度 CSS 变量
export function generateElevationVariables(tokens: ElevationTokens): Record<string, string> {
  const variables: Record<string, string> = {};

  // 基础高度层级
  variables['--elevation-0'] = tokens.level0.shadow;
  variables['--elevation-1'] = tokens.level1.shadow;
  variables['--elevation-2'] = tokens.level2.shadow;
  variables['--elevation-3'] = tokens.level3.shadow;
  variables['--elevation-4'] = tokens.level4.shadow;
  variables['--elevation-5'] = tokens.level5.shadow;
  variables['--elevation-6'] = tokens.level6.shadow;
  variables['--elevation-7'] = tokens.level7.shadow;
  variables['--elevation-8'] = tokens.level8.shadow;

  // 组件高度
  variables['--shadow-card'] = tokens.component.card.shadow;
  variables['--shadow-button-resting'] = tokens.component.button.resting.shadow;
  variables['--shadow-button-hover'] = tokens.component.button.hover.shadow;
  variables['--shadow-button-pressed'] = tokens.component.button.pressed.shadow;
  variables['--shadow-dialog'] = tokens.component.dialog.shadow;
  variables['--shadow-dropdown'] = tokens.component.dropdown.shadow;
  variables['--shadow-tooltip'] = tokens.component.tooltip.shadow;
  variables['--shadow-fab'] = tokens.component.fab.resting.shadow;

  // 高度强度
  variables['--elevation-intensity'] = tokens.intensity.medium.toString();

  return variables;
}
