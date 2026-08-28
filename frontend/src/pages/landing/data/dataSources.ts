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
  },
];
