Component({
  properties: {
    name: { type: String, value: "info" },
    size: { type: String, value: "md" },
    color: { type: String, value: "" },
    fill: { type: Boolean, value: true }
  },
  data: {
    sizeClass: "icon-md",
    colorClass: "",
    style: ""
  },
  observers: {
    "size": function(size) {
      const sizeMap = { xs: 'icon-xs', sm: 'icon-sm', md: 'icon-md', lg: 'icon-lg', xl: 'icon-xl', xxl: 'icon-xxl' }
      this.setData({ sizeClass: sizeMap[size] || 'icon-md' })
    },
    "color": function(color) {
      if (color) {
        this.setData({ style: 'color: ' + color + ';' })
      } else {
        this.setData({ style: '' })
      }
    }
  },
  methods: {
    onTap(e) {
      this.triggerEvent("tap", e)
    }
  }
})