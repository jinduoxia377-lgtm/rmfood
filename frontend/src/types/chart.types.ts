export enum ChartCategory {
  BASIC = 'basic',
  ADVANCED = 'ADVANCED',
  STATISTICAL = 'statistical',
  PROFESSIONAL = 'professional'
}

export interface ChartTypeDefinition {
  id: string;
  name: string;
  nameEn: string;
  category: ChartCategory;
  icon: string;
  description: string;
  supportedDataFormats: DataFormat[];
  configOptions: ChartConfigOption[];
  defaultOptions: ChartRenderOptions;
}

export enum DataFormat {
  SINGLE_SERIES = 'single_series',
  MULTI_SERIES = 'multi_series',
  XY_SCATTER = 'xy_scatter',
  MATRIX = 'matrix',
  HIERARCHICAL = 'hierarchical',
  FUNNEL_DATA = 'funnel_data',
  TIMELINE = 'timeline'
}

export interface ChartConfigOption {
  key: string;
  label: string;
  type: 'select' | 'number' | 'color' | 'boolean' | 'text' | 'slider';
  defaultValue: any;
  options?: { label: string; value: any }[];
  min?: number;
  max?: number;
  step?: number;
  group?: string;
  description?: string;
}

export interface ChartRenderOptions {
  width?: number;
  height?: number;
  responsive?: boolean;
  animation?: boolean;
  animationDuration?: number;

  colors?: string[];
  colorScheme?: ColorSchemeType;
  backgroundColor?: string;

  title?: {
    text: string;
    fontSize?: number;
    color?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
  };

  legend?: {
    show: boolean;
    position: 'top' | 'bottom' | 'left' | 'right';
    fontSize?: number;
  };

  tooltip?: {
    enabled: boolean;
    format?: string;
  };

  axis?: {
    x?: AxisConfig;
    y?: AxisConfig;
  };

  grid?: {
    show: boolean;
    horizontalLines?: boolean;
    verticalLines?: boolean;
    color?: string;
  };

  dataLabels?: {
    enabled: boolean;
    format?: string;
    fontSize?: number;
    color?: string;
  };

  export?: {
    enabled: boolean;
    formats: ('png' | 'svg' | 'jpg' | 'csv')[];
    quality?: number;
    resolution?: number;
  };

  interaction?: {
    zoom?: boolean;
    pan?: boolean;
    crosshair?: boolean;
    selection?: boolean;
  };
}

export interface AxisConfig {
  label?: string;
  show?: boolean;
  type?: 'category' | 'value' | 'time' | 'log';
  min?: number;
  max?: number;
  tickCount?: number;
  rotation?: number;
  format?: string;
}

export enum ColorSchemeType {
  DEFAULT = 'default',
  BRAND = 'brand',
  PASTEL = 'pastel',
  VIBRANT = 'vibrant',
  MONOCHROME = 'monochrome',
  COLORBLIND_SAFE = 'colorblind_safe',
  PRINT_FRIENDLY = 'print_friendly',
  DARK = 'dark'
}

