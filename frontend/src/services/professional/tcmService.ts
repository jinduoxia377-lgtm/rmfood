import { ProfessionalBaseService } from './ProfessionalBaseService';
import type { ProfessionalServiceConfig } from '../../types/professional';

export interface TCMHerb {
  id: string;
  name: string;
  latinName: string;
  family: string;
  synonyms: string[];
  distribution: string[];
  description: string;
  indications: string[];
  properties: {
    nature: string;
    flavor: string[];
    meridian: string[];
    toxicity?: string;
  };
  dosage: {
    amount: string;
    unit: string;
    preparations: string[];
  };
  contraindications: string[];
  sideEffects: string[];
  chemistry: TCMChemistry;
}

export interface TCMChemistry {
  compoundId: string;
  name: string;
  englishName?: string;
  molecularFormula?: string;
  molecularWeight?: number;
  smiles?: string;
  casNumber?: string;
  structure?: string;
  absorption?: string;
  distribution?: string;
  metabolism?: string;
  excretion?: string;
  halfLife?: string;
  toxicity?: string;
  targets: TCMTarget[];
  diseases: TCMDisease[];
  pathways: string[];
}

export interface TCMTarget {
  geneName: string;
  geneSymbol: string;
  proteinName: string;
  uniprotId: string;
  species: string;
  affinity?: number;
  evidence: string[];
  pathways: string[];
}

export interface TCMDisease {
  diseaseName: string;
  diseaseId: string;
  omimId?: string;
  relatedTargets: number;
  evidenceLevel: string;
  mechanisms: string[];
}

export interface TCMSearchParams {
  keyword?: string;
  family?: string;
  nature?: string;
  flavor?: string[];
  meridian?: string[];
  page?: number;
  pageSize?: number;
}

export interface TCMCompoundSearchParams {
  herbId?: string;
  molecularWeight?: { min?: number; max?: number };
  drugLikeness?: boolean;
  page?: number;
  pageSize?: number;
}

export interface TCMPredictionParams {
  compoundSmiles: string;
  predictTargets?: boolean;
  predictDiseases?: boolean;
  predictPathways?: boolean;
}

export interface TCMPredictionResult {
  targets: TCMTarget[];
  diseases: TCMDisease[];
  pathways: string[];
  confidence: number;
  algorithm: string;
}

export interface TCMChemistryVisualization {
  smiles: string;
  svgData: string;
  atoms: number;
  bonds: number;
  complexity: number;
  logP?: number;
  hbd?: number;
  hba?: number;
  tpsa?: number;
}

class TCMService extends ProfessionalBaseService {
  private mockMode = true;
  private mockData = new Map<string, TCMHerb>();

