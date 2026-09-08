/**
 * 营养成分表组件
 * 用于展示GB 28050格式的营养成分表
 */
Component({
  properties: {
    // 营养成分数据
    nutritionData: {
      type: Array,
      value: []
    },
    // 服务单位
    servingSize: {
      type: String,
      value: '每100g'
    },
    // 是否显示NRV%
    showNRV: {
      type: Boolean,
      value: true
    }
  },

  data: {},

  lifetimes: {
    attached() {
      // 初始化
    }
  }
})
