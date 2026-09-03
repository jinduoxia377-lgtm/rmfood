import { ProfessionalBaseService } from './ProfessionalBaseService';
import type { ProfessionalServiceConfig } from '../../types/professional';

export interface FoodStandard {
  standard_code: string;
  title: string;
  title_en: string;
  category: string;
  status: string;
  publish_date: string;
  implementation_date: string;
  summary: string;
  scope: string[];
  related_topics: string[];
  source_url?: string;
  priority?: string;
}

export interface FoodHomologyMaterial {
  name: string;
  latin_name: string;
  category: string;
  approval_date: string;
  status: string;
  restrictions: string[];
  usage_forms: string[];
  max_dosage: string;
}

export interface NewFoodMaterial {
  name: string;
  english_name: string;
  source: string;
  approval_date: string;
  status: string;
  usage_scope: string[];
  daily_intake: string;
  restrictions: string[];
  notice: string;
}

export interface FoodAdditive {
  code: string;
  name: string;
  english_name: string;
  function: string;
  allowed_foods: string[];
  max_level: string;
  remarks: string;
}

export interface AdditiveCheckResult {
  found: boolean;
  message?: string;
  additive?: FoodAdditive;
  food_category?: string;
  is_allowed?: boolean;
  max_level?: string;
  remarks?: string;
}

export interface HomologyCheckResult {
  is_homology: boolean;
  message: string;
  suggestion?: string;
  material?: FoodHomologyMaterial;
  status?: string;
  max_dosage?: string;
  restrictions?: string[];
}

export interface FormulaValidationResult {
  valid: boolean;
  results: {
    ingredient: string;
    type: string;
    status: string;
    details: any;
  }[];
  warnings: string[];
  errors: string[];
  summary: {
    total_ingredients: number;
    approved: number;
    warnings: number;
    errors: number;
  };
}

export interface InternationalStandard {
  standard_code: string;
  title: string;
  title_en: string;
  category: string;
  status: string;
  publish_date: string;
  implementation_date: string;
  summary: string;
  scope: string[];
  related_topics: string[];
  source_url: string;
  organization: string;
  priority: string;
}

export interface RegulationSummary {
  version: string;
  update_date: string;
  data_sources: string[];
  statistics: {
    safety_standards: number;
    food_homology_materials: number;
    new_food_materials: number;
    food_additives: number;
  };
}

class FoodRegulationService extends ProfessionalBaseService {
  private mockMode = false;

  constructor(config: ProfessionalServiceConfig = {}) {
    super({
      ...config,
      baseURL: config.baseURL || '/api/v1/knowledge-base/regulation',
      cacheDuration: 5 * 60 * 1000,
    });
  }

  public enableMockMode(enable: boolean): void {
    this.mockMode = enable;
  }

  public async getStandards(category?: string, keyword?: string): Promise<{ standards: FoodStandard[] }> {
    const cacheKey = this.getCacheKey('/standards', { category, keyword });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      return this.mockGetStandards(category, keyword);
    }

    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (keyword) params.keyword = keyword;

