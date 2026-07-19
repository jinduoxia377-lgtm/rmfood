import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface ChartDataItem {
  [key: string]: string | number;
}

export interface ChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string | string[];
  fill?: boolean;
}

export interface BaseChartProps {
  data: ChartDataItem[];
  title?: string;
  xKey: string;
  datasets: ChartDataset[];
  height?: number;
  className?: string;
  zoomLevel?: number;
  onDataPointClick?: (x: string, y: number, series: string) => void;
  onHover?: (data: { x: string; y: number } | null) => void;
}

export const COLORS = [
  'var(--color-secondary, #0A84FF)', // primary
  'var(--color-primary, #34C759)', // green
  'var(--color-warning, #FF9F0A)', // amber
  'var(--color-error, #FF3B30)', // red
  'var(--color-tertiary, #AF52DE)', // violet
  'var(--color-pink-500, #D946EF)', // pink
  'var(--color-info, #007AFF)', // cyan
  'var(--color-success-400, #4ADE80)', // lime
];

export function LineChartComponent({
  data,
  xKey,
  datasets,
  height = 300,
  className = '',
}: BaseChartProps) {
  const handleClick = (data: any) => {
    // Handle click if needed
  };

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, rgba(0,0,0,0.06))" />
          <XAxis
            dataKey={xKey}
            tick={{ fill: 'var(--text-secondary, #6E6E73)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border-subtle, rgba(0,0,0,0.06))' }}
          />
          <YAxis
            tick={{ fill: 'var(--text-secondary, #6E6E73)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border-subtle, rgba(0,0,0,0.06))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card-bg-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              borderRadius: '8px',
              padding: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Legend />
          {datasets.map((dataset, index) => (
            <Line
              key={dataset.label}
              type="monotone"
              dataKey={dataset.label}
              stroke={dataset.borderColor || COLORS[index % COLORS.length]}
              strokeWidth={2}
              fill={dataset.fill ? (typeof dataset.backgroundColor === 'string' ? dataset.backgroundColor : 'rgba(59, 130, 246, 0.1') : 'none'}
              name={dataset.label}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              onClick={handleClick}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarChartComponent({
  data,
  xKey,
  datasets,
  height = 300,
  className = '',
}: BaseChartProps) {
  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, rgba(0,0,0,0.06))" />
          <XAxis
            dataKey={xKey}
            tick={{ fill: 'var(--text-secondary, #6E6E73)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border-subtle, rgba(0,0,0,0.06))' }}
          />
          <YAxis
            tick={{ fill: 'var(--text-secondary, #6E6E73)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border-subtle, rgba(0,0,0,0.06))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card-bg-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              borderRadius: '8px',
              padding: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Legend />
          {datasets.map((dataset, index) => (
            <Bar
              key={dataset.label}
              dataKey={dataset.label}
              fill={typeof dataset.backgroundColor === 'string' ? dataset.backgroundColor : COLORS[index % COLORS.length]}
              name={dataset.label}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface PieChartPropsExtended extends Omit<BaseChartProps, 'xKey'> {
  dataKey: string;
  nameKey: string;
}

export function PieChartComponent({
  data,
  datasets,
  dataKey,
  nameKey,
  height = 250,
  className = '',
}: PieChartPropsExtended) {
  const chartData = data.map((item) => ({
    name: item[nameKey],
    value: Number(item[dataKey]),
  }));

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={{ stroke: 'var(--text-muted, #9A9A9F)', strokeWidth: 1 }}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={Array.isArray(datasets[0]?.backgroundColor) 
                  ? datasets[0].backgroundColor[index % (datasets[0].backgroundColor.length)]
                  : datasets[0]?.backgroundColor || COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value}`, '数量']}
            contentStyle={{
              backgroundColor: 'var(--card-bg-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              borderRadius: '8px',
              padding: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaChartComponent({
  data,
  xKey,
  datasets,
  height = 300,
  className = '',
}: BaseChartProps) {
  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, rgba(0,0,0,0.06))" />
          <XAxis
            dataKey={xKey}
            tick={{ fill: 'var(--text-secondary, #6E6E73)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border-subtle, rgba(0,0,0,0.06))' }}
          />
          <YAxis
            tick={{ fill: 'var(--text-secondary, #6E6E73)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border-subtle, rgba(0,0,0,0.06))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card-bg-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              borderRadius: '8px',
              padding: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Legend />
          {datasets.map((dataset, index) => (
            <Area
              key={dataset.label}
              type="monotone"
              dataKey={dataset.label}
              stroke={dataset.borderColor || COLORS[index % COLORS.length]}
              fill={typeof dataset.backgroundColor === 'string' ? dataset.backgroundColor : 'rgba(59, 130, 246, 0.3)'}
              name={dataset.label}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export type ChartType = 'line' | 'bar' | 'pie' | 'area';

export interface AnalyticsChartProps {
  type: ChartType;
  data: ChartDataItem[];
  xKey?: string;
  dataKey?: string;
  nameKey?: string;
  datasets: ChartDataset[];
  title?: string;
  height?: number;
  className?: string;
  zoomLevel?: number;
  onDataPointClick?: (x: string, y: number, series: string) => void;
  onHover?: (data: { x: string; y: number } | null) => void;
}

export function AnalyticsChart({
  type,
  data,
  xKey = 'name',
  dataKey = 'value',
  nameKey = 'name',
  datasets,
  height = 300,
  className = '',
}: AnalyticsChartProps) {
  const chartProps = { data, datasets, height, className };

  switch (type) {
    case 'line':
      return <LineChartComponent {...chartProps} xKey={xKey} />;
    case 'bar':
      return <BarChartComponent {...chartProps} xKey={xKey} />;
    case 'pie':
      return (
        <PieChartComponent
          {...chartProps}
          dataKey={dataKey}
          nameKey={nameKey}
        />
      );
    case 'area':
      return <AreaChartComponent {...chartProps} xKey={xKey} />;
    default:
      return <LineChartComponent {...chartProps} xKey={xKey} />;
  }
}