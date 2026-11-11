"""RAG 来源 → 前端展示名称（display_name）映射

背景：
- ChromaDB 中 chunk 的 metadata.source 是原始文件名（如 food_homology_catalog.md），
  直接展示给前端不友好。
- 本模块在「检索响应组装层」将 source 转换为用户友好的专业名称，
  **不修改 ChromaDB 存储数据**（避免重灌向量库）。

策略：
- 内置种子文档：使用常量映射（专业专有名称）。
- 用户上传文档：使用「去扩展名的文件名」友好化（_ / - 转空格、英文首字母大写）。
"""

import re

# 本草古籍（data/ancient_books 清洗导入，source 命名规范：ancient/{书名-朝代-作者}.md）
# 与 backend/scripts/import_ancient_books.py 生成的 ancient_books_manifest.json 一一对应。
ANCIENT_BOOK_DISPLAY_NAMES = {
    "ancient/吴普本草-晋-吴普.md": "《吴普本草》（晋·吴普）",
    "ancient/得配本草-清-严西亭.md": "《得配本草》（清·严西亭）",
    "ancient/新修本草-唐-苏敬.md": "《新修本草》（唐·苏敬）",
    "ancient/本经疏证-清-邹谢.md": "《本经疏证》（清·邹谢）",
    "ancient/本经逢原-清-张璐.md": "《本经逢原》（清·张璐）",
    "ancient/本草乘雅半偈-明-卢之颐.md": "《本草乘雅半偈》（明·卢之颐）",
    "ancient/本草从新-清-吴仪洛.md": "《本草从新》（清·吴仪洛）",
    "ancient/本草便读-清-张秉成.md": "《本草便读》（清·张秉成）",
    "ancient/本草分经-清-姚澜.md": "《本草分经》（清·姚澜）",
    "ancient/本草品汇精要-元-王好古.md": "《本草品汇精要》（元·王好古）",
    "ancient/本草图经-宋-苏颂.md": "《本草图经》（宋·苏颂）",
    "ancient/本草备要-清-汪昂.md": "《本草备要》（清·汪昂）",
    "ancient/本草害利-清-凌奂.md": "《本草害利》（清·凌奂）",
    "ancient/本草崇原-清-张志聪.md": "《本草崇原》（清·张志聪）",
    "ancient/本草征要-明-李中梓.md": "《本草征要》（明·李中梓）",
    "ancient/本草思辨录-清-周岩.md": "《本草思辨录》（清·周岩）",
    "ancient/本草择要纲目-清-蒋介繁.md": "《本草择要纲目》（清·蒋介繁）",
    "ancient/本草撮要-清-陈其瑞.md": "《本草撮要》（清·陈其瑞）",
    "ancient/本草新编-清-陈士铎.md": "《本草新编》（清·陈士铎）",
    "ancient/本草易读-清-汪讱庵.md": "《本草易读》（清·汪讱庵）",
    "ancient/本草求真-清-黄宫绣.md": "《本草求真》（清·黄宫绣）",
    "ancient/本草简要方--张宗祥.md": "《本草简要方》（张宗祥）",
    "ancient/本草纲目-明-李时珍.md": "《本草纲目》（明·李时珍）",
    "ancient/本草纲目别名录-明-李时珍.md": "《本草纲目别名录》（明·李时珍）",
    "ancient/本草纲目拾遗-清-赵学敏.md": "《本草纲目拾遗》（清·赵学敏）",
    "ancient/本草经解-清-叶桂.md": "《本草经解》（清·叶桂）",
    "ancient/本草经集注-南朝-陶弘景.md": "《本草经集注》（南朝·陶弘景）",
    "ancient/本草蒙筌-明-陈嘉谟.md": "《本草蒙筌》（明·陈嘉谟）",
    "ancient/本草衍义-宋-寇宗奭.md": "《本草衍义》（宋·寇宗奭）",
    "ancient/本草述钩元-清-杨时泰.md": "《本草述钩元》（清·杨时泰）",
    "ancient/本草问答-清-唐宗海.md": "《本草问答》（清·唐宗海）",
    "ancient/汤液本草-元-王好古.md": "《汤液本草》（元·王好古）",
    "ancient/海药本草-五代-李珣.md": "《海药本草》（五代·李珣）",
    "ancient/滇南本草-明-兰茂.md": "《滇南本草》（明·兰茂）",
    "ancient/石药尔雅-唐-梅彪.md": "《石药尔雅》（唐·梅彪）",
    "ancient/神农本草经-汉-佚名.md": "《神农本草经》（汉·佚名）",
    "ancient/神农本草经-清-孙星衍.md": "《神农本草经》（清·孙星衍）",
    "ancient/神农本草经百种录-清-徐大椿.md": "《神农本草经百种录》（清·徐大椿）",
    "ancient/神农本草经读-清-陈修园.md": "《神农本草经读》（清·陈修园）",
    "ancient/神农本草经赞-清-王楚材.md": "《神农本草经赞》（清·王楚材）",
    "ancient/证类本草-宋-唐慎微.md": "《证类本草》（宋·唐慎微）",
    "ancient/食鉴本草-明-宁源.md": "《食鉴本草》（明·宁源）",
}

