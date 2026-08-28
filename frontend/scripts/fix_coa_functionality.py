"""Fix COA frontend functional gaps."""
from pathlib import Path

ROOT = Path(r'src')

# ──────────────────────────────────────────────
# 1. Fix COAView.tsx stats display bug (line 368)
# ──────────────────────────────────────────────
p = ROOT / 'components/coa/COAView.tsx'
s = p.read_text(encoding='utf-8')
s = s.replace(
    "{stats.total > 0 ? '\u2014' : '0'}",
    "{stats.peptide_types ?? stats.total}"
)
p.write_text(s, encoding='utf-8')
print("[1] COAView.tsx: fixed stats display bug")

# ──────────────────────────────────────────────
# 2. Create COACreateForm component
# ──────────────────────────────────────────────
create_form = r'''/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * COA 新建/编辑表单组件
 */
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coaService } from '@/services/professional/coaService';
import type { PeptideBatchCOA, COATestItem } from '@/services/professional/coaService';
import { Button, Input } from '@/components/ui';
import { X, Plus, Trash2, Save } from 'lucide-react';

interface COACreateFormProps {
  peptideId?: number;
  onClose: () => void;
  editCOA?: PeptideBatchCOA | null;
}

const EMPTY_ITEM: COATestItem = {
  category: 'sensory',
  item_name: '',
  item_name_en: '',
  standard: '',
  unit: '',
  sort_order: 0,
};

const CATEGORIES = [
  { value: 'sensory', label: '感官要求' },
  { value: 'chemical', label: '理化指标' },
  { value: 'microbial', label: '微生物指标' },
  { value: 'packaging', label: '包装标签' },
] as const;

export function COACreateForm({ peptideId, onClose, editCOA }: COACreateFormProps) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    product_name_cn: editCOA?.product_name_cn ?? '',
    product_name_en: editCOA?.product_name_en ?? '',
    product_type: editCOA?.product_type ?? '其他食品',
    product_code: editCOA?.product_code ?? '',
    spec: editCOA?.spec ?? '',
    batch_no: editCOA?.batch_no ?? '',
    mfg_date: editCOA?.mfg_date ? editCOA.mfg_date.slice(0, 10) : '',
    gb_standard: editCOA?.gb_standard ?? 'GB31645—2018',
    tested_by: editCOA?.tested_by ?? '',
    checked_by: editCOA?.checked_by ?? '',
    approved_by: editCOA?.approved_by ?? '',
    test_conclusion: editCOA?.test_conclusion ?? '待检',
  });

  const [testItems, setTestItems] = useState<COATestItem[]>(
    editCOA?.test_items ?? [EMPTY_ITEM]
  );

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateTestItem = (idx: number, field: string, value: string) => {
    setTestItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    ));
  };

  const addTestItem = () => {
    setTestItems(prev => [...prev, { ...EMPTY_ITEM, sort_order: prev.length }]);
  };

  const removeTestItem = (idx: number) => {
    setTestItems(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, sort_order: i })));
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => coaService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-list'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => coaService.update(editCOA!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-list'] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!form.batch_no || !form.product_name_cn) return;
    const payload = {
      ...form,
      peptide_id: peptideId,
      qualified: form.test_conclusion === '合格',
      test_items: testItems.filter(i => i.item_name.trim()),
    };
    if (editCOA) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {editCOA ? '编辑COA报告' : '新建出厂检验报告'}
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 基本信息 */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-3">基本信息</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">产品名称（中文）*</label>
                <Input
                  value={form.product_name_cn}
                  onChange={e => updateField('product_name_cn', e.target.value)}
                  placeholder="如：鱼胶原蛋白肽"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">产品名称（英文）</label>
                <Input
                  value={form.product_name_en}
                  onChange={e => updateField('product_name_en', e.target.value)}
                  placeholder="Hydrolyzed Collagen"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">产品类型</label>
                <select
                  value={form.product_type}
                  onChange={e => updateField('product_type', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border-subtle)] rounded-lg bg-white text-[var(--text-primary)]"
                >
                  <option>其他食品</option>
                  <option>保健食品</option>
                  <option>特殊医学用途配方食品</option>
                  <option>婴幼儿配方食品</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">产品编号</label>
                <Input value={form.product_code} onChange={e => updateField('product_code', e.target.value)} placeholder="AMO-06" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">规格</label>
                <Input value={form.spec} onChange={e => updateField('spec', e.target.value)} placeholder="20千克/袋" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">生产批号 *</label>
                <Input value={form.batch_no} onChange={e => updateField('batch_no', e.target.value)} placeholder="20240518" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">生产日期</label>
                <Input type="date" value={form.mfg_date} onChange={e => updateField('mfg_date', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">执行标准</label>
                <Input value={form.gb_standard} onChange={e => updateField('gb_standard', e.target.value)} placeholder="GB31645—2018" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">检验结论</label>
                <select
                  value={form.test_conclusion}
                  onChange={e => updateField('test_conclusion', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border-subtle)] rounded-lg bg-white text-[var(--text-primary)]"
                >
                  <option>待检</option>
                  <option>合格</option>
                  <option>不合格</option>
                </select>
              </div>
            </div>
          </div>

          {/* 人员签名 */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-3">人员签名</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">检测人</label>
                <Input value={form.tested_by} onChange={e => updateField('tested_by', e.target.value)} placeholder="张检验" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">校对人</label>
                <Input value={form.checked_by} onChange={e => updateField('checked_by', e.target.value)} placeholder="李校对" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">批准人</label>
                <Input value={form.approved_by} onChange={e => updateField('approved_by', e.target.value)} placeholder="王批准" />
              </div>
            </div>
          </div>

          {/* 检验单项 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-primary)]">检验单项</h3>
              <Button variant="outline" size="sm" onClick={addTestItem} className="gap-1 text-xs">
                <Plus className="w-3 h-3" /> 添加项目
              </Button>
            </div>
            <div className="space-y-2">
              {testItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-[var(--border-subtle)]">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <select
                      value={item.category}
                      onChange={e => updateTestItem(idx, 'category', e.target.value)}
                      className="px-2 py-1 text-xs border border-[var(--border-subtle)] rounded bg-white"
                    >
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <Input
                      value={item.item_name}
                      onChange={e => updateTestItem(idx, 'item_name', e.target.value)}
                      placeholder="检测项目名"
                      className="text-xs"
                    />
                    <Input
                      value={item.standard}
                      onChange={e => updateTestItem(idx, 'standard', e.target.value)}
                      placeholder="标准/限值"
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={item.result ?? ''}
                        onChange={e => updateTestItem(idx, 'result', e.target.value)}
                        placeholder="结果"
                        className="text-xs"
                      />
                      <Input
                        value={item.unit ?? ''}
                        onChange={e => updateTestItem(idx, 'unit', e.target.value)}
                        placeholder="单位"
                        className="text-xs w-16"
                      />
                    </div>
                    <select
                      value={item.judgment ?? '待判定'}
                      onChange={e => updateTestItem(idx, 'judgment', e.target.value)}
                      className="px-2 py-1 text-xs border border-[var(--border-subtle)] rounded bg-white col-span-2"
                    >
                      <option>待判定</option>
                      <option>符合</option>
                      <option>不符合</option>
                    </select>
                  </div>
                  <button onClick={() => removeTestItem(idx)} className="mt-4 text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)] bg-slate-50">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending || !form.batch_no || !form.product_name_cn}
            className="gap-1"
          >
            <Save className="w-3.5 h-3.5" />
            {editCOA ? '保存修改' : '创建COA'}
          </Button>
        </div>
      </div>
    </div>
  );
}
'''

