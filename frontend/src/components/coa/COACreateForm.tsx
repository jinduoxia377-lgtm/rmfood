/* eslint-disable @typescript-eslint/no-explicit-any */
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
  { value: 'sensory', label: '感官要求' },
  { value: 'chemical', label: '理化指标' },
  { value: 'microbial', label: '微生物指标' },
  { value: 'packaging', label: '包装标签' },
] as const;

const DEFAULT_TEMPLATE: COATestItem[] = [
  { category: 'sensory', item_name: '色泽', item_name_en: 'Color', standard: '具有本品应有的色泽', sort_order: 1 },
  { category: 'sensory', item_name: '性状', item_name_en: 'State', standard: '均匀性粉末状或颗粒状，无结块现象', sort_order: 2 },
  { category: 'sensory', item_name: '气味与滋味', item_name_en: 'Odor & Taste', standard: '具有本品固有的滋味和气味，无异味', sort_order: 3 },
  { category: 'sensory', item_name: '杂质', item_name_en: 'Impurities', standard: '无正常视力可见外来杂质', sort_order: 4 },
  { category: 'chemical', item_name: '水分含量(%)', item_name_en: 'Moisture Content', standard: '\u2264 7.0', unit: '%', sort_order: 5 },
  { category: 'chemical', item_name: '灰分(干基,% )', item_name_en: 'Ash', standard: '\u2264 7.0', unit: '%', sort_order: 6 },
  { category: 'chemical', item_name: '粗蛋白质(干基,% )', item_name_en: 'Crude Protein', standard: '\u2265 80.0', unit: '%', sort_order: 7 },
  { category: 'chemical', item_name: '肽含量(干基,% )', item_name_en: 'Peptide Content', standard: '\u2265 80.0', unit: '%', sort_order: 8 },
  { category: 'microbial', item_name: '菌落总数(CFU/g)', item_name_en: 'Total Plate Count', standard: 'n=5,c=2,m=10\u2074,M=10\u2075', sort_order: 9 },
  { category: 'microbial', item_name: '大肠菌群(CFU/g)', item_name_en: 'Coliform', standard: 'n=5,c=2,m=10,M=10\u00b2', sort_order: 10 },
  { category: 'packaging', item_name: '净含量', item_name_en: 'Net Content', standard: '标示量', sort_order: 11 },
  { category: 'packaging', item_name: '产品包装', item_name_en: 'Packaging', standard: '包装整洁、卫生，密封完好', sort_order: 12 },
  { category: 'packaging', item_name: '标签', item_name_en: 'Label', standard: 'GB 7718和GB 28050的要求', sort_order: 13 },
];

export function COACreateForm({ peptideId, onClose, editCOA }: COACreateFormProps) {
  const { success: toastSuccess, error: toastError, warning: _toastWarning } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    product_name_cn: editCOA?.product_name_cn ?? '',
    product_name_en: editCOA?.product_name_en ?? '',
    product_type: editCOA?.product_type ?? '其他食品',
    product_code: editCOA?.product_code ?? '',
    spec: editCOA?.spec ?? '',
    batch_no: editCOA?.batch_no ?? '',
    mfg_date: editCOA?.mfg_date ? editCOA.mfg_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    gb_standard: editCOA?.gb_standard ?? 'GB31645\u20142018',
    tested_by: editCOA?.tested_by ?? '',
    checked_by: editCOA?.checked_by ?? '',
    approved_by: editCOA?.approved_by ?? '',
    test_conclusion: editCOA?.test_conclusion ?? '待检',
  });

  const [testItems, setTestItems] = useState<COATestItem[]>(
    editCOA?.test_items ?? [...DEFAULT_TEMPLATE]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!editCOA && peptideId) {
      // auto-fill from peptide context
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
      toastSuccess('COA报告创建成功');
      onClose();
    },
    onError: () => {
      toastError('创建失败，请检查网络');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => coaService.update(editCOA!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-list'] });
      toastSuccess('COA报告已更新');
      onClose();
    },
    onError: () => {
      toastError('更新失败，请检查网络');
    },
  });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.product_name_cn.trim()) errs.product_name_cn = '请输入产品名称';
    if (!form.batch_no.trim()) errs.batch_no = '请输入生产批号';
    if (!form.mfg_date) errs.mfg_date = '请选择生产日期';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
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
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
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
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-3">基本信息</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">产品名称（中文）*</label>
                <Input
                  value={form.product_name_cn}
                  onChange={e => updateField('product_name_cn', e.target.value)}
                  placeholder="如：鱼胶原蛋白肽"
                  className={errors.product_name_cn ? 'border-error-400' : ''}
                />
                {errors.product_name_cn && <p className="text-xs text-error-500 mt-0.5">{errors.product_name_cn}</p>}
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
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border-subtle)] rounded-lg bg-white dark:bg-neutral-900 text-[var(--text-primary)]"
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
                <Input value={form.batch_no} onChange={e => updateField('batch_no', e.target.value)} placeholder="20240518"
                  className={errors.batch_no ? 'border-error-400' : ''} />
                {errors.batch_no && <p className="text-xs text-error-500 mt-0.5">{errors.batch_no}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">生产日期 *</label>
                <Input type="date" value={form.mfg_date} onChange={e => updateField('mfg_date', e.target.value)}
                  className={errors.mfg_date ? 'border-error-400' : ''} />
                {errors.mfg_date && <p className="text-xs text-error-500 mt-0.5">{errors.mfg_date}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">执行标准</label>
                <Input value={form.gb_standard} onChange={e => updateField('gb_standard', e.target.value)} placeholder="GB31645\u20142018" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">检验结论</label>
                <select
                  value={form.test_conclusion}
                  onChange={e => updateField('test_conclusion', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border-subtle)] rounded-lg bg-white dark:bg-neutral-900 text-[var(--text-primary)]"
                >
                  <option>待检</option>
                  <option>合格</option>
                  <option>不合格</option>
                </select>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-3">人员签名</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

          {/* Test Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-primary)]">检验单项（{testItems.length}项）</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addTestItem} className="gap-1 text-xs">
                  <Plus className="w-3 h-3" /> 添加项目
                </Button>
                {testItems.length === 0 && (
                  <Button variant="outline" size="sm" onClick={() => setTestItems([...DEFAULT_TEMPLATE])} className="gap-1 text-xs">
                    使用默认模板
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {testItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-[var(--border-subtle)]">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={item.category}
                      onChange={e => updateTestItem(idx, 'category', e.target.value)}
                      className="px-2 py-1 text-xs border border-[var(--border-subtle)] rounded bg-white dark:bg-neutral-900"
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
                      className="px-2 py-1 text-xs border border-[var(--border-subtle)] rounded bg-white dark:bg-neutral-900 col-span-2"
                    >
                      <option>待判定</option>
                      <option>符合</option>
                      <option>不符合</option>
                    </select>
                  </div>
                  <button onClick={() => removeTestItem(idx)} className="mt-4 text-error-400 hover:text-error-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-800">
          <span className="text-xs text-[var(--text-muted)]">
            {testItems.filter(i => i.item_name.trim()).length} 项检测已配置
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || !form.batch_no || !form.product_name_cn}
              className="gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              {createMutation.isPending || updateMutation.isPending ? '保存中...' : (editCOA ? '保存修改' : '创建COA')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
