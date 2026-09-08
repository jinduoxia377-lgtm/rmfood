Component({
  options: {
    multipleSlots: true
  },

  properties: {
    icon: {
      type: String,
      value: 'empty'
    },
    iconColor: {
      type: String,
      value: '#CCCCCC'
    },
    title: {
      type: String,
      value: '暂无数据'
    },
    desc: {
      type: String,
      value: '还没有任何记录'
    },
    btnText: {
      type: String,
      value: ''
    },
    className: {
      type: String,
      value: ''
    }
  },

  methods: {
    handleTap() {
      this.triggerEvent('tap', {})
    },
    handleBtnTap() {
      this.triggerEvent('btntap', {})
    }
  }
})
