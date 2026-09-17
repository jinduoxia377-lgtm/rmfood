/**
 * 数据库 API 模拟数据
 * 用于后端服务不可用时提供模拟数据
 */

import type { TCMHerb, SymMapHerb, BioactivePeptide, KnowledgeNode } from '@/types';
import type { DashboardOverview, DashboardTrends, CrossSearchResult, DataQualityReport } from './database';

// 类型断言：允许mock数据使用旧格式字段（向后兼容）
type MockTCMHerb = Partial<TCMHerb> & Record<string, any>;
type MockBioactivePeptide = Partial<BioactivePeptide> & Record<string, any>;
type MockKnowledgeNode = Partial<KnowledgeNode> & Record<string, any>;

// 模拟中药材数据 (使用宽松类型以支持旧格式字段)
const mockHerbs: MockTCMHerb[] = [
  {
    id: 1,
    name: '黄芪',
    name_cn: '黄芪', // 兼容旧字段
    latinName: 'Astragalus membranaceus',
    name_latin: 'Astragalus membranaceus',
    name_pinyin: 'huang qi',
    category: '补气药',
    nature: '微温',
    meridian: '脾、肺经',
    efficacy: '补气升阳，固表止汗，利水消肿，生津养血',
    dosage: '9-30g',
    ob_percent: 23.8,
    dl_value: 0.78,
    compound_count: 156,
    is_food_homology: true,
    sourceDatabase: 'TCMSP',
    qualityGrade: '优',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: '党参',
    name_cn: '党参',
    latinName: 'Codonopsis pilosula',
    name_latin: 'Codonopsis pilosula',
    name_pinyin: 'dang shen',
    category: '补气药',
    nature: '平',
    meridian: '脾、肺经',
    efficacy: '健脾益肺，养血生津',
    dosage: '9-30g',
    ob_percent: 18.5,
    dl_value: 0.65,
    compound_count: 98,
    is_food_homology: true,
    sourceDatabase: 'TCMSP',
    qualityGrade: '良',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    name_cn: '当归',
    name_latin: 'Angelica sinensis',
    name_pinyin: 'dang gui',
    category: '补血药',
    effects: '补血活血，调经止痛，润肠通便',
    ob_percent: 12.5,
    dl_value: 0.58,
    compound_count: 203,
    target_count: 56,
    is_food_homology: false,
  },
  {
    id: 4,
    name_cn: '枸杞',
    name_latin: 'Lycium barbarum',
    name_pinyin: 'gou qi',
    category: '补阴药',
    effects: '滋补肝肾，益精明目',
    ob_percent: 45.2,
    dl_value: 0.82,
    compound_count: 67,
    target_count: 28,
    is_food_homology: true,
  },
  {
    id: 5,
    name_cn: '山药',
    name_latin: 'Dioscorea opposita',
    name_pinyin: 'shan yao',
    category: '补气药',
    effects: '益气养阴，补脾肺肾，固精止带',
    ob_percent: 38.6,
    dl_value: 0.75,
    compound_count: 45,
    target_count: 18,
    is_food_homology: true,
  },
  {
    id: 6,
    name_cn: '陈皮',
    name_latin: 'Citrus reticulata',
    name_pinyin: 'chen pi',
    category: '理气药',
    effects: '理气健脾，燥湿化痰',
    ob_percent: 52.1,
    dl_value: 0.88,
    compound_count: 34,
    target_count: 15,
    is_food_homology: true,
  },
  {
    id: 7,
    name_cn: '甘草',
    name_latin: 'Glycyrrhiza uralensis',
    name_pinyin: 'gan cao',
    category: '补气药',
    effects: '益气补中，清热解毒，调和诸药',
    ob_percent: 32.4,
    dl_value: 0.72,
    compound_count: 189,
    target_count: 89,
    is_food_homology: true,
  },
  {
    id: 8,
    name_cn: '生姜',
    name_latin: 'Zingiber officinale',
    name_pinyin: 'sheng jiang',
    category: '解表药',
    effects: '发散风寒，温中止呕，化痰止咳',
    ob_percent: 65.8,
    dl_value: 0.91,
    compound_count: 23,
    target_count: 12,
    is_food_homology: true,
  },
];

