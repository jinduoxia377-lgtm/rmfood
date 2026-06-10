import React, { useState, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  GitMerge,
  Clock,
  User,
  Server,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface ConflictField {
  name: string;
  localValue: any;
  serverValue: any;
  baseValue?: any;
}

interface ConflictData {
  id: string;
  entityType: string;
  entityId: string;
  conflictType: 'content_conflict' | 'delete_modify_conflict' | 'structural_conflict';
  status: 'detected' | 'auto_resolved' | 'pending_user' | 'resolved';
  localData: Record<string, any>;
  serverData: Record<string, any>;
  baseData?: Record<string, any>;
  localTimestamp?: string;
  serverTimestamp?: string;
  conflictingFields: string[];
  recommendedStrategy: 'last_write_wins' | 'union_merge' | 'manual';
  resolvedData?: Record<string, any>;
  detectedAt: string;
}

interface ConflictResolverProps {
  conflicts: ConflictData[];
  onResolve: (conflictId: string, choice: 'local' | 'server' | 'custom', customData?: Record<string, any>) => void;
  onAutoResolve?: (conflictId: string) => void;
  onBatchResolve?: (resolutions: { conflictId: string; choice: 'local' | 'server' | 'custom'; customData?: Record<string, any> }[]) => void;
  isLoading?: boolean;
  className?: string;
}

const conflictTypeConfig = {
  content_conflict: {
    label: '内容冲突',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: AlertTriangle,
  },
  delete_modify_conflict: {
    label: '删除-修改冲突',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: XCircle,
  },
  structural_conflict: {
    label: '结构冲突',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    icon: AlertCircle,
  },
};

const strategyLabels = {
  last_write_wins: '最后写入优先',
  union_merge: '联合合并',
  manual: '手动解决',
};

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflicts,
  onResolve,
  onAutoResolve,
  onBatchResolve,
  isLoading = false,
  className = '',
}) => {
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());
  const [selectedResolution, setSelectedResolution] = useState<Record<string, 'local' | 'server' | 'custom'>>({});
  const [customEdits, setCustomEdits] = useState<Record<string, Record<string, any>>>({});
  const [showSensitiveData, setShowSensitiveData] = useState<Set<string>>(new Set());

  const pendingConflicts = useMemo(
    () => conflicts.filter((c) => c.status === 'pending_user' || c.status === 'detected'),
    [conflicts],
  );

  const resolvedConflicts = useMemo(
    () => conflicts.filter((c) => c.status === 'resolved' || c.status === 'auto_resolved'),
    [conflicts],
  );

  const toggleExpand = useCallback((conflictId: string) => {
    setExpandedConflicts((prev) => {
      const next = new Set(prev);
      if (next.has(conflictId)) {
        next.delete(conflictId);
      } else {
        next.add(conflictId);
      }
      return next;
    });
  }, []);

  const toggleSensitiveData = useCallback((conflictId: string) => {
    setShowSensitiveData((prev) => {
      const next = new Set(prev);
      if (next.has(conflictId)) {
        next.delete(conflictId);
      } else {
        next.add(conflictId);
      }
      return next;
    });
  }, []);

  const handleResolve = useCallback(
    (conflictId: string) => {
      const choice = selectedResolution[conflictId];
      if (!choice) return;

      if (choice === 'custom') {
        onResolve(conflictId, choice, customEdits[conflictId]);
      } else {
        onResolve(conflictId, choice);
      }
    },
    [onResolve, selectedResolution, customEdits],
  );

  const handleAutoResolveAll = useCallback(() => {
    const autoResolvable = pendingConflicts.filter(
      (c) => c.recommendedStrategy !== 'manual',
    );
    autoResolvable.forEach((c) => onAutoResolve?.(c.id));
  }, [pendingConflicts, onAutoResolve]);

  const handleBatchResolveLocal = useCallback(() => {
    const resolutions = pendingConflicts.map((c) => ({
      conflictId: c.id,
      choice: 'local' as const,
    }));
    onBatchResolve?.(resolutions);
  }, [pendingConflicts, onBatchResolve]);

  const handleBatchResolveServer = useCallback(() => {
    const resolutions = pendingConflicts.map((c) => ({
      conflictId: c.id,
      choice: 'server' as const,
    }));
    onBatchResolve?.(resolutions);
  }, [pendingConflicts, onBatchResolve]);

  const updateCustomEdit = useCallback((conflictId: string, field: string, value: any) => {
    setCustomEdits((prev) => ({
      ...prev,
      [conflictId]: {
        ...prev[conflictId],
        [field]: value,
      },
    }));
  }, []);

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '未知时间';
    try {
      return new Date(ts).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  const maskSensitiveData = (data: Record<string, any>, isVisible: boolean) => {
    if (isVisible) return data;

    const masked: Record<string, any> = {};
    const sensitiveFields = ['password', 'token', 'secret', 'api_key'];

    Object.entries(data).forEach(([key, value]) => {
      if (sensitiveFields.some((f) => key.toLowerCase().includes(f))) {
        masked[key] = '******';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        masked[key] = maskSensitiveData(value, false);
      } else {
        masked[key] = value;
      }
    });

    return masked;
  };

  const renderFieldValue = (value: any, label: string): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">空值</span>;
    }

    if (typeof value === 'boolean') {
      return <span className={value ? 'text-green-600' : 'text-red-600'}>{value ? '是' : '否'}</span>;
    }

    if (Array.isArray(value)) {
      return (
        <div className="space-y-1">
          {value.map((item, idx) => (
            <div key={idx} className="text-sm bg-gray-50 px-2 py-1 rounded">
              {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === 'object') {
      return (
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    return <span>{String(value)}</span>;
  };

  const renderConflictCard = (conflict: ConflictData) => {
    const isExpanded = expandedConflicts.has(conflict.id);
    const config = conflictTypeConfig[conflict.conflictType];
    const IconComponent = config.icon;
    const canAutoResolve = conflict.recommendedStrategy !== 'manual';
    const showData = showSensitiveData.has(conflict.id);

    return (
      <div
        key={conflict.id}
        className={`border rounded-lg transition-all ${config.bgColor} ${config.borderColor}`}
      >
        <div
          className="p-4 cursor-pointer hover:bg-opacity-80 transition-colors"
          onClick={() => toggleExpand(conflict.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconComponent className={`w-5 h-5 ${config.color}`} />
              <div>
                <div className="font-medium text-gray-900">
                  {conflict.entityType} #{conflict.entityId}
                </div>
                <div className={`text-sm ${config.color}`}>{config.label}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {conflict.conflictingFields.length} 个字段冲突
              </span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                conflict.status === 'resolved'
                  ? 'bg-green-100 text-green-700'
                  : conflict.status === 'auto_resolved'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {conflict.status === 'resolved'
                  ? '已解决'
                  : conflict.status === 'auto_resolved'
                  ? '自动解决'
                  : '待处理'}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                <span className="text-gray-600">本地:</span>
                <span>{formatTimestamp(conflict.localTimestamp)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">服务器:</span>
                <span>{formatTimestamp(conflict.serverTimestamp)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-700">冲突字段详情</h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSensitiveData(conflict.id);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {showData ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showData ? '隐藏敏感数据' : '显示敏感数据'}
                </button>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {conflict.conflictingFields.map((field) => (
                  <div key={field} className="border rounded p-3 bg-white">
                    <div className="font-medium text-sm mb-2 text-gray-800">{field}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-blue-600 flex items-center gap-1">
                          <User className="w-3 h-3" /> 本地版本
                        </div>
                        <div className="text-sm">
                          {renderFieldValue(maskSensitiveData({ [field]: conflict.localData[field] }, showData)[field], field)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                          <Server className="w-3 h-3" /> 服务器版本
                        </div>
                        <div className="text-sm">
                          {renderFieldValue(maskSensitiveData({ [field]: conflict.serverData[field] }, showData)[field], field)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(conflict.status === 'pending_user' || conflict.status === 'detected') && (
              <div className="space-y-3 pt-2 border-t">
                <div className="text-sm font-medium text-gray-700">选择解决方案</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedResolution((prev) => ({ ...prev, [conflict.id]: 'local' }));
                    }}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                      selectedResolution[conflict.id] === 'local'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <User className="w-4 h-4 inline mr-1" />
                    使用本地版本
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedResolution((prev) => ({ ...prev, [conflict.id]: 'server' }));
                    }}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                      selectedResolution[conflict.id] === 'server'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 hover:border-green-300'
                    }`}
                  >
                    <Server className="w-4 h-4 inline mr-1" />
                    使用服务器版本
                  </button>

                  {canAutoResolve && onAutoResolve && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAutoResolve(conflict.id);
                      }}
                      className="px-3 py-2 text-sm rounded-lg border border-purple-300 hover:bg-purple-50 text-purple-700 transition-all"
                    >
                      <RefreshCw className="w-4 h-4 inline mr-1" />
                      自动解决 ({strategyLabels[conflict.recommendedStrategy]})
                    </button>
                  )}
                </div>

                {selectedResolution[conflict.id] && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResolve(conflict.id);
                    }}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
                  >
                    确认解决
                  </button>
                )}
              </div>
            )}

            {conflict.status === 'resolved' && conflict.resolvedData && (
              <div className="pt-2 border-t">
                <div className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> 解决结果
                </div>
                <pre className="text-xs bg-green-50 p-3 rounded overflow-auto max-h-40">
                  {JSON.stringify(conflict.resolvedData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (conflicts.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">没有检测到冲突</h3>
        <p className="text-gray-500">所有数据同步正常，无需手动干预</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GitMerge className="w-6 h-6" />
            冲突解决中心
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {conflicts.length} 个冲突（{pendingConflicts.length} 个待处理，{resolvedConflicts.length} 个已解决）
          </p>
        </div>

        {pendingConflicts.length > 0 && (
          <div className="flex gap-2">
            {pendingConflicts.some((c) => c.recommendedStrategy !== 'manual') && (
              <button
                onClick={handleAutoResolveAll}
                disabled={isLoading}
                className="px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-all"
              >
                <RefreshCw className="w-4 h-4 inline mr-1" />
                自动解决全部
              </button>
            )}
            <button
              onClick={handleBatchResolveLocal}
              disabled={isLoading}
              className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 transition-all"
            >
              全部使用本地
            </button>
            <button
              onClick={handleBatchResolveServer}
              disabled={isLoading}
              className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-all"
            >
              全部使用服务器
            </button>
          </div>
        )}
      </div>

      {pendingConflicts.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            待解决的冲突 ({pendingConflicts.length})
          </h3>
          {pendingConflicts.map(renderConflictCard)}
        </div>
      )}

      {resolvedConflicts.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            已解决的冲突 ({resolvedConflicts.length})
          </h3>
          {resolvedConflicts.map(renderConflictCard)}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
          <span className="text-gray-600">正在处理...</span>
        </div>
      )}
    </div>
  );
};

export default ConflictResolver;
