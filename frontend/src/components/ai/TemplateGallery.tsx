/**
 * TemplateGallery - 行业模板库展示组件
 *
 * 提供完整的模板浏览和管理功能：
 * - 分类筛选和标签过滤
 * - 搜索功能
 * - 模板预览和使用
 * - 变量填充表单
 *
 * @version 2.0.0
 * @lastUpdated 2026-05-20
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Search,
  Filter,
  Grid,
  List,
  Star,
  Download,
  Eye,
  Copy,
  Check,
  Loader2,
  ChevronRight,
  Tag,
  BookOpen,
  Zap,
  TrendingUp,
  Heart,
  Share2,
  ExternalLink,
  X,
  Sparkles,
} from 'lucide-react';
import { Button, Input, Badge, Card, Textarea, Select } from '@/components/ui';
import { logger } from '@/utils/safeLogger';

// ===== 类型定义 =====

interface TemplateVariable {
  name: string;
  var_type: string;
  required: boolean;
  default?: unknown;
  options?: string[];
  example: string;
  description: string;
}

interface TemplateItem {
  id: number;
  name: string;
  category: string;
  description: string;
  version: string;
  usage_count: number;
  rating: number | null;
  created_at: string;
  updated_at: string;
  content?: string;
  variables?: string[];
  examples?: { scenario: string; input: Record<string, unknown>; output: string }[];
  tags?: string[];
}

interface TemplateListResponse {
  templates: TemplateItem[];
  total: number;
  page: number;
  page_size: number;
}

interface RenderResult {
  success: boolean;
  content: string;
  errors: string[];
  warnings: string[];
  missing_variables: string[];
}

// ===== 配置常量 =====

const CATEGORIES = [
  { value: '', label: '全部分类' },
  { value: 'formula_design', label: '配方设计' },
  { value: 'marketing', label: '营销文案' },
  { value: 'customer_service', label: '客服话术' },
  { value: 'analysis', label: '分析报告' },
  { value: 'code_review', label: '代码审查' },
  { value: 'writing', label: '内容创作' },
];

const SORT_OPTIONS = [
  { value: 'popularity', label: '最受欢迎' },
  { value: 'usage_count', label: '使用最多' },
  { value: 'rating', label: '评分最高' },
  { value: 'created_at', label: '最新发布' },
  { value: 'name', label: '名称排序' },
];

// ===== 主组件 =====

interface TemplateGalleryProps {
  onTemplateUse?: (template: TemplateItem, renderedContent: string) => void;
  onTemplateFavorite?: (templateId: number) => void;
  className?: string;
}

export function TemplateGallery({ onTemplateUse, onTemplateFavorite, className = '' }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize] = useState(12);

  // 预览/渲染状态
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [currentPage, categoryFilter, sortBy]);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
        sort_by: sortBy,
        ...(categoryFilter && { category: categoryFilter }),
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(`/api/v1/ai/templates?${params}`);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: TemplateListResponse = await response.json();

      setTemplates(data.templates || []);
      setTotalItems(data.total || 0);

      logger.info('Templates fetched', { count: data.templates?.length || 0, total: data.total });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      logger.error('Failed to fetch templates:', err);

      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, categoryFilter, sortBy, searchQuery, pageSize]);

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    fetchTemplates();
  }, [fetchTemplates]);

  const handlePreview = useCallback(async (template: TemplateItem) => {
    setSelectedTemplate(template);
    setShowPreview(true);
    setRenderResult(null);

    if (template.variables && template.variables.length > 0) {
      const initialValues: Record<string, string> = {};
      template.variables.forEach((varName) => {
        initialValues[varName] = '';
      });
      setVariableValues(initialValues);
    }
  }, []);

  const handleRender = useCallback(async () => {
    if (!selectedTemplate) return;

    setIsRendering(true);
    setRenderResult(null);

    try {
      const templateId = `tpl_${selectedTemplate.id}_${selectedTemplate.name.replace(/\s+/g, '_')}`;

      const response = await fetch(`/api/v1/ai/templates/${templateId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variableValues),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: RenderResult = await response.json();

      setRenderResult(data);

      if (data.success) {
        onTemplateUse?.(selectedTemplate, data.content);
      }
    } catch (err: unknown) {
      logger.error('Template render failed:', err);
      setRenderResult({
        success: false,
        content: '',
        errors: ['渲染失败，请重试'],
        warnings: [],
        missing_variables: [],
      });
    } finally {
      setIsRendering(false);
    }
  }, [selectedTemplate, variableValues, onTemplateUse]);

  const handleCopyRendered = useCallback(async () => {
    if (!renderResult?.content) return;

    try {
      await navigator.clipboard.writeText(renderResult.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Copy failed:', err);
    }
  }, [renderResult]);

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 工具栏 */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          {/* 搜索框 */}
          <div className="flex-1 w-full relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            <Input
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索模板名称、描述或标签..."
              className="pl-9"
            />
          </div>

          {/* 分类筛选 */}
          <Select
            value={categoryFilter}
            onChange={(v) => {
              setCategoryFilter(v);
              setCurrentPage(1);
            }}
            className="w-full md:w-40"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>

          {/* 排序选择 */}
          <Select
            value={sortBy}
            onChange={(v) => setSortBy(v)}
            className="w-full md:w-36"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>

          {/* 视图切换 */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-neutral-800 shadow-sm' : ''}`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white dark:bg-neutral-900 shadow-sm' : ''}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </Card>

      {/* 加载状态 */}
      {isLoading && (
        <div className="py-12 text-center">
          <Loader2 size={32} className="mx-auto animate-spin text-accent-600 mb-3" />
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">正在加载模板库...</p>
        </div>
      )}

      {/* 错误状态 */}
      {error && !isLoading && (
        <Card className="p-4 text-center">
          <p className="text-sm text-error-600 mb-2">加载失败</p>
          <Button onClick={fetchTemplates} variant="outline" size="sm">
            重试
          </Button>
        </Card>
      )}

      {/* 网格视图 */}
      {!isLoading &&
        viewMode === 'grid' &&
        templates.map((template) => (
          <Card key={template.id} className="p-4 hover:shadow-lg transition-shadow group">
            {/* 头部 */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1 group-hover:text-accent-600 transition-colors">
                  {template.name}
                </h4>
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">{template.category}</p>
              </div>

              <div className="flex items-center gap-1 ml-2">
                {template.rating && (
                  <Badge variant="warning" size="sm" className="flex items-center gap-0.5">
                    <Star size={10} fill="currentColor" />
                    {template.rating.toFixed(1)}
                  </Badge>
                )}
              </div>
            </div>

            {/* 描述 */}
            <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">{template.description}</p>

            {/* 标签 */}
            {template.tags && template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {template.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="info" size="sm">
                    <Tag size={10} className="mr-0.5" />
                    {tag}
                  </Badge>
                ))}
                {template.tags.length > 3 && (
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">+{template.tags.length - 3}</span>
                )}
              </div>
            )}

            {/* 统计信息 */}
            <div className="flex items-center gap-3 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-3 pt-2 border-t">
              <span className="flex items-center gap-1">
                <Download size={12} />
                使用 {template.usage_count} 次
              </span>
              <span>v{template.version}</span>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button onClick={() => handlePreview(template)} variant="primary" size="sm" className="flex-1">
                <Eye size={14} className="mr-1" />
                预览使用
              </Button>

              <Button onClick={() => onTemplateFavorite?.(template.id)} variant="outline" size="sm">
                <Heart size={14} />
              </Button>

              <Button variant="ghost" size="sm">
                <Share2 size={14} />
              </Button>
            </div>
          </Card>
        ))}

      {/* 列表视图 */}
      {!isLoading &&
        viewMode === 'list' &&
        templates.map((template) => (
          <Card key={template.id} className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-accent-600 transition-colors">
                  {template.name}
                </h4>
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5 line-clamp-1">{template.description}</p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {template.rating && (
                  <span className="text-sm font-medium text-warning-600 flex items-center gap-1">
                    <Star size={14} fill="currentColor" />
                    {template.rating.toFixed(1)}
                  </span>
                )}
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{template.usage_count}次使用</span>

                <Button onClick={() => handlePreview(template)} variant="primary" size="sm">
                  使用
                </Button>
              </div>
            </div>
          </Card>
        ))}

      {/* 分页 */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            共 {totalItems} 个模板 · 第 {currentPage}/{totalPages} 页
          </p>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              variant="outline"
              size="sm"
            >
              上一页
            </Button>

            <Button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              variant="outline"
              size="sm"
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && templates.length === 0 && !error && (
        <div className="py-16 text-center text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">暂无匹配的模板</p>
          <p className="text-sm">尝试调整搜索条件或浏览其他分类</p>
        </div>
      )}

      {/* 模板预览弹窗 */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{selectedTemplate.name}</h3>
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{selectedTemplate.category}</p>
              </div>

              <button
                onClick={() => {
                  setShowPreview(false);
                  setSelectedTemplate(null);
                  setRenderResult(null);
                }}
                className="p-2 hover:bg-neutral-100 dark:bg-neutral-800 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 模板信息 */}
              <div>
                <h4 className="text-sm font-semibold text-neutral-900 mb-2 flex items-center gap-2">
                  <BookOpen size={16} />
                  模板说明
                </h4>
                <p className="text-sm text-neutral-600 leading-relaxed">{selectedTemplate.description}</p>

                {selectedTemplate.tags && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {selectedTemplate.tags.map((tag) => (
                      <Badge key={tag} variant="info" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* 变量填写表单 */}
              {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <Zap size={16} />
                    填写变量参数
                  </h4>

                  <div className="space-y-3">
                    {selectedTemplate.variables.map((varName) => (
                      <div key={varName}>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          {varName}
                          <span className="text-error-500 ml-0.5">*</span>
                        </label>
                        <Input
                          value={variableValues[varName] || ''}
                          onChange={(e) =>
                            setVariableValues((prev) => ({
                              ...prev,
                              [varName]: e.target.value,
                            }))
                          }
                          placeholder={`输入${varName}...`}
                        />
                        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">示例值请参考模板说明</p>
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleRender} disabled={isRendering} variant="primary" className="mt-4 w-full">
                    {isRendering ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-1" />
                        渲染中...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} className="mr-1" />
                        渲染模板
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* 渲染结果 */}
              {renderResult && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <TrendingUp size={16} />
                      渲染结果
                    </h4>

                    <Button onClick={handleCopyRendered} variant="outline" size="sm">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? '已复制' : '复制'}
                    </Button>
                  </div>

                  {renderResult.errors.length > 0 && (
                    <div className="mb-3 p-3 bg-error-50 rounded-lg">
                      <p className="text-xs font-medium text-error-700 mb-1">错误：</p>
                      {renderResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-error-600">
                          • {err}
                        </p>
                      ))}
                    </div>
                  )}

                  {renderResult.warnings.length > 0 && (
                    <div className="mb-3 p-3 bg-warning-50 rounded-lg">
                      <p className="text-xs font-medium text-warning-700 mb-1">警告：</p>
                      {renderResult.warnings.map((warn, i) => (
                        <p key={i} className="text-xs text-warning-600">
                          • {warn}
                        </p>
                      ))}
                    </div>
                  )}

                  {renderResult.success && (
                    <div className="p-4 bg-gradient-to-br from-success-50 to-success-50 rounded-lg max-h-[400px] overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap leading-relaxed font-mono">
                        {renderResult.content}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateGallery;
