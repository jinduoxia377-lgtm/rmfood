/**
 * ApiDocsPage — API 参考文档
 */
import PublicLayout from './PublicLayout';

const endpoints = [
  {
    method: 'POST',
    path: '/api/v1/formula/generate',
    title: 'AI 配方生成',
    desc: '基于自然语言需求，调用 MCTS 搜索算法生成配方方案。',
    params: [
      { name: 'requirement', type: 'string', desc: '自然语言描述的研发需求' },
      { name: 'model', type: 'string', desc: '指定使用的 LLM（deepseek/gpt4/glm4/qwen）' },
      { name: 'constraints', type: 'object', desc: '安全约束条件，如最大剂量、禁用原料列表' },
    ],
    response: { formula_id: 'string', ingredients: 'array', safety_score: 'number', compliance: 'object' },
  },
  {
    method: 'GET',
    path: '/api/v1/formula/:id',
    title: '获取配方详情',
    desc: '根据配方 ID 获取完整的配方信息，包括原料、剂量、功效说明。',
    params: [],
    response: { id: 'string', name: 'string', ingredients: 'array', created_at: 'string' },
  },
  {
    method: 'GET',
    path: '/api/v1/ingredients/search',
    title: '中药材检索',
    desc: '基于 TCMSP 数据库进行药材名称、功效、成分的模糊检索。',
    params: [
      { name: 'keyword', type: 'string', desc: '检索关键词' },
      { name: 'limit', type: 'number', desc: '返回结果数量上限，默认 20' },
    ],
    response: { results: 'array', total: 'number' },
  },
  {
    method: 'POST',
    path: '/api/v1/compliance/check',
    title: '合规检测',
    desc: '对配方进行实时合规检测，涵盖配伍禁忌、过敏原、卫健委目录等维度。',
    params: [
      { name: 'formula_id', type: 'string', desc: '配方 ID' },
      { name: 'check_type', type: 'string', desc: '检测类型：all / incompatibility / allergen / regulation' },
    ],
    response: { passed: 'boolean', issues: 'array', standards_checked: 'number' },
  },
  {
    method: 'GET',
    path: '/api/v1/knowledge-graph/query',
    title: '知识图谱查询',
    desc: '基于 Cypher 查询执行药材-成分-靶点-疾病的多跳关系查询。',
    params: [
      { name: 'entity', type: 'string', desc: '起始实体名称' },
      { name: 'relation', type: 'string', desc: '关系类型（含成分/有靶点/治疾病等）' },
      { name: 'depth', type: 'number', desc: '查询深度，默认 2' },
    ],
    response: { nodes: 'array', edges: 'array' },
  },
  {
    method: 'POST',
    path: '/api/v1/peptide/analyze',
    title: '肽序列分析',
    desc: '调用 PepINVENT 引擎对食物蛋白序列进行活性肽预测和 ADMET 评估。',
    params: [
      { name: 'sequence', type: 'string', desc: '氨基酸序列' },
      { name: 'analysis_type', type: 'string', desc: '分析类型：peptide_prediction / admet / toxicity' },
    ],
    response: { active_peptides: 'array', admet_profile: 'object', risk_level: 'string' },
  },
];

const MethodBadge = ({ method }: { method: string }) => {
  const colors: Record<string, { bg: string; color: string }> = {
    GET:     { bg: '#ecfdf5', color: '#059669' },
    POST:    { bg: '#eff6ff', color: '#2563eb' },
    PUT:     { bg: '#fffbeb', color: '#d97706' },
    DELETE:  { bg: '#fef2f2', color: '#dc2626' },
  };
  const c = colors[method] ?? colors.GET;
  return (
    <span className="text-xs font-bold px-1.5 py-0.5 rounded-sm" style={{ background: c.bg, color: c.color }}>
      {method}
    </span>
  );
};

export default function ApiDocsPage() {
  return (
    <PublicLayout>
      <section style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-4xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-12">
          <span className="text-xs font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-widest block mb-[var(--space-apple-sm)]">API Reference</span>
          <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.15] text-neutral-900 mb-[var(--space-apple-md)]">API 参考</h1>
          <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed max-w-xl">
            RMFOOD RESTful API v1，支持 AI 配方生成、知识图谱查询、合规检测、肽序列分析等核心能力。Base URL：<code style={{ fontSize: 13, background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>https://api.rmfood.cn</code>
          </p>
        </div>
      </section>

      <section style={{ background: '#fafafa' }}>
        <div className="max-w-4xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-12 space-y-6">
          {endpoints.map((ep, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
              {/* 头部 */}
              <div className="px-5 py-4 flex items-start gap-[var(--space-apple-sm)]" style={{ borderBottom: '1px solid #e2e8f0' }}>
                <MethodBadge method={ep.method} />
                <code className="text-sm font-mono font-medium text-neutral-800 flex-1">{ep.path}</code>
              </div>
              {/* 描述 */}
              <div className="px-5 py-[var(--space-apple-md)]">
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{ep.desc}</p>
              </div>
              {/* 参数 */}
              {ep.params.length > 0 && (
                <div className="px-5 pb-[var(--space-apple-md)]">
                  <span className="text-xs font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-widest block mb-2">请求参数</span>
                  <div className="overflow-x-auto">
                  <table className="w-full text-[12px] border-collapse">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <th className="text-left py-1.5 px-2 font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">参数名</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">类型</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ep.params.map(p => (
                        <tr key={p.name} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td className="py-1.5 px-2 font-mono text-[var(--text-primary)]">{p.name}</td>
                          <td className="py-1.5 px-2 font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{p.type}</td>
                          <td className="py-1.5 px-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{p.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
              {/* 响应 */}
              <div className="px-5 pb-[var(--space-apple-md)]">
                <span className="text-xs font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-widest block mb-2">响应示例</span>
                <pre className="text-xs font-mono text-[var(--text-secondary)] p-[var(--space-apple-sm)] rounded-sm" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                  {JSON.stringify(ep.response, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
