/**
 * RMFOOD 小程序 - 报告导出服务
 * 支持PDF导出和图片分享功能
 */

const request = require('./request.js')
const { showLoading, hideLoading } = require('./helpers.js')

class ReportExportService {
  constructor() {
    this.exportHistory = []
  }

  /**
   * 导出配料分析报告为图片
   * @param {Object} analysis - 分析结果数据
   * @returns {Promise<string>} 图片路径
   */
  async exportAsImage(analysis) {
    showLoading('生成报告中...')
    
    try {
      // 使用后端API生成报告图片
      const result = await request.post('/ingredients/report/export', {
        type: 'image',
        data: analysis
      }, { timeout: 30000 })
      
      if (result && result.url) {
        // 保存到相册
        await this.saveToAlbum(result.url)
        hideLoading()
        return result.url
      }
      
      throw new Error('报告生成失败')
      
    } catch (error) {
      console.error('[ReportExport] 图片导出失败:', error)
      hideLoading()
      
      // 降级方案：使用前端绘制
      return await this._fallbackExportAsImage(analysis)
    }
  }

  /**
   * 导出配料分析报告为PDF
   * @param {Object} analysis - 分析结果数据
   * @returns {Promise<string>} PDF路径
   */
  async exportAsPDF(analysis) {
    showLoading('生成PDF报告中...')
    
    try {
      const result = await request.post('/ingredients/report/export', {
        type: 'pdf',
        data: analysis
      }, { timeout: 60000 })
      
      if (result && result.url) {
        hideLoading()
        return result.url
      }
      
      throw new Error('PDF生成失败')
      
    } catch (error) {
      console.error('[ReportExport] PDF导出失败:', error)
      hideLoading()
      wx.showToast({ title: 'PDF导出暂不可用', icon: 'none' })
      return null
    }
  }

