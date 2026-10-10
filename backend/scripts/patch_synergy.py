# -*- coding: utf-8 -*-
"""修复协同分析 Tab 字段错配（synergies/ranked_herbs → synergy_matrix/top_combinations）"""
import io

P = r'D:\RMFOODFP\frontend\src\pages\database\tabs\PeptideStructureAnalyzer.tsx'
P2 = r'D:\RMFOODFP\frontend\src\services\professional\peptideStructureService.ts'

with io.open(P, encoding='utf-8') as f:
    src = f.read()

# 1) 结果表格：synergies → synergy_matrix + 建议列 + 表头
old1 = '''          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-2 py-1.5 text-left">肽序列</th>
                <th className="px-2 py-1.5 text-left">药材</th>
                <th className="px-2 py-1.5 text-right">协同评分</th>
                <th className="px-2 py-1.5 text-left">机制</th>
              </tr></thead>
              <tbody>
                {(result.synergies || []).map((s: any, i: number) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="px-2 py-1.5 font-mono">{s.peptide}</td>
                    <td className="px-2 py-1.5">{s.herb}</td>
                    <td className="px-2 py-1.5 text-right font-bold">{s.synergy_score?.toFixed(3)}</td>
                    <td className="px-2 py-1.5 text-[var(--text-muted)]">{s.mechanism || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>'''
new1 = '''          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-2 py-1.5 text-left">肽序列</th>
                <th className="px-2 py-1.5 text-left">药材</th>
                <th className="px-2 py-1.5 text-right">协同评分</th>
                <th className="px-2 py-1.5 text-left">机制</th>
                <th className="px-2 py-1.5 text-left">建议</th>
              </tr></thead>
              <tbody>
                {(result.synergy_matrix || []).flat().map((s: any, i: number) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="px-2 py-1.5 font-mono">{s.peptide}</td>
                    <td className="px-2 py-1.5">{s.herb}</td>
                    <td className="px-2 py-1.5 text-right font-bold">{(s.synergy_score ?? 0).toFixed(3)}</td>
                    <td className="px-2 py-1.5 text-[var(--text-muted)]">{s.mechanism || '-'}</td>
                    <td className="px-2 py-1.5 text-[var(--text-muted)]">{s.recommendation || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>'''
assert old1 in src, 'old1 not found'
src = src.replace(old1, new1)

# 2) 标题行：加综合协同统计
old2 = '''          <h3 className="text-sm font-medium flex items-center gap-2"><Zap className="w-4 h-4 text-primary"/>协同效应结果</h3>
          <div className="overflow-x-auto">'''
new2 = '''          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />协同效应结果</h3>
            <span className="text-xs text-[var(--text-muted)]">分析: {result.peptides_analyzed ?? 0} 肽 × {result.herbs_analyzed ?? 0} 药材，综合协同 {(result.overall_synergy_score ?? 0).toFixed(3)}</span>
          </div>
          <div className="overflow-x-auto">'''
assert old2 in src, 'old2 not found'
src = src.replace(old2, new2)

# 3) ranked_herbs → top_combinations
old3 = '''          {result.ranked_herbs && result.ranked_herbs.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text-muted)] mb-2">药材推荐排序</h4>
              <div className="space-y-1.5">
                {result.ranked_herbs.slice(0, 5).map((h: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                    <span className="font-medium">{i + 1}. {h.name}</span>
                    <span className="font-mono text-primary">{h.score?.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}'''
new3 = '''          {result.top_combinations && result.top_combinations.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text-muted)] mb-2">最优组合</h4>
              <div className="space-y-1.5">
                {result.top_combinations.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                    <span className="font-mono font-medium">{c.peptide} + {c.herb}</span>
                    <span className="font-mono text-primary">{(c.synergy_score ?? 0).toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}'''
assert old3 in src, 'old3 not found'
src = src.replace(old3, new3)

# 4) 药材默认列表去掉失效的动态获取（保留静态默认即可）
old4 = '''  // 从后端动态获取药食同源药材列表
  const [herbs, setHerbs] = useState<string[]>([]);
  const [herbsLoading, setHerbsLoading] = useState(true);

  useEffect(() => {
    databaseApi.getFoodHomologyHerbs({ page: 1, page_size: 50 })
      .then(res => {
        const names = (res?.items ?? [])
          .map((h: any) => h.name_cn || h.name || '')
          .filter(Boolean)
          .slice(0, 20);
        setHerbs(names);
      })
      .catch(() => {
        // fallback to defaults if API fails
        setHerbs(['黄芪', '人参', '枸杞子', '山楂', '菊花', '葛根', '酸枣仁', '灵芝']);
      })
      .finally(() => setHerbsLoading(false));
  }, []);

'''
new4 = ''
assert old4 in src, 'old4 not found'
src = src.replace(old4, new4)

# 5) 药材 chips 与 handleSynergy 中的 herbs 引用改为静态列表
old5 = '''    const herbNames = herbInput ? herbInput.split(',').map(s => s.trim()).filter(Boolean) : herbs.slice(0, 4);'''
new5 = '''    const herbNames = herbInput ? herbInput.split(',').map(s => s.trim()).filter(Boolean) : ['黄芪', '人参', '枸杞子', '山楂'];'''
assert old5 in src, 'old5 not found'
src = src.replace(old5, new5)

old6 = '''  }, [peptideSeq, herbInput]);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1">肽序列</label>'''
# 找 chips 块：{herbs.map(h => (
old7 = '''        <div className="flex flex-wrap gap-1.5">
          {herbs.map(h => (
            <button key={h} onClick={() => setHerbInput(prev => prev.includes(h) ? prev.replace(h, '').replace(/,,?/, '') : (prev ? prev + ',' + h : h))}
              className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
              {h}
            </button>
          ))}
        </div>'''
new7 = '''        <div className="flex flex-wrap gap-1.5">
          {['黄芪', '人参', '枸杞子', '山楂', '菊花', '葛根', '酸枣仁', '灵芝'].map(h => (
            <button key={h} onClick={() => setHerbInput(prev => prev.includes(h) ? prev.replace(h, '').replace(/,,?/, '').replace(/,$/, '') : (prev ? prev + ',' + h : h))}
              className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
              {h}
            </button>
          ))}
        </div>'''
assert old7 in src, 'old7 not found'
src = src.replace(old7, new7)

with io.open(P, 'w', encoding='utf-8', newline='') as f:
    f.write(src)
print('PeptideStructureAnalyzer.tsx patched')

# 6) service 类型对齐
with io.open(P2, encoding='utf-8') as f:
    s2 = f.read()
old_t = '''    data: {
      synergies: Array<{ peptide: string; herb: string; synergy_score: number; mechanism: string }>;
      ranked_herbs: Array<{ name: string; score: number; reason: string }>;
    };'''
new_t = '''    data: {
      peptides_analyzed: number;
      herbs_analyzed: number;
      synergy_matrix: Array<Array<{ peptide: string; herb: string; synergy_score: number; mechanism: string; recommendation: string }>>;
      overall_synergy_score: number;
      top_combinations: Array<{ peptide: string; herb: string; synergy_score: number }>;
      recommendations: Array<string>;
    };'''
assert old_t in s2, 'service type block not found'
s2 = s2.replace(old_t, new_t)
with io.open(P2, 'w', encoding='utf-8', newline='') as f:
    f.write(s2)
print('peptideStructureService.ts patched')
print('ALL OK')
