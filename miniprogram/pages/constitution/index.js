/**
 * 体质测试 - 页面逻辑
 * 通过问卷评估用户中医体质类型
 */
const app = getApp()

Page({
  data: {
    currentQuestion: 0,
    totalQuestions: 20,
    answers: [],
    isCompleted: false,
    result: null,
    loading: false,
    
    // 问题列表
    questions: [
      { id: 1, text: '您是否经常感到手脚冰凉？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 2, text: '您是否容易上火、长痘痘？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 3, text: '您的面部肤色是否偏油？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 4, text: '您是否容易疲劳、气短？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 5, text: '您是否容易失眠、多梦？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 6, text: '您的情绪是否容易波动？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 7, text: '您是否经常感到口渴、想喝冷水？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 8, text: '您的大便是否经常干燥？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 9, text: '您是否容易感冒？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 10, text: '您的身体是否经常感到沉重？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 11, text: '您是否经常感到口干口苦？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 12, text: '您的舌苔是否经常厚腻？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 13, text: '您是否容易过敏？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 14, text: '您的食欲如何？', options: ['很好', '正常', '一般', '较差', '很差'] },
      { id: 15, text: '您的睡眠质量如何？', options: ['很好', '正常', '一般', '较差', '很差'] },
      { id: 16, text: '您的精力状态如何？', options: ['很充沛', '正常', '一般', '较疲惫', '很疲惫'] },
      { id: 17, text: '您是否容易腹胀？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 18, text: '您的面色是否晦暗？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 19, text: '您是否容易头晕？', options: ['完全不', '很少', '有时', '经常', '总是'] },
      { id: 20, text: '您的体重是否容易波动？', options: ['从不', '很少', '有时', '经常', '总是'] }
    ],
    
    // 体质类型定义
    constitutionTypes: {
      '平和质': { 
        name: '平和质',
        icon: '✅',
        desc: '阴阳气血调和，体态适中，面色红润，精力充沛',
        diet: '饮食多样化，均衡营养',
        lifestyle: '规律作息，适度运动',
        herbs: '无需特殊调理'
      },
      '气虚质': {
        name: '气虚质',
        icon: '😮‍💨',
        desc: '元气不足，易疲乏、气短、自汗',
        diet: '宜食益气健脾食物，如黄芪、山药',
        lifestyle: '避免过度劳累，适当散步',
        herbs: '黄芪、人参、白术'
      },
      '阳虚质': {
        name: '阳虚质',
        icon: '🥶',
        desc: '阳气不足，畏寒怕冷，手足不温',
        diet: '宜食温补食物，如羊肉、核桃',
        lifestyle: '注意保暖，避免受凉',
        herbs: '肉桂、附子、干姜'
      },
      '阴虚质': {
        name: '阴虚质',
        icon: '🔥',
        desc: '阴液亏少，口燥咽干，手足心热',
        diet: '宜食滋阴食物，如枸杞、银耳',
        lifestyle: '避免熬夜，节制房事',
        herbs: '沙参、麦冬、石斛'
      },
      '痰湿质': {
        name: '痰湿质',
        icon: '💧',
        desc: '痰湿凝聚，形体肥胖，腹部肥满',
        diet: '宜食健脾利湿食物，如薏苡仁',
        lifestyle: '坚持运动，控制饮食',
        herbs: '茯苓、陈皮、半夏'
      },
      '湿热质': {
        name: '湿热质',
        icon: '🌡️',
        desc: '湿热内蕴， face油性，易生痤疮',
        diet: '宜食清热利湿食物，如绿豆',
        lifestyle: '保持环境干燥通风',
        herbs: '茵陈、栀子、黄芩'
      },
      '血瘀质': {
        name: '血瘀质',
        icon: '🩸',
        desc: '血行不畅，肤色晦暗，易有瘀斑',
        diet: '宜食活血食物，如山楂、黑木耳',
        lifestyle: '适当运动，促进血液循环',
        herbs: '丹参、川芎、红花'
      },
      '气郁质': {
        name: '气郁质',
        icon: '😔',
        desc: '气机郁滞，神情抑郁，多愁善感',
        diet: '宜食理气食物，如玫瑰花茶',
        lifestyle: '保持心情舒畅，多社交',
        herbs: '柴胡、香附、佛手'
      },
      '特禀质': {
        name: '特禀质',
        icon: '⚠️',
        desc: '先天失常，生理缺陷，过敏反应',
        diet: '避免致敏食物，清淡饮食',
        lifestyle: '避免接触过敏原',
        herbs: '防风、蝉蜕、乌梅'
      }
    }
  },

  onLoad() {
    // 检查是否有未完成的测试
    const savedAnswers = wx.getStorageSync('constitution_test_answers')
    if (savedAnswers && savedAnswers.answers.length > 0) {
      this.setData({ answers: savedAnswers.answers, currentQuestion: savedAnswers.currentQuestion })
    }
  },

  onShow() {
    // 刷新结果
    this.checkResult()
  },

  // ==================== 答题相关 ====================
  
  onAnswer(e) {
    const optionIndex = e.currentTarget.dataset.index
    const questionId = this.data.questions[this.data.currentQuestion].id
    
    const newAnswers = [...this.data.answers]
    newAnswers[questionId] = optionIndex
    
    this.setData({ answers: newAnswers })
    
    // 保存进度
    wx.setStorageSync('constitution_test_answers', {
      answers: newAnswers,
      currentQuestion: this.data.currentQuestion
    })
    
    // 下一题或计算结果
    if (this.data.currentQuestion < this.data.totalQuestions - 1) {
      setTimeout(() => {
        this.nextQuestion()
      }, 200)
    } else {
      this.calculateResult()
    }
  },

  nextQuestion() {
    this.setData({ currentQuestion: this.data.currentQuestion + 1 })
  },

  prevQuestion() {
    if (this.data.currentQuestion > 0) {
      this.setData({ currentQuestion: this.data.currentQuestion - 1 })
    }
  },

  skipQuestion() {
    this.nextQuestion()
  },

  // ==================== 结果计算 ====================
  
  calculateResult() {
    this.setData({ loading: true })
    
    // 简化算法：根据答案数量判断体质
    const scores = {
      '阳虚质': 0,
      '阴虚质': 0,
      '痰湿质': 0,
      '湿热质': 0,
      '气虚质': 0,
      '血瘀质': 0,
      '气郁质': 0,
      '特禀质': 0,
      '平和质': 0
    }
    
    // 问题-体质映射（简化版）
    const questionMapping = {
      1: '阳虚质',
      2: '阴虚质',
      3: '湿热质',
      4: '气虚质',
      5: '阴虚质',
      6: '气郁质',
      7: '阴虚质',
      8: '湿热质',
      9: '气虚质',
      10: '痰湿质',
      11: '湿热质',
      12: '痰湿质',
      13: '特禀质',
      14: '气虚质',
      15: '阴虚质',
      16: '气虚质',
      17: '痰湿质',
      18: '血瘀质',
      19: '血瘀质',
      20: '痰湿质'
    }
    
    this.data.answers.forEach((answer, index) => {
      if (answer !== undefined && answer !== null) {
        const questionId = index + 1
        const constitution = questionMapping[questionId]
        if (constitution) {
          scores[constitution] += answer
        }
      }
    })
    
    // 找出得分最高的体质
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
    
    // 判断是否为平和质
    const avgScore = maxScore / this.data.totalQuestions
    if (avgScore < 2) {
      mainConstitution = '平和质'
    }
    
    const result = {
      mainConstitution: mainConstitution,
      secondaryConstitution: secondaryConstitution,
      score: maxScore,
      timestamp: Date.now()
    }
    
    this.setData({
      isCompleted: true,
      result: result,
      loading: false
    })
    
    // 保存结果
    wx.setStorageSync('constitution_result', result)
  },

  checkResult() {
    const savedResult = wx.getStorageSync('constitution_result')
    if (savedResult && savedResult.timestamp) {
      // 7天内有效
      const daysDiff = (Date.now() - savedResult.timestamp) / (24 * 60 * 60 * 1000)
      if (daysDiff < 7) {
        this.setData({ isCompleted: true, result: savedResult })
      }
    }
  },

  // ==================== 重置测试 ====================
  
  resetTest() {
    wx.showModal({
      title: '重置测试',
      content: '确定要重新开始体质测试吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('constitution_test_answers')
          wx.removeStorageSync('constitution_result')
          this.setData({
            currentQuestion: 0,
            answers: [],
            isCompleted: false,
            result: null
          })
        }
      }
    })
  },

  saveResult() {
    try {
      const results = wx.getStorageSync('constitution_history') || []
      results.unshift(this.data.result)
      if (results.length > 10) results.pop()
      wx.setStorageSync('constitution_history', results)
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // ==================== 导航操作 ====================
  
  goToHome() {
    wx.navigateTo({ url:"/pages/index/index" })
  },

  goToProfile() {
    wx.navigateTo({ url:"/pages/profile/index/index" })
  },

  onShareAppMessage() {
    return {
      title: '我在RMFOOD做了体质测试，快来试试吧！',
      path: '/pages/constitution/index'
    }
  }
})
