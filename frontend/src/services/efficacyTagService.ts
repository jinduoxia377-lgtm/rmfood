import Fuse from 'fuse.js'
import type {
  EfficacyTag,
  TagCategory,
  EfficacyTagMeta,
  TagCategoryNode,
} from '@/types/efficacyTag.types'
import {
  EFFICACY_TAG_METADATA,
  EFFICACY_TAG_CATEGORY_TREE,
  getEfficacyTagMeta,
} from '@/config/efficacyTags.constants'

export interface MatchedTagResult {
  tag: EfficacyTag
  matchType: 'exact' | 'alias' | 'fuzzy'
  confidence: number
  meta: EfficacyTagMeta
}

const INGREDIENT_ALIAS_MAP: Record<string, string> = {
  '酸枣仁': 'Ziziphus jujuba',
  '人参': 'Panax ginseng',
  '黄芪': 'Astragalus membranaceus',
  '灵芝': 'Ganoderma lucidum',
  '枸杞': 'Lycium barbarum',
  '当归': 'Angelica sinensis',
  '熟地黄': 'Rehmannia glutinosa',
  '白芍': 'Paeonia lactiflora',
  '川芎': 'Ligusticum chuanxiong',
  '丹参': 'Salvia miltiorrhiza',
  '三七': 'Panax notoginseng',
  '山楂': 'Crataegus pinnatifida',
  '茯苓': 'Poria cocos',
  '白术': 'Atractylodes macrocephala',
  '陈皮': 'Citrus reticulata',
  '甘草': 'Glycyrrhiza uralensis',
  '柴胡': 'Bupleurum chinense',
  '杜仲': 'Eucommia ulmoides',
  '淫羊藿': 'Epimedium brevicornum',
  '何首乌': 'Polygonum multiflorum',
  '菊花': 'Chrysanthemum morifolium',
}

class EfficacyTagService {
  private presetTags: EfficacyTag[] = []
  private categories: TagCategoryNode[] = []
  private fuseInstance: Fuse<EfficacyTagMeta> | null = null

  constructor() {
    this.initialize()
  }

  private initialize(): void {
    this.presetTags = EFFICACY_TAG_METADATA.map((meta) => meta.name)
    this.categories = EFFICACY_TAG_CATEGORY_TREE
    this.fuseInstance = new Fuse(EFFICACY_TAG_METADATA, {
      keys: [
        { name: 'name', weight: 2.0 },
        { name: 'keywords', weight: 1.5 },
        { name: 'relatedIngredients', weight: 1.0 },
        { name: 'description', weight: 0.5 },
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 1,
    })
  }

  loadPresetTags(): EfficacyTag[] {
    return [...this.presetTags]
  }

  getTagCategories(): TagCategoryNode[] {
    return [...this.categories]
  }

  getTagMeta(tagName: EfficacyTag): EfficacyTagMeta | undefined {
    return getEfficacyTagMeta(tagName)
  }

  matchTagsByIngredientName(
    ingredientName: string,
    allTags?: EfficacyTag[],
  ): MatchedTagResult[] {
    const tagsToSearch = allTags || this.presetTags
    const results: MatchedTagResult[] = []
    const matchedTagNames = new Set<string>()

    const exactMatches = this.findExactMatches(ingredientName, tagsToSearch)
    exactMatches.forEach((result) => {
      if (!matchedTagNames.has(result.tag)) {
        matchedTagNames.add(result.tag)
        results.push(result)
      }
    })

    const aliasMatches = this.findAliasMatches(ingredientName, tagsToSearch)
    aliasMatches.forEach((result) => {
      if (!matchedTagNames.has(result.tag)) {
        matchedTagNames.add(result.tag)
        results.push(result)
      }
    })

    const fuzzyMatches = this.findFuzzyMatches(ingredientName, tagsToSearch)
    fuzzyMatches.forEach((result) => {
      if (!matchedTagNames.has(result.tag)) {
        matchedTagNames.add(result.tag)
        results.push(result)
      }
    })

    results.sort((a, b) => b.confidence - a.confidence)

    return results.slice(0, 5)
  }

  private findExactMatches(
    ingredientName: string,
    tagsToSearch: EfficacyTag[],
  ): MatchedTagResult[] {
    const results: MatchedTagResult[] = []

    for (const tagName of tagsToSearch) {
      const meta = getEfficacyTagMeta(tagName)
      if (!meta) continue

      const isExactMatch = meta.relatedIngredients.some(
        (related) =>
          related.toLowerCase() === ingredientName.toLowerCase() ||
          related.includes(ingredientName) ||
          ingredientName.includes(related),
      )

      if (isExactMatch) {
        results.push({
          tag: tagName,
          matchType: 'exact',
          confidence: 1.0,
          meta,
        })
      }
    }

    return results
  }

  private findAliasMatches(
    ingredientName: string,
    tagsToSearch: EfficacyTag[],
  ): MatchedTagResult[] {
    const results: MatchedTagResult[] = []

    const latinAlias = INGREDIENT_ALIAS_MAP[ingredientName]
    if (!latinAlias) return results

    for (const tagName of tagsToSearch) {
      const meta = getEfficacyTagMeta(tagName)
      if (!meta) continue

      const isAliasMatch = meta.relatedIngredients.some(
        (related) =>
          related.toLowerCase() === latinAlias.toLowerCase() ||
          related.toLowerCase().includes(latinAlias.toLowerCase()) ||
          latinAlias.toLowerCase().includes(related.toLowerCase()),
      )

      if (isAliasMatch) {
        results.push({
          tag: tagName,
          matchType: 'alias',
          confidence: 0.85,
          meta,
        })
      }
    }

    return results
  }

  private findFuzzyMatches(
    ingredientName: string,
    _tagsToSearch: EfficacyTag[],
  ): MatchedTagResult[] {
    if (!this.fuseInstance) return []

    const searchResults = this.fuseInstance.search(ingredientName)

    return searchResults
      .filter((result) => result.score !== undefined && result.score < 0.3)
      .map((result) => ({
        tag: result.item.name,
        matchType: 'fuzzy' as const,
        confidence: Math.max(0, Math.min(1, 1 - (result.score ?? 0))),
        meta: result.item,
      }))
  }

  batchMatchTags(
    ingredients: { name: string }[],
  ): Map<string, EfficacyTag[]> {
    const tagMap = new Map<string, EfficacyTag[]>()

    for (const ingredient of ingredients) {
      const matches = this.matchTagsByIngredientName(ingredient.name)
      const uniqueTags = [...new Set(matches.map((m) => m.tag))]
      tagMap.set(ingredient.name, uniqueTags)
    }

    return tagMap
  }

  getCategoryColor(category: TagCategory): string {
    const categoryNode = this.categories.find((cat) => cat.category === category)
    return categoryNode?.color || '#8c8c8c'
  }

  getCategoryIcon(category: TagCategory): string | undefined {
    const categoryNode = this.categories.find((cat) => cat.category === category)
    return categoryNode?.icon
  }

  getAllTagsByCategory(category: TagCategory): EfficacyTag[] {
    const categoryNode = this.categories.find((cat) => cat.category === category)
    return categoryNode?.tags || []
  }
}

export const efficacyTagService = new EfficacyTagService()

export default efficacyTagService
