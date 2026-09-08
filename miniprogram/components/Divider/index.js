// Divider 分割线组件
Component({
  properties: {
    // 左侧文字
    leftText: {
      type: String,
      value: ''
    },
    // 右侧文字
    rightText: {
      type: String,
      value: ''
    },
    // 颜色
    color: {
      type: String,
      value: ''
    },
    // 类型
    type: {
      type: String,
      value: 'solid'  // solid | dashed | dotted | none
    },
    // 对齐
    align: {
      type: String,
      value: 'center'
    },
    // 自定义类名
    className: {
      type: String,
      value: ''
    }
  }
})