p = ROOT / 'components/coa/COACreateForm.tsx'
p.write_text(create_form, encoding='utf-8')
print("[2] Created COACreateForm.tsx")

# ──────────────────────────────────────────────
# 3. Update COATable.tsx — wire up create button, delete, pagination
# ──────────────────────────────────────────────
p = ROOT / 'components/coa/COATable.tsx'
s = p.read_text(encoding='utf-8')

# Add COACreateForm import
s = s.replace(
    "import { Search, RefreshCw } from 'lucide-react'",
    "import { Search, RefreshCw, Plus } from 'lucide-react'\nimport { COACreateForm } from '@/components/coa/COACreateForm'"
)

# Add showCreate state
s = s.replace(
    "  const [statusFilter, setStatusFilter] = useState('all');",
    "  const [statusFilter, setStatusFilter] = useState('all');\n  const [showCreate, setShowCreate] = useState(false);\n  const [editingCOA, setEditingCOA] = useState<PeptideBatchCOA | null>(null);"
)

# Fix the 新建COA button
s = s.replace(
    '''          <Button size="sm" className="gap-1">\n            新建COA\n          </Button>''',
    '''          <Button size="sm" className="gap-1" onClick={() => { setEditingCOA(null); setShowCreate(true); }}>\n            <Plus className="w-3.5 h-3.5" />\n            新建COA\n          </Button>'''
)

