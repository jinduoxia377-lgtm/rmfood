import { IngredientSource } from '@/types/ai.types';
import type { EfficacyTag, Precaution } from '@/types/ai.types';

// 重新导出类型，方便其他模块使用
export type { IngredientSource, EfficacyTag, Precaution };

export interface IngredientDatabaseRecord {
  id: string;
  name: string;
  aliasNames: string[];
  latinName?: string;
  englishName?: string;
  source: IngredientSource;
  category: string;
  efficacyTags: EfficacyTag[];
  precautions: Precaution[];
  dosageRange?: { min: number; max: number; unit: string };
  description?: string;
  tcmcId?: string;
  dfbpId?: string;
}

export interface EnhancedIngredient {
  id: string;
  name: string;
  latinName?: string;
  amount: number;
  unit: string;
  percentage: number;
  efficacyTags: EfficacyTag[];
  precautions: Precaution[];
  source: IngredientSource;
  role?: string;
  dbMatch?: IngredientDatabaseRecord;
  matchConfidence: number;
}

const TCM_KEYWORDS = [
  '酸枣',
  '茯苓',
  '人参',
  '黄芪',
  '当归',
  '甘草',
  '枸杞',
  '山药',
  'GABA',
  'γ-氨基丁酸',
  '氨基丁酸',
  '茶氨酸',
  'L-茶氨酸',
  '褪黑素',
  '皂苷',
  '多糖',
  '黄酮',
  '生物碱',
  '苷类',
  '酚酸',
  '萜类',
  '银杏',
  '灵芝',
  '冬虫夏草',
  '西洋参',
  '丹参',
  '三七',
  '川芎',
  '白芍',
  '熟地',
  '麦冬',
  '五味子',
  '远志',
  '石菖蒲',
  '益智仁',
  '红景天',
  '绞股蓝',
  '玛咖',
  '鹿茸',
  '阿胶',
  '燕窝',
  '虫草',
];

const PEPTIDE_KEYWORDS = [
  '肽',
  '胶原肽',
  '大豆肽',
  '玉米肽',
  '鱼肽',
  '乳清肽',
  '卵白肽',
  '多肽',
  '低聚肽',
  '寡肽',
  '活性肽',
  '食源性肽',
  '生物活性肽',
  '胶原蛋白',
  '弹性蛋白',
  '角蛋白',
  '丝蛋白',
  '谷胱甘肽',
  '肌肽',
  '卡尼汀',
  '肉碱',
  '精氨酸',
  '瓜氨酸',
  '鸟氨酸',
  '赖氨酸',
  '亮氨酸',
];

const EXCIPIENT_KEYWORDS = [
  '淀粉',
  '糊精',
  '纤维素',
  '微晶',
  '二氧化硅',
  '硬脂酸',
  '滑石粉',
  '蔗糖',
  '葡萄糖',
  '麦芽糖',
  '木糖醇',
  '山梨醇',
  '甘露醇',
  '明胶',
  '阿拉伯胶',
  '黄原胶',
  '卡拉胶',
  '果胶',
  '琼脂',
  '碳酸钙',
  '磷酸钙',
  '硫酸钙',
  '氧化镁',
  '二氧化钛',
  '色素',
  '防腐剂',
  '抗氧化剂',
  '甜味剂',
  '香精',
  '香料',
  '稳定剂',
  '乳化剂',
];