  constructor(config: ProfessionalServiceConfig = {}) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://old.tcmsp-e.com',
      cacheDuration: 30 * 60 * 1000,
    });
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const mockHerbs: TCMHerb[] = [
      {
        id: 'TCM001',
        name: '人参',
        latinName: 'Panax ginseng C.A.Mey.',
        family: '五加科 (Araliaceae)',
        synonyms: ['人参', '棒槌', '山参', '园参', '吉林参'],
        distribution: ['中国东北', '朝鲜', '俄罗斯'],
        description: '人参是传统中药中的名贵药材，具有大补元气、复脉固脱、补脾益肺、生津养血的功效。',
        indications: ['气虚欲脱', '脾虚食少', '肺虚喘咳', '津伤口渴', '内热消渴', '气血亏虚', '惊悸失眠'],
        properties: {
          nature: '温',
          flavor: ['甘', '微苦'],
          meridian: ['脾', '肺', '心'],
          toxicity: '无',
        },
        dosage: {
          amount: '3-9',
          unit: '克',
          preparations: ['煎汤', '泡酒', '炖服', '研末吞服'],
        },
        contraindications: ['实热证', '阴虚火旺', '失眠烦躁'],
        sideEffects: ['过量可引起兴奋', '失眠', '心悸', '血压升高'],
        chemistry: {
          compoundId: ' ginsenoside-Rg1',
          name: '人参皂苷 Rg1',
          englishName: 'Ginsenoside Rg1',
          molecularFormula: 'C42H72O14',
          molecularWeight: 801.01,
          smiles: 'CC1C(C(C(C(O1)OC2C(C(C(O2)C)OC3C(C(C(OC3C)OC4C(C(C(OC4C)OC5C(C(C(C(O5)C)O)O)C)O)C)CO)O)C)O)C)O)O',
          casNumber: '22427-39-0',
          targets: [
            {
              geneName: '血管内皮生长因子',
              geneSymbol: 'VEGF',
              proteinName: 'Vascular Endothelial Growth Factor',
              uniprotId: 'P15692',
              species: 'Homo sapiens',
              affinity: 7.5,
              evidence: ['Western Blot', 'ELISA'],
              pathways: ['PI3K/AKT signaling', 'MAPK signaling'],
            },
            {
              geneName: '过氧化物酶体增殖物激活受体γ',
              geneSymbol: 'PPARG',
              proteinName: 'Peroxisome proliferator-activated receptor gamma',
              uniprotId: 'P37231',
              species: 'Homo sapiens',
              affinity: 6.8,
              evidence: ['qPCR', 'Reporter assay'],
              pathways: ['PPAR signaling pathway'],
            },
          ],
          diseases: [
            {
              diseaseName: '2型糖尿病',
              diseaseId: 'T2D001',
              omimId: '125853',
              relatedTargets: 5,
              evidenceLevel: 'Strong',
              mechanisms: ['改善胰岛素敏感性', '促进葡萄糖摄取'],
            },
            {
              diseaseName: '心血管疾病',
              diseaseId: 'CVD001',
              relatedTargets: 8,
              evidenceLevel: 'Moderate',
              mechanisms: ['保护血管内皮', '抗炎', '抗氧化'],
            },
          ],
          pathways: ['PI3K/AKT signaling', 'MAPK signaling', 'PPAR signaling pathway'],
        },
      },
      {
        id: 'TCM002',
        name: '黄芪',
        latinName: 'Astragalus membranaceus (Fisch.) Bunge',
        family: '豆科 (Fabaceae)',
        synonyms: ['黄芪', '北芪', '绵芪', '口芪'],
        distribution: ['中国北方', '内蒙古', '山西', '甘肃'],
        description: '黄芪具有补气升阳、固表止汗、利水消肿、生津养血的功效。',
        indications: ['气虚乏力', '食少便溏', '久泻脱肛', '子宫脱垂', '崩漏', '表虚自汗', '气血不足'],
        properties: {
          nature: '微温',
          flavor: ['甘'],
          meridian: ['脾', '肺'],
          toxicity: '无',
        },
        dosage: {
          amount: '9-30',
          unit: '克',
          preparations: ['煎汤', '入丸散', '炖肉'],
        },
        contraindications: ['表实邪盛', '气滞湿阻', '食积腹胀'],
        sideEffects: ['过量可引起头晕', '面部浮肿'],
        chemistry: {
          compoundId: 'astragaloside-IV',
          name: '黄芪甲苷',
          englishName: 'Astragaloside IV',
          molecularFormula: 'C41H68O14',
          molecularWeight: 785.0,
          smiles: 'CC1C(C(C(C(O1)OC2C(C(C(O2)C)OC3C(C(C(OC3C)OC4C(C(C(OC4C)C)OC5C(C(C(C(O5)C)O)O)C)O)C)CO)O)C)O)O',
          casNumber: '84687-43-4',
          targets: [
            {
              geneName: '转化生长因子β1',
              geneSymbol: 'TGFB1',
              proteinName: 'Transforming Growth Factor Beta 1',
              uniprotId: 'P01137',
              species: 'Homo sapiens',
              affinity: 8.2,
              evidence: ['ELISA', 'Western Blot'],
              pathways: ['TGF-beta signaling'],
            },
          ],
          diseases: [
            {
              diseaseName: '免疫功能低下',
              diseaseId: 'IMM001',
              relatedTargets: 3,
              evidenceLevel: 'Strong',
              mechanisms: ['增强免疫功能', '促进抗体生成'],
            },
          ],
          pathways: ['TGF-beta signaling', 'PI3K/AKT signaling', 'JAK-STAT signaling'],
        },
      },
      {
        id: 'TCM003',
        name: '当归',
        latinName: 'Angelica sinensis (Oliv.) Diels',
        family: '伞形科 (Umbelliferae)',
        synonyms: ['当归', '秦归', '云归', '岷归'],
        distribution: ['中国甘肃', '云南', '四川', '湖北'],
        description: '当归具有补血活血、调经止痛、润肠通便的功效。',
        indications: ['血虚萎黄', '眩晕心悸', '月经不调', '经闭痛经', '虚寒腹痛', '肠燥便秘'],
        properties: {
          nature: '温',
          flavor: ['甘', '辛'],
          meridian: ['肝', '心', '脾'],
          toxicity: '无',
        },
        dosage: {
          amount: '6-12',
          unit: '克',
          preparations: ['煎汤', '入丸散', '泡酒'],
        },
        contraindications: ['湿盛中满', '大便泄泻', '崩漏经多'],
        sideEffects: ['过量可引起血压下降', '嗜睡'],
        chemistry: {
          compoundId: 'ferulic-acid',
          name: '阿魏酸',
          englishName: 'Ferulic acid',
          molecularFormula: 'C10H10O4',
          molecularWeight: 194.18,
          smiles: 'CC(=CC1=CC(=C(C=C1)O)O)O',
          casNumber: '1135-24-6',
          targets: [
            {
              geneName: '核因子κB',
              geneSymbol: 'NFKB1',
              proteinName: 'Nuclear Factor Kappa B',
              uniprotId: 'P19838',
              species: 'Homo sapiens',
              affinity: 7.1,
              evidence: ['EMSA', 'Luciferase assay'],
              pathways: ['NF-kB signaling', 'Inflammatory response'],
            },
          ],
          diseases: [
            {
              diseaseName: '贫血',
              diseaseId: 'ANEMIA001',
              relatedTargets: 4,
              evidenceLevel: 'Strong',
              mechanisms: ['促进造血', '改善微循环'],
            },
          ],
          pathways: ['NF-kB signaling', 'Apoptosis pathway', 'Cell cycle regulation'],
        },
      },
      {
        id: 'TCM004',
        name: '甘草',
        latinName: 'Glycyrrhiza uralensis Fisch.',
        family: '豆科 (Fabaceae)',
        synonyms: ['甘草', '国老', '蜜甘', '蜜草', '甜草'],
        distribution: ['中国北方', '西北', '东北'],
        description: '甘草具有补脾益气、清热解毒、祛痰止咳、缓急止痛、调和诸药的功效。',
        indications: ['脾胃虚弱', '倦怠乏力', '心悸气短', '咳嗽痰多', '脘腹疼痛', '痈肿疮毒', '缓解药物毒性'],
        properties: {
          nature: '平',
          flavor: ['甘'],
          meridian: ['心', '肺', '脾', '胃'],
          toxicity: '有小毒（长期大量服用）',
        },
        dosage: {
          amount: '2-10',
          unit: '克',
          preparations: ['煎汤', '入丸散', '外用研末'],
        },
        contraindications: ['湿盛胀满', '水肿', '高血压'],
        sideEffects: ['长期服用可引起钠潴留', '血压升高', '低血钾'],
        chemistry: {
          compoundId: 'glycyrrhizin',
          name: '甘草酸',
          englishName: 'Glycyrrhizin',
          molecularFormula: 'C42H62O16',
          molecularWeight: 822.93,
          smiles:
            'CC1C(C(C(C(O1)OC2C(C(C(O2)C)OC3C(C(C(OC3C)OC4C(C(C(OC4C)OC5C(C(C(C(O5)C)O)O)C)O)C)CO)O)C)O)O)C(=O)C(=O)O',
          casNumber: '1405-86-3',
          targets: [
            {
              geneName: '盐皮质激素受体',
              geneSymbol: 'NR3C2',
              proteinName: 'Mineralocorticoid Receptor',
              uniprotId: 'P08235',
              species: 'Homo sapiens',
              affinity: 9.1,
              evidence: ['Binding assay', 'Transactivation assay'],
              pathways: ['Mineralocorticoid signaling'],
            },
          ],
          diseases: [
            {
              diseaseName: '肾上腺皮质功能不全',
              diseaseId: 'AI001',
              relatedTargets: 2,
              evidenceLevel: 'Moderate',
              mechanisms: ['拟醛固酮作用', '抗炎'],
            },
          ],
          pathways: ['Mineralocorticoid signaling', 'Glucocorticoid signaling', 'NF-kB signaling'],
        },
      },
      {
        id: 'TCM005',
        name: '丹参',
        latinName: 'Salvia miltiorrhiza Bunge',
        family: '唇形科 (Lamiaceae)',
        synonyms: ['丹参', '红根', '紫丹参', '血参'],
        distribution: ['中国大部分地区', '四川', '安徽', '江苏'],
        description: '丹参具有活血祛瘀、通经止痛、清心除烦、凉血消痈的功效。',
        indications: ['胸痹心痛', '脘腹疼痛', '癥瘕积聚', '热痹疼痛', '心烦不眠', '月经不调', '疮疡肿痛'],
        properties: {
          nature: '微寒',
          flavor: ['苦'],
          meridian: ['心', '肝'],
          toxicity: '无',
        },
        dosage: {
          amount: '10-15',
          unit: '克',
          preparations: ['煎汤', '入丸散', '注射剂'],
        },
        contraindications: ['孕妇慎用', '出血性疾病'],
        sideEffects: ['偶有胃部不适', '皮疹'],
        chemistry: {
          compoundId: 'tanshinone-IIA',
          name: '丹参酮 IIA',
          englishName: 'Tanshinone IIA',
          molecularFormula: 'C19H18O3',
          molecularWeight: 294.33,
          smiles: 'CC1=C(C(=O)C2=C(C1=O)C=C(C2)C(C)C)C',
          casNumber: '568-72-9',
          targets: [
            {
              geneName: '血管内皮生长因子受体2',
              geneSymbol: 'KDR',
              proteinName: 'Kinase Insert Domain Receptor',
              uniprotId: 'P35968',
              species: 'Homo sapiens',
              affinity: 7.8,
              evidence: ['Kinase assay', 'Cell proliferation assay'],
              pathways: ['VEGF signaling', 'Angiogenesis'],
            },
          ],
          diseases: [
            {
              diseaseName: '冠心病',
              diseaseId: 'CAD001',
              relatedTargets: 6,
              evidenceLevel: 'Strong',
              mechanisms: ['扩张冠状动脉', '改善心肌供血', '抗血小板聚集'],
            },
          ],
          pathways: ['VEGF signaling', 'Apoptosis pathway', 'Cell proliferation'],
        },
      },
    ];

    mockHerbs.forEach((herb) => {
      this.mockData.set(herb.id, herb);
      this.mockData.set(herb.name, herb);
      this.mockData.set(herb.latinName, herb);
    });
  }

  public enableMockMode(enable: boolean): void {
    this.mockMode = enable;
  }

  public async searchHerbs(params: TCMSearchParams): Promise<{
    herbs: TCMHerb[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const cacheKey = this.getCacheKey('/herbs/search', params);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      return this.mockSearchHerbs(params);
    }

    return this.get<any>(`/api/herbs/search`, params);
  }

  private mockSearchHerbs(params: TCMSearchParams): any {
    let results = Array.from(this.mockData.values()).filter((herb) => herb.id.startsWith('TCM'));

    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      results = results.filter(
        (herb) =>
          herb.name.includes(keyword) ||
          herb.latinName.toLowerCase().includes(keyword) ||
          herb.synonyms.some((s) => s.includes(keyword)),
      );
    }

    if (params.family) {
      results = results.filter((herb) => herb.family.includes(params.family!));
    }

    if (params.nature) {
      results = results.filter((herb) => herb.properties.nature.includes(params.nature!));
    }

    if (params.flavor && params.flavor.length > 0) {
      results = results.filter((herb) => params.flavor!.some((f) => herb.properties.flavor.includes(f)));
    }

    if (params.meridian && params.meridian.length > 0) {
      results = results.filter((herb) => params.meridian!.some((m) => herb.properties.meridian.includes(m)));
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = results.length;
    const start = (page - 1) * pageSize;
    const pagedResults = results.slice(start, start + pageSize);

    const result = {
      herbs: pagedResults,
      total,
      page,
      pageSize,
    };

    this.setCache(this.getCacheKey('/herbs/search', params), result);
    return result;
  }

  public async getHerbById(herbId: string): Promise<TCMHerb | null> {
    const cacheKey = `/herbs/${herbId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const herb = this.mockData.get(herbId);
      if (herb) {
        this.setCache(cacheKey, herb);
        return herb;
      }
      return null;
    }

    try {
      const herb = await this.get<TCMHerb>(`/api/herbs/${herbId}`);
      this.setCache(cacheKey, herb);
      return herb;
    } catch {
      return null;
    }
  }

  public async getHerbByName(name: string): Promise<TCMHerb | null> {
    const cacheKey = `/herbs/name/${name}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const herb = this.mockData.get(name);
      if (herb) {
        this.setCache(cacheKey, herb);
        return herb;
      }
      return null;
    }

    try {
      const herb = await this.get<TCMHerb>(`/api/herbs/name/${encodeURIComponent(name)}`);
      this.setCache(cacheKey, herb);
      return herb;
    } catch {
      return null;
    }
  }

  public async getHerbCompounds(
    herbId: string,
    params?: TCMCompoundSearchParams,
  ): Promise<{
    compounds: TCMChemistry[];
    total: number;
  }> {
    const cacheKey = this.getCacheKey(`/herbs/${herbId}/compounds`, params);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const herb = this.mockData.get(herbId);
      if (!herb) {
        return { compounds: [], total: 0 };
      }

      let compounds = [herb.chemistry];

      if (params?.molecularWeight) {
        compounds = compounds.filter((c) => {
          if (!c.molecularWeight) return true;
          if (params.molecularWeight!.min && c.molecularWeight < params.molecularWeight!.min) return false;
          if (params.molecularWeight!.max && c.molecularWeight > params.molecularWeight!.max) return false;
          return true;
        });
      }

      const result = {
        compounds,
        total: compounds.length,
      };

      this.setCache(cacheKey, result);
      return result;
    }

    return this.get<any>(`/api/herbs/${herbId}/compounds`, params);
  }

  public async predictTargets(params: TCMPredictionParams): Promise<TCMTarget[]> {
    if (this.mockMode) {
      return this.mockPredictTargets(params);
    }

    return this.post<TCMTarget[]>(`/api/predict/targets`, params);
  }

  private mockPredictTargets(params: TCMPredictionParams): TCMTarget[] {
    void params;
    const mockTargets: TCMTarget[] = [
      {
        geneName: '预测靶点1',
        geneSymbol: 'PRED1',
        proteinName: 'Predicted Target 1',
        uniprotId: 'PRED001',
        species: 'Homo sapiens',
        affinity: 7.0,
        evidence: ['Prediction algorithm'],
        pathways: ['Predicted pathway'],
      },
      {
        geneName: '预测靶点2',
        geneSymbol: 'PRED2',
        proteinName: 'Predicted Target 2',
        uniprotId: 'PRED002',
        species: 'Homo sapiens',
        affinity: 6.5,
        evidence: ['Prediction algorithm'],
        pathways: ['Predicted pathway'],
      },
    ];

    return mockTargets;
  }

  public async predictDiseases(params: TCMPredictionParams): Promise<TCMDisease[]> {
    if (this.mockMode) {
      return this.mockPredictDiseases(params);
    }

    return this.post<TCMDisease[]>(`/api/predict/diseases`, params);
  }

  private mockPredictDiseases(params: TCMPredictionParams): TCMDisease[] {
    void params;
    const mockDiseases: TCMDisease[] = [
      {
        diseaseName: '预测疾病1',
        diseaseId: 'PRED-D001',
        relatedTargets: 3,
        evidenceLevel: 'Predicted',
        mechanisms: ['预测机制1'],
      },
    ];

    return mockDiseases;
  }

  public async predictPathways(params: TCMPredictionParams): Promise<string[]> {
    if (this.mockMode) {
      return this.mockPredictPathways(params);
    }

    return this.post<string[]>(`/api/predict/pathways`, params);
  }

  private mockPredictPathways(params: TCMPredictionParams): string[] {
    void params;
    return ['Predicted pathway 1', 'Predicted pathway 2', 'Predicted pathway 3'];
  }

  public async getFullPrediction(params: TCMPredictionParams): Promise<TCMPredictionResult> {
    if (this.mockMode) {
      const [targets, diseases, pathways] = await Promise.all([
        this.mockPredictTargets(params),
        this.mockPredictDiseases(params),
        this.mockPredictPathways(params),
      ]);

      return {
        targets,
        diseases,
        pathways,
        confidence: 0.85,
        algorithm: 'Mock prediction',
      };
    }

    return this.post<TCMPredictionResult>(`/api/predict/full`, params);
  }

  public async visualizeChemistry(smiles: string): Promise<TCMChemistryVisualization> {
    if (this.mockMode) {
      return this.mockVisualizeChemistry(smiles);
    }

    return this.post<TCMChemistryVisualization>(`/api/chemistry/visualize`, { smiles });
  }

  private mockVisualizeChemistry(smiles: string): TCMChemistryVisualization {
    const svgData = this.generateSVGFromSMILES(smiles);

    return {
      smiles,
      svgData,
      atoms: this.countAtomsFromSMILES(smiles),
      bonds: this.countBondsFromSMILES(smiles),
      complexity: this.calculateComplexity(smiles),
      logP: 2.5,
      hbd: 2,
      hba: 3,
      tpsa: 75.0,
    };
  }

  private generateSVGFromSMILES(smiles: string): string {
    const atomPositions = this.parseAtomPositions(smiles);
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">`;

    svgContent += `<rect width="300" height="200" fill="#ffffff"/>`;
    svgContent += `<text x="150" y="100" text-anchor="middle" font-size="12" fill="#333">SMILES: ${smiles}</text>`;

    atomPositions.forEach((atom, index) => {
      const x = 50 + (index % 5) * 50;
      const y = 50 + Math.floor(index / 5) * 40;
      svgContent += `<circle cx="${x}" cy="${y}" r="15" fill="#e0e0e0" stroke="#333" stroke-width="1"/>`;
      svgContent += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10" fill="#333">${atom}</text>`;
    });

    svgContent += `</svg>`;
    return svgContent;
  }

  private parseAtomPositions(smiles: string): string[] {
    const atoms: string[] = [];
    const organicSubset = ['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I'];

    for (let i = 0; i < smiles.length; i++) {
      const char = smiles[i];
      if (organicSubset.includes(char)) {
        if (char === 'C' && smiles[i + 1] === 'l') {
          atoms.push('Cl');
          i++;
        } else if (char === 'B' && smiles[i + 1] === 'r') {
          atoms.push('Br');
          i++;
        } else {
          atoms.push(char);
        }
      }
    }

    return atoms.slice(0, 10);
  }

  private countAtomsFromSMILES(smiles: string): number {
    return this.parseAtomPositions(smiles).length;
  }

  private countBondsFromSMILES(smiles: string): number {
    let bonds = 0;
    for (let i = 0; i < smiles.length; i++) {
      const char = smiles[i];
      if (char === '-' || char === '=' || char === '#') {
        bonds++;
      } else if (char === '(') {
        const nextChar = smiles[i + 1];
        if (nextChar && organicAtoms.includes(nextChar)) {
          bonds++;
        }
      }
    }
    return Math.max(bonds, this.countAtomsFromSMILES(smiles) - 1);
  }

  private calculateComplexity(smiles: string): number {
    const atoms = this.countAtomsFromSMILES(smiles);
    const bonds = this.countBondsFromSMILES(smiles);
    return Math.sqrt(atoms * bonds) * 10;
  }

  public async getHerbNetwork(herbId: string): Promise<{
    nodes: { id: string; label: string; type: string }[];
    edges: { source: string; target: string; weight: number }[];
  }> {
    const cacheKey = `/herbs/${herbId}/network`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const herb = this.mockData.get(herbId);
      if (!herb) {
        return { nodes: [], edges: [] };
      }

      const nodes = [
        { id: herb.id, label: herb.name, type: 'herb' },
        ...herb.chemistry.targets.map((t) => ({
          id: t.uniprotId,
          label: t.geneSymbol,
          type: 'target',
        })),
        ...herb.chemistry.diseases.map((d) => ({
          id: d.diseaseId,
          label: d.diseaseName,
          type: 'disease',
        })),
      ];

      const edges = [
        ...herb.chemistry.targets.map((t) => ({
          source: herb.id,
          target: t.uniprotId,
          weight: t.affinity || 7.0,
        })),
        ...herb.chemistry.diseases.map((d) => ({
          source: herb.id,
          target: d.diseaseId,
          weight: d.relatedTargets,
        })),
      ];

      const result = { nodes, edges };
      this.setCache(cacheKey, result);
      return result;
    }

    return this.get<any>(`/api/herbs/${herbId}/network`);
  }

  public async getRelatedHerbs(herbId: string): Promise<TCMHerb[]> {
    if (this.mockMode) {
      const herb = this.mockData.get(herbId);
      if (!herb) return [];

      const related = Array.from(this.mockData.values())
        .filter((h) => h.id !== herbId)
        .filter(
          (h) =>
            h.properties.nature === herb.properties.nature ||
            h.properties.flavor.some((f) => herb.properties.flavor.includes(f)) ||
            h.properties.meridian.some((m) => herb.properties.meridian.includes(m)),
        )
        .slice(0, 5);

      return related;
    }

    return this.get<TCMHerb[]>(`/api/herbs/${herbId}/related`);
  }

  public clearHerbCache(herbId?: string): void {
    if (herbId) {
      this.clearCacheByPattern(`/herbs/${herbId}`);
    } else {
      this.clearCache();
    }
  }

  public getServiceInfo(): {
    mockMode: boolean;
    cachedItems: number;
    availableHerbs: number;
  } {
    return {
      mockMode: this.mockMode,
      cachedItems: this.getCacheStats().size,
      availableHerbs: Array.from(this.mockData.values()).filter((h) => h.id.startsWith('TCM')).length,
    };
  }
}

const tcmService = new TCMService();

export default tcmService;
export { TCMService };

const organicAtoms = ['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I'];
