/**
 * RMFOOD Mini Program - Helper Functions
 */

/**
 * Format date
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second)
}

/**
 * Format relative time
 */
function formatRelativeTime(date) {
  const now = Date.now()
  const target = new Date(date).getTime()
  const diff = now - target

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return "" + minutes + "minutes ago"
  if (hours < 24) return "" + hours + "hours ago"
  return "" + days + "days ago"
}

/**
 * Show loading
 */
function showLoading(title = 'Loading...') {
  wx.showLoading({ title, mask: true })
}

/**
 * Hide loading
 */
function hideLoading() {
  wx.hideLoading()
}

/**
 * Show success
 */
function showSuccess(title = 'Success') {
  wx.showToast({ title, icon: 'success' })
}

/**
 * Show error
 */
function showError(title = 'Error') {
  wx.showToast({ title, icon: 'error' })
}

/**
 * Show modal
 */
function showModal(options) {
  return new Promise((resolve) => {
    wx.showModal({
      title: options.title || 'Tip',
      content: options.content || '',
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Cancel',
      success: (res) => {
        resolve(res.confirm)
      }
    })
  })
}

module.exports = {
  formatDate,
  formatRelativeTime,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showModal
}