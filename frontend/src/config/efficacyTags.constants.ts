/**
 * 功效标签预置数据常量
 *
 * 提供 50+ 个预置功效标签及其元数据，按分类树形结构组织。
 */

import type {
  EfficacyTag,
  TagCategory,
  EfficacyTagMeta,
  TagCategoryNode,
} from '@/types/efficacyTag.types'

// ==================== 标签元数据完整列表 ====================

/**
 * 预置功效标签元数据
 * 包含所有标签的详细属性信息
 */
export const EFFICACY_TAG_METADATA: EfficacyTagMeta[] = [
  // ===== 免疫调节类 =====
  {
    name: '增强免疫',
    category: 'immune',
    description: '增强机体免疫功能，提高抗病能力',
    keywords: ['免疫', '抵抗力', '防御'],
    relatedIngredients: ['人参', '黄芪', '灵芝', '枸杞'],
    evidenceLevel: 'strong',
    targetAudience: ['免疫力低下人群', '老年人', '术后恢复者'],
  },
  {
    name: '补气养血',
    category: 'immune',
    description: '补充气血，改善气血不足症状',
    keywords: ['气血', '贫血', '乏力'],
    relatedIngredients: ['当归', '熟地黄', '白芍', '川芎'],
    evidenceLevel: 'strong',
    targetAudience: ['气血不足者', '女性', '产后调理'],
  },
  {
    name: '益气固表',
    category: 'immune',
    description: '益气固表止汗，增强体表卫外功能',
    keywords: ['固表', '自汗', '易感冒'],
    relatedIngredients: ['黄芪', '白术', '防风'],
    evidenceLevel: 'moderate',
  },
  {
    name: '补血活血',
    category: 'immune',
    description: '补血养血，活血化瘀',
    keywords: ['补血', '活血', '瘀血'],
    relatedIngredients: ['当归', '丹参', '红花', '桃仁'],
    evidenceLevel: 'strong',
  },

  // ===== 抗氧化类 =====
  {
    name: '抗氧化',
    category: 'antioxidant',
    description: '清除自由基，延缓细胞氧化损伤',
    keywords: ['自由基', '抗氧化', '清除'],
    relatedIngredients: ['维生素C', '维生素E', '葡萄籽', '番茄红素'],
    evidenceLevel: 'strong',
  },
  {
    name: '延缓衰老',
    category: 'anti_aging',
    description: '延缓机体衰老进程，延长健康寿命',
    keywords: ['抗衰老', '长寿', '年轻'],
    relatedIngredients: ['灵芝', '人参', '何首乌', '枸杞'],
    evidenceLevel: 'moderate',
  },

  // ===== 心血管保护类 =====
  {
    name: '降血压',
    category: 'cardiovascular',
    description: '降低血压，维持血压稳定',
    keywords: ['高血压', '降压', '血压'],
    relatedIngredients: ['杜仲', '钩藤', '夏枯草', '菊花'],
    evidenceLevel: 'moderate',
    contraindications: ['低血压患者慎用'],
  },
  {
    name: '调节血脂',
    category: 'cardiovascular',
    description: '调节血脂代谢，降低胆固醇和甘油三酯',
    keywords: ['血脂', '胆固醇', '甘油三酯'],
    relatedIngredients: ['山楂', '决明子', '何首乌', '泽泻'],
    evidenceLevel: 'moderate',
  },
  {
    name: '保护心血管',
    category: 'cardiovascular',
    description: '保护心脏和血管健康，预防心血管疾病',
    keywords: ['心血管', '心脏', '血管'],
    relatedIngredients: ['丹参', '三七', '银杏叶', '葛根'],
    evidenceLevel: 'strong',
  },

  // ===== 代谢调节类 =====
  {
    name: '降血糖',
    category: 'metabolic',
    description: '降低血糖水平，辅助血糖管理',
    keywords: ['血糖', '糖尿病', '降糖'],
    relatedIngredients: ['苦瓜', '山药', '黄芪', '地骨皮'],
    evidenceLevel: 'moderate',
    contraindications: ['低血糖患者慎用'],
  },
  {
    name: '降脂减肥',
    category: 'metabolic',
    description: '促进脂肪代谢，帮助体重管理',
    keywords: ['减肥', '减脂', '瘦身'],
    relatedIngredients: ['荷叶', '山楂', '决明子', '茯苓'],
    evidenceLevel: 'weak',
  },

  // ===== 消化系统类 =====
  {
    name: '健脾益胃',
    category: 'digestive',
    description: '健运脾胃，促进消化吸收功能',
    keywords: ['脾胃', '消化', '食欲'],
    relatedIngredients: ['山药', '茯苓', '白术', '陈皮'],
    evidenceLevel: 'strong',
  },
  {
    name: '促进消化',
    category: 'digestive',
    description: '促进胃肠蠕动，改善消化功能',
    keywords: ['消化', '肠胃', '蠕动'],
    relatedIngredients: ['山楂', '麦芽', '鸡内金', '神曲'],
    evidenceLevel: 'strong',
  },
  {
    name: '调和脾胃',
    category: 'digestive',
    description: '调和脾胃气机，恢复脾胃正常功能',
    keywords: ['调和', '脾胃不和'],
    relatedIngredients: ['陈皮', '半夏', '甘草', '大枣'],
    evidenceLevel: 'moderate',
  },
  {
    name: '涩肠止泻',
    category: 'digestive',
    description: '涩肠固脱，治疗久泻久痢',
    keywords: ['腹泻', '止泻', '痢疾'],
    relatedIngredients: ['五味子', '乌梅', '肉豆蔻', '罂粟壳'],
    evidenceLevel: 'moderate',
    contraindications: ['实热积滞者禁用'],
  },
  {
    name: '生津止渴',
    category: 'digestive',
    description: '生津液，止烦渴',
    keywords: ['口渴', '生津', '消渴'],
    relatedIngredients: ['天花粉', '麦冬', '石斛', '芦根'],
    evidenceLevel: 'moderate',
  },

  // ===== 神经系统类 =====
  {
    name: '安神',
    category: 'nervous',
    description: '安神定志，缓解焦虑烦躁',
    keywords: ['安神', '焦虑', '心烦'],
    relatedIngredients: ['酸枣仁', '柏子仁', '远志', '合欢皮'],
    evidenceLevel: 'strong',
  },
  {
    name: '宁心安神',
    category: 'nervous',
    description: '宁心安神，治疗心神不宁',
    keywords: ['心神不宁', '失眠多梦'],
    relatedIngredients: ['龙眼肉', '茯苓', '莲子', '百合'],
    evidenceLevel: 'moderate',
  },
  {
    name: '聪耳明目',
    category: 'nervous',
    description: '聪耳明目，改善视听功能',
    keywords: ['视力', '听力', '眼睛'],
    relatedIngredients: ['枸杞', '菊花', '决明子', '菟丝子'],
    evidenceLevel: 'moderate',
  },

  // ===== 助眠安神类 =====
  {
    name: '改善睡眠',
    category: 'sleep',
    description: '改善睡眠质量，缩短入睡时间',
    keywords: ['睡眠', '失眠', '入睡'],
    relatedIngredients: ['酸枣仁', '夜交藤', '合欢花', '珍珠母'],
    evidenceLevel: 'strong',
  },

  // ===== 能量补充类 =====
  {
    name: '抗疲劳',
    category: 'energy',
    description: '抗疲劳，提升体力精力',
    keywords: ['疲劳', '乏力', '精力'],
    relatedIngredients: ['人参', '红景天', '玛咖', '刺五加'],
    evidenceLevel: 'strong',
  },

  // ===== 美容养颜类 =====
  {
    name: '美容养颜',
    category: 'beauty',
    description: '美容润肤，延缓皮肤衰老',
    keywords: ['美容', '护肤', '容颜'],
    relatedIngredients: ['珍珠', '白芷', '当归', '红花'],
    evidenceLevel: 'moderate',
  },
  {
    name: '乌须发',
    category: 'beauty',
    description: '乌须黑发，改善白发问题',
    keywords: ['白发', '脱发', '头发'],
    relatedIngredients: ['何首乌', '墨旱莲', '女贞子', '桑椹'],
    evidenceLevel: 'weak',
  },

  // ===== 肝肾养护类 =====
  {
    name: '护肝',
    category: 'liver_kidney',
    description: '保护肝脏，促进肝细胞修复',
    keywords: ['护肝', '肝脏', '转氨酶'],
    relatedIngredients: ['柴胡', '茵陈', '五味子', '垂盆草'],
    evidenceLevel: 'moderate',
  },
  {
    name: '补肾壮阳',
    category: 'liver_kidney',
    description: '补肾阳，强腰膝',
    keywords: ['补肾', '阳虚', '腰膝酸软'],
    relatedIngredients: ['淫羊藿', '肉苁蓉', '锁阳', '巴戟天'],
    evidenceLevel: 'moderate',
    contraindications: ['阴虚火旺者慎用'],
  },

  // ===== 骨关节健康类 =====
  {
    name: '强筋健骨',
    category: 'bone_joint',
    description: '强壮筋骨，改善骨质疏松',
    keywords: ['骨骼', '关节', '骨质疏松'],
    relatedIngredients: ['杜仲', '续断', '骨碎补', '淫羊藿'],
    evidenceLevel: 'moderate',
  },

  // ===== 呼吸系统类 =====
  {
    name: '止咳化痰',
    category: 'respiratory',
    description: '止咳祛痰，缓解咳嗽咳痰症状',
    keywords: ['咳嗽', '痰', '止咳'],
    relatedIngredients: ['桔梗', '川贝母', '半夏', '杏仁'],
    evidenceLevel: 'strong',
  },
  {
    name: '润肺止咳',
    category: 'respiratory',
    description: '润肺燥，治干咳',
    keywords: ['干咳', '肺燥', '咽干'],
    relatedIngredients: ['川贝母', '百合', '麦冬', '沙参'],
    evidenceLevel: 'strong',
  },

  // ===== 清热解毒类 =====
  {
    name: '清热解毒',
    category: 'other',
    description: '清热泻火解毒，用于热毒病症',
    keywords: ['清热', '解毒', '火毒'],
    relatedIngredients: ['金银花', '连翘', '蒲公英', '板蓝根'],
    evidenceLevel: 'strong',
    contraindications: ['脾胃虚寒者慎用'],
  },
  {
    name: '抗炎',
    category: 'other',
    description: '抗炎消肿，减轻炎症反应',
    keywords: ['消炎', '炎症', '肿胀'],
    relatedIngredients: ['黄芩', '黄连', '黄柏', '苦参'],
    evidenceLevel: 'strong',
  },
  {
    name: '祛风除湿',
    category: 'other',
    description: '祛风除湿，通络止痛',
    keywords: ['风湿', '关节痛', '痹症'],
    relatedIngredients: ['独活', '威灵仙', '秦艽', '防己'],
    evidenceLevel: 'moderate',
  },
  {
    name: '活血化瘀',
    category: 'other',
    description: '活血行瘀，消散瘀血',
    keywords: ['瘀血', '肿块', '疼痛'],
    relatedIngredients: ['丹参', '三七', '红花', '桃仁'],
    evidenceLevel: 'strong',
    contraindications: ['孕妇禁用', '出血倾向者慎用'],
  },
  {
    name: '利水消肿',
    category: 'other',
    description: '利水渗湿，消除水肿',
    keywords: ['水肿', '利尿', '腹水'],
    relatedIngredients: ['茯苓', '猪苓', '泽泻', '薏苡仁'],
    evidenceLevel: 'strong',
  },
  {
    name: '收敛固涩',
    category: 'other',
    description: '收敛固脱，用于滑脱诸证',
    keywords: ['收敛', '固涩', '滑脱'],
    relatedIngredients: ['五味子', '山茱萸', '桑螵蛸', '金樱子'],
    evidenceLevel: 'moderate',
  },
  {
    name: '温中散寒',
    category: 'other',
    description: '温中散寒止痛，用于里寒证',
    keywords: ['胃寒', '腹痛', '畏寒'],
    relatedIngredients: ['干姜', '附子', '肉桂', '吴茱萸'],
    evidenceLevel: 'strong',
    contraindications: ['阴虚内热者禁用'],
  },
  {
    name: '疏肝理气',
    category: 'other',
    description: '疏肝解郁，理气和胃',
    keywords: ['肝郁', '情绪', '胀痛'],
    relatedIngredients: ['柴胡', '香附', '青皮', '郁金'],
    evidenceLevel: 'moderate',
  },
  {
    name: '滋阴润燥',
    category: 'other',
    description: '滋阴生津，润燥除烦',
    keywords: ['阴虚', '干燥', '口干'],
    relatedIngredients: ['麦冬', '天冬', '玉竹', '石斛'],
    evidenceLevel: 'moderate',
  },
  {
    name: '抗肿瘤',
    category: 'other',
    description: '抑制肿瘤生长，辅助肿瘤治疗',
    keywords: ['肿瘤', '抗癌', '抑制'],
    relatedIngredients: ['白花蛇舌草', '半枝莲', '薏苡仁', '灵芝'],
    evidenceLevel: 'weak',
  },
  {
    name: '抗病毒',
    category: 'other',
    description: '抗病毒感染，增强抗病毒能力',
    keywords: ['病毒', '抗病毒', '感染'],
    relatedIngredients: ['板蓝根', '金银花', '连翘', '大青叶'],
    evidenceLevel: 'moderate',
  },
  {
    name: '抗菌',
    category: 'other',
    description: '抗菌消炎，抑制细菌生长',
    keywords: ['细菌', '抗菌', '感染'],
    relatedIngredients: ['黄连', '黄芩', '金银花', '蒲公英'],
    evidenceLevel: 'strong',
  },
  {
    name: '抗过敏',
    category: 'other',
    description: '抗过敏反应，缓解过敏症状',
    keywords: ['过敏', '荨麻疹', '瘙痒'],
    relatedIngredients: ['防风', '蝉蜕', '荆芥', '地肤子'],
    evidenceLevel: 'moderate',
  },
  {
    name: '保胎',
    category: 'other',
    description: '固肾安胎，防治流产',
    keywords: ['保胎', '安胎', '流产'],
    relatedIngredients: ['菟丝子', '续断', '桑寄生', '阿胶'],
    evidenceLevel: 'moderate',
  },
  {
    name: '通乳',
    category: 'other',
    description: '通经下乳，促进乳汁分泌',
    keywords: ['通乳', '下奶', '乳汁'],
    relatedIngredients: ['王不留行', '穿山甲', '通草', '路路通'],
    evidenceLevel: 'moderate',
  },
  {
    name: '驱虫',
    category: 'other',
    description: '驱杀肠道寄生虫',
    keywords: ['驱虫', '蛔虫', '蛲虫'],
    relatedIngredients: ['使君子', '苦楝皮', '槟榔', '南瓜子'],
    evidenceLevel: 'strong',
  },
  {
    name: '解表散寒',
    category: 'other',
    description: '发散风寒，解除表寒证',
    keywords: ['感冒', '发热', '恶寒'],
    relatedIngredients: ['麻黄', '桂枝', '生姜', '紫苏'],
    evidenceLevel: 'strong',
  },
  {
    name: '和解少阳',
    category: 'other',
    description: '和解少阳，用于半表半里证',
    keywords: ['少阳', '寒热往来', '口苦'],
    relatedIngredients: ['柴胡', '黄芩', '半夏', '甘草'],
    evidenceLevel: 'strong',
  },
]

