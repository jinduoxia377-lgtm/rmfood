/**
 * RMFOOD 小程序 - API 统一入口
 * 包含所有业务接口封装
 */

const request = require('./request.js')
const config = require('../config/api.js')

// ==================== 通用工具方法 ====================

/**
 * 构建查询字符串（兼容小程序环境，不使用URLSearchParams）
 */
function buildQueryString(params) {
  if (!params || Object.keys(params).length === 0) return ''
  return Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
}

/**
 * 带错误处理的API调用
 */
async function safeRequest(apiFn, errorMsg = '请求失败') {
  try {
    console.log('[API] 开始请求:', errorMsg)
    const result = await apiFn()
    console.log('[API] 请求成功:', errorMsg, 'result:', JSON.stringify(result).substring(0, 200))
    return result
  } catch (error) {
    console.error('[API] 请求失败:', errorMsg, 'error:', JSON.stringify(error))
    wx.showToast({ title: errorMsg, icon: 'none' })
    throw error
  }
}

/**
 * 防抖函数
 */
function debounce(fn, delay = 300) {
  let timer = null
  return function(...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

/**
 * 节流函数
 */
function throttle(fn, delay = 300) {
  let last = 0
  return function(...args) {
    const now = Date.now()
    if (now - last >= delay) {
      last = now
      fn.apply(this, args)
    }
  }
}

// ==================== 认证模块 ====================

const auth = {
  /**
   * 微信登录
   */
  async login(code) {
    return safeRequest(async () => {
      const res = await request.post('/auth/wechat/login', { code })
      if (res && res.access_token) {
        wx.setStorageSync('rmfood_token', res.access_token)
        wx.setStorageSync('user_info', res.user)
      }
      return res
    }, '登录失败')
  },

  /**
   * 获取用户信息
   */
  async getUserInfo() {
    return safeRequest(async () => {
      return await request.get('/users/me')
    }, '获取用户信息失败')
  },

  /**
   * 更新用户资料
   */
  async updateProfile(data) {
    return safeRequest(async () => {
      return await request.put('/users/profile', data)
    }, '更新资料失败')
  },

  /**
   * 上传头像
   */
  async uploadAvatar(filePath) {
    return safeRequest(async () => {
      const res = await request.upload('/users/avatar', filePath)
      if (res && res.url) {
        const userInfo = wx.getStorageSync('user_info') || {}
        userInfo.avatar_url = res.url
        wx.setStorageSync('user_info', userInfo)
      }
      return res
    }, '上传头像失败')
  },

  /**
   * 登出
   */
  logout() {
    wx.removeStorageSync('rmfood_token')
    wx.removeStorageSync('user_info')
  },

  /**
   * 检查登录状态
   */
  isLoggedIn() {
    return !!wx.getStorageSync('rmfood_token')
  },

  /**
   * 获取当前用户
   */
  getUser() {
    return wx.getStorageSync('user_info') || null
  }
}

// ==================== 配料分析模块 ====================

const ingredients = {
  /**
   * OCR识别配料表
   */
  async ocr(imagePath) {
    return safeRequest(async () => {
      return await request.post('/ingredients/ocr', { image: imagePath })
    }, '识别失败，请重试')
  },

  /**
   * 分析配料
   */
  async analyze(ingredientsList) {
    return safeRequest(async () => {
      const res = await request.post('/ingredients/analyze', { ingredients: ingredientsList })
      return res.data || res
    }, '分析失败')
  },

  /**
   * 获取添加剂列表
   */
  async getAdditives(category = '') {
    return safeRequest(async () => {
      return await request.get(`/ingredients/additives${category ? `?category=${category}` : ''}`)
    }, '获取添加剂列表失败')
  },

  /**
   * 查询单个配料信息
   */
  async getIngredientInfo(name) {
    return safeRequest(async () => {
      return await request.get(`/ingredients/${encodeURIComponent(name)}`)
    }, '查询失败')
  },

  /**
   * 搜索食材/中药材
   */
  async search(keyword) {
    return safeRequest(async () => {
      const query = buildQueryString({ keyword, page: 1, pageSize: 10 })
      return await request.get(`/databases/herbs/symmap${query ? `?${query}` : ''}`)
    }, '搜索失败')
  }
}

// ==================== 配方模块 ====================

const formulas = {
  /**
   * 获取配方列表
   */
  async getFormulas(params = {}) {
    return safeRequest(async () => {
      const query = buildQueryString(params)
      return await request.get(`/formulas${query ? `?${query}` : ''}`)
    }, '获取配方列表失败')
  },

  /**
   * 获取配方详情
   */
  async getFormula(id) {
    return safeRequest(async () => {
      return await request.get(`/formulas/${id}`)
    }, '获取配方详情失败')
  },

  /**
   * 收藏配方
   */
  async favorite(id) {
    return safeRequest(async () => {
      return await request.post(`/formulas/${id}/favorite`)
    }, '收藏失败')
  },

  /**
   * 取消收藏
   */
  async unfavorite(id) {
    return safeRequest(async () => {
      return await request.delete(`/formulas/${id}/favorite`)
    }, '取消收藏失败')
  },

  /**
   * 获取收藏列表
   */
  async getFavorites() {
    return safeRequest(async () => {
      return await request.get('/formulas/favorites')
    }, '获取收藏列表失败')
  },

  /**
   * 创建配方
   */
  async createFormula(data) {
    return safeRequest(async () => {
      return await request.post('/formulas', data)
    }, '创建配方失败')
  },

  /**
   * 更新配方
   */
  async updateFormula(id, data) {
    return safeRequest(async () => {
      return await request.put(`/formulas/${id}`, data)
    }, '更新配方失败')
  },

  /**
   * 删除配方
   */
  async deleteFormula(id) {
    return safeRequest(async () => {
      return await request.delete(`/formulas/${id}`)
    }, '删除配方失败')
  },

  /**
   * 分享配方
   */
  async shareFormula(id) {
    return safeRequest(async () => {
      const formula = await this.getFormula(id)
      return {
        title: formula?.name || '药食同源配方',
        path: `/packages/formulas/pages/detail/index?id=${id}`
      }
    }, '获取分享信息失败')
  }
}

// ==================== 数据库模块 ====================

const database = {
  /**
   * 搜索中药材
   */
  async searchHerbs(params = {}) {
    return safeRequest(async () => {
      const query = buildQueryString(params)
      return await request.get(`/databases/herbs/symmap${query ? `?${query}` : ''}`)
    }, '搜索失败')
  },

  /**
   * 获取药材详情
   */
  async getHerb(id) {
    return safeRequest(async () => {
      return await request.get(`/databases/herbs/symmap/${id}`)
    }, '获取详情失败')
  },

  /**
   * 搜索活性肽
   */
  async searchPeptides(params = {}) {
    return safeRequest(async () => {
      const query = buildQueryString(params)
      return await request.get(`/databases/peptides${query ? `?${query}` : ''}`)
    }, '搜索失败')
  },

  /**
   * 获取药食同源列表
   */
  async getFoodHomologyHerbs(params = {}) {
    return safeRequest(async () => {
      const query = buildQueryString(params)
      return await request.get(`/databases/food-materials${query ? `?${query}` : ''}`)
    }, '获取失败')
  },

  /**
   * 检查是否药食同源
   */
  async checkFoodHomology(name) {
    return safeRequest(async () => {
      return await request.get(`/databases/food-materials?keyword=${encodeURIComponent(name)}`)
    }, '查询失败')
  },

  /**
   * 获取化合物统计
   */
  async getCompoundStats() {
    return safeRequest(async () => {
      return await request.get('/databases/stats')
    }, '获取统计失败')
  },

  /**
   * 获取知识图谱
   */
  async getHerbCompoundTargets(herbName) {
    return safeRequest(async () => {
      return await request.get(`/databases/knowledge-graph/search?keyword=${encodeURIComponent(herbName)}`)
    }, '获取图谱失败')
  },

  /**
   * 搜索历史
   */
  getSearchHistory() {
    const history = wx.getStorageSync('search_history') || []
    return Promise.resolve({ history })
  },

  saveSearchHistory(query) {
    try {
      const history = wx.getStorageSync('search_history') || []
      const index = history.indexOf(query)
      if (index > -1) {
        history.splice(index, 1)
      }
      history.unshift(query)
      if (history.length > 20) history.pop()
      wx.setStorageSync('search_history', history)
    } catch (e) {
      console.error('保存搜索历史失败:', e)
    }
    return Promise.resolve()
  },

  clearSearchHistory() {
    wx.removeStorageSync('search_history')
    return Promise.resolve()
  }
}

// ==================== 合规检查模块 ====================

const compliance = {
  /**
   * 获取国家标准列表
   */
  async getStandards(category = '') {
    return safeRequest(async () => {
      return await request.get(`/compliance/standards${category ? `?category=${category}` : ''}`)
    }, '获取标准失败')
  },

  /**
   * 获取GB 2760食品添加剂
   */
  async getGB2760(params = {}) {
    return safeRequest(async () => {
      const query = buildQueryString(params)
      return await request.get(`/compliance/gb2760${query ? `?${query}` : ''}`)
    }, '获取数据失败')
  },

  /**
   * 获取GB 14880营养强化剂
   */
  async getGB14880(params = {}) {
    return safeRequest(async () => {
      const query = buildQueryString(params)
      return await request.get(`/compliance/gb14880${query ? `?${query}` : ''}`)
    }, '获取数据失败')
  },

  /**
   * 获取药食同源目录
   */
  async getFoodHomology(keyword = '') {
    return safeRequest(async () => {
      return await request.get(`/compliance/food-homology${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`)
    }, '获取目录失败')
  },

  /**
   * 获取禁忌搭配
   */
  async getProhibited() {
    return safeRequest(async () => {
      return await request.get('/compliance/prohibited')
    }, '获取数据失败')
  },

  /**
   * 获取国标禁用物质
   */
  async getGBProhibited() {
    return safeRequest(async () => {
      return await request.get('/compliance/gb-prohibited')
    }, '获取数据失败')
  },

  /**
   * 实时合规检查
   */
  async realtimeCheck(ingredients, options = {}) {
    return safeRequest(async () => {
      return await request.post('/compliance/check', {
        ingredients,
        population: options.population || 'adults'
      })
    }, '检查失败')
  },

  /**
   * 自动修复配方
   */
  async autoFix(ingredients, population = 'adults') {
    return safeRequest(async () => {
      return await request.post('/compliance/auto-fix', { ingredients, population })
    }, '修复失败')
  },

  /**
   * 保存检查记录
   */
  async saveCheckRecord(data) {
    return safeRequest(async () => {
      return await request.post('/compliance/records', data)
    }, '保存失败')
  }
}

// ==================== AI对话模块 ====================

const chat = {
  /**
   * 发送消息
   */
  async sendMessage(message, conversationId = '') {
    return safeRequest(async () => {
      const res = await request.post('/chat/messages', {
        message,
        conversation_id: conversationId
      })
      return res
    }, '发送失败')
  },

  /**
   * 获取对话历史
   */
  async getConversation(conversationId) {
    return safeRequest(async () => {
      return await request.get(`/chat/conversations/${conversationId}`)
    }, '获取历史失败')
  },

  /**
   * 获取对话列表
   */
  async getConversations() {
    return safeRequest(async () => {
      return await request.get('/chat/conversations')
    }, '获取列表失败')
  },

  /**
   * 创建新对话
   */
  async createConversation() {
    return safeRequest(async () => {
      return await request.post('/chat/conversations')
    }, '创建失败')
  },

  /**
   * 删除对话
   */
  async deleteConversation(conversationId) {
    return safeRequest(async () => {
      await request.delete(`/chat/conversations/${conversationId}`)
    }, '删除失败')
  },

  /**
   * 流式对话（SSE）
   */
  async streamMessage(message, onChunk, onComplete, onError) {
    try {
      const token = wx.getStorageSync('rmfood_token') || ''
      const wsUrl = `${config.wsUrl}/chat/stream`
      
      const socket = wx.connectSocket({ url: wsUrl })
      
      socket.onMessage((res) => {
        try {
          const data = JSON.parse(res.data)
          if (data.type === 'chunk') {
            onChunk(data.content)
          } else if (data.type === 'complete') {
            onComplete(data.message)
            socket.close()
          } else if (data.type === 'error') {
            onError(data.message)
            socket.close()
          }
        } catch (e) {
          onError('解析响应失败')
          socket.close()
        }
      })
      
      socket.onOpen(() => {
        socket.send(JSON.stringify({ type: 'message', content: message }))
      })
      
      socket.onError((err) => {
        onError('连接失败')
      })
      
      return socket
    } catch (error) {
      onError(error.message)
      return null
    }
  }
}

// ==================== 体质测试模块 ====================

const constitution = {
  /**
   * 计算体质结果
   */
  async calculateResult(answers) {
    // 简化版本地计算，实际可对接后端
    const scores = {
      '平和质': 0, '气虚质': 0, '阳虚质': 0, '阴虚质': 0,
      '痰湿质': 0, '湿热质': 0, '血瘀质': 0, '气郁质': 0, '特禀质': 0
    }
    
    const questionMapping = {
      1: '阳虚质', 2: '阴虚质', 3: '湿热质', 4: '气虚质', 5: '阴虚质',
      6: '气郁质', 7: '阴虚质', 8: '湿热质', 9: '气虚质', 10: '痰湿质',
      11: '湿热质', 12: '痰湿质', 13: '特禀质', 14: '气虚质', 15: '阴虚质',
      16: '气虚质', 17: '痰湿质', 18: '血瘀质', 19: '血瘀质', 20: '痰湿质'
    }
    
    answers.forEach((answer, index) => {
      if (answer !== undefined && answer !== null) {
        const questionId = index + 1
        const constitution = questionMapping[questionId]
        if (constitution) {
          scores[constitution] += answer
        }
      }
    })
    
    let maxScore = 0
    let mainConstitution = '平和质'
    let secondaryConstitution = ''
    
    Object.keys(scores).forEach(key => {
      if (scores[key] > maxScore) {
        maxScore = scores[key]
        secondaryConstitution = mainConstitution
        mainConstitution = key
      }
    })
    
    const avgScore = maxScore / answers.length
    if (avgScore < 2) {
      mainConstitution = '平和质'
    }
    
    return {
      mainConstitution,
      secondaryConstitution,
      scores,
      score: maxScore,
      timestamp: Date.now()
    }
  },

  /**
   * 获取体质类型信息
   */
  getConstitutionInfo(type) {
    const info = {
      '平和质': {
        icon: '✅',
        desc: '阴阳气血调和，体态适中，面色红润，精力充沛',
        diet: '饮食多样化，均衡营养，不过偏嗜',
        lifestyle: '规律作息，适度运动，保持心情舒畅',
        herbs: '无需特殊调理，可适当食用山药、茯苓等健脾食材'
      },
      '气虚质': {
        icon: '😮‍💨',
        desc: '元气不足，易疲乏、气短、自汗',
        diet: '宜食益气健脾食物，如黄芪、山药、红枣',
        lifestyle: '避免过度劳累，适当散步、太极拳',
        herbs: '黄芪、人参、白术、甘草'
      },
      '阳虚质': {
        icon: '🥶',
        desc: '阳气不足，畏寒怕冷，手足不温',
        diet: '宜食温补食物，如羊肉、核桃、桂圆',
        lifestyle: '注意保暖，避免受凉，多晒太阳',
        herbs: '肉桂、附子、干姜、鹿茸'
      },
      '阴虚质': {
        icon: '🔥',
        desc: '阴液亏少，口燥咽干，手足心热',
        diet: '宜食滋阴食物，如枸杞、银耳、百合',
        lifestyle: '避免熬夜，节制房事，减少辛辣',
        herbs: '沙参、麦冬、石斛、玉竹'
      },
      '痰湿质': {
        icon: '💧',
        desc: '痰湿凝聚，形体肥胖，腹部肥满',
        diet: '宜食健脾利湿食物，如薏苡仁、冬瓜',
        lifestyle: '坚持运动，控制饮食，避免潮湿',
        herbs: '茯苓、陈皮、半夏、泽泻'
      },
      '湿热质': {
        icon: '🌡️',
        desc: '湿热内蕴，面部油性，易生痤疮',
        diet: '宜食清热利湿食物，如绿豆、芹菜',
        lifestyle: '保持环境干燥通风，避免熬夜',
        herbs: '茵陈、栀子、黄芩、黄连'
      },
      '血瘀质': {
        icon: '🩸',
        desc: '血行不畅，肤色晦暗，易有瘀斑',
        diet: '宜食活血食物，如山楂、黑木耳',
        lifestyle: '适当运动，促进血液循环',
        herbs: '丹参、川芎、红花、桃仁'
      },
      '气郁质': {
        icon: '😔',
        desc: '气机郁滞，神情抑郁，多愁善感',
        diet: '宜食理气食物，如玫瑰花茶、柑橘',
        lifestyle: '保持心情舒畅，多社交活动',
        herbs: '柴胡、香附、佛手、薄荷'
      },
      '特禀质': {
        icon: '⚠️',
        desc: '先天失常，生理缺陷，过敏反应',
        diet: '避免致敏食物，清淡饮食',
        lifestyle: '避免接触过敏原，加强锻炼',
        herbs: '防风、蝉蜕、乌梅、黄芪'
      }
    }
    return info[type] || info['平和质']
  }
}

// ==================== 饮食日历模块 ====================

const meal = {
  /**
   * 节气养生建议
   */
  getSolarTermTips(term) {
    const tips = {
      '立春': {宜: '辛甘发散之品', 忌: '酸收之品', 食疗: '韭菜炒鸡蛋、春饼'},
      '雨水': {宜: '少吃酸，多吃甜', 忌: '生冷寒凉', 食疗: '山药粥、红枣汤'},
      '惊蛰': {宜: '清淡养肝', 忌: '辛辣燥热', 食疗: '梨汁、菊花茶'},
      '春分': {宜: '阴阳平衡', 忌: '偏寒偏热', 食疗: '春笋、荠菜'},
      '清明': {宜: '健脾祛湿', 忌: '发物', 食疗: '青团、薏米粥'},
      '谷雨': {宜: '保暖防寒', 忌: '生冷', 食疗: '山药粥、姜枣茶'},
      '立夏': {宜: '清淡为主', 忌: '油腻', 食疗: '荷叶粥、绿豆汤'},
      '小满': {宜: '清热利湿', 忌: '辛辣', 食疗: '冬瓜汤、赤小豆'},
      '芒种': {宜: '清淡消暑', 忌: '油腻', 食疗: '苦瓜、绿豆汤'},
      '夏至': {宜: '清热解暑', 忌: '贪凉', 食疗: '西瓜、绿豆汤'},
      '小暑': {宜: '清热解暑', 忌: '冷饮过量', 食疗: '荷叶粥、酸梅汤'},
      '大暑': {宜: '消暑解毒', 忌: '生冷', 食疗: '绿豆汤、西瓜'},
      '立秋': {宜: '滋阴润燥', 忌: '辛辣', 食疗: '银耳汤、梨'},
      '处暑': {宜: '清热安神', 忌: '油腻', 食疗: '百合粥、莲子汤'},
      '白露': {宜: '滋阴润燥', 忌: '辛辣', 食疗: '银耳雪梨汤'},
      '秋分': {宜: '阴阳平衡', 忌: '偏寒偏热', 食疗: '山药、百合'},
      '寒露': {宜: '滋阴润燥', 忌: '生冷', 食疗: '蜂蜜水、核桃'},
      '霜降': {宜: '平补为先', 忌: '大补', 食疗: '柿饼、板栗'},
      '立冬': {宜: '温补养藏', 忌: '生冷', 食疗: '羊肉汤、当归生姜'},
      '小雪': {宜: '温补益肾', 忌: '寒凉', 食疗: '黑豆粥、核桃'},
      '大雪': {宜: '温补御寒', 忌: '辛辣', 食疗: '羊肉汤、姜枣茶'},
      '冬至': {宜: '温补为主', 忌: '生冷', 食疗: '汤圆、桂圆粥'},
      '小寒': {宜: '温补驱寒', 忌: '寒凉', 食疗: '羊肉、糯米'},
      '大寒': {宜: '温补养肾', 忌: '生冷', 食疗: '桂圆粥、核桃'}
    }
    return tips[term] || {宜: '均衡饮食', 忌: '偏食', 食疗: '根据体质选择'}
  },

  /**
   * 获取今日食谱推荐
   */
  async getTodayRecommend() {
    // 根据节气生成推荐
    const now = new Date()
    const solarTerms = [
      { name: '立春', end: [2, 3] }, { name: '雨水', end: [2, 18] },
      { name: '惊蛰', end: [3, 5] }, { name: '春分', end: [3, 20] },
      { name: '清明', end: [4, 4] }, { name: '谷雨', end: [4, 19] },
      { name: '立夏', end: [5, 5] }, { name: '小满', end: [5, 20] },
      { name: '芒种', end: [6, 5] }, { name: '夏至', end: [6, 21] },
      { name: '小暑', end: [7, 6] }, { name: '大暑', end: [7, 22] },
      { name: '立秋', end: [8, 7] }, { name: '处暑', end: [8, 22] },
      { name: '白露', end: [9, 7] }, { name: '秋分', end: [9, 22] },
      { name: '寒露', end: [10, 8] }, { name: '霜降', end: [10, 23] },
      { name: '立冬', end: [11, 7] }, { name: '小雪', end: [11, 22] },
      { name: '大雪', end: [12, 6] }, { name: '冬至', end: [12, 21] },
      { name: '小寒', end: [1, 5] }, { name: '大寒', end: [1, 20] }
    ]
    
    const month = now.getMonth() + 1
    const day = now.getDate()
    let currentTerm = '立春'
    for (const term of solarTerms) {
      if (month === term.end[0] && day <= term.end[1]) {
        currentTerm = term.name
        break
      }
    }
    
    const tips = this.getSolarTermTips(currentTerm)
    
    // 根据节气和星期生成食谱
    const weekday = now.getDay()
    const mealPlan = {
      breakfast: [
        '小米红枣粥', '山药粥', '燕麦粥', '杂粮粥', '红豆粥', '南瓜粥', '花生粥'
      ][weekday],
      lunch: [
        '黄芪鸡汤', '当归生姜羊肉汤', '枸杞猪肝汤', '西洋参炖鸡', 
        '茯苓饼配汤', '红枣桂圆茶', '薏米粥'
      ][weekday],
      dinner: [
        '清蒸鱼+青菜', '蒜蓉西兰花+米饭', '番茄炒蛋+面条', 
        '清炒时蔬+米饭', '胡萝卜炒肉+粥', '当归煮鸡蛋+米饭', '素食清淡餐'
      ][weekday],
      snack: tips.食疗
    }
    
    return {
      ...mealPlan,
      solarTerm: currentTerm,
      tips: {
        宜: tips.宜,
        忌: tips.忌,
        食疗: tips.食疗
      }
    }
  },

  /**
   * 获取健康提示
   */
  async getHealthTips() {
    const now = new Date()
    const tips = []
    
    // 节气提醒
    const tipsList = [
      { type: 'season', title: '节气养生', desc: '顺应节气，调养身心' },
      { type: 'warning', title: '饮食注意', desc: '根据时令调整饮食' },
      { type: 'knowledge', title: '健康知识', desc: '了解药食同源知识' }
    ]
    
    tips.push(...tipsList)
    return tips
  },

  /**
   * 获取指定日期食谱
   */
  async getDateMenu(year, month, day) {
    const date = new Date(year, month, day)
    const weekday = date.getDay()
    const meals = {
      0: { breakfast: '小米粥+鸡蛋', lunch: '山药排骨汤', dinner: '清蒸鱼+青菜' },
      1: { breakfast: '豆浆+包子', lunch: '黄芪鸡汤', dinner: '蒜蓉西兰花+米饭' },
      2: { breakfast: '燕麦粥+水果', lunch: '枸杞猪肝汤', dinner: '番茄炒蛋+面条' },
      3: { breakfast: '杂粮粥+蒸饺', lunch: '当归生姜羊肉汤', dinner: '清炒时蔬+米饭' },
      4: { breakfast: '牛奶+全麦面包', lunch: '西洋参炖鸡', dinner: '胡萝卜炒肉+粥' },
      5: { breakfast: '红豆粥+鸡蛋', lunch: '茯苓饼+汤', dinner: '清蒸鲈鱼+青菜' },
      6: { breakfast: '薏米粥+点心', lunch: '红枣桂圆茶+面包', dinner: '当归煮鸡蛋+米饭' }
    }
    return meals[weekday] || meals[0]
  }
}

// ==================== 聊天管理模块 ====================

const chatManager = {
  conversations: [],
  currentConversationId: null,
  
  init() {
    try {
      const saved = wx.getStorageSync('chat_conversations')
      if (saved) {
        this.conversations = saved
      }
    } catch (e) {
      this.conversations = []
    }
  },

  async create() {
    try {
      const res = await chat.createConversation()
      this.conversations.unshift(res)
      this.save()
      return res
    } catch (e) {
      const id = 'conv_' + Date.now()
      const conv = { id, title: '新对话', messages: [], createdAt: new Date().toISOString() }
      this.conversations.unshift(conv)
      this.save()
      return conv
    }
  },

  async sendMessage(conversationId, message) {
    try {
      const res = await chat.sendMessage(message, conversationId)
      this.addMessage(conversationId, { role: 'user', content: message, timestamp: new Date().toISOString() })
      this.addMessage(conversationId, { role: 'assistant', content: res.message || res.content || '', timestamp: new Date().toISOString() })
      this.save()
      return res
    } catch (e) {
      this.addMessage(conversationId, { role: 'user', content: message, timestamp: new Date().toISOString() })
      this.addMessage(conversationId, { role: 'assistant', content: '抱歉，服务暂时不可用，请稍后重试。', timestamp: new Date().toISOString() })
      this.save()
      return { message: '抱歉，服务暂时不可用' }
    }
  },

  addMessage(conversationId, message) {
    const conv = this.conversations.find(c => c.id === conversationId)
    if (conv) {
      conv.messages.push(message)
      this.save()
    }
  },

  delete(conversationId) {
    this.conversations = this.conversations.filter(c => c.id !== conversationId)
    this.save()
  },

  save() {
    try {
      wx.setStorageSync('chat_conversations', this.conversations)
    } catch (e) {
      console.error('保存对话失败:', e)
    }
  }
}

// ==================== 导出 ====================

module.exports = {
  auth,
  ingredients,
  formulas,
  database,
  compliance,
  chat,
  constitution,
  meal,
  chatManager,
  // 兼容旧调用
  api: {
    auth,
    ingredients,
    formulas,
    database,
    compliance,
    chat,
    constitution,
    meal,
    chatManager
  }
}
