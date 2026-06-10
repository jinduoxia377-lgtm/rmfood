export function truncate(str: string, length: number, suffix = '...'): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  if (str.length <= length) {
    return str;
  }

  return str.substring(0, length) + suffix;
}

export function slugify(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function capitalize(str: string, eachWord = false): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  if (eachWord) {
    return str
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => hex ? String.fromCharCode(parseInt(hex, 16)) : '')
    .replace(/&#(\d+);/g, (_, num) => num ? String.fromCharCode(parseInt(num, 10)) : '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return str.replace(/[&<>"']/g, char => htmlEscapeMap[char]);
}

export function unescapeHtml(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  const htmlUnescapeMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return str.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, entity => htmlUnescapeMap[entity] || entity);
}

export function camelCase(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());
}

export function kebabCase(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function snakeCase(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

export function pascalCase(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^./, char => char.toUpperCase());
}

export function removeWhitespace(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str.replace(/\s+/g, '');
}

export function wordCount(str: string): number {
  if (!str || typeof str !== 'string') {
    return 0;
  }

  return str
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0).length;
}

export function charCount(str: string, includeSpaces = true): number {
  if (!str || typeof str !== 'string') {
    return 0;
  }

  return includeSpaces ? str.length : str.replace(/\s/g, '').length;
}
