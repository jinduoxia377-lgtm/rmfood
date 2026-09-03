/**
 * 数据底座 — 数据层
 */
export interface DataSource {
  id: string;
  name: string;
  subtitle: string;
  desc: string;
  stat: string;
  statLabel: string;
  color: string;
  colorLight: string;
  colorBorder: string;
  status: 'online' | 'syncing' | 'update';
  features: string[];
  icon: string;
  links?: { label: string; url: string }[];
}

export const dataSources: DataSource[] = [
  {
    id: 'tcmsp',
    name: 'TCMSP',
    subtitle: '中药材数据库',
    desc: '收录 29,361 味中药材，覆盖化学成分、靶点及药理作用，16 个 Alembic 迁移版本持续增强',
    stat: '29,361',
    statLabel: '中药材条目',
    color: '#059669',
    colorLight: '#ecfdf5',
    colorBorder: '#a7f3d0',
    status: 'online',
    features: ['化学成分检索', '靶点匹配', '药理作用分析'],
    icon: 'flask-conical',
  },
  {
    id: 'dfbp',
    name: 'DFBP',
    subtitle: '活性肽数据库',
    desc: '系统性收录食源性活性肽序列、理化性质及生物活性数据，PepINVENT 引擎集成',
    stat: '5,200+',
    statLabel: '活性肽结构',
    color: '#2563eb',
    colorLight: '#eff6ff',
    colorBorder: '#bfdbfe',
    status: 'online',
    features: ['肽序列预测', 'ADMET 评估', '毒性致敏性分析'],
    icon: 'dna',
  },
  {
    id: 'neo4j',
    name: 'Neo4j 知识图谱',
    subtitle: '药食同源关系网络',
    desc: '基于 Cypher 查询的药材–成分–靶点–疾病多维关联图谱，128K 实体节点',
    stat: '128K',
    statLabel: '实体节点',
    color: '#7c3aed',
    colorLight: '#f5f3ff',
    colorBorder: '#ddd6fe',
    status: 'online',
    features: ['多维关联查询', 'D3 可视化', '图谱推理'],
    icon: 'network',
  },
  {
    id: 'nfc',
    name: '卫健委目录',
    subtitle: '药食同源法规库',
    desc: '实时对接卫健委药食同源名单，130+ 法定条目，动态同步法规更新',
    stat: '130+',
    statLabel: '法定条目',
    color: '#2563eb',
    colorLight: '#eff6ff',
    colorBorder: '#bfdbfe',
    status: 'syncing',
    features: ['配伍禁忌检测', '过敏原标注', '合规预判'],
    icon: 'shield-check',
    links: [
      { label: '药食同源目录', url: 'https://www.nhc.gov.cn/' },
    ],
  },
  {
    id: 'gb',
    name: '食品安全国标',
    subtitle: 'GB 全量法规',
    desc: '覆盖 GB 2760 / GB 14880 / GB 28050 等核心标准全文检索，380+ 国标条款',
    stat: '380+',
    statLabel: '国标条款',
    color: '#d97706',
    colorLight: '#fffbeb',
    colorBorder: '#fde68a',
    status: 'update',
    features: ['全文检索', '条款对照', '版本追溯'],
    icon: 'scale',
    links: [
      { label: 'GB 2760-2024 食品添加剂使用标准', url: 'http://www.neastates.com.cn/upload/2024/06/20/20240620101458_3681.pdf' },
      { label: 'GB 14880-2012 食品营养强化剂使用标准', url: 'http://www.samr.gov.cn/fldy/zt/zlzd/fgzc/202301/P020230112382973826266.pdf' },
      { label: 'GB 28050-2011 预包装食品营养标签通则', url: 'http://www.samr.gov.cn/fldy/zt/zlzd/fgzc/202301/P020230112382973826266.pdf' },
      { label: '卫健委药食同源目录（2023版）', url: 'https://www.nhc.gov.cn/' },
    ],
  },
  {
    id: 'intl',
    name: '国际法规标准',
    subtitle: 'FDA / EFSA / JFSA',
    desc: '覆盖美国 FDA GRAS、欧盟 EFSA 认证、日本厚生省等国际标准数据库，支持多国法规交叉比对',
    stat: '50+',
    statLabel: '国际法规源',
    color: '#0891b2',
    colorLight: '#ecfeff',
    colorBorder: '#a5f3fc',
    status: 'online',
    features: ['FDA GRAS 查询', 'EFSA 认证检索', 'JFSA 标准对照', '多国合规对比'],
    icon: 'globe',
    links: [
      { label: 'FDA GRAS 列表 (21 CFR)', url: 'https://www.accessdata.fda.gov/scripts/fdcc/index.cfm?set=GrasNotices' },
      { label: 'EFSA 食品成分数据库', url: 'https://www.efsa.europa.eu/en/data' },
      { label: '日本食品安全委员会', url: 'https://www.fsc.go.jp/chinese/index.html' },
      { label: 'Codex 食品添加剂标准', url: 'https://www.fao.org/food-safety/scientific-advice/codex-food-standard/en/' },
    ],
  },
];
