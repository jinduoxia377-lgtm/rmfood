/**
 * 注意事项预置数据常量
 *
 * 提供 30+ 条预置注意事项，包含触发条件、严重程度等详细信息。
 */

import type {
  Precaution,
  PrecautionCategory,
  PrecautionSeverity,
  TriggerCondition,
} from '@/types/ai.types'

// ==================== 预置注意事项列表 ====================

/**
 * 预置注意事项数据
 * 包含常见成分使用的注意事项及触发条件
 */
export const PRECAUTIONS_DATA: Precaution[] = [
  // ===== 孕期禁忌 =====
  {
    category: 'contraindication',
    content: '孕妇禁用，可能引起子宫收缩导致流产',
    severity: 'critical',
    triggerConditions: [
      {
        type: 'condition',
        description: '妊娠期女性',
        value: 'pregnant',
        isHardLimit: true,
      },
    ],
    reference: '《中国药典》2020版',
    recommendation: '立即停用并咨询医生',
  },
  {
    category: 'contraindication',
    content: '孕妇慎用，需在医生指导下使用',
    severity: 'high',
    triggerConditions: [
      {
        type: 'condition',
        description: '妊娠期女性',
        value: 'pregnant',
        isHardLimit: false,
      },
    ],
    recommendation: '使用前咨询专业医师',
  },
  {
    category: 'pregnancy',
    content: '哺乳期妇女慎用，药物成分可能通过乳汁影响婴儿',
    severity: 'medium',
    triggerConditions: [
      {
        type: 'condition',
        description: '哺乳期女性',
        value: 'lactating',
        isHardLimit: false,
      },
    ],
    recommendation: '建议暂停哺乳或更换替代方案',
  },

  // ===== 特殊人群 =====
  {
    category: 'special_pop',
    content: '儿童不宜使用，可能影响生长发育',
    severity: 'high',
    triggerConditions: [
      {
        type: 'age_range',
        description: '18岁以下未成年人',
        value: { max: 18 },
        isHardLimit: true,
      },
    ],
    recommendation: '选择适合儿童的替代方案',
  },
  {
    category: 'special_pop',
    content: '老年人应减量使用，肝肾功能减退可能影响药物代谢',
    severity: 'medium',
    triggerConditions: [
      {
        type: 'age_range',
        description: '65岁以上老年人',
        value: { min: 65 },
        isHardLimit: false,
      },
    ],
    recommendation: '建议从标准剂量的1/2-2/3开始使用',
  },
  {
    category: 'special_pop',
    content: '肝功能不全者慎用，加重肝脏负担',
    severity: 'high',
    triggerConditions: [
      {
        type: 'condition',
        description: '肝功能异常（ALT/AST升高）',
        value: 'liver_dysfunction',
        isHardLimit: false,
      },
    ],
    recommendation: '定期监测肝功能指标',
  },
  {
    category: 'special_pop',
    content: '肾功能不全者需调整剂量，避免蓄积中毒',
    severity: 'high',
    triggerConditions: [
      {
        type: 'condition',
        description: '肾功能异常（肌酐升高）',
        value: 'kidney_dysfunction',
        isHardLimit: false,
      },
    ],
    recommendation: '根据肌酐清除率调整剂量',
  },

  // ===== 用量注意 =====
  {
    category: 'dosage',
    content: '超量使用可能导致中毒反应',
    severity: 'critical',
    triggerConditions: [
      {
        type: 'dosage_exceed',
        description: '超过最大日用量',
        value: 10,
        isHardLimit: true,
      },
    ],
    reference: '《中国药典》规定最大日用量',
    recommendation: '严格控制用量，出现不适立即就医',
  },
  {
    category: 'dosage',
    content: '长期大量使用可能导致依赖性',
    severity: 'medium',
    triggerConditions: [
      {
        type: 'duration',
        description: '连续使用超过3个月',
        value: 90,
        isHardLimit: false,
      },
    ],
    recommendation: '建议间歇使用，每使用2周休息1周',
  },
  {
    category: 'dosage',
    content: '空腹服用可能刺激胃肠道',
    severity: 'low',
    triggerConditions: [],
    recommendation: '建议饭后30分钟服用',
  },

  // ===== 过敏风险 =====
  {
    category: 'allergy',
    content: '对本品及所含成分过敏者禁用',
    severity: 'critical',
    triggerConditions: [
      {
        type: 'condition',
        description: '已知对该成分过敏',
        value: 'allergic',
        isHardLimit: true,
      },
    ],
    recommendation: '首次使用者应从小剂量开始观察',
  },
  {
    category: 'allergy',
    content: '花粉过敏者慎用，可能引起交叉过敏反应',
    severity: 'medium',
    triggerConditions: [
      {
        type: 'condition',
        description: '花粉过敏史',
        value: 'pollen_allergy',
        isHardLimit: false,
      },
    ],
    recommendation: '如出现皮疹、瘙痒等立即停药',
  },

  // ===== 警告/慎用 =====
  {
    category: 'warning',
    content: '高血压患者慎用，可能导致血压波动',
    severity: 'medium',
    triggerConditions: [
      {
        type: 'condition',
        description: '高血压病史（收缩压>140mmHg）',
        value: 'hypertension',
        isHardLimit: false,
      },
    ],
    recommendation: '定期监测血压，必要时调整方案',
  },
  {
    category: 'warning',
    content: '糖尿病患者慎用，可能影响血糖控制',
    severity: 'medium',
    triggerConditions: [
      {
        type: 'condition',
        description: '糖尿病史（空腹血糖>7.0mmol/L）',
        value: 'diabetes',
        isHardLimit: false,
      },
    ],
    recommendation: '密切监测血糖变化',
  },
  {
    category: 'warning',
    content: '正在服用抗凝药物者慎用，可能增加出血风险',
    severity: 'high',
    triggerConditions: [
      {
        type: 'combination',
        description: '同时使用华法林、阿司匹林等抗凝药',
        value: 'anticoagulant',
        isHardLimit: false,
      },
    ],
    recommendation: '监测凝血指标（INR），必要时调整抗凝药剂量',
  },
  {
    category: 'warning',
    content: '低血压患者慎用，可能进一步降低血压',
    severity: 'medium',
    triggerConditions: [
      {
        type: 'condition',
        description: '低血压（收缩压<90mmHg）',
        value: 'hypotension',
        isHardLimit: false,
      },
    ],
    recommendation: '监测血压，避免突然站立',
  },
  {
    category: 'warning',
    content: '阴虚火旺者慎用，可能加重上火症状',
    severity: 'low',
    triggerConditions: [
      {
        type: 'condition',
        description: '阴虚体质（口干舌燥、手足心热）',
        value: 'yin_deficiency',
        isHardLimit: false,
      },
    ],
    recommendation: '配合滋阴药物使用',
  },
  {
    category: 'warning',
    content: '脾胃虚寒者慎用，可能加重腹泻腹胀',
    severity: 'low',
    triggerConditions: [
      {
        type: 'condition',
        description: '脾虚体质（便溏、纳差）',
        value: 'spleen_deficiency',
        isHardLimit: false,
      },
    ],
    recommendation: '饭后服用或配合健脾药物',
  },

  // ===== 药物相互作用 =====
  {
    category: 'interaction',
    content: '与西药降压药同用时需密切监测血压',
    severity: 'high',
    triggerConditions: [
      {
        type: 'combination',
        description: '同时使用降压药（ACEI/ARB/CCB等）',
        value: 'antihypertensive',
        isHardLimit: false,
      },
    ],
    recommendation: '分时段服用，间隔至少2小时',
  },
  {
    category: 'interaction',
    content: '可能与降糖药产生协同作用，警惕低血糖',
    severity: 'high',
    triggerConditions: [
      {
        type: 'combination',
        description: '同时使用降糖药（二甲双胍/胰岛素等）',
        value: 'hypoglycemic',
        isHardLimit: false,
      },
    ],
    recommendation: '加强血糖监测，随身携带糖果',
  },
  {
    category: 'interaction',
    content: '可能与镇静催眠药产生叠加作用',
    severity: 'medium',
    triggerConditions: [
      {
        type: 'combination',
        description: '同时使用苯二氮卓类或其他镇静药',
        value: 'sedative',
        isHardLimit: false,
      },
    ],
    recommendation: '避免驾驶或操作机械',
  },
  {
    category: 'interaction',
    content: '可能与抗生素相互影响吸收',
    severity: 'low',
    triggerConditions: [
      {
        type: 'combination',
        description: '同时使用四环素类/喹诺酮类抗生素',
        value: 'antibiotic',
        isHardLimit: false,
      },
    ],
    recommendation: '间隔2小时以上服用',
  },

  // ===== 其他常见注意事项 =====
  {
    category: 'warning',
    content: '服用期间忌食辛辣刺激性食物',
    severity: 'low',
    triggerConditions: [],
    recommendation: '饮食清淡，戒烟限酒',
  },
  {
    category: 'warning',
    content: '服用期间禁止饮酒，酒精可能影响药效或增加副作用',
    severity: 'medium',
    triggerConditions: [],
    recommendation: '整个疗程期间严格禁酒',
  },
  {
    category: 'warning',
    content: '服用期间避免食用萝卜（解药性）',
    severity: 'low',
    triggerConditions: [],
    recommendation: '与人参、黄芪等补气药同服时尤其注意',
  },
  {
    category: 'warning',
    content: '服用期间避免饮用浓茶和咖啡',
    severity: 'low',
    triggerConditions: [],
    recommendation: '茶咖啡与药物间隔1-2小时',
  },
  {
    category: 'dosage',
    content: '请勿自行增减剂量，遵医嘱使用',
    severity: 'medium',
    triggerConditions: [],
    recommendation: '如有疑问请咨询专业医师或药师',
  },
  {
    category: 'special_pop',
    content: '手术前2周应停止使用，可能影响凝血功能',
    severity: 'high',
    triggerConditions: [
      {
        type: 'condition',
        description: '即将进行手术',
        value: 'pre_surgery',
        isHardLimit: false,
      },
    ],
    recommendation: '提前告知麻醉医师正在使用的成分',
  },
  {
    category: 'warning',
    content: '如出现皮疹、呼吸困难等过敏反应应立即停药',
    severity: 'high',
    triggerConditions: [],
    recommendation: '严重时立即就医，可使用抗组胺药急救',
  },
  {
    category: 'dosage',
    content: '本品宜温服，过冷或过热均可能影响疗效',
    severity: 'low',
    triggerConditions: [],
    recommendation: '加热至35-40℃后服用',
  },
]

