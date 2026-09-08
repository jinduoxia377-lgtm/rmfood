// Avatar 头像组件
Component({
  properties: {
    // 图片源
    src: {
      type: String,
      value: ''
    },
    // 文字
    text: {
      type: String,
      value: ''
    },
    // 尺寸
    size: {
      type: String,
      value: 'md'  // xs | sm | md | lg | xl
    },
    // 形状
    shape: {
      type: String,
      value: 'circle'  // circle | square | rounded
    },
    // 类型
    type: {
      type: String,
      value: ''  // primary | accent
    },
    // 徽章数字
    badge: {
      type: String,
      value: ''
    },
    // 自定义类名
    className: {
      type: String,
      value: ''
    }
  },

  methods: {
    handleTap() {
      this.triggerEvent('tap', {})
    }
  }
})
