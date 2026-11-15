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
import i18n from '@/i18n';
import { faqs } from './data/faqs';

// ── 基础元信息 ──────────────────────────────────────────────────

const SITE_URL = 'https://www.rmfood.cn/landing';
const SITE_NAME = '莱茵分子';
const SITE_DESCRIPTION =
  '莱茵分子是药食同源AI配方研发平台，整合TCMSP、DFBP、Neo4j知识图谱等权威数据源，' +
  '提供从原料筛选、配伍禁忌检测、合规审查到功效预测的完整工作流。内置7种优化算法、' +
  '5种协同机制，亚秒级实时推理，帮助研发机构实现精准个性化配方设计与科学机理阐释。';
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
        '药食同源AI配方研发平台，整合TCMSP、DFBP、知识图谱等权威数据源，内置7种优化算法和5种协同机制，亚秒级实时推理。',
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
        '权威数据源实时同步',
        '企业团队协作',
        '实验数据管理',
      ],
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
    // FAQPage — 由 faqs.ts 单一来源生成，保证与页面 FAQ 100% 一致
    {
      '@type': 'FAQPage',
      '@id': 'https://www.rmfood.cn/landing#faq',
      mainEntity: faqs.map((q) => ({
        '@type': 'Question',
        name: i18n.t(q.qKey),
        acceptedAnswer: {
          '@type': 'Answer',
          text: i18n.t(q.aKey),
        },
      })),
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

function setCanonical(url: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
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
    setMetaProperty('og:image:width', '1200');
    setMetaProperty('og:image:height', '630');
    setMetaProperty('og:image:type', 'image/png');

    // Canonical URL（与 og:url / SITE_URL 保持一致）
    setCanonical(SITE_URL);

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', '莱茵分子 — 药食同源 AI 配方研发平台');
    setMeta('twitter:description', SITE_DESCRIPTION);
    setMeta('twitter:creator', '@rmfood');
    setMeta('twitter:image', 'https://www.rmfood.cn/og-cover.png');
    setMeta('twitter:image:alt', '莱茵分子 AI 配方研发平台');

    // JSON-LD 结构化数据
    setJsonLd(JSON_LD);
  }, []);

  // SEO 组件不渲染任何可见内容
  return null;
}