    const result = await this.get<{ standards: FoodStandard[] }>('/standards', params);
    this.setCache(cacheKey, result);
    return result;
  }

  private mockGetStandards(category?: string, keyword?: string): { standards: FoodStandard[] } {
    const mockStandards: FoodStandard[] = [
      {
        standard_code: 'GB 2760-2021',
        title: '食品安全国家标准 食品添加剂使用标准',
        title_en: 'National Food Safety Standard - Standard for Uses of Food Additives',
        category: '食品添加剂',
        status: '现行',
        publish_date: '2021-02-27',
        implementation_date: '2021-06-01',
        summary: '规定了食品添加剂的使用原则、允许使用的食品添加剂品种、使用范围及最大使用量或残留量',
        scope: ['食品添加剂', '食品生产', '食品加工'],
        related_topics: ['防腐剂', '甜味剂', '着色剂', '香精香料'],
      },
      {
        standard_code: 'GB 2762-2022',
        title: '食品安全国家标准 食品中污染物限量',
        title_en: 'National Food Safety Standard - Maximum Levels of Contaminants in Foods',
        category: '污染物限量',
        status: '现行',
        publish_date: '2022-03-11',
        implementation_date: '2022-09-01',
        summary: '规定了食品中重金属、农药残留、真菌毒素等污染物的限量要求',
        scope: ['食品检测', '食品安全', '质量控制'],
        related_topics: ['重金属', '农药残留', '真菌毒素', '污染物'],
      },
    ];

    let results = mockStandards;
    if (category) {
      results = results.filter((s) => s.category.includes(category));
    }
    if (keyword) {
      const kw = keyword.toLowerCase();
      results = results.filter(
        (s) =>
          s.title.toLowerCase().includes(kw) ||
          s.standard_code.toLowerCase().includes(kw) ||
          s.summary.toLowerCase().includes(kw),
      );
    }

    return { standards: results };
  }

  public async getHomologyMaterials(name?: string): Promise<{ materials: FoodHomologyMaterial[] }> {
    const cacheKey = this.getCacheKey('/homology', { name });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      return this.mockGetHomologyMaterials(name);
    }

    const params: Record<string, string> = {};
    if (name) params.name = name;

    const result = await this.get<{ materials: FoodHomologyMaterial[] }>('/homology', params);
    this.setCache(cacheKey, result);
    return result;
  }

  private mockGetHomologyMaterials(name?: string): { materials: FoodHomologyMaterial[] } {
    const mockMaterials: FoodHomologyMaterial[] = [
      {
        name: '人参',
        latin_name: 'Panax ginseng',
        category: '补气药',
        approval_date: '2012-08-23',
        status: '允许用于普通食品',
        restrictions: ['孕妇、哺乳期妇女及14周岁以下儿童不宜食用', '不宜与藜芦、五灵脂同用'],
        usage_forms: ['片剂', '胶囊', '饮品', '食品添加剂'],
        max_dosage: '≤3克/天',
      },
      {
        name: '黄芪',
        latin_name: 'Astragalus membranaceus',
        category: '补气药',
        approval_date: '2012-08-23',
        status: '允许用于普通食品',
        restrictions: ['表实邪盛、气滞湿阻者不宜使用'],
        usage_forms: ['煲汤', '茶饮', '提取物'],
        max_dosage: '≤15克/天',
      },
      {
        name: '枸杞子',
        latin_name: 'Lycium barbarum',
        category: '补阴药',
        approval_date: '传统药食同源',
        status: '允许用于普通食品',
        restrictions: ['外邪实热、脾虚有湿及泄泻者忌服'],
        usage_forms: ['直接食用', '茶饮', '煲汤', '食品添加剂'],
        max_dosage: '无限制',
      },
    ];

    let results = mockMaterials;
    if (name) {
      results = results.filter((m) => m.name.includes(name));
    }

    return { materials: results };
  }

  public async getNewFoodMaterials(name?: string): Promise<{ materials: NewFoodMaterial[] }> {
    const cacheKey = this.getCacheKey('/new-food-materials', { name });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      return this.mockGetNewFoodMaterials(name);
    }

    const params: Record<string, string> = {};
    if (name) params.name = name;

    const result = await this.get<{ materials: NewFoodMaterial[] }>('/new-food-materials', params);
    this.setCache(cacheKey, result);
    return result;
  }

  private mockGetNewFoodMaterials(name?: string): { materials: NewFoodMaterial[] } {
    const mockMaterials: NewFoodMaterial[] = [
      {
        name: '玛咖粉',
        english_name: 'Maca powder',
        source: '玛咖（Lepidium meyenii Walp.）的根茎',
        approval_date: '2011-05-18',
        status: '已批准',
        usage_scope: ['片剂、胶囊、饮品、酒类'],
        daily_intake: '≤25克/天',
        restrictions: ['婴幼儿、哺乳期妇女、孕妇不宜食用'],
        notice: '2011年第13号公告',
      },
      {
        name: 'DHA藻油',
        english_name: 'DHA algal oil',
        source: '裂壶藻（Schizochytrium sp.）或寇氏隐甲藻（Crypthecodinium cohnii）',
        approval_date: '2010-03-09',
        status: '已批准',
        usage_scope: ['婴幼儿配方食品、乳制品、饮料、糖果'],
        daily_intake: '≤300毫克/天（以纯DHA计）',
        restrictions: ['无特殊限制'],
        notice: '2010年第3号公告',
      },
    ];

    let results = mockMaterials;
    if (name) {
      results = results.filter(
        (m) => m.name.includes(name) || m.english_name.toLowerCase().includes(name.toLowerCase()),
      );
    }

    return { materials: results };
  }

  public async searchAdditives(keyword?: string, functionType?: string): Promise<{ additives: FoodAdditive[] }> {
    const cacheKey = this.getCacheKey('/additives', { keyword, functionType });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      return this.mockSearchAdditives(keyword, functionType);
    }

    const params: Record<string, string> = {};
    if (keyword) params.keyword = keyword;
    if (functionType) params.function = functionType;

    const result = await this.get<{ additives: FoodAdditive[] }>('/additives', params);
    this.setCache(cacheKey, result);
    return result;
  }

  private mockSearchAdditives(keyword?: string, functionType?: string): { additives: FoodAdditive[] } {
    const mockAdditives: FoodAdditive[] = [
      {
        code: 'INS 200',
        name: '山梨酸',
        english_name: 'Sorbic acid',
        function: '防腐剂',
        allowed_foods: ['糕点', '糖果', '饮料', '肉制品'],
        max_level: '1.0 g/kg',
        remarks: '用于抑制霉菌和酵母菌生长',
      },
      {
        code: 'INS 202',
        name: '山梨酸钾',
        english_name: 'Potassium sorbate',
        function: '防腐剂',
        allowed_foods: ['糕点', '糖果', '饮料', '肉制品', '乳制品'],
        max_level: '1.0 g/kg',
        remarks: '山梨酸的钾盐，水溶性更好',
      },
      {
        code: 'INS 955',
        name: '三氯蔗糖',
        english_name: 'Sucralose',
        function: '甜味剂',
        allowed_foods: ['饮料', '糖果', '糕点', '乳制品'],
        max_level: '根据需要适量使用',
        remarks: '甜度约为蔗糖的600倍，无热量',
      },
    ];

    let results = mockAdditives;
    if (keyword) {
      const kw = keyword.toLowerCase();
      results = results.filter(
        (a) =>
          a.name.toLowerCase().includes(kw) ||
          a.english_name.toLowerCase().includes(kw) ||
          a.code.toLowerCase().includes(kw),
      );
    }
    if (functionType) {
      results = results.filter((a) => a.function.includes(functionType));
    }

    return { additives: results };
  }

  public async checkAdditiveUsage(additiveName: string, foodCategory = '糕点'): Promise<AdditiveCheckResult> {
    const cacheKey = this.getCacheKey('/additive-check', { additiveName, foodCategory });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      return this.mockCheckAdditiveUsage(additiveName, foodCategory);
    }

    const result = await this.get<AdditiveCheckResult>('/additive-check', {
      additive_name: additiveName,
      food_category: foodCategory,
    });
    this.setCache(cacheKey, result);
    return result;
  }

  private mockCheckAdditiveUsage(additiveName: string, foodCategory: string): AdditiveCheckResult {
    const mockAdditives: Record<string, FoodAdditive> = {
      山梨酸: {
        code: 'INS 200',
        name: '山梨酸',
        english_name: 'Sorbic acid',
        function: '防腐剂',
        allowed_foods: ['糕点', '糖果', '饮料', '肉制品'],
        max_level: '1.0 g/kg',
        remarks: '用于抑制霉菌和酵母菌生长',
      },
      山梨酸钾: {
        code: 'INS 202',
        name: '山梨酸钾',
        english_name: 'Potassium sorbate',
        function: '防腐剂',
        allowed_foods: ['糕点', '糖果', '饮料', '肉制品', '乳制品'],
        max_level: '1.0 g/kg',
        remarks: '山梨酸的钾盐，水溶性更好',
      },
    };

    const additive = mockAdditives[additiveName];
    if (!additive) {
      return {
        found: false,
        message: `未找到添加剂: ${additiveName}`,
      };
    }

    const isAllowed = additive.allowed_foods.includes(foodCategory);
    return {
      found: true,
      additive,
      food_category: foodCategory,
      is_allowed: isAllowed,
      max_level: isAllowed ? additive.max_level : '不允许使用',
      remarks: additive.remarks,
    };
  }

  public async checkHomologyApproval(herbName: string): Promise<HomologyCheckResult> {
    const cacheKey = this.getCacheKey('/homology-check', { herbName });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      return this.mockCheckHomologyApproval(herbName);
    }

    const materials = await this.getHomologyMaterials(herbName);
    if (materials.materials.length > 0) {
      const material = materials.materials[0];
      const result: HomologyCheckResult = {
        is_homology: true,
        message: `${herbName} 属于药食同源物质`,
        material,
        status: material.status,
        max_dosage: material.max_dosage,
        restrictions: material.restrictions,
      };
      this.setCache(cacheKey, result);
      return result;
    }

    const result: HomologyCheckResult = {
      is_homology: false,
      message: `${herbName} 未列入药食同源目录`,
      suggestion: '如需使用，请申请新食品原料审查',
    };
    this.setCache(cacheKey, result);
    return result;
  }

  private mockCheckHomologyApproval(herbName: string): HomologyCheckResult {
    const mockMaterials: Record<string, FoodHomologyMaterial> = {
      人参: {
        name: '人参',
        latin_name: 'Panax ginseng',
        category: '补气药',
        approval_date: '2012-08-23',
        status: '允许用于普通食品',
        restrictions: ['孕妇、哺乳期妇女及14周岁以下儿童不宜食用', '不宜与藜芦、五灵脂同用'],
        usage_forms: ['片剂', '胶囊', '饮品', '食品添加剂'],
        max_dosage: '≤3克/天',
      },
      黄芪: {
        name: '黄芪',
        latin_name: 'Astragalus membranaceus',
        category: '补气药',
        approval_date: '2012-08-23',
        status: '允许用于普通食品',
        restrictions: ['表实邪盛、气滞湿阻者不宜使用'],
        usage_forms: ['煲汤', '茶饮', '提取物'],
        max_dosage: '≤15克/天',
      },
    };

    const material = mockMaterials[herbName];
    if (material) {
      return {
        is_homology: true,
        message: `${herbName} 属于药食同源物质`,
        material,
        status: material.status,
        max_dosage: material.max_dosage,
        restrictions: material.restrictions,
      };
    }

    return {
      is_homology: false,
      message: `${herbName} 未列入药食同源目录`,
      suggestion: '如需使用，请申请新食品原料审查',
    };
  }

  public async validateFormula(ingredients: string[]): Promise<FormulaValidationResult> {
    const cacheKey = this.getCacheKey('/validate-formula', { ingredients });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      return this.mockValidateFormula(ingredients);
    }

    const result = await this.post<FormulaValidationResult>('/validate-formula', ingredients);
    this.setCache(cacheKey, result);
    return result;
  }

  private mockValidateFormula(ingredients: string[]): FormulaValidationResult {
    const approvedHerbs = ['人参', '黄芪', '枸杞子', '当归', '甘草'];
    const results = ingredients.map((ingredient) => {
      const isApproved = approvedHerbs.includes(ingredient);
      return {
        ingredient,
        type: isApproved ? 'food_homology' : 'unknown',
        status: isApproved ? 'approved' : 'warning',
        details: isApproved
          ? {
              is_homology: true,
              material: { name: ingredient, status: '允许用于普通食品' },
            }
          : { message: `成分 ${ingredient} 未在已知法规目录中找到` },
      };
    });

    const warnings = ingredients.filter((i) => !approvedHerbs.includes(i));

    return {
      valid: warnings.length === 0,
      results,
      warnings: warnings.map((i) => `成分 ${i} 未在已知法规目录中找到`),
      errors: [],
      summary: {
        total_ingredients: ingredients.length,
        approved: ingredients.filter((i) => approvedHerbs.includes(i)).length,
        warnings: warnings.length,
        errors: 0,
      },
    };
  }

  public async getSummary(): Promise<RegulationSummary> {
    const cacheKey = '/summary';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      return this.mockGetSummary();
    }

    const result = await this.get<RegulationSummary>('/summary');
    this.setCache(cacheKey, result);
    return result;
  }

  public async getInternationalStandards(org?: string, keyword?: string): Promise<{ standards: InternationalStandard[] }> {
    const cacheKey = this.getCacheKey('/international', { org, keyword });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const params: Record<string, string> = {};
    if (org) params.org = org;
    if (keyword) params.keyword = keyword;

    const result = await this.get<{ standards: InternationalStandard[] }>('/international', params);
    this.setCache(cacheKey, result);
    return result;
  }

  public async searchInternational(keyword: string): Promise<{ standards: InternationalStandard[] }> {
    return this.getInternationalStandards(undefined, keyword);
  }

  private mockGetSummary(): RegulationSummary {
    return {
      version: '2025.1',
      update_date: new Date().toISOString(),
      data_sources: ['国家卫生健康委员会', '国家市场监督管理总局', '食品安全国家标准', 'CAC食品法典', 'ISO国际标准'],
      statistics: {
        safety_standards: 92,
        food_homology_materials: 8,
        new_food_materials: 8,
        food_additives: 10,
      },
    };
  }

  public clearCache(): void {
    this.clearCacheByPattern('/regulation');
  }

  public getServiceInfo(): {
    mockMode: boolean;
    cachedItems: number;
  } {
    return {
      mockMode: this.mockMode,
      cachedItems: this.getCacheStats().size,
    };
  }
}

const foodRegulationService = new FoodRegulationService();

export default foodRegulationService;
export { FoodRegulationService };
