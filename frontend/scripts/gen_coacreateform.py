# -*- coding: utf-8 -*-
"""Generate COACreateForm.tsx with proper UTF-8 encoding."""
from pathlib import Path

content = r'''/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * COA 新建/编辑表单组件
 */
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coaService } from '@/services/professional/coaService';
import type { PeptideBatchCOA, COATestItem } from '@/services/professional/coaService';
import { Button, Input } from '@/components/ui';
import { useToast } from '@/components/ui';
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
  { value: 'sensory', label: '\u611f\u5b98\u8981\u6c42' },
  { value: 'chemical', label: '\u7406\u5316\u6307\u6807' },
  { value: 'microbial', label: '\u5fae\u751f\u7269\u6307\u6807' },
  { value: 'packaging', label: '\u5305\u88c5\u6807\u7b7e' },
] as const;

const DEFAULT_TEMPLATE: COATestItem[] = [
  { category: 'sensory', item_name: '\u8272\u6cfd', item_name_en: 'Color', standard: '\u5177\u6709\u672c\u54c1\u5e94\u6709\u7684\u8272\u6cfd', sort_order: 1 },
  { category: 'sensory', item_name: '\u6027\u72b6', item_name_en: 'State', standard: '\u5747\u5300\u6027\u7c89\u672b\u72b6\u6216\u9897\u7c92\u72b6\uff0c\u65e0\u7ed3\u5757\u73b0\u8c61', sort_order: 2 },
  { category: 'sensory', item_name: '\u6c14\u5473\u4e0e\u5473\u9053', item_name_en: 'Odor & Taste', standard: '\u5177\u6709\u672c\u54c1\u56fa\u6709\u7684\u5473\u9053\u548c\u6c14\u5473\uff0c\u65e0\u5f02\u5473', sort_order: 3 },
  { category: 'sensory', item_name: '\u6742\u8d28', item_name_en: 'Impurities', standard: '\u65e0\u6b63\u5e38\u89c6\u529b\u53ef\u89c1\u5916\u6765\u6742\u8d28', sort_order: 4 },
  { category: 'chemical', item_name: '\u6c34\u5206\u542b\u91cf(%)', item_name_en: 'Moisture Content', standard: '\u2264 7.0', unit: '%', sort_order: 5 },
  { category: 'chemical', item_name: '\u7070\u5206(\u5e72\u57fa,%)', item_name_en: 'Ash', standard: '\u2264 7.0', unit: '%', sort_order: 6 },
  { category: 'chemical', item_name: '\u7c97\u86cb\u767d\u8d28(\u5e72\u57fa,%)', item_name_en: 'Crude Protein', standard: '\u2265 80.0', unit: '%', sort_order: 7 },
  { category: 'chemical', item_name: '\u80bd\u542b\u91cf(\u5e72\u57fa,%)', item_name_en: 'Peptide Content', standard: '\u2265 80.0', unit: '%', sort_order: 8 },
  { category: 'microbial', item_name: '\u83cc\u843d\u603b\u6570(CFU/g)', item_name_en: 'Total Plate Count', standard: 'n=5,c=2,m=10\u2074,M=10\u2075', sort_order: 9 },
  { category: 'microbial', item_name: '\u5927\u80a0\u83cc\u7fa4(CFU/g)', item_name_en: 'Coliform', standard: 'n=5,c=2,m=10,M=10\u00b2', sort_order: 10 },
  { category: 'packaging', item_name: '\u51c0\u542b\u91cf', item_name_en: 'Net Content', standard: '\u6807\u793a\u91cf', sort_order: 11 },
  { category: 'packaging', item_name: '\u4ea7\u54c1\u5305\u88c5', item_name_en: 'Packaging', standard: '\u5305\u88c5\u6574\u6d01\u3001\u536b\u751f\uff0c\u5bc6\u5c01\u5b8c\u597d', sort_order: 12 },
  { category: 'packaging', item_name: '\u6807\u7b7e', item_name_en: 'Label', standard: 'GB 7718\u548cGB 28050\u7684\u8981\u6c42', sort_order: 13 },
];

export function COACreateForm({ peptideId, onClose, editCOA }: COACreateFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    product_name_cn: editCOA?.product_name_cn ?? '',
    product_name_en: editCOA?.product_name_en ?? '',
    product_type: editCOA?.product_type ?? '\u5176\u4ed6\u98df\u54c1',
    product_code: editCOA?.product_code ?? '',
    spec: editCOA?.spec ?? '',
    batch_no: editCOA?.batch_no ?? '',
    mfg_date: editCOA?.mfg_date ? editCOA.mfg_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    gb_standard: editCOA?.gb_standard ?? 'GB31645\u20142018',
    tested_by: editCOA?.tested_by ?? '',
    checked_by: editCOA?.checked_by ?? '',
    approved_by: editCOA?.approved_by ?? '',
    test_conclusion: editCOA?.test_conclusion ?? '\u5f85\u68c0',
  });

  const [testItems, setTestItems] = useState<COATestItem[]>(
    editCOA?.test_items ?? [...DEFAULT_TEMPLATE]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!editCOA && peptideId) {
      // Auto-fill from peptide context (simplified)
    }
  }, [peptideId, editCOA]);

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
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
      toast({ type: 'success', message: '\u751f\u6210COA\u62a5\u544a\u5df2\u6210\u529f' });
      onClose();
    },
    onError: () => {
      toast({ type: 'error', message: '\u521b\u5efa\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => coaService.update(editCOA!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-list'] });
      toast({ type: 'success', message: 'COA\u62a5\u544a\u5df2\u66f4\u65b0' });
      onClose();
    },
    onError: () => {
      toast({ type: 'error', message: '\u66f4\u65b0\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc' });
    },
  });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.product_name_cn.trim()) errs.product_name_cn = '\u8bf7\u8f93\u5165\u4ea7\u54c1\u540d\u79f0';
    if (!form.batch_no.trim()) errs.batch_no = '\u8bf7\u8f93\u5165\u751f\u4ea7\u6279\u53f7';
    if (!form.mfg_date) errs.mfg_date = '\u8bf7\u9009\u62e9\u751f\u4ea7\u65e5\u671f';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const payload = {
      ...form,
      peptide_id: peptideId,
      qualified: form.test_conclusion === '\u5408\u683c',
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
            {editCOA ? '\u7f16\u8f91COA\u62a5\u544a' : '\u65b0\u5efa\u51fa\u5382\u68c0\u9a8c\u62a5\u544a'}
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-3">\u57fa\u672c\u4fe1\u606f</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u4ea7\u54c1\u540d\u79f0\uff08\u4e2d\u6587\uff09*</label>
                <Input
                  value={form.product_name_cn}
                  onChange={e => updateField('product_name_cn', e.target.value)}
                  placeholder="\u5982\uff1a\u9c7c\u80f6\u539f\u86cb\u767d\u80bf"
                  className={errors.product_name_cn ? 'border-red-400' : ''}
                />
                {errors.product_name_cn && <p className="text-xs text-red-500 mt-0.5">{errors.product_name_cn}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u4ea7\u54c1\u540d\u79f0\uff08\u82f1\u6587\uff09</label>
                <Input
                  value={form.product_name_en}
                  onChange={e => updateField('product_name_en', e.target.value)}
                  placeholder="Hydrolyzed Collagen"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u4ea7\u54c1\u7c7b\u578b</label>
                <select
                  value={form.product_type}
                  onChange={e => updateField('product_type', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border-subtle)] rounded-lg bg-white text-[var(--text-primary)]"
                >
                  <option>\u5176\u4ed6\u98df\u54c1</option>
                  <option>\u4fdd\u5065\u98df\u54c1</option>
                  <option>\u7279\u6b8a\u533b\u5b66\u7528\u9014\u914d\u65b9\u98df\u54c1</option>
                  <option>\u5a74\u5e7c\u513f\u914d\u65b9\u98df\u54c1</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u4ea7\u54c1\u7f16\u53f7</label>
                <Input value={form.product_code} onChange={e => updateField('product_code', e.target.value)} placeholder="AMO-06" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u89c4\u683c</label>
                <Input value={form.spec} onChange={e => updateField('spec', e.target.value)} placeholder="20\u5343\u514b/\u888b" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u751f\u4ea7\u6279\u53f7 *</label>
                <Input value={form.batch_no} onChange={e => updateField('batch_no', e.target.value)} placeholder="20240518"
                  className={errors.batch_no ? 'border-red-400' : ''} />
                {errors.batch_no && <p className="text-xs text-red-500 mt-0.5">{errors.batch_no}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u751f\u4ea7\u65e5\u671f *</label>
                <Input type="date" value={form.mfg_date} onChange={e => updateField('mfg_date', e.target.value)}
                  className={errors.mfg_date ? 'border-red-400' : ''} />
                {errors.mfg_date && <p className="text-xs text-red-500 mt-0.5">{errors.mfg_date}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u6267\u884c\u6807\u51c6</label>
                <Input value={form.gb_standard} onChange={e => updateField('gb_standard', e.target.value)} placeholder="GB31645\u20142018" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u68c0\u9a8c\u7ed3\u8bba</label>
                <select
                  value={form.test_conclusion}
                  onChange={e => updateField('test_conclusion', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border-subtle)] rounded-lg bg-white text-[var(--text-primary)]"
                >
                  <option>\u5f85\u68c0</option>
                  <option>\u5408\u683c</option>
                  <option>\u4e0d\u5408\u683c</option>
                </select>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-3">\u4eba\u5458\u7b7e\u540d</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u68c0\u6d4b\u4eba</label>
                <Input value={form.tested_by} onChange={e => updateField('tested_by', e.target.value)} placeholder="\u5f20\u68c0\u9a8c" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u6821\u5bf9\u4eba</label>
                <Input value={form.checked_by} onChange={e => updateField('checked_by', e.target.value)} placeholder="\u674e\u6821\u5bf9" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">\u6279\u51c6\u4eba</label>
                <Input value={form.approved_by} onChange={e => updateField('approved_by', e.target.value)} placeholder="\u738b\u6279\u51c6" />
              </div>
            </div>
          </div>

          {/* Test Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-primary)]">\u68c0\u9a8c\u5355\u9879\uff08{testItems.length}\u9879\uff09</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addTestItem} className="gap-1 text-xs">
                  <Plus className="w-3 h-3" /> \u6dfb\u52a0\u9879\u76ee
                </Button>
                {testItems.length === 0 && (
                  <Button variant="outline" size="sm" onClick={() => setTestItems([...DEFAULT_TEMPLATE])} className="gap-1 text-xs">
                    \u4f7f\u7528\u9ed8\u8ba4\u6a21\u677f
                  </Button>
                )}
              </div>
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
                      placeholder="\u68c0\u6d4b\u9879\u76ee\u540d"
                      className="text-xs"
                    />
                    <Input
                      value={item.standard}
                      onChange={e => updateTestItem(idx, 'standard', e.target.value)}
                      placeholder="\u6807\u51c6/\u9650\u503c"
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={item.result ?? ''}
                        onChange={e => updateTestItem(idx, 'result', e.target.value)}
                        placeholder="\u7ed3\u679c"
                        className="text-xs"
                      />
                      <Input
                        value={item.unit ?? ''}
                        onChange={e => updateTestItem(idx, 'unit', e.target.value)}
                        placeholder="\u5355\u4f4d"
                        className="text-xs w-16"
                      />
                    </div>
                    <select
                      value={item.judgment ?? '\u5f85\u5224\u5b9a'}
                      onChange={e => updateTestItem(idx, 'judgment', e.target.value)}
                      className="px-2 py-1 text-xs border border-[var(--border-subtle)] rounded bg-white col-span-2"
                    >
                      <option>\u5f85\u5224\u5b9a</option>
                      <option>\u7b26\u5408</option>
                      <option>\u4e0d\u7b26\u5408</option>
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] bg-slate-50">
          <span className="text-xs text-[var(--text-muted)]">
            {testItems.filter(i => i.item_name.trim()).length} \u9879\u68c0\u6d4b\u5df2\u914d\u7f6e
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>\u53d6\u6d88</Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || !form.batch_no || !form.product_name_cn}
              className="gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              {createMutation.isPending || updateMutation.isPending ? '\u4fdd\u5b58\u4e2...' : (editCOA ? '\u4fdd\u5b58\u4fee\u6539' : '\u521b\u5efaCOA')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
'''

p = Path(r'src/components/coa/COACreateForm.tsx')
with open(p, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print(f"Written {len(content)} bytes to {p}")
