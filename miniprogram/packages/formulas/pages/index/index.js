// packages/formulas/pages/index/index.js
const api = require('../../../../utils/api.js')
Page({
  data: {
    formulas: [],
    search: ''
  },
  onLoad() {
    this.loadFormulas()
  },
  async loadFormulas() {
    try {
      const res = await api.formulas.getFormulas({ page: 1, pageSize: 20 })
      this.setData({ formulas: res.items || [] })
    } catch (e) {
      console.error('鍔犺浇閰嶆柟澶辫触:', e)
    }
  },
  onSearch(e) {
    this.setData({ search: e.detail.value })
  },
  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: `/packages/formulas/pages/detail/index?id=${id}` })
    }
  }
})
