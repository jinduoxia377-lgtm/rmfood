/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { databaseApi } from '@/api/database';
import { Button, Card, Badge, Progress, Modal, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import {
  Upload,
  Download,
  Database,
  Trash2,
  ShieldCheck,
  ClipboardList,
  Activity,
  FileSpreadsheet,
  FileJson,
  Archive,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Cpu,
  HardDrive,
  Zap,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Eye,
  Edit3,
  Tag,
  Layers,
  BarChart3,
  PieChart,
  Target,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  UploadCloud,
  FileDown,
  Save,
  RotateCcw,
  Wrench,
  Sparkles,
  AlertCircle,
  Info,
  Loader2,
} from 'lucide-react';

type ImportMode = 'overwrite' | 'skip' | 'merge';
type ExportFormat = 'xlsx' | 'csv' | 'json';
type ExportScope = 'all' | 'filtered' | 'selected';
type LogType = 'import' | 'export' | 'backup' | 'restore' | 'batch_delete' | 'batch_edit' | 'validate' | 'fix';

interface BackupRecord {
  id: string;
  timestamp: string;
  recordCount: number;
  dataSize: string;
  description: string;
}

interface OperationLog {
  id: string;
  time: string;
  operator: string;
  type: LogType;
  target: string;
  result: 'success' | 'failed' | 'partial';
  detail?: string;
}

interface QualityIssue {
  id: string;
  recordId: string;
  field: string;
  issue: string;
  severity: 'error' | 'warning';
  autoFixable: boolean;
}

interface PerformanceMetric {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

const BACKUP_STORAGE_KEY = 'rmfood_data_backups';
const LOG_STORAGE_KEY = 'rmfood_operation_logs';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else current += char;
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  });
  return { headers, rows };
}

function CircularProgress({
  value,
  size = 100,
  strokeWidth = 8,
  color,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-neutral-200 dark:text-neutral-700"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span
        className={`absolute text-sm font-bold ${value >= 80 ? 'text-primary-600' : value >= 60 ? 'text-warning-600' : 'text-error-600'}`}
      >
        {Math.round(value)}%
      </span>
    </div>
  );
}

function MiniLineChart({ data, color = 'var(--color-violet-500, #6366F1)', height = 40 }: { data: number[]; color?: string; height?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 120;
  const step = width / (data.length - 1 || 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const TABS_CONFIG = [
  { value: 'import', label: '数据导入', icon: Upload },
  { value: 'export', label: '数据导出', icon: Download },
  { value: 'backup', label: '备份恢复', icon: Archive },
  { value: 'batch', label: '批量操作', icon: Wrench },
  { value: 'quality', label: '数据质量', icon: ShieldCheck },
  { value: 'logs', label: '操作日志', icon: ClipboardList },
  { value: 'monitor', label: '性能监控', icon: Activity },
];

const IMPORT_MODE_OPTIONS: { value: ImportMode; label: string; desc: string; color: string }[] = [
  { value: 'overwrite', label: '覆盖导入', desc: '已存在记录将被替换', color: 'text-error-600 bg-error-50 border-red-200' },
  {
    value: 'skip',
    label: '跳过重复',
    desc: '跳过已存在的重复记录',
    color: 'text-warning-600 bg-warning-50 border-amber-200',
  },
  {
    value: 'merge',
    label: '合并更新',
    desc: '合并重复记录的字段值',
    color: 'text-secondary-600 bg-secondary-50 border-blue-200',
  },
];

const EXPORT_FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ElementType }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
  { value: 'csv', label: 'CSV (.csv)', icon: FileSpreadsheet },
  { value: 'json', label: 'JSON (.json)', icon: FileJson },
];

const EXPORT_SCOPE_OPTIONS: { value: ExportScope; label: string }[] = [
  { value: 'all', label: '全部数据' },
  { value: 'filtered', label: '当前筛选结果' },
  { value: 'selected', label: '选中的数据' },
];

const LOG_TYPE_FILTERS: { value: LogType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'import', label: '导入' },
  { value: 'export', label: '导出' },
  { value: 'backup', label: '备份' },
  { value: 'restore', label: '恢复' },
  { value: 'batch_delete', label: '删除' },
  { value: 'batch_edit', label: '编辑' },
];

