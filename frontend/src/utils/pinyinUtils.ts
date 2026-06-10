/**
 * 中文拼音转换工具
 * 支持中文到拼音首字母的转换，用于搜索功能
 */

// 常用汉字拼音映射表（部分常用字）
const PINYIN_MAP: Record<string, string> = {
  // A
  '阿': 'a', '安': 'an', '爱': 'ai',
  // B
  '本': 'ben', '白': 'bai', '保': 'bao', '补': 'bu', '半': 'ban', '北': 'bei', '被': 'bei', '比': 'bi', '变': 'bian', '标': 'biao', '别': 'bie', '丙': 'bing', '病': 'bing', '玻': 'bo', '博': 'bo', '不': 'bu',
  // C
  '草': 'cao', '茶': 'cha', '成': 'cheng', '虫': 'chong', '除': 'chu', '川': 'chuan', '醇': 'chun', '刺': 'ci', '从': 'cong', '促': 'cu', '醋': 'cu', '催': 'cui',
  // D
  '大': 'da', '单': 'dan', '蛋': 'dan', '当': 'dang', '刀': 'dao', '德': 'de', '的': 'di', '地': 'di', '第': 'di', '碘': 'dian', '点': 'dian', '电': 'dian', '淀': 'dian', '定': 'ding', '冬': 'dong', '动': 'dong', '毒': 'du', '度': 'du', '短': 'duan', '多': 'duo',
  // E
  '二': 'er',
  // F
  '发': 'fa', '反': 'fan', '防': 'fang', '肪': 'fang', '非': 'fei', '肥': 'fei', '分': 'fen', '粉': 'fen', '蜂': 'feng', '风': 'feng', '复': 'fu', '腐': 'fu', '富': 'fu',
  // G
  '钙': 'gai', '甘': 'gan', '肝': 'gan', '感': 'gan', '高': 'gao', '革': 'ge', '铬': 'ge', '根': 'gen', '工': 'gong', '构': 'gou', '谷': 'gu', '骨': 'gu', '固': 'gu', '瓜': 'gua', '关': 'guan', '光': 'guang', '广': 'guang', '规': 'gui', '桂': 'gui', '果': 'guo', '过': 'guo',
  // H
  '海': 'hai', '含': 'han', '汉': 'han', '和': 'he', '合': 'he', '黑': 'hei', '红': 'hong', '胡': 'hu', '湖': 'hu', '护': 'hu', '花': 'hua', '化': 'hua', '环': 'huan', '黄': 'huang', '挥': 'hui', '灰': 'hui', '回': 'hui', '活': 'huo', '火': 'huo',
  // J
  '肌': 'ji', '基': 'ji', '激': 'ji', '及': 'ji', '急': 'ji', '己': 'ji', '技': 'ji', '加': 'jia', '甲': 'jia', '钾': 'jia', '假': 'jia', '价': 'jia', '坚': 'jian', '减': 'jian', '健': 'jian', '胶': 'jiao', '角': 'jiao', '酵': 'jiao', '接': 'jie', '结': 'jie', '解': 'jie', '金': 'jin', '进': 'jin', '精': 'jing', '酒': 'jiu', '韭': 'jiu', '菊': 'ju', '聚': 'ju', '巨': 'ju', '菌': 'jun',
  // K
  '开': 'kai', '抗': 'kang', '可': 'ke', '克': 'ke', '空': 'kong', '苦': 'ku', '矿': 'kuang', '葵': 'kui',
  // L
  '拉': 'la', '辣': 'la', '来': 'lai', '兰': 'lan', '蓝': 'lan', '老': 'lao', '乐': 'le', '雷': 'lei', '冷': 'leng', '离': 'li', '梨': 'li', '李': 'li', '力': 'li', '利': 'li', '粒': 'li', '莲': 'lian', '联': 'lian', '链': 'lian', '两': 'liang', '亮': 'liang', '料': 'liao', '林': 'lin', '磷': 'lin', '灵': 'ling', '硫': 'liu', '龙': 'long', '芦': 'lu', '鲁': 'lu', '路': 'lu', '绿': 'lv', '氯': 'lv', '卵': 'luan', '罗': 'luo', '螺': 'luo',
  // M
  '麻': 'ma', '马': 'ma', '麦': 'mai', '馒': 'man', '芒': 'mang', '酶': 'mei', '镁': 'mei', '美': 'mei', '门': 'men', '蒙': 'meng', '锰': 'meng', '迷': 'mi', '蜜': 'mi', '棉': 'mian', '苗': 'miao', '明': 'ming', '模': 'mo', '摩': 'mo', '磨': 'mo', '魔': 'mo', '木': 'mu', '目': 'mu',
  // N
  '钠': 'na', '耐': 'nai', '男': 'nan', '脑': 'nao', '能': 'neng', '尼': 'ni', '尿': 'niao', '柠': 'ning', '凝': 'ning', '浓': 'nong', '女': 'nv',
  // O
  '欧': 'ou',
  // P
  '排': 'pai', '盘': 'pan', '培': 'pei', '硼': 'peng', '皮': 'pi', '脾': 'pi', '品': 'pin', '苹': 'ping', '平': 'ping',
  // Q
  '七': 'qi', '期': 'qi', '奇': 'qi', '其': 'qi', '气': 'qia', '千': 'qian', '强': 'qiang', '羟': 'qiang', '青': 'qing', '清': 'qing', '氰': 'qing', '情': 'qing', '去': 'qu', '全': 'quan', '醛': 'quan',
  // R
  '热': 're', '人': 'ren', '日': 'ri', '乳': 'ru', '软': 'ruan',
  // S
  '三': 'san', '色': 'se', '杀': 'sha', '山': 'shan', '善': 'shan', '上': 'shang', '少': 'shao', '蛇': 'she', '设': 'she', '神': 'shen', '肾': 'shen', '生': 'sheng', '失': 'shi', '十': 'shi', '石': 'shi', '食': 'shi', '实': 'shi', '适': 'shi', '视': 'shou', '受': 'shou', '蔬': 'shu', '数': 'shu', '双': 'shuang', '水': 'shui', '丝': 'si', '松': 'song', '酸': 'suan', '缩': 'suo',
  // T
  '他': 'ta', '太': 'tai', '钛': 'tai', '糖': 'tang', '特': 'te', '体': 'ti', '天': 'tian', '铁': 'tie', '通': 'tong', '铜': 'tong', '图': 'tu', '土': 'tu',
  // W
  '外': 'wan', '完': 'wan', '维': 'wei', '卫': 'wei', '味': 'wei', '胃': 'wei', '温': 'wen', '稳': 'wen', '无': 'wu', '五': 'wu', '物': 'wu',
  // X
  '西': 'xi', '吸': 'xi', '硒': 'xi', '稀': 'xi', '细': 'xi', '虾': 'xia', '纤': 'xian', '鲜': 'xian', '咸': 'xian', '香': 'xiang', '消': 'xiao', '硝': 'xiao', '小': 'xiao', '效': 'xiao', '协': 'xie', '锌': 'xin', '新': 'xin', '星': 'xing', '杏': 'xing', '性': 'xing', '熊': 'xiong', '修': 'xiu', '秀': 'xiu', '溴': 'xiu', '血': 'xue',
  // Y
  '压': 'ya', '亚': 'ya', '烟': 'yan', '盐': 'yan', '氧': 'yang', '养': 'yang', '洋': 'yang', '药': 'yao', '叶': 'ye', '一': 'yi', '胰': 'yi', '移': 'yi', '乙': 'yi', '异': 'yi', '益': 'yi', '因': 'yin', '银': 'yin', '引': 'yin', '营': 'ying', '硬': 'ying', '油': 'you', '有': 'you', '右': 'yu', '鱼': 'yu', '榆': 'yu', '余': 'yu', '预': 'yu', '元': 'yuan', '原': 'yuan', '源': 'yuan', '月': 'yue', '云': 'yun', '运': 'yun',
  // Z
  '杂': 'za', '再': 'zai', '增': 'zeng', '脂': 'zhi', '植': 'zhi', '直': 'zhi', '质': 'zhi', '治': 'zhi', '中': 'zhong', '重': 'zhong', '周': 'zhou', '猪': 'zhu', '竹': 'zhu', '主': 'zhu', '注': 'zhu', '转': 'zhuan', '装': 'zhuang', '壮': 'zhuang', '紫': 'zi', '自': 'zi', '棕': 'zong', '组': 'zu', '最': 'zui',
}