// 模拟活性肽数据
const mockPeptides: MockBioactivePeptide[] = [
  {
    id: 1,
    sequence: 'AVP',
    source_protein: 'Vasopressin', // 兼容旧字段
    activity_type: 'antidiuretic',
    activity_value: 1.2,
    activity_unit: 'nM',
    molecular_weight: 1084.2,
    hydrolysis_enzyme: 'trypsin',
    source_organism: 'Homo sapiens',
  },
  {
    id: 2,
    sequence: 'YVAD',
    source_protein: 'Synthetic',
    activity_type: 'antiprotease',
    activity_value: 50,
    activity_unit: 'nM',
    molecular_weight: 585.6,
    hydrolysis_enzyme: 'chymotrypsin',
    source_organism: 'Synthetic',
  },
  {
    id: 3,
    sequence: 'IGF-1',
    source_protein: 'Insulin-like growth factor',
    activity_type: 'growth_factor',
    activity_value: 10,
    activity_unit: 'ng/mL',
    molecular_weight: 7649.0,
    hydrolysis_enzyme: 'pepsin',
    source_organism: 'Homo sapiens',
  },
  {
    id: 4,
    sequence: 'LL-37',
    source_protein: 'Cathelicidin',
    activity_type: 'antimicrobial',
    activity_value: 2.5,
    activity_unit: 'μM',
    molecular_weight: 4503.0,
    hydrolysis_enzyme: 'elastase',
    source_organism: 'Homo sapiens',
  },
];

// 模拟知识图谱节点
const mockGraphNodes: MockKnowledgeNode[] = [
  { id: 1, node_label: '黄芪', node_type: 'herb', source_db: 'TCMSP', properties: { score: 1.0 } },
  { id: 2, node_label: '党参', node_type: 'herb', source_db: 'TCMSP', properties: { score: 0.95 } },
  { id: 3, node_label: '当归', node_type: 'herb', source_db: 'TCMSP', properties: { score: 0.92 } },
  { id: 4, node_label: '甘草酸', node_type: 'compound', source_db: 'TCMSP', properties: { score: 0.88 } },
  { id: 5, node_label: '黄芪甲苷', node_type: 'compound', source_db: 'TCMSP', properties: { score: 0.85 } },
  { id: 6, node_label: 'ACE', node_type: 'target', source_db: 'TTD', properties: { score: 0.82 } },
  { id: 7, node_label: 'TNF-alpha', node_type: 'target', source_db: 'TTD', properties: { score: 0.78 } },
  { id: 8, node_label: '高血压', node_type: 'disease', source_db: 'TTD', properties: { score: 0.75 } },
];

// 模拟分类数据
const mockCategories = [
  { category: '补气药', count: 12 },
  { category: '补血药', count: 8 },
  { category: '补阴药', count: 6 },
  { category: '补阳药', count: 5 },
  { category: '理气药', count: 10 },
  { category: '解表药', count: 15 },
  { category: '清热药', count: 20 },
  { category: '活血化瘀药', count: 11 },
];

// 模拟活性类型数据
const mockActivityTypes = [
  { type_en: 'antioxidant', type_cn: '抗氧化', count: 156 },
  { type_en: 'antimicrobial', type_cn: '抗菌', count: 89 },
  { type_en: 'anti-inflammatory', type_cn: '抗炎', count: 134 },
  { type_en: 'ACE_inhibitor', type_cn: 'ACE抑制', count: 67 },
  { type_en: 'antidiabetic', type_cn: '抗糖尿病', count: 45 },
  { type_en: 'cytotoxic', type_cn: '细胞毒性', count: 78 },
];

