/**
 * RAG 知识来源「专业专有名称」展示辅助
 *
 * 背景：RAG 检索结果中的 source 是内部文件名（如 food_homology_catalog.md），
 * 直接展示给用户不专业。本模块提供三层展示策略：
 *
 * 1. 后端返回的 display_name（后端已同步实施，优先采用）
 * 2. 本地种子专有名称映射 SEED_DISPLAY_NAMES（内置权威文档）
 * 3. 友好化文件名兜底（去扩展名、分隔符转空格、英文单词首字母大写、中文原样）
 */

/**
 * 本草古籍专有名称映射（source 命名规范：ancient/{书名-朝代-作者}.md）
 * 与 backend/scripts/import_ancient_books.py 生成的 ancient_books_manifest.json 一一对应。
 */
export const ANCIENT_BOOK_DISPLAY_NAMES: Record<string, string> = {
  'ancient/吴普本草-晋-吴普.md': '《吴普本草》（晋·吴普）',
  'ancient/得配本草-清-严西亭.md': '《得配本草》（清·严西亭）',
  'ancient/新修本草-唐-苏敬.md': '《新修本草》（唐·苏敬）',
  'ancient/本经疏证-清-邹谢.md': '《本经疏证》（清·邹谢）',
  'ancient/本经逢原-清-张璐.md': '《本经逢原》（清·张璐）',
  'ancient/本草乘雅半偈-明-卢之颐.md': '《本草乘雅半偈》（明·卢之颐）',
  'ancient/本草从新-清-吴仪洛.md': '《本草从新》（清·吴仪洛）',
  'ancient/本草便读-清-张秉成.md': '《本草便读》（清·张秉成）',
  'ancient/本草分经-清-姚澜.md': '《本草分经》（清·姚澜）',
  'ancient/本草品汇精要-元-王好古.md': '《本草品汇精要》（元·王好古）',
  'ancient/本草图经-宋-苏颂.md': '《本草图经》（宋·苏颂）',
  'ancient/本草备要-清-汪昂.md': '《本草备要》（清·汪昂）',
  'ancient/本草害利-清-凌奂.md': '《本草害利》（清·凌奂）',
  'ancient/本草崇原-清-张志聪.md': '《本草崇原》（清·张志聪）',
  'ancient/本草征要-明-李中梓.md': '《本草征要》（明·李中梓）',
  'ancient/本草思辨录-清-周岩.md': '《本草思辨录》（清·周岩）',
  'ancient/本草择要纲目-清-蒋介繁.md': '《本草择要纲目》（清·蒋介繁）',
  'ancient/本草撮要-清-陈其瑞.md': '《本草撮要》（清·陈其瑞）',
  'ancient/本草新编-清-陈士铎.md': '《本草新编》（清·陈士铎）',
  'ancient/本草易读-清-汪讱庵.md': '《本草易读》（清·汪讱庵）',
  'ancient/本草求真-清-黄宫绣.md': '《本草求真》（清·黄宫绣）',
  'ancient/本草简要方--张宗祥.md': '《本草简要方》（张宗祥）',
  'ancient/本草纲目-明-李时珍.md': '《本草纲目》（明·李时珍）',
  'ancient/本草纲目别名录-明-李时珍.md': '《本草纲目别名录》（明·李时珍）',
  'ancient/本草纲目拾遗-清-赵学敏.md': '《本草纲目拾遗》（清·赵学敏）',
  'ancient/本草经解-清-叶桂.md': '《本草经解》（清·叶桂）',
  'ancient/本草经集注-南朝-陶弘景.md': '《本草经集注》（南朝·陶弘景）',
  'ancient/本草蒙筌-明-陈嘉谟.md': '《本草蒙筌》（明·陈嘉谟）',
  'ancient/本草衍义-宋-寇宗奭.md': '《本草衍义》（宋·寇宗奭）',
  'ancient/本草述钩元-清-杨时泰.md': '《本草述钩元》（清·杨时泰）',
  'ancient/本草问答-清-唐宗海.md': '《本草问答》（清·唐宗海）',
  'ancient/汤液本草-元-王好古.md': '《汤液本草》（元·王好古）',
  'ancient/海药本草-五代-李珣.md': '《海药本草》（五代·李珣）',
  'ancient/滇南本草-明-兰茂.md': '《滇南本草》（明·兰茂）',
  'ancient/石药尔雅-唐-梅彪.md': '《石药尔雅》（唐·梅彪）',
  'ancient/神农本草经-汉-佚名.md': '《神农本草经》（汉·佚名）',
  'ancient/神农本草经-清-孙星衍.md': '《神农本草经》（清·孙星衍）',
  'ancient/神农本草经百种录-清-徐大椿.md': '《神农本草经百种录》（清·徐大椿）',
  'ancient/神农本草经读-清-陈修园.md': '《神农本草经读》（清·陈修园）',
  'ancient/神农本草经赞-清-王楚材.md': '《神农本草经赞》（清·王楚材）',
  'ancient/证类本草-宋-唐慎微.md': '《证类本草》（宋·唐慎微）',
  'ancient/食鉴本草-明-宁源.md': '《食鉴本草》（明·宁源）',
}