export const COLOR_SCHEMES: Record<ColorSchemeType, string[]> = {
  [ColorSchemeType.DEFAULT]: ['#1e40af', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
  [ColorSchemeType.BRAND]: ['#2563eb', '#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff'],
  [ColorSchemeType.PASTEL]: ['#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#a5f3fc', '#c7d2fe', '#ddd6fe', '#fbcfe8'],
  [ColorSchemeType.VIBRANT]: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff', '#06d6a0', '#ef476f', '#ffd166'],
  [ColorSchemeType.MONOCHROME]: ['#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6'],
  [ColorSchemeType.COLORBLIND_SAFE]: ['#0072b2', '#d55e00', '#009e73', '#cc79a7', '#f0e442', '#56b4e9', '#e69f00', '#000000'],
  [ColorSchemeType.PRINT_FRIENDLY]: ['#000000', '#333333', '#666666', '#999999', '#cccccccc', '#e0e0e0', '#f0f0f0', '#ffffff'],
  [ColorSchemeType.DARK]: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#22d3ee', '#4ade80'],
};

export const CHART_TYPE_DEFINITIONS: ChartTypeDefinition[] = [
  {
    id: 'bar',
    name: '柱状图',
    nameEn: 'Bar Chart',
    category: ChartCategory.BASIC,
    icon: '📊',
    description: '适用于类别数据的对比分析，支持分组和堆叠模式',
    supportedDataFormats: [DataFormat.SINGLE_SERIES, DataFormat.MULTI_SERIES],
    configOptions: [
      { key: 'stacked', label: '堆叠显示', type: 'boolean', defaultValue: false, group: '布局' },
      { key: 'horizontal', label: '水平方向', type: 'boolean', defaultValue: false, group: '布局' },
      { key: 'barWidth', label: '柱宽比例', type: 'slider', defaultValue: 0.7, min: 0.1, max: 1, step: 0.05, group: '样式' },
      { key: 'showValues', label: '显示数值', type: 'boolean', defaultValue: false, group: '标签' },
    ],
    defaultOptions: {
      width: 800,
      height: 400,
      responsive: true,
      animation: true,
      legend: { show: true, position: 'top' },
      tooltip: { enabled: true },
    },
  },
  {
    id: 'line',
    name: '折线图',
    nameEn: 'Line Chart',
    category: ChartCategory.BASIC,
    icon: '📈',
    description: '展示数据随时间变化的趋势，支持多系列对比',
    supportedDataFormats: [DataFormat.SINGLE_SERIES, DataFormat.MULTI_SERIES],
    configOptions: [
      { key: 'smooth', label: '平滑曲线', type: 'boolean', defaultValue: true, group: '样式' },
      { key: 'showPoints', label: '显示数据点', type: 'boolean', defaultValue: true, group: '标签' },
      { key: 'lineWidth', label: '线条粗细', type: 'slider', defaultValue: 2, min: 1, max: 5, step: 0.5, group: '样式' },
      { key: 'area', label: '面积填充', type: 'boolean', defaultValue: false, group: '样式' },
    ],
    defaultOptions: {
      width: 800,
      height: 400,
      responsive: true,
      animation: true,
      legend: { show: true, position: 'top' },
      tooltip: { enabled: true },
      interaction: { zoom: true, pan: true },
    },
  },
  {
    id: 'pie',
    name: '饼图',
    nameEn: 'Pie Chart',
    category: ChartCategory.BASIC,
    icon: '🥧',
    description: '展示各部分占整体的比例关系',
    supportedDataFormats: [DataFormat.SINGLE_SERIES],
    configOptions: [
      { key: 'donut', label: '环形图', type: 'boolean', defaultValue: false, group: '样式' },
      { key: 'innerRadius', label: '内圆半径', type: 'slider', defaultValue: 0, min: 0, max: 0.8, step: 0.05, group: '样式' },
      { key: 'showPercentages', label: '显示百分比', type: 'boolean', defaultValue: true, group: '标签' },
      { key: 'explodeSlice', label: '突出扇区', type: 'number', defaultValue: -1, group: '交互' },
    ],
    defaultOptions: {
      width: 500,
      height: 500,
      responsive: true,
      animation: true,
      legend: { show: true, position: 'right' },
      tooltip: { enabled: true },
    },
  },
  {
    id: 'scatter',
    name: '散点图',
    nameEn: 'Scatter Plot',
    category: ChartCategory.BASIC,
    icon: '⚬',
    description: '展示两个变量之间的关系分布',
    supportedDataFormats: [DataFormat.XY_SCATTER],
    configOptions: [
      { key: 'pointSize', label: '点大小', type: 'slider', defaultValue: 8, min: 2, max: 20, step: 1, group: '样式' },
      { key: 'showTrendLine', label: '趋势线', type: 'boolean', defaultValue: false, group: '分析' },
      { key: 'opacity', label: '透明度', type: 'slider', defaultValue: 0.8, min: 0.1, max: 1, step: 0.05, group: '样式' },
    ],
    defaultOptions: {
      width: 600,
      height: 500,
      responsive: true,
      animation: true,
      tooltip: { enabled: true },
      interaction: { zoom: true, selection: true },
    },
  },
  {
    id: 'heatmap',
    name: '热力矩阵图',
    nameEn: 'Heatmap Matrix',
    category: ChartCategory.ADVANCED,
    icon: '🌡️',
    description: '以颜色深浅表示数值大小，适用于矩阵数据分析',
    supportedDataFormats: [DataFormat.MATRIX],
    configOptions: [
      { key: 'colorScale', label: '配色方案', type: 'select', defaultValue: 'blues', options: [
        { label: '蓝色系', value: 'blues' },
        { label: '红色系', value: 'reds' },
        { label: '彩虹色', value: 'rainbow' },
        { label: '灰度', value: 'grayscale' },
      ], group: '样式' },
      { key: 'showValues', label: '显示数值', type: 'boolean', defaultValue: true, group: '标签' },
      { key: 'cellSize', label: '单元格大小', type: 'slider', defaultValue: 40, min: 20, max: 80, step: 5, group: '布局' },
    ],
    defaultOptions: {
      width: 700,
      height: 500,
      responsive: true,
      animation: false,
    },
  },
  {
    id: 'sankey',
    name: '桑基流向图',
    nameEn: 'Sankey Diagram',
    category: ChartCategory.ADVANCED,
    icon: '🔀',
    description: '展示流量在多个节点间的分配与流向关系',
    supportedDataFormats: [DataFormat.HIERARCHICAL],
    configOptions: [
      { key: 'nodeWidth', label: '节点宽度', type: 'slider', defaultValue: 20, min: 10, max: 50, step: 2, group: '布局' },
      { key: 'nodePadding', label: '节点间距', type: 'slider', defaultValue: 15, min: 5, max: 30, step: 1, group: '布局' },
      { key: 'linkOpacity', label: '连线透明度', type: 'slider', defaultValue: 0.3, min: 0.1, max: 0.8, step: 0.05, group: '样式' },
    ],
    defaultOptions: {
      width: 900,
      height: 500,
      responsive: true,
      animation: true,
      tooltip: { enabled: true },
    },
  },
  {
    id: 'funnel',
    name: '漏斗转化图',
    nameEn: 'Funnel Chart',
    category: ChartCategory.ADVANCED,
    icon: '🔻',
    description: '展示流程各阶段的转化率或数量递减情况',
    supportedDataFormats: [DataFormat.FUNNEL_DATA],
    configOptions: [
      { key: 'sort', label: '排序方式', type: 'select', defaultValue: 'descending', options: [
        { label: '降序', value: 'descending' },
        { label: '升序', value: 'ascending' },
        { label: '原始顺序', value: 'none' },
      ], group: '排序' },
      { key: 'showPercentage', label: '显示百分比', type: 'boolean', defaultValue: true, group: '标签' },
      { key: 'gap', label: '层级间距', type: 'slider', defaultValue: 2, min: 0, max: 10, step: 1, group: '布局' },
    ],
    defaultOptions: {
      width: 600,
      height: 500,
      responsive: true,
      animation: true,
      dataLabels: { enabled: true },
    },
  },
  {
    id: 'sunburst',
    name: '旭日层级图',
    nameEn: 'Sunburst Chart',
    category: ChartCategory.ADVANCED,
    icon: '☀️',
    description: '展示多层级数据的占比关系，内外圈表示不同层级',
    supportedDataFormats: [DataFormat.HIERARCHICAL],
    configOptions: [
      { key: 'levels', label: '显示层数', type: 'number', defaultValue: 3, min: 2, max: 5, group: '布局' },
      { key: 'radius', label: '内圆半径', type: 'slider', defaultValue: 0.1, min: 0, max: 0.3, step: 0.02, group: '样式' },
    ],
    defaultOptions: {
      width: 600,
      height: 600,
      responsive: true,
      animation: true,
      legend: { show: true, position: 'right' },
      tooltip: { enabled: true },
    },
  },
  {
    id: 'boxplot',
    name: '箱线图',
    nameEn: 'Box Plot',
    category: ChartCategory.STATISTICAL,
    icon: '📦',
    description: '展示数据的分布特征（中位数、四分位数、异常值）',
    supportedDataFormats: [DataFormat.MULTI_SERIES],
    configOptions: [
      { key: 'showOutliers', label: '显示异常值', type: 'boolean', defaultValue: true, group: '数据' },
      { key: 'boxWidth', label: '箱体宽度', type: 'slider', defaultValue: 0.6, min: 0.2, max: 1, step: 0.05, group: '样式' },
      { key: 'whiskerStyle', label: '须线样式', type: 'select', defaultValue: 'line', options: [
        { label: '直线', value: 'line' },
        { label: '虚线', value: 'dashed' },
      ], group: '样式' },
    ],
    defaultOptions: {
      width: 700,
      height: 450,
      responsive: true,
      animation: true,
      tooltip: { enabled: true },
    },
  },
  {
    id: 'violin',
    name: '小提琴图',
    nameEn: 'Violin Plot',
    category: ChartCategory.STATISTICAL,
    icon: '🎻',
    description: '结合箱线图与核密度估计，更直观地展示数据分布',
    supportedDataFormats: [DataFormat.MULTI_SERIES],
    configOptions: [
      { key: 'showBox', label: '内部箱线', type: 'boolean', defaultValue: true, group: '结构' },
      { key: 'bandwidth', label: '带宽', type: 'slider', defaultValue: 0.3, min: 0.1, max: 0.8, step: 0.05, group: '统计' },
      { key: 'orientation', label: '方向', type: 'select', defaultValue: 'vertical', options: [
        { label: '垂直', value: 'vertical' },
        { label: '水平', value: 'horizontal' },
      ], group: '布局' },
    ],
    defaultOptions: {
      width: 700,
      height: 450,
      responsive: true,
      animation: true,
    },
  },
  {
    id: 'radar',
    name: '雷达图',
    nameEn: 'Radar Chart',
    category: ChartCategory.PROFESSIONAL,
    icon: '🕸️',
    description: '多维数据的综合对比分析，适用于能力评估等场景',
    supportedDataFormats: [DataFormat.MULTI_SERIES],
    configOptions: [
      { key: 'polygon', label: '填充区域', type: 'boolean', defaultValue: true, group: '样式' },
      { key: 'axisCount', label: '轴数', type: 'number', defaultValue: 6, min: 3, max: 12, group: '布局' },
      { key: 'startAngle', label: '起始角度', type: 'slider', defaultValue: 90, min: 0, max: 360, step: 15, group: '布局' },
    ],
    defaultOptions: {
      width: 550,
      height: 550,
      responsive: true,
      animation: true,
      legend: { show: true, position: 'bottom' },
      tooltip: { enabled: true },
    },
  },
  {
    id: 'gantt',
    name: '甘特图',
    nameEn: 'Gantt Chart',
    category: ChartCategory.PROFESSIONAL,
    icon: '📅',
    description: '项目进度管理专用图表，展示任务时间线和依赖关系',
    supportedDataFormats: [DataFormat.TIMELINE],
    configOptions: [
      { key: 'showDependencies', label: '显示依赖线', type: 'boolean', defaultValue: true, group: '关系' },
      { key: 'todayMarker', label: '今日标记', type: 'boolean', defaultValue: true, group: '标记' },
      { key: 'milestoneShape', label: '里程碑形状', type: 'select', defaultValue: 'diamond', options: [
        { label: '菱形', value: 'diamond' },
        { label: '圆形', value: 'circle' },
        { label: '三角形', value: 'triangle' },
      ], group: '样式' },
    ],
    defaultOptions: {
      width: 1000,
      height: 450,
      responsive: true,
      interaction: { zoom: true, pan: true },
    },
  },
];

export function getChartTypeById(id: string): ChartTypeDefinition | undefined {
  return CHART_TYPE_DEFINITIONS.find(ct => ct.id === id);
}

export function getChartsByCategory(category: ChartCategory): ChartTypeDefinition[] {
  return CHART_TYPE_DEFINITIONS.filter(ct => ct.category === category);
}
