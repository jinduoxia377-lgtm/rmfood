// packages/ingredient/pages/analysis/index.js
const api = require('../../../../utils/api.js')

Page({
  data: {
    keyword: '',
    result: null,
    loading: false
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value })
  },

  async analyze() {
    const keyword = this.data.keyword.trim()
    if (!keyword) {
      wx.showToast({ title: '请输入食材名称', icon: 'none' })
      return
    }

    this.setData({ loading: true, result: null })

    try {
      const res = await api.ingredients.search(keyword)
      // API返回 {items: [...], total, page, page_size}
      const items = res.items || []
      if (items.length > 0) {
        // 返回第一条匹配的药材数据
        this.setData({ result: items[0] })
      } else {
        wx.showToast({ title: '未找到该食材', icon: 'none' })
      }
    } catch (e) {
      console.error('搜索失败:', e)
      wx.showToast({ title: '查询失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onShareAppMessage() {
    return {
      title: 'RMFOOD - 食材分析',
      path: '/packages/ingredient/pages/analysis/index'
    }
  }
})
