/**
 * 零售产品搜索面板 — OFF 实时数据集成
 *
 * 对标 Potion AI VFT 的 Retail Product Search 界面。
 * 支持数据库缓存搜索 + OFF 实时 API 查询两种模式。
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Card, Input, Select, Tag, Space, Button,
  Spin, Empty, Switch, Tooltip, Rate, Result, Alert, Collapse,
} from 'antd';
import {
  SearchOutlined, FilterOutlined, ThunderboltOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  searchRetailProducts,
  searchOpenFoodFacts,
  getOpenFoodFactsCategories,
  getSearchSuggestions,
  type RetailProductFilter,
  type RetailProductSearchResult,
  type SearchSuggestion,
  type OFFCategoryInfo,
} from '../../../api/searchNew';

interface RetailProductSearchPanelProps {
  className?: string;
}

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
  // ── 食品安全字段 (Phase 2) ──
  allergens_tags?: string[];
  additives_tags?: string[];
  ecoscore_grade?: string | null;
  traces_tags?: string[];
  contaminants?: string[];
}

function mapOFFProduct(raw: OFFRawProduct): RetailProductSearchResult {
  return {
    id: Number(raw.id ?? 0),
    product_name: raw.product_name || '',
    brand: raw.brand || 'Unknown',
    category: raw.category || '',
    formulation_type: raw.formulation_type || '',
    price: raw.price != null ? Number(raw.price) : 0,
    avg_rating: raw.avg_rating != null ? Number(raw.avg_rating) : 0,
    image_urls: Array.isArray(raw.image_urls) ? raw.image_urls : [],
    effects: Array.isArray(raw.effects) ? raw.effects : [],
    score: raw.score != null ? Number(raw.score) : 0,
    // ── 食品安全字段 (Phase 2) ──
    allergens_tags: Array.isArray(raw.allergens_tags) ? raw.allergens_tags : [],
    additives_tags: Array.isArray(raw.additives_tags) ? raw.additives_tags : [],
    ecoscore_grade: raw.ecoscore_grade ?? null,
    traces_tags: Array.isArray(raw.traces_tags) ? raw.traces_tags : [],
    contaminants: Array.isArray(raw.contaminants) ? raw.contaminants : [],
  };
}

// ── 产品结果卡片 ──

const ProductCard: React.FC<{ product: RetailProductSearchResult }> = ({ product }) => {
  const hasImage = product.image_urls && product.image_urls.length > 0;
  const hasSafetyInfo = (product.allergens_tags?.length ?? 0) > 0
    || (product.additives_tags?.length ?? 0) > 0
    || product.ecoscore_grade;

  return (
    <Card
      size="small"
      hoverable
      style={{ marginBottom: 12 }}
      cover={hasImage ? (
        <img
          src={product.image_urls[0]}
          alt={product.product_name}
          style={{ maxHeight: 120, objectFit: 'contain', padding: 8 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {product.product_name}
          </div>
          <Space size="small" wrap>
            <Tag color="blue">{product.brand}</Tag>
            {product.category && <Tag>{product.category}</Tag>}
            {product.formulation_type && <Tag color="green">{product.formulation_type}</Tag>}
            {product.effects?.map((e) => (
              <Tag key={e} color="gold">{e}</Tag>
            ))}
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
                <Tag color={
                  product.ecoscore_grade === 'a' ? 'green'
                    : product.ecoscore_grade === 'b' ? 'cyan'
                    : product.ecoscore_grade === 'c' ? 'blue'
                    : product.ecoscore_grade === 'd' ? 'gold'
                    : 'red'
                }>
                  生态评分: {product.ecoscore_grade.toUpperCase()}
                </Tag>
              )}
            </Space>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: 80 }}>
          {product.price && product.price > 0 ? (
            <div style={{ fontSize: 18, fontWeight: 700, color: '#ff4d4f' }}>
              ¥{product.price.toFixed(2)}
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

const RetailProductSearchPanel: React.FC<RetailProductSearchPanelProps> = ({ className }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RetailProductSearchResult[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [realtime, setRealtime] = useState(false);
  const [dataSource, setDataSource] = useState<string>('');
  const [categories, setCategories] = useState<OFFCategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  // 加载分类列表
  useEffect(() => {
    getOpenFoodFactsCategories()
      .then((cats) => setCategories(cats))
      .catch(() => setCategories([]));
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim() && !selectedCategory) return;
    setLoading(true);
    setError('');
    try {
      let transformed: RetailProductSearchResult[] = [];
      let source = '';

      if (selectedCategory) {
        const m = await import('../../../api/searchNew');
        const categoryResp = await m.getProductsByCategory(selectedCategory, { page: 1, page_size: 20, realtime });
        transformed = (categoryResp.items as OFFRawProduct[]).map(mapOFFProduct);
        source = categoryResp.data_source || 'unknown';
      } else {
        const response = await searchOpenFoodFacts({
          query: query.trim(),
          page: 1,
          page_size: 20,
          realtime,
        });
        if (!response || !Array.isArray(response.items)) {
          console.error('[DEBUG] searchOpenFoodFacts 返回空数据:', response);
          throw new Error('搜索未返回任何结果');
        }
        transformed = (response.items as OFFRawProduct[]).map(mapOFFProduct);
        source = response.data_source || 'unknown';
      }

      setResults(transformed);
      setDataSource(source);
    } catch (err: unknown) {
      console.error('[RetailProductSearch] 搜索错误:', err);
      const msg = err instanceof Error ? err.message : '未知错误';
      setError(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, realtime]);

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

  const handleCategoryChange = useCallback(async (value: string) => {
    setSelectedCategory(value);
    setLoading(true);
    try {
      const m = await import('../../../api/searchNew');
      const categoryResp = await m.getProductsByCategory(value, { page: 1, page_size: 20, realtime });
      const transformed = (categoryResp.items as OFFRawProduct[]).map(mapOFFProduct);
      setResults(transformed);
      setDataSource(categoryResp.data_source || 'unknown');
    } catch (err: unknown) {
      console.error('[RetailProductSearch] 分类浏览失败:', err);
      const msg = err instanceof Error ? err.message : '未知错误';
      setError(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [realtime]);

  // Debug: 在控制台打印结果以验证数据
  useEffect(() => {
    if (results.length > 0) {
      console.log(`[RetailProductSearch] 显示 ${results.length} 条结果`, results.slice(0, 3));
    }
  }, [results]);

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
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              suffix={
                <span style={{ cursor: 'pointer', fontSize: 18 }} onClick={handleSearch} title="搜索">
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
                    onMouseDown={() => {
                      setQuery(s.text);
                      setShowSuggestions(false);
                    }}
                  >
                    {s.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 筛选工具栏 */}
          <Space wrap>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowCategoryFilter(!showCategoryFilter)}
              size="small"
            >
              分类筛选
            </Button>
            <Tooltip title="开启后直接调用 OpenFoodFacts REST API，获取最新数据（非本地缓存）">
              <Space size={4}>
                <ThunderboltOutlined style={{ color: realtime ? '#faad14' : '#d9d9d9' }} />
                <Switch
                  size="small"
                  checked={realtime}
                  onChange={setRealtime}
                  checkedChildren="实时"
                  unCheckedChildren="缓存"
                />
              </Space>
            </Tooltip>
            {dataSource && (
              <Tag color={dataSource.includes('api') ? 'orange' : 'blue'}>
                数据源: {dataSource}
              </Tag>
            )}
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={handleSearch}
              loading={loading}
            >
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
                allowClear
                showSearch
                optionFilterProp="children"
                loading={categories.length === 0}
                options={categories.map((c) => ({
                  value: c.category_tag || c.category,
                  label: `${c.category} (${c.count})`,
                }))}
              />
            </Card>
          )}

          {/* 搜索按钮 */}
          <Button
            type="primary"
            size="large"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={handleSearch}
            style={{ width: '100%' }}
          >
            {realtime ? '实时搜索 OpenFoodFacts' : '搜索零售产品'}
          </Button>
        </Space>
      </Card>

      {/* 搜索结果 */}
      {loading ? (
        <Result
          status="info"
          title={realtime ? '正在查询 OpenFoodFacts...' : '正在搜索...'}
          subTitle="请稍候"
        />
      ) : results.length > 0 ? (
        <>
          <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
            找到 {results.length} 款产品
            {realtime && <Tag color="orange" style={{ marginLeft: 8 }}>实时数据</Tag>}
            {!realtime && dataSource.includes('postgresql') && (
              <Tag color="blue" style={{ marginLeft: 8 }}>数据库缓存</Tag>
            )}
          </div>
          {results.map((product: RetailProductSearchResult) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </>
      ) : error ? (
        <Result
          status="error"
          title="搜索失败"
          subTitle={error}
          extra={[
            <Button type="primary" key="retry" onClick={handleSearch}>
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
    </div>
  );
};

export default RetailProductSearchPanel;
