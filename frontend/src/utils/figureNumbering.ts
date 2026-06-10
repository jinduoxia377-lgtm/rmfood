/**
 * 图表自动编号系统
 *
 * 功能：
 * - 自动为图表生成编号
 * - 支持章节级编号（如 1.1 图1）
 * - 生成交叉引用
 * - 支持图表标题管理
 */

/**
 * 图表类型
 */
export type FigureType = 'figure' | 'table' | 'equation' | 'listing';

/**
 * 图表项
 */
export interface FigureItem {
  id: string;
  type: FigureType;
  title: string;
  caption?: string;
  chapter?: number;
  section?: number;
  number: number;
}

/**
 * 图表编号配置
 */
export interface NumberingConfig {
  /** 是否包含章节号 */
  includeChapter: boolean;
  /** 章节分隔符 */
  separator: string;
  /** 图表类型名称映射 */
  typeLabels: Record<FigureType, string>;
  /** 编号格式 */
  format: 'arabic' | 'roman' | 'alpha';
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: NumberingConfig = {
  includeChapter: true,
  separator: '.',
  typeLabels: {
    figure: '图',
    table: '表',
    equation: '式',
    listing: '代码',
  },
  format: 'arabic',
};

/**
 * 图表编号管理器
 */
export class FigureNumberingManager {
  private items: FigureItem[] = [];
  private config: NumberingConfig;
  private counters: Record<FigureType, number> = {
    figure: 0,
    table: 0,
    equation: 0,
    listing: 0,
  };

  constructor(config: Partial<NumberingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 添加图表项
   */
  addItem(item: Omit<FigureItem, 'number'>): FigureItem {
    this.counters[item.type]++;

    const newItem: FigureItem = {
      ...item,
      number: this.counters[item.type],
    };

    this.items.push(newItem);
    return newItem;
  }

  /**
   * 获取图表项
   */
  getItem(id: string): FigureItem | undefined {
    return this.items.find(item => item.id === id);
  }

  /**
   * 获取所有图表项
   */
  getItems(type?: FigureType): FigureItem[] {
    if (type) {
      return this.items.filter(item => item.type === type);
    }
    return [...this.items];
  }

  /**
   * 删除图表项
   */
  removeItem(id: string): void {
    const index = this.items.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = this.items[index];
      this.items.splice(index, 1);
      // 重新编号
      if (item) {
        this.renumberAfterDeletion(item.type, index);
      }
    }
  }

  /**
   * 删除后重新编号
   */
  private renumberAfterDeletion(type: FigureType, startIndex: number): void {
    const startItem = this.items[startIndex]
    if (!startItem) return

    const sameTypeItems = this.items
      .map((item, index) => ({ item, originalIndex: index }))
      .filter(({ item }) => item.type === type && item.number > startItem.number);

    sameTypeItems.forEach(({ item }) => {
      item.number--;
    });

    this.counters[type]--;
  }

  /**
   * 生成图表编号
   */
  generateNumber(item: FigureItem): string {
    const { includeChapter, separator, format, typeLabels } = this.config;

    let number = '';

    if (includeChapter && item.chapter !== undefined) {
      number += this.formatNumber(item.chapter, format);
      if (item.section !== undefined) {
        number += separator + this.formatNumber(item.section, format);
      }
      number += separator;
    }

    number += this.formatNumber(item.number, format);

    const label = typeLabels[item.type] || '';
    return `${label}${number}`;
  }

  /**
   * 格式化数字
   */
  private formatNumber(num: number, format: string): string {
    switch (format) {
      case 'roman':
        return this.toRoman(num);
      case 'alpha':
        return this.toAlpha(num);
      default:
        return num.toString();
    }
  }

  /**
   * 转换为罗马数字
   */
  private toRoman(num: number): string {
    const romanNumerals = [
      { value: 1000, symbol: 'M' },
      { value: 900, symbol: 'CM' },
      { value: 500, symbol: 'D' },
      { value: 400, symbol: 'CD' },
      { value: 100, symbol: 'C' },
      { value: 90, symbol: 'XC' },
      { value: 50, symbol: 'L' },
      { value: 40, symbol: 'XL' },
      { value: 10, symbol: 'X' },
      { value: 9, symbol: 'IX' },
      { value: 5, symbol: 'V' },
      { value: 4, symbol: 'IV' },
      { value: 1, symbol: 'I' },
    ];

    let result = '';
    let remaining = num;

    for (const { value, symbol } of romanNumerals) {
      while (remaining >= value) {
        result += symbol;
        remaining -= value;
      }
    }

    return result;
  }

  /**
   * 转换为字母
   */
  private toAlpha(num: number): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    let n = num;

    while (n > 0) {
      n--;
      result = letters[n % 26] + result;
      n = Math.floor(n / 26);
    }

    return result;
  }

  /**
   * 生成交叉引用
   */
  generateCrossReference(id: string, linkText?: string): string {
    const item = this.getItem(id);
    if (!item) {
      return `[引用未找到: ${id}]`;
    }

    const number = this.generateNumber(item);
    const text = linkText || number;

    return `[${text}](#${id})`;
  }

  /**
   * 生成带标题的编号
   */
  generateCaption(item: FigureItem): string {
    const number = this.generateNumber(item);
    const title = item.title || '';
    return `${number} ${title}`;
  }

  /**
   * 生成目录
   */
  generateTableOfFigures(type?: FigureType): string {
    const items = this.getItems(type);
    if (items.length === 0) {
      return '无图表';
    }

    let result = '';
    items.forEach(item => {
      const number = this.generateNumber(item);
      const title = item.title || '未命名';
      result += `${number} ${title}\n`;
    });

    return result.trim();
  }

  /**
   * 重置计数器
   */
  reset(): void {
    this.items = [];
    this.counters = {
      figure: 0,
      table: 0,
      equation: 0,
      listing: 0,
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): Record<FigureType, number> {
    return { ...this.counters };
  }
}

/**
 * 创建全局编号管理器实例
 */
export const createFigureNumberingManager = (
  config?: Partial<NumberingConfig>,
): FigureNumberingManager => {
  return new FigureNumberingManager(config);
};

/**
 * 解析Markdown中的图表
 */
export function parseFiguresFromMarkdown(content: string): FigureItem[] {
  const figures: FigureItem[] = [];

  // 匹配图片
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  let index = 0;

  while ((match = imageRegex.exec(content)) !== null) {
    figures.push({
      id: `figure-${++index}`,
      type: 'figure',
      title: match[1] || `图${index}`,
      caption: match[1],
      number: index,
    });
  }

  // 匹配表格
  const tableRegex = /\|.*\|[\s\S]*?\n\|.*\|/g;
  index = 0;

  while ((match = tableRegex.exec(content)) !== null) {
    figures.push({
      id: `table-${++index}`,
      type: 'table',
      title: `表${index}`,
      number: index,
    });
  }

  // 匹配公式
  const equationRegex = /\$\$(.*?)\$\$/g;
  index = 0;

  while ((match = equationRegex.exec(content)) !== null) {
    figures.push({
      id: `equation-${++index}`,
      type: 'equation',
      title: `式${index}`,
      number: index,
    });
  }

  return figures;
}

/**
 * 为Markdown内容添加图表编号
 */
export function addFigureNumbersToMarkdown(
  content: string,
  manager: FigureNumberingManager,
): string {
  let result = content;

  // 处理图片
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, title, src) => {
    const item = manager.addItem({
      id: `figure-${Date.now()}`,
      type: 'figure',
      title: title || '未命名图片',
    });
    const number = manager.generateNumber(item);
    return `![${number} ${title || ''}](${src})`;
  });

  return result;
}
