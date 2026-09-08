/**
 * RMFOOD 小程序 - 存储工具
 * 封装wx storage操作，提供便捷的数据存取方法
 */

/**
 * 获取缓存数据
 */
function getStorage(key, defaultValue = null) {
  try {
    const data = wx.getStorageSync(key)
    return data ? JSON.parse(data) : defaultValue
  } catch (error) {
    console.error('[Storage] 获取数据失败:', key, error)
    return defaultValue
  }
}

/**
 * 保存数据到缓存
 */
function setStorage(key, data, expire = null) {
  try {
    const storageData = {
      value: data,
      time: Date.now(),
      expire: expire
    }
    wx.setStorageSync(key, JSON.stringify(storageData))
    return true
  } catch (error) {
    console.error('[Storage] 保存数据失败:', key, error)
    return false
  }
}

/**
 * 删除缓存
 */
function removeStorage(key) {
  try {
    wx.removeStorageSync(key)
    return true
  } catch (error) {
    console.error('[Storage] 删除数据失败:', key, error)
    return false
  }
}

/**
 * 清除所有缓存
 */
function clearStorage() {
  try {
    wx.clearStorageSync()
    return true
  } catch (error) {
    console.error('[Storage] 清除缓存失败:', error)
    return false
  }
}

/**
 * 检查缓存是否过期
 */
function isExpired(key) {
  try {
    const data = wx.getStorageSync(key)
    if (!data) return true
    
    const parsed = JSON.parse(data)
    if (!parsed.expire) return false
    
    return Date.now() - parsed.time > parsed.expire
  } catch (error) {
    return true
  }
}

module.exports = {
  getStorage,
  setStorage,
  removeStorage,
  clearStorage,
  isExpired
}