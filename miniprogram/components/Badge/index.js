Component({
  properties: {
    content: { type: String, value: "" },
    dot: { type: Boolean, value: false },
    maxCount: { type: Number, value: 99 },
    position: { type: String, value: "top-right" }
  },
  data: {
    positionClass: ""
  },
  observers: {
    "position": function(position) {
      this.setData({
        positionClass: "badge-position-" + (position || "top-right")
      })
    }
  }
})