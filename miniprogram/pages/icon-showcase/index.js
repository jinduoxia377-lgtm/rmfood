// 图标展示页面 - 用于测试和验证图标系统
const icons = require('../../utils/icons.js')
const IconHelper = require('../../utils/icon-helper.js')

Page({
  data: {
    iconNames: Object.keys(icons.IconMap),
    searchKey: '',
    filteredIcons: [],
    categories: [],
    sizes: [
      { size: 'xs', label: 'xs (16rpx)' },
      { size: 'sm', label: 'sm (24rpx)' },
      { size: 'md', label: 'md (32rpx)' },
      { size: 'lg', label: 'lg (48rpx)' },
      { size: 'xl', label: 'xl (64rpx)' }
    ],
    iconName: 'ingredient',
    // 图标分类
    categoryMap: {
      '导航': ['back', 'arrow-left', 'arrow-right', 'arrow-up', 'arrow-down', 'home', 'menu', 'hamburger', 'expand-less', 'expand-more'],
      '功能': ['search', 'filter', 'sort', 'refresh', 'delete', 'edit', 'save', 'share', 'download', 'upload', 'camera', 'scan'],
      '业务': ['ingredient', 'ai', 'formula', 'history', 'database', 'compliance', 'herb', 'nutrition', 'health', 'favorite', 'star', 'calendar', 'clock'],
      '用户': ['user', 'person', 'profile', 'settings', 'shield', 'login', 'logout'],
      '状态': ['success', 'warning', 'error', 'info', 'check', 'close', 'plus', 'minus', 'loading', 'empty']
    }
  },

  onLoad() {
    this.buildCategories()
    this.setData({ filteredIcons: this.data.iconNames })
  },

  buildCategories() {
    const categories = []
    for (const [catName, icons] of Object.entries(this.data.categoryMap)) {
      categories.push({
        name: catName,
        icons: icons.map(name => ({ name }))
      })
    }
    this.setData({ categories })
  },

  onSearch(e) {
    const key = e.detail.value.toLowerCase()
    this.setData({ searchKey: key })
    
    if (!key) {
      this.setData({ filteredIcons: this.data.iconNames })
      return
    }
    
    const filtered = this.data.iconNames.filter(name => 
      name.toLowerCase().includes(key)
    )
    this.setData({ filteredIcons: filtered })
  },

  onIconTap(e) {
    const icon = e.currentTarget.dataset.icon
    wx.setClipboardData({
      data: icon,
      success: () => {
        wx.showToast({ title: '已复制: ' + icon, icon: 'success' })
      }
    })
  }
})
