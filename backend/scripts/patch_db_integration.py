# -*- coding: utf-8 -*-
"""数据库 Tab ↔ 完整分析 Tab 双向集成（重做版）"""
import io

P = r'D:\RMFOODFP\frontend\src\pages\database\tabs\PeptideStructureAnalyzer.tsx'
src = io.open(P, encoding='utf-8').read()

# ════════ 1. DatabaseView 签名 + 表格行分析按钮 ════════
old1 = '''// ─── 数据库查询组件 ───
function DatabaseView() {
  const [query, setQuery] = useState('');'''
new1 = '''// ─── 数据库查询组件 ───
function DatabaseView({ onAnalyzeSequence }: { onAnalyzeSequence?: (seq: string) => void }) {
  const [query, setQuery] = useState('');'''
assert old1 in src, 'old1 not found'
src = src.replace(old1, new1)

# 表头 + 行（精确缩进：18/20/22/24）
old2 = '''                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted,#9A9A9F)]">食物来源</th>
                </tr>
              </thead>
              <tbody>
                {results.map((p, i) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2 font-mono font-medium">{p.sequence}</td>
                    <td className="px-3 py-2 text-xs">{p.source_protein || '-'}</td>
                    <td className="px-3 py-2 text-xs">{p.activity_type || '-'}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {p.activity_value ? `${p.activity_value} ${p.activity_unit}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs">{p.food_source || '-'}</td>
                  </tr>
                ))}
              </tbody>'''
new2 = '''                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted,#9A9A9F)]">食物来源</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">操作</th>
                </tr>
              </thead>
              <tbody>
                {results.map((p, i) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2 font-mono font-medium">{p.sequence}</td>
                    <td className="px-3 py-2 text-xs">{p.source_protein || '-'}</td>
                    <td className="px-3 py-2 text-xs">{p.activity_type || '-'}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {p.activity_value ? `${p.activity_value} ${p.activity_unit}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs">{p.food_source || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      {onAnalyzeSequence && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-primary hover:bg-primary-50 dark:hover:bg-primary-900/20"
                          onClick={() => onAnalyzeSequence(p.sequence)}
                        >
                          <Beaker className="w-3.5 h-3.5 mr-1" />分析
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>'''
assert old2 in src, 'old2 not found'
src = src.replace(old2, new2)

# ════════ 2. 主组件：传回调 + handleAnalyzeFromDatabase + handleGoDatabase ════════
old3 = '''      {activeTab === 'database' && <DatabaseView />}'''
new3 = '''      {activeTab === 'database' && <DatabaseView onAnalyzeSequence={handleAnalyzeFromDatabase} />}'''
assert old3 in src, 'old3 not found'
src = src.replace(old3, new3)

old4 = '''  // 序列转换
  const handleConvert = useCallback(async () => {'''
new4 = '''  // 数据库 Tab → 完整分析 Tab：预填序列并自动执行分析
  const handleAnalyzeFromDatabase = useCallback((seq: string) => {
    setSequence(seq.toUpperCase());
    setActiveTab('analyze');
    setTimeout(async () => {
      try {
        const res = await peptideStructureService.analyzePeptide(seq.toUpperCase());
        setResult(res as PeptideAnalysisResult);
        if (res.smiles) fetchMolecule3D(res.smiles);
      } catch (e: any) {
        setError(e.message || '分析失败');
      }
    }, 0);
  }, [fetchMolecule3D]);

  // 完整分析 Tab 来源卡片 → 数据库 Tab
  const handleGoDatabase = useCallback((_seq: string) => {
    setActiveTab('database');
  }, []);

  // 序列转换
  const handleConvert = useCallback(async () => {'''
assert old4 in src, 'old4 not found'
src = src.replace(old4, new4)

# ════════ 3. 来源卡片底部增加「在数据库中查看」按钮 ════════
old6 = '''                      </div>
                    )}
                  </div>
                </Card>
              )}'''
# 需定位到「安全警告」块的结尾。用更精确的锚点
old6 = '''                    {result.safety?.warnings && result.safety.warnings.length > 0 && (
                      <div>
                        <div className="text-warning-600 dark:text-warning-500 mb-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />安全警告
                        </div>
                        <ul className="list-disc list-inside space-y-0.5">
                          {result.safety.warnings.map((w: string, i: number) => (
                            <li key={i} className="text-[var(--text-secondary,#6B7280)]">{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              )}'''
new6 = '''                    {result.safety?.warnings && result.safety.warnings.length > 0 && (
                      <div>
                        <div className="text-warning-600 dark:text-warning-500 mb-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />安全警告
                        </div>
                        <ul className="list-disc list-inside space-y-0.5">
                          {result.safety.warnings.map((w: string, i: number) => (
                            <li key={i} className="text-[var(--text-secondary,#6B7280)]">{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted,#9A9A9F)]">
                      数据来源：{result.source?.database || 'DFBP'} · 序列 {result.sequence}
                    </span>
                    <Button size="sm" variant="ghost" className="text-xs text-primary" onClick={() => handleGoDatabase(result.sequence)}>
                      <Database className="w-3 h-3 mr-1" />在数据库中查看
                    </Button>
                  </div>
                </Card>
              )}'''
assert old6 in src, 'old6 not found'
src = src.replace(old6, new6)

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('ALL INTEGRATION PATCHES OK')