# Add delete functionality — inject after the card mapping
s = s.replace(
    '        </div>\n      )}',
    '''        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showCreate && (
        <COACreateForm
          peptideId={peptideId}
          editCOA={editingCOA}
          onClose={() => { setShowCreate(false); setEditingCOA(null); }}
        />
      )}
    </div>
  );
}'''
)

# Remove the old closing braces that are now duplicated
# Find and fix the closing
s = s.replace(
    '''      )}\n    </div>\n  );\n}''',
    '''      )}\n    </div>\n  );\n}'''
)

# Fix: remove trailing duplicate closing
# The replacement added extra closing, let's be more precise
# Actually let me just rewrite the whole file properly
print("  (will rewrite COATable.tsx below)")

# Rewrite COATable with all fixes
coatable_full = r'''/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * COA 列表表格组件
 */
import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coaService } from '@/services/professional/coaService';
import type { PeptideBatchCOA } from '@/services/professional/coaService';
import { COACard } from '@/components/coa/COAView';
import { COACreateForm } from '@/components/coa/COACreateForm';
import { Button, Input } from '@/components/ui';
import { Search, RefreshCw, Plus, Trash2, Edit2 } from 'lucide-react';

interface COATableProps {
  peptideId?: number;
  onCOAClick?: (coa: PeptideBatchCOA) => void;
  showStats?: boolean;
  className?: string;
}

export function COATable({ peptideId, onCOAClick, showStats = false, className = '' }: COATableProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingCOA, setEditingCOA] = useState<PeptideBatchCOA | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['coa-list', page, search, statusFilter, peptideId],
    queryFn: async () => {
      const params: any = { page, page_size: 20 };
      if (peptideId) params.peptide_id = peptideId;
      if (search) params.product_name_cn = search;
      if (statusFilter !== 'all') params.test_conclusion = statusFilter;
      return coaService.list(params);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => coaService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-list'] });
    },
  });

  const stats = useMemo(() => ({
    total: (data as any)?.total ?? 0,
    qualified: (data as any)?.items?.filter((i: PeptideBatchCOA) => i.qualified).length ?? 0,
  }), [data]);

  return (
    <div className={className}>
      {/* 统计 */}
      {showStats && data && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-xs text-[var(--text-muted)]">总计</div>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-3 text-center">
            <div className="text-xl font-bold text-green-600">{stats.qualified}</div>
            <div className="text-xs text-[var(--text-muted)]">合格</div>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{(data as any)?.items?.length ?? 0}</div>
            <div className="text-xs text-[var(--text-muted)]">当前页</div>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{Math.ceil((stats.total ?? 0) / 20)}</div>
            <div className="text-xs text-[var(--text-muted)]">总页数</div>
          </div>
        </div>
      )}

      {/* 操作栏 */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <Input
              placeholder="搜索产品名称..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-sm border border-[var(--border-subtle)] rounded-lg bg-white text-[var(--text-primary)]"
          >
            <option value="all">全部状态</option>
            <option value="合格">合格</option>
            <option value="不合格">不合格</option>
            <option value="待检">待检</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" className="gap-1" onClick={() => { setEditingCOA(null); setShowCreate(true); }}>
            <Plus className="w-3.5 h-3.5" />
            新建COA
          </Button>
        </div>
      </div>

      {/* 加载中 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && (!data?.items || data.items.length === 0) && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-sm">暂无COA数据</p>
          <p className="text-xs mt-1">点击"新建COA"添加出厂检验报告</p>
        </div>
      )}

      {/* 列表 */}
      {!isLoading && data?.items && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((coa: PeptideBatchCOA) => (
            <div key={coa.id} className="relative group">
              <COACard coa={coa} onClick={() => onCOAClick?.(coa)} />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={e => { e.stopPropagation(); setEditingCOA(coa); setShowCreate(true); }}
                  className="p-1 bg-white rounded-lg shadow-sm hover:bg-blue-50 text-[var(--text-muted)] hover:text-blue-600"
                  title="编辑"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm(`确定删除批号 ${coa.batch_no} 的COA报告？`)) {
                      deleteMutation.mutate(coa.id);
                    }
                  }}
                  className="p-1 bg-white rounded-lg shadow-sm hover:bg-red-50 text-[var(--text-muted)] hover:text-red-600"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {data?.total && data.total > 20 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-[var(--text-muted)] px-3">
            {page} / {Math.ceil(data.total / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(data.total / 20)}
            onClick={() => setPage(p => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showCreate && (
        <COACreateForm
          peptideId={peptideId}
          editCOA={editingCOA}
          onClose={() => { setShowCreate(false); setEditingCOA(null); }}
        />
      )}
    </div>
  );
}
'''
p.write_text(coatable_full, encoding='utf-8')
print("[3] Rewrote COATable.tsx with create/edit/delete")

