/**
 * 图表自动编号系统
 * 支持图、表、公式、代码块的自动编号与交叉引用
 */

export type ElementType = 'figure' | 'table' | 'formula' | 'code';

export interface NumberedElement {
  id: string;
  type: ElementType;
  caption: string;
  number: string;
  section?: string;
}

export interface CrossReference {
  elementId: string;
  elementType: ElementType;
  referenceText: string;
}

/**
 * 编号管理器
 */
export class FigureNumberingManager {
  private elements = new Map<string, NumberedElement>();
  private counters: Record<ElementType, number> = {
    figure: 0,
    table: 0,
    formula: 0,
    code: 0,
  };
  private useSectionNumbering = false;
  private currentSection = '';

  /**
   * 设置是否使用章节编号
   */
  setSectionNumbering(enabled: boolean): void {
    this.useSectionNumbering = enabled;
  }

  /**
   * 设置当前章节
   */
  setCurrentSection(section: string): void {
    this.currentSection = section;
  }

  /**
   * 添加元素并生成编号
   */
  addElement(id: string, type: ElementType, caption: string): NumberedElement {
    this.counters[type]++;

    const number = this.useSectionNumbering && this.currentSection
      ? `${this.currentSection}.${this.counters[type]}`
      : `${this.counters[type]}`;

    const element: NumberedElement = {
      id,
      type,
      caption,
      number,
      section: this.currentSection || undefined,
    };

    this.elements.set(id, element);
    return element;
  }

  /**
   * 更新元素
   */
  updateElement(id: string, updates: Partial<Pick<NumberedElement, 'caption' | 'section'>>): void {
    const element = this.elements.get(id);
    if (element) {
      if (updates.caption !== undefined) {
        element.caption = updates.caption;
      }
      if (updates.section !== undefined) {
        element.section = updates.section;
      }
    }
  }

  /**
   * 删除元素
   */
  removeElement(id: string): boolean {
    const element = this.elements.get(id);
    if (!element) return false;

    this.elements.delete(id);

    // 如果使用章节编号，需要重新编号该章节的元素
    if (this.useSectionNumbering) {
      this.renumberSection(element.section || '');
    } else {
      this.renumberAll();
    }

    return true;
  }

  /**
   * 获取元素
   */
  getElement(id: string): NumberedElement | undefined {
    return this.elements.get(id);
  }

  /**
   * 获取指定类型的所有元素
   */
  getElementsByType(type: ElementType): NumberedElement[] {
    return Array.from(this.elements.values()).filter(e => e.type === type);
  }

  /**
   * 获取所有元素
   */
  getAllElements(): NumberedElement[] {
    return Array.from(this.elements.values());
  }

  /**
   * 生成交叉引用文本
   */
  getCrossReference(id: string): string {
    const element = this.elements.get(id);
    if (!element) return '';

    const typeLabel = this.getTypeLabel(element.type);
    return `${typeLabel}${element.number}`;
  }

  /**
   * 生成交叉引用（带说明）
   */
  getCrossReferenceWithText(id: string, text?: string): string {
    const reference = this.getCrossReference(id);
    if (!reference) return '';

    if (text) {
      return `${text}（${reference}）`;
    }
    return reference;
  }

  /**
   * 生成图目录
   */
  generateFigureList(): string {
    const figures = this.getElementsByType('figure');
    if (figures.length === 0) return '';

    return figures.map(f => {
      return `${f.number} ${f.caption}`;
    }).join('\n');
  }

  /**
   * 生成表目录
   */
  generateTableList(): string {
    const tables = this.getElementsByType('table');
    if (tables.length === 0) return '';

    return tables.map(t => {
      return `${t.number} ${t.caption}`;
    }).join('\n');
  }

  /**
   * 生成公式目录
   */
  generateFormulaList(): string {
    const formulas = this.getElementsByType('formula');
    if (formulas.length === 0) return '';

    return formulas.map(f => {
      return `${f.number}`;
    }).join('\n');
  }

  /**
   * 重置计数器
   */
  reset(): void {
    this.elements.clear();
    this.counters = {
      figure: 0,
      table: 0,
      formula: 0,
      code: 0,
    };
    this.currentSection = '';
  }

  /**
   * 获取类型标签
   */
  private getTypeLabel(type: ElementType): string {
    switch (type) {
      case 'figure':
        return '图';
      case 'table':
        return '表';
      case 'formula':
        return '式';
      case 'code':
        return '代码';
      default:
        return '';
    }
  }

  /**
   * 重新编号指定章节
   */
  private renumberSection(section: string): void {
    const sectionElements = Array.from(this.elements.values())
      .filter(e => e.section === section);

    const typeCounters: Record<ElementType, number> = {
      figure: 0,
      table: 0,
      formula: 0,
      code: 0,
    };

    sectionElements.forEach(element => {
      typeCounters[element.type]++;
      element.number = `${section}.${typeCounters[element.type]}`;
    });
  }

  /**
   * 重新编号所有元素
   */
  private renumberAll(): void {
    const newCounters: Record<ElementType, number> = {
      figure: 0,
      table: 0,
      formula: 0,
      code: 0,
    };

    this.elements.forEach(element => {
      newCounters[element.type]++;
      element.number = `${newCounters[element.type]}`;
    });

    this.counters = newCounters;
  }
}

/**
 * 创建编号管理器实例
 */
export function createNumberingManager(): FigureNumberingManager {
  return new FigureNumberingManager();
}

/**
 * 编号格式常量
 */
export const NUMBERING_FORMATS = {
  ARABIC: 'arabic',      // 1, 2, 3...
  ROMAN: 'roman',        // I, II, III...
  ROMAN_LOWER: 'roman_lower', // i, ii, iii...
  ALPHA: 'alpha',        // A, B, C...
  ALPHA_LOWER: 'alpha_lower', // a, b, c...
} as const;

export type NumberingFormat = typeof NUMBERING_FORMATS[keyof typeof NUMBERING_FORMATS];
