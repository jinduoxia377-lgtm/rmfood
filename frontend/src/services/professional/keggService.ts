import { ProfessionalBaseService } from './ProfessionalBaseService';
import type { ProfessionalServiceConfig } from '../../types/professional';

export interface KEGGPathway {
  pathwayId: string;
  name: string;
  nameEn: string;
  organism: string;
  class: string;
  description: string;
  entries: KEGGEntry[];
  genes: KEGGGene[];
  compounds: KEGGCompound[];
  reactions: KEGGReaction[];
  imageUrl?: string;
  mapUrl?: string;
}

export interface KEGGEntry {
  id: string;
  type: 'gene' | 'compound' | 'reaction' | 'pathway' | 'disease';
  name: string;
  symbol?: string;
  position?: { x: number; y: number };
}

export interface KEGGGene {
  geneId: string;
  symbol: string;
  name: string;
  description?: string;
  orthologs?: string[];
  pathways?: string[];
}

export interface KEGGCompound {
  compoundId: string;
  name: string;
  formula?: string;
  mass?: number;
  smiles?: string;
  inchikey?: string;
  pathways?: string[];
}

export interface KEGGReaction {
  reactionId: string;
  name: string;
  equation: string;
  substrates: string[];
  products: string[];
  enzymes?: string[];
}

export interface KEGGOrganism {
  code: string;
  name: string;
  scientificName: string;
  taxonomy: string;
}

export interface KEGGSearchResult {
  results: {
    id: string;
    type: 'pathway' | 'gene' | 'compound' | 'reaction';
    name: string;
    organism?: string;
  }[];
  total: number;
}

export interface PathwayEnrichmentResult {
  pathwayId: string;
  name: string;
  pValue: number;
  qValue: number;
  geneCount: number;
  geneRatio: number;
  genes: string[];
}

export interface KEGGModule {
  moduleId: string;
  name: string;
  description: string;
  genes: string[];
  pathways: string[];
}

class KEGGService extends ProfessionalBaseService {
  private mockMode = true;
  private mockPathways = new Map<string, KEGGPathway>();
  private mockOrganisms: KEGGOrganism[] = [];

