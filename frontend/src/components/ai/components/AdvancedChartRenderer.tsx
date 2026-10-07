import { logger } from '@/utils/safeLogger'
import React, { useMemo } from 'react';
import {
  CHART_TYPE_DEFINITIONS,
  COLOR_SCHEMES,
  ColorSchemeType,
} from '../../../types/chart.types';

interface AdvancedChartRendererProps {
  chartType: string;
  data: any[];
  options?: Record<string, any>;
  width?: number;
  height?: number;
  onChartClick?: (data: any) => void;
}

const AdvancedChartRenderer: React.FC<AdvancedChartRendererProps> = ({
  chartType,
  data,
  options = {},
  width = 800,
  height = 400,
}) => {
  const chartDef = useMemo(() =>
    CHART_TYPE_DEFINITIONS.find(ct => ct.id === chartType),
    [chartType],
  );

  const mergedOptions = useMemo(() => ({
    ...chartDef?.defaultOptions,
    ...options,
  }), [chartDef, options]);

  if (!chartDef) {
    return (
      <div className="flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-lg" style={{ width, height }}>
        <div className="text-center text-neutral-500">
          <p className="text-lg font-medium">未知图表类型</p>
          <p className="text-sm">类型ID: {chartType}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="advanced-chart-container">
      <div
        className="relative bg-white dark:bg-neutral-900 rounded-lg shadow-sm border border-neutral-200 overflow-hidden"
        style={{ width: mergedOptions.width || width, height: mergedOptions.height || height }}
      >
        <ChartToolbar onExport={handleExport} />

        <div className="chart-canvas-wrapper p-4">
          {renderChartByType(chartType, data, mergedOptions)}
        </div>
      </div>
    </div>
  );
};

function renderChartByType(type: string, data: any[], opts: Record<string, any>): React.ReactNode {
  switch (type) {
    case 'bar':
      return <BarChartPlaceholder data={data} options={opts} />;
    case 'line':
      return <LineChartPlaceholder data={data} options={opts} />;
    case 'pie':
      return <PieChartPlaceholder data={data} options={opts} />;
    case 'scatter':
      return <ScatterChartPlaceholder data={data} options={opts} />;
    case 'heatmap':
      return <HeatmapPlaceholder data={data} options={opts} />;
    case 'sankey':
      return <SankeyPlaceholder data={data} options={opts} />;
    case 'funnel':
      return <FunnelPlaceholder data={data} options={opts} />;
    case 'sunburst':
      return <SunburstPlaceholder data={data} options={opts} />;
    case 'boxplot':
      return <BoxPlotPlaceholder data={data} options={opts} />;
    case 'violin':
      return <ViolinPlaceholder data={data} options={opts} />;
    case 'radar':
      return <RadarPlaceholder options={opts} />;
    case 'gantt':
      return <GanttPlaceholder data={data} options={opts} />;
    default:
      return <GenericChartPlaceholder type={type} data={data} options={opts} />;
  }
}

interface ChartToolbarProps {
  onExport: (format: string) => void;
}

const ChartToolbar: React.FC<ChartToolbarProps> = ({ onExport }) => (
  <div className="absolute top-2 right-2 flex items-center space-x-1 z-10 opacity-0 hover:opacity-100 transition-opacity">
    <button
      onClick={() => onExport('png')}
      className="p-1.5 bg-white dark:bg-neutral-900 rounded shadow-sm border border-neutral-200 hover:bg-slate-50 dark:bg-neutral-800 text-neutral-600"
      title="导出PNG"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </button>
    <button
      onClick={() => onExport('svg')}
      className="p-1.5 bg-white dark:bg-neutral-900 rounded shadow-sm border border-neutral-200 hover:bg-slate-50 dark:bg-neutral-800 text-neutral-600"
      title="导出SVG"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    </button>
    <button
      className="p-1.5 bg-white dark:bg-neutral-900 rounded shadow-sm border border-neutral-200 hover:bg-slate-50 dark:bg-neutral-800 text-neutral-600"
      title="全屏"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    </button>
  </div>
);

function handleExport(format: string): void {
  logger.log(`Exporting chart as ${format}`);
}

const BarChartPlaceholder: React.FC<{ data: any[]; options: Record<string, any> }> = ({ data, options }) => (
  <div className="flex items-end justify-around h-full px-8 pb-8 pt-4">
    {data.slice(0, 8).map((item, i) => {
      const value = typeof item.value !== 'undefined' ? item.value : Math.random() * 80 + 20;
      const colors = COLOR_SCHEMES[(options.colorScheme as ColorSchemeType) || ColorSchemeType.DEFAULT];
      return (
        <div key={i} className="flex flex-col items-center group cursor-pointer">
          <span className="text-xs font-medium text-neutral-700 opacity-0 group-hover:opacity-100 mb-1 transition-opacity">
            {value.toFixed(1)}
          </span>
          <div
            className="w-12 rounded-t transition-all duration-300 group-hover:opacity-80"
            style={{
              height: `${value}%`,
              backgroundColor: colors[i % colors.length],
              minHeight: '10px',
            }}
          />
          <span className="text-xs text-neutral-600 mt-2 truncate w-16 text-center">{item.name || `项${i + 1}`}</span>
        </div>
      );
    })}
  </div>
);

const LineChartPlaceholder: React.FC<{ data: any[]; options: Record<string, any> }> = ({ data, options }) => (
  <svg viewBox={`0 0 ${options.width || 800} ${(options.height || 400) - 60}`} className="w-full h-full">
    <polyline
      points={data.map((d, i) => `${(i / (data.length - 1)) * 760 + 20},${300 - (d.value || Math.random() * 200 + 50)}`).join(' ')}
      fill="none"
      stroke="var(--color-secondary-500)"
      strokeWidth="2"
      className="transition-all duration-300"
    />
    {data.map((d, i) => (
      <circle
        key={i}
        cx={(i / (data.length - 1)) * 760 + 20}
        cy={300 - (d.value || Math.random() * 200 + 50)}
        r="4"
        fill="var(--color-secondary-500)"
        className="hover:r-6 transition-all cursor-pointer"
      />
    ))}
  </svg>
);

const PieChartPlaceholder: React.FC<{ data: any[]; options: Record<string, any> }> = ({ data, options }) => {
  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
  let currentAngle = -90;

  return (
    <svg viewBox="0 0 400 400" className="w-3/4 mx-auto">
      {data.map((item, i) => {
        const value = item.value || 0;
        const angle = (value / total) * 360;
        const startAngle = currentAngle;
        currentAngle += angle;

        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (currentAngle * Math.PI) / 180;

        const x1 = 200 + 150 * Math.cos(startRad);
        const y1 = 200 + 150 * Math.sin(startRad);
        const x2 = 200 + 150 * Math.cos(endRad);
        const y2 = 200 + 150 * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;
        const colors = COLOR_SCHEMES[(options.colorScheme as ColorSchemeType) || ColorSchemeType.DEFAULT];

        return (
          <path
            key={i}
            d={`M 200 200 L ${x1} ${y1} A 150 150 0 ${largeArc} 1 ${x2} ${y2} Z`}
            fill={colors[i % colors.length]}
            className="hover:opacity-80 transition-opacity cursor-pointer"
          />
        );
      })}
    </svg>
  );
};

const ScatterChartPlaceholder: React.FC<{ data: any[]; options: Record<string, any> }> = ({ data }) => (
  <div className="w-full h-full relative">
    {data.map((d, i) => (
      <div
        key={i}
        className="absolute w-3 h-3 bg-secondary-500 rounded-full hover:w-4 hover:h-4 transition-all cursor-pointer"
        style={{
          left: `${(d.x || Math.random()) * 90}%`,
          top: `${100 - (d.y || Math.random()) * 80}%`,
        }}
      />
    ))}
  </div>
);

const HeatmapPlaceholder: React.FC<{ data: any[]; options: Record<string, any> }> = ({ data }) => (
  <div className="grid gap-1" style={{
    gridTemplateColumns: `repeat(${data[0]?.values?.length || 5}, 1fr)`,
  }}>
    {data.map((row, i) =>
      row.values?.map((val: number, j: number) => (
        <div
          key={`${i}-${j}`}
          className="aspect-square flex items-center justify-center text-xs font-medium rounded"
          style={{
            backgroundColor: `rgba(59, 130, 246, ${val / 100})`,
            color: val > 50 ? 'white' : '#003E87',
          }}
        >
          {val}
        </div>
      )),
    )}
  </div>
);

const SankeyPlaceholder: React.FC<{ data: any[]; options: Record<string, any> }> = () => (
  <div className="flex items-center justify-center h-full text-neutral-500">
    <div className="text-center">
      <div className="text-4xl mb-2">🔀</div>
      <p className="text-sm">桑基流向图</p>
      <p className="text-xs mt-1">（需要专业图表库支持）</p>
    </div>
  </div>
);

const FunnelPlaceholder: React.FC<{ data: any[]; options: Record<string, any> }> = ({ data }) => (
  <div className="flex flex-col items-center justify-center space-y-2 py-4">
    {data.map((item, i) => (
      <div
        key={i}
        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium py-3 rounded-t flex items-center justify-between px-8 transition-all hover:from-blue-600 hover:to-blue-700"
        style={{ width: `${100 - i * 15}%` }}
      >
        <span>{item.name || `阶段${i + 1}`}</span>
        <span className="ml-4">{item.value || ''}</span>
      </div>
    ))}
  </div>
);

const SunburstPlaceholder: React.FC<{ data: any[]; options: Record<string, any> }> = () => (
  <div className="flex items-center justify-center h-full text-neutral-500">
    <div className="text-center">
      <div className="text-4xl mb-2">☀️</div>
      <p className="text-sm">旭日层级图</p>
      <p className="text-xs mt-1">（需要专业图表库支持）</p>
    </div>
  </div>
);

const BoxPlotPlaceholder: React.FC<{ data: any[]; options: Record<string, any> }> = ({ data }) => (
  <div className="flex items-end justify-around h-full px-8 pb-8">
    {data.map((_, i) => (
      <div key={i} className="flex flex-col items-center">
        <div className="w-16 h-32 border-2 border-blue-500 rounded relative bg-secondary-50">
          <div className="absolute left-0 right-0 bg-secondary-500" style={{ top: '25%', height: '50%' }} />
          <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 bg-secondary-500" style={{ top: '10%', height: '80%' }} />
        </div>
        <span className="text-xs text-neutral-600 mt-2">组{i + 1}</span>
      </div>
    ))}
  </div>
);

const ViolinPlaceholder: React.FC<{ data: any[]; options: Record<string, any> }> = ({ data }) => (
  <div className="flex items-end justify-around h-full px-8 pb-8">
    {data.map((_, i) => (
      <div key={i} className="flex flex-col items-center">
        <svg width="60" height="160" viewBox="0 0 60 160">
          <ellipse cx="30" cy="80" rx="25" ry="70" fill="var(--color-accent-500)" opacity="0.6" />
          <rect x="27" y="30" width="6" height="100" fill="#8B5CF6" />
        </svg>
        <span className="text-xs text-neutral-600 mt-2">组{i + 1}</span>
      </div>
    ))}
  </div>
);

const RadarPlaceholder: React.FC<{ options: Record<string, any> }> = () => (
  <svg viewBox="0 0 400 400" className="w-3/4 mx-auto">
    {[3, 4, 5, 6].map((sides) => (
      <polygon
        key={sides}
        points={Array.from({ length: sides }, (_, i) => {
          const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
          const radius = (sides / 6) * 140 + 20;
          return `${200 + radius * Math.cos(angle)},${200 + radius * Math.sin(angle)}`;
        }).join(' ')}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="1"
      />
    ))}
    <polygon
      points={Array.from({ length: 6 }, (_, i) => {
        const angle = (i * 2 * Math.PI) / 6 - Math.PI / 2;
        const radius = 100 + Math.random() * 60;
        return `${200 + radius * Math.cos(angle)},${200 + radius * Math.sin(angle)}`;
      }).join(' ')}
        fill="rgba(59, 130, 246, 0.3)"
        stroke="var(--color-secondary-500)"
        strokeWidth="2"
    />
  </svg>
);

const GanttPlaceholder: React.FC<{ data: any[]; options: Record<string, any> }> = ({ data }) => (
  <div className="space-y-2 py-4">
    {data.map((task, i) => (
      <div key={i} className="flex items-center">
        <span className="w-24 text-sm text-neutral-700 truncate">{task.name || `任务${i + 1}`}</span>
        <div className="flex-1 h-6 bg-neutral-100 dark:bg-neutral-800 rounded relative ml-4">
          <div
            className="absolute h-full bg-gradient-to-r from-green-400 to-green-500 rounded"
            style={{
              left: `${(task.start || 0) * 100}%`,
              width: `${((task.end || task.start + 0.3) - (task.start || 0)) * 100}%`,
            }}
          />
        </div>
      </div>
    ))}
  </div>
);

const GenericChartPlaceholder: React.FC<{ type: string; data: any[]; options: Record<string, any> }> = ({ type }) => (
  <div className="flex items-center justify-center h-full text-neutral-500">
    <div className="text-center">
      <div className="text-4xl mb-2">📊</div>
      <p className="text-sm font-medium">图表类型: {type}</p>
      <p className="text-xs mt-1">（占位符组件，需集成具体图表库）</p>
    </div>
  </div>
);

export default AdvancedChartRenderer;