// 模拟仪表盘概览数据（与 PostgreSQL 实际数据保持同步）
const mockDashboardOverview: DashboardOverview = {
  timestamp: new Date().toISOString(),
  summary: {
    total_herbs: 317,
    total_peptides: 7540,
    food_homology_count: 104,
    total_graph_nodes: 0,
    high_quality_herbs: 8,
    high_activity_peptides: 1862,
    category_count: 14,
    activity_type_count: 19,
  },
  ob_distribution: {
    '0-10': 56,
    '10-20': 123,
    '20-30': 156,
    '30-40': 98,
    '40-50': 45,
    '50+': 22,
  },
  dl_distribution: {
    '<0.5': 34,
    '0.5-0.6': 89,
    '0.6-0.7': 156,
    '0.7-0.8': 145,
    '0.8-0.9': 67,
    '>0.9': 9,
  },
  seq_length_distribution: {
    '0-10': 567,
    '10-20': 1234,
    '20-30': 678,
    '30-40': 234,
    '40+': 87,
  },
  categories: mockCategories,
  activity_types: mockActivityTypes.map((a) => ({ type: a.type_cn, count: a.count })),
  enzymes: [
    { enzyme: 'Trypsin', count: 856 },
    { enzyme: 'Chymotrypsin', count: 432 },
    { enzyme: 'Pepsin', count: 234 },
    { enzyme: 'Papain', count: 156 },
  ],
  source_organisms: [
    { organism: 'Homo sapiens', count: 1200 },
    { organism: 'Mus musculus', count: 800 },
    { organism: 'Bos taurus', count: 450 },
    { organism: 'Oryza sativa', count: 234 },
  ],
  top_herbs_by_ob: mockHerbs.map((h) => ({
    name_cn: h.name_cn,
    ob_percent: h.ob_percent ?? 0,
    dl_value: h.dl_value ?? 0,
    compound_count: h.compound_count,
    category: h.category ?? '',
    is_food_homology: (h.is_food_homology ?? true) as boolean,
  })),
  top_active_peptides: mockPeptides.map((p) => ({
    sequence: p.sequence || '',
    activity_value: p.activity_value ?? 0,
    activity_unit: p.activity_unit ?? '',
    source_protein: p.source_protein || '',
    molecular_weight: p.molecular_weight ?? 0,
    hydrolysis_enzyme: p.hydrolysis_enzyme || '',
  })),
  graph_stats: {
    total_nodes: 15000,
    total_edges: 45000,
    herb_nodes: 317,
    compound_nodes: 8000,
    target_nodes: 4500,
    disease_nodes: 2000,
  },
};

// 模拟趋势数据
const mockDashboardTrends: DashboardTrends = {
  ob_dl_scatter: mockHerbs.map((h) => ({
    x: h.ob_percent ?? 0,
    y: h.dl_value ?? 0,
    name: h.name_cn,
    category: h.category ?? '',
    is_food_homology: (h.is_food_homology ?? false) as boolean,
  })),
  compound_target_correlation: Array.from({ length: 20 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 50,
    name: `数据点${i + 1}`,
  })),
  mw_activity_scatter: mockPeptides.map((p) => ({
    x: p.molecular_weight ?? 0,
    y: p.activity_value ?? 0,
    seq_len: p.sequence?.length || 0,
    source: p.source_organism ?? '',
  })),
  category_effect_heatmap: [
    { category: '补气药', effect: '增强免疫', value: 0.85 },
    { category: '补气药', effect: '抗氧化', value: 0.72 },
    { category: '补血药', effect: '改善循环', value: 0.88 },
    { category: '补血药', effect: '抗炎', value: 0.65 },
    { category: '清热解毒药', effect: '抗菌', value: 0.91 },
    { category: '清热解毒药', effect: '抗病毒', value: 0.78 },
  ],
  analysis_notes: {
    ob_dl_analysis: '高OB高DL药材占比约23%，适合口服制剂开发',
    compound_target: '平均每个化合物关联3.2个靶点',
    mw_activity: '低分子量肽段通常具有更好的生物活性',
    category_effect: '补气药与免疫调节功效关联性最强',
  },
};

// 模拟交叉搜索结果
const firstHerb = mockHerbs[0] || {};
const mockCrossSearchResults: CrossSearchResult[] = [
  {
    herb: {
      name_cn: firstHerb.name_cn ?? '',
      name_latin: firstHerb.name_latin ?? '',
      effects: firstHerb.effects ?? '',
      category: firstHerb.category ?? '',
      ob_percent: firstHerb.ob_percent ?? 0,
      compound_count: firstHerb.compound_count ?? 0,
    },
    compounds: [],
    related_peptides: [],
    match_summary: {
      total_compounds: 156,
      matched_peptides: 12,
      high_relevance_peptides: 8,
    },
  },
];

// 模拟数据质量报告
const mockDataQuality: DataQualityReport = {
  generated_at: new Date().toISOString(),
  herb_data: {
    total_records: 317,
    quality_score: 87,
    grade: 'A',
    field_completeness: {
      name_cn: 100,
      name_latin: 95,
      category: 98,
      effects: 89,
      ob_percent: 78,
      dl_value: 72,
      compound_count: 85,
    },
    health_indicators: {
      with_compounds: 425,
      with_targets: 380,
      food_homology_mapped: 104,
      high_quality_records: 420,
    },
  },
  peptide_data: {
    total_records: 2800,
    quality_score: 82,
    grade: 'B',
    field_completeness: {
      sequence: 100,
      source_protein: 85,
      activity_type: 92,
      activity_value: 78,
      molecular_weight: 95,
    },
    health_indicators: {
      with_sequence: 2800,
      with_activity: 2450,
      high_activity_records: 1800,
    },
  },
  overall_score: 85,
  recommendations: ['继续保持数据质量', '建议增加更多药食同源品种'],
};

