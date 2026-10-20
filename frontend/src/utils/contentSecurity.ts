/**
 * 内容安全检查工具
 *
 * 功能：
 * - 检测并清理恶意HTML内容
 * - 验证用户输入的安全性
 * - 防止XSS攻击
 * - 过滤危险内容
 */

/** 危险HTML标签列表 */
const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'embed',
  'object',
  'applet',
  'base',
  'form',
  'input',
  'button',
  'link',
  'style',
  'meta',
];

/** 危险属性列表 */
const DANGEROUS_ATTRIBUTES = [
  'onclick',
  'onload',
  'onerror',
  'onmouseover',
  'onkeydown',
  'onfocus',
  'onblur',
  'onchange',
  'data-',
  'src',
  'href',
];



/** 危险协议列表 */
const DANGEROUS_PROTOCOLS = ['javascript:', 'vbscript:', 'data:', 'file:', 'ftp://'];

/** 敏感关键词 */
const SENSITIVE_KEYWORDS = [
  'alert(',
  'prompt(',
  'confirm(',
  'eval(',
  'document.cookie',
  'document.write',
  'window.location',
  'new Function(',
  'setTimeout(',
  'setInterval(',
];

/**
 * 内容安全检查结果
 */
export interface SecurityCheckResult {
  isSafe: boolean;
  errors: SecurityError[];
  cleanedContent: string;
}

export interface SecurityError {
  type: 'danger_tag' | 'danger_attr' | 'danger_protocol' | 'sensitive_content';
  message: string;
  location: string;
}

/**
 * 清理HTML内容，移除危险标签和属性
 */
export function sanitizeHtml(content: string): string {
  if (!content) return '';

  let cleaned = content;

  // 移除危险标签
  DANGEROUS_TAGS.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });

  // 移除危险属性
  DANGEROUS_ATTRIBUTES.forEach(attr => {
    const regex = new RegExp(`\\s${attr}=["']?[^'">]*["']?`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });

  // 移除危险协议
  DANGEROUS_PROTOCOLS.forEach(protocol => {
    const regex = new RegExp(protocol, 'gi');
    cleaned = cleaned.replace(regex, '#');
  });

  // 移除敏感JavaScript代码
  SENSITIVE_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    cleaned = cleaned.replace(regex, '[removed]');
  });

  return cleaned;
}

/**
 * 检查内容安全性
 */
export function checkContentSecurity(content: string): SecurityCheckResult {
  const errors: SecurityError[] = [];
  let isSafe = true;

  // 检查危险标签
  DANGEROUS_TAGS.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      isSafe = false;
      errors.push({
        type: 'danger_tag',
        message: `发现危险标签: <${tag}>`,
        location: matches[0],
      });
    }
  });

  // 检查危险属性
  DANGEROUS_ATTRIBUTES.forEach(attr => {
    const regex = new RegExp(`\\s${attr}=`, 'gi');
    if (regex.test(content)) {
      isSafe = false;
      errors.push({
        type: 'danger_attr',
        message: `发现危险属性: ${attr}`,
        location: attr,
      });
    }
  });

  // 检查危险协议
  DANGEROUS_PROTOCOLS.forEach(protocol => {
    if (content.toLowerCase().includes(protocol)) {
      isSafe = false;
      errors.push({
        type: 'danger_protocol',
        message: `发现危险协议: ${protocol}`,
        location: protocol,
      });
    }
  });

  // 检查敏感内容
  SENSITIVE_KEYWORDS.forEach(keyword => {
    if (content.toLowerCase().includes(keyword.toLowerCase())) {
      isSafe = false;
      errors.push({
        type: 'sensitive_content',
        message: `发现敏感内容: ${keyword}`,
        location: keyword,
      });
    }
  });

  return {
    isSafe,
    errors,
    cleanedContent: sanitizeHtml(content),
  };
}

/**
 * 验证URL安全性
 */
export function isUrlSafe(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);

    // 检查协议
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // 检查危险协议
    if (DANGEROUS_PROTOCOLS.some(p => url.toLowerCase().includes(p))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * 清理文件名，防止路径遍历攻击
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed';

  // 移除路径分隔符
  let sanitized = filename
    .replace(/[\\/]/g, '_')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F]/g, '_')
    .replace(/[<>:"|?*]/g, '_');

  // 限制长度
  if (sanitized.length > 200) {
    const extension = sanitized.split('.').pop() || '';
    sanitized = sanitized.substring(0, 180) + '.' + extension;
  }

  // 移除末尾的点和空格
  sanitized = sanitized.replace(/[.\s]+$/, '');

  return sanitized || 'unnamed';
}

/**
 * 验证文件名安全性
 */
export function isValidFilename(filename: string): boolean {
  const invalidPatterns = [
    /^\.\./,
    /^\./,
    /[\\/]/,
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1F]/,
    /[<>:"|?*]/,
  ];

  return !invalidPatterns.some(pattern => pattern.test(filename));
}

/**
 * 生成安全的导出内容
 */
export function prepareExportContent(content: string, filename: string): {
  safeContent: string;
  safeFilename: string;
  warnings: string[];
} {
  const warnings: string[] = [];

  // 检查内容安全
  const securityResult = checkContentSecurity(content);
  if (!securityResult.isSafe) {
    warnings.push(`检测到 ${securityResult.errors.length} 个安全问题，已自动清理`);
  }

  // 检查文件名
  if (!isValidFilename(filename)) {
    warnings.push('文件名包含非法字符，已自动清理');
  }

  return {
    safeContent: securityResult.cleanedContent,
    safeFilename: sanitizeFilename(filename),
    warnings,
  };
}
