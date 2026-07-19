/**
 * 食品原料搜索面板
 *
 * 对标 Potion AI VFT 的 Raw Material Search 界面。
 * 集成到 DatabasePage 的新 Tab 中。
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Card, Input, Select, Tag, Space, Button, Badge, Collapse,
  Spin, Empty, Result, Tabs, Pagination, Tooltip,
} from 'antd';
import {
  SearchOutlined, FilterOutlined, StarOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  SafetyCertificateOutlined, FileTextOutlined,
} from '@ant-design/icons';
import {
  searchFoodMaterials,
  listFoodMaterials,
  type FoodMaterialFilter,
  type FoodMaterialSearchResult,
  type FoodMaterialSearchResponse,
  normalizeName,
  checkMaterialCompliance,
  type NormalizeResult,
} from '../../../api/searchNew';

const { Panel } = Collapse;

interface FoodMaterialSearchPanelProps {
  className?: string;
}

/**
 * 食品原料搜索结果卡片
 */
const MaterialCard: React.FC<{
  result: FoodMaterialSearchResult;
  onFavorite: (id: number) => void;
  isFavorite: boolean;
}> = ({ result, onFavorite, isFavorite }) => {
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [compliancePassed, setCompliancePassed] = useState<boolean | null>(null);

  const handleCheckCompliance = useCallback(async () => {
    try {
      const resp = await checkMaterialCompliance(result.id);
      const r = resp as any;
      setCompliancePassed(r?.passed);
      setComplianceChecked(true);
    } catch {
      setCompliancePassed(null);
    }
  }, [result.id]);

  return (
    <Card
      size="small"
      hoverable
      style={{ marginBottom: 12 }}
      extra={
        <Space>
          <Tooltip title="添加到书架">
            <Button
              type="text"
              icon={<StarOutlined />}
              onClick={() => onFavorite(result.id)}
              style={{ color: isFavorite ? '#faad14' : undefined }}
            />
          </Tooltip>
        </Space>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            {(result.extra.name_cn as string) || result.name}
            {(result.extra.name_latin as string) && (
              <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
                ({result.extra.name_latin as string})
              </span>
            )}
          </div>
          <Space size="small" wrap>
            {(result.extra.category as string) && <Tag color="blue">{result.extra.category as string}</Tag>}
            {(result.extra.food_homology as boolean) && <Tag color="green">药食同源</Tag>}
            {(result.extra.toxicity_class as string) && (
              <Tag color={(result.extra.toxicity_class as string) === '无毒' ? 'green' : 'orange'}>
                {result.extra.toxicity_class as string}
              </Tag>
            )}
            {(result.extra.effects as string[])?.map((e: string) => (
              <Tag key={e}>{e}</Tag>
            ))}
          </Space>
          {(result.extra.description as string) && (
            <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
              {(result.extra.description as string).substring(0, 120)}...
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: 80 }}>
          <div style={{ fontSize: 12, color: '#999' }}>相关度</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1890ff' }}>
            {(result.score * 100).toFixed(1)}%
          </div>
          {(result.extra.similarity as number | undefined) !== undefined && (
            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
              语义: {((((result.extra.similarity as number) ?? 0)) * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </div>
      {/* 合规检查 */}
      {!complianceChecked ? (
        <Button
          type="link"
          size="small"
          icon={<SafetyCertificateOutlined />}
          onClick={handleCheckCompliance}
          style={{ marginTop: 8 }}
        >
          合规检查
        </Button>
      ) : (
        <Badge
          status={compliancePassed ? 'success' : 'error'}
          text={compliancePassed ? '合规' : '不合规'}
          style={{ marginTop: 8 }}
        />
      )}
    </Card>
  );
};

/**
 * 食品原料搜索面板主组件
 */
const FoodMaterialSearchPanel: React.FC<FoodMaterialSearchPanelProps> = ({ className }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodMaterialSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [filters, setFilters] = useState<Partial<FoodMaterialFilter>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchModes, setSearchModes] = useState({ bm25: 0.4, vector: 0.3, rule: 0.3 });
  const [normalized, setNormalized] = useState<NormalizeResult | null>(null);

  // 执行搜索
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      // 名称标准化
      const normResult = await normalizeName(query.trim());
      setNormalized(normResult);

      const response: FoodMaterialSearchResponse = await searchFoodMaterials({
        query: normResult.canonical,
        filters: { ...filters, ...normResult },
        page: currentPage,
        per_page: 20,
        search_modes: searchModes,
      });
      setResults(response.results);
      setTotal(response.total);
      setSearchTime(response.search_time_ms);
    } catch (err) {
      console.error('搜索失败:', err);
    } finally {
      setLoading(false);
    }
  }, [query, filters, currentPage, searchModes]);

  // 添加到收藏
  const handleFavorite = useCallback((id: number) => {
    // TODO: 调用 pantry API
    console.log('添加到收藏:', id);
  }, []);

  return (
    <div className={className}>
      {/* 搜索栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="搜索食品原料 (如: 黄芪、胶原蛋白肽)... "
              size="large"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              style={{ flex: 1 }}
              allowClear
            />
            <Button
              type="primary"
              size="large"
              icon={<SearchOutlined />}
              loading={loading}
              onClick={handleSearch}
            >
              搜索
            </Button>
          </div>

          {/* 名称标准化提示 */}
          {normalized && normalized.canonical !== normalized.original && (
            <Tag color="blue">
              已标准化: {normalized.original} → {normalized.canonical}
              {normalized.aliases_found.length > 0 && (
                <span style={{ marginLeft: 8, opacity: 0.7 }}>
                  ({normalized.aliases_found.length} 个别名)
                </span>
              )}
            </Tag>
          )}

          {/* 筛选器 */}
          <Collapse defaultActiveKey={[]} size="small">
            <Panel header="筛选条件" key="filters">
              <Space wrap>
                <Select
                  placeholder="分类"
                  style={{ width: 150 }}
                  value={filters.category}
                  onChange={(v: string) => setFilters((f) => ({ ...f, category: v }))}
                  options={[
                    { label: '中药材', value: '中药材' },
                    { label: '食品添加剂', value: '食品添加剂' },
                    { label: '普通食品', value: '普通食品' },
                    { label: '保健食品', value: '保健食品' },
                  ]}
                />
                <Select
                  placeholder="毒性等级"
                  style={{ width: 120 }}
                  value={filters.toxicity_class}
                  onChange={(v: string) => setFilters((f) => ({ ...f, toxicity_class: v }))}
                  options={[
                    { label: '无毒', value: '无毒' },
                    { label: '小毒', value: '小毒' },
                    { label: '有毒', value: '有毒' },
                  ]}
                />
                <Select
                  placeholder="药食同源"
                  style={{ width: 120 }}
                  value={filters.food_homology}
                  onChange={(v: boolean) => setFilters((f) => ({ ...f, food_homology: v }))}
                  options={[
                    { label: '是', value: true },
                    { label: '否', value: false },
                  ]}
                />
                <Button
                  icon={<FilterOutlined />}
                  onClick={() => setFilters({})}
                >
                  重置筛选
                </Button>
              </Space>
            </Panel>
          </Collapse>

          {/* 搜索模式权重 */}
          <div style={{ fontSize: 12, color: '#999' }}>
            搜索模式: BM25: {searchModes.bm25} | 向量: {searchModes.vector} | 规则: {searchModes.rule}
          </div>
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
            找到 {total} 条结果，耗时 {searchTime.toFixed(1)}ms
          </div>
          {results.map((result) => (
            <MaterialCard
              key={result.id}
              result={result}
              onFavorite={handleFavorite}
              isFavorite={false}
            />
          ))}
          {total > 20 && (
            <Pagination
              current={currentPage}
              total={total}
              pageSize={20}
              onChange={(page) => {
                setCurrentPage(page);
                // 重新搜索
              }}
              style={{ textAlign: 'center', marginTop: 16 }}
            />
          )}
        </>
      ) : query ? (
        <Empty description="未找到匹配的原料" />
      ) : (
        <Empty description="请输入关键词开始搜索" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </div>
  );
};

export default FoodMaterialSearchPanel;
