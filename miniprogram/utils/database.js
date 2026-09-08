/**
 * RMFOOD 小程序 - 数据库检索 API
 * 对应前端 DatabasePage.tsx
 */

const request = require('./request.js')

const BASE = '/api/v1/databases'

/**
 * 中药材检索
 */
const searchHerbs = (params = {}) => {
  return request.get(`${BASE}/herbs`, {
    keyword: params.keyword || '',
    category: params.category || '',
    food_homology_only: params.foodHomologyOnly || false,
    page: params.page || 1,
    page_size: params.pageSize || 20
  })
}

/**
 * 中药材详情
 */
const getHerb = (id) => {
  return request.get(`${BASE}/herbs/${id}`)
}

/**
 * 药材分类列表
 */
const getHerbCategories = () => {
  return request.get(`${BASE}/herbs/categories`)
}

/**
 * 药食同源药材列表
 */
const getFoodHomologyHerbs = (params = {}) => {
  return request.get(`${BASE}/herbs/food-homology`, {
    keyword: params.keyword || '',
    page: params.page || 1,
    page_size: params.pageSize || 20
  })
}

/**
 * 药食同源查询
 */
const checkFoodHomology = (herbName) => {
  return request.get(`${BASE}/herbs/food-homology/check`, {
    herb_name: herbName
  })
}

/**
 * 化合物检索
 */
const searchCompounds = (params = {}) => {
  return request.get(`${BASE}/compounds`, {
    keyword: params.keyword || '',
    min_ob: params.minOb || 0,
    max_ob: params.maxOb || 100,
    min_dl: params.minDl || 0,
    page: params.page || 1,
    page_size: params.pageSize || 20
  })
}

/**
 * 化合物统计
 */
const getCompoundStats = () => {
  return request.get(`${BASE}/compounds/stats`)
}

/**
 * 靶点检索
 */
const searchTargets = (params = {}) => {
  return request.get(`${BASE}/targets`, {
    keyword: params.keyword || '',
    page: params.page || 1,
    page_size: params.pageSize || 20
  })
}

/**
 * 疾病检索
 */
const searchDiseases = (params = {}) => {
  return request.get(`${BASE}/diseases`, {
    keyword: params.keyword || '',
    page: params.page || 1,
    page_size: params.pageSize || 20
  })
}

/**
 * 活性肽检索
 */
const searchPeptides = (params = {}) => {
  return request.get(`${BASE}/peptides`, {
    keyword: params.keyword || '',
    activity_type: params.activityType || '',
    page: params.page || 1,
    page_size: params.pageSize || 20
  })
}

/**
 * 活性肽详情
 */
const getPeptide = (id) => {
  return request.get(`${BASE}/peptides/${id}`)
}

/**
 * 活性肽类型列表
 */
const getActivityTypes = () => {
  return request.get(`${BASE}/peptides/activity-types`)
}

/**
 * 知识图谱搜索
 */
const searchKnowledge = (params) => {
  return request.get(`${BASE}/knowledge-graph/search`, {
    keyword: params.keyword || '',
    node_type: params.nodeType || '',
    limit: params.limit || 20
  })
}

/**
 * 节点关系网络
 */
const getNodeRelations = (params) => {
  return request.get(`${BASE}/knowledge-graph/relations`, {
    node_label: params.nodeLabel || '',
    depth: params.depth || 1
  })
}

/**
 * 药材-化合物-靶点路径
 */
const getHerbCompoundTargets = (herbName) => {
  return request.get(`${BASE}/knowledge-graph/herb-path`, {
    herb_name: herbName
  })
}

/**
 * 检索历史
 */
const getSearchHistory = () => {
  const history = wx.getStorageSync('rmfood_search_history') || []
  return Promise.resolve({ history })
}

const saveSearchHistory = (query) => {
  let history = wx.getStorageSync('rmfood_search_history') || []
  // 去重并限制数量
  history = history.filter(item => item !== query)
  history.unshift(query)
  if (history.length > 20) history = history.slice(0, 20)
  wx.setStorageSync('rmfood_search_history', history)
  return Promise.resolve({ history })
}

const clearSearchHistory = () => {
  wx.removeStorageSync('rmfood_search_history')
  return Promise.resolve({ history: [] })
}

module.exports = {
  searchHerbs,
  getHerb,
  getHerbCategories,
  getFoodHomologyHerbs,
  checkFoodHomology,
  searchCompounds,
  getCompoundStats,
  searchTargets,
  searchDiseases,
  searchPeptides,
  getPeptide,
  getActivityTypes,
  searchKnowledge,
  getNodeRelations,
  getHerbCompoundTargets,
  getSearchHistory,
  saveSearchHistory,
  clearSearchHistory
}
