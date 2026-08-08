/**
 * 搜索分析仪表盘
 *
 * 用于 Potion AI VFT x RMFOOD 深度融合方案。
 * 展示搜索热词、趋势、行为统计、转化率等数据。
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Table, Tag, Statistic, DatePicker,
  Spin, Empty, Alert, Radio, Select,
} from 'antd';
import {
  SearchOutlined, FireOutlined, ArrowUpOutlined,
  EyeOutlined, CheckCircleOutlined, ClockCircleOutlined,
  BarChartOutlined, LineChartOutlined, PieChartOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { databaseApi } from '@/api/database';


import { logger } from '@/utils/safeLogger';
const { RangePicker } = DatePicker;

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
    loadOverview();
  }, [loadOverview]);

  // ── 概览卡片 ──
  const OverviewCards = () => (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="总搜索次数"
            value={behaviorStats?.total_searches || 0}
            prefix={<SearchOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="独立用户数"
            value={behaviorStats?.unique_users || 0}
            prefix={<EyeOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="平均结果数"
            value={behaviorStats?.avg_result_count || 0}
            precision={1}
            prefix={<BarChartOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="转化率"
            value={conversionRate?.conversion_rate || 0}
            suffix="%"
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
    </Row>
  );

  // ── 热门搜索词表格 ──
  const HotSearchTable = () => {
    const columns = [
      {
        title: '排名',
        key: 'rank',
        render: (_: any, __: any, index: number) => <span style={{ fontWeight: 700 }}>{index + 1}</span>,
      },
      {
        title: '搜索词',
        dataIndex: 'keyword',
        key: 'keyword',
        render: (text: string) => (
          <a onClick={() => {
            setSelectedKeyword(text);
            loadTrendData(text);
            setActiveTab('trends');
          }}>
            {text}
          </a>
        ),
      },
      {
        title: '搜索次数',
        dataIndex: 'search_count',
        key: 'search_count',
        sorter: (a: HotSearchItem, b: HotSearchItem) => b.search_count - a.search_count,
      },
      {
        title: '趋势',
        dataIndex: 'trend',
        key: 'trend',
        render: (trend: string) => (
          <Tag color={trend === 'rising' ? 'red' : 'green'}>
            {trend === 'rising' ? '🔥 上升' : '➡️ 稳定'}
          </Tag>
        ),
      },
      {
        title: '最后搜索',
        dataIndex: 'last_searched',
        key: 'last_searched',
        render: (date: string) => date ? new Date(date).toLocaleDateString('zh-CN') : '-',
      },
    ];

    return (
      <Card title="🔥 热门搜索词" extra={
        <Radio.Group value={activeTab} onChange={(e) => setActiveTab(e.target.value)} size="small">
          <Radio.Button value="overview">概览</Radio.Button>
          <Radio.Button value="trends">趋势</Radio.Button>
          <Radio.Button value="categories">分类</Radio.Button>
        </Radio.Group>
      }>
        <Table
          columns={columns}
          dataSource={hotSearches}
          rowKey={(record) => record.keyword}
          pagination={false}
          size="small"
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => {
              setSelectedKeyword(record.keyword);
              loadTrendData(record.keyword);
              setActiveTab('trends');
            },
          })}
        />
      </Card>
    );
  };

  // ── 趋势图表 ──
  const TrendChart = () => {
    if (!selectedKeyword) {
      return <Empty description="请选择一个搜索词查看趋势" />;
    }

    return (
      <Card title={`📈 ${selectedKeyword} 搜索趋势`} style={{ marginTop: 24 }}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
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
      return <Empty description="暂无分类数据" />;
    }

    return (
      <Card title="📊 热门分类分布" style={{ marginTop: 24 }}>
        <Row gutter={24}>
          <Col span={12}>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
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
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </Col>
          <Col span={12}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pieData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#82ca9d" name="数量" />
              </BarChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      </Card>
    );
  };

  // ── 零结果率告警 ──
  const ZeroResultAlert = () => {
    if (!behaviorStats || behaviorStats.zero_result_rate < 5) return null;
    return (
      <Alert
        message="零结果率偏高"
        description={`当前零结果率为 ${behaviorStats.zero_result_rate}%，建议优化搜索算法或扩充词库。`}
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
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
      <Card title="🔍 搜索来源分布" style={{ marginTop: 24 }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sourceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8" name="搜索次数" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Spin spinning={loading}>
        <ZeroResultAlert />
        <OverviewCards />
        <HotSearchTable />
        <TrendChart />
        <CategoryPie />
        <SourceDistribution />
      </Spin>
    </div>
  );
};

export default SearchAnalyticsDashboard;