export const BUILTIN_INGREDIENT_DB: IngredientDatabaseRecord[] = [
  {
    id: 'TCM-001',
    name: '酸枣仁',
    aliasNames: ['酸枣核', '枣仁', '山枣仁'],
    latinName: 'Ziziphus jujuba var. spinosa',
    englishName: 'Jujube Seed',
    source: IngredientSource.TCM,
    category: '安神助眠类',
    efficacyTags: ['改善睡眠', '安神', '保护心血管'],
    precautions: [{ category: 'warning', content: '实热郁火者慎用', severity: 'low' }],
    dosageRange: { min: 3, max: 15, unit: 'g' },
    description: '传统安神要药，含皂苷、黄酮、三萜等成分。',
    tcmcId: 'T00001',
  },
  {
    id: 'TCM-002',
    name: '茯苓',
    aliasNames: ['云苓', '茯灵', '松薯', 'Poria'],
    latinName: 'Poria cocos',
    englishName: 'Poria Mushroom',
    source: IngredientSource.TCM,
    category: '健脾利湿类',
    efficacyTags: ['增强免疫', '促进消化', '健脾益胃'],
    precautions: [{ category: 'warning', content: '阴虚而无湿热者不宜单用', severity: 'low' }],
    dosageRange: { min: 5, max: 20, unit: 'g' },
    description: '利水渗湿健脾之要药，含茯苓多糖、三萜类化合物。',
    tcmcId: 'T00002',
  },
  {
    id: 'TCM-003',
    name: 'GABA',
    aliasNames: ['γ-氨基丁酸', '氨基丁酸', 'Gamma-Aminobutyric Acid'],
    latinName: '4-Aminobutanoic acid',
    englishName: 'GABA',
    source: IngredientSource.TCM,
    category: '神经调节类',
    efficacyTags: ['改善睡眠', '安神', '抗疲劳'],
    precautions: [{ category: 'warning', content: '孕妇及哺乳期妇女慎用高剂量', severity: 'medium' }],
    dosageRange: { min: 100, max: 500, unit: 'mg' },
    description: '主要抑制性神经递质，具有镇静、抗焦虑、促睡眠作用。',
    tcmcId: 'T00003',
  },
  {
    id: 'TCM-004',
    name: 'L-茶氨酸',
    aliasNames: ['茶氨酸', 'N-乙基-L-谷氨酰胺', 'L-Theanine'],
    latinName: 'N-ethyl-L-glutamine',
    englishName: 'L-Theanine',
    source: IngredientSource.TCM,
    category: '情绪调节类',
    efficacyTags: ['安神', '延缓衰老', '增强免疫'],
    precautions: [],
    dosageRange: { min: 50, max: 200, unit: 'mg' },
    description: '茶叶特征氨基酸，可透过血脑屏障，产生α波，有放松和专注双重效果。',
    tcmcId: 'T00004',
  },
  {
    id: 'TCM-005',
    name: '褪黑素',
    aliasNames: ['美拉托宁', '松果体素', 'Melatonin', 'MLT'],
    latinName: 'N-acetyl-5-methoxytryptamine',
    englishName: 'Melatonin',
    source: IngredientSource.TCM,
    category: '节律调节类',
    efficacyTags: ['改善睡眠', '抗氧化', '延缓衰老'],
    precautions: [{ category: 'warning', content: '自身免疫性疾病患者、孕妇慎用', severity: 'medium' }],
    dosageRange: { min: 1, max: 5, unit: 'mg' },
    description: '松果体分泌的激素，调节睡眠-觉醒周期，强效抗氧化剂。',
    tcmcId: 'T00005',
  },
  {
    id: 'TCM-006',
    name: '人参皂苷',
    aliasNames: ['Ginsenoside', 'GS', '人参提取物'],
    latinName: 'Panax ginseng saponins',
    englishName: 'Ginsenosides',
    source: IngredientSource.TCM,
    category: '补气增强类',
    efficacyTags: ['增强免疫', '抗疲劳', '补气养血'],
    precautions: [{ category: 'warning', content: '高血压患者、发热期间慎用', severity: 'medium' }],
    dosageRange: { min: 50, max: 300, unit: 'mg' },
    description: '人参主要活性成分，Rg1/Rb1等单体具有抗疲劳、改善记忆、免疫调节作用。',
    tcmcId: 'T00006',
  },
  {
    id: 'TCM-007',
    name: '黄芪多糖',
    aliasNames: ['Astragalus polysaccharide', 'APS', '黄芪提取物'],
    latinName: 'Astragalus membranaceus polysaccharide',
    englishName: 'Astragalus Polysaccharide',
    source: IngredientSource.TCM,
    category: '免疫调节类',
    efficacyTags: ['增强免疫', '抗疲劳', '护肝'],
    precautions: [],
    dosageRange: { min: 100, max: 500, unit: 'mg' },
    description: '黄芪主要活性成分，增强免疫功能、抗氧化、保护肝脏。',
    tcmcId: 'T00007',
  },
  {
    id: 'TCM-008',
    name: 'γ-氨基丁酸',
    aliasNames: ['GABA', '氨基丁酸', '4-氨基丁酸'],
    latinName: '4-Aminobutyric acid',
    englishName: 'GABA',
    source: IngredientSource.TCM,
    category: '神经调节类',
    efficacyTags: ['改善睡眠', '安神', '降血压'],
    precautions: [],
    dosageRange: { min: 100, max: 300, unit: 'mg' },
    description: '中枢神经系统主要抑制性递质，参与调节睡眠、焦虑和血压。',
    tcmcId: 'T00008',
  },

  // ==================== 食源性多肽 (PEPTIDE) ====================
  {
    id: 'PEP-001',
    name: '胶原蛋白肽',
    aliasNames: ['胶原肽', '水解胶原蛋白', 'Collagen Peptide', 'CP'],
    latinName: 'Collagen hydrolysate',
    englishName: 'Collagen Peptides',
    source: IngredientSource.PEPTIDE,
    category: '结构支持类',
    efficacyTags: ['美容养颜', '保护心血管', '抗炎'],
    precautions: [],
    dosageRange: { min: 1000, max: 5000, unit: 'mg' },
    description: '动物结缔组织经酶解制得的小分子肽，富含甘氨酸-脯氨酸-羟脯氨酸序列。',
    dfbpId: 'D001',
  },
  {
    id: 'PEP-002',
    name: '大豆肽',
    aliasNames: ['Soy peptide', 'SP', '大豆蛋白肽'],
    latinName: 'Glycine max peptide',
    englishName: 'Soy Peptides',
    source: IngredientSource.PEPTIDE,
    category: '营养补充类',
    efficacyTags: ['抗疲劳', '调节血脂', '抗氧化'],
    precautions: [],
    dosageRange: { min: 500, max: 2000, unit: 'mg' },
    description: '大豆分离蛋白酶解产物，含多种生物活性肽段，具降脂、抗氧化功能。',
    dfbpId: 'D002',
  },
  {
    id: 'PEP-003',
    name: '玉米低聚肽',
    aliasNames: ['玉米肽', 'Corn peptide', 'CPP'],
    latinName: 'Zea mays peptide',
    englishName: 'Corn Peptides',
    source: IngredientSource.PEPTIDE,
    category: '护肝类',
    efficacyTags: ['护肝', '抗疲劳', '促进消化'],
    precautions: [],
    dosageRange: { min: 200, max: 800, unit: 'mg' },
    description: '玉米蛋白经酶解制得的活性肽，富含丙氨酸-亮氨酸-脯氨酸序列，具解酒护肝功效。',
    dfbpId: 'D003',
  },
  {
    id: 'PEP-004',
    name: '鱼胶原蛋白肽',
    aliasNames: ['鱼胶原肽', 'Marine collagen peptide', 'MCP'],
    latinName: 'Fish collagen hydrolysate',
    englishName: 'Marine Collagen Peptides',
    source: IngredientSource.PEPTIDE,
    category: '美容保健类',
    efficacyTags: ['美容养颜', '抗炎', '补气养血'],
    precautions: [{ category: 'warning', content: '鱼类过敏者需注意', severity: 'low' }],
    dosageRange: { min: 1000, max: 3000, unit: 'mg' },
    description: '深海鱼皮/鳞经酶解制得的I型胶原蛋白肽，分子量小（<1000Da），吸收率高。',
    dfbpId: 'D004',
  },
  {
    id: 'PEP-005',
    name: '乳清蛋白肽',
    aliasNames: ['乳清肽', 'Whey peptide', 'WP'],
    latinName: 'Whey protein hydrolysate',
    englishName: 'Whey Protein Peptides',
    source: IngredientSource.PEPTIDE,
    category: '运动营养类',
    efficacyTags: ['补气养血', '抗疲劳', '增强免疫'],
    precautions: [],
    dosageRange: { min: 5000, max: 25000, unit: 'mg' },
    description: '乳清蛋白经酶解制得的短链肽，快速吸收，富含支链氨基酸（BCAA）。',
    dfbpId: 'D005',
  },
  {
    id: 'PEP-006',
    name: '谷胱甘肽',
    aliasNames: ['GSH', '还原型谷胱甘肽', 'Glutathione'],
    latinName: 'γ-L-Glutamyl-L-cysteinyl-glycine',
    englishName: 'Glutathione',
    source: IngredientSource.PEPTIDE,
    category: '抗氧化类',
    efficacyTags: ['抗氧化', '护肝', '美容养颜'],
    precautions: [],
    dosageRange: { min: 100, max: 500, unit: 'mg' },
    description: '体内最重要的抗氧化三肽，由谷氨酸、半胱氨酸、甘氨酸组成，直接清除自由基。',
    dfbpId: 'D006',
  },

  // ==================== 辅料 (EXCIPIENT) ====================
  {
    id: 'EXC-001',
    name: '微晶纤维素',
    aliasNames: ['MCC', 'Microcrystalline Cellulose', 'Avicel'],
    source: IngredientSource.EXCIPIENT,
    category: '填充剂/崩解剂',
    efficacyTags: [],
    precautions: [],
    dosageRange: { min: 10, max: 200, unit: 'mg' },
    description: '常用药用辅料，用作片剂的填充剂、粘合剂或崩解剂。',
  },
  {
    id: 'EXC-002',
    name: '糊精',
    aliasNames: ['Dextrin', '麦芽糊精', 'Maltodextrin'],
    source: IngredientSource.EXCIPIENT,
    category: '填充剂/载体',
    efficacyTags: [],
    precautions: [],
    dosageRange: { min: 50, max: 500, unit: 'mg' },
    description: '淀粉部分水解产物，常用作填充剂、粘合剂或包衣材料。',
  },
  {
    id: 'EXC-003',
    name: '二氧化硅',
    aliasNames: ['硅 dioxide', 'Colloidal silicon dioxide', 'Aerosil'],
    source: IngredientSource.EXCIPIENT,
    category: '抗结剂/助流剂',
    efficacyTags: [],
    precautions: [],
    dosageRange: { min: 1, max: 20, unit: 'mg' },
    description: '常用抗结块剂和助流剂，改善粉末流动性。',
  },
  {
    id: 'EXC-004',
    name: '硬脂酸镁',
    aliasNames: ['Magnesium stearate', 'MgSt'],
    source: IngredientSource.EXCIPIENT,
    category: '润滑剂',
    efficacyTags: [],
    precautions: [],
    dosageRange: { min: 2, max: 15, unit: 'mg' },
    description: '最常用的片剂润滑剂，减少颗粒与冲模间的摩擦力。',
  },
];

