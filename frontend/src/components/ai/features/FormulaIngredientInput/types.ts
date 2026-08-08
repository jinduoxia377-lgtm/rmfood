/**
 * 配方成分输入组件类型定义
 */

// 成分参数类型
export interface IngredientParameter {
  id: string;
  name: string;
  nameEn: string;
  value: number | null;
  unit: string;
  min: number;
  max: number;
  step: number;
  required: boolean;
  description: string;
}

// 配方成分类型
export interface FormulaIngredient {
  id: string;
  name: string;
  nameCn: string;
  ratio: number; // 百分比
  unit: 'percentage' | 'mass'; // 比例表示方式
  parameters: IngredientParameter[];
  dosage: number; // 实际克数（根据总克数计算）
}

// 配方模板类型
export interface FormulaTemplate {
  id: string;
  name: string;
  description: string;
  ingredients: FormulaIngredient[];
  totalWeight: number;
  category: string;
  createdAt: string;
  isSystem: boolean;
}

// 单位类型
export type RatioUnit = 'percentage' | 'mass';

// 验证错误类型
export interface ValidationError {
  field: string;
  message: string;
  suggestion: string;
}

// 组件状态类型
export interface FormulaInputState {
  ingredients: FormulaIngredient[];
  totalWeight: number;
  ratioUnit: RatioUnit;
  errors: ValidationError[];
  isLoading: boolean;
  savedTemplates: FormulaTemplate[];
  selectedTemplateId: string | null;
}

