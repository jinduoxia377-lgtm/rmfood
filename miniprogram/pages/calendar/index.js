/**
 * 饮食日历 - 页面逻辑（深度完善版）
 * 提供每日饮食建议和节气养生提醒
 */
const api = require('../../../utils/api.js')

// 节气名称
const SOLAR_TERMS = [
  { name: '小寒', start: [1, 5], end: [1, 20] },
  { name: '大寒', start: [1, 20], end: [1, 31] },
  { name: '立春', start: [2, 3], end: [2, 18] },
  { name: '雨水', start: [2, 18], end: [3, 5] },
  { name: '惊蛰', start: [3, 5], end: [3, 20] },
  { name: '春分', start: [3, 20], end: [4, 4] },
  { name: '清明', start: [4, 4], end: [4, 19] },
  { name: '谷雨', start: [4, 19], end: [5, 5] },
  { name: '立夏', start: [5, 5], end: [5, 20] },
  { name: '小满', start: [5, 20], end: [6, 5] },
  { name: '芒种', start: [6, 5], end: [6, 21] },
  { name: '夏至', start: [6, 21], end: [7, 6] },
  { name: '小暑', start: [7, 6], end: [7, 22] },
  { name: '大暑', start: [7, 22], end: [8, 7] },
  { name: '立秋', start: [8, 7], end: [8, 22] },
  { name: '处暑', start: [8, 22], end: [9, 7] },
  { name: '白露', start: [9, 7], end: [9, 22] },
  { name: '秋分', start: [9, 22], end: [10, 8] },
  { name: '寒露', start: [10, 8], end: [10, 23] },
  { name: '霜降', start: [10, 23], end: [11, 7] },
  { name: '立冬', start: [11, 7], end: [11, 22] },
  { name: '小雪', start: [11, 22], end: [12, 6] },
  { name: '大雪', start: [12, 6], end: [12, 21] },
  { name: '冬至', start: [12, 21], end: [1, 5] }
]

// 每日食谱模板
const MEAL_TEMPLATES = {
  0: { breakfast: '小米红枣粥 + 水煮蛋', lunch: '山药排骨汤', dinner: '清蒸鲈鱼 + 蒜蓉西兰花', snack: '冰糖炖雪梨' },
  1: { breakfast: '红豆薏米粥 + 蒸饺', lunch: '黄芪乌鸡汤', dinner: '胡萝卜炒牛肉 + 米饭', snack: '银耳羹' },
  2: { breakfast: '燕麦粥 + 牛奶', lunch: '枸杞猪肝汤', dinner: '番茄炒蛋 + 清炒时蔬', snack: '水果拼盘' },
  3: { breakfast: '杂粮粥 + 茶叶蛋', lunch: '当归生姜羊肉汤', dinner: '清蒸鳕鱼 + 拌黄瓜', snack: '红枣桂圆茶' },
  4: { breakfast: '南瓜粥 + 全麦面包', lunch: '西洋参炖鸡', dinner: '芹菜炒香干 + 紫菜蛋花汤', snack: '杏仁饼' },
  5: { breakfast: '八宝粥 + 豆浆', lunch: '茯苓饼 + 莲子汤', dinner: '清蒸多宝鱼 + 白灼菜心', snack: '蜂蜜柚子茶' },
  6: { breakfast: '玉米糊 + 煮鸡蛋', lunch: '当归煮鸡蛋 + 米饭', dinner: '冬瓜排骨汤 + 清炒菠菜', snack: '山楂糕' }
}

