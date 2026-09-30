// AppleList 组件
Component({
  properties: {
    groupTitle: {
      type: String,
      value: ''
    },
    items: {
      type: Array,
      value: []
    },
    className: {
      type: String,
      value: ''
    }
  },
  
  methods: {
    onItemTap(e) {
      const { index } = e.currentTarget.dataset;
      this.triggerEvent('itemtap', { index });
    },
    
    onToggleTap(e) {
      const { index } = e.currentTarget.dataset;
      this.triggerEvent('toggle', { index });
    }
  }
});
