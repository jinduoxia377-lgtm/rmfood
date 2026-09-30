/**
 * RMFOOD 小程序 - 合规标准服务
 * 对接后端 /api/v1/compliance/* 接口
 */

const request = require('./request.js')

const BASE = '/compliance'

/**
 * 查询药食同源目录限量
 */
const getLimits = async () => {
  try {
    const res = await request.get("" + BASE + "/limits")
    return res.data || res
  } catch (error) {
    console.error('[Compliance] Get limits error:', error)
    return { items: [] }
  }
}

/**
 * 查询禁忌搭配
 */
const getProhibited = async () => {
  try {
    const res = await request.get("" + BASE + "/prohibited")
    return res.data || res
  } catch (error) {
    console.error('[Compliance] Get prohibited error:', error)
    return { combinations: [] }
  }
}

/**
 * GB 2760 食品添加剂检索
 */
const getGB2760 = async (params = {}) => {
  try {
    const res = await request.get("" + BASE + "/gb2760", {
      keyword: params.keyword || '',
      function: params.function || '',
      page: params.page || 1,
      page_size: params.pageSize || 20
    })
    return res.data || res
  } catch (error) {
    console.error('[Compliance] Get GB2760 error:', error)
    return { additives: [] }
  }
}

/**
 * GB 14880 营养强化剂检索
 */
const getGB14880 = async (params = {}) => {
  try {
    const res = await request.get("" + BASE + "/gb14880", {
      keyword: params.keyword || '',
      function: params.function || '',
      page: params.page || 1,
      page_size: params.pageSize || 20
    })
    return res.data || res
  } catch (error) {
    console.error('[Compliance] Get GB14880 error:', error)
    return { enrichers: [] }
  }
}

/**
 * GB 禁用/限制使用物质
 */
const getGBProhibited = async (params = {}) => {
  try {
    const res = await request.get("" + BASE + "/gb-prohibited", {
      keyword: params.keyword || '',
      category: params.category || ''
    })
    return res.data || res
  } catch (error) {
    console.error('[Compliance] Get GB prohibited error:', error)
    return { items: [] }
  }
}

/**
 * 食品安全国家标准目录
 */
const getStandards = async (category = '') => {
  try {
    const res = await request.get("" + BASE + "/standards", {
      category: category
    })
    return res.data || res
  } catch (error) {
    console.error('[Compliance] Get standards error:', error)
    return { standards: [] }
  }
}

/**
 * 药食同源材料目录
 */
const getFoodHomology = async (keyword = '') => {
  try {
    const res = await request.get("" + BASE + "/food-homology", {
      keyword: keyword
    })
    return res.data || res
  } catch (error) {
    console.error('[Compliance] Get food homology error:', error)
    return { materials: [] }
  }
}

/**
 * 实时合规检查
 */
const realtimeCheck = async (ingredients, options = {}) => {
  try {
    const res = await request.post("" + BASE + "/check/realtime", {
      current_ingredients: ingredients.map(item => ({
        name: item.name,
        dosage_mg: parseFloat(item.dosage_mg) || 0
      })),
      new_ingredient: options.newIngredient ? {
        name: options.newIngredient.name,
        dosage_mg: parseFloat(options.newIngredient.dosage_mg) || 0
      } : null,
      population: options.population || 'adults'
    })
    return res.data || res
  } catch (error) {
    console.error('[Compliance] Realtime check error:', error)
    throw error
  }
}

/**
 * 批量合规检查
 */
const bulkCheck = async (ingredients, population = 'adults') => {
  try {
    const res = await request.post("" + BASE + "/check/bulk", {
      ingredients: ingredients.map(item => ({
        name: item.name,
        dosage_mg: parseFloat(item.dosage_mg) || 0
      })),
      population
    })
    return res.data || res
  } catch (error) {
    console.error('[Compliance] Bulk check error:', error)
    throw error
  }
}

/**
 * 自动修复配方
 */
const autoFix = async (ingredients, population = 'adults') => {
  try {
    const res = await request.post("" + BASE + "/fix", {
      ingredients: ingredients.map(item => ({
        name: item.name,
        dosage_mg: parseFloat(item.dosage_mg) || 0
      })),
      population
    })
    return res.data || res
  } catch (error) {
    console.error('[Compliance] Auto fix error:', error)
    throw error
  }
}

/**
 * 获取合规检查历史
 */
const getCheckHistory = () => {
  const history = wx.getStorageSync('rmfood_compliance_history') || []
  return Promise.resolve({ history })
}

/**
 * 保存合规检查记录
 */
const saveCheckRecord = (record) => {
  let history = wx.getStorageSync('rmfood_compliance_history') || []
  history.unshift({
    ...record,
    checked_at: new Date().toISOString()
  })
  if (history.length > 50) history = history.slice(0, 50)
  wx.setStorageSync('rmfood_compliance_history', history)
  return Promise.resolve({ history })
}

// 国标分类
const STANDARD_CATEGORIES = [
  { key: '', label: '全部' },
  { key: '食品添加剂', label: '食品添加剂' },
  { key: '农药残留', label: '农药残留' },
  { key: '污染物限量', label: '污染物限量' },
  { key: '微生物控制', label: '微生物控制' },
  { key: '乳制品', label: '乳制品' },
  { key: '饮料', label: '饮料' },
  { key: '调味品', label: '调味品' },
  { key: '油脂', label: '油脂' },
  { key: '婴幼儿食品', label: '婴幼儿食品' },
  { key: '冷冻食品', label: '冷冻食品' },
  { key: '蛋白质类', label: '蛋白质类' },
  { key: '食品接触材料', label: '食品接触材料' },
  { key: '兽药残留', label: '兽药残留' }
]

// GB 2760 功能类别
const GB2760_FUNCTIONS = [
  { key: '', label: '全部' },
  { key: '着色剂', label: '着色剂' },
  { key: '漂白剂', label: '漂白剂' },
  { key: '防腐剂', label: '防腐剂' },
  { key: '抗氧化剂', label: '抗氧化剂' },
  { key: '甜味剂', label: '甜味剂' },
  { key: '增稠剂', label: '增稠剂' },
  { key: '乳化剂', label: '乳化剂' },
  { key: '酸度调节剂', label: '酸度调节剂' },
  { key: '膨松剂', label: '膨松剂' },
  { key: '香料', label: '香料' },
  { key: '营养强化剂', label: '营养强化剂' }
]

module.exports = {
  getLimits,
  getProhibited,
  getGB2760,
  getGB14880,
  getGBProhibited,
  getStandards,
  getFoodHomology,
  realtimeCheck,
  bulkCheck,
  autoFix,
  getCheckHistory,
  saveCheckRecord,
  STANDARD_CATEGORIES,
  GB2760_FUNCTIONS
}
