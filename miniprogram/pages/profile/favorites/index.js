// 我的收藏页面
const api = require('../../../utils/api.js')

Page({
  data: {
    favorites: [],
    loading: true,
    emptyText: '暂无收藏的配方'
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '我的收藏' })
  },

  onShow() {
    this.loadFavorites()
  },

  async loadFavorites() {
    this.setData({ loading: true })
    try {
      // 优先从API获取
      const res = await api.formulas.getFavorites()
      const favorites = res.items || []
      
      this.setData({ 
        favorites,
        loading: false,
        emptyText: favorites.length === 0 ? '暂无收藏的配方' : ''
      })
    } catch (e) {
      console.error('加载收藏失败:', e)
      // 降级到本地存储
      const localFavs = wx.getStorageSync('favorites') || []
      const allFormulas = wx.getStorageSync('formulas') || []
      const favorites = allFormulas.filter(f => localFavs.includes(f.id))
      
      this.setData({
        favorites,
        loading: false,
        emptyText: favorites.length === 0 ? '暂无收藏的配方，去配方库发现好配方吧！' : ''
      })
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/packages/formulas/pages/detail/index?id=${id}` })
  },

  cancelFavorite(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '取消收藏',
      content: '确定要取消收藏吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.formulas.unfavorite(id)
          } catch (err) {
            // 忽略错误
          }
          
          // 更新本地状态
          const favorites = wx.getStorageSync('favorites') || []
          const newFavs = favorites.filter(f => f !== id)
          wx.setStorageSync('favorites', newFavs)
          
          this.loadFavorites()
          wx.showToast({ title: '已取消收藏', icon: 'success' })
        }
      }
    })
  },

  onPullDownRefresh() {
    this.loadFavorites().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onShareAppMessage() {
    return {
      title: 'RMFOOD - 我的收藏',
      path: '/pages/profile/favorites/index'
    }
  }
})
