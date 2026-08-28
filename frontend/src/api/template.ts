/**
 * 配方模板 API
 */
export interface TemplateIngredient {
  name: string
  role: string
  dosage: string
  category: string
}

export interface FormulaTemplate {
  id: number
  code: string
  name: string
  description: string
  category: string
  target_effects: string[]
  ingredients: TemplateIngredient[]
  usage: string
  tags: string[]
  usage_count: number
  is_featured: boolean
  is_active: boolean
  created_at: string
}

export const templateApi = {
  async list(): Promise<{ templates: FormulaTemplate[] }> {
    const res = await fetch('/api/v1/formulas/templates')
    if (!res.ok) throw new Error('Failed to fetch templates')
    return res.json()
  },
  
  async create(data: Partial<FormulaTemplate>) {
    const res = await fetch('/api/v1/formulas/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create template')
    return res.json()
  },
}
