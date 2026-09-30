/**
 * 虚拟滚动列表组件
 * 只渲染可见区域的列表项，大幅提升长列表性能
 */

Component({
  options: {
    multipleSlots: true
  },
  
  properties: {
    // 数据列表
    list: {
      type: Array,
      value: []
    },
    // 每项高度（rpx）
    itemHeight: {
      type: Number,
      value: 120
    },
    // 容器高度（rpx）
    containerHeight: {
      type: Number,
      value: 800
    },
    // 额外渲染数量
    bufferCount: {
      type: Number,
      value: 5
    },
    // 是否显示loading
    showLoading: {
      type: Boolean,
      value: false
    },
    // 是否显示空状态
    showEmpty: {
      type: Boolean,
      value: false
    }
  },
  
  data: {
    // 可见范围的起始和结束索引
    visibleStart: 0,
    visibleEnd: 0,
    // 总高度
    totalHeight: 0,
    // 可见项
    visibleItems: []
  },
  
  lifetimes: {
    attached() {
      this.calculateVisibleRange();
    }
  },
  
  observers: {
    'list, itemHeight, containerHeight': function() {
      this.calculateVisibleRange();
    }
  },
  
  methods: {
    // 计算可见范围
    calculateVisibleRange() {
      const { list, itemHeight, containerHeight, bufferCount } = this.data;
      const totalHeight = list.length * itemHeight;
      const visibleCount = Math.ceil(containerHeight / itemHeight) + bufferCount * 2;
      const start = 0;
      const end = Math.min(start + visibleCount, list.length);
      
      this.setData({
        totalHeight,
        visibleStart: start,
        visibleEnd: end,
        visibleItems: list.slice(start, end)
      });
    },
    
    // 滚动处理
    onScroll(e) {
      const { list, itemHeight, containerHeight, bufferCount } = this.data;
      const scrollTop = e.detail.scrollTop;
      
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferCount);
      const endIndex = Math.min(list.length, startIndex + Math.ceil(containerHeight / itemHeight) + bufferCount * 2);
      
      const visibleItems = list.slice(startIndex, endIndex);
      
      this.setData({
        visibleStart: startIndex,
        visibleEnd: endIndex,
        visibleItems: visibleItems
      });
      
      // 触发加载更多
      if (endIndex >= list.length - bufferCount && this.data.onReachEnd) {
        this.triggerEvent('reachend');
      }
    },
    
    // 列表项点击
    onItemTap(e) {
      const { index } = e.currentTarget.dataset;
      const item = this.data.list[index + this.data.visibleStart];
      this.triggerEvent('itemtap', { index, item });
    }
  }
});
