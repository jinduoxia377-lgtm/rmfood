import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReferenceType } from '@/types/academic-report';
import type { Reference, Citation } from '@/types/academic-report-lifecycle';

interface ReferenceState {
  // 文献列表
  references: Reference[];
  selectedReference: Reference | null;

  // 搜索状态
  searchQuery: string;
  typeFilter: ReferenceType | 'all';

  // 加载状态
  isLoading: boolean;
  error: string | null;

  // 引用列表
  citations: Citation[];

  // 操作
  searchReferences: (query: string) => void;
  setTypeFilter: (type: ReferenceType | 'all') => void;
  fetchByDOI: (doi: string) => void;
  fetchByISBN: (isbn: string) => void;
  addReference: (reference: Omit<Reference, 'id' | 'citation'>) => void;
  updateReference: (id: string, updates: Partial<Reference>) => void;
  deleteReference: (id: string) => void;
  importReferences: (references: Reference[]) => void;
  exportReferences: (format: 'bibtex' | 'ris') => string;

  // 引用管理
  insertCitation: (referenceId: string, location: string) => void;
  removeCitation: (citationId: string) => void;

  // 选择器
  filteredReferences: () => Reference[];
}

export const useReferenceStore = create<ReferenceState>()(
  persist(
    (set, get) => ({
      references: [],
      selectedReference: null,
      searchQuery: '',
      typeFilter: 'all',
      isLoading: false,
      error: null,
      citations: [],

      searchReferences: (query: string) => {
        set({ searchQuery: query });
      },

      setTypeFilter: (type: ReferenceType | 'all') => {
        set({ typeFilter: type });
      },

      fetchByDOI: async (doi: string) => {
        set({ isLoading: true, error: null });
        try {
          const mockReference: Reference = {
            id: `ref-${Date.now()}`,
            type: 'article',
            title: '学术论文标题示例',
            authors: ['张三', '李四'],
            year: 2024,
            journal: '中国科学',
            volume: '54',
            issue: '5',
            pages: '1234-1245',
            doi,
            isbn: undefined,
            url: `https://doi.org/${doi}`,
            abstract: '这是一篇学术论文的摘要内容...',
            citation: '张三, 李四. 学术论文标题示例[J]. 中国科学, 2024, 54(5): 1234-1245.',
          };
          set(state => ({
            references: [...state.references, mockReference],
            selectedReference: mockReference,
            isLoading: false,
          }));
        } catch {
          set({ error: '无法获取文献信息', isLoading: false });
        }
      },

      fetchByISBN: async (isbn: string) => {
        set({ isLoading: true, error: null });
        try {
          const mockReference: Reference = {
            id: `ref-${Date.now()}`,
            type: 'book',
            title: '学术专著标题示例',
            authors: ['王五', '赵六'],
            year: 2023,
            journal: undefined,
            volume: undefined,
            issue: undefined,
            pages: '320',
            doi: undefined,
            isbn,
            url: undefined,
            abstract: '这是一本学术专著的摘要内容...',
            citation: '王五, 赵六. 学术专著标题示例[M]. 北京: 科学出版社, 2023: 320.',
          };
          set(state => ({
            references: [...state.references, mockReference],
            selectedReference: mockReference,
            isLoading: false,
          }));
        } catch {
          set({ error: '无法获取书籍信息', isLoading: false });
        }
      },

      addReference: (referenceData) => {
        const citation = generateCitation(referenceData);
        const newReference: Reference = {
          ...referenceData,
          id: `ref-${Date.now()}`,
          citation,
        };
        set(state => ({
          references: [...state.references, newReference],
          selectedReference: newReference,
        }));
      },

      updateReference: (id: string, updates) => {
        set(state => {
          const updatedReferences = state.references.map(r => {
            if (r.id === id) {
              const updated = { ...r, ...updates };
              // 如果更新了影响引用格式的字段，重新生成引用
              if (updates.title || updates.authors || updates.year || updates.journal) {
                updated.citation = generateCitation(updated);
              }
              return updated;
            }
            return r;
          });
          return {
            references: updatedReferences,
            selectedReference: state.selectedReference?.id === id
              ? updatedReferences.find(r => r.id === id) || null
              : state.selectedReference,
          };
        });
      },

      deleteReference: (id: string) => {
        set(state => ({
          references: state.references.filter(r => r.id !== id),
          selectedReference: state.selectedReference?.id === id ? null : state.selectedReference,
          citations: state.citations.filter(c => c.referenceId !== id),
        }));
      },

      importReferences: (references) => {
        set(state => ({
          references: [...state.references, ...references],
        }));
      },

      exportReferences: (format: 'bibtex' | 'ris') => {
        const { references } = get();
        if (format === 'bibtex') {
          return references.map(r => {
            const type = r.type === 'article' ? 'article' :
                         r.type === 'book' ? 'book' : 'misc';
            return `@${type}{${r.id.replace('ref-', '')},
  title = {${r.title}},
  author = {${r.authors.join(' and ')}},
  year = {${r.year}},
  ${r.journal ? `journal = {${r.journal}},` : ''}
  ${r.volume ? `volume = {${r.volume}},` : ''}
  ${r.pages ? `pages = {${r.pages}},` : ''}
  ${r.doi ? `doi = {${r.doi}},` : ''}
}`;
          }).join('\n\n');
        } else {
          return references.map(r =>
            `TY - ${r.type === 'article' ? 'JOUR' : r.type === 'book' ? 'BOOK' : 'GEN'}
TI - ${r.title}
AU - ${r.authors.join('\nAU - ')}
PY - ${r.year}
${r.journal ? `JO - ${r.journal}` : ''}
${r.volume ? `VL - ${r.volume}` : ''}
${r.pages ? `SP - ${r.pages.split('-')[0]}\nEP - ${r.pages.split('-')[1] || r.pages}` : ''}
${r.doi ? `DO - ${r.doi}` : ''}
ER - 
`).join('\n');
        }
      },

      insertCitation: (referenceId: string, location: { chapterId?: string; page?: number; line?: number }) => {
        const citation: Citation = {
          id: `cit-${Date.now()}`,
          referenceId,
          location,
          format: 'gb7714',
          createdAt: new Date().toISOString(),
        };
        set(state => ({
          citations: [...state.citations, citation],
        }));
      },

      removeCitation: (citationId: string) => {
        set(state => ({
          citations: state.citations.filter(c => c.id !== citationId),
        }));
      },

      filteredReferences: () => {
        const { references, searchQuery, typeFilter } = get();
        return references.filter(ref => {
          const matchesSearch = ref.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                               ref.authors.some(a => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
                               ref.journal?.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesType = typeFilter === 'all' || ref.type === typeFilter;
          return matchesSearch && matchesType;
        });
      },
    }),
    {
      name: 'reference-storage',
    },
  ),
);

function generateCitation(ref: Omit<Reference, 'id' | 'citation'>): string {
  const authors = ref.authors.join('、');
  if (ref.type === 'article') {
    return `${authors}. ${ref.title}[J]. ${ref.journal}, ${ref.year}${ref.volume ? `, ${ref.volume}` : ''}${ref.pages ? `(${ref.pages})` : ''}.`;
  } else if (ref.type === 'book') {
    return `${authors}. ${ref.title}[M]. ${ref.year}${ref.pages ? `: ${ref.pages}` : ''}.`;
  } else {
    return `${authors}. ${ref.title}[${ref.type.toUpperCase()[0]}]. ${ref.year}.`;
  }
}
