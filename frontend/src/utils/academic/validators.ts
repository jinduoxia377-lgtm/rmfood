export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ReferenceData {
  type?: string;
  title?: string;
  authors?: string[];
  year?: number;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  isbn?: string;
  url?: string;
  publisher?: string;
}

export interface TemplateData {
  id?: string;
  name?: string;
  sections?: {
    id: string;
    title: string;
    content?: string;
    required?: boolean;
  }[];
  metadata?: Record<string, unknown>;
}

export function validateReference(data: ReferenceData): ValidationResult {
  const errors: string[] = [];

  if (!data.title || data.title.trim() === '') {
    errors.push('标题不能为空');
  }

  if (!data.authors || data.authors.length === 0) {
    errors.push('作者信息不能为空');
  } else {
    const invalidAuthors = data.authors.filter(a => !a || a.trim() === '');
    if (invalidAuthors.length > 0) {
      errors.push('存在无效的作者信息');
    }
  }

  if (!data.year || typeof data.year !== 'number') {
    errors.push('年份无效');
  } else if (data.year < 1900 || data.year > new Date().getFullYear() + 1) {
    errors.push('年份超出有效范围');
  }

  if (data.doi && !validateDOI(data.doi).valid) {
    errors.push('DOI格式无效');
  }

  if (data.isbn && !validateISBN(data.isbn).valid) {
    errors.push('ISBN格式无效');
  }

  if (data.url && !isValidUrl(data.url)) {
    errors.push('URL格式无效');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateTemplate(template: TemplateData): ValidationResult {
  const errors: string[] = [];

  if (!template.name || template.name.trim() === '') {
    errors.push('模板名称不能为空');
  }

  if (!template.sections || template.sections.length === 0) {
    errors.push('模板至少应包含一个章节');
  } else {
    template.sections.forEach((section, index) => {
      if (!section.id) {
        errors.push(`章节${index + 1}缺少ID`);
      }
      if (!section.title || section.title.trim() === '') {
        errors.push(`章节${index + 1}缺少标题`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateDOI(doi: string): ValidationResult {
  const errors: string[] = [];

  if (!doi || doi.trim() === '') {
    errors.push('DOI不能为空');
    return { valid: false, errors };
  }

  const doiPattern = /^10\.\d{4,}(?:\.\d+)*\/\S+$/i;
  if (!doiPattern.test(doi)) {
    errors.push('DOI格式不符合标准规范');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateISBN(isbn: string): ValidationResult {
  const errors: string[] = [];

  if (!isbn || isbn.trim() === '') {
    errors.push('ISBN不能为空');
    return { valid: false, errors };
  }

  const cleanIsbn = isbn.replace(/[-\s]/g, '');

  const isIsbn10 = /^\d{9}[\dXx]$/.test(cleanIsbn);
  const isIsbn13 = /^\d{13}$/.test(cleanIsbn);

  if (!isIsbn10 && !isIsbn13) {
    errors.push('ISBN格式无效（需为10位或13位）');
    return { valid: false, errors };
  }

  if (isIsbn10) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      const char = cleanIsbn[i];
      if (char) {
        sum += parseInt(char) * (10 - i);
      }
    }
    const checkChar = cleanIsbn[9];
    if (checkChar) {
      const upperCheckChar = checkChar.toUpperCase();
      const checkValue = upperCheckChar === 'X' ? 10 : parseInt(upperCheckChar);
      sum += checkValue;
      if (sum % 11 !== 0) {
        errors.push('ISBN-10校验码无效');
      }
    }
  }

  if (isIsbn13) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const char = cleanIsbn[i];
      if (char) {
        sum += parseInt(char) * (i % 2 === 0 ? 1 : 3);
      }
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const char12 = cleanIsbn[12];
    if (char12 && parseInt(char12) !== checkDigit) {
      errors.push('ISBN-13校验码无效');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!email || email.trim() === '') {
    errors.push('邮箱地址不能为空');
    return { valid: false, errors };
  }

  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(email)) {
    errors.push('邮箱格式无效');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
