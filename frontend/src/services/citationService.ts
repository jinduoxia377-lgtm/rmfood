/**
 * 引文管理服务
 * 实现参考文献格式生成和引用管理功能
 * 支持GB/T 7714-2015、APA 7th、MLA 9th、IEEE等多种格式
 */
import type { Citation, CitationType } from '@/types/academicReport';

// 引用格式
export type CitationStyle = 'gbt7714' | 'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee';

export class CitationService {
 private citations: Citation[] = [];
 private citationIdMap = new Map<string, number>();

 constructor(citations: Citation[] = []) {
 this.citations = citations;
 this.buildIdMap();
 }

 private buildIdMap(): void {
 this.citationIdMap.clear();
 this.citations.forEach((citation, index) => {
 this.citationIdMap.set(citation.id, index + 1);
 });
 }

 // 添加引文
 addCitation(citation: Omit<Citation, 'id'>): Citation {
 const newCitation: Citation = {
 ...citation,
 id: `cit-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
 };
 this.citations.push(newCitation);
 this.buildIdMap();
 return newCitation;
 }

 // 生成文内引用标记（支持多种格式）
 generateInTextCitation(citationIds: string[], style: CitationStyle = 'gbt7714'): string {
 const numbers = citationIds
 .map(id => this.citationIdMap.get(id))
 .filter(n => n !== undefined)
 .sort((a, b) => (a || 0) - (b || 0));

 if (numbers.length === 0) return '';

 switch (style) {
 case 'gbt7714':
 case 'ieee':
 return `[${numbers.join(',')}]`;
 case 'apa':
 return `(${numbers.join(', ')})`;
 case 'mla':
 return `(${numbers.join(', ')})`;
 default:
 return `[${numbers.join(',')}]`;
 }
 }

 // 生成多个引文的文内引用（按作者-年份格式）
 generateAuthorYearCitation(citationIds: string[]): string {
 const citations = citationIds
 .map(id => this.citations.find(c => c.id === id))
 .filter(c => c !== undefined);

 if (citations.length === 0) return '';

 const formatted = citations.map(c => {
 const authors = c.authors.length > 1
 ? `${c.authors[0]} et al.`
 : c.authors[0];
 return `${authors} (${c.year})`;
 });

 return formatted.join(', ');
 }

 // 验证引文数据完整性
 validateCitation(citation: Partial<Citation>): { valid: boolean; errors: string[] } {
 const errors: string[] = [];

 if (!citation.title?.trim()) {
 errors.push('标题不能为空');
 }

 if (!citation.authors || citation.authors.length === 0) {
 errors.push('作者不能为空');
 }

 if (!citation.year || isNaN(citation.year)) {
 errors.push('年份必须是有效的数字');
 }

 if (!citation.type) {
 errors.push('引文类型不能为空');
 }

 return {
 valid: errors.length === 0,
 errors,
 };
 }

 // 更新引文
 updateCitation(id: string, updates: Partial<Omit<Citation, 'id'>>): boolean {
 const index = this.citations.findIndex(c => c.id === id);
 if (index !== -1) {
 this.citations[index] = { ...this.citations[index], ...updates };
 return true;
 }
 return false;
 }

 // 删除引文
 deleteCitation(id: string): boolean {
 const initialLength = this.citations.length;
 this.citations = this.citations.filter(c => c.id !== id);
 return this.citations.length !== initialLength;
 }

 // 获取所有引文
 getCitations(): Citation[] {
 return [...this.citations];
 }

 // 获取单个引文
 getCitation(id: string): Citation | undefined {
 return this.citations.find(c => c.id === id);
 }

 // 生成引用标记
 generateCitationMark(id: string): string {
 const index = this.citations.findIndex(c => c.id === id);
 return index !== -1 ? `[${index + 1}]` : '[?]';
 }

 // Chicago 格式
 private generateChicagoReferences(): string[] {
 const sortedCitations = [...this.citations].sort((a, b) => {
 const aFirstAuthor = a.authors[0] || '';
 const bFirstAuthor = b.authors[0] || '';
 return aFirstAuthor.localeCompare(bFirstAuthor, 'en-US');
});

return sortedCitations.map((citation) => {
 const authors = citation.authors.join(', ');
 const year = citation.year;

 switch (citation.type) {
 case 'journal-article':
 return `${authors}. "${citation.title}." *${citation.journal || ''}* ${citation.volume || ''} (${year}): ${citation.pages || ''}. ${citation.doi ? `https://doi.org/${citation.doi}` : ''}`;

 case 'book':
 return `${authors}. *${citation.title}*. ${citation.publisher || ''}, ${year}.${citation.isbn ? ` ISBN: ${citation.isbn}` : ''}`;

 case 'book-chapter':
 return `${authors}. "${citation.title}." In *${citation.journal || 'Book Title'}*, edited by Editor, ${citation.pages || ''}. ${citation.publisher || ''}, ${year}.`;

 case 'conference-proceeding':
 return `${authors}. "${citation.title}." Paper presented at ${citation.journal || 'Conference'}, ${year}.`;

 case 'thesis':
 return `${authors}. "${citation.title}." PhD diss., ${citation.publisher || 'University'}, ${year}.`;

 case 'report':
 return `${authors}. *${citation.title}*. ${citation.publisher || 'Organization'}, ${year}.`;

 case 'web-page':
 return `${authors}. "${citation.title}." Accessed ${citation.accessedDate || year}. ${citation.url || ''}.`;

 default:
 return `${authors}. "${citation.title}." ${year}.`;
 }
 });
 }

 // Harvard 格式
 private generateHarvardReferences(): string[] {
 const sortedCitations = [...this.citations].sort((a, b) => {
 const aFirstAuthor = a.authors[0] || '';
 const bFirstAuthor = b.authors[0] || '';
 return aFirstAuthor.localeCompare(bFirstAuthor, 'en-US');
 });

 return sortedCitations.map((citation) => {
 const formatAuthor = (authors: string[]) => {
 if (authors.length === 1) return authors[0];
 if (authors.length <= 3) return `${authors.slice(0, -1).join(', ')} and ${authors[authors.length - 1]}`;
 return `${authors[0]} et al.`;
 };

 const authors = formatAuthor(citation.authors);
 const year = citation.year;

 switch (citation.type) {
 case 'journal-article':
 return `${authors} (${year}) '${citation.title}', *${citation.journal || ''}*, ${citation.volume || ''}(${citation.pages || ''}). ${citation.doi ? `doi: ${citation.doi}` : ''}`;

 case 'book':
 return `${authors} (${year}) *${citation.title}*. ${citation.publisher || ''}.${citation.isbn ? ` ISBN: ${citation.isbn}` : ''}`;

 case 'book-chapter':
 return `${authors} (${year}) '${citation.title}' in ${citation.journal || 'Editor'} (ed.) *Book Title*. ${citation.publisher || ''}, pp. ${citation.pages || ''}.`;

 case 'conference-proceeding':
 return `${authors} (${year}) '${citation.title}', *${citation.journal || 'Conference'}*, ${year}, pp. ${citation.pages || ''}.`;

 case 'thesis':
 return `${authors} (${year}) *${citation.title}*. PhD thesis. ${citation.publisher || 'University'}.`;

 case 'report':
 return `${authors} (${year}) *${citation.title}*. ${citation.publisher || 'Organization'}.`;

 case 'web-page':
 return `${authors} (${year}) ${citation.title}. Available at: ${citation.url || ''} (Accessed: ${citation.accessedDate || year}).`;

 default:
 return `${authors} (${year}) ${citation.title}.`;
 }
 });
 }

 // 生成参考文献列表
  generateReferences(style: CitationStyle = 'gbt7714'): string[] {
    switch (style) {
      case 'gbt7714':
        return this.generateGBT7714References();
      case 'apa':
        return this.generateAPA7References();
      case 'mla':
        return this.generateMLA9References();
      case 'ieee':
        return this.generateIEEEReferences();
      case 'chicago':
        return this.generateChicagoReferences();
      case 'harvard':
        return this.generateHarvardReferences();
      default:
        return this.generateGBT7714References();
    }
  }

 // GB/T 7714-2015 格式
 private generateGBT7714References(): string[] {
 const sortedCitations = [...this.citations].sort((a, b) => {
 // 按作者首字母排序
 const aFirstAuthor = a.authors[0] || '';
 const bFirstAuthor = b.authors[0] || '';
 return aFirstAuthor.localeCompare(bFirstAuthor, 'zh-CN');
});

return sortedCitations.map((citation, index) => {
 const authors = citation.authors.join('，');
 const year = citation.year;

 switch (citation.type) {
 case 'journal-article':
 return `${index + 1}. ${authors}. ${citation.title}[J]. ${citation.journal || ''}, ${year}, ${citation.volume || ''}(${citation.pages || ''}).${citation.doi ? ` DOI:${citation.doi}` : ''}`;

 case 'book':
 return `${index + 1}. ${authors}. ${citation.title}[M]. ${citation.publisher || ''}: ${citation.year}.${citation.isbn ? ` ISBN:${citation.isbn}` : ''}`;

 case 'book-chapter':
 return `${index + 1}. ${authors}. ${citation.title}[M]//${citation.journal || '编者'}. ${citation.publisher || ''}: ${citation.year}: ${citation.pages || ''}.`;

 case 'conference-proceeding':
 return `${index + 1}. ${authors}. ${citation.title}[C]//${citation.journal || '会议名称'}. ${citation.publisher || ''}: ${citation.year}: ${citation.pages || ''}.`;

 case 'thesis':
 return `${index + 1}. ${authors}. ${citation.title}[D]. ${citation.publisher || '学校名称'}: ${citation.year}.`;

 case 'report':
 return `${index + 1}. ${authors}. ${citation.title}[R]. ${citation.publisher || '机构名称'}: ${citation.year}.`;

 case 'web-page':
 return `${index + 1}. ${authors}. ${citation.title}[EB/OL]. ${citation.url || ''}, ${citation.accessedDate || year}.`;

 default:
 return `${index + 1}. ${authors}. ${citation.title}[Z]. ${citation.year}.`;
 }
 });
 }

 // APA 7th Edition 格式
 private generateAPA7References(): string[] {
 const sortedCitations = [...this.citations].sort((a, b) => {
 const aFirstAuthor = a.authors[0] || '';
 const bFirstAuthor = b.authors[0] || '';
 return aFirstAuthor.localeCompare(bFirstAuthor, 'en-US');
 });

 return sortedCitations.map((citation) => {
 const formatAuthor = (authors: string[]) => {
 if (authors.length === 1) return authors[0];
 if (authors.length <= 2) return authors.join(' & ');
 if (authors.length <= 20) return `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;
 return `${authors.slice(0, 19).join(', ')}, ... ${authors[authors.length - 1]}`;
 };

 const authors = formatAuthor(citation.authors);
 const year = citation.year;

 switch (citation.type) {
 case 'journal-article':
 return `${authors} (${year}). ${citation.title}. *${citation.journal || ''}*, ${citation.volume || ''}(${citation.pages || ''}). ${citation.doi ? `https://doi.org/${citation.doi}` : ''}`;

 case 'book':
 return `${authors} (${year}). *${citation.title}*. ${citation.publisher || ''}.${citation.isbn ? ` ISBN: ${citation.isbn}` : ''}`;

 case 'book-chapter':
 return `${authors} (${year}). ${citation.title}. In ${citation.journal || 'Editor'} (Ed.), *Title* (pp. ${citation.pages || ''}). ${citation.publisher || ''}.`;

 case 'conference-proceeding':
 return `${authors} (${year}). ${citation.title}. In *${citation.journal || ''}* (pp. ${citation.pages || ''}). ${citation.publisher || ''}.`;

 case 'thesis':
 return `${authors} (${year}). *${citation.title}* [${citation.type === 'thesis' ? 'Doctoral dissertation' : 'Master\'s thesis'}]. ${citation.publisher || 'University Name'}.`;

 case 'report':
 return `${authors} (${year}). *${citation.title}* [Report]. ${citation.publisher || 'Organization'}.`;

 case 'web-page':
 return `${authors} (${year}). ${citation.title}. ${citation.url || ''}. Retrieved ${citation.accessedDate || 'n.d.'}.`;

 default:
 return `${authors} (${year}). ${citation.title}.`;
 }
 });
 }

 // MLA 9th Edition 格式
 private generateMLA9References(): string[] {
 const sortedCitations = [...this.citations].sort((a, b) => {
 const aFirstAuthor = a.authors[0] || '';
 const bFirstAuthor = b.authors[0] || '';
 return aFirstAuthor.localeCompare(bFirstAuthor, 'en-US');
 });

 return sortedCitations.map((citation) => {
 const formatAuthor = (authors: string[]) => {
 if (authors.length === 0) return 'Author Unknown';
 const firstAuthor = authors[0].split(', ').reverse().join(' ') || authors[0];
 if (authors.length === 1) return firstAuthor;
 return `${firstAuthor}, ${authors.slice(1).join(', ')}`;
 };

 const authors = formatAuthor(citation.authors);

 switch (citation.type) {
 case 'journal-article':
 return `${authors}. "${citation.title}." *${citation.journal || ''}*, vol. ${citation.volume || ''}, ${citation.year}, pp. ${citation.pages || ''}. ${citation.doi ? `DOI: ${citation.doi}` : ''}`;

 case 'book':
 return `${authors}. *${citation.title}*. ${citation.publisher || ''}, ${citation.year}.${citation.isbn ? ` ISBN ${citation.isbn}` : ''}`;

 case 'book-chapter':
 return `${authors}. "${citation.title}." *${citation.journal || 'Book Title'}*, edited by Editor, ${citation.publisher || ''}, ${citation.year}, pp. ${citation.pages || ''}.`;

 case 'conference-proceeding':
 return `${authors}. "${citation.title}." *${citation.journal || ''}*, ${citation.year}, pp. ${citation.pages || ''}.`;

 case 'thesis':
 return `${authors}. *${citation.title}*. ${citation.publisher || 'University'}, ${citation.year}.`;

 case 'report':
 return `${authors}. *${citation.title}*. ${citation.publisher || 'Organization'}, ${citation.year}.`;

 case 'web-page':
 return `${authors}. "${citation.title}." *Website Title*, ${citation.url || ''}, ${citation.accessedDate || citation.year}.`;

 default:
 return `${authors}. ${citation.title}. ${citation.year}.`;
 }
 });
 }

 // IEEE 格式
 private generateIEEEReferences(): string[] {
 const sortedCitations = [...this.citations].sort((a, b) => {
 const aFirstAuthor = a.authors[0] || '';
 const bFirstAuthor = b.authors[0] || '';
 return aFirstAuthor.localeCompare(bFirstAuthor, 'en-US');
 });

 return sortedCitations.map((citation, index) => {
 const formatAuthor = (authors: string[]) => {
 if (authors.length === 0) return 'Anonymous';
 return authors.map(a => {
 const parts = a.split(' ');
 if (parts.length > 1) {
 return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
 }
 return a;
 }).join(', ');
 };

 const authors = formatAuthor(citation.authors);

 switch (citation.type) {
 case 'journal-article':
 return `[${index + 1}] ${authors}, "${citation.title}", *${citation.journal || ''}*, vol. ${citation.volume || ''}, no. 0, pp. ${citation.pages || ''}, ${citation.year}. ${citation.doi ? `doi: ${citation.doi}` : ''}`;

 case 'book':
 return `[${index + 1}] ${authors}, *${citation.title}*. ${citation.publisher || ''}, ${citation.year}.${citation.isbn ? ` ISBN: ${citation.isbn}` : ''}`;

 case 'book-chapter':
 return `[${index + 1}] ${authors}, "${citation.title}", in ${citation.journal || 'Editor'}, Ed., *Book Title*. ${citation.publisher || ''}, ${citation.year}, pp. ${citation.pages || ''}.`;

 case 'conference-proceeding':
 return `[${index + 1}] ${authors}, "${citation.title}", in *${citation.journal || ''}*, ${citation.year}, pp. ${citation.pages || ''}.`;

 case 'thesis':
 return `[${index + 1}] ${authors}, *${citation.title}* [${citation.type === 'thesis' ? 'Ph.D. dissertation' : 'M.S. thesis'}]. ${citation.publisher || 'University'}, ${citation.year}.`;

 case 'report':
 return `[${index + 1}] ${authors}, *${citation.title}* [Tech. Rep.]. ${citation.publisher || 'Organization'}, ${citation.year}.`;

 case 'web-page':
 return `[${index + 1}] ${authors}, "${citation.title}." [Online]. Available: ${citation.url || ''}. [Accessed: ${citation.accessedDate || Date.now().toString()}].`;

 default:
 return `[${index + 1}] ${authors}, ${citation.title}, ${citation.year}.`;
 }
 });
 }

 // 导入BibTeX
 importBibTeX(content: string): Citation[] {
 const entries = content.split('@');
 const imported: Citation[] = [];

 for (const entry of entries) {
 if (!entry.trim()) continue;

 const typeMatch = /^(\w+)\s*\{/.exec(entry);
 if (!typeMatch) continue;

 const bibType = typeMatch[1].toLowerCase() as CitationType;
			const contentMatch = /\{([^}]+)\}/.exec(entry);
			if (!contentMatch) continue;

			const fields = contentMatch[1].split(/,\s*/);
 const citation: Partial<Citation> = {
 type: bibType,
 authors: [],
 title: '',
 year: new Date().getFullYear(),
 };

 for (const field of fields) {
 const [key, value] = field.split(/\s*=\s*/);
 if (!key || !value) continue;

 const cleanValue = value.replace(/["'{}]/g, '').trim();

 switch (key.toLowerCase()) {
 case 'author':
 citation.authors = cleanValue.split(/\s+and\s+/).map(a => a.trim());
 break;
 case 'title':
 citation.title = cleanValue;
 break;
 case 'journal':
 case 'booktitle':
 citation.journal = cleanValue;
 break;
 case 'year':
 citation.year = parseInt(cleanValue) || new Date().getFullYear();
 break;
 case 'volume':
 citation.volume = cleanValue;
 break;
 case 'pages':
 citation.pages = cleanValue;
 break;
 case 'doi':
 citation.doi = cleanValue;
 break;
 case 'isbn':
 citation.isbn = cleanValue;
 break;
 case 'publisher':
 citation.publisher = cleanValue;
 break;
 case 'url':
 citation.url = cleanValue;
 break;
 }
 }

 if (citation.title && citation.authors && citation.authors.length > 0) {
 imported.push(this.addCitation(citation as Omit<Citation, 'id'>));
 }
 }

 return imported;
 }

 // 导出BibTeX
 exportBibTeX(): string {
 return this.citations.map(citation => {
 const type = citation.type.toUpperCase().replace('-', '{-}');
 const fields: string[] = [];

 fields.push(`author = "${citation.authors.join(' and ')}"`);
 fields.push(`title = "${citation.title}"`);
 if (citation.journal) fields.push(`journal = "${citation.journal}"`);
 if (citation.year) fields.push(`year = "${citation.year}"`);
 if (citation.volume) fields.push(`volume = "${citation.volume}"`);
 if (citation.pages) fields.push(`pages = "${citation.pages}"`);
 if (citation.doi) fields.push(`doi = "${citation.doi}"`);
 if (citation.isbn) fields.push(`isbn = "${citation.isbn}"`);
 if (citation.publisher) fields.push(`publisher = "${citation.publisher}"`);
 if (citation.url) fields.push(`url = "${citation.url}"`);

 return `@${type}{${citation.id},\n ${fields.join(',\n ')}\n}`;
 }).join('\n\n');
 }
}
