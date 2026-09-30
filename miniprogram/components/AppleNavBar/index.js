// AppleNavBar 组件
Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    showBack: {
      type: Boolean,
      value: false
    },
    backText: {
      type: String,
      value: ''
    },
    showRightAction: {
      type: Boolean,
      value: false
    },
    rightIcon: {
      type: String,
      value: ''
    },
    rightActionLabel: {
      type: String,
      value: ''
    },
    largeTitle: {
      type: Boolean,
      value: false
    },
    className: {
      type: String,
      value: ''
    }
  },
  
  data: {
    statusBarHeight: 20
  },
  
  lifetimes: {
    attached() {
      const sysInfo = wx.getSystemInfoSync();
      this.setData({
        statusBarHeight: sysInfo.statusBarHeight
      });
    }
  },
  
  methods: {
    onBack() {
      wx.navigateBack({ delta: 1 });
    },
    
    onRightAction() {
      this.triggerEvent('rightaction');
    }
  }
});
