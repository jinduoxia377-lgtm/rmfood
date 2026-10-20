import { ProfessionalBaseService } from './ProfessionalBaseService';
import type { ProfessionalServiceConfig } from '../../types/professional';

export interface LiteratureArticle {
  id: string;
  title: string;
  titleEn?: string;
  abstract: string;
  abstractEn?: string;
  authors: string[];
  affiliations?: string[];
  journal: string;
  journalAbbreviation?: string;
  year: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  pmid?: string;
  issn?: string;
  keywords: string[];
  publicationType: 'article' | 'review' | 'letter' | 'short' | 'other';
  language: 'zh' | 'en' | 'other';
  source: 'pubmed' | 'cnki' | 'wanfang' | 'vip' | 'scopus' | 'custom';
  citedCount?: number;
  references?: string[];
  meshTerms?: string[];
  publicationDate: string;
  openAccess: boolean;
  fullTextUrl?: string;
  pdfUrl?: string;
}

export interface LiteratureSearchParams {
  query: string;
  keywords?: string[];
  authors?: string[];
  journals?: string[];
  yearRange?: { min: number; max: number };
  sources?: ('pubmed' | 'cnki' | 'wanfang' | 'vip' | 'scopus')[];
  languages?: ('zh' | 'en')[];
  publicationTypes?: ('article' | 'review' | 'letter')[];
  openAccess?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'relevance' | 'date' | 'citations';
  sortOrder?: 'asc' | 'desc';
}

export interface LiteratureSearchResult {
  articles: LiteratureArticle[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  facets?: {
    years: { year: number; count: number }[];
    journals: { name: string; count: number }[];
    sources: { name: string; count: number }[];
  };
}

export interface CitationMetrics {
  articleId: string;
  citedBy: number;
  citations: LiteratureArticle[];
  relatedArticles: LiteratureArticle[];
  altmetricScore?: number;
}

export interface JournalInfo {
  name: string;
  abbreviation: string;
  issn: string;
  eIssn?: string;
  publisher: string;
  impactFactor?: number;
  fiveYearImpactFactor?: number;
  hIndex?: number;
  category: string;
  ranking?: string;
  openAccess: boolean;
}

class LiteratureService extends ProfessionalBaseService {
  private mockMode = true;
  private mockArticles: LiteratureArticle[] = [];
  private mockJournals = new Map<string, JournalInfo>();