# ──────────────────────────────────────────────
# 4. Update COAsTab.tsx — integrate stats panel
# ──────────────────────────────────────────────
p = ROOT / 'pages/database/tabs/COAsTab.tsx'
s = p.read_text(encoding='utf-8')

# Add imports
s = s.replace(
    "import { useState } from 'react';",
    "import { useState } from 'react';\nimport { useQuery } from '@tanstack/react-query';\nimport { coaService } from '@/services/professional/coaService';"
)

# Add stats panel after the title
s = s.replace(
    '      {viewMode === \'list\' ? (\n        <COATable',
    '''      {/* 统计面板 */}
      {viewMode === 'list' && (
        <CoaStatsView />
      )}

      {viewMode === 'list' ? (
        <COATable'''
)

# Add CoaStatsView component before the export
stats_view = '''
// ─── COA 统计视图 ─────────────────────────────────────────
function CoaStatsView() {
  const { data } = useQuery({
    queryKey: ['coa-stats'],
    queryFn: () => coaService.getStats(),
  });
  const stats = data?.data ?? data ?? null;
  if (!stats) return null;
  return <COAStatsPanel stats={stats} />;
}

'''
# Insert before the export
s = s.replace('export function COAsTab', stats_view + 'export function COAsTab')

p.write_text(s, encoding='utf-8')
print("[4] Updated COAsTab.tsx with stats panel")

# ──────────────────────────────────────────────
# 5. Fix COAView.tsx — ensure COAStatsPanel has correct type
# ──────────────────────────────────────────────
p = ROOT / 'components/coa/COAView.tsx'
s = p.read_text(encoding='utf-8')
# Ensure COAStatsPanel accepts the right type from API
# The API returns: { total, qualified, unqualified, pending, peptide_types, total_batches, qualified_rate }
# Our component expects: { total, qualified, unqualified, pending, qualified_rate }
# Add peptide_types to the type
s = s.replace(
    'export const COAStatsPanel: React.FC<{ stats: { total: number; qualified: number; unqualified: number; pending: number; qualified_rate: number } }>',
    'export const COAStatsPanel: React.FC<{ stats: { total: number; qualified: number; unqualified: number; pending: number; qualified_rate: number; peptide_types?: number; total_batches?: number } }>'
)
p.write_text(s, encoding='utf-8')
print("[5] COAView.tsx: COAStatsPanel type extended")

print("\nAll updates applied!")