# 内置种子文档 → 专业专有名称（与 seeder.SEED_DOCUMENT_NAMES 一一对应）
SEED_DISPLAY_NAMES = {
    "tcm_herb_encyclopedia.md": "药食同源药材百科（2024版）",
    "food_homology_catalog.md": "药食同源目录（2024版·106种）",
    "food_safety_regulations.md": "食品安全法规与标准汇编",
    **ANCIENT_BOOK_DISPLAY_NAMES,
}

# 去掉目录前缀（兼容 / 与 \\ 路径分隔符）
_PATH_PREFIX_RE = re.compile(r"^.*[/\\]")

# 去掉最后一个扩展名（如 .md / .pdf / .txt）
_EXTENSION_RE = re.compile(r"\.[^.\s]+$")

# 英文单词首字母大写（仅处理 ASCII 字母，中文不受影响）
_WORD_START_RE = re.compile(r"(?<![A-Za-z])([A-Za-z])")


def get_display_name(source: str) -> str:
    """将 RAG 检索返回的 source（原始文件名）转换为前端展示名称。

    - 命中 ``SEED_DISPLAY_NAMES`` → 返回专业专有名称
    - 否则友好化文件名：去掉目录前缀与扩展名、``_``/``-`` 转空格、
      英文单词首字母大写（中文原样保留）。

    Args:
        source: ChromaDB chunk 的 metadata.source 值（如 food_homology_catalog.md）。

    Returns:
        展示名称；source 为空时返回空字符串。
    """
    if not source:
        return ""

    # 1. 内置种子文档 → 专业专有名称
    display_name = SEED_DISPLAY_NAMES.get(source)
    if display_name:
        return display_name

    # 2. 用户上传文档 → 去目录前缀 + 去扩展名
    base = _PATH_PREFIX_RE.sub("", source)
    base = _EXTENSION_RE.sub("", base)

    # 3. 分隔符友好化：_ / - → 空格
    base = base.replace("_", " ").replace("-", " ")

    # 4. 英文单词首字母大写（中文不受影响）
    base = _WORD_START_RE.sub(lambda m: m.group(1).upper(), base)

    # 5. 规整空白
    base = re.sub(r"\s+", " ", base).strip()
    return base


# 从展示名中提取书名：《本草纲目》（明·李时珍）→ 本草纲目
_BOOK_TITLE_RE = re.compile(r"《([^》]+)》")


def get_ancient_book_titles() -> dict[str, list[str]]:
    """返回「古籍书名 → 来源列表」映射，用于书名感知检索。

    Returns:
        {  "本草纲目": ["ancient/本草纲目-明-李时珍.md"],
           "神农本草经": ["ancient/神农本草经-汉-佚名.md",
                          "ancient/神农本草经-清-孙星衍.md"] }

    说明：同名不同版本（如《神农本草经》汉·佚名与清·孙星衍）合并到同一书名下，
    检索时同时命中两个来源。
    """
    titles: dict[str, list[str]] = {}
    for source, display in ANCIENT_BOOK_DISPLAY_NAMES.items():
        m = _BOOK_TITLE_RE.search(display)
        if not m:
            continue
        titles.setdefault(m.group(1), []).append(source)
    return titles


def detect_ancient_book_sources(question: str) -> list[str]:
    """检测问题中提到的古籍书名，返回对应来源列表（最长书名优先，避免误配）。

    例：「本草纲目 黄芪」→ ancient/本草纲目-明-李时珍.md
        「本草纲目拾遗 三七」→ ancient/本草纲目拾遗-清-赵学敏.md（不会误配《本草纲目》）

    Args:
        question: 用户问题文本。

    Returns:
        命中的古籍来源列表（去重、按书名长度降序）；未命中返回空列表。
    """
    if not question:
        return []
    titles = get_ancient_book_titles()
    # 长书名优先：先匹配《本草纲目拾遗》再匹配《本草纲目》
    matched_sources: list[str] = []
    consumed_spans: list[tuple[int, int]] = []
    for title in sorted(titles, key=len, reverse=True):
        start = 0
        while True:
            idx = question.find(title, start)
            if idx == -1:
                break
            end = idx + len(title)
            # 该区间已被更长的书名占用 → 跳过（避免「本草纲目」误吃「本草纲目拾遗」）
            if not any(s <= idx and end <= e for s, e in consumed_spans):
                consumed_spans.append((idx, end))
                for src in titles[title]:
                    if src not in matched_sources:
                        matched_sources.append(src)
            start = end
    return matched_sources
