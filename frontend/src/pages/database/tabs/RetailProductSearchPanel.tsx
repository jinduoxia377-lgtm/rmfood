/**
 * 零售产品搜索面板 — OFF 实时数据集成（Phase 3 增强版）
 *
 * 新增功能：
 * - 收藏功能（本地 Set，支持仅看收藏）
 * - 卡片/表格 双视图切换
 * - 导出 CSV（含收藏标记）
 * - 品牌/价格排序
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card, Input, Select, Tag, Space, Button,
  Spin, Empty, Switch, Tooltip, Rate, Result, Alert, Collapse, Pagination, Table,
} from 'antd';
import {
  SearchOutlined, FilterOutlined, ThunderboltOutlined,
  ReloadOutlined, DownloadOutlined, StarOutlined,
  AppstoreOutlined, UnorderedListOutlined, SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  searchOpenFoodFacts,
  getOpenFoodFactsCategories,
  getSearchSuggestions,
  type RetailProductDetail,
  type OFFCategoryInfo,
} from '../../../api/searchNew';
import RetailProductDetailModal from './RetailProductDetailModal';

// ── OFF 原始数据 → 前端统一格式 ──

interface OFFRawProduct {
  id?: number | string;
  product_name?: string;
  brand?: string;
  category?: string;
  formulation_type?: string;
  price?: number | null;
  avg_rating?: number | null;
  image_urls?: string[];
  effects?: string[];
  score?: number;
  allergens_tags?: string[];
  additives_tags?: string[];
  ecoscore_grade?: string | null;
  traces_tags?: string[];
  contaminants?: string[];
}

function mapOFFProduct(raw: OFFRawProduct): RetailProductDetail {
  return {
    id: Number(raw.id ?? 0),
    product_name: raw.product_name || '',
    brand: raw.brand || 'Unknown',
    category: raw.category || '',
    sub_category: undefined,
    formulation_type: raw.formulation_type || '',
    price: raw.price != null ? Number(raw.price) : 0,
    avg_rating: raw.avg_rating != null ? Number(raw.avg_rating) : 0,
    image_urls: Array.isArray(raw.image_urls) ? raw.image_urls : [],
    effects: Array.isArray(raw.effects) ? raw.effects : [],
    score: raw.score != null ? Number(raw.score) : 0,
    allergens_tags: Array.isArray(raw.allergens_tags) ? raw.allergens_tags : [],
    additives_tags: Array.isArray(raw.additives_tags) ? raw.additives_tags : [],
    ecoscore_grade: raw.ecoscore_grade ?? null,
    traces_tags: Array.isArray(raw.traces_tags) ? raw.traces_tags : [],
    contaminants: Array.isArray(raw.contaminants) ? raw.contaminants : [],
  };
}

type ViewMode = 'card' | 'table';
type SortField = 'brand' | 'price' | 'product_name';
type SortDir = 'asc' | 'desc';

// ── 产品结果卡片 ──

const ProductCard: React.FC<{
  product: RetailProductDetail;
  onClick?: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
  isFav: boolean;
}> = ({ product, onClick, onToggleFav, isFav }) => {
  const hasImage = product.image_urls && product.image_urls.length > 0;
  const hasSafetyInfo = (product.allergens_tags?.length ?? 0) > 0
    || (product.additives_tags?.length ?? 0) > 0
    || product.ecoscore_grade;

  const getEcoscoreColor = (grade?: string): string => {
    switch (grade) {
      case 'a': return 'green';
      case 'b': return 'cyan';
      case 'c': return 'blue';
      case 'd': return 'gold';
      default: return 'default';
    }
  };

  return (
    <Card
      size="small"
      hoverable
      style={{ marginBottom: 12 }}
      onClick={onClick}
      cover={hasImage ? (
        <img
          src={product.image_urls[0]}
          alt={product.product_name}
          style={{ maxHeight: 120, objectFit: 'contain', padding: 8 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {product.product_name}
            <span
              onClick={(e) => { e.stopPropagation(); onToggleFav(e); }}
              style={{ cursor: 'pointer', fontSize: 16, color: isFav ? '#faad14' : '#d9d9d9' }}
              title={isFav ? '取消收藏' : '收藏'}
            >
              {isFav ? '★' : '☆'}
            </span>
          </div>
          <Space size="small" wrap>
            <Tag color="blue">{product.brand}</Tag>
            {product.category && <Tag>{product.category}</Tag>}
            {product.formulation_type && <Tag color="green">{product.formulation_type}</Tag>}
          </Space>
          {hasSafetyInfo && (
            <Space size="small" wrap style={{ marginTop: 4 }}>
              {product.allergens_tags?.map((a) => (
                <Tag key={a} color="red">{a}</Tag>
              ))}
              {product.additives_tags?.map((a) => (
                <Tag key={a} color="orange">{a}</Tag>
              ))}
              {product.ecoscore_grade && (
                <Tag color={getEcoscoreColor(product.ecoscore_grade)}>
                  生态评分: {product.ecoscore_grade.toUpperCase()}
                </Tag>
              )}
            </Space>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: 80 }}>
          {product.price && product.price > 0 ? (
            <div style={{ fontSize: 18, fontWeight: 700, color: '#ff4d4f' }}>
              ¥{Number(product.price).toFixed(2)}
            </div>
          ) : null}
          {product.avg_rating && product.avg_rating > 0 ? (
            <Rate allowHalf disabled defaultValue={product.avg_rating} style={{ fontSize: 12 }} />
          ) : null}
        </div>
      </div>
    </Card>
  );
};

// ── 主搜索面板 ──

const RetailProductSearchPanel: React.FC<{ className?: string }> = ({ className }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RetailProductDetail[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<import('../../../api/searchNew').SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [realtime, setRealtime] = useState(false);
  const [dataSource, setDataSource] = useState<string>('');
  const [categories, setCategories] = useState<OFFCategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<RetailProductDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Phase 3: 新增状态
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('product_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // 加载分类列表
  useEffect(() => {
    getOpenFoodFactsCategories()
      .then((cats) => setCategories(cats))
      .catch(() => setCategories([]));
  }, []);

  // 处理搜索
  const handleSearch = useCallback(async (page: number = 1) => {
    if (!query.trim() && !selectedCategory) return;
    setLoading(true);
    setError('');
    try {
      let transformed: RetailProductDetail[] = [];
      let source = '';

      if (selectedCategory) {
        const m = await import('../../../api/searchNew');
        const categoryResp = await m.getProductsByCategory(selectedCategory, { page, page_size: 20, realtime });
        transformed = (categoryResp.items as OFFRawProduct[]).map(mapOFFProduct);
        source = categoryResp.data_source || 'unknown';
        setTotalResults(categoryResp.total ?? transformed.length);
      } else {
        const response = await searchOpenFoodFacts({
          query: query.trim(),
          page,
          page_size: 20,
          realtime,
        });
        if (!response) {
          throw new Error('搜索请求失败，请稍后重试');
        }
        transformed = (response.items as OFFRawProduct[]).map(mapOFFProduct);
        source = response.data_source || 'unknown';
        setTotalResults(response.total ?? transformed.length);
      }

      setResults(transformed);
      setDataSource(source);
      setCurrentPage(page);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setError(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, realtime]);

  // 搜索建议
  const handleInputChange = useCallback(async (value: string) => {
    setQuery(value);
    if (value.length >= 1) {
      try {
        const resp = await getSearchSuggestions(value, 10);
        setSuggestions(resp.suggestions.filter((s) => s.type === 'retail_product'));
        setShowSuggestions(true);
      } catch {
        // ignore
      }
    } else {
      setShowSuggestions(false);
    }
  }, []);

  // 分类选择
  const handleCategoryChange = useCallback(async (value: string) => {
    setSelectedCategory(value);
    setCurrentPage(1);
    setLoading(true);
    try {
      const m = await import('../../../api/searchNew');
      const categoryResp = await m.getProductsByCategory(value, { page: 1, page_size: 20, realtime });
      const transformed = (categoryResp.items as OFFRawProduct[]).map(mapOFFProduct);
      setResults(transformed);
      setDataSource(categoryResp.data_source || 'unknown');
      setTotalResults(categoryResp.total ?? transformed.length);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setError(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [realtime]);

  // 收藏切换
  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 排序 + 收藏过滤
  const filteredAndSortedItems = useMemo(() => {
    let arr = [...results];
    if (showFavOnly) arr = arr.filter((p) => favorites.has(p.id));
    arr.sort((a, b) => {
      const va = a[sortField] ?? '';
      const vb = b[sortField] ?? '';
      if (typeof va === 'number') return sortDir === 'asc' ? va - Number(vb) : Number(vb) - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [results, showFavOnly, favorites, sortField, sortDir]);

  // 导出 CSV
  const exportCSV = useCallback(() => {
    const items = filteredAndSortedItems;
    if (!items.length) return;
    const headers = ['产品名称', '品牌', '分类', '子分类', '剂型', '价格(CNY)', '评分', '规格', '过敏原', '添加剂', '生态评分', '收藏'];
    const rows = items.map((p) => [
      p.product_name || '',
      p.brand || '',
      p.category || '',
      p.sub_category || '',
      p.formulation_type || '',
      p.price ?? '',
      p.avg_rating ?? '',
      p.package_size || '',
      (p.allergens_tags || []).join(';'),
      (p.additives_tags || []).join(';'),
      p.ecoscore_grade || '',
      favorites.has(p.id) ? '★' : '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retail_products_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredAndSortedItems, favorites]);

  // 排序切换
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  // 表格列定义
  const tableColumns: ColumnsType<RetailProductDetail> = useMemo(() => [
    {
      title: '名称', dataIndex: 'product_name', key: 'name',
      sorter: true, sortField: 'product_name' as SortField,
      render: (name: string, record) => (
        <a onClick={() => { setSelectedProduct(record); setDetailVisible(true); }}>{name}</a>
      ),
    },
    { title: '品牌', dataIndex: 'brand', key: 'brand', sorter: true, width: 150 },
    { title: '分类', dataIndex: 'category', key: 'category', width: 120 },
    { title: '价格', dataIndex: 'price', key: 'price', sorter: true, width: 100,
      render: (v: number) => v != null ? `¥${Number(v).toFixed(2)}` : '-',
    },
    { title: '评分', dataIndex: 'avg_rating', key: 'rating', width: 100,
      render: (v: number) => v != null ? <Rate allowHalf disabled defaultValue={v} style={{ fontSize: 12 }} /> : '-',
    },
    { title: '生态评分', dataIndex: 'ecoscore_grade', key: 'eco', width: 100,
      render: (v?: string) => v ? <Tag color={getEcoscoreColor(v)}>{v.toUpperCase()}</Tag> : '-',
    },
    { title: '收藏', key: 'fav', width: 50,
      render: (_, record) => (
        <span
          onClick={(e) => { e.stopPropagation(); toggleFavorite(record.id); }}
          style={{ cursor: 'pointer', fontSize: 16, color: favorites.has(record.id) ? '#faad14' : '#d9d9d9' }}
        >{favorites.has(record.id) ? '★' : '☆'}</span>
      ),
    },
  ], [favorites, toggleFavorite]);

  return (
    <div className={className}>
      {/* 搜索控制区 */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* 搜索栏 */}
          <div style={{ position: 'relative' }}>
            <Input
              placeholder="搜索零售产品 (如: 胶原蛋白肽口服液、益生菌胶囊)... "
              size="large"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onPressEnter={() => { setCurrentPage(1); handleSearch(1); }}
              prefix={<SearchOutlined />}
              suffix={
                <span style={{ cursor: 'pointer', fontSize: 18 }} onClick={() => { setCurrentPage(1); handleSearch(1); }} title="搜索">
                  <SearchOutlined />
                </span>
              }
              style={{ width: '100%' }}
              allowClear
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: '#fff', border: '1px solid #d9d9d9',
                borderRadius: 4, zIndex: 10, maxHeight: 200, overflow: 'auto',
              }}>
                {suggestions.map((s) => (
                  <div
                    key={s.text}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14 }}
                    onMouseDown={() => { setQuery(s.text); setShowSuggestions(false); }}
                  >
                    {s.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 筛选工具栏 */}
          <Space wrap>
            <Button icon={<FilterOutlined />} onClick={() => setShowCategoryFilter(!showCategoryFilter)} size="small">
              分类筛选
            </Button>
            <Tooltip title="开启后直接调用 OpenFoodFacts REST API，获取最新数据">
              <Space size={4}>
                <ThunderboltOutlined style={{ color: realtime ? '#faad14' : '#d9d9d9' }} />
                <Switch size="small" checked={realtime} onChange={setRealtime}
                  checkedChildren="实时" unCheckedChildren="缓存" />
              </Space>
            </Tooltip>
            {dataSource && (
              <Tag color={dataSource.includes('api') ? 'orange' : 'blue'}>
                数据源: {dataSource}
              </Tag>
            )}
            <Button icon={<ReloadOutlined />} size="small"
              onClick={() => { setCurrentPage(1); handleSearch(1); }} loading={loading}>
              刷新
            </Button>
          </Space>

          {/* 错误提示 */}
          {error && (
            <Alert message="搜索失败" description={error} type="error" showIcon />
          )}

          {/* 分类筛选面板 */}
          {showCategoryFilter && (
            <Card size="small" style={{ background: '#fafafa' }}>
              <Select
                placeholder="选择分类浏览"
                value={selectedCategory}
                onChange={handleCategoryChange}
                style={{ width: '100%' }}
                allowClear showSearch optionFilterProp="children"
                loading={categories.length === 0}
                options={categories.map((c) => ({
                  value: c.category_tag || c.category,
                  label: `${c.category} (${c.count})`,
                }))}
              />
            </Card>
          )}

          {/* 搜索按钮 */}
          <Button type="primary" size="large" icon={<SearchOutlined />} loading={loading}
            onClick={() => { setCurrentPage(1); handleSearch(1); }} style={{ width: '100%' }}>
            {realtime ? '实时搜索 OpenFoodFacts' : '搜索零售产品'}
          </Button>
        </Space>
      </Card>

      {/* 结果工具栏（Phase 3） */}
      {results.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#666' }}>
            找到 {totalResults} 款产品
            {realtime && <Tag color="orange" style={{ marginLeft: 8 }}>实时数据</Tag>}
            {!realtime && dataSource.includes('postgresql') && (
              <Tag color="blue" style={{ marginLeft: 8 }}>数据库缓存</Tag>
            )}
          </span>

          <div style={{ flex: 1 }} />

          {/* 收藏过滤 */}
          <Button size="small" type={showFavOnly ? 'primary' : 'default'}
            icon={<StarOutlined />}
            onClick={() => setShowFavOnly(!showFavOnly)}>
            收藏{favorites.size > 0 ? ` (${favorites.size})` : ''}
          </Button>

          {/* 排序 */}
          <Button size="small" icon={sortDir === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
            onClick={() => toggleSort('price')}>
            价格{sortField === 'price' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </Button>
          <Button size="small" icon={sortDir === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
            onClick={() => toggleSort('brand')}>
            品牌{sortField === 'brand' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </Button>

          {/* 视图切换 */}
          <Space size={2} style={{ background: '#f5f5f5', borderRadius: 4, padding: 2 }}>
            <Button size="small" type={!viewMode ? 'primary' : 'text'}
              icon={<UnorderedListOutlined />}
              onClick={() => setViewMode('table')}
              style={{ borderRadius: 4 }} />
            <Button size="small" type={viewMode === 'card' ? 'primary' : 'text'}
              icon={<AppstoreOutlined />}
              onClick={() => setViewMode('card')}
              style={{ borderRadius: 4 }} />
          </Space>

          {/* 导出 */}
          <Button size="small" icon={<DownloadOutlined />} onClick={exportCSV}>
            导出 CSV
          </Button>
        </div>
      )}

      {/* 搜索结果 */}
      {loading ? (
        <Result
          status="info"
          title={realtime ? '正在查询 OpenFoodFacts...' : '正在搜索...'}
          subTitle="请稍候"
        />
      ) : filteredAndSortedItems.length > 0 ? (
        <>
          {viewMode === 'card' ? (
            filteredAndSortedItems.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => { setSelectedProduct(product); setDetailVisible(true); }}
                onToggleFav={() => toggleFavorite(product.id)}
                isFav={favorites.has(product.id)}
              />
            ))
          ) : (
            <Table<RetailProductDetail>
              columns={tableColumns}
              dataSource={filteredAndSortedItems}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ y: 400 }}
            />
          )}

          {/* 分页 */}
          {totalResults > 20 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Pagination
                current={currentPage}
                total={totalResults}
                pageSize={20}
                onChange={(page) => {
                  setCurrentPage(page);
                  handleSearch(page);
                }}
                showSizeChanger={false}
              />
            </div>
          )}
        </>
      ) : error ? (
        <Result
          status="error"
          title="搜索失败"
          subTitle={error}
          extra={[
            <Button type="primary" key="retry" onClick={() => { setCurrentPage(1); handleSearch(1); }}>
              重试
            </Button>,
          ]}
        />
      ) : query || selectedCategory ? (
        <Empty description="未找到匹配的产品" />
      ) : (
        <Empty
          description="请输入关键词搜索零售产品，或选择分类浏览"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}

      {/* 详情弹窗 */}
      <RetailProductDetailModal
        visible={detailVisible}
        product={selectedProduct}
        onClose={() => setDetailVisible(false)}
      />
    </div>
  );
};

// 辅助函数
function getEcoscoreColor(grade?: string): string {
  switch (grade) {
    case 'a': return 'green';
    case 'b': return 'cyan';
    case 'c': return 'blue';
    case 'd': return 'gold';
    default: return 'default';
  }
}

export default RetailProductSearchPanel;