// ==================== 标签分类树形结构 ====================

/**
 * 功效标签分类树
 * 用于层级化展示和管理标签
 */
export const EFFICACY_TAG_CATEGORY_TREE: TagCategoryNode[] = [
  {
    id: 'cat_immune',
    name: '免疫调节',
    category: 'immune',
    icon: 'Shield',
    color: '#1890ff',
    tags: ['增强免疫', '补气养血', '益气固表', '补血活血'],
    order: 1,
  },
  {
    id: 'cat_antioxidant',
    name: '抗氧化',
    category: 'antioxidant',
    icon: 'Sparkles',
    color: '#722ed1',
    tags: ['抗氧化'],
    order: 2,
  },
  {
    id: 'cat_cardiovascular',
    name: '心血管保护',
    category: 'cardiovascular',
    icon: 'Heart',
    color: '#f5222d',
    tags: ['降血压', '调节血脂', '保护心血管'],
    order: 3,
  },
  {
    id: 'cat_metabolic',
    name: '代谢调节',
    category: 'metabolic',
    icon: 'Activity',
    color: '#fa8c16',
    tags: ['降血糖', '降脂减肥'],
    order: 4,
  },
  {
    id: 'cat_digestive',
    name: '消化系统',
    category: 'digestive',
    icon: 'Stomach',
    color: '#52c41a',
    tags: ['健脾益胃', '促进消化', '调和脾胃', '涩肠止泻', '生津止渴'],
    order: 5,
  },
  {
    id: 'cat_nervous',
    name: '神经系统',
    category: 'nervous',
    icon: 'Brain',
    color: '#13c2c2',
    tags: ['安神', '宁心安神', '聪耳明目'],
    order: 6,
  },
  {
    id: 'cat_sleep',
    name: '助眠安神',
    category: 'sleep',
    icon: 'Moon',
    color: '#2f54eb',
    tags: ['改善睡眠'],
    order: 7,
  },
  {
    id: 'cat_energy',
    name: '能量补充',
    category: 'energy',
    icon: 'Zap',
    color: '#faad14',
    tags: ['抗疲劳'],
    order: 8,
  },
  {
    id: 'cat_beauty',
    name: '美容养颜',
    category: 'beauty',
    icon: 'Star',
    color: '#eb2f96',
    tags: ['美容养颜', '乌须发'],
    order: 9,
  },
  {
    id: 'cat_liver_kidney',
    name: '肝肾养护',
    category: 'liver_kidney',
    icon: 'Leaf',
    color: '#a0d911',
    tags: ['护肝', '补肾壮阳'],
    order: 10,
  },
  {
    id: 'cat_bone_joint',
    name: '骨关节健康',
    category: 'bone_joint',
    icon: 'Bone',
    color: '#597ef7',
    tags: ['强筋健骨'],
    order: 11,
  },
  {
    id: 'cat_respiratory',
    name: '呼吸系统',
    category: 'respiratory',
    icon: 'Wind',
    color: '#36cfc9',
    tags: ['止咳化痰', '润肺止咳'],
    order: 12,
  },
  {
    id: 'cat_other',
    name: '其他',
    category: 'other',
    icon: 'MoreHorizontal',
    color: '#8c8c8c',
    tags: [
      '清热解毒', '抗炎', '祛风除湿', '活血化瘀', '利水消肿',
      '收敛固涩', '温中散寒', '疏肝理气', '滋阴润燥',
      '抗肿瘤', '抗病毒', '抗菌', '抗过敏', '保胎', '通乳',
      '驱虫', '解表散寒', '和解少阳',
    ],
    order: 13,
  },
]

// ==================== 工具函数 ====================

/**
 * 根据标签名获取标签元数据
 */
export function getEfficacyTagMeta(tagName: EfficacyTag): EfficacyTagMeta | undefined {
  return EFFICACY_TAG_METADATA.find((meta) => meta.name === tagName)
}

/**
 * 根据分类获取该分类下的所有标签
 */
export function getTagsByCategory(category: TagCategory): EfficacyTag[] {
  return EFFICACY_TAG_METADATA
    .filter((meta) => meta.category === category)
    .map((meta) => meta.name)
}

/**
 * 搜索匹配的关键词标签
 */
export function searchTagsByKeyword(keyword: string): EfficacyTagMeta[] {
  const lowerKeyword = keyword.toLowerCase()
  return EFFICACY_TAG_METADATA.filter(
    (meta) =>
      meta.name.includes(keyword) ||
      meta.keywords.some((k) => k.includes(lowerKeyword)) ||
      meta.description.includes(keyword),
  )
}
