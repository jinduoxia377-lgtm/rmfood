/**
 * Material Design 3 状态层系统（State Layer System）
 *
 * 基于 Material Design 3 规范，定义组件交互状态的透明度值
 */

// 状态层透明度接口
export interface StateLayerTokens {
  // 基础状态透明度
  hover: number;       // 悬停状态 (8%)
  focus: number;       // 焦点状态 (12%)
  pressed: number;     // 按下状态 (12%)
  dragged: number;     // 拖拽状态 (16%)

  // 组件专用状态
  component: {
    button: {
      hover: number;
      focus: number;
      pressed: number;
      disabled: number;
    };
    card: {
      hover: number;
      focus: number;
      pressed: number;
    };
    chip: {
      hover: number;
      focus: number;
      pressed: number;
      selected: number;
    };
    iconButton: {
      hover: number;
      focus: number;
      pressed: number;
      disabled: number;
    };
    listItem: {
      hover: number;
      focus: number;
      pressed: number;
      selected: number;
    };
    navigationRail: {
      hover: number;
      focus: number;
      pressed: number;
      selected: number;
    };
    navigationBar: {
      hover: number;
      focus: number;
      pressed: number;
      selected: number;
    };
    tabs: {
      hover: number;
      focus: number;
      pressed: number;
      selected: number;
    };
    textField: {
      hover: number;
      focus: number;
      disabled: number;
      error: number;
    };
    switch: {
      hover: number;
      focus: number;
      pressed: number;
      selected: number;
    };
    checkbox: {
      hover: number;
      focus: number;
      pressed: number;
      selected: number;
      indeterminate: number;
    };
    radio: {
      hover: number;
      focus: number;
      pressed: number;
      selected: number;
    };
  };

  // 全局禁用状态
  disabled: {
    opacity: number;
    cursor: string;
  };
}

// 默认状态层令牌
export const DEFAULT_STATE_LAYER_TOKENS: StateLayerTokens = {
  // 基础状态透明度（基于 Material Design 3 标准）
  hover: 0.08,
  focus: 0.12,
  pressed: 0.12,
  dragged: 0.16,

  // 组件专用状态
  component: {
    button: {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
      disabled: 0.38,
    },
    card: {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
    },
    chip: {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
      selected: 0.12,
    },
    iconButton: {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
      disabled: 0.38,
    },
    listItem: {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
      selected: 0.12,
    },
    navigationRail: {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
      selected: 0.12,
    },
    navigationBar: {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
      selected: 0.12,
    },
    tabs: {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
      selected: 0.12,
    },
    textField: {
      hover: 0.08,
      focus: 0.12,
      disabled: 0.38,
      error: 0.87,
    },
    switch: {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
      selected: 0.12,
    },
    checkbox: {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
      selected: 0.12,
      indeterminate: 0.12,
    },
    radio: {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
      selected: 0.12,
    },
  },

  // 全局禁用状态
  disabled: {
    opacity: 0.38,
    cursor: 'not-allowed',
  },
};

// 生成状态层 CSS 变量
export function generateStateLayerVariables(tokens: StateLayerTokens): Record<string, string> {
  const variables: Record<string, string> = {};

  // 基础状态
  variables['--state-layer-hover'] = tokens.hover.toString();
  variables['--state-layer-focus'] = tokens.focus.toString();
  variables['--state-layer-pressed'] = tokens.pressed.toString();
  variables['--state-layer-dragged'] = tokens.dragged.toString();

  // 组件状态
  variables['--state-button-hover'] = tokens.component.button.hover.toString();
  variables['--state-button-focus'] = tokens.component.button.focus.toString();
  variables['--state-button-pressed'] = tokens.component.button.pressed.toString();
  variables['--state-button-disabled'] = tokens.component.button.disabled.toString();

  variables['--state-card-hover'] = tokens.component.card.hover.toString();
  variables['--state-card-focus'] = tokens.component.card.focus.toString();
  variables['--state-card-pressed'] = tokens.component.card.pressed.toString();

  variables['--state-chip-hover'] = tokens.component.chip.hover.toString();
  variables['--state-chip-selected'] = tokens.component.chip.selected.toString();

  variables['--state-icon-button-hover'] = tokens.component.iconButton.hover.toString();
  variables['--state-icon-button-pressed'] = tokens.component.iconButton.pressed.toString();

  variables['--state-list-item-hover'] = tokens.component.listItem.hover.toString();
  variables['--state-list-item-selected'] = tokens.component.listItem.selected.toString();

  variables['--state-text-field-focus'] = tokens.component.textField.focus.toString();
  variables['--state-text-field-error'] = tokens.component.textField.error.toString();

  // 禁用状态
  variables['--state-disabled-opacity'] = tokens.disabled.opacity.toString();
  variables['--state-disabled-cursor'] = tokens.disabled.cursor;

  return variables;
}
