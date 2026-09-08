/**
 * RMFOOD Mini Program - Taobao Search
 */

const request = require('./request.js')
const { showLoading, hideLoading } = require('./helpers.js')

class TaobaoSearch {
  /**
   * Search ingredients on Taobao
   */
  async search(keyword, limit = 20) {
    showLoading('Searching...')
    try {
      const result = await request.get('/search/taobao', { keyword, limit })
      hideLoading()
      return result
    } catch (error) {
      hideLoading()
      throw error
    }
  }
}

module.exports = new TaobaoSearch()