/**
 * 获取单个汉字的拼音
 */
function getCharPinyin(char: string): string {
  if (PINYIN_MAP[char]) {
    return PINYIN_MAP[char]
  }

  // 如果不在映射表中，返回字符本身（可能是英文、数字等）
  return char.toLowerCase()
}

/**
 * 将中文文本转换为拼音首字母
 * @param text - 输入的中文文本
 * @returns 拼音首字母字符串（如："抗氧化" -> "khy"）
 */
export function convertToPinyin(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  let pinyin = ''

  for (const char of text) {
    const py = getCharPinyin(char)

    // 只取每个字拼音的首字母
    if (py.length > 0) {
      pinyin += py[0]
    }
  }

  return pinyin.toLowerCase()
}

/**
 * 将中文文本转换为完整拼音
 * @param text - 输入的中文文本
 * @returns 完整拼音字符串（用空格分隔）
 */
export function convertToFullPinyin(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  let pinyin = ''

  for (const char of text) {
    const py = getCharPinyin(char)
    pinyin += py + ' '
  }

  return pinyin.trim().toLowerCase()
}

/**
 * 智能匹配：支持中文、拼音首字母、完整拼音、英文混合搜索
 * @param source - 源文本（配方名称）
 * @param query - 搜索关键词
 * @returns 是否匹配
 */
export function smartMatch(source: string, query: string): boolean {
  if (!source || !query) {
    return false
  }

  const sourceLower = source.toLowerCase().trim()
  const queryLower = query.toLowerCase().trim()

  if (sourceLower.includes(queryLower)) {
    return true
  }

  const sourcePinyinInitial = convertToPinyin(source)
  if (sourcePinyinInitial.includes(queryLower)) {
    return true
  }

  const sourceFullPinyin = convertToFullPinyin(source)
  if (sourceFullPinyin.includes(queryLower)) {
    return true
  }

  return false
}

/**
 * 高亮匹配的关键词
 * @param text - 原始文本
 * @param query - 搜索关键词
 * @returns 包含高亮标记的 JSX 元素或字符串
 */
export function highlightMatch(text: string, query: string): string {
  if (!text || !query?.trim()) {
    return text
  }

  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>')
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
