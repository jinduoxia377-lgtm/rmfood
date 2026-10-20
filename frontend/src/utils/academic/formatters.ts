export type DateFormat = 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'YYYY年MM月DD日' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'full' | 'short';

export interface Reference {
  id: string;
  type: 'article' | 'book' | 'conference' | 'thesis' | 'website';
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  isbn?: string;
  url?: string;
  publisher?: string;
}

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'ieee' | 'gb-t-7714-2015';

export function formatDate(date: Date | string, format: DateFormat = 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    case 'YYYY年MM月DD日':
      return `${year}年${month}月${day}日`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'full':
      return `${year}年${month}月${day}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    case 'short':
      return `${year}年${parseInt(month)}月`;
    default:
      return `${year}-${month}-${day}`;
  }
}

export function formatCitation(reference: Reference, style: CitationStyle): string {
  const { authors, year, title, journal, volume, issue, pages, doi } = reference;

  const formatAuthors = (authorList: string[]): string => {
    if (authorList.length === 0) return '';
    if (authorList.length === 1) return authorList[0];
    if (authorList.length === 2) return `${authorList[0]}, & ${authorList[1]}`;
    return `${authorList[0]}, et al.`;
  };

  switch (style) {
    case 'apa': {
      const apaAuthors = formatAuthors(authors);
      let apaCitation = `${apaAuthors} (${year}). ${title}.`;
      if (journal) {
        apaCitation += ` ${journal}`;
        if (volume) apaCitation += `, ${volume}`;
        if (issue) apaCitation += `(${issue})`;
        if (pages) apaCitation += `, ${pages}`;
        apaCitation += '.';
      }
      if (doi) apaCitation += ` https://doi.org/${doi}`;
      return apaCitation;
    }

    case 'mla': {
      const mlaAuthors = authors.join(', ');
      let mlaCitation = `${mlaAuthors}. "${title}."`;
      if (journal) {
        mlaCitation += ` ${journal}`;
        if (volume) mlaCitation += `, vol. ${volume}`;
        if (issue) mlaCitation += `, no. ${issue}`;
        mlaCitation += `, ${year}`;
        if (pages) mlaCitation += `, pp. ${pages}`;
        mlaCitation += '.';
      }
      return mlaCitation;
    }

    case 'chicago': {
      const chicagoAuthors = authors.join(', ');
      let chicagoCitation = `${chicagoAuthors}. "${title}."`;
      if (journal) {
        chicagoCitation += ` ${journal}`;
        if (volume) chicagoCitation += ` ${volume}`;
        if (issue) chicagoCitation += `, no. ${issue}`;
        chicagoCitation += ` (${year})`;
        if (pages) chicagoCitation += `: ${pages}`;
        chicagoCitation += '.';
      }
      return chicagoCitation;
    }

    case 'ieee': {
      const ieeeAuthors = authors.map((a, i) => i === authors.length - 1 ? `and ${a}` : `${a},`).join(' ');
      let ieeeCitation = `${ieeeAuthors}, "${title},"`;
      if (journal) {
        ieeeCitation += ` ${journal}`;
        if (volume) ieeeCitation += `, vol. ${volume}`;
        if (issue) ieeeCitation += `, no. ${issue}`;
        if (pages) ieeeCitation += `, pp. ${pages}`;
        ieeeCitation += `, ${year}`;
      }
      return ieeeCitation + '.';
    }

    case 'gb-t-7714-2015': {
      const gbAuthors = authors.join(', ');
      let gbCitation = `${gbAuthors}. ${title}`;
      if (journal) {
        gbCitation += `[J]. ${journal}`;
        if (volume) gbCitation += `, ${volume}`;
        if (issue) gbCitation += `(${issue})`;
        if (pages) gbCitation += `: ${pages}`;
        gbCitation += `, ${year}`;
      }
      return gbCitation + '.';
    }

    default:
      return `${authors.join(', ')} (${year}). ${title}.`;
  }
}

export function formatPageNumber(num: number | string): string {
  if (typeof num === 'string') {
    if (num.includes('-')) {
      const [start, end] = num.split('-');
      if (start && end) {
        return `${parseInt(start)}-${parseInt(end)}`;
      }
    }
    return num;
  }
  return String(num);
}

export function formatTableNumber(chapter: number, num: number): string {
  return `表${chapter}-${num}`;
}

export function formatFigureNumber(chapter: number, num: number): string {
  return `图${chapter}-${num}`;
}

export function formatFormulaNumber(chapter: number, num: number): string {
  return `(${chapter}.${num})`;
}
