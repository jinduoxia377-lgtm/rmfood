/**
 * 文献引用格式生成器
 * 支持GB/T 7714-2015、APA 7th、MLA 9th、IEEE四种学术引用格式
 */

import type { Reference } from '@/types/academic-report';

export type CitationStyle = 'gb-t-7714-2015' | 'gbt7714' | 'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee';

export interface CitationFormatter {
  format(reference: Reference): string;
  formatMultiple(references: Reference[]): string[];
}

/**
 * GB/T 7714-2015 格式生成器
 * 《信息与文献 参考文献著录规则》
 */
class GBT7714Formatter implements CitationFormatter {
  format(reference: Reference): string {
    const authors = reference.authors.join('，');

    switch (reference.type) {
      case 'article':
        return `${authors}. ${reference.title}[J]. ${reference.journal || ''}, ${reference.year}, ${reference.volume || ''}(${reference.issue || ''}):${reference.pages || ''}.${reference.doi ? ` DOI:${reference.doi}` : ''}`;

      case 'book':
        return `${authors}. ${reference.title}[M]. ${reference.publisher || ''}:${reference.publisher || ''}, ${reference.year}.${reference.isbn ? ` ISBN:${reference.isbn}` : ''}`;

      case 'conference':
        return `${authors}. ${reference.title}[C]//${reference.publisher || ''}. ${reference.publisher || ''}, ${reference.year}:${reference.pages || ''}.`;

      case 'thesis':
        return `${authors}. ${reference.title}[D]. ${reference.publisher || ''}:${reference.publisher || ''}, ${reference.year}.`;

      case 'website':
        return `${authors}. ${reference.title}[EB/OL]. ${reference.url || ''}, ${reference.year}-${('0' + (new Date().getMonth() + 1)).slice(-2)}-${('0' + new Date().getDate()).slice(-2)}.`;

      case 'patent':
        return `${authors}. ${reference.title}[P]. ${reference.publisher || ''}:${reference.publisher || ''}, ${reference.year}-${('0' + (new Date().getMonth() + 1)).slice(-2)}-${('0' + new Date().getDate()).slice(-2)}.`;

      default:
        return `${authors}. ${reference.title}. ${reference.year}.`;
    }
  }

  formatMultiple(references: Reference[]): string[] {
    return references.map((ref, index) => `${index + 1} ${this.format(ref)}`);
  }
}

/**
 * APA 7th Edition 格式生成器
 */
class APAFormatter implements CitationFormatter {
  format(reference: Reference): string {
    const formatAuthor = (authors: string[]) => {
      if (authors.length === 1) return authors[0];
      if (authors.length === 2) return authors.join(' & ');
      if (authors.length <= 20) return authors.join(', ').replace(/, ([^,]+)$/, ', & $1');
      return `${authors.slice(0, 19).join(', ')}, ... & ${authors[authors.length - 1]}`;
    };

    const authors = formatAuthor(reference.authors);

    switch (reference.type) {
      case 'article':
        return `${authors}. (${reference.year}). ${reference.title}. ${reference.journal || ''}, ${reference.volume || ''}(${reference.issue || ''}), ${reference.pages || ''}. ${reference.doi ? `https://doi.org/${reference.doi}` : ''}`;

      case 'book':
        return `${authors}. (${reference.year}). ${reference.title}. ${reference.publisher || ''}.${reference.isbn ? ` https://isbnsearch.org/isbn/${reference.isbn}` : ''}`;

      case 'conference':
        return `${authors}. (${reference.year}). ${reference.title}. In ${reference.publisher || ''} (Ed.), ${reference.title} (pp. ${reference.pages || ''}). ${reference.publisher || ''}.`;

      case 'thesis':
        return `${authors}. (${reference.year}). ${reference.title} [${reference.type === 'thesis' ? 'Doctoral dissertation' : 'Master\'s thesis'}]. ${reference.publisher || ''}.`;

      case 'website':
        return `${authors}. (${reference.year}). ${reference.title}. ${reference.url || ''}`;

      case 'patent':
        return `${authors}. (${reference.year}). ${reference.title} [Patent]. ${reference.publisher || ''}.`;

      default:
        return `${authors}. (${reference.year}). ${reference.title}.`;
    }
  }

  formatMultiple(references: Reference[]): string[] {
    const sorted = [...references].sort((a, b) => {
      const aFirst = a.authors[0] || '';
      const bFirst = b.authors[0] || '';
      return aFirst.localeCompare(bFirst);
    });
    return sorted.map((ref, index) => `${index + 1}. ${this.format(ref)}`);
  }
}

/**
 * MLA 9th Edition 格式生成器
 */