// 节气养生建议
const TERM_TIPS = {
  '小寒': {宜: '温补驱寒', 忌: '寒凉生冷', 食疗: '羊肉、桂圆、核桃', 起居: '早睡晚起，注意保暖'},
  '大寒': {宜: '温补养肾', 忌: '油腻辛辣', 食疗: '黑豆、核桃、栗子', 起居: '防寒保暖，适度运动'},
  '立春': {宜: '辛甘发散', 忌: '酸收敛藏', 食疗: '韭菜、春韭、香菜', 起居: '春捂秋冻，适当活动'},
  '雨水': {宜: '少酸多甘', 忌: '寒凉食物', 食疗: '山药、红枣、薏米', 起居: '防寒防潮，注意脾胃'},
  '惊蛰': {宜: '清淡养肝', 忌: '辛辣燥热', 食疗: '梨、菊花、枸杞', 起居: '早睡早起，舒展筋骨'},
  '春分': {宜: '阴阳平衡', 忌: '偏寒偏热', 食疗: '春笋、荠菜、菠菜', 起居: '劳逸结合，调节情绪'},
  '清明': {宜: '健脾祛湿', 忌: '发物过敏', 食疗: '青团、荠菜、莴笋', 起居: '踏青户外活动'},
  '谷雨': {宜: '健脾养胃', 忌: '生冷食物', 食疗: '山药、豆芽、韭菜', 起居: '防潮湿，适当运动'},
  '立夏': {宜: '清淡为主', 忌: '油腻厚味', 食疗: '荷叶粥、绿豆汤、苦菜', 起居: '早睡早起，午间小憩'},
  '小满': {宜: '清热利湿', 忌: '辛辣燥热', 食疗: '冬瓜、赤小豆、苦瓜', 起居: '防暑降温，保持干燥'},
  '芒种': {宜: '清淡消暑', 忌: '油腻难消化', 食疗: '绿豆汤、西瓜、冬瓜', 起居: '防暑降温，适当出汗'},
  '夏至': {宜: '清热解暑', 忌: '贪凉饮冷', 食疗: '西瓜、绿豆、荷叶', 起居: '午睡养生，避暑降温'},
  '小暑': {宜: '清热解暑', 忌: '暴饮暴食', 食疗: '酸梅汤、绿豆粥、荷叶饭', 起居: '避暑降温，饮食清淡'},
  '大暑': {宜: '消暑解毒', 忌: '生冷寒凉', 食疗: '绿豆汤、西瓜、苦瓜', 起居: '防暑降温，适当饮水'},
  '立秋': {宜: '滋阴润燥', 忌: '辛辣燥热', 食疗: '银耳、梨、蜂蜜', 起居: '早睡早起，收敛神气'},
  '处暑': {宜: '清热安神', 忌: '油腻辛辣', 食疗: '百合粥、莲子汤、银耳', 起居: '早睡早起，适度运动'},
  '白露': {宜: '滋阴润肺', 忌: '生冷寒凉', 食疗: '银耳雪梨汤、蜂蜜水', 起居: '早晚添衣，注意保暖'},
  '秋分': {宜: '阴阳平衡', 忌: '偏寒偏热', 食疗: '山药、百合、银耳', 起居: '早睡早起，收敛阳气'},
  '寒露': {宜: '滋阴润燥', 忌: '辛辣刺激', 食疗: '蜂蜜水、核桃、芝麻', 起居: '注意保暖，预防秋燥'},
  '霜降': {宜: '平补为先', 忌: '大补特补', 食疗: '柿饼、板栗、萝卜', 起居: '防寒保暖，适量运动'},
  '立冬': {宜: '温补养藏', 忌: '生冷寒凉', 食疗: '羊肉汤、当归生姜', 起居: '早睡晚起，防寒保暖'},
  '小雪': {宜: '温补益肾', 忌: '寒凉食物', 食疗: '黑豆粥、核桃、红薯', 起居: '防寒保暖，适度运动'},
  '大雪': {宜: '温补御寒', 忌: '辛辣燥热', 食疗: '羊肉汤、姜枣茶、桂圆', 起居: '早睡晚起，注意保暖'},
  '冬至': {宜: '温补为主', 忌: '生冷寒凉', 食疗: '汤圆、桂圆粥、羊肉', 起居: '早睡晚起，养藏精气'},
  '小寒': {宜: '温补驱寒', 忌: '寒凉生冷', 食疗: '羊肉、桂圆、核桃', 起居: '早睡晚起，注意保暖'},
  '大寒': {宜: '温补养肾', 忌: '油腻辛辣', 食疗: '黑豆、核桃、栗子', 起居: '防寒保暖，适度运动'}
}