// 模拟搜索建议
const mockSearchSuggestions = [
  { keyword: '黄芪', type: 'herb', count: 156 },
  { keyword: '甘草', type: 'herb', count: 189 },
  { keyword: '当归', type: 'herb', count: 203 },
  { keyword: '枸杞', type: 'herb', count: 67 },
  { keyword: 'ACE抑制', type: 'activity', count: 67 },
  { keyword: '抗氧化', type: 'activity', count: 156 },
  { keyword: '抗炎', type: 'activity', count: 134 },
];

// 模拟同步统计数据
const mockSyncStats = {
  tcmsp: {
    total_herbs: 317,
    food_homology_count: 104,
    kb_total: 317,
    categories: {},
    last_sync: null,
    snapshot_id: null,
  },
  dfbp: {
    total_peptides: 7540,
    kb_total: 7540,
    activity_types: {},
    last_sync: null,
    snapshot_id: null,
  },
  knowledge_graph: {
    total_herbs: 317,
    total_compounds: 33482,
    total_targets: 110,
    total_diseases: 296,
    total_peptides: 7540,
    total_proteins: 131,
    total_foods: 104,
    herb_categories: [],
    peptide_activity_types: [],
    herb_interactions: 221,
    synergy_count: 206,
    antagonism_count: 15,
    food_homology_herbs: 104,
    estimated_total_edges: 851,
    node_type_breakdown: {
      herb: 317,
      compound: 33482,
      target: 110,
      disease: 296,
      peptide: 7540,
      protein: 131,
      food: 104,
    },
    total_nodes: 42098,
  },
  last_sync: new Date().toISOString(),
  sync_status: 'success' as const,
  errors: [] as string[],
};