class MLAFormatter implements CitationFormatter {
  format(reference: Reference): string {
    const formatAuthor = (authors: string[]) => {
      if (authors.length === 0) return '';
      const firstAuthor = authors[0].split(',').reverse().join(' ').trim();
      if (authors.length === 1) return firstAuthor;
      const others = authors.slice(1).map(a => a.split(',').reverse().join(' ').trim());
      return `${firstAuthor}, ${others.join(', ')}`;
    };

    const authors = formatAuthor(reference.authors);

    switch (reference.type) {
      case 'article':
        return `${authors}. "${reference.title}." ${reference.journal || ''}, vol. ${reference.volume || ''}, no. ${reference.issue || ''}, ${reference.year}, pp. ${reference.pages || ''}.${reference.doi ? ` DOI: ${reference.doi}` : ''}`;

      case 'book':
        return `${authors}. ${reference.title}. ${reference.publisher || ''}, ${reference.year}.${reference.isbn ? ` ISBN ${reference.isbn}` : ''}`;

      case 'conference':
        return `${authors}. "${reference.title}." ${reference.publisher || ''}, ${reference.year}, pp. ${reference.pages || ''}.`;

      case 'thesis':
        return `${authors}. ${reference.title}. ${reference.publisher || ''}, ${reference.year}.`;

      case 'website':
        return `${authors}. "${reference.title}." ${reference.publisher || ''}, ${reference.year}, ${reference.url || ''}. Accessed ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`;

      case 'patent':
        return `${authors}. ${reference.title}. ${reference.publisher || ''}, ${reference.year}.`;

      default:
        return `${authors}. ${reference.title}. ${reference.year}.`;
    }
  }

  formatMultiple(references: Reference[]): string[] {
    const sorted = [...references].sort((a, b) => {
      const aFirst = a.authors[0] || '';
      const bFirst = b.authors[0] || '';
      return aFirst.localeCompare(bFirst);
    });
    return sorted.map((ref, index) => `${index + 1}. ${this.format(ref)}`);
  }
}

/**
 * IEEE 格式生成器
 */
class IEEEFormatter implements CitationFormatter {
  format(reference: Reference): string {
    const formatAuthor = (authors: string[]) => {
      return authors.map(a => {
        const parts = a.split(',');
        if (parts.length >= 2) {
          return `${parts[0]}, ${parts.slice(1).join(' ').split(' ').map(p => p.charAt(0) + '.').join('')}`;
        }
        return a;
      }).join(', ');
    };

    const authors = formatAuthor(reference.authors);

    switch (reference.type) {
      case 'article':
        return `[1] ${authors}, "${reference.title}", ${reference.journal || ''}, vol. ${reference.volume || ''}, no. ${reference.issue || ''}, pp. ${reference.pages || ''}, ${reference.year}.${reference.doi ? ` DOI: ${reference.doi}` : ''}`;

      case 'book':
        return `[1] ${authors}, ${reference.title}. ${reference.publisher || ''}, ${reference.year}.${reference.isbn ? ` ISBN: ${reference.isbn}` : ''}`;

      case 'conference':
        return `[1] ${authors}, "${reference.title}", in ${reference.publisher || ''}, ${reference.year}, pp. ${reference.pages || ''}.`;

      case 'thesis':
        return `[1] ${authors}, ${reference.title}. ${reference.publisher || ''}, ${reference.year}.`;

      case 'website':
        return `[1] ${authors}, "${reference.title}", ${reference.url || ''}. Accessed: ${new Date().toISOString().split('T')[0]}.`;

      case 'patent':
        return `[1] ${authors}, "${reference.title}", ${reference.publisher || ''}, ${reference.year}.`;

      default:
        return `[1] ${authors}, ${reference.title}, ${reference.year}.`;
    }
  }

  formatMultiple(references: Reference[]): string[] {
    return references.map((ref, index) => {
      const formatted = this.format(ref);
      return formatted.replace('[1]', `[${index + 1}]`);
    });
  }
}

/**
 * Chicago 格式生成器 (17th Edition)
 * Author-Date 和 Notes-Bibliography 两种风格
 */
class ChicagoFormatter implements CitationFormatter {
  format(reference: Reference): string {
    const formatAuthor = (authors: string[]) => {
      if (authors.length === 0) return '';
      if (authors.length === 1) return authors[0];
      if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
      if (authors.length === 3) return `${authors[0]}, ${authors[1]}, and ${authors[2]}`;
      return `${authors[0]} et al.`;
    };

    const authors = formatAuthor(reference.authors);

    switch (reference.type) {
      case 'article':
        return `${authors}. "${reference.title}." ${reference.journal || ''} ${reference.volume || ''}${reference.issue ? ', no. ' + reference.issue : ''} (${reference.year}): ${reference.pages || ''}.${reference.doi ? ` https://doi.org/${reference.doi}` : ''}`;

      case 'book':
        return `${authors}. ${reference.title}. ${reference.publisher || ''}, ${reference.year}.${reference.isbn ? ` ISBN: ${reference.isbn}` : ''}`;

      case 'conference':
        return `${authors}. "${reference.title}." In ${reference.publisher || ''}, ${reference.year}, ${reference.pages || ''}.`;

      case 'thesis':
        return `${authors}. "${reference.title}." ${reference.type === 'thesis' ? 'PhD dissertation' : 'Master\'s thesis'}, ${reference.publisher || ''}, ${reference.year}.`;

      case 'website':
        return `${authors}. "${reference.title}." Accessed ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. ${reference.url || ''}.`;

      case 'patent':
        return `${authors}. "${reference.title}." Patent ${reference.publisher || ''}, ${reference.year}.`;

      default:
        return `${authors}. "${reference.title}." ${reference.year}.`;
    }
  }

