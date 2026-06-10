// Jest transformations for ESM modules like D3

export const mockD3 = {
  select: jest.fn(),
  selectAll: jest.fn(),
  transition: jest.fn(),
  easeLinear: jest.fn(),
  easeCubicInOut: jest.fn(),
  scaleLinear: jest.fn((): unknown => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    call: jest.fn(),
  })),
  scaleOrdinal: jest.fn((): unknown => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
  })),
  scaleBand: jest.fn((): unknown => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    bandwidth: jest.fn(),
  })),
  axisBottom: jest.fn((): unknown => ({
    scale: jest.fn().mockReturnThis(),
    ticks: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnThis(),
  })),
  axisLeft: jest.fn((): unknown => ({
    scale: jest.fn().mockReturnThis(),
    ticks: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnThis(),
  })),
  line: jest.fn((): unknown => ({
    x: jest.fn().mockReturnThis(),
    y: jest.fn().mockReturnThis(),
    curve: jest.fn().mockReturnThis(),
  })),
  arc: jest.fn((): unknown => ({
    innerRadius: jest.fn().mockReturnThis(),
    outerRadius: jest.fn().mockReturnThis(),
  })),
  pie: jest.fn((): unknown => ({
    value: jest.fn().mockReturnThis(),
  })),
  max: jest.fn(),
  min: jest.fn(),
  extent: jest.fn(),
  range: jest.fn(),
  keys: jest.fn(),
  values: jest.fn(),
  entries: jest.fn(),
  group: jest.fn(),
  rollup: jest.fn(),
  bin: jest.fn(),
  treemap: jest.fn(),
  hierarchy: jest.fn(),
  stratify: jest.fn(),
  schemeCategory10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
}

export default mockD3