const ingredientIndex = new Map<string, IngredientDatabaseRecord>();
BUILTIN_INGREDIENT_DB.forEach((record) => {
  ingredientIndex.set(record.name.toLowerCase(), record);
  record.aliasNames.forEach((alias) => {
    ingredientIndex.set(alias.toLowerCase(), record);
  });
  if (record.latinName) {
    ingredientIndex.set(record.latinName.toLowerCase(), record);
  }
  if (record.englishName) {
    ingredientIndex.set(record.englishName.toLowerCase(), record);
  }
});

export function queryIngredientByName(name: string): IngredientDatabaseRecord | null {
  if (!name) return null;

  const normalizedName = name.trim().toLowerCase();
  return ingredientIndex.get(normalizedName) || null;
}

export function fuzzyMatchIngredients(
  query: string,
  limit = 10,
): { record: IngredientDatabaseRecord; score: number }[] {
  if (!query) return [];

  const normalizedQuery = query.trim().toLowerCase();
  const results: { record: IngredientDatabaseRecord; score: number }[] = [];

  for (const record of BUILTIN_INGREDIENT_DB) {
    let score = 0;

    if (record.name.toLowerCase().includes(normalizedQuery)) {
      score += 100;
      if (record.name.toLowerCase() === normalizedQuery) score += 50;
    }

    if (record.aliasNames.some((alias) => alias.toLowerCase().includes(normalizedQuery))) {
      score += 80;
      if (record.aliasNames.some((alias) => alias.toLowerCase() === normalizedQuery)) score += 40;
    }

    if (record.latinName?.toLowerCase().includes(normalizedQuery)) {
      score += 60;
    }

    if (record.englishName?.toLowerCase().includes(normalizedQuery)) {
      score += 60;
    }

    if (calculateEditDistance(normalizedQuery, record.name.toLowerCase()) <= 2) {
      score += 30;
    }

    if (score > 0) {
      results.push({ record, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export function inferSourceType(name: string): IngredientSource {
  if (!name) return IngredientSource.TCM;

  const normalizedName = name.toLowerCase();

  for (const keyword of PEPTIDE_KEYWORDS) {
    if (normalizedName.includes(keyword.toLowerCase())) {
      return IngredientSource.PEPTIDE;
    }
  }

  for (const keyword of EXCIPIENT_KEYWORDS) {
    if (normalizedName.includes(keyword.toLowerCase())) {
      return IngredientSource.EXCIPIENT;
    }
  }

  for (const keyword of TCM_KEYWORDS) {
    if (normalizedName.includes(keyword.toLowerCase())) {
      return IngredientSource.TCM;
    }
  }

  return IngredientSource.TCM;
}

export async function enhanceIngredientData(rawIngredient: {
  name: string;
  amount?: number;
  unit?: string;
  source?: any;
}): Promise<EnhancedIngredient> {
  const name = rawIngredient.name || '未知成分';
  const amount = typeof rawIngredient.amount === 'number' ? rawIngredient.amount : 0;
  const unit = rawIngredient.unit || 'g';

  const dbMatch = queryIngredientByName(name);

  let confidence = 0;
  let source: IngredientSource;
  let efficacyTags: EfficacyTag[] = [];
  let precautions: Precaution[] = [];
  let latinName: string | undefined;

  if (dbMatch) {
    confidence = 1.0;
    source = dbMatch.source;
    efficacyTags = dbMatch.efficacyTags;
    precautions = dbMatch.precautions;
    latinName = dbMatch.latinName;
  } else {
    const fuzzyResults = fuzzyMatchIngredients(name, 1);
    if (fuzzyResults.length > 0 && fuzzyResults[0].score >= 80) {
      confidence = fuzzyResults[0].score / 100;
      const bestMatch = fuzzyResults[0].record;
      source = bestMatch.source;
      efficacyTags = bestMatch.efficacyTags.slice(0, Math.ceil(bestMatch.efficacyTags.length * confidence));
      precautions = bestMatch.precautions.filter((p) => p.severity !== 'high');
      latinName = bestMatch.latinName;
    } else {
      confidence = 0.3;
      source = inferSourceType(name);
      efficacyTags = [];
      precautions = [];
    }
  }

  return {
    id: `enhanced-${Date.now()}-${name}`,
    name,
    latinName,
    amount,
    unit,
    percentage: 0,
    efficacyTags,
    precautions,
    source: rawIngredient.source || source,
    dbMatch: dbMatch || undefined,
    matchConfidence: confidence,
  };
}

export function enhanceFormulaData(
  ingredients: { name: string; amount?: number; unit?: string; source?: any }[],
): Promise<EnhancedIngredient[]> {
  return Promise.all(ingredients.map((ing) => enhanceIngredientData(ing)));
}

function calculateEditDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }

  return matrix[len1][len2];
}

export default {
  BUILTIN_INGREDIENT_DB,
  queryIngredientByName,
  fuzzyMatchIngredients,
  inferSourceType,
  enhanceIngredientData,
  enhanceFormulaData,
};