  formatMultiple(references: Reference[]): string[] {
    const sorted = [...references].sort((a, b) => {
      const aFirst = a.authors[0] || '';
      const bFirst = b.authors[0] || '';
      return aFirst.localeCompare(bFirst);
    });
    return sorted.map((ref, index) => `${index + 1}. ${this.format(ref)}`);
  }
}

/**
 * Harvard 格式生成器
 */
class HarvardFormatter implements CitationFormatter {
  format(reference: Reference): string {
    const formatAuthor = (authors: string[]) => {
      if (authors.length === 0) return '';
      if (authors.length === 1) return authors[0];
      if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
      if (authors.length === 3) return `${authors[0]}, ${authors[1]} and ${authors[2]}`;
      return `${authors[0]} et al.`;
    };

    const authors = formatAuthor(reference.authors);

    switch (reference.type) {
      case 'article':
        return `${authors} (${reference.year}) '${reference.title}', ${reference.journal || ''}, ${reference.volume || ''}${reference.issue ? `(${reference.issue})` : ''}, pp. ${reference.pages || ''}.${reference.doi ? ` DOI: ${reference.doi}` : ''}`;

      case 'book':
        return `${authors} (${reference.year}) ${reference.title}. ${reference.publisher || ''}.${reference.isbn ? ` ISBN: ${reference.isbn}` : ''}`;

      case 'conference':
        return `${authors} (${reference.year}) '${reference.title}', ${reference.publisher || ''}, ${reference.year}, pp. ${reference.pages || ''}.`;

      case 'thesis':
        return `${authors} (${reference.year}) ${reference.title}. ${reference.type === 'thesis' ? 'PhD thesis' : 'Master\'s thesis'}, ${reference.publisher || ''}.`;

      case 'website':
        return `${authors} (${reference.year}) ${reference.title}. Available at: ${reference.url || ''} (Accessed: ${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}).`;

      case 'patent':
        return `${authors} (${reference.year}) ${reference.title}. Patent, ${reference.publisher || ''}.`;

      default:
        return `${authors} (${reference.year}) ${reference.title}.`;
    }
  }

  formatMultiple(references: Reference[]): string[] {
    const sorted = [...references].sort((a, b) => {
      const aFirst = a.authors[0] || '';
      const bFirst = b.authors[0] || '';
      return aFirst.localeCompare(bFirst);
    });
    return sorted.map((ref, index) => `${index + 1}. ${this.format(ref)}`);
  }
}

/**
 * 引用格式生成器工厂
 */
export class CitationFormatterFactory {
  static create(style: CitationStyle): CitationFormatter {
    switch (style) {
      case 'gb-t-7714-2015':
      case 'gbt7714':
        return new GBT7714Formatter();
      case 'apa':
        return new APAFormatter();
      case 'mla':
        return new MLAFormatter();
      case 'chicago':
        return new ChicagoFormatter();
      case 'harvard':
        return new HarvardFormatter();
      case 'ieee':
        return new IEEEFormatter();
      default:
        return new APAFormatter();
    }
  }

  static format(reference: Reference, style: CitationStyle): string {
    return this.create(style).format(reference);
  }

  static formatMultiple(references: Reference[], style: CitationStyle): string[] {
    return this.create(style).formatMultiple(references);
  }
}

export const CITATION_STYLES: { value: CitationStyle; label: string; description: string }[] = [
  { value: 'gb-t-7714-2015', label: 'GB/T 7714-2015', description: '《信息与文献 参考文献著录规则》' },
  { value: 'gbt7714', label: 'GB/T 7714', description: '参考文献著录规则（简化版）' },
  { value: 'apa', label: 'APA 7th', description: '美国心理学会格式' },
  { value: 'mla', label: 'MLA 9th', description: '现代语言协会格式' },
  { value: 'chicago', label: 'Chicago 17th', description: '芝加哥格式（第17版）' },
  { value: 'harvard', label: 'Harvard', description: '哈佛格式' },
  { value: 'ieee', label: 'IEEE', description: '电气电子工程师学会格式' },
];
