/**
 * 虚拟列表组件
 * 用于优化长列表渲染性能
 */
Component({
  options: {
    multipleSlots: true
  },
  
  properties: {
    // 数据列表
    list: {
      type: Array,
      value: [],
      observer: 'onListChange'
    },
    // 每项高度（rpx）
    itemHeight: {
      type: Number,
      value: 120
    },
    // 列表容器高度（rpx）
    containerHeight: {
      type: Number,
      value: 800
    },
    // 缓冲数量
    bufferCount: {
      type: Number,
      value: 5
    },
    // 是否启用虚拟滚动
    enableVirtual: {
      type: Boolean,
      value: true
    }
  },
  
  data: {
    scrollTop: 0,
    renderedList: [],
    totalHeight: 0,
    scrollIntoView: ''
  },
  
  lifetimes: {
    attached() {
      this.init()
    },
    ready() {
      this.updateRenderedItems()
    }
  },
  
  methods: {
    init() {
      this.calcTotalHeight()
      this.updateRenderedItems()
    },
    
    calcTotalHeight() {
      const totalHeight = this.data.list.length * this.data.itemHeight
      this.setData({ totalHeight })
    },
    
    onListChange(newList) {
      if (!newList || newList.length === 0) {
        this.setData({ renderedList: [] })
        return
      }
      this.calcTotalHeight()
      this.updateRenderedItems()
    },
    
    updateRenderedItems() {
      if (!this.data.enableVirtual || this.data.list.length === 0) {
        this.setData({ renderedList: [] })
        return
      }
      
      const { list, itemHeight, containerHeight, bufferCount, scrollTop } = this.data
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferCount)
      const endIndex = Math.min(list.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + bufferCount)
      
      const renderedList = list.slice(startIndex, endIndex).map((item, index) => ({
        index: startIndex + index,
        offset: (startIndex + index) * itemHeight,
        height: itemHeight,
        data: item
      }))
      
      this.setData({ renderedList })
    },
    
    onScroll(e) {
      const scrollTop = e.detail.scrollTop
      this.setData({ scrollTop })
      this.updateRenderedItems()
      
      // 触发事件
      this.triggerEvent('scroll', { scrollTop, index: Math.floor(scrollTop / this.data.itemHeight) })
    },
    
    scrollTo(index) {
      const scrollTop = index * this.data.itemHeight
      this.setData({ scrollTop, scrollIntoView: `item-${index}` })
      this.updateRenderedItems()
      
      // 触发事件
      this.triggerEvent('scrollto', { index, scrollTop })
    },
    
    refresh() {
      this.init()
    }
  }
})