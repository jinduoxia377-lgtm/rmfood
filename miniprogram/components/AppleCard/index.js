// AppleCard 组件
Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    subtitle: {
      type: String,
      value: ''
    },
    footerText: {
      type: String,
      value: ''
    },
    featured: {
      type: Boolean,
      value: false
    },
    className: {
      type: String,
      value: ''
    }
  },
  
  methods: {
    onTap() {
      this.triggerEvent('tap');
    }
  }
});
