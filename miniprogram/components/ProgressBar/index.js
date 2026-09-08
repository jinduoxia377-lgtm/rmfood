Component({
  properties: {
    percent: { type: Number, value: 0 },
    type: { type: String, value: "line" },
    size: { type: Number, value: 120 },
    strokeWidth: { type: Number, value: 8 },
    color: { type: String, value: "#07c160" },
    backgroundColor: { type: String, value: "#e9e9e9" },
    showText: { type: Boolean, value: false }
  },
  data: {
    typeClass: ""
  },
  observers: {
    "type": function(type) {
      this.setData({
        typeClass: "progress-bar-" + (type || "line")
      })
    }
  }
})