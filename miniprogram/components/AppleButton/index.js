// AppleButton 组件
Component({
  properties: {
    type: {
      type: String,
      value: 'primary'  // primary, secondary, link, text
    },
    size: {
      type: String,
      value: 'default'   // default, small, large
    },
    icon: {
      type: String,
      value: ''
    },
    iconColor: {
      type: String,
      value: '#FFFFFF'
    },
    loading: {
      type: Boolean,
      value: false
    },
    disabled: {
      type: Boolean,
      value: false
    },
    block: {
      type: Boolean,
      value: false
    },
    className: {
      type: String,
      value: ''
    }
  },
  
  methods: {
    onTap(e) {
      if (!this.data.disabled && !this.data.loading) {
        this.triggerEvent('tap', e.detail);
      }
    }
  }
});
