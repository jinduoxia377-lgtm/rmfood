/**
 * RMFOOD 小程序 - API服务层
 * 统一封装所有业务接口
 */

const request = require('./request.js')

// 导入业务模块
const auth = require('./auth.js')
const aiChat = require('./ai_chat.js')
const ingredientAnalysis = require('./ingredient_analysis.js')
const formulaManager = require('./formula_manager.js')
const taobaoSearch = require('./taobao_search.js')
const database = require('./database.js')
const compliance = require('./compliance.js')

/**
 * 认证服务
 */
const AuthService = {
  login: () => auth.login(),
  logout: () => auth.logout(),
  isLoggedIn: () => auth.isLoggedIn(),
  getUserInfo: () => auth.getUserInfo(),
  ensureLogin: () => auth.ensureLogin(),
  refreshToken: () => auth.refreshToken()
}

/**
 * AI对话服务
 */
const AIService = {
  chat: (message) => aiChat.chat(message),
  sendMessage: (message, onChunk) => aiChat.sendMessage(message, onChunk),
  getMessages: () => aiChat.getMessages(),
  clearChat: () => aiChat.clearChat(),
  createSession: () => aiChat.createSession(),
  getSessions: () => aiChat.getSessions(),
  saveSession: (sessionId, messages) => aiChat.saveSession(sessionId, messages),
  loadHistory: (sessionId) => aiChat.loadHistory(sessionId)
}

/**
 * 配料分析服务
 */
const NutritionService = {
  ocrRecognize: (imagePath) => ingredientAnalysis.ocrRecognize(imagePath),
  analyze: (ingredientData) => ingredientAnalysis.analyze(ingredientData),
  calculateNutriScore: (nutrition) => ingredientAnalysis.calculateNutriScore(nutrition),
  calculateNOVAGroup: (ingredients) => ingredientAnalysis.calculateNOVAGroup(ingredients),
  identifyHerbalIngredients: (ingredients) => ingredientAnalysis.identifyHerbalIngredients(ingredients),
  getHistory: () => ingredientAnalysis.getHistory(),
  clearHistory: () => ingredientAnalysis.clearHistory()
}

/**
 * 配方服务
 */
const FormulaService = {
  generateBySymptoms: (symptoms, user) => formulaManager.generateBySymptoms(symptoms, user),
  recommendAlternatives: (ingredientResult) => formulaManager.recommendAlternatives(ingredientResult),
  getFormulas: (filters) => formulaManager.getFormulas(filters),
  getFormula: (id) => formulaManager.getFormula(id),
  favorite: (id) => formulaManager.favorite(id),
  unfavorite: (id) => formulaManager.unfavorite(id),
  isFavorite: (id) => formulaManager.isFavorite(id),
  shareFormula: (formula) => formulaManager.shareFormula(formula)
}

/**
 * 电商搜索服务
 */
const SearchService = {
  search: (keyword, filters) => taobaoSearch.search(keyword, filters),
  searchByIngredients: (ingredients) => taobaoSearch.searchByIngredients(ingredients),
  getProductDetail: (itemId) => taobaoSearch.getProductDetail(itemId),
  analyzePrice: (product) => taobaoSearch.analyzePrice(product),
  compareProducts: (products) => taobaoSearch.compareProducts(products)
}

/**
 * 数据库检索服务
 */
const DatabaseService = {
  searchHerbs: (params) => database.searchHerbs(params),
  getHerb: (id) => database.getHerb(id),
  getHerbCategories: () => database.getHerbCategories(),
  getFoodHomologyHerbs: (params) => database.getFoodHomologyHerbs(params),
  checkFoodHomology: (herbName) => database.checkFoodHomology(herbName),
  searchCompounds: (params) => database.searchCompounds(params),
  getCompoundStats: () => database.getCompoundStats(),
  searchTargets: (params) => database.searchTargets(params),
  searchDiseases: (params) => database.searchDiseases(params),
  searchPeptides: (params) => database.searchPeptides(params),
  getPeptide: (id) => database.getPeptide(id),
  getActivityTypes: () => database.getActivityTypes(),
  searchKnowledge: (params) => database.searchKnowledge(params),
  getNodeRelations: (params) => database.getNodeRelations(params),
  getHerbCompoundTargets: (herbName) => database.getHerbCompoundTargets(herbName),
  getSearchHistory: () => database.getSearchHistory(),
  saveSearchHistory: (query) => database.saveSearchHistory(query),
  clearSearchHistory: () => database.clearSearchHistory()
}

/**
 * 合规标准服务
 */
const ComplianceService = {
  getLimits: () => compliance.getLimits(),
  getProhibited: () => compliance.getProhibited(),
  getGB2760: (params) => compliance.getGB2760(params),
  getGB14880: (params) => compliance.getGB14880(params),
  getGBProhibited: (params) => compliance.getGBProhibited(params),
  getStandards: (category) => compliance.getStandards(category),
  getFoodHomology: (keyword) => compliance.getFoodHomology(keyword),
  realtimeCheck: (ingredients, options) => compliance.realtimeCheck(ingredients, options),
  bulkCheck: (ingredients, population) => compliance.bulkCheck(ingredients, population),
  autoFix: (ingredients, population) => compliance.autoFix(ingredients, population),
  getCheckHistory: () => compliance.getCheckHistory(),
  saveCheckRecord: (record) => compliance.saveCheckRecord(record),
  STANDARD_CATEGORIES: compliance.STANDARD_CATEGORIES,
  GB2760_FUNCTIONS: compliance.GB2760_FUNCTIONS
}

// 导出统一API
module.exports = {
  // 认证
  auth: AuthService,

  // AI对话
  ai: AIService,

  // 营养分析
  nutrition: NutritionService,

  // 配方管理
  formulas: FormulaService,

  // 电商搜索
  search: SearchService,

  // 数据库检索 ⭐新增
  database: DatabaseService,

  // 合规标准 ⭐新增
  compliance: ComplianceService,

  // 原始请求（供高级使用）
  request
}
