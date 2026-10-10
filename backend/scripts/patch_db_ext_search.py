# -*- coding: utf-8 -*-
"""数据库 Tab 外部检索并入 + 来源库标注（第 4 项）— 幂等 + 严格文本锚点"""
import io, sys

P = r'D:\RMFOODFP\frontend\src\pages\database\tabs\PeptideStructureAnalyzer.tsx'
src = io.open(P, encoding='utf-8').read()

if 'doExternalSearch' in src:
    print('ALREADY APPLIED, skipping')
    sys.exit(0)

# 1) 插入状态 + doExternalSearch（锚点：PAGE_SIZE 行 + doSearch 块）
anchor1 = "  const PAGE_SIZE = 20;\n"
assert anchor1 in src, 'anchor1 not found'

new_state = """  // 外部数据源检索状态
  const [useOnline, setUseOnline] = useState(false);
  const [extLoading, setExtLoading] = useState(false);
  const [extResults, setExtResults] = useState<DatabasePeptide[]>([]);
  const [extMeta, setExtMeta] = useState<{ seq: string; dbs: string[] } | null>(null);
"""
src = src.replace(anchor1, new_state + anchor1, 1)

# 在 doSearch 定义后插入 doExternalSearch
anchor2 = "  }, []);\n\n  const handleLoadStats"
assert anchor2 in src, 'anchor2 not found'
ext_fn = """  }, []);

  // 外部数据源检索（DFBP 本地 7540 条 + BioPeptideDB 在线可选）
  const doExternalSearch = useCallback(async (seq: string) => {
    if (!seq.trim()) return;
    setExtLoading(true); setExtResults([]); setExtMeta(null);
    try {
      const res = await peptideStructureService.externalSourceLookup(seq.trim().toUpperCase(), useOnline);
      const mapped: DatabasePeptide[] = (res.records || []).map(r => ({
        sequence: r.sequence,
        source_protein: r.source_protein ?? undefined,
        activity_type: r.activity_type ?? undefined,
        activity_value: r.activity_value ?? undefined,
        activity_unit: r.activity_unit ?? undefined,
        molecular_weight: r.molecular_weight ?? undefined,
        food_source: r.food_source ?? undefined,
        source_database: r.source_database,
      }));
      setExtResults(mapped);
      setExtMeta({ seq: seq.trim().toUpperCase(), dbs: res.databases_queried || [] });
    } catch (e: any) {
      console.error('外部检索失败:', e);
      setExtResults([]);
      setExtMeta({ seq: seq.trim().toUpperCase(), dbs: [] });
    } finally {
      setExtLoading(false);
    }
  }, [useOnline]);

  const handleLoadStats"""
src = src.replace(anchor2, ext_fn, 1)

# 2) 搜索框增加「外部检索」按钮 + 在线开关
old2 = '''        <Button variant="outline" onClick={() => doSearch('', 1)} disabled={loading}>
          显示全部
        </Button>
      </div>'''
new2 = '''        <Button variant="outline" onClick={() => doSearch('', 1)} disabled={loading}>
          显示全部
        </Button>

        <Button
          variant="ghost"
          className="border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300"
          onClick={() => doExternalSearch(query)}
          disabled={extLoading || !query}
        >
          {extLoading ? <><span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full inline-block mr-1"/>检索中...</> : <><Database className="w-4 h-4 mr-1" />外部检索</>}
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted,#9A9A9F)] cursor-pointer select-none">
          <input type="checkbox" checked={useOnline} onChange={e => setUseOnline(e.target.checked)} className="accent-primary-500" />
          BioPeptideDB 在线
        </label>
      </div>

      {/* 外部检索结果（并入表格，标注来源库） */}
      {extMeta && (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg text-xs">
            <span className="text-primary-700 dark:text-primary-300 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              外部数据源：{extMeta.dbs.length > 0 ? extMeta.dbs.join(' + ') : '未配置在线源（仅查 DFBP 本地库）'}，命中 {extResults.length} 条
            </span>
            <button onClick={() => { setExtResults([]); setExtMeta(null); }} className="text-[var(--text-muted,#9A9A9F)] hover:text-neutral-700">清除</button>
          </div>
          {extResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    {['序列', '来源库', '来源蛋白', '活性类型', '活性值', '食物来源', '操作'].map((h, i) => (
                      <th key={i} className={i < 6 ? 'px-3 py-2 text-left text-xs font-medium text-[var(--text-muted,#9A9A9F)]' : 'px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]'}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {extResults.map((p, i) => (
                    <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="px-3 py-2 font-mono font-medium">{p.sequence}</td>
                      <td className="px-3 py-2"><Badge variant="outline" size="sm">{p.source_database}</Badge></td>
                      <td className="px-3 py-2 text-xs">{p.source_protein || '-'}</td>
                      <td className="px-3 py-2 text-xs">{p.activity_type || '-'}</td>
                      <td className="px-3 py-2 text-xs">{p.activity_value != null ? `${p.activity_value} ${p.activity_unit || ''}` : '-'}</td>
                      <td className="px-3 py-2 text-xs">{p.food_source || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        {onAnalyzeSequence && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => onAnalyzeSequence(p.sequence)}>
                            <Beaker className="w-3.5 h-3.5 mr-1" />分析
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !extLoading && (
              <div className="text-center py-4 text-xs text-[var(--text-muted,#9A9A9F)]">
                该序列未在外部数据源中命中（可能为合成序列或库中未收录）
              </div>
            )
          )}
        </div>
      )}'''
assert old2 in src, 'old2 not found'
src = src.replace(old2, new2, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('DB EXT SEARCH PATCH OK')
