/**
 * Landing Page — FAQ 数据
 */
export interface FAQItem {
  q: string;
  a: string;
}

export const sectionLabel = '常见问题';

export const faqs: FAQItem[] = [
  {
    q: 'RMFOOD 适合哪些用户？',
    a: '食品科学研究人员、药食同源产品研发工程师、保健品企业研发团队及中医药院校师生。',
  },
  {
    q: '数据安全如何保障？',
    a: 'AES-256 加密存储、RBAC 五级权限、多租户隔离、TLS 传输加密，完整审计日志。',
  },
  {
    q: 'AI 引擎如何工作？',
    a: '整合 MCTS 搜索与模拟退火算法，在 TCMSP 数据库与知识图谱基础上，于安全约束下自动搜索最优配方。',
  },
  {
    q: '支持私有化部署吗？',
    a: '企业版提供私有化部署选项，可完整部署至自有服务器。请联系销售团队。',
  },
];
