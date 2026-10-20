/**
 * 清洗 Markdown 语法符号，保留可读文本与换行。
 *
 * 用于聊天对话内容展示：AI 回复常携带 #、**、列表、表格、代码围栏等
 * Markdown 语法符号，直接渲染会显得杂乱，统一清洗为纯文本。
 */
export function cleanAgentContent(content: string): string {
  if (!content) return content;
  let text = content;

  // 去除代码块围栏（保留围栏内文本）
  text = text.replace(/```[a-zA-Z0-9_-]*\s*/g, '\n');
  // 去除行内代码反引号
  text = text.replace(/`([^`]*)`/g, '$1');
  // 去除标题标记（# 开头）
  text = text.replace(/^#{1,6}\s+/gm, '');
  // 去除加粗/斜体/删除线
  // 注意：单下划线仅当位于词边界时按 Markdown 斜体处理，
  // 避免把代码/错误信息中的标识符（如 SUBTASK_MAX_STEPS）内部下划线误删。
  text = text.replace(/(\*\*|__)(\S+?)\1/g, '$2');
  text = text.replace(/(^|[\s(（【>])(\*|_)([^*\s_]+)\2(?=[\s)）】.,;:，。；：!?！？]|$)/g, '$1$3');
  text = text.replace(/~~(.*?)~~/g, '$1');
  // 去除列表符号（行首 -、*、+、数字.）
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+[.、]\s+/gm, '');
  // 表格：去除分隔行与管道符
  text = text.replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, '');
  text = text.replace(/\|/g, ' ');
  // 链接：保留链接文字
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 引用符号
  text = text.replace(/^\s*>\s?/gm, '');
  // 压缩多余空白
  text = text.replace(/[ \t]{2,}/g, ' ').trim();
  return text;
}