// Loading 加载组件
Component({
  properties: {
    // 尺寸
    size: {
      type: String,
      value: 'md'  // xs | sm | md | lg
    },
    // 类型
    type: {
      type: String,
      value: 'spinner'  // spinner | dots
    },
    // 文字
    text: {
      type: String,
      value: ''
    },
    // 自定义类名
    className: {
      type: String,
      value: ''
    }
  }
})
