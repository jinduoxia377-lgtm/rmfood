// AppleSearchBar 组件
Component({
  properties: {
    value: {
      type: String,
      value: ''
    },
    placeholder: {
      type: String,
      value: '搜索'
    }
  },
  
  methods: {
    onInput(e) {
      this.setData({
        value: e.detail.value
      });
      this.triggerEvent('input', { value: e.detail.value });
    },
    
    onFocus() {
      this.triggerEvent('focus');
    },
    
    onClear() {
      this.setData({ value: '' });
      this.triggerEvent('clear');
      this.triggerEvent('input', { value: '' });
    },
    
    onConfirm(e) {
      this.triggerEvent('confirm', { value: e.detail.value });
    }
  }
});
