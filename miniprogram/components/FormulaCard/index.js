Component({
  properties: {
    formula: {
      type: Object,
      value: { name: "", description: "", healthScore: 0, tags: [], coverImage: "", isFavorite: false }
    },
    showFavorite: { type: Boolean, value: false },
    size: { type: String, value: "normal" }
  },
  data: {
    sizeClass: "formula-card-normal"
  },
  observers: {
    "size": function(size) {
      this.setData({
        sizeClass: "formula-card-" + (size || "normal")
      })
    }
  },
  methods: {
    onTap(e) {
      this.triggerEvent("tap", e)
    },
    onFavorite(e) {
      e.stopPropagation()
      this.triggerEvent("favorite", e)
    },
    onShare(e) {
      e.stopPropagation()
      this.triggerEvent("share", e)
    }
  }
})