// ==================== 严重程度配置 ====================

/**
 * 严重程度显示配置
 */
export const SEVERITY_CONFIG: Record<
  PrecautionSeverity,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  critical: {
    label: '禁忌',
    color: '#cf1322',
    bgColor: '#fff1f0',
    icon: 'AlertOctagon',
  },
  high: {
    label: '高危',
    color: '#f5222d',
    bgColor: '#fff1f0',
    icon: 'AlertTriangle',
  },
  medium: {
    label: '警告',
    color: '#fa8c16',
    bgColor: '#fff7e6',
    icon: 'AlertCircle',
  },
  low: {
    label: '提示',
    color: '#1890ff',
    bgColor: '#e6f7ff',
    icon: 'Info',
  },
}

/**
 * 分类显示配置
 */
export const PRECAUTION_CATEGORY_CONFIG: Record<
  PrecautionCategory,
  { label: string; color: string }
> = {
  contraindication: { label: '禁忌症', color: '#cf1322' },
  warning: { label: '警告', color: '#fa8c16' },
  dosage: { label: '用量注意', color: '#1890ff' },
  interaction: { label: '药物相互作用', color: '#722ed1' },
  pregnancy: { label: '孕期相关', color: '#eb2f96' },
  allergy: { label: '过敏风险', color: '#faad14' },
  special_pop: { label: '特殊人群', color: '#13c2c2' },
}

// ==================== 工具函数 ====================

/**
 * 根据条件筛选适用的注意事项
 */
export function filterPrecautionsByContext(context: {
  age?: number
  conditions?: string[]
  medications?: string[]
  isPregnant?: boolean
  isLactating?: boolean
}): Precaution[] {
  return PRECAUTIONS_DATA.filter((precaution) => {
    if (!precaution.triggerConditions || precaution.triggerConditions.length === 0) {
      return true
    }

    return precaution.triggerConditions.some((condition) => {
      switch (condition.type) {
        case 'age_range':
          if (typeof condition.value === 'object' && context.age !== undefined) {
            if (condition.value.min !== undefined && context.age < condition.value.min) return false
            if (condition.value.max !== undefined && context.age > condition.value.max) return false
            return true
          }
          return false
        case 'condition':
          return context.conditions?.some((c) =>
            String(condition.value).includes(c) || c.includes(String(condition.value)),
          ) ?? false
        case 'combination':
          return context.medications?.some((m) =>
            String(condition.value).includes(m) || m.includes(String(condition.value)),
          ) ?? false
        default:
          return false
      }
    })
  })
}
