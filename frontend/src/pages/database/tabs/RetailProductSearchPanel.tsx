/**
 * 零售产品搜索面板
 *
 * 对标 Potion AI VFT 的 Retail Product Search 界面。
 */
import React, { useState, useCallback } from 'react';
import {
  Card, Input, Select, Tag, Space, Button, Badge, Collapse,
  Spin, Empty, Pagination, Tooltip, Rate,
} from 'antd';
import {
  SearchOutlined, FilterOutlined, StarOutlined,
  ShoppingCartOutlined, EyeOutlined,
} from '@ant-design/icons';
import {
  searchRetailProducts,
  getSearchSuggestions,
  type RetailProductFilter,
  type RetailProductSearchResult,
  type SearchSuggestion,
} from '../../../api/searchNew';

interface RetailProductSearchPanelProps {
  className?: string;
}

const { Panel } = Collapse;

/**
 * 零售产品结果卡片
 */
const ProductCard: React.FC<{ product: RetailProductSearchResult }> = ({ product }) => (
  <Card
    size="small"
    hoverable
    style={{ marginBottom: 12 }}
    cover={
      product.image_urls && product.image_urls.length > 0 ? (
        <img
          src={product.image_urls[0]}
          alt={product.product_name}
          style={{ maxHeight: 120, objectFit: 'contain' }}
        />
      ) : undefined
    }
  >
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {product.product_name}
        </div>
        <Tag color="blue">{product.brand}</Tag>
        <Space size="small" wrap style={{ marginTop: 4 }}>
          {product.category && <Tag>{product.category}</Tag>}
          {product.formulation_type && <Tag>{product.formulation_type}</Tag>}
          {product.effects?.map((e) => (
            <Tag key={e} color="gold">{e}</Tag>
          ))}
        </Space>
      </div>
      <div style={{ textAlign: 'right', minWidth: 80 }}>
        {product.price && (
          <div style={{ fontSize: 18, fontWeight: 700, color: '#ff4d4f' }}>
            ¥{product.price}
          </div>
        )}
        {product.avg_rating && (
          <Rate allowHalf disabled defaultValue={product.avg_rating} style={{ fontSize: 12 }} />
        )}
      </div>
    </div>
  </Card>
);

/**
 * 零售产品搜索面板
 */
const RetailProductSearchPanel: React.FC<RetailProductSearchPanelProps> = ({ className }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RetailProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await searchRetailProducts({
        query: query.trim(),
        page: 1,
        per_page: 20,
      });
      setResults(response.results);
    } catch (err) {
      console.error('搜索失败:', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

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

  return (
    <div className={className}>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
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
                    onMouseOver={(e) => {
                      (e.target as HTMLElement).style.background = '#f5f5f5';
                    }}
                    onMouseOut={(e) => {
                      (e.target as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {s.text}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button
            type="primary"
            size="large"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={handleSearch}
            style={{ width: '100%' }}
          >
            搜索零售产品
          </Button>
        </Space>
      </Card>

      {/* 搜索结果 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="搜索中..." />
        </div>
      ) : results.length > 0 ? (
        <>
          <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
            找到 {results.length} 款产品
          </div>
          {results.map((product: RetailProductSearchResult) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </>
      ) : query ? (
        <Empty description="未找到匹配的产品" />
      ) : (
        <Empty description="请输入关键词搜索零售产品" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </div>
  );
};

export default RetailProductSearchPanel;