Page({
  data: {
    statusBarHeight: 0,
    safeAreaBottom: 0,
    currentDate: '',
    currentMonth: 0,
    currentYear: 0,
    daysInMonth: 0,
    calendarDays: [],
    selectedDate: null,
    
    // 今日推荐
    todayRecommend: {
      breakfast: '',
      lunch: '',
      dinner: '',
      snack: ''
    },
    
    // 节气信息
    solarTerm: '',
    termTips: {},
    
    // 健康提示
    healthTips: [
      { type: 'season', title: '顺应节气', desc: '根据当前节气调整饮食' },
      { type: 'warning', title: '注意事项', desc: '避免生冷寒凉食物' },
      { type: 'knowledge', title: '药食同源', desc: '了解食材的性味归经' }
    ],
    
    // 已记录食谱
    savedMenus: [],
    
    loading: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '饮食日历' })
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      safeAreaBottom: systemInfo.safeArea?.bottom || 0
    })
    
    const now = new Date()
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth(),
      currentDate: this.formatDate(now)
    })
    
    this.initCalendar()
    this.loadTodayData()
    this.checkSolarTerm()
  },

  onShow() {
    this.loadTodayData()
    this.checkSolarTerm()
  },

  // ==================== 日历相关 ====================
  
  initCalendar() {
    const year = this.data.currentYear
    const month = this.data.currentMonth
    
    // 获取当月第一天是周几 (0=周日, 6=周六)
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()
    
    // 获取当月天数
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    
    // 获取上月天数
    const prevMonthDays = new Date(year, month, 0).getDate()
    
    const calendarDays = []
    const today = new Date()
    
    // 上个月的日期
    for (let i = firstDayOfWeek; i > 0; i--) {
      calendarDays.push({
        day: prevMonthDays - i + 1,
        month: month - 1,
        year: year,
        isCurrentMonth: false,
        isToday: false,
        hasData: false
      })
    }
    
    // 本月的日期
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      calendarDays.push({
        day,
        month,
        year,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        hasData: this.hasSavedMenu(year, month, day)
      })
    }
    
    // 下个月的日期补齐
    const remaining = 42 - calendarDays.length
    for (let day = 1; day <= remaining; day++) {
      calendarDays.push({
        day,
        month: month + 1,
        year: month === 11 ? year + 1 : year,
        isCurrentMonth: false,
        isToday: false,
        hasData: false
      })
    }
    
    this.setData({ daysInMonth, calendarDays })
  },

  hasSavedMenu(year, month, day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const saved = wx.getStorageSync('saved_menus') || []
    return saved.some(m => m.date === dateStr)
  },

  switchMonth(e) {
    const type = e.currentTarget.dataset.type
    let { currentYear, currentMonth } = this.data
    
    if (type === 'prev') {
      currentMonth--
      if (currentMonth < 0) {
        currentMonth = 11
        currentYear--
      }
    } else {
      currentMonth++
      if (currentMonth > 11) {
        currentMonth = 0
        currentYear++
      }
    }
    
    this.setData({ currentYear, currentMonth })
    this.initCalendar()
  },

  onDateTap(e) {
    const { day, month, year, isCurrentMonth } = e.currentTarget.dataset
    const date = new Date(year, month, day)
    const dateStr = this.formatDate(date)
    
    this.setData({ selectedDate: dateStr })
    this.loadDateMenu(year, month, day)
  },

  formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  },

  // ==================== 数据加载 ====================
  
  async loadTodayData() {
    this.setData({ loading: true })
    try {
      const recommend = await api.meal.getTodayRecommend()
      this.setData({ todayRecommend: recommend })
    } catch (e) {
      // 使用本地默认数据
      const now = new Date()
      const weekday = now.getDay()
      this.setData({ todayRecommend: MEAL_TEMPLATES[weekday] || MEAL_TEMPLATES[0] })
    }
    this.setData({ loading: false })
  },

  async loadDateMenu(year, month, day) {
    wx.showLoading({ title: '加载中...' })
    try {
      const menu = await api.meal.getDateMenu(year, month, day)
      this.setData({ 
        todayRecommend: menu,
        selectedDate: this.formatDate(new Date(year, month, day))
      })
    } catch (e) {
      const weekday = new Date(year, month, day).getDay()
      this.setData({ todayRecommend: MEAL_TEMPLATES[weekday] || MEAL_TEMPLATES[0] })
    }
    wx.hideLoading()
  },

  // ==================== 节气相关 ====================
  
  checkSolarTerm() {
    const now = new Date()
    const month = now.getMonth() + 1
    const day = now.getDate()
    
    let currentTerm = '立春'
    for (const term of SOLAR_TERMS) {
      if (month === term.start[0] && day >= term.start[1]) {
        currentTerm = term.name
      } else if (month === term.end[0] && day <= term.end[1]) {
        currentTerm = term.name
        break
      }
    }
    
    // 重新精确判断
    for (const term of SOLAR_TERMS) {
      if (term.name === '冬至') {
        // 冬至跨月处理
        if ((month === 12 && day >= 21) || (month === 1 && day <= 5)) {
          currentTerm = '冬至'
          break
        }
      } else if ((month === term.start[0] && day >= term.start[1]) || 
                 (month === term.end[0] && day <= term.end[1])) {
        currentTerm = term.name
        break
      }
    }
    
    const tips = TERM_TIPS[currentTerm] || TERM_TIPS['立春']
    this.setData({ 
      solarTerm: currentTerm,
      termTips: tips 
    })
  },

  // ==================== 菜单操作 ====================
  
  saveMenu() {
    const { todayRecommend, selectedDate } = this.data
    const dateStr = selectedDate || this.formatDate(new Date())
    
    const saved = wx.getStorageSync('saved_menus') || []
    const existingIndex = saved.findIndex(m => m.date === dateStr)
    
    const menuEntry = {
      date: dateStr,
      ...todayRecommend,
      solarTerm: this.data.solarTerm,
      savedAt: Date.now()
    }
    
    if (existingIndex >= 0) {
      saved[existingIndex] = menuEntry
    } else {
      saved.push(menuEntry)
    }
    
    wx.setStorageSync('saved_menus', saved)
    wx.showToast({ title: '已保存', icon: 'success' })
    this.initCalendar()
  },

  viewSavedMenu(e) {
    const date = e.currentTarget.dataset.date
    const saved = wx.getStorageSync('saved_menus') || []
    const menu = saved.find(m => m.date === date)
    
    if (menu) {
      wx.showModal({
        title: `${date} 饮食记录`,
        content: `早餐: ${menu.breakfast}\n午餐: ${menu.lunch}\n晚餐: ${menu.dinner}\n加餐: ${menu.snack}`,
        showCancel: false
      })
    }
  },

  // ==================== 下拉刷新 ====================
  
  onPullDownRefresh() {
    this.loadTodayData().then(() => {
      this.checkSolarTerm()
      wx.stopPullDownRefresh()
    })
  },

  // ==================== 导航操作 ====================
  
  goToSettings() {
    wx.navigateTo({ url: '/pages/settings/index' })
  },

  goToProfile() {
    wx.navigateTo({ url:"/pages/profile/index/index" })
  },

  // ==================== 分享 ====================
  
  onShareAppMessage() {
    return {
      title: `RMFOOD - ${this.data.solarTerm || ''}饮食建议`,
      path: '/pages/calendar/index'
    }
  }
})
