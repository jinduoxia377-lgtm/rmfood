/**
 * RMFOOD Mini Program - Formula Manager
 */

const request = require('./request.js')
const { showLoading, hideLoading } = require('./helpers.js')

class FormulaManager {
  constructor() {
    this.formulas = []
    this.favorites = []
  }

  /**
   * Generate formula by symptoms
   */
  async generateBySymptoms(symptoms, user) {
    showLoading('AI generating formula...')
    try {
      const formula = await request.post('/formulas/generate', {
        symptoms,
        user,
        generate_mode: 'symptom'
      })
      hideLoading()
      return formula
    } catch (error) {
      hideLoading()
      throw error
    }
  }

  /**
   * Generate formula by ingredients
   */
  async generateByIngredients(ingredients, user) {
    showLoading('AI generating formula...')
    try {
      const formula = await request.post('/formulas/generate', {
        ingredients,
        user,
        generate_mode: 'ingredient'
      })
      hideLoading()
      return formula
    } catch (error) {
      hideLoading()
      throw error
    }
  }

  /**
   * Get all formulas
   */
  async getFormulas(params = {}) {
    try {
      const res = await request.get('/formulas', params)
      return res.items || res || []
    } catch (error) {
      console.error('[FormulaManager] Get formulas error:', error)
      return []
    }
  }

  /**
   * Get formula detail
   */
  async getFormula(id) {
    try {
      return await request.get('/formulas/' + id)
    } catch (error) {
      console.error('[FormulaManager] Get formula error:', error)
      return null
    }
  }

  /**
   * Save formula
   */
  async saveFormula(formula) {
    try {
      const res = await request.post('/formulas', formula)
      return res
    } catch (error) {
      console.error('[FormulaManager] Save formula error:', error)
      throw error
    }
  }

  /**
   * Add to favorites (backend API)
   */
  async addToFavorites(formulaId) {
    try {
      await request.post('/search/favorites', {
        item_type: 'formula',
        item_id: formulaId
      })
      // Update local cache
      const favorites = wx.getStorageSync('favorites') || []
      if (!favorites.includes(formulaId)) {
        favorites.push(formulaId)
        wx.setStorageSync('favorites', favorites)
      }
      return true
    } catch (error) {
      console.error('[FormulaManager] Add to favorites error:', error)
      return false
    }
  }

  /**
   * Remove from favorites (backend API)
   */
  async removeFromFavorites(formulaId) {
    try {
      await request.delete(`/search/favorites/formula/${formulaId}`)
      // Update local cache
      let favorites = wx.getStorageSync('favorites') || []
      favorites = favorites.filter(id => id !== formulaId)
      wx.setStorageSync('favorites', favorites)
      return true
    } catch (error) {
      console.error('[FormulaManager] Remove from favorites error:', error)
      return false
    }
  }

  /**
   * Get favorites from backend
   */
  async getFavorites() {
    try {
      const res = await request.get('/search/favorites?type=formula')
      return res.items || []
    } catch (error) {
      console.error('[FormulaManager] Get favorites error:', error)
      return []
    }
  }

  /**
   * Check if formula is favorited
   */
  async isFavorite(formulaId) {
    try {
      const res = await request.get(`/search/favorites/check/formula/${formulaId}`)
      return res.is_favorited || false
    } catch (error) {
      console.error('[FormulaManager] Check favorite error:', error)
      return false
    }
  }

  /**
   * Get favorites from local storage (fallback)
   */
  getFavoritesLocal() {
    return wx.getStorageSync('favorites') || []
  }
}

module.exports = new FormulaManager()