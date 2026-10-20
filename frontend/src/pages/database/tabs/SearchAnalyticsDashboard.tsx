/**
 * 搜索分析仪表盘
 *
 * 用于 Potion AI VFT x RMFOOD 深度融合方案。
 * 展示搜索热词、趋势、行为统计、转化率等数据。
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, CardHeader, CardContent,
  Button, Badge,
  DataTable,
  EmptyState,
  Alert,
  StatCard,
  CardTitle,
} from '@/components/ui';
import {
  Search,
  Eye, CheckCircle,
  BarChart3,
} from 'lucide-react';
import {
  LineChart as ReLineChart,
  BarChart as ReBarChart, Bar,
  PieChart as RePieChart, Pie,
  Cell,
  XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { databaseApi } from '@/api/database';
import { logger } from '@/utils/safeLogger';

// ── 颜色常量 ──
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// ── 类型定义 ──
interface HotSearchItem {
  keyword: string;
  search_count: number;
  last_searched: string;
  trend: 'rising' | 'stable';
}

interface SearchBehaviorStats {
  total_searches: number;
  unique_users: number;
  avg_result_count: number;
  zero_result_rate: number;
  source_distribution: Record<string, number>;
}

interface ConversionRate {
  total_searches: number;
  converted: number;
  conversion_rate: number;
}

interface PopularCategory {
  category: string;
  count: number;
}

// ── 搜索分析仪表盘主组件 ──
const SearchAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'categories'>('overview');

  // 数据状态
  const [hotSearches, setHotSearches] = useState<HotSearchItem[]>([]);
  const [behaviorStats, setBehaviorStats] = useState<SearchBehaviorStats | null>(null);
  const [conversionRate, setConversionRate] = useState<ConversionRate | null>(null);
  const [popularCategories, setPopularCategories] = useState<PopularCategory[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');

  // 加载概览数据
  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [hotRes, behaviorRes, conversionRes, categoryRes] = await Promise.all([
        databaseApi.get('/search/analytics/hot-searches', { params: { limit: 20 } }),
        databaseApi.get('/search/analytics/behavior-stats'),
        databaseApi.get('/search/analytics/conversion-rate'),
        databaseApi.get('/search/analytics/popular-categories'),
      ]);

      setHotSearches(hotRes || []);
      setBehaviorStats(behaviorRes);
      setConversionRate(conversionRes);
      setPopularCategories(categoryRes || []);
    } catch (err) {
      logger.error('加载搜索分析数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载趋势数据
  const loadTrendData = useCallback(async (keyword: string) => {
    if (!keyword) return;
    try {
      const resp = await databaseApi.get(`/search/analytics/trends/${encodeURIComponent(keyword)}`, {
        params: { days: 30 },
      });
      setTrendData(resp || []);
    } catch (err) {
      logger.error('加载趋势数据失败:', err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOverview();
  }, [loadOverview]);

  // ── 概览卡片 ──
  const OverviewCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="总搜索次数"
        value={behaviorStats?.total_searches || 0}
        icon={Search}
        variant="primary"
      />
      <StatCard
        label="独立用户数"
        value={behaviorStats?.unique_users || 0}
        icon={Eye}
        variant="success"
      />
      <StatCard
        label="平均结果数"
        value={behaviorStats?.avg_result_count?.toFixed(1) || 0}
        icon={BarChart3}
        variant="warning"
      />
      <StatCard
        label="转化率"
        value={`${conversionRate?.conversion_rate || 0}%`}
        icon={CheckCircle}
        variant="info"
      />
    </div>
  );

  // ── 热门搜索词表格 ──
  const HotSearchTable = () => {
    const handleRowClick = (record: HotSearchItem) => {
      setSelectedKeyword(record.keyword);
      loadTrendData(record.keyword);
      setActiveTab('trends');
    };

    return (
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>🔥 热门搜索词</CardTitle>
          <div className="flex gap-1">
            {(['overview', 'trends', 'categories'] as const).map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab(tab)}
                className="text-xs h-7"
              >
                {{ overview: '概览', trends: '趋势', categories: '分类' }[tab]}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                accessorKey: 'rank',
                header: '排名',
                size: 60,
                cell: ({ row }: { row: { index: number } }) => (
                  <span className="font-bold">{row.index + 1}</span>
                ),
              },
              {
                accessorKey: 'keyword',
                header: '搜索词',
                cell: ({ row }: { row: { original: HotSearchItem } }) => (
                  <a
                    onClick={() => handleRowClick(row.original)}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    {row.original.keyword}
                  </a>
                ),
              },
              {
                accessorKey: 'search_count',
                header: '搜索次数',
                size: 120,
                cell: ({ row }: { row: { original: HotSearchItem } }) => row.original.search_count,
              },
              {
                accessorKey: 'trend',
                header: '趋势',
                size: 100,
                cell: ({ row }: { row: { original: HotSearchItem } }) => (
                  <Badge variant={row.original.trend === 'rising' ? 'destructive' : 'success'}>
                    {row.original.trend === 'rising' ? '🔥 上升' : '➡️ 稳定'}
                  </Badge>
                ),
              },
              {
                accessorKey: 'last_searched',
                header: '最后搜索',
                size: 120,
                cell: ({ row }: { row: { original: HotSearchItem } }) =>
                  row.original.last_searched
                    ? new Date(row.original.last_searched).toLocaleDateString('zh-CN')
                    : '-',
              },
            ]}
            data={hotSearches}
            onRowClick={handleRowClick}
            pageSizeOptions={[10, 20]}
          />
        </CardContent>
      </Card>
    );
  };

  // ── 趋势图表 ──
  const TrendChart = () => {
    if (!selectedKeyword) {
      return <EmptyState title="请选择一个搜索词查看趋势" description="点击热门搜索词可在此查看其搜索趋势变化" />;
    }

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{`📈 ${selectedKeyword} 搜索趋势`}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <ReLineChart />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.3}
                name="搜索次数"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  // ── 分类饼图 ──
  const CategoryPie = () => {
    const pieData = popularCategories.map((c) => ({
      name: c.category,
      value: c.count,
    }));

    if (pieData.length === 0) {
      return <EmptyState title="暂无分类数据" description="暂无热门分类统计信息" />;
    }

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📊 热门分类分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie rootTabIndex={-1}
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </RePieChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300}>
              <ReBarChart data={pieData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Bar dataKey="value" fill="#82ca9d" name="数量" />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── 零结果率告警 ──
  const ZeroResultAlert = () => {
    if (!behaviorStats || behaviorStats.zero_result_rate < 5) return null;
    return (
      <Alert
        variant="warning"
        title="零结果率偏高"
        description={`当前零结果率为 ${behaviorStats.zero_result_rate}%，建议优化搜索算法或扩充词库。`}
      />
    );
  };

  // ── 来源分布 ──
  const SourceDistribution = () => {
    if (!behaviorStats?.source_distribution) return null;

    const sourceData = Object.entries(behaviorStats.source_distribution).map(([name, value]) => ({
      name,
      value,
    }));

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>🔍 搜索来源分布</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <ReBarChart data={sourceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Bar dataKey="value" fill="#8884d8" name="搜索次数" />
            </ReBarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-[var(--space-apple-lg)]">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-[var(--space-apple-sm)]">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-[var(--radius-pill)]" />
          <span className="text-sm text-muted-foreground">加载分析数据...</span>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line react-hooks/static-components */}
          <ZeroResultAlert />
          {/* eslint-disable-next-line react-hooks/static-components */}
          <OverviewCards />
          {/* eslint-disable-next-line react-hooks/static-components */}
          <HotSearchTable />
          {/* eslint-disable-next-line react-hooks/static-components */}
          <TrendChart />
          {/* eslint-disable-next-line react-hooks/static-components */}
          <CategoryPie />
          {/* eslint-disable-next-line react-hooks/static-components */}
          <SourceDistribution />
        </>
      )}
    </div>
  );
};

export default SearchAnalyticsDashboard;