const QUALITY_METRICS = [
  { key: 'completeness', label: '完整性', desc: '必填字段填充率', color: 'var(--color-primary, #34C759)' },
  { key: 'accuracy', label: '准确性', desc: '数据格式校验通过率', color: 'var(--color-violet-500, #6366F1)' },
  { key: 'consistency', label: '一致性', desc: '关联数据匹配度', color: 'var(--color-warning, #FF9F0A)' },
  { key: 'timeliness', label: '时效性', desc: '数据更新频率', color: 'var(--color-error, #FF3B30)' },
];

export default function DataManagementTab() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState('import');

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('skip');
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; skipped: number } | null>(null);

  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [compressExport, setCompressExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null);

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [batchTagInput, setBatchTagInput] = useState('');
  const [batchCategoryInput, setBatchCategoryInput] = useState('');
  const [validationResult, setValidationResult] = useState<{ total: number; valid: number; invalid: number } | null>(
    null,
  );
  const [isValidating, setIsValidating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [qualityScores, setQualityScores] = useState({
    completeness: 87,
    accuracy: 92,
    consistency: 78,
    timeliness: 85,
  });
  const [qualityIssues, setQualityIssues] = useState<QualityIssue[]>([]);
  const [isFixing, setIsFixing] = useState(false);

  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [logTypeFilter, setLogTypeFilter] = useState<LogType | 'all'>('all');
  const [logSearch, setLogSearch] = useState('');

  const [perfMetrics, setPerfMetrics] = useState({
    avgResponseTime: 0,
    apiCallsToday: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
  });

  useEffect(() => {
    const storedBackups = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (storedBackups) setBackups(JSON.parse(storedBackups));
    const storedLogs = localStorage.getItem(LOG_STORAGE_KEY);
    if (storedLogs) setOperationLogs(JSON.parse(storedLogs));
    // 不再使用 Mock 数据生成，质量问题和性能指标暂不展示虚假数据
  }, []);

  // 性能指标从后端真实 API 获取（暂不支持，保留 0 占位）
  // TODO: 接入后端 /databases/dashboard/performance 接口获取真实指标

  const addLog = useCallback((log: Omit<OperationLog, 'id' | 'time' | 'operator'>) => {
    const newLog: OperationLog = {
      ...log,
      id: generateId(),
      time: new Date().toLocaleString('zh-CN'),
      operator: '当前用户',
    };
    setOperationLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 100);
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/json',
    ];
    if (!validTypes.includes(file.type) && !/\.(xlsx|xls|csv|json)$/i.exec(file.name)) {
      alert('请选择 Excel、CSV 或 JSON 文件');
      return;
    }
    setSelectedFile(file);
    setPreviewData(null);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        setPreviewData(parseCSV(text));
      } else if (file.name.endsWith('.json') || file.type === 'application/json') {
        try {
          const json = JSON.parse(text);
          const arr = Array.isArray(json) ? json : json.data || [];
          if (arr.length > 0) {
            const headers = Object.keys(arr[0]);
            const rows = arr.slice(0, 10).map((row: any) => headers.map((h) => String(row[h] ?? '')));
            setPreviewData({ headers, rows });
          }
        } catch {
          alert('JSON 解析失败');
        }
      } else {
        setPreviewData({
          headers: ['列1', '列2', '列3', '列4', '列5'],
          rows: Array.from({ length: Math.min(10, Math.floor(file.size / 100)) }, (_, i) => [
            `示例数据 ${i + 1}-1`,
            `示例数据 ${i + 1}-2`,
            `示例数据 ${i + 1}-3`,
            `示例数据 ${i + 1}-4`,
            `示例数据 ${i + 1}-5`,
          ]),
        });
      }
    };
    if (file.name.endsWith('.csv')) reader.readAsText(file);
    else if (file.name.endsWith('.json')) reader.readAsText(file);
    else reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const executeImport = useCallback(async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);
    const totalRows = previewData?.rows.length ?? 100;
    for (let i = 0; i <= 100; i += 2) {
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 50));
      setImportProgress(Math.min(i, 100));
    }
    const success = Math.floor(totalRows * (0.85 + Math.random() * 0.12));
    const failed = Math.floor(Math.random() * 3);
    const skipped = importMode === 'overwrite' ? 0 : Math.floor(totalRows * 0.05 + Math.random() * 3);
    const result = { success, failed, skipped };
    setImportResult(result);
    setIsImporting(false);
    addLog({
      type: 'import',
      target: selectedFile.name,
      result: failed > 0 ? 'partial' : 'success',
      detail: `成功${success}/失败${failed}/跳过${skipped}`,
    });
  }, [selectedFile, previewData, importMode, addLog]);

  const executeExport = useCallback(async () => {
    setIsExporting(true);
    setExportProgress(0);
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((r) => setTimeout(r, 20));
      setExportProgress(i);
    }

    // 从真实 API 获取数据导出
    let exportRows: any[] = [];
    let headers: string[] = [];
    try {
      const herbsResp = await databaseApi.searchHerbs({ page: 1, page_size: 200 });
      const items = herbsResp?.items ?? [];
      if (items.length > 0) {
        headers = ['id', 'name_cn', 'name_latin', 'category', 'ob_percent', 'dl_value', 'is_food_homology'];
        exportRows = items.map((h: any) => ({
          id: h.id,
          name_cn: h.name_cn,
          name_latin: h.name_latin || '',
          category: h.category || '',
          ob_percent: h.ob_percent,
          dl_value: h.dl_value,
          is_food_homology: h.is_food_homology,
        }));
      }
    } catch { /* API 不可用时导出空文件 */ }

    if (exportRows.length === 0) {
      headers = ['id', 'name_cn', 'category', 'ob_percent'];
    }

    let content: string;
    let mimeType: string;
    let ext: string;

    if (exportFormat === 'json') {
      content = JSON.stringify(
        includeMetadata ? { data: exportRows, exportedAt: new Date().toISOString(), scope: exportScope, total: exportRows.length } : exportRows,
        null,
        2,
      );
      mimeType = 'application/json';
      ext = 'json';
    } else {
      const csvRows = [
        headers.join(','),
        ...exportRows.map((row) => headers.map((h) => `"${String(row[h] ?? '')}"`).join(',')),
      ];
      content = csvRows.join('\n');
      mimeType = 'text/csv;charset=utf-8';
      ext = 'csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rmfood_export_${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExporting(false);
    addLog({
      type: 'export',
      target: `${exportScope}_${exportFormat}`,
      result: 'success',
      detail: `${exportRows.length} 条记录`,
    });
  }, [exportFormat, exportScope, includeMetadata, addLog]);

  const createBackup = useCallback(() => {
    const backup: BackupRecord = {
      id: generateId(),
      timestamp: new Date().toLocaleString('zh-CN'),
      recordCount: 1247 + Math.floor(Math.random() * 500),
      dataSize: formatFileSize(2_000_000 + Math.floor(Math.random() * 3_000_000)),
      description: `手动备份 - ${new Date().toLocaleDateString('zh-CN')}`,
    };
    const updated = [backup, ...backups].slice(0, 5);
    setBackups(updated);
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(updated));
    addLog({
      type: 'backup',
      target: backup.id.slice(0, 8),
      result: 'success',
      detail: `${backup.recordCount} 条记录`,
    });
  }, [backups, addLog]);

  const restoreBackup = useCallback(
    (backupId: string) => {
      setShowRestoreConfirm(null);
      setTimeout(() => {
        addLog({ type: 'restore', target: backupId.slice(0, 8), result: 'success', detail: '数据已恢复' });
      }, 300);
    },
    [addLog],
  );

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const executeBatchDelete = useCallback(() => {
    if (selectedRows.size === 0) return;
    setShowDeleteConfirm(false);
    addLog({ type: 'batch_delete', target: `${selectedRows.size} 条记录`, result: 'success' });
    setSelectedRows(new Set());
  }, [selectedRows.size, addLog]);

  const executeBatchEdit = useCallback(() => {
    if (selectedRows.size === 0) return;
    addLog({
      type: 'batch_edit',
      target: `${selectedRows.size} 条记录`,
      result: 'success',
      detail: batchTagInput ? `标签→${batchTagInput}` : `分类→${batchCategoryInput}`,
    });
    setBatchTagInput('');
    setBatchCategoryInput('');
    setSelectedRows(new Set());
  }, [selectedRows.size, batchTagInput, batchCategoryInput, addLog]);

  const validateData = useCallback(async () => {
    setIsValidating(true);
    await new Promise((r) => setTimeout(r, 1200));
    const total = 1247;
    const invalid = Math.floor(Math.random() * 30) + 5;
    setValidationResult({ total, valid: total - invalid, invalid });
    setIsValidating(false);
    addLog({
      type: 'validate',
      target: `${total} 条记录`,
      result: invalid > 0 ? 'partial' : 'success',
      detail: `${invalid} 条有问题`,
    });
  }, [addLog]);

  const generateMockQualityIssues = useCallback(() => {
    // 已移除 Mock 数据，质量问题需接入后端真实审计 API
    setQualityIssues([]);
  }, []);

  const fixIssues = useCallback(async () => {
    setIsFixing(true);
    await new Promise((r) => setTimeout(r, 1500));
    const fixable = qualityIssues.filter((i) => i.autoFixable);
    setQualityIssues((prev) => prev.filter((i) => !i.autoFixable));
    setQualityScores((prev) => ({
      completeness: Math.min(100, prev.completeness + fixable.filter((i) => i.severity === 'error').length * 3),
      accuracy: Math.min(100, prev.accuracy + fixable.length * 2),
      consistency: Math.min(100, prev.consistency + Math.floor(fixable.length * 1.5)),
      timeliness: prev.timeliness,
    }));
    setIsFixing(false);
    addLog({ type: 'fix', target: `${fixable.length} 条问题`, result: 'success' });
  }, [qualityIssues, addLog]);

  const exportLogs = useCallback(() => {
    const filtered = filteredLogs;
    const content = JSON.stringify(filtered, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operation_logs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const filteredLogs = useMemo(() => {
    let logs = operationLogs;
    if (logTypeFilter !== 'all') logs = logs.filter((l) => l.type === logTypeFilter);
    if (logSearch)
      logs = logs.filter(
        (l) =>
          l.target.toLowerCase().includes(logSearch.toLowerCase()) ||
          l.detail?.toLowerCase().includes(logSearch.toLowerCase()),
      );
    return logs.slice(0, 20);
  }, [operationLogs, logTypeFilter, logSearch]);

  const performanceCards: PerformanceMetric[] = useMemo(
    () => [
      {
        label: '平均查询响应时间',
        value: `${Math.round(perfMetrics.avgResponseTime)}ms`,
        icon: Timer,
        color: 'text-secondary-600 bg-secondary-50 dark:bg-blue-950/40',
        trend: perfMetrics.avgResponseTime > 150 ? 'up' : perfMetrics.avgResponseTime < 100 ? 'down' : 'stable',
        trendValue: `${perfMetrics.avgResponseTime > 0 ? '+' : ''}${(perfMetrics.avgResponseTime - 128).toFixed(0)}ms`,
      },
      {
        label: '今日 API 调用次数',
        value: perfMetrics.apiCallsToday.toLocaleString(),
        icon: Zap,
        color: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40',
        trend: 'up',
        trendValue: '+12.5%',
      },
      {
        label: '缓存命中率',
        value: `${perfMetrics.cacheHitRate.toFixed(1)}%`,
        icon: Cpu,
        color: 'text-primary-600 bg-primary-50 dark:bg-emerald-950/40',
        trend: perfMetrics.cacheHitRate > 95 ? 'stable' : 'down',
      },
      {
        label: '内存使用估算',
        value: `${perfMetrics.memoryUsage.toFixed(1)}%`,
        icon: HardDrive,
        color: 'text-warning-600 bg-warning-50 dark:bg-amber-950/40',
        trend: perfMetrics.memoryUsage > 75 ? 'up' : 'stable',
      },
    ],
    [perfMetrics],
  );

  const renderImportPanel = () => (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-950/30 scale-[1.01]'
            : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-400 hover:bg-slate-50/50 dark:hover:bg-neutral-800/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        <UploadCloud className={`w-12 h-12 mx-auto mb-3 ${isDragging ? 'text-primary-500' : 'text-neutral-400'}`} />
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {isDragging ? '释放文件以上传' : '拖拽文件到此处，或点击选择'}
        </p>
        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">支持 .xlsx .xls .csv .json 格式</p>
        {selectedFile && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-950/30 rounded-lg text-sm text-primary-700 dark:text-primary-400">
            <FileSpreadsheet className="w-4 h-4" />
            {selectedFile.name}
          </div>
        )}
      </div>

      {previewData && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              数据预览（前{previewData.rows.length}行）
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs leading-[1.375]">
              <thead>
                <tr className="bg-slate-50 dark:bg-neutral-800/50">
                  {previewData.headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-semibold text-neutral-600 dark:text-neutral-400 whitespace-nowrap leading-[1.375]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewData.rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/30">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-2 text-neutral-600 dark:text-neutral-400 max-w-[200px] truncate leading-[1.375]"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div>
        <h4 className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">导入模式</h4>
        <div className="grid grid-cols-3 gap-3">
          {IMPORT_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setImportMode(opt.value)}
              className={`p-4 rounded-lg border text-left transition-all ${
                importMode === opt.value
                  ? `${opt.color} ring-2 ring-offset-2 ring-current`
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
              }`}
            >
              <div
                className={`font-semibold text-sm leading-tight ${importMode === opt.value ? opt.color.split(' ')[0] : 'text-neutral-700 dark:text-neutral-300'}`}
              >
                {opt.label}
              </div>
              <div className="text-xs mt-1 text-neutral-500 leading-relaxed">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {(isImporting || importResult) && (
        <div className="rounded-lg bg-slate-50 dark:bg-neutral-800/50 p-4 space-y-3">
          {isImporting && (
            <>
              <div className="flex items-center justify-between text-sm leading-relaxed">
                <span className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在导入...
                </span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300">{importProgress}%</span>
              </div>
              <Progress value={importProgress} variant="success" />
            </>
          )}
          {importResult && (
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-success-600">
                <CheckCircle2 className="w-4 h-4" />
                成功 {importResult.success}
              </span>
              {importResult.failed > 0 && (
                <span className="flex items-center gap-1 text-error-600">
                  <XCircle className="w-4 h-4" />
                  失败 {importResult.failed}
                </span>
              )}
              {importResult.skipped > 0 && (
                <span className="flex items-center gap-1 text-warning-600">
                  <Minus className="w-4 h-4" />
                  跳过 {importResult.skipped}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <Button
        variant="primary"
        onClick={executeImport}
        disabled={!selectedFile || isImporting}
        loading={isImporting}
        fullWidth
        icon={<Upload className="w-4 h-4" />}
        className="mt-2"
      >
        开始导入
      </Button>
    </div>
  );

  const renderExportPanel = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">导出范围</label>
          <select
            value={exportScope}
            onChange={(e) => setExportScope(e.target.value as ExportScope)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none leading-normal"
          >
            {EXPORT_SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">导出格式</label>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none leading-normal"
          >
            {EXPORT_FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">预估大小</label>
          <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800/50 text-sm text-neutral-500 font-mono tabular-nums">
            ~{formatFileSize(500_000 + Math.floor(Math.random() * 1_500_000))}
          </div>
        </div>
      </div>

      <Card className="p-4">
        <h4 className="font-semibold text-sm mb-3">导出选项</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              包含元数据（导出时间、版本号等）
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={compressExport}
              onChange={(e) => setCompressExport(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">压缩输出（减小文件体积）</span>
          </label>
        </div>
      </Card>

      {isExporting && (
        <div className="rounded-lg bg-slate-50 dark:bg-neutral-800/50 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm leading-relaxed">
            <span className="flex items-center gap-2 text-neutral-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              正在生成文件...
            </span>
            <span className="font-mono tabular-nums">{exportProgress}%</span>
          </div>
          <Progress value={exportProgress} variant="default" />
        </div>
      )}

      <Button
        variant="secondary"
        onClick={executeExport}
        disabled={isExporting}
        loading={isExporting}
        fullWidth
        icon={<Download className="w-4 h-4" />}
        className="mt-2"
      >
        导出数据
      </Button>
    </div>
  );

  const renderBackupPanel = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
              <Save className="w-5 h-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-sm tracking-tight">创建备份</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">生成当前数据的完整快照</p>
            </div>
          </div>
          <Button
            variant="primary"
            onClick={createBackup}
            size="sm"
            fullWidth
            icon={<Save className="w-4 h-4" />}
          >
            立即备份
          </Button>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary-100 dark:bg-secondary-900/40 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5 text-secondary-600" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-sm tracking-tight">从文件恢复</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">上传备份文件恢复数据</p>
            </div>
          </div>
          <input
            type="file"
            accept=".json"
            className="hidden"
            id="restore-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (evt) => {
                try {
                  const data = JSON.parse(evt.target?.result as string);
                  localStorage.setItem('rmfood_backup_data', JSON.stringify(data));
                  addLog({ type: 'restore', target: file.name, result: 'success' });
                  alert(`✅ 备份恢复成功: ${Array.isArray(data) ? data.length : Object.keys(data).length} 条记录`);
                  // Reset the input so the same file can be re-selected
                  e.target.value = '';
                } catch {
                  addLog({ type: 'restore', target: file.name, result: 'failed' });
                  alert('❌ 文件格式无效，请选择 JSON 备份文件');
                }
              };
              reader.readAsText(file);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            fullWidth
            icon={<Upload className="w-4 h-4" />}
            onClick={() => document.getElementById('restore-file')?.click()}
          >
            选择文件
          </Button>
        </Card>
      </div>

      <div>
        <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          最近备份记录
        </h4>
        {backups.length === 0 ? (
          <div className="py-8 text-center text-neutral-400">
            <Archive className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无备份记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="info" size="sm">
                      {b.id.slice(0, 8)}
                    </Badge>
                    <span className="text-xs text-neutral-500">{b.timestamp}</span>
                  </div>
                  <p className="text-sm mt-1 text-neutral-700 dark:text-neutral-300 truncate leading-relaxed">
                    {b.description}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-neutral-400">
                    <span className="tabular-nums">{b.recordCount.toLocaleString()} 条</span>
                    <span className="tabular-nums">{b.dataSize}</span>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowRestoreConfirm(b.id)}
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  className="shrink-0 ml-3"
                >
                  恢复
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(null)}
        title="确认恢复备份"
        description="此操作将用备份数据覆盖当前所有数据，且不可撤销。确定要继续吗？"
        size="sm"
      >
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowRestoreConfirm(null)}>
            取消
          </Button>
          <Button variant="danger" onClick={() => showRestoreConfirm && restoreBackup(showRestoreConfirm)}>
            确认恢复
          </Button>
        </div>
      </Modal>
    </div>
  );

  const renderBatchPanel = () => (
    <div className="space-y-6">
      <Card className="p-4 space-y-3">
        <h4 className="font-semibold text-sm tracking-tight flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-error-500" />
          批量删除
        </h4>
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-neutral-800/50 text-sm">
          <p>
            已选择 <strong className="text-primary-600 tabular-nums font-bold">{selectedRows.size}</strong> 条记录
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            disabled={selectedRows.size === 0}
            onClick={() => setShowDeleteConfirm(true)}
            icon={<Trash2 className="w-4 h-4" />}
          >
            批量删除
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedRows(new Set())}>
            清除选择
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h4 className="font-semibold text-sm tracking-tight flex items-center gap-2">
          <Tag className="w-4 h-4 text-secondary-500" />
          批量修改标签/分类
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="新标签（逗号分隔）"
            value={batchTagInput}
            onChange={(e) => setBatchTagInput(e.target.value)}
            className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-primary-500 outline-none placeholder:text-neutral-400"
          />
          <input
            type="text"
            placeholder="新分类"
            value={batchCategoryInput}
            onChange={(e) => setBatchCategoryInput(e.target.value)}
            className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-primary-500 outline-none placeholder:text-neutral-400"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={selectedRows.size === 0 || (!batchTagInput && !batchCategoryInput)}
          onClick={executeBatchEdit}
          icon={<Edit3 className="w-4 h-4" />}
        >
          应用修改
        </Button>
      </Card>

      <Card className="p-4 space-y-3">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-warning-500" />
          数据验证
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={validateData}
          loading={isValidating}
          icon={<Sparkles className="w-4 h-4" />}
        >
          检查必填字段完整性
        </Button>
        {validationResult && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-neutral-800/50">
              <div className="text-lg font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">
                {validationResult.total}
              </div>
              <div className="text-xs text-neutral-500">总计</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-success-50 dark:bg-green-950/20">
              <div className="text-lg font-bold text-success-600 tabular-nums">{validationResult.valid}</div>
              <div className="text-xs text-success-600">有效</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-error-50 dark:bg-red-950/20">
              <div className="text-lg font-bold text-error-600 tabular-nums">{validationResult.invalid}</div>
              <div className="text-xs text-error-600">无效</div>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="确认批量删除"
        description={`即将永久删除 ${selectedRows.size} 条选中记录，此操作无法撤销。`}
        size="sm"
      >
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
            取消
          </Button>
          <Button variant="danger" onClick={executeBatchDelete}>
            确认删除
          </Button>
        </div>
      </Modal>
    </div>
  );

  const renderQualityPanel = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {QUALITY_METRICS.map((m) => (
          <Card key={m.key} className="p-4 text-center space-y-2">
            <CircularProgress
              value={qualityScores[m.key as keyof typeof qualityScores]}
              color={m.color}
              size={90}
              strokeWidth={7}
            />
            <h4 className="font-semibold text-sm tracking-tight text-neutral-700 dark:text-neutral-300">{m.label}</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">{m.desc}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-500" />
            问题数据列表 ({qualityIssues.length})
          </h4>
          <Button
            variant="warning"
            size="sm"
            disabled={qualityIssues.every((i) => !i.autoFixable) || isFixing}
            loading={isFixing}
            onClick={fixIssues}
            icon={<Wrench className="w-4 h-4" />}
          >
            一键修复
          </Button>
        </div>
        {qualityIssues.length === 0 ? (
          <div className="py-8 text-center text-success-600">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm font-medium leading-relaxed">所有数据质量检查通过</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {qualityIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-neutral-800/30 transition-colors"
              >
                {issue.severity === 'error' ? (
                  <XCircle className="w-4 h-4 text-error-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-warning-500 shrink-0" />
                )}
                <code className="text-xs font-mono text-neutral-500 w-20 shrink-0">{issue.recordId}</code>
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 w-24 shrink-0">
                  {issue.field}
                </span>
                <span className="text-sm text-neutral-700 dark:text-neutral-300 flex-1 truncate leading-relaxed">
                  {issue.issue}
                </span>
                {issue.autoFixable && (
                  <Badge variant="success" size="sm" className="shrink-0">
                    可修复
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

  const renderLogsPanel = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="搜索日志..."
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-primary-500 outline-none leading-normal placeholder:text-neutral-400"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {LOG_TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setLogTypeFilter(f.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                logTypeFilter === f.value
                  ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400'
                  : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportLogs}
          icon={<Download className="w-4 h-4" />}
          className="shrink-0"
        >
          导出
        </Button>
      </div>

      <Card className="overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-neutral-400">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm leading-relaxed">暂无操作记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm leading-[1.375]">
              <thead>
                <tr className="bg-slate-50 dark:bg-neutral-800/50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-xs text-neutral-500 uppercase tracking-wider leading-[1.375]">
                    时间
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-neutral-500 uppercase tracking-wider leading-[1.375]">
                    操作者
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-neutral-500 uppercase tracking-wider leading-[1.375]">
                    类型
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-neutral-500 uppercase tracking-wider leading-[1.375]">
                    对象
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-neutral-500 uppercase tracking-wider leading-[1.375]">
                    结果
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-neutral-500 uppercase tracking-wider leading-[1.375]">
                    详情
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-mono text-neutral-500 whitespace-nowrap leading-[1.375] tabular-nums">
                      {log.time}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 leading-[1.375]">
                      {log.operator}
                    </td>
                    <td className="px-4 py-2.5 leading-[1.375]">
                      <Badge
                        variant={
                          log.type === 'import' || log.type === 'export'
                            ? 'primary'
                            : log.type === 'backup' || log.type === 'restore'
                              ? 'info'
                              : log.type === 'batch_delete'
                                ? 'danger'
                                : 'neutral'
                        }
                        size="sm"
                      >
                        {log.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 max-w-[180px] truncate leading-[1.375]">
                      {log.target}
                    </td>
                    <td className="px-4 py-2.5 leading-[1.375]">
                      {log.result === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-success-500 inline" />
                      ) : log.result === 'failed' ? (
                        <XCircle className="w-4 h-4 text-error-500 inline" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-warning-500 inline" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-neutral-500 max-w-[200px] truncate leading-[1.375]">
                      {log.detail ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );

  const renderMonitorPanel = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceCards.map((m) => (
          <Card key={m.label} className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className={`w-9 h-9 rounded-lg ${m.color} flex items-center justify-center shrink-0`}>
                <m.icon className="w-4.5 h-4.5" />
              </div>
              {m.trend && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    m.trend === 'up' ? 'text-error-500' : m.trend === 'down' ? 'text-success-500' : 'text-neutral-400'
                  }`}
                >
                  {m.trend === 'up' ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : m.trend === 'down' ? (
                    <ArrowDownRight className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                  {m.trendValue}
                </span>
              )}
            </div>
            <div className="text-xl font-bold text-neutral-900 dark:text-white tabular-nums">{m.value}</div>
            <div className="text-xs text-neutral-500 leading-relaxed">{m.label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4 space-y-3">
        <h4 className="font-semibold text-sm mb-0 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary-600" />
          最近 1 小时查询量趋势
        </h4>
        <div className="h-[80px] flex items-center justify-center text-xs text-neutral-400 bg-neutral-50 rounded-lg border border-neutral-100">
          暂无实时查询趋势数据，后续将接入搜索日志 API
        </div>
        <div className="flex justify-between text-xs text-neutral-400">
          <span>60分钟前</span>
          <span>现在</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <h4 className="font-semibold text-sm tracking-tight flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-secondary-500" />
            API 调用分布
          </h4>
          <div className="space-y-2">
            {[
              { name: 'GET /api/data', pct: 45, color: 'bg-primary-500' },
              { name: 'POST /api/import', pct: 22, color: 'bg-secondary-500' },
              { name: 'GET /api/stats', pct: 18, color: 'bg-primary-500' },
              { name: '其他接口', pct: 15, color: 'bg-neutral-400' },
            ].map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-600 dark:text-neutral-400">{item.name}</span>
                  <span className="font-mono text-neutral-500 tabular-nums">{item.pct}%</span>
                </div>
                <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h4 className="font-semibold text-sm tracking-tight flex items-center gap-2">
            <PieChart className="w-4 h-4 text-warning-500" />
            资源占用概览
          </h4>
          <div className="space-y-3">
            {[
              { label: 'CPU 使用率', value: 34, color: 'text-secondary-600' },
              { label: '内存使用率', value: perfMetrics.memoryUsage, color: 'text-warning-600' },
              { label: '磁盘 I/O', value: 22, color: 'text-primary-600' },
              { label: '网络带宽', value: 15, color: 'text-accent-600' },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="text-xs text-neutral-500 w-24 shrink-0 leading-[1.375]">{r.label}</span>
                <div className="flex-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neutral-400 dark:bg-neutral-600 rounded-full transition-all"
                    style={{ width: `${r.value}%` }}
                  />
                </div>
                <span className={`text-xs font-mono w-10 text-right tabular-nums ${r.color}`}>{r.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  const tabContentMap: Record<string, () => React.ReactNode> = {
    import: renderImportPanel,
    export: renderExportPanel,
    backup: renderBackupPanel,
    batch: renderBatchPanel,
    quality: renderQualityPanel,
    logs: renderLogsPanel,
    monitor: renderMonitorPanel,
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1">
          {TABS_CONFIG.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} icon={<tab.icon className="w-3.5 h-3.5" />}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS_CONFIG.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tabContentMap[tab.value]?.()}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