  /**
   * 保存图片到相册
   * @param {string} tempFilePath - 临时图片路径
   */
  async saveToAlbum(tempFilePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath: tempFilePath,
        success: () => {
          wx.showToast({ title: '已保存到相册', icon: 'success' })
          resolve(tempFilePath)
        },
        fail: (err) => {
          if (err.errMsg.includes('auth deny')) {
            wx.showModal({
              title: '提示',
              content: '需要您授权保存相册权限',
              success: (res) => {
                if (res.confirm) {
                  wx.openSetting()
                }
              }
            })
          }
          reject(err)
        }
      })
    })
  }

  /**
   * 分享报告
   * @param {Object} analysis - 分析结果数据
   */
  async shareReport(analysis) {
    try {
      // 先生成图片
      const imagePath = await this.exportAsImage(analysis)
      
      if (imagePath) {
        // 调用分享
        wx.showShareMenu({
          withShareTicket: true,
          menus: ['shareAppMessage', 'shareTimeline']
        })
        
        return {
          success: true,
          imagePath: imagePath
        }
      }
      
      return { success: false }
      
    } catch (error) {
      console.error('[ReportExport] 分享失败:', error)
      return { success: false, error }
    }
  }

  /**
   * 降级方案：前端绘制报告图片
   * @param {Object} analysis - 分析结果数据
   * @returns {Promise<string>} 图片路径
   */
  async _fallbackExportAsImage(analysis) {
    return new Promise((resolve, reject) => {
      // 获取画布
      const query = wx.createSelectorQuery()
      query.select('#reportCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            // 使用Canvas API
            this._drawReportToCanvas(analysis)
              .then(canvas => {
                wx.canvasToTempFilePath({
                  canvas: canvas,
                  success: (res) => {
                    resolve(res.tempFilePath)
                  },
                  fail: reject
                })
              })
              .catch(reject)
            return
          }
          
          // 使用Canvas节点
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          
          // 绘制报告
          this._drawReportContent(ctx, analysis, canvas.width, canvas.height)
            .then(() => {
              wx.canvasToTempFilePath({
                canvas: canvas,
                success: (res) => {
                  resolve(res.tempFilePath)
                },
                fail: reject
              })
            })
            .catch(reject)
        })
    })
  }

  /**
   * 绘制报告内容到Canvas
   */
  async _drawReportToCanvas(analysis) {
    return new Promise((resolve, reject) => {
      const canvas = wx.createCanvas()
      const ctx = canvas.getContext('2d')
      
      // 设置画布大小
      canvas.width = 750
      canvas.height = 1200
      
      // 绘制背景
      ctx.fillStyle = '#F5F7FA'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // 绘制报告标题
      ctx.fillStyle = '#2D5A3D'
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('RMFOOD 配料分析报告', canvas.width / 2, 60)
      
      // 绘制分析时间
      ctx.font = '24px sans-serif'
      ctx.fillStyle = '#666666'
      const now = new Date()
      ctx.fillText(now.toLocaleString('zh-CN'), canvas.width / 2, 100)
      
      // 绘制Nutri-Score
      if (analysis.nutriScore) {
        this._drawNutriScore(ctx, analysis.nutriScore, 150)
      }
      
      // 绘制NOVA分组
      if (analysis.nova) {
        this._drawNOVAGroup(ctx, analysis.nova, 350)
      }
      
      // 绘制成分列表
      if (analysis.ingredients && analysis.ingredients.length > 0) {
        this._drawIngredientsList(ctx, analysis.ingredients, 500)
      }
      
      resolve(canvas)
    })
  }

  /**
   * 绘制Nutri-Score
   */
  _drawNutriScore(ctx, score, y) {
    const x = 50
    const width = 650
    const height = 80
    
    // 背景
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(x, y, width, height)
    ctx.strokeStyle = '#E5E7EB'
    ctx.strokeRect(x, y, width, height)
    
    // 标题
    ctx.fillStyle = '#1A1A1A'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Nutri-Score 健康评分', x + 20, y + 35)
    
    // 分数
    ctx.textAlign = 'right'
    ctx.font = 'bold 36px sans-serif'
    const scoreColor = this._getScoreColor(score)
    ctx.fillStyle = scoreColor
    ctx.fillText(`${score}分`, x + width - 20, y + 45)
  }

  /**
   * 绘制NOVA分组
   */
  _drawNOVAGroup(ctx, nova, y) {
    const x = 50
    const width = 650
    const height = 80
    
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(x, y, width, height)
    ctx.strokeStyle = '#E5E7EB'
    ctx.strokeRect(x, y, width, height)
    
    ctx.fillStyle = '#1A1A1A'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('NOVA 食品分组', x + 20, y + 35)
    
    ctx.textAlign = 'right'
    ctx.font = 'bold 36px sans-serif'
    const novaColor = this._getNOVAColor(nova)
    ctx.fillStyle = novaColor
    ctx.fillText(`分组 ${nova.group}`, x + width - 20, y + 45)
  }

  /**
   * 绘制成分列表
   */
  _drawIngredientsList(ctx, ingredients, y) {
    const x = 50
    const width = 650
    let currentY = y
    
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(x, currentY, width, 100)
    ctx.strokeStyle = '#E5E7EB'
    ctx.strokeRect(x, currentY, width, 100)
    
    ctx.fillStyle = '#1A1A1A'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`成分列表 (${ingredients.length}种)`, x + 20, currentY + 40)
    
    currentY += 120
    for (let i = 0; i < Math.min(ingredients.length, 5); i++) {
      const ing = ingredients[i]
      ctx.fillStyle = '#333333'
      ctx.font = '24px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`${i + 1}. ${ing.name}`, x + 20, currentY + 30)
      currentY += 50
    }
    
    if (ingredients.length > 5) {
      ctx.fillStyle = '#999999'
      ctx.font = '20px sans-serif'
      ctx.fillText(`... 还有 ${ingredients.length - 5} 种成分`, x + 20, currentY + 20)
    }
  }

  /**
   * 获取评分颜色
   */
  _getScoreColor(score) {
    if (score >= 85) return '#07c160'
    if (score >= 70) return '#2D5A3D'
    if (score >= 60) return '#FFC107'
    if (score >= 50) return '#FF9800'
    return '#F44336'
  }

  /**
   * 获取NOVA分组颜色
   */
  _getNOVAColor(nova) {
    const colors = {
      1: '#07c160',
      2: '#2D5A3D',
      3: '#FFC107',
      4: '#F44336'
    }
    return colors[nova.group] || '#666666'
  }

  /**
   * 保存导出历史
   */
  saveExportRecord(record) {
    try {
      const history = wx.getStorageSync('export_history') || []
      history.unshift(record)
      if (history.length > 20) {
        history.splice(20)
      }
      wx.setStorageSync('export_history', history)
      this.exportHistory = history
    } catch (error) {
      console.error('[ReportExport] 保存历史失败:', error)
    }
  }

  /**
   * 获取导出历史
   */
  getExportHistory() {
    try {
      const history = wx.getStorageSync('export_history') || []
      this.exportHistory = history
      return history
    } catch (error) {
      return []
    }
  }
}

module.exports = new ReportExportService()