// 预设模板数据
export const PRESET_TEMPLATES: FormulaTemplate[] = [
  {
    id: 'template-1',
    name: '益气养血方',
    description: '经典益气养血配方，适用于气血不足人群',
    ingredients: [
      {
        id: 'ing-1',
        name: '黄芪',
        nameCn: '黄芪',
        ratio: 30,
        unit: 'percentage',
        dosage: 30,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 12.5, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 4.2, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '黄芪甲苷', nameEn: 'astragaloside', value: 0.08, unit: '%', min: 0, max: 1, step: 0.01, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-2',
        name: '当归',
        nameCn: '当归',
        ratio: 20,
        unit: 'percentage',
        dosage: 20,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 11.8, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 5.1, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '阿魏酸', nameEn: 'ferulic_acid', value: 0.12, unit: '%', min: 0, max: 1, step: 0.01, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-3',
        name: '党参',
        nameCn: '党参',
        ratio: 25,
        unit: 'percentage',
        dosage: 25,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 13.2, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 4.8, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '党参多糖', nameEn: 'codonopsis_polysaccharide', value: 8.5, unit: '%', min: 0, max: 20, step: 0.1, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-4',
        name: '枸杞子',
        nameCn: '枸杞子',
        ratio: 25,
        unit: 'percentage',
        dosage: 25,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 12.0, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 3.5, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '枸杞多糖', nameEn: 'lycium_polysaccharide', value: 35.0, unit: '%', min: 0, max: 50, step: 0.1, required: true, description: '靶向成分含量' },
        ],
      },
    ],
    totalWeight: 100,
    category: '补益类',
    createdAt: '2024-01-01',
    isSystem: true,
  },
  {
    id: 'template-2',
    name: '清热解毒方',
    description: '清热解毒配方，适用于热毒病症',
    ingredients: [
      {
        id: 'ing-1',
        name: '金银花',
        nameCn: '金银花',
        ratio: 35,
        unit: 'percentage',
        dosage: 35,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 10.5, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 4.0, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '绿原酸', nameEn: 'chlorogenic_acid', value: 3.5, unit: '%', min: 0, max: 10, step: 0.1, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-2',
        name: '连翘',
        nameCn: '连翘',
        ratio: 30,
        unit: 'percentage',
        dosage: 30,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 9.8, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 3.8, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '连翘苷', nameEn: 'forsythin', value: 0.25, unit: '%', min: 0, max: 1, step: 0.01, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-3',
        name: '蒲公英',
        nameCn: '蒲公英',
        ratio: 35,
        unit: 'percentage',
        dosage: 35,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 11.2, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 5.5, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '蒲公英甾醇', nameEn: 'taraxasterol', value: 0.15, unit: '%', min: 0, max: 1, step: 0.01, required: true, description: '靶向成分含量' },
        ],
      },
    ],
    totalWeight: 100,
    category: '清热类',
    createdAt: '2024-01-01',
    isSystem: true,
  },
  {
    id: 'template-3',
    name: '健脾养胃方',
    description: '健脾养胃配方，适用于脾胃虚弱人群',
    ingredients: [
      {
        id: 'ing-1',
        name: '白术',
        nameCn: '白术',
        ratio: 25,
        unit: 'percentage',
        dosage: 25,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 12.0, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 4.5, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '白术内酯', nameEn: 'atractylenolide', value: 0.2, unit: '%', min: 0, max: 1, step: 0.01, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-2',
        name: '茯苓',
        nameCn: '茯苓',
        ratio: 30,
        unit: 'percentage',
        dosage: 30,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 14.5, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 2.8, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '茯苓多糖', nameEn: 'poria_polysaccharide', value: 8.0, unit: '%', min: 0, max: 20, step: 0.1, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-3',
        name: '山药',
        nameCn: '山药',
        ratio: 25,
        unit: 'percentage',
        dosage: 25,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 15.0, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 2.5, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '山药多糖', nameEn: 'yam_polysaccharide', value: 12.0, unit: '%', min: 0, max: 30, step: 0.1, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-4',
        name: '薏苡仁',
        nameCn: '薏苡仁',
        ratio: 20,
        unit: 'percentage',
        dosage: 20,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 11.5, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 2.2, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '薏苡仁酯', nameEn: 'coixol', value: 0.05, unit: '%', min: 0, max: 0.5, step: 0.01, required: true, description: '靶向成分含量' },
        ],
      },
    ],
    totalWeight: 100,
    category: '补益类',
    createdAt: '2024-01-01',
    isSystem: true,
  },
  {
    id: 'template-4',
    name: '活血化瘀方',
    description: '活血化瘀配方，适用于瘀血阻滞病症',
    ingredients: [
      {
        id: 'ing-1',
        name: '丹参',
        nameCn: '丹参',
        ratio: 35,
        unit: 'percentage',
        dosage: 35,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 11.8, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 4.2, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '丹参酮IIA', nameEn: 'tanshinone_iia', value: 0.25, unit: '%', min: 0, max: 1, step: 0.01, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-2',
        name: '川芎',
        nameCn: '川芎',
        ratio: 30,
        unit: 'percentage',
        dosage: 30,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 12.5, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 4.8, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '川芎嗪', nameEn: 'tetramethylpyrazine', value: 0.15, unit: '%', min: 0, max: 1, step: 0.01, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-3',
        name: '红花',
        nameCn: '红花',
        ratio: 35,
        unit: 'percentage',
        dosage: 35,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 10.2, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 5.0, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '红花黄色素', nameEn: 'safflower_yellow', value: 2.5, unit: '%', min: 0, max: 10, step: 0.1, required: true, description: '靶向成分含量' },
        ],
      },
    ],
    totalWeight: 100,
    category: '活血类',
    createdAt: '2024-01-01',
    isSystem: true,
  },
  {
    id: 'template-5',
    name: '安神助眠方',
    description: '安神助眠配方，适用于失眠多梦人群',
    ingredients: [
      {
        id: 'ing-1',
        name: '酸枣仁',
        nameCn: '酸枣仁',
        ratio: 40,
        unit: 'percentage',
        dosage: 40,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 9.5, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 3.8, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '酸枣仁皂苷', nameEn: 'jujuboside', value: 0.8, unit: '%', min: 0, max: 2, step: 0.1, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-2',
        name: '远志',
        nameCn: '远志',
        ratio: 30,
        unit: 'percentage',
        dosage: 30,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 11.0, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 4.5, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '远志皂苷', nameEn: 'polygala_saponin', value: 2.0, unit: '%', min: 0, max: 5, step: 0.1, required: true, description: '靶向成分含量' },
        ],
      },
      {
        id: 'ing-3',
        name: '合欢皮',
        nameCn: '合欢皮',
        ratio: 30,
        unit: 'percentage',
        dosage: 30,
        parameters: [
          { id: 'p1', name: '水分', nameEn: 'moisture', value: 12.8, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '水分含量' },
          { id: 'p2', name: '灰分', nameEn: 'ash', value: 4.2, unit: '%', min: 0, max: 10, step: 0.1, required: false, description: '灰分含量' },
          { id: 'p3', name: '合欢苷', nameEn: 'albiflorin', value: 0.35, unit: '%', min: 0, max: 1, step: 0.01, required: true, description: '靶向成分含量' },
        ],
      },
    ],
    totalWeight: 100,
    category: '安神类',
    createdAt: '2024-01-01',
    isSystem: true,
  },
];

// 默认参数模板
export const DEFAULT_PARAMETERS: Omit<IngredientParameter, 'id' | 'value'>[] = [
  { name: '水分', nameEn: 'moisture', unit: '%', min: 0, max: 50, step: 0.1, required: false, description: '水分含量' },
  { name: '灰分', nameEn: 'ash', unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '灰分含量' },
  { name: '蛋白质', nameEn: 'protein', unit: '%', min: 0, max: 50, step: 0.1, required: false, description: '蛋白质含量' },
  { name: '靶向成分', nameEn: 'target_component', unit: '%', min: 0, max: 100, step: 0.01, required: true, description: '主要活性成分含量' },
];
