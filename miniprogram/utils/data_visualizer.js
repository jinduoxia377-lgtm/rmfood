/**
 * RMFOOD 数据可视化组件
 * 提供图表和数据展示能力
 */

class DataVisualizer {
  constructor(canvasId) {
    this.canvasId = canvasId
    this.ctx = null
    this.chartType = 'bar'
    this.data = []
    this.options = {}
  }

  /**
   * 初始化画布
   */
  init() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery()
      query.select(`#${this.canvasId}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) {
            reject(new Error('Canvas not found'))
            return
          }
          
          this.ctx = res[0].node.getContext('2d')
          this.width = res[0].width
          this.height = res[0].height
          
          // 设置 canvas 实际像素
          const dpr = wx.getSystemInfoSync().pixelRatio
          res[0].node.width = this.width * dpr
          res[0].node.height = this.height * dpr
          this.ctx.scale(dpr, dpr)
          
          resolve()
        })
    })
  }

  /**
   * 绘制柱状图
   */
  drawBarChart(data, options = {}) {
    this.data = data
    this.options = {
      barWidth: 40,
      gap: 20,
      color: '#2D5A3D',
      ...options
    }
    
    this.ctx.clearRect(0, 0, this.width, this.height)
    
    const maxValue = Math.max(...data.map(d => d.value))
    const chartHeight = this.height * 0.7
    const startX = 50
    const totalBars = data.length
    const totalWidth = totalBars * (this.options.barWidth + this.options.gap)
    const xOffset = (this.width - totalWidth) / 2

    data.forEach((item, index) => {
      const barHeight = (item.value / maxValue) * chartHeight
      const x = xOffset + index * (this.options.barWidth + this.options.gap)
      const y = this.height - barHeight - 30

      // 绘制柱子
      this.ctx.fillStyle = this.options.color
      this.roundRect(x, y, this.options.barWidth, barHeight, 4)
      this.ctx.fill()

      // 绘制数值
      this.ctx.fillStyle = '#333'
      this.ctx.font = '12px sans-serif'
      this.ctx.textAlign = 'center'
      this.ctx.fillText(item.value, x + this.options.barWidth / 2, y - 5)

      // 绘制标签
      this.ctx.fillStyle = '#666'
      this.ctx.font = '10px sans-serif'
      this.ctx.fillText(item.label, x + this.options.barWidth / 2, this.height - 10)
    })
  }

  /**
   * 绘制饼图
   */
  drawPieChart(data, options = {}) {
    this.data = data
    this.options = {
      colors: ['#2D5A3D', '#4a7c5c', '#7dbfa3', '#b3d9c3', '#d9ece1'],
      ...options
    }
    
    this.ctx.clearRect(0, 0, this.width, this.height)
    
    const total = data.reduce((sum, item) => sum + item.value, 0)
    const centerX = this.width / 2
    const centerY = this.height / 2
    const radius = Math.min(this.width, this.height) * 0.35
    
    let startAngle = -Math.PI / 2
    
    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI
      
      // 绘制扇形
      this.ctx.beginPath()
      this.ctx.moveTo(centerX, centerY)
      this.ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle)
      this.ctx.closePath()
      
      this.ctx.fillStyle = this.options.colors[index % this.options.colors.length]
      this.ctx.fill()
      
      startAngle += sliceAngle
    })
    
    // 绘制中心圆（饼图中间空白）
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2)
    this.ctx.fillStyle = '#ffffff'
    this.ctx.fill()
    
    // 绘制图例
    this.drawLegend(data, options.legendPosition || 'bottom')
  }

  /**
   * 绘制折线图
   */
  drawLineChart(data, options = {}) {
    this.data = data
    this.options = {
      strokeWidth: 2,
      pointRadius: 4,
      color: '#2D5A3D',
      gridColor: '#e5e7eb',
      ...options
    }
    
    this.ctx.clearRect(0, 0, this.width, this.height)
    
    const maxValue = Math.max(...data.map(d => d.value))
    const minValue = Math.min(...data.map(d => d.value))
    const range = maxValue - minValue || 1
    const chartHeight = this.height * 0.6
    const chartWidth = this.width - 60
    const startY = 30
    
    // 绘制网格线
    this.ctx.strokeStyle = this.options.gridColor
    this.ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = startY + (chartHeight / 4) * i
      this.ctx.beginPath()
      this.ctx.moveTo(40, y)
      this.ctx.lineTo(this.width - 10, y)
      this.ctx.stroke()
    }
    
    // 绘制折线
    this.ctx.strokeStyle = this.options.color
    this.ctx.lineWidth = this.options.strokeWidth
    this.ctx.beginPath()
    
    data.forEach((item, index) => {
      const x = 50 + (chartWidth / (data.length - 1 || 1)) * index
      const y = startY + chartHeight - (item.value / range) * chartHeight
      
      if (index === 0) {
        this.ctx.moveTo(x, y)
      } else {
        this.ctx.lineTo(x, y)
      }
      
      // 绘制数据点
      this.ctx.fillStyle = this.options.color
      this.ctx.beginPath()
      this.ctx.arc(x, y, this.options.pointRadius, 0, Math.PI * 2)
      this.ctx.fill()
      
      // 存储点坐标用于后续使用
      item._x = x
      item._y = y
    })
    
    this.ctx.stroke()
    
    // 绘制X轴标签
    this.ctx.fillStyle = '#666'
    this.ctx.font = '10px sans-serif'
    this.ctx.textAlign = 'center'
    
    data.forEach((item, index) => {
      if (index % Math.ceil(data.length / 5) === 0) {
        const x = 50 + (chartWidth / (data.length - 1 || 1)) * index
        this.ctx.fillText(item.label, x, this.height - 10)
      }
    })
  }

  /**
   * 绘制进度条
   */
  drawProgress(progress, options = {}) {
    const {
      width = this.width,
      height = 20,
      color = '#2D5A3D',
      bgColor = '#e5e7eb',
      radius = 10
    } = options
    
    const x = (this.width - width) / 2
    const y = (this.height - height) / 2
    
    // 背景
    this.ctx.fillStyle = bgColor
    this.roundRect(x, y, width, height, radius)
    this.ctx.fill()
    
    // 进度
    const progressWidth = width * Math.min(progress, 1)
    this.ctx.fillStyle = color
    this.roundRect(x, y, progressWidth, height, radius)
    this.ctx.fill()
    
    // 百分比文字
    this.ctx.fillStyle = '#333'
    this.ctx.font = 'bold 12px sans-serif'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(`${Math.round(progress * 100)}%`, x + width / 2, y + height / 2)
  }

  /**
   * 绘制图例
   */
  drawLegend(data, position = 'bottom') {
    const legendY = position === 'bottom' ? this.height - 20 : 10
    const legendX = (this.width - data.length * 80) / 2
    
    this.ctx.fillStyle = '#333'
    this.ctx.font = '10px sans-serif'
    
    data.forEach((item, index) => {
      const x = legendX + index * 80
      const color = this.options.colors[index % this.options.colors.length]
      
      // 颜色块
      this.ctx.fillStyle = color
      this.ctx.fillRect(x, legendY, 12, 12)
      
      // 标签
      this.ctx.fillStyle = '#333'
      this.ctx.textAlign = 'left'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillText(item.label, x + 16, legendY + 6)
    })
  }

  /**
   * 绘制圆角矩形
   */
  roundRect(x, y, width, height, radius) {
    this.ctx.beginPath()
    this.ctx.moveTo(x + radius, y)
    this.ctx.lineTo(x + width - radius, y)
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    this.ctx.lineTo(x + width, y + height - radius)
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    this.ctx.lineTo(x + radius, y + height)
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    this.ctx.lineTo(x, y + radius)
    this.ctx.quadraticCurveTo(x, y, x + radius, y)
    this.ctx.closePath()
  }

  /**
   * 清除画布
   */
  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  /**
   * 销毁
   */
  destroy() {
    this.clear()
    this.ctx = null
  }
}

// 单例模式
let instance = null

export function getDataVisualizer(canvasId) {
  if (!instance) {
    instance = new DataVisualizer(canvasId)
  }
  return instance
}

export default DataVisualizer
