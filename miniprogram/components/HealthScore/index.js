Component({
  properties: {
    score: { type: Number, value: 0 },
    // 支持 sm/md/lg 和 small/medium/large
    size: { type: String, value: "md" },
    showText: { type: Boolean, value: true }
  },
  data: {
    scoreLetter: "B",
    scoreText: "良好",
    scoreColor: "#2D5A3D",
    circleSize: 120,
    sizeClass: "health-score-md"
  },
  observers: {
    "score": function(score) {
      const level = this.getScoreLevel(score)
      this.setData({
        scoreLetter: level.letter,
        scoreText: level.text,
        scoreColor: level.color
      })
    },
    "size": function(size) {
      const sizeMap = {
        'xs': 'health-score-xs',
        'sm': 'health-score-sm',
        'small': 'health-score-sm',
        'md': 'health-score-md',
        'medium': 'health-score-md',
        'lg': 'health-score-lg',
        'large': 'health-score-lg'
      }
      this.setData({ sizeClass: sizeMap[size] || 'health-score-md' })
    }
  },
  methods: {
    getScoreLevel(score) {
      if (score >= 90) return { letter: "A", text: "优秀", color: "#07c160" }
      if (score >= 80) return { letter: "B", text: "良好", color: "#2D5A3D" }
      if (score >= 60) return { letter: "C", text: "一般", color: "#ff976a" }
      return { letter: "D", text: "较差", color: "#ee0a24" }
    }
  }
})