/** 内置种子文档专有名称映射（文件名 → 专业展示名） */
export const SEED_DISPLAY_NAMES: Record<string, string> = {
  // ── 平台 RAG 知识库三大权威种子文档（backend/app/services/ai/rag/seeder.py）──
  'tcm_herb_encyclopedia.md': '药食同源药材百科（2024版）',
  'food_homology_catalog.md': '药食同源目录（2024版·106种）',
  'food_safety_regulations.md': '食品安全法规与标准汇编',
  // ── 本草古籍（42 部，backend source_display.py ANCIENT_BOOK_DISPLAY_NAMES 同步）──
  ...ANCIENT_BOOK_DISPLAY_NAMES,
  // ── 兼容后端 dialectics_service 中使用的其它知识来源（历史/扩展文档）──
  'herb_dose_limits.md': '中药剂量规范',
  'compatibility_rules.md': '中药配伍禁忌',
  'dietary_guidelines.md': '中国居民膳食指南',
  'herb_database.md': '中药数据库',
  'traditional_formula.md': '传统方剂典籍',
  'nutrient_db.md': '营养成分数据库',
  'efficacy_db.md': '功效成分数据库',
  'molecular_mechanism.md': '分子机制研究',
  'knowledge.md': '知识库',
}

/** 常见文档扩展名（友好化文件名时去除） */
const DOC_EXTENSIONS = /\.(md|markdown|txt|pdf|docx?|csv|json|yaml|yml|xlsx?|pptx?)$/i

/**
 * 将原始文件名友好化：
 * - 去掉常见文档扩展名（.md/.txt/.pdf/.docx 等）
 * - 下划线/连字符转为空格，连续空白合并
 * - 英文单词首字母大写（中文原样；已是全大写的缩写如 GB 不受影响）
 */
export function toFriendlyFileName(source: string): string {
  const trimmed = source.trim()
  if (!trimmed) return source

  const withoutExt = trimmed.replace(DOC_EXTENSIONS, '')
  const spaced = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  // 仅匹配 ASCII 小写字母开头的单词；中文不属于 \b 单词边界，保持原样
  return spaced.replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
}

/**
 * 获取知识来源的展示名称。
 *
 * 优先级：
 * 1. displayName 非空 → 直接返回（后端权威）
 * 2. 命中 SEED_DISPLAY_NAMES → 返回内置专有名称
 * 3. 否则 → 友好化文件名
 */
export function getSourceDisplayName(source: string, displayName?: string): string {
  if (displayName && displayName.trim()) return displayName
  if (Object.prototype.hasOwnProperty.call(SEED_DISPLAY_NAMES, source)) {
    return SEED_DISPLAY_NAMES[source]
  }
  return toFriendlyFileName(source)
}