  constructor(config: ProfessionalServiceConfig = {}) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://api.literature.rmfood.com',
      cacheDuration: 30 * 60 * 1000,
    });
    this.initializeMockData();
  }

  private initializeMockData(): void {
    this.mockArticles = [
      {
        id: 'PMID-12345678',
        title: '人参皂苷Rg1对糖尿病大鼠胰岛素敏感性的影响',
        titleEn: 'Effects of Ginsenoside Rg1 on Insulin Sensitivity in Diabetic Rats',
        abstract:
          '目的：探讨人参皂苷Rg1对2型糖尿病大鼠胰岛素敏感性的影响及其机制。方法：采用链脲佐菌素诱导的糖尿病大鼠模型，随机分为对照组、模型组和人参皂苷Rg1处理组。结果：人参皂苷Rg1处理组大鼠血糖水平显著降低，胰岛素敏感性指数明显升高。结论：人参皂苷Rg1通过激活PI3K/AKT信号通路改善胰岛素敏感性。',
        abstractEn:
          'Objective: To investigate the effects of Ginsenoside Rg1 on insulin sensitivity in type 2 diabetic rats and its mechanism. Methods: Diabetic rat models induced by streptozotocin were randomly divided into control group, model group and Ginsenoside Rg1 treatment group. Results: Blood glucose levels were significantly reduced and insulin sensitivity index was significantly increased in the Ginsenoside Rg1 treatment group. Conclusion: Ginsenoside Rg1 improves insulin sensitivity by activating the PI3K/AKT signaling pathway.',
        authors: ['张伟', '李明', '王芳', '刘洋'],
        affiliations: ['中国医学科学院药物研究所', '北京中医药大学'],
        journal: '中国中药杂志',
        journalAbbreviation: 'Chin J Chin Med',
        year: 2023,
        volume: '48',
        issue: '15',
        pages: '3891-3898',
        doi: '10.19540/j.cnki.cjcmm.20230315.001',
        pmid: '37251234',
        issn: '1001-5302',
        keywords: ['人参皂苷Rg1', '糖尿病', '胰岛素敏感性', 'PI3K/AKT', '中药'],
        publicationType: 'article',
        language: 'zh',
        source: 'cnki',
        citedCount: 45,
        publicationDate: '2023-08-15',
        openAccess: false,
      },
      {
        id: 'PMID-87654321',
        title: '黄芪甲苷通过调节肠道菌群改善小鼠肥胖',
        titleEn: 'Astragaloside IV Improves Obesity in Mice by Regulating Gut Microbiota',
        abstract:
          '研究黄芪甲苷对高脂饮食诱导肥胖小鼠肠道菌群的调节作用。结果表明黄芪甲苷能够显著改变肠道菌群结构，增加有益菌丰度，减少有害菌，从而改善肥胖相关代谢紊乱。',
        abstractEn:
          'This study investigated the regulatory effect of Astragaloside IV on gut microbiota in mice with obesity induced by high-fat diet. The results showed that Astragaloside IV significantly altered gut microbiota structure, increased beneficial bacteria abundance, and reduced harmful bacteria, thereby improving obesity-related metabolic disorders.',
        authors: ['陈静', '赵强', '孙丽'],
        affiliations: ['上海交通大学医学院', '中科院上海生命科学研究院'],
        journal: '中草药',
        journalAbbreviation: 'Chin Tradit Herb Drugs',
        year: 2023,
        volume: '54',
        issue: '12',
        pages: '3245-3253',
        doi: '10.7501/j.issn.0253-2670.2023.12.015',
        issn: '0253-2670',
        keywords: ['黄芪甲苷', '肠道菌群', '肥胖', '代谢综合征'],
        publicationType: 'article',
        language: 'zh',
        source: 'cnki',
        citedCount: 32,
        publicationDate: '2023-06-20',
        openAccess: true,
        fullTextUrl: 'https://www.cnki.net/kcms/detail/12.1108.R.20230615.1023.002.html',
      },
      {
        id: 'PMID-11223344',
        title: '当归多糖的免疫调节作用研究进展',
        titleEn: 'Advances in Immunomodulatory Effects of Angelica Polysaccharides',
        abstract:
          '当归是传统中药中重要的补血药。本文综述了当归多糖的免疫调节作用及其机制的研究进展，包括对免疫细胞活化、细胞因子分泌、信号通路调控等方面的影响。',
        abstractEn:
          'Angelica sinensis is an important blood-nourishing herb in traditional Chinese medicine. This article reviews the research progress on the immunomodulatory effects and mechanisms of Angelica polysaccharides, including effects on immune cell activation, cytokine secretion, and signaling pathway regulation.',
        authors: ['王丽', '周涛', '吴敏'],
        affiliations: ['广州中医药大学', '广东省中医药科学院'],
        journal: '中国免疫学杂志',
        journalAbbreviation: 'Chin J Immunol',
        year: 2022,
        volume: '38',
        issue: '9',
        pages: '1117-1122',
        doi: '10.3969/j.issn.1000-484X.2022.09.015',
        issn: '1000-484X',
        keywords: ['当归', '多糖', '免疫调节', '综述'],
        publicationType: 'review',
        language: 'zh',
        source: 'cnki',
        citedCount: 89,
        publicationDate: '2022-09-15',
        openAccess: false,
      },
      {
        id: 'PMID-55667788',
        title: 'Ginsenoside Rg3 inhibits tumor growth through targeting angiogenesis',
        titleEn: 'Ginsenoside Rg3 inhibits tumor growth through targeting angiogenesis',
        abstract:
          'Ginsenoside Rg3, a major active component of Panax ginseng, has been shown to possess anti-tumor activity. This study demonstrates that Rg3 inhibits tumor angiogenesis by suppressing VEGF expression and endothelial cell proliferation.',
        abstractEn:
          'Ginsenoside Rg3, a major active component of Panax ginseng, has been shown to possess anti-tumor activity. This study demonstrates that Rg3 inhibits tumor angiogenesis by suppressing VEGF expression and endothelial cell proliferation.',
        authors: ['Li M', 'Zhang W', 'Wang Y', 'Chen L'],
        affiliations: [
          'Department of Pharmacology, Peking University Health Science Center',
          'Key Laboratory of Molecular Oncology',
        ],
        journal: 'Phytomedicine',
        journalAbbreviation: 'Phytomedicine',
        year: 2023,
        volume: '107',
        pages: '154689',
        doi: '10.1016/j.phytomed.2023.154689',
        pmid: '37512345',
        issn: '0944-7113',
        keywords: ['Ginsenoside Rg3', 'tumor', 'angiogenesis', 'VEGF', 'ginseng'],
        publicationType: 'article',
        language: 'en',
        source: 'pubmed',
        citedCount: 23,
        publicationDate: '2023-07-28',
        openAccess: true,
        pdfUrl: 'https://www.sciencedirect.com/science/article/pii/S0944711323003456',
      },
      {
        id: 'PMID-99887766',
        title: 'Salvia miltiorrhiza Bunge in cardiovascular diseases: A systematic review',
        titleEn: 'Salvia miltiorrhiza Bunge in cardiovascular diseases: A systematic review',
        abstract:
          'Salvia miltiorrhiza Bunge (Danshen) is widely used in traditional Chinese medicine for treating cardiovascular diseases. This systematic review summarizes the pharmacological effects, clinical applications, and safety profile of Danshen.',
        abstractEn:
          'Salvia miltiorrhiza Bunge (Danshen) is widely used in traditional Chinese medicine for treating cardiovascular diseases. This systematic review summarizes the pharmacological effects, clinical applications, and safety profile of Danshen.',
        authors: ['Wang Q', 'Liu Y', 'Chen H'],
        affiliations: ['School of Chinese Medicine, Hong Kong Baptist University', 'Institute of Chinese Medicine'],
        journal: 'Journal of Ethnopharmacology',
        journalAbbreviation: 'J Ethnopharmacol',
        year: 2022,
        volume: '295',
        pages: '115342',
        doi: '10.1016/j.jep.2022.115342',
        pmid: '35789012',
        issn: '0378-8741',
        keywords: ['Salvia miltiorrhiza', 'Danshen', 'cardiovascular diseases', 'systematic review', 'TCM'],
        publicationType: 'review',
        language: 'en',
        source: 'pubmed',
        citedCount: 67,
        publicationDate: '2022-11-15',
        openAccess: false,
      },
      {
        id: 'PMID-22334455',
        title: '甘草酸的抗炎机制及其在自身免疫性疾病中的应用',
        titleEn: 'Anti-inflammatory mechanisms of glycyrrhizin and its application in autoimmune diseases',
        abstract:
          '甘草酸是甘草的主要活性成分，具有显著的抗炎作用。本文探讨了甘草酸通过抑制NF-κB信号通路发挥抗炎效应的机制，以及其在类风湿关节炎、系统性红斑狼疮等自身免疫性疾病中的应用前景。',
        abstractEn:
          'Glycyrrhizin is the main active component of Glycyrrhiza uralensis with significant anti-inflammatory effects. This article explores the mechanisms by which glycyrrhizin exerts anti-inflammatory effects through inhibiting the NF-κB signaling pathway, and its application prospects in autoimmune diseases such as rheumatoid arthritis and systemic lupus erythematosus.',
        authors: ['赵雪', '孙伟', '周杰'],
        affiliations: ['南京中医药大学', '江苏省中医药研究院'],
        journal: '中国药理学通报',
        journalAbbreviation: 'Chin Pharmacol Bull',
        year: 2023,
        volume: '39',
        issue: '4',
        pages: '621-627',
        doi: '10.3969/j.issn.1001-1978.2023.04.012',
        issn: '1001-1978',
        keywords: ['甘草酸', '抗炎', 'NF-κB', '自身免疫性疾病'],
        publicationType: 'review',
        language: 'zh',
        source: 'cnki',
        citedCount: 54,
        publicationDate: '2023-04-20',
        openAccess: true,
      },
    ];

    this.mockJournals.set('中国中药杂志', {
      name: '中国中药杂志',
      abbreviation: 'Chin J Chin Med',
      issn: '1001-5302',
      publisher: '中国中医科学院中药研究所',
      impactFactor: 3.25,
      fiveYearImpactFactor: 3.82,
      category: '中药学',
      ranking: 'Q1',
      openAccess: false,
    });

    this.mockJournals.set('中草药', {
      name: '中草药',
      abbreviation: 'Chin Tradit Herb Drugs',
      issn: '0253-2670',
      publisher: '天津药物研究院',
      impactFactor: 2.89,
      fiveYearImpactFactor: 3.45,
      category: '中药学',
      ranking: 'Q1',
      openAccess: false,
    });

    this.mockJournals.set('Phytomedicine', {
      name: 'Phytomedicine',
      abbreviation: 'Phytomedicine',
      issn: '0944-7113',
      eIssn: '1618-1327',
      publisher: 'Elsevier',
      impactFactor: 5.64,
      fiveYearImpactFactor: 6.21,
      category: 'Phytotherapy',
      ranking: 'Q1',
      openAccess: true,
    });

    this.mockJournals.set('Journal of Ethnopharmacology', {
      name: 'Journal of Ethnopharmacology',
      abbreviation: 'J Ethnopharmacol',
      issn: '0378-8741',
      eIssn: '1873-5602',
      publisher: 'Elsevier',
      impactFactor: 5.19,
      fiveYearImpactFactor: 5.87,
      category: 'Ethnopharmacology',
      ranking: 'Q1',
      openAccess: false,
    });
  }

  public enableMockMode(enable: boolean): void {
    this.mockMode = enable;
  }

  public async searchArticles(params: LiteratureSearchParams): Promise<LiteratureSearchResult> {
    const cacheKey = this.getCacheKey('/literature/search', params);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      return this.mockSearchArticles(params);
    }

    return this.get<any>('/api/literature/search', params);
  }

  private mockSearchArticles(params: LiteratureSearchParams): LiteratureSearchResult {
    const cacheKey = `/literature/search/${JSON.stringify(params)}`;
    let results = [...this.mockArticles];

    if (params.query) {
      const queryLower = params.query.toLowerCase();
      results = results.filter(
        (article) =>
          article.title.toLowerCase().includes(queryLower) ||
          article.abstract.toLowerCase().includes(queryLower) ||
          article.keywords.some((k) => k.toLowerCase().includes(queryLower)) ||
          article.authors.some((a) => a.toLowerCase().includes(queryLower)),
      );
    }

    if (params.keywords && params.keywords.length > 0) {
      const keywordSet = new Set(params.keywords.map((k) => k.toLowerCase()));
      results = results.filter((article) => article.keywords.some((k) => keywordSet.has(k.toLowerCase())));
    }

    if (params.authors && params.authors.length > 0) {
      const authorSet = new Set(params.authors.map((a) => a.toLowerCase()));
      results = results.filter((article) => article.authors.some((a) => authorSet.has(a.toLowerCase())));
    }

    if (params.journals && params.journals.length > 0) {
      const journalSet = new Set(params.journals.map((j) => j.toLowerCase()));
      results = results.filter((article) => journalSet.has(article.journal.toLowerCase()));
    }

    if (params.yearRange) {
      results = results.filter(
        (article) => article.year >= (params.yearRange!.min || 1900) && article.year <= (params.yearRange!.max || 2100),
      );
    }

    if (params.sources && params.sources.length > 0) {
      const sourceSet = new Set(params.sources);
      results = results.filter((article) =>
        sourceSet.has(article.source as 'pubmed' | 'cnki' | 'wanfang' | 'vip' | 'scopus'),
      );
    }

    if (params.languages && params.languages.length > 0) {
      const langSet = new Set(params.languages);
      results = results.filter((article) => langSet.has(article.language as 'zh' | 'en'));
    }

    if (params.publicationTypes && params.publicationTypes.length > 0) {
      const typeSet = new Set(params.publicationTypes);
      results = results.filter((article) => typeSet.has(article.publicationType as 'article' | 'review' | 'letter'));
    }

    if (params.openAccess !== undefined) {
      results = results.filter((article) => article.openAccess === params.openAccess);
    }

    const sortBy = params.sortBy || 'relevance';
    const sortOrder = params.sortOrder || 'desc';

    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = a.year - b.year;
          break;
        case 'citations':
          comparison = (a.citedCount || 0) - (b.citedCount || 0);
          break;
        case 'relevance':
        default:
          comparison = Math.random() - 0.5;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = results.length;
    const start = (page - 1) * pageSize;
    const pagedResults = results.slice(start, start + pageSize);

    const years = new Map<number, number>();
    const journals = new Map<string, number>();
    const sources = new Map<string, number>();

    results.forEach((article) => {
      years.set(article.year, (years.get(article.year) || 0) + 1);
      journals.set(article.journal, (journals.get(article.journal) || 0) + 1);
      sources.set(article.source, (sources.get(article.source) || 0) + 1);
    });

    const result: LiteratureSearchResult = {
      articles: pagedResults,
      total,
      page,
      pageSize,
      query: params.query,
      facets: {
        years: Array.from(years.entries()).map(([year, count]) => ({ year, count })),
        journals: Array.from(journals.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        sources: Array.from(sources.entries()).map(([name, count]) => ({ name, count })),
      },
    };

    this.setCache(cacheKey, result);
    return result;
  }

  public async getArticleById(articleId: string): Promise<LiteratureArticle | null> {
    const cacheKey = `/literature/article/${articleId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const article = this.mockArticles.find((a) => a.id === articleId);
      if (article) {
        this.setCache(cacheKey, article);
        return article;
      }
      return null;
    }

    try {
      const article = await this.get<LiteratureArticle>(`/api/literature/article/${articleId}`);
      this.setCache(cacheKey, article);
      return article;
    } catch {
      return null;
    }
  }

  public async getCitationMetrics(articleId: string): Promise<CitationMetrics> {
    if (this.mockMode) {
      const article = this.mockArticles.find((a) => a.id === articleId);
      if (!article) {
        return {
          articleId,
          citedBy: 0,
          citations: [],
          relatedArticles: [],
        };
      }

      const relatedArticles = this.mockArticles
        .filter((a) => a.id !== articleId)
        .filter((a) => a.keywords.some((k) => article.keywords.includes(k)))
        .slice(0, 5);

      return {
        articleId,
        citedBy: article.citedCount || 0,
        citations: [],
        relatedArticles,
        altmetricScore: Math.floor(Math.random() * 100),
      };
    }

    return this.get<CitationMetrics>(`/api/literature/article/${articleId}/metrics`);
  }

  public async getJournalInfo(journalName: string): Promise<JournalInfo | null> {
    const cacheKey = `/literature/journal/${journalName}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const journal = this.mockJournals.get(journalName);
      if (journal) {
        this.setCache(cacheKey, journal);
        return journal;
      }
      return null;
    }

    try {
      const journal = await this.get<JournalInfo>(`/api/literature/journal/${encodeURIComponent(journalName)}`);
      this.setCache(cacheKey, journal);
      return journal;
    } catch {
      return null;
    }
  }

  public async searchJournals(query: string): Promise<JournalInfo[]> {
    if (this.mockMode) {
      return Array.from(this.mockJournals.values()).filter(
        (j) =>
          j.name.toLowerCase().includes(query.toLowerCase()) ||
          j.abbreviation.toLowerCase().includes(query.toLowerCase()),
      );
    }

    return this.get<JournalInfo[]>('/api/literature/journals/search', { query });
  }

  public async exportArticles(articleIds: string[], format: 'bibtex' | 'ris' | 'csv' | 'json'): Promise<string> {
    if (this.mockMode) {
      const articles = this.mockArticles.filter((a) => articleIds.includes(a.id));

      switch (format) {
        case 'bibtex':
          return this.generateBibTeX(articles);
        case 'ris':
          return this.generateRIS(articles);
        case 'csv':
          return this.generateCSV(articles);
        case 'json':
        default:
          return JSON.stringify(articles, null, 2);
      }
    }

    return this.post<string>('/api/literature/export', { articleIds, format });
  }

  private generateBibTeX(articles: LiteratureArticle[]): string {
    return articles
      .map((article) => {
        const authors = article.authors
          .map((a) => {
            const parts = a.split(' ');
            if (parts.length === 1) return `{${a}}`;
            return `{${parts.slice(1).join(' ')}, ${parts[0]}}`;
          })
          .join(' and ');

        return `@article{${article.id},
  title = {${article.title}},
  author = {${authors}},
  journal = {${article.journal}},
  year = {${article.year}},
  volume = {${article.volume || ''}},
  number = {${article.issue || ''}},
  pages = {${article.pages || ''}},
  doi = {${article.doi || ''}},
  keywords = {${article.keywords.join(', ')}}
}`;
      })
      .join('\n\n');
  }

  private generateRIS(articles: LiteratureArticle[]): string {
    return articles
      .map((article) => {
        return `TY  - JOUR
TI  - ${article.title}
AU  - ${article.authors.join('\nAU  - ')}
JO  - ${article.journal}
PY  - ${article.year}
VL  - ${article.volume || ''}
IS  - ${article.issue || ''}
SP  - ${article.pages?.split('-')[0] || ''}
EP  - ${article.pages?.split('-')[1] || ''}
DO  - ${article.doi || ''}
KW  - ${article.keywords.join('; ')}
ER  - 
`;
      })
      .join('\n');
  }

  private generateCSV(articles: LiteratureArticle[]): string {
    const headers = ['ID', 'Title', 'Authors', 'Journal', 'Year', 'DOI', 'Keywords'];
    const rows = articles.map((article) => [
      article.id,
      `"${article.title}"`,
      `"${article.authors.join('; ')}"`,
      `"${article.journal}"`,
      article.year,
      article.doi || '',
      `"${article.keywords.join('; ')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  public async getSuggestedKeywords(query: string): Promise<string[]> {
    if (this.mockMode) {
      const allKeywords = new Set<string>();
      this.mockArticles.forEach((article) => {
        article.keywords.forEach((k) => allKeywords.add(k));
      });

      const queryLower = query.toLowerCase();
      return Array.from(allKeywords)
        .filter((k) => k.toLowerCase().includes(queryLower))
        .slice(0, 10);
    }

    return this.get<string[]>('/api/literature/suggest/keywords', { query });
  }

  public async getTrendingTopics(): Promise<{ topic: string; count: number; trend: 'up' | 'down' | 'stable' }[]> {
    if (this.mockMode) {
      return [
        { topic: '人参皂苷', count: 125, trend: 'up' },
        { topic: '肠道菌群', count: 89, trend: 'up' },
        { topic: '黄芪甲苷', count: 67, trend: 'stable' },
        { topic: '中药复方', count: 54, trend: 'down' },
        { topic: '网络药理学', count: 43, trend: 'up' },
      ];
    }

    return this.get<any>('/api/literature/trending');
  }

  public clearLiteratureCache(articleId?: string): void {
    if (articleId) {
      this.clearCacheByPattern(`/literature/article/${articleId}`);
    } else {
      this.clearCache();
    }
  }

  public getServiceInfo(): {
    mockMode: boolean;
    cachedItems: number;
    availableArticles: number;
  } {
    return {
      mockMode: this.mockMode,
      cachedItems: this.getCacheStats().size,
      availableArticles: this.mockArticles.length,
    };
  }
}

const literatureService = new LiteratureService();

export default literatureService;
export { LiteratureService };
