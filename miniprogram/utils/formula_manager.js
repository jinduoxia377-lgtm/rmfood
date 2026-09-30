/**
 * RMFOOD 小程序 - 配方管理服务
 * 对接后端 /api/v1/formulas/* 接口
 */

const request = require('./request.js')
const { showLoading, hideLoading } = require('./helpers.js')

class FormulaManager {
  constructor() {
    this.formulas = []
    this.favorites = []
  }

  /**
   * 获取配方列表
   * GET /api/v1/formulas
   */
  async getFormulas(params = {}) {
    try {
      const res = await request.get('/formulas', {
        page: params.page || 1,
        page_size: params.pageSize || 20,
        status: params.status || 'approved',
        search: params.search || '',
        sort_by: params.sortBy || 'created_at',
        sort_dir: params.sortDir || 'desc'
      })
      
      // 转换响应格式
      const items = res.items || res.data?.items || []
      return {
        items: items.map(item => this.transformFormula(item)),
        total: res.total || res.data?.total || items.length,
        page: res.page || params.page || 1,
        pageSize: res.page_size || params.pageSize || 20
      }
    } catch (error) {
      console.error('[FormulaManager] Get formulas error:', error)
      return { items: [], total: 0, page: 1, pageSize: 20 }
    }
  }

  /**
   * 获取配方详情
   * GET /api/v1/formulas/{id}
   */
  async getFormula(id) {
    try {
      const res = await request.get("/formulas/" + id + "")
      return this.transformFormula(res.data || res)
    } catch (error) {
      console.error('[FormulaManager] Get formula error:', error)
      return null
    }
  }

  /**
   * 创建配方
   * POST /api/v1/formulas
   */
  async createFormula(formula) {
    try {
      const res = await request.post('/formulas', formula)
      return res.data || res
    } catch (error) {
      console.error('[FormulaManager] Create formula error:', error)
      throw error
    }
  }

  /**
   * 更新配方
   * PUT /api/v1/formulas/{id}
   */
  async updateFormula(id, formula) {
    try {
      const res = await request.put("/formulas/" + id + "", formula)
      return res.data || res
    } catch (error) {
      console.error('[FormulaManager] Update formula error:', error)
      throw error
    }
  }

  /**
   * 删除配方
   * DELETE /api/v1/formulas/{id}
   */
  async deleteFormula(id) {
    try {
      await request.delete("/formulas/" + id + "")
      return true
    } catch (error) {
      console.error('[FormulaManager] Delete formula error:', error)
      return false
    }
  }

  /**
   * 收藏配方
   * POST /api/v1/formulas/{id}/favorite
   */
  async favoriteFormula(id) {
    try {
      const res = await request.post("/formulas/" + id + "/favorite")
      this.updateFavoriteStatus(id, true)
      return res
    } catch (error) {
      console.error('[FormulaManager] Favorite formula error:', error)
      return false
    }
  }

  /**
   * 取消收藏
   * DELETE /api/v1/formulas/{id}/favorite
   */
  async unfavoriteFormula(id) {
    try {
      await request.delete("/formulas/" + id + "/favorite")
      this.updateFavoriteStatus(id, false)
      return true
    } catch (error) {
      console.error('[FormulaManager] Unfavorite formula error:', error)
      return false
    }
  }

  /**
   * 检查是否已收藏
   * GET /api/v1/formulas/{id}/favorite/check
   */
  async isFavorite(id) {
    try {
      const res = await request.get("/formulas/" + id + "/favorite/check")
      return res.is_favorited || false
    } catch (error) {
      console.error('[FormulaManager] Check favorite error:', error)
      return false
    }
  }

  /**
   * 获取我的配方列表
   * GET /api/v1/formulas/my
   */
  async getMyFormulas(params = {}) {
    try {
      const res = await request.get('/formulas/my', {
        page: params.page || 1,
        page_size: params.pageSize || 20
      })
      return res.items || res.data?.items || []
    } catch (error) {
      console.error('[FormulaManager] Get my formulas error:', error)
      return []
    }
  }

  /**
   * 获取收藏的配方
   * GET /api/v1/formulas/favorites
   */
  async getFavorites(params = {}) {
    try {
      const res = await request.get('/formulas/favorites', {
        page: params.page || 1,
        page_size: params.pageSize || 20
      })
      return res.items || res.data?.items || []
    } catch (error) {
      console.error('[FormulaManager] Get favorites error:', error)
      return []
    }
  }

  /**
   * AI推荐配方
   * POST /api/v1/formulas/recommendations
   */
  async getRecommendations(params) {
    try {
      const res = await request.post('/formulas/recommendations', {
        target_effects: params.targetEffects,
        preferred_categories: params.preferredCategories,
        max_results: params.maxResults || 10
      })
      return res.recommendations || res.data?.recommendations || []
    } catch (error) {
      console.error('[FormulaManager] Get recommendations error:', error)
      return []
    }
  }

  /**
   * 按症状生成配方
   */
  async generateBySymptoms(symptoms, user) {
    showLoading('AI生成配方中...')
    try {
      const res = await request.post('/formulas/generate', {
        symptoms: symptoms,
        user_profile: user,
        generate_mode: 'symptom'
      }, { timeout: 60000 })
      hideLoading()
      return res.data || res
    } catch (error) {
      hideLoading()
      console.error('[FormulaManager] Generate by symptoms error:', error)
      throw error
    }
  }

  /**
   * 配方统计
   * GET /api/v1/formulas/statistics
   */
  async getStatistics() {
    try {
      const res = await request.get('/formulas/statistics')
      return res.data || res
    } catch (error) {
      console.error('[FormulaManager] Get statistics error:', error)
      return { total: 0, by_status: {} }
    }
  }

  /**
   * 转换配方数据格式
   */
  transformFormula(item) {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      status: item.status,
      version: item.version,
      creator_id: item.creator_id,
      creator_name: item.creator_name,
      created_at: item.created_at,
      updated_at: item.updated_at,
      // 营养成分
      composition: item.composition,
      dosage: item.dosage,
      processing_method: item.processing_method,
      storage_conditions: item.storage_conditions,
      shelf_life: item.shelf_life,
      // 功效
      target_effects: item.target_effects,
      health_score: item.health_score || 85,
      // 成分列表
      ingredients: (item.ingredients || []).map(ing => ({
        id: ing.id,
        name: ing.name,
        name_cn: ing.name_cn,
        category: ing.category,
        source: ing.source,
        is_food_homology: ing.is_food_homology,
        properties: ing.properties
      })),
      // 活性肽
      peptides: (item.peptides || []).map(pep => ({
        id: pep.id,
        sequence: pep.sequence,
        source_protein: pep.source_protein,
        activity_type: pep.activity_type,
        activity_value: pep.activity_value
      })),
      // AI分析
      ai_recommendations: item.ai_recommendations,
      synergy_analysis: item.synergy_analysis,
      safety_check: item.safety_check
    }
  }

  /**
   * 更新收藏状态
   */
  updateFavoriteStatus(id, isFavorite) {
    try {
      let favorites = wx.getStorageSync('favorites') || []
      if (isFavorite && !favorites.includes(id)) {
        favorites.push(id)
      } else if (!isFavorite) {
        favorites = favorites.filter(fid => fid !== id)
      }
      wx.setStorageSync('favorites', favorites)
      this.favorites = favorites
    } catch (error) {
      console.error('[FormulaManager] Update favorite status error:', error)
    }
  }

  /**
   * 获取本地收藏
   */
  getFavoritesLocal() {
    return wx.getStorageSync('favorites') || []
  }
}

module.exports = new FormulaManager()
