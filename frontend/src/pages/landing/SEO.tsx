/**
 * SEO 组件 — 莱茵分子落地页元信息
 *
 * 采用 React 内联方式（useEffect + DOM）管理 document head，
 * 不依赖 react-helmet 等外部库。
 *
 * 包含：
 *   - <title> + meta[name=description/keywords/author/robots]
 *   - Open Graph 标签（og:title, og:description, og:type, og:url, og:locale, og:image）
 *   - Twitter Card 标签（twitter:card, twitter:title, twitter:description, twitter:creator）
 *   - JSON-LD 结构化数据（Organization + SoftwareApplication + WebSite + FAQPage）
 */
import { useEffect } from 'react';

// ── 基础元信息 ──────────────────────────────────────────────────

const SITE_URL = 'https://www.rmfood.cn/landing';
const SITE_NAME = '莱茵分子';
const SITE_DESCRIPTION =
  '莱茵分子是药食同源AI配方研发平台，整合TCMSP、DFBP、Neo4j知识图谱等六大权威数据源，' +
  '提供从原料筛选、配伍禁忌检测、合规审查到功效预测的完整工作流。内置7种优化算法、' +
  '5种协同机制，亚秒级实时推理，帮助200+研发机构将配方研发周期从数周缩短至72小时，' +
  '实现精准个性化配方设计与科学机理阐释。';
const SITE_KEYWORDS =
  '药食同源,AI配方研发,中医食疗,TCMSP,活性肽,知识图谱,配方优化,合规检测,莱茵分子,药食同源平台';
const SITE_AUTHOR = '莱茵分子研发团队';

// ── JSON-LD 结构化数据 ─────────────────────────────────────────

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    // Organization
    {
      '@type': 'Organization',
      '@id': 'https://www.rmfood.cn/#organization',
      name: '莱茵分子',
      url: 'https://www.rmfood.cn/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.rmfood.cn/logo.png',
        width: 512,
        height: 512,
      },
      description:
        '莱茵分子是一家专注于药食同源AI配方研发平台的技术公司，整合传统中医智慧与现代分子生物学数据库。',
      foundingDate: '2025',
      sameAs: ['https://github.com/rmfood'],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'contact@rmfood.cn',
        areaServed: 'CN',
        availableLanguage: ['zh-CN'],
      },
    },
    // SoftwareApplication
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://www.rmfood.cn/landing#software',
      name: '莱茵分子 AI 配方研发平台',
      url: SITE_URL,
      applicationCategory: 'MedicalApplication',
      operatingSystem: 'Web',
      description:
        '药食同源AI配方研发平台，整合TCMSP、DFBP、知识图谱等六大权威数据源，内置7种优化算法和5种协同机制，亚秒级实时推理。',
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '0',
        highPrice: '9999',
        priceCurrency: 'CNY',
        offerCount: '3',
      },
      featureList: [
        'AI智能配方对话',
        '7种优化算法引擎',
        '5种协同作用机制',
        '亚秒级实时推理',
        '合规检测与配伍禁忌',
        '6大权威数据源实时同步',
        '企业团队协作',
        '实验数据管理',
      ],
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '200',
      },
    },
    // WebSite
    {
      '@type': 'WebSite',
      '@id': 'https://www.rmfood.cn/#website',
      url: 'https://www.rmfood.cn/',
      name: '莱茵分子',
      description: '药食同源AI配方研发平台',
      publisher: { '@id': 'https://www.rmfood.cn/#organization' },
      inLanguage: 'zh-CN',
    },
    // FAQPage
    {
      '@type': 'FAQPage',
      '@id': 'https://www.rmfood.cn/landing#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: '莱茵分子平台适合哪些用户？',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              '食品科学研究人员、药食同源产品研发工程师、保健品企业研发团队及中医药院校师生。',
          },
        },
        {
          '@type': 'Question',
          name: '数据安全如何保障？',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              'AES-256 加密存储、RBAC 五级权限、多租户隔离、TLS 传输加密，完整审计日志。',
          },
        },
        {
          '@type': 'Question',
          name: 'AI 引擎使用哪些算法？',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              '内置 7 种优化算法引擎：标准遗传算法 (GA)、NSGA-III 高维多目标优化、Binary GA+MILP 混合整数规划、贝叶斯优化、MOEAD+CMA-ES 分解策略、UCB1 Bandit 自动求解器、神经配方网络。',
          },
        },
        {
          '@type': 'Question',
          name: '协同效应如何计算？',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              '采用 5 种数学模型综合计算协同指数 SI：Bliss 独立性协同（30%权重）、药代动力学协同（20%）、Gibbs 自由能稳定性（20%）、网络药理学 Jaccard 关联（15%）、味觉矩阵协同（15%）。',
          },
        },
        {
          '@type': 'Question',
          name: '性能响应速度如何？',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              '单对成分协同分析 P50 < 45ms，5 成分配比优化 P95 < 1.8s，完整管线 P95 < 3.2s，SLA 保证 < 6s。',
          },
        },
        {
          '@type': 'Question',
          name: '安全合规如何保障？',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              '三级预警系统，61 类内置安全阈值，实时对接卫健委药食同源目录（130+ 条目）及 GB 2760/14880/28050 国家标准，PopPK/PD 模型支持最佳服用时间窗口计算。',
          },
        },
        {
          '@type': 'Question',
          name: '支持私有化部署吗？',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              '企业版提供私有化部署选项，可完整部署至自有服务器。请联系销售团队。',
          },
        },
      ],
    },
  ],
};

// ── 工具函数：设置 meta 标签 ────────────────────────────────────

function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setJsonLd(data: object) {
  // 先移除旧的 JSON-LD（通过 data-seo-script 标记识别）
  document.querySelectorAll('script[data-seo-script]').forEach((el) => el.remove());

  const script = document.createElement('script');
  script.setAttribute('type', 'application/ld+json');
  script.setAttribute('data-seo-script', 'true');
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

// ── 主组件 ──────────────────────────────────────────────────────

export default function SEO() {
  useEffect(() => {
    // 页面标题
    document.title = '莱茵分子 — 药食同源 AI 配方研发平台 | 从想法到配方，一气呵成';

    // 基础 meta
    setMeta('description', SITE_DESCRIPTION);
    setMeta('keywords', SITE_KEYWORDS);
    setMeta('author', SITE_AUTHOR);
    setMeta('robots', 'index, follow, max-image-preview:large');

    // Open Graph
    setMetaProperty('og:title', '莱茵分子 — 药食同源 AI 配方研发平台');
    setMetaProperty('og:description', SITE_DESCRIPTION);
    setMetaProperty('og:type', 'website');
    setMetaProperty('og:url', SITE_URL);
    setMetaProperty('og:locale', 'zh_CN');
    setMetaProperty('og:site_name', SITE_NAME);
    setMetaProperty('og:image', 'https://www.rmfood.cn/og-cover.png');
    setMetaProperty('og:image:alt', '莱茵分子 AI 配方研发平台');

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', '莱茵分子 — 药食同源 AI 配方研发平台');
    setMeta('twitter:description', SITE_DESCRIPTION);
    setMeta('twitter:creator', '@rmfood');

    // JSON-LD 结构化数据
    setJsonLd(JSON_LD);
  }, []);

  // SEO 组件不渲染任何可见内容
  return null;
}
