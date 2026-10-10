# -*- coding: utf-8 -*-
"""ExternalSourceView 增加真实在线源状态面板 + NCBI 真实文献检索 + ML 模型状态卡"""
import io, sys

P = r'D:\RMFOODFP\frontend\src\pages\database\tabs\PeptideStructureAnalyzer.tsx'
src = io.open(P, encoding='utf-8').read()

if 'RealSourceStatusPanel' in src:
    print('ALREADY APPLIED, skipping')
    sys.exit(0)

# 在 ExternalSourceView 之前插入真实源状态面板组件
anchor = 'function ExternalSourceView() {'
assert anchor in src, 'anchor not found'

panel = '''// ── 真实在线数据源状态面板（可达性实测 + 诚实降级标注）──
function RealSourceStatusPanel() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refs, setRefs] = useState<any>(null);
  const [refLoading, setRefLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await peptideStructureService.getOnlineSourceStatus();
      setStatus(s);
    } catch (e) {
      console.error('在线源状态获取失败:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLiterature = useCallback(async () => {
    setRefLoading(true); setRefs(null);
    try {
      const r = await peptideStructureService.getOnlineLiterature('ACE inhibitory peptide', 5);
      setRefs(r);
    } catch (e: any) {
      console.error('文献检索失败:', e);
      setRefs({ reachable: false, references: [], note: e?.message || '检索失败' });
    } finally {
      setRefLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            在线数据源实测状态
          </h3>
          <Button size="sm" variant="ghost" className="text-xs h-6" onClick={loadStatus} disabled={loading}>
            {loading ? '刷新中...' : '重新探测'}
          </Button>
        </div>
        {status ? (
          <div className="space-y-1">
            {status.sources.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${s.reachable ? 'bg-success-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                <span className="font-medium w-32">{s.name}</span>
                <Badge variant={s.reachable ? 'success' : 'neutral'} size="sm">{s.reachable ? '可达' : '不可达'}</Badge>
                <span className="text-[var(--text-muted,#9A9A9F)] flex-1 truncate">{s.note || s.url}</span>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t border-neutral-200 dark:border-neutral-700 text-xs text-[var(--text-muted,#9A9A9F)]">
              在线可达 {status.online_source_count} 个 · 离线 {status.offline_source_count} 个 · {status.note}
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--text-muted,#9A9A9F)] py-2">{loading ? '探测中...' : '点击「重新探测」获取各数据源可达性'}</div>
        )}
      </Card>

      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            真实在线文献（NCBI PubMed）
          </h3>
          <Button size="sm" variant="ghost" className="text-xs h-6" onClick={loadLiterature} disabled={refLoading}>
            {refLoading ? '检索中...' : '检索 ACE 抑制肽文献'}
          </Button>
        </div>
        {refs && (
          <div className="space-y-1">
            {!refs.reachable ? (
              <p className="text-xs text-[var(--text-muted,#9A9A9F)]">{refs.note}</p>
            ) : refs.references.length === 0 ? (
              <p className="text-xs text-[var(--text-muted,#9A9A9F)]">在线可达但无匹配文献。</p>
            ) : (
              refs.references.map((r: any, i: number) => (
                <div key={i} className="text-xs p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded">
                  <div className="font-medium">{r.title || '(无标题)'}</div>
                  <div className="text-[var(--text-muted,#9A9A9F)] mt-0.5">
                    PMID {r.pmid} · {r.journal || '-'} · {r.pubdate || ''} · 作者: {(r.authors || []).join(', ') || '-'}
                    {r.doi ? ` · DOI: ${r.doi}` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        <div className="text-xs text-[var(--text-muted,#9A9A9F)]">诚实降级：PubMed 不可达时不返回伪造文献，仅显示离线说明。</div>
      </Card>
    </div>
  );
}

'''
src = src.replace(anchor, panel + anchor, 1)

# 在 AdvancedToolsView 增加第 8 个子工具「真实数据源」
anchor2 = '''    { key: 'external' as const, label: '外部数据源' },
  ];'''
new2 = '''    { key: 'external' as const, label: '外部数据源' },
    { key: 'realSource' as const, label: '真实数据源' },
  ];'''
assert anchor2 in src, 'anchor2 not found'
src = src.replace(anchor2, new2, 1)

anchor3 = '''      {tool === 'external' && <ExternalSourceView />}'''
new3 = '''      {tool === 'external' && <ExternalSourceView />}
      {tool === 'realSource' && <RealSourceStatusPanel />}'''
assert anchor3 in src, 'anchor3 not found'
src = src.replace(anchor3, new3, 1)

anchor4 = '''  const [tool, setTool] = useState<'hydrolysis' | 'align' | 'quantitative' | 'solubility' | 'variants' | 'customOpt' | 'external'>('hydrolysis');'''
new4 = '''  const [tool, setTool] = useState<'hydrolysis' | 'align' | 'quantitative' | 'solubility' | 'variants' | 'customOpt' | 'external' | 'realSource'>('hydrolysis');'''
assert anchor4 in src, 'anchor4 not found'
src = src.replace(anchor4, new4, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('REAL SOURCE UI PATCH OK')