  constructor(config: ProfessionalServiceConfig = {}) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://rest.kegg.jp',
      cacheDuration: 60 * 60 * 1000,
    });
    this.initializeMockData();
  }

  private initializeMockData(): void {
    this.mockOrganisms = [
      { code: 'hsa', name: '人类', scientificName: 'Homo sapiens', taxonomy: 'Eukaryota; Metazoa; Chordata; Craniata; Vertebrata; Mammalia; Eutheria; Euarchontoglires; Primates; Haplorrhini; Catarrhini; Hominidae; Homo' },
      { code: 'mmu', name: '小鼠', scientificName: 'Mus musculus', taxonomy: 'Eukaryota; Metazoa; Chordata; Craniata; Vertebrata; Mammalia; Eutheria; Euarchontoglires; Glires; Rodentia; Myomorpha; Muridae; Murinae; Mus' },
      { code: 'rno', name: '大鼠', scientificName: 'Rattus norvegicus', taxonomy: 'Eukaryota; Metazoa; Chordata; Craniata; Vertebrata; Mammalia; Eutheria; Euarchontoglires; Glires; Rodentia; Myomorpha; Muridae; Murinae; Rattus' },
      { code: 'dme', name: '果蝇', scientificName: 'Drosophila melanogaster', taxonomy: 'Eukaryota; Metazoa; Ecdysozoa; Arthropoda; Hexapoda; Insecta; Pterygota; Neoptera; Holometabola; Diptera; Brachycera; Muscomorpha; Ephydroidea; Drosophilidae; Drosophila' },
      { code: 'sce', name: '酵母', scientificName: 'Saccharomyces cerevisiae', taxonomy: 'Eukaryota; Fungi; Dikarya; Ascomycota; Saccharomycotina; Saccharomycetes; Saccharomycetales; Saccharomycetaceae; Saccharomyces' },
    ];

    const mapkPathway: KEGGPathway = {
      pathwayId: 'hsa04010',
      name: 'MAPK信号通路',
      nameEn: 'MAPK signaling pathway',
      organism: 'hsa',
      class: 'Signal transduction',
      description: '丝裂原活化蛋白激酶（MAPK）信号通路是真核生物中保守的信号传导系统，参与细胞增殖、分化、凋亡等多种生物学过程。',
      entries: [],
      genes: [
        { geneId: 'hsa:3912', symbol: 'MAPK1', name: 'mitogen-activated protein kinase 1', pathways: ['hsa04010', 'hsa04014'] },
        { geneId: 'hsa:5594', symbol: 'MAPK3', name: 'mitogen-activated protein kinase 3', pathways: ['hsa04010', 'hsa04014'] },
        { geneId: 'hsa:1432', symbol: 'MAP2K1', name: 'mitogen-activated protein kinase kinase 1', pathways: ['hsa04010'] },
        { geneId: 'hsa:5604', symbol: 'MAP2K2', name: 'mitogen-activated protein kinase kinase 2', pathways: ['hsa04010'] },
        { geneId: 'hsa:3694', symbol: 'RAF1', name: 'RAF proto-oncogene, serine/threonine kinase', pathways: ['hsa04010'] },
      ],
      compounds: [
        { compoundId: 'C00044', name: 'ATP', formula: 'C10H16N5O13P3', mass: 507.18, pathways: ['hsa04010'] },
        { compoundId: 'C00002', name: 'ADP', formula: 'C10H15N5O10P2', mass: 427.20, pathways: ['hsa04010'] },
        { compoundId: 'C00001', name: '水', formula: 'H2O', mass: 18.02, pathways: ['hsa04010'] },
      ],
      reactions: [
        { reactionId: 'R00100', name: 'ATP hydrolysis', equation: 'ATP + H2O = ADP + Pi', substrates: ['C00044', 'C00001'], products: ['C00002'] },
      ],
      imageUrl: 'https://www.genome.jp/kegg/pathway/hsa/hsa04010.png',
      mapUrl: 'https://www.genome.jp/kegg-bin/show_pathway?hsa04010',
    };

    const pi3kPathway: KEGGPathway = {
      pathwayId: 'hsa04151',
      name: 'PI3K-Akt信号通路',
      nameEn: 'PI3K-Akt signaling pathway',
      organism: 'hsa',
      class: 'Signal transduction',
      description: '磷脂酰肌醇3-激酶（PI3K）-Akt信号通路在细胞存活、增殖、代谢和血管生成中发挥关键作用。',
      entries: [],
      genes: [
        { geneId: 'hsa:5290', symbol: 'AKT1', name: 'AKT serine/threonine kinase 1', pathways: ['hsa04151', 'hsa04010'] },
        { geneId: 'hsa:5291', symbol: 'AKT2', name: 'AKT serine/threonine kinase 2', pathways: ['hsa04151'] },
        { geneId: 'hsa:5292', symbol: 'AKT3', name: 'AKT serine/threonine kinase 3', pathways: ['hsa04151'] },
        { geneId: 'hsa:5294', symbol: 'PIK3CA', name: 'phosphatidylinositol-4,5-bisphosphate 3-kinase catalytic subunit alpha', pathways: ['hsa04151'] },
        { geneId: 'hsa:5289', symbol: 'PIK3R1', name: 'phosphoinositide-3-kinase regulatory subunit 1', pathways: ['hsa04151'] },
      ],
      compounds: [
        { compoundId: 'C00044', name: 'ATP', formula: 'C10H16N5O13P3', mass: 507.18, pathways: ['hsa04151'] },
        { compoundId: 'C00169', name: 'Phosphatidylinositol 4,5-bisphosphate', pathways: ['hsa04151'] },
        { compoundId: 'C01147', name: 'Phosphatidylinositol 3,4,5-trisphosphate', pathways: ['hsa04151'] },
      ],
      reactions: [
        { reactionId: 'R00100', name: 'ATP hydrolysis', equation: 'ATP + H2O = ADP + Pi', substrates: ['C00044', 'C00001'], products: ['C00002'] },
      ],
      imageUrl: 'https://www.genome.jp/kegg/pathway/hsa/hsa04151.png',
      mapUrl: 'https://www.genome.jp/kegg-bin/show_pathway?hsa04151',
    };

    const insulinPathway: KEGGPathway = {
      pathwayId: 'hsa04910',
      name: '胰岛素信号通路',
      nameEn: 'Insulin signaling pathway',
      organism: 'hsa',
      class: 'Signal transduction',
      description: '胰岛素信号通路调节葡萄糖摄取、糖原合成、蛋白质合成和脂肪代谢等过程。',
      entries: [],
      genes: [
        { geneId: 'hsa:3415', symbol: 'INSR', name: 'insulin receptor', pathways: ['hsa04910'] },
        { geneId: 'hsa:3417', symbol: 'IRS1', name: 'insulin receptor substrate 1', pathways: ['hsa04910'] },
        { geneId: 'hsa:3418', symbol: 'IRS2', name: 'insulin receptor substrate 2', pathways: ['hsa04910'] },
        { geneId: 'hsa:5290', symbol: 'AKT1', name: 'AKT serine/threonine kinase 1', pathways: ['hsa04910', 'hsa04151'] },
        { geneId: 'hsa:5578', symbol: 'SLC2A4', name: 'solute carrier family 2 member 4', pathways: ['hsa04910'] },
      ],
      compounds: [
        { compoundId: 'C00243', name: 'Glucose', formula: 'C6H12O6', mass: 180.16, pathways: ['hsa04910'] },
        { compoundId: 'C00044', name: 'ATP', formula: 'C10H16N5O13P3', mass: 507.18, pathways: ['hsa04910'] },
        { compoundId: 'C00221', name: 'Insulin', pathways: ['hsa04910'] },
      ],
      reactions: [],
      imageUrl: 'https://www.genome.jp/kegg/pathway/hsa/hsa04910.png',
      mapUrl: 'https://www.genome.jp/kegg-bin/show_pathway?hsa04910',
    };

    const tnfPathway: KEGGPathway = {
      pathwayId: 'hsa04668',
      name: 'TNF信号通路',
      nameEn: 'TNF signaling pathway',
      organism: 'hsa',
      class: 'Immune system',
      description: '肿瘤坏死因子（TNF）信号通路参与炎症反应、细胞凋亡和免疫调节。',
      entries: [],
      genes: [
        { geneId: 'hsa:7124', symbol: 'TNF', name: 'tumor necrosis factor', pathways: ['hsa04668'] },
        { geneId: 'hsa:7132', symbol: 'TNFR1', name: 'tumor necrosis factor receptor superfamily member 1A', pathways: ['hsa04668'] },
        { geneId: 'hsa:5970', symbol: 'NFKB1', name: 'nuclear factor kappa B subunit 1', pathways: ['hsa04668'] },
        { geneId: 'hsa:3551', symbol: 'CASP8', name: 'caspase 8', pathways: ['hsa04668'] },
        { geneId: 'hsa:3554', symbol: 'CASP3', name: 'caspase 3', pathways: ['hsa04668'] },
      ],
      compounds: [
        { compoundId: 'C00044', name: 'ATP', formula: 'C10H16N5O13P3', mass: 507.18, pathways: ['hsa04668'] },
      ],
      reactions: [],
      imageUrl: 'https://www.genome.jp/kegg/pathway/hsa/hsa04668.png',
      mapUrl: 'https://www.genome.jp/kegg-bin/show_pathway?hsa04668',
    };

    const foxoPathway: KEGGPathway = {
      pathwayId: 'hsa04068',
      name: 'FoxO信号通路',
      nameEn: 'FoxO signaling pathway',
      organism: 'hsa',
      class: 'Signal transduction',
      description: 'FoxO转录因子家族在细胞周期调控、凋亡、代谢和应激反应中发挥重要作用。',
      entries: [],
      genes: [
        { geneId: 'hsa:2308', symbol: 'FOXO1', name: 'forkhead box O1', pathways: ['hsa04068'] },
        { geneId: 'hsa:2309', symbol: 'FOXO3', name: 'forkhead box O3', pathways: ['hsa04068'] },
        { geneId: 'hsa:2310', symbol: 'FOXO4', name: 'forkhead box O4', pathways: ['hsa04068'] },
        { geneId: 'hsa:5290', symbol: 'AKT1', name: 'AKT serine/threonine kinase 1', pathways: ['hsa04068', 'hsa04151'] },
        { geneId: 'hsa:5594', symbol: 'MAPK3', name: 'mitogen-activated protein kinase 3', pathways: ['hsa04068'] },
      ],
      compounds: [
        { compoundId: 'C00044', name: 'ATP', formula: 'C10H16N5O13P3', mass: 507.18, pathways: ['hsa04068'] },
      ],
      reactions: [],
      imageUrl: 'https://www.genome.jp/kegg/pathway/hsa/hsa04068.png',
      mapUrl: 'https://www.genome.jp/kegg-bin/show_pathway?hsa04068',
    };

    this.mockPathways.set('hsa04010', mapkPathway);
    this.mockPathways.set('hsa04151', pi3kPathway);
    this.mockPathways.set('hsa04910', insulinPathway);
    this.mockPathways.set('hsa04668', tnfPathway);
    this.mockPathways.set('hsa04068', foxoPathway);
  }

  public enableMockMode(enable: boolean): void {
    this.mockMode = enable;
  }

  public async getPathway(pathwayId: string, organism = 'hsa'): Promise<KEGGPathway | null> {
    const cacheKey = `/kegg/pathway/${pathwayId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const pathway = this.mockPathways.get(pathwayId);
      if (pathway) {
        this.setCache(cacheKey, pathway);
        return pathway;
      }
      return null;
    }

    try {
      const data = await this.get<any>(`/get/${pathwayId}`);
      const pathway = this.parseKEGGPathway(data);
      this.setCache(cacheKey, pathway);
      return pathway;
    } catch (error) {
      return null;
    }
  }

  public async searchPathways(query: string, organism = 'hsa'): Promise<KEGGSearchResult> {
    const cacheKey = `/kegg/search/pathways/${query}/${organism}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const results = Array.from(this.mockPathways.values())
        .filter((p) => p.organism === organism)
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.nameEn.toLowerCase().includes(query.toLowerCase()) ||
            p.description.toLowerCase().includes(query.toLowerCase()),
        )
        .map((p) => ({
          id: p.pathwayId,
          type: 'pathway' as const,
          name: p.name,
          organism: p.organism,
        }));

      const result: KEGGSearchResult = {
        results,
        total: results.length,
      };

      this.setCache(cacheKey, result);
      return result;
    }

    return this.get<KEGGSearchResult>('/find/pathway', { query, organism });
  }

  public async listPathways(organism = 'hsa'): Promise<KEGGPathway[]> {
    const cacheKey = `/kegg/pathways/${organism}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const pathways = Array.from(this.mockPathways.values()).filter(
        (p) => p.organism === organism,
      );
      this.setCache(cacheKey, pathways);
      return pathways;
    }

    const data = await this.get<any>(`/list/pathway/${organism}`);
    const pathways = data.map((item: any) => ({
      pathwayId: item.id,
      name: item.name,
      nameEn: item.nameEn,
      organism: item.organism,
      class: item.class,
      description: '',
      entries: [],
      genes: [],
      compounds: [],
      reactions: [],
    }));

    this.setCache(cacheKey, pathways);
    return pathways;
  }

  public async getPathwayGenes(pathwayId: string): Promise<KEGGGene[]> {
    const cacheKey = `/kegg/pathway/${pathwayId}/genes`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const pathway = this.mockPathways.get(pathwayId);
      const genes = pathway?.genes || [];
      this.setCache(cacheKey, genes);
      return genes;
    }

    const data = await this.get<any>(`/link/gene/${pathwayId}`);
    const genes = data.map((item: any) => ({
      geneId: item.id,
      symbol: item.symbol,
      name: item.name,
    }));

    this.setCache(cacheKey, genes);
    return genes;
  }

  public async getPathwayCompounds(pathwayId: string): Promise<KEGGCompound[]> {
    const cacheKey = `/kegg/pathway/${pathwayId}/compounds`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const pathway = this.mockPathways.get(pathwayId);
      const compounds = pathway?.compounds || [];
      this.setCache(cacheKey, compounds);
      return compounds;
    }

    const data = await this.get<any>(`/link/compound/${pathwayId}`);
    const compounds = data.map((item: any) => ({
      compoundId: item.id,
      name: item.name,
      formula: item.formula,
      mass: item.mass,
      smiles: item.smiles,
    }));

    this.setCache(cacheKey, compounds);
    return compounds;
  }

  public async getGeneInfo(geneId: string): Promise<KEGGGene | null> {
    const cacheKey = `/kegg/gene/${geneId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      for (const pathway of this.mockPathways.values()) {
        const gene = pathway.genes.find((g) => g.geneId === geneId || g.symbol === geneId);
        if (gene) {
          this.setCache(cacheKey, gene);
          return gene;
        }
      }
      return null;
    }

    try {
      const data = await this.get<any>(`/get/${geneId}`);
      const gene = this.parseKEGGGene(data);
      this.setCache(cacheKey, gene);
      return gene;
    } catch (error) {
      return null;
    }
  }

  public async getCompoundInfo(compoundId: string): Promise<KEGGCompound | null> {
    const cacheKey = `/kegg/compound/${compoundId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      for (const pathway of this.mockPathways.values()) {
        const compound = pathway.compounds.find((c) => c.compoundId === compoundId);
        if (compound) {
          this.setCache(cacheKey, compound);
          return compound;
        }
      }
      return null;
    }

    try {
      const data = await this.get<any>(`/get/${compoundId}`);
      const compound = this.parseKEGGCompound(data);
      this.setCache(cacheKey, compound);
      return compound;
    } catch (error) {
      return null;
    }
  }

  public async getOrganisms(): Promise<KEGGOrganism[]> {
    const cacheKey = '/kegg/organisms';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      this.setCache(cacheKey, this.mockOrganisms);
      return this.mockOrganisms;
    }

    const data = await this.get<any>('/list/organism');
    const organisms = data.map((item: any) => ({
      code: item.code,
      name: item.name,
      scientificName: item.scientificName,
      taxonomy: item.taxonomy,
    }));

    this.setCache(cacheKey, organisms);
    return organisms;
  }

  public async enrichPathways(
    geneList: string[],
    organism = 'hsa',
    minGenes = 2,
  ): Promise<PathwayEnrichmentResult[]> {
    if (this.mockMode) {
      const results: PathwayEnrichmentResult[] = [];
      const geneSymbols = new Set(geneList.map((g) => g.toUpperCase()));

      for (const pathway of this.mockPathways.values()) {
        if (pathway.organism !== organism) continue;

        const matchedGenes = pathway.genes.filter((g) =>
          geneSymbols.has(g.symbol.toUpperCase()),
        );

        if (matchedGenes.length >= minGenes) {
          const pValue = Math.random() * 0.05;
          results.push({
            pathwayId: pathway.pathwayId,
            name: pathway.name,
            pValue,
            qValue: pValue * 1.5,
            geneCount: matchedGenes.length,
            geneRatio: matchedGenes.length / pathway.genes.length,
            genes: matchedGenes.map((g) => g.symbol),
          });
        }
      }

      return results.sort((a, b) => a.pValue - b.pValue);
    }

    return this.post<PathwayEnrichmentResult[]>('/api/enrich/pathway', {
      genes: geneList,
      organism,
      minGenes,
    });
  }

  public async getPathwayImageUrl(pathwayId: string): Promise<string> {
    if (this.mockMode) {
      const pathway = this.mockPathways.get(pathwayId);
      return pathway?.imageUrl || '';
    }

    return `https://www.genome.jp/kegg/pathway/${pathwayId.slice(0, 3)}/${pathwayId}.png`;
  }

  public async getModule(moduleId: string): Promise<KEGGModule | null> {
    if (this.mockMode) {
      return {
        moduleId,
        name: 'Mock Module',
        description: 'This is a mock module',
        genes: [],
        pathways: [],
      };
    }

    try {
      const data = await this.get<any>(`/get/${moduleId}`);
      return this.parseKEGGModule(data);
    } catch (error) {
      return null;
    }
  }

  public async searchGenes(query: string, organism = 'hsa'): Promise<KEGGSearchResult> {
    if (this.mockMode) {
      const allGenes = new Set<KEGGGene>();
      for (const pathway of this.mockPathways.values()) {
        if (pathway.organism === organism) {
          pathway.genes.forEach((g) => allGenes.add(g));
        }
      }

      const results = Array.from(allGenes)
        .filter(
          (g) =>
            g.symbol.toLowerCase().includes(query.toLowerCase()) ||
            g.name.toLowerCase().includes(query.toLowerCase()),
        )
        .map((g) => ({
          id: g.geneId,
          type: 'gene' as const,
          name: g.symbol,
          organism,
        }));

      return { results, total: results.length };
    }

    return this.get<KEGGSearchResult>('/find/gene', { query, organism });
  }

  public async searchCompounds(query: string): Promise<KEGGSearchResult> {
    if (this.mockMode) {
      const allCompounds = new Set<KEGGCompound>();
      for (const pathway of this.mockPathways.values()) {
        pathway.compounds.forEach((c) => allCompounds.add(c));
      }

      const results = Array.from(allCompounds)
        .filter(
          (c) =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.formula?.toLowerCase().includes(query.toLowerCase()),
        )
        .map((c) => ({
          id: c.compoundId,
          type: 'compound' as const,
          name: c.name,
        }));

      return { results, total: results.length };
    }

    return this.get<KEGGSearchResult>('/find/compound', { query });
  }

  private parseKEGGPathway(data: any): KEGGPathway {
    return {
      pathwayId: data.id || '',
      name: data.name || '',
      nameEn: data.nameEn || '',
      organism: data.organism || '',
      class: data.class || '',
      description: data.description || '',
      entries: data.entries || [],
      genes: data.genes || [],
      compounds: data.compounds || [],
      reactions: data.reactions || [],
      imageUrl: data.imageUrl,
      mapUrl: data.mapUrl,
    };
  }

  private parseKEGGGene(data: any): KEGGGene {
    return {
      geneId: data.id || '',
      symbol: data.symbol || '',
      name: data.name || '',
      description: data.description,
      orthologs: data.orthologs,
      pathways: data.pathways,
    };
  }

  private parseKEGGCompound(data: any): KEGGCompound {
    return {
      compoundId: data.id || '',
      name: data.name || '',
      formula: data.formula,
      mass: data.mass,
      smiles: data.smiles,
      inchikey: data.inchikey,
      pathways: data.pathways,
    };
  }

  private parseKEGGModule(data: any): KEGGModule {
    return {
      moduleId: data.id || '',
      name: data.name || '',
      description: data.description || '',
      genes: data.genes || [],
      pathways: data.pathways || [],
    };
  }

  public clearKeggCache(pathwayId?: string): void {
    if (pathwayId) {
      this.clearCacheByPattern(`/kegg/pathway/${pathwayId}`);
    } else {
      this.clearCache();
    }
  }

  public getServiceInfo(): {
    mockMode: boolean;
    cachedItems: number;
    availablePathways: number;
  } {
    return {
      mockMode: this.mockMode,
      cachedItems: this.getCacheStats().size,
      availablePathways: this.mockPathways.size,
    };
  }
}

const keggService = new KEGGService();

export default keggService;
export { KEGGService };
export type {
  KEGGPathway,
  KEGGEntry,
  KEGGGene,
  KEGGCompound,
  KEGGReaction,
  KEGGOrganism,
  KEGGSearchResult,
  PathwayEnrichmentResult,
  KEGGModule,
};