// 模拟 SymMap 药材数据
const mockSymmapHerbs: SymMapHerb[] = [
  {
    id: 1,
    symmapId: 1,
    nameCn: '人参',
    nameLatin: 'Panax ginseng',
    namePinyin: 'ren shen',
    nameEng: 'Ginseng',
    natureCn: '甘、微苦，微温',
    meridiansCn: '脾、肺、心、肾经',
    categoryCn: '补气药',
    usePart: '根及根茎',
    tcmspId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    symmapId: 2,
    nameCn: '黄芪',
    nameLatin: 'Astragalus membranaceus',
    namePinyin: 'huang qi',
    natureCn: '甘，微温',
    meridiansCn: '脾、肺经',
    categoryCn: '补气药',
    usePart: '根',
    tcmspId: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    symmapId: 3,
    nameCn: '当归',
    nameLatin: 'Angelica sinensis',
    namePinyin: 'dang gui',
    natureCn: '甘、辛，温',
    meridiansCn: '肝、心、脾经',
    categoryCn: '补血药',
    usePart: '根',
    tcmspId: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    symmapId: 4,
    nameCn: '枸杞子',
    nameLatin: 'Lycium barbarum',
    namePinyin: 'gou qi zi',
    natureCn: '甘，平',
    meridiansCn: '肝、肾经',
    categoryCn: '补阴药',
    usePart: '果实',
    tcmspId: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 5,
    symmapId: 5,
    nameCn: '甘草',
    nameLatin: 'Glycyrrhiza uralensis',
    namePinyin: 'gan cao',
    natureCn: '甘，平',
    meridiansCn: '心、肺、脾、胃经',
    categoryCn: '补气药',
    usePart: '根及根茎',
    tcmspId: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// 模拟 API 实现
export const mockDatabaseApi = {
  searchHerbs: (params: {
    keyword?: string;
    category?: string;
    food_homology_only?: boolean;
    page?: number;
    page_size?: number;
  }) => {
    let filtered = [...mockHerbs];
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (h) =>
          h.name_cn.toLowerCase().includes(kw) ||
          (h.name_latin?.toLowerCase().includes(kw) ?? false) ||
          (h.name_pinyin?.toLowerCase().includes(kw) ?? false) ||
          (h.effects?.toLowerCase().includes(kw) ?? false),
      );
    }
    if (params.category) {
      filtered = filtered.filter((h) => h.category === params.category);
    }
    if (params.food_homology_only) {
      filtered = filtered.filter((h) => h.is_food_homology);
    }
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return Promise.resolve({
      items: filtered.slice(start, end),
      total: filtered.length,
      page,
      page_size: pageSize,
    });
  },

  getHerb: (id: number) => {
    const herb = mockHerbs.find((h) => h.id === id);
    return Promise.resolve(herb ?? null);
  },

  getCategories: () => {
    return Promise.resolve({ categories: mockCategories });
  },

  getFoodHomologyHerbs: (params: { keyword?: string; page?: number; page_size?: number }) => {
    let filtered = mockHerbs.filter((h) => h.is_food_homology);
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (h) => h.name_cn.toLowerCase().includes(kw) || (h.name_latin?.toLowerCase().includes(kw) ?? false),
      );
    }
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return Promise.resolve({
      items: filtered.slice(start, end),
      total: filtered.length,
      page,
      page_size: pageSize,
    });
  },

  checkFoodHomology: (herbName: string) => {
    const herb = mockHerbs.find((h) => h.name_cn === herbName);
    return Promise.resolve({ is_food_homology: herb?.is_food_homology ?? false });
  },

  searchPeptides: (params: { keyword?: string; activity_type?: string; page?: number; page_size?: number }) => {
    let filtered = [...mockPeptides];
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (p) => (p.sequence || '').toLowerCase().includes(kw) || (p.source_protein || '').toLowerCase().includes(kw),
      );
    }
    if (params.activity_type) {
      filtered = filtered.filter((p) => p.activity_type === params.activity_type);
    }
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return Promise.resolve({
      items: filtered.slice(start, end),
      total: filtered.length,
      page,
      page_size: pageSize,
    });
  },

  getPeptide: (id: number) => {
    const peptide = mockPeptides.find((p) => p.id === id);
    return Promise.resolve(peptide ?? null);
  },

  getActivityTypes: () => {
    return Promise.resolve({ activity_types: mockActivityTypes });
  },

  searchKnowledge: (params: { keyword?: string; node_type?: string; page?: number; page_size?: number }) => {
    let filtered = [...mockGraphNodes];
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      filtered = filtered.filter((n) => n.node_label.toLowerCase().includes(kw));
    }
    if (params.node_type) {
      filtered = filtered.filter((n) => n.node_type === params.node_type);
    }
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return Promise.resolve({
      items: filtered.slice(start, end),
      total: filtered.length,
      page,
      page_size: pageSize,
    });
  },

  unifiedSearch: (params: { keyword: string; page?: number; page_size?: number }) => {
    const kw = params.keyword.toLowerCase();
    const herbs = mockHerbs.filter(
      (h) => h.name_cn.toLowerCase().includes(kw) || (h.name_latin?.toLowerCase().includes(kw) ?? false),
    );
    const peptides = mockPeptides.filter(
      (p) => (p.sequence || '').toLowerCase().includes(kw) || (p.source_protein || '').toLowerCase().includes(kw),
    );
    const nodes = mockGraphNodes.filter((n) => n.node_label.toLowerCase().includes(kw));
    return Promise.resolve({
      herbs: herbs.slice(0, 5),
      peptides: peptides.slice(0, 5),
      knowledge_nodes: nodes.slice(0, 5),
      total: herbs.length + peptides.length + nodes.length,
    });
  },

  getSyncStats: () => Promise.resolve(mockSyncStats),

  getDashboardOverview: () => Promise.resolve(mockDashboardOverview),

  getDashboardTrends: () => Promise.resolve(mockDashboardTrends),

  getSearchSuggestions: (keyword: string, limit = 10) => {
    const kw = keyword.toLowerCase();
    const suggestions = mockSearchSuggestions.filter((s) => s.keyword.toLowerCase().includes(kw));
    return Promise.resolve(suggestions.slice(0, limit));
  },

  crossSearch: (herbName: string) => {
    const result = mockCrossSearchResults.find((r) => r.herb.name_cn === herbName);
    return Promise.resolve(result ?? null);
  },

  getDataQuality: () => Promise.resolve(mockDataQuality),

  searchSymmapHerbs: (params: { keyword?: string; page?: number; page_size?: number }) => {
    let filtered = [...mockSymmapHerbs];
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (h) =>
          h.nameCn.toLowerCase().includes(kw) ||
          (h.nameLatin?.toLowerCase().includes(kw) ?? false) ||
          (h.namePinyin?.toLowerCase().includes(kw) ?? false),
      );
    }
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return Promise.resolve({
      items: filtered.slice(start, end),
      total: filtered.length,
      page,
      page_size: pageSize,
    });
  },
};
