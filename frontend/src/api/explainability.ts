/**
 * 可解释性报告 API 客户端
 */

export interface IngredientInput {
  name: string;
  dosage_mg: number;
  mechanism?: string;
}

export interface ScoreBreakdown {
  overall: number;
  efficacy: number;
  safety: number;
  cost: number;
}

export interface CoreIngredient {
  name: string;
  mechanism: string;
  evidence: string;
}

export interface SynergyEffect {
  a: string;
  b: string;
  strength: number;
  desc: string;
}

export interface AntagonismEffect {
  a: string;
  b: string;
  strength: number;
}

export interface OptimizationRationale {
  constraint: string;
  type: 'compliance' | 'nutrition' | 'cost' | 'safety';
  satisfaction: number;
  reason: string;
}

export interface ExplainabilityResult {
  formula_name: string;
  generated_at: string;
  scores: ScoreBreakdown;
  core_ingredients: CoreIngredient[];
  primary_ingredients: Array<{ name: string; mechanism: string }>;
  synergies: SynergyEffect[];
  antagonisms: AntagonismEffect[];
  optimization_rationales: OptimizationRationale[];
  compliance_notes: string[];
  summary: string;
  recommendations: string[];
}

export interface ContributionItem {
  name: string;
  efficacy_contribution: number;
  mechanism?: string;
  evidence?: string;
  safety_score?: number;
}

export interface ContributionResult {
  core: ContributionItem[];
  primary: ContributionItem[];
  supporting: ContributionItem[];
  total_ingredients: number;
  effect_coverage: number;
}

const BASE_URL = '/api/v1/explainability';

export const explainabilityApi = {
  /** 生成完整可解释性报告 */
  analyze(req: {
    formula_name: string;
    ingredients: IngredientInput[];
    target_effects: string[];
    optimization_constraints?: Record<string, unknown>;
  }): Promise<{ success: boolean; data: ExplainabilityResult }> {
    return fetch(`${BASE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }).then(r => r.json());
  },

  /** 成分贡献度分析 */
  contribution(req: {
    ingredients: IngredientInput[];
    target_effects: string[];
  }): Promise<{ success: boolean; data: ContributionResult }> {
    return fetch(`${BASE_URL}/contribution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }).then(r => r.json());
  },

  /** 君臣佐使角色分配 */
  roles(req: {
    ingredients: IngredientInput[];
    target_effects: string[];
  }): Promise<{ success: boolean; data: Record<string, string[]> }> {
    return fetch(`${BASE_URL}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }).then(r => r.json());
  },

  /** 获取报告模板 */
  templates(): Promise<{ success: boolean; templates: Array<{ id: string; name: string; description: string }> }> {
    return fetch(`${BASE_URL}/templates`).then(r => r.json());
  },
};
