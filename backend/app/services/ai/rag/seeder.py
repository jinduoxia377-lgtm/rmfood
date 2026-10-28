"""内置知识库种子注入器

将平台内置的 TCM 药材库、药食同源目录、食品安全法规自动注入 RAG 向量库。

工作流程：
1. 读取内置数据源（TCMSP 药材库、中国食品法规等）
2. 合并 MMID 传统属性（四气/五味/归经/毒性）
3. 格式化为人类可读的 Markdown 文本
4. 调用 rag_service.ingest_document() 分块 -> 向量化 -> 存储

幂等设计：已注入则跳过，不会重复写入。
"""

import importlib.util
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# 种子文档文件名常量（供 seed_if_needed 和 rag_router 共享使用）
SEED_DOCUMENT_NAMES = frozenset({
    'tcm_herb_encyclopedia.md',
    'food_homology_catalog.md',
    'food_safety_regulations.md',
})

# 数据源所在目录（seeder在 rag/ 下，需要向上两级到 services/，再进入 data_sources/）
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data_sources"

# MMID 数据文件路径
_MMID_DATA_FILE = _DATA_DIR / "archived_enriched_mmid_herbs.json"

# 四气翻译映射
_NATURE_MAP = {
    "warm": "温", "hot": "热", "cold": "寒", "cool": "凉",
    "neutral": "平", "warm-hot": "温偏热", "cool-cold": "凉偏寒",
}

# 五味翻译映射
_FLAVOR_MAP = {
    "pungent": "辛", "acrid": "辛", "bitter": "苦", "sweet": "甘",
    "sour": "酸", "salty": "咸", "bland": "淡", "平和": "平和",
}


def _import_module_direct(filename):
    """直接加载数据源模块（绕过 app.services.__init__ 中的导入错误）"""
    module_path = _DATA_DIR / filename
    if not module_path.exists():
        return None
    spec = importlib.util.spec_from_file_location(
        f"_rag_seed_{filename}", str(module_path),
        submodule_search_locations=[]
    )
    if spec is None or spec.loader is None:
        return None
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
        return mod
    except Exception as e:
        logger.warning("加载数据源 %s 失败: %s", filename, e)
        return None


def _load_herb_database():
    """加载所有药材数据（TCMSP 基础库 + 扩展数据），并合并 MMID 传统属性"""
    herbs = []

    # 1. TCMSP 基础库
    mod = _import_module_direct("tcmsp_client.py")
    if mod:
        base = getattr(mod, "TCMSP_HERB_DATABASE", [])
        if base:
            herbs.extend(base)
            logger.info("加载 TCMSP 基础药材库: %d 味", len(base))

    # 2. 扩展数据（_herb_data_01 ~ 06）
    for i in range(1, 7):
        part_var = f"_HERBS_PART_0{i}"
        mod = _import_module_direct(f"_herb_data_0{i}.py")
        if mod:
            data = getattr(mod, part_var, [])
            if data:
                herbs.extend(data)
                logger.info("加载扩展药材数据 part %d: %d 味", i, len(data))

    # 去重（按 name_cn）
    seen = set()
    unique = []
    for h in herbs:
        name = h.get("name_cn", "")
        if name and name not in seen:
            seen.add(name)
            unique.append(h)

    logger.info("药材数据库合计: %d 味（去重后）", len(unique))

    # 3. 合并 MMID 传统属性（四气/五味/归经/毒性）
    unique = _merge_mmid_attributes(unique)

    return unique


def _load_mmid_data():
    """加载 MMID 药材传统属性数据"""
    if not _MMID_DATA_FILE.exists():
        logger.debug("MMID 数据文件不存在: %s", _MMID_DATA_FILE)
        return {}

    try:
        with open(_MMID_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        herbs = data.get('herbs', [])
        mmid_map = {h['name_cn']: h for h in herbs if h.get('name_cn')}
        logger.info("加载 MMID 传统属性数据: %d 味", len(mmid_map))
        return mmid_map
    except Exception as e:
        logger.warning("加载 MMID 数据失败: %s", e)
        return {}


def _merge_mmid_attributes(herbs):
    """将 MMID 传统属性（四气/五味/归经/毒性）合并到药材记录"""
    if not herbs:
        return herbs

    mmid_map = _load_mmid_data()
    if not mmid_map:
        logger.debug("无 MMID 数据可合并")
        return herbs

    merged_count = 0
    for herb in herbs:
        name = herb.get('name_cn', '')
        if name in mmid_map:
            mmid = mmid_map[name]
            # 合并传统属性到 extra_knowledge 字段
            extra = herb.get('extra_knowledge', {})
            extra['nature'] = _NATURE_MAP.get(mmid.get('nature'), mmid.get('nature'))
            extra['flavor'] = [_FLAVOR_MAP.get(f, f) for f in mmid.get('flavor', [])]
            extra['meridians'] = mmid.get('meridians', [])
            extra['toxicity'] = mmid.get('toxicity')
            extra['efficacy_raw'] = mmid.get('efficacy', '')
            extra['processing'] = mmid.get('processing', '')
            extra['origin'] = mmid.get('origin', '')
            herb['extra_knowledge'] = extra
            merged_count += 1

    logger.info("MMID 属性合并完成: %d/%d 味药材已补充传统属性", merged_count, len(herbs))
    return herbs


def _format_herb_record(herb):
    """将单味药材数据格式化为 Markdown 章节（含 MMID 传统属性）"""
    lines = []
    lines.append(f"## {herb['name_cn']}（{herb.get('name_latin', '')}）")
    lines.append("")
    lines.append(f"**类别**：{herb.get('category', '未分类')}")
    lines.append(f"**拼音**：{herb.get('name_pinyin', '')}")
    lines.append(f"**药食同源**：{'是' if herb.get('is_food_homology') else '否'}")

    # 四气/五味/归经（来自 MMID）
    extra = herb.get('extra_knowledge', {})
    if extra.get('nature'):
        lines.append(f"**四气**：{extra['nature']}")
    if extra.get('flavor'):
        lines.append(f"**五味**：{'、'.join(extra['flavor'])}")
    if extra.get('meridians'):
        lines.append(f"**归经**：{'、'.join(extra['meridians'])}")
    if extra.get('toxicity'):
        lines.append(f"**毒性**：{extra['toxicity']}")

    if herb.get("ob_percent") is not None:
        lines.append(f"**口服生物利用度**：{herb['ob_percent']}%")
    if herb.get("dl_value") is not None:
        lines.append(f"**类药性**：{herb['dl_value']}")

    if herb.get("effects"):
        lines.append(f"**功效**：{herb['effects']}")
    if extra.get('efficacy_raw'):
        lines.append(f"**传统功效**：{extra['efficacy_raw']}")

    compounds = herb.get("compounds", [])
    if compounds:
        top = compounds[:5]
        lines.append("**主要活性成分**：" + "、".join(
            f"{c.get('name', '?')}(OB:{c.get('ob', '?')}%, DL:{c.get('dl', '?')})"
            for c in top
        ))

    targets = herb.get("targets", [])
    if targets:
        lines.append("**主要靶点**：" + "、".join(targets[:10]))

    diseases = herb.get("diseases", [])
    if diseases:
        lines.append("**适应症**：" + "、".join(diseases[:10]))

    if extra.get('processing'):
        lines.append(f"**炮制**：{extra['processing']}")
    if extra.get('origin'):
        lines.append(f"**产地**：{extra['origin']}")

    lines.append("")
    return "\n".join(lines)


def _format_homology_catalog():
    """格式化药食同源目录"""
    lines = ['# 药食同源物品目录', '']
    lines.append('以下为国家和卫健委公布的药食同源物质名单，可用于普通食品生产经营。')
    lines.append('')

    mod = _import_module_direct('tcmsp_client.py')
    if mod:
        catalog = getattr(mod, 'FOOD_HOMOLOGY_CATALOG', None)
        if catalog:
            items = sorted(catalog) if isinstance(catalog, (set, list)) else []
            lines.append(f'共计约 {len(items)} 种。')
            lines.append('')
            for i in range(0, len(items), 25):
                batch = items[i:i + 25]
                lines.append('、'.join(batch))
                lines.append('')

    if len(lines) <= 4:
        lines.append('[药食同源目录数据加载失败]')
        lines.append('')

    return '\n'.join(lines)


def _format_regulations():
    """格式化食品安全法规数据"""
    lines = ['# 食品安全法规与标准', '']

    mod = _import_module_direct('china_food_regulations.py')
    if mod is None:
        lines.append('[法规数据加载失败]')
        return '\n'.join(lines)

    food_standards = getattr(mod, 'FOOD_SAFETY_STANDARDS', [])
    homology_materials = getattr(mod, 'FOOD_HOMOLOGY_MATERIALS', [])
    new_food_materials = getattr(mod, 'NEW_FOOD_MATERIALS', [])
    food_additives = getattr(mod, 'FOOD_ADDITIVES', [])

    # 食品法规标准
    lines.append('## 食品安全国家标准')
    lines.append('')
    for std in food_standards:
        title = std.get('title', std.get('standard_code', '未知'))
        lines.append(f'### {title}')
        lines.append(f"- **标准号**：{std.get('standard_code', '')}")
        lines.append(f"- **类别**：{std.get('category', '')}")
        lines.append(f"- **状态**：{std.get('status', '')}")
        lines.append(f"- **发布日期**：{std.get('publish_date', '')}")
        lines.append(f"- **实施日期**：{std.get('implementation_date', '')}")
        if std.get('summary'):
            lines.append(f"- **摘要**：{std['summary']}")
        lines.append('')

    # 药食同源物质明细
    lines.append('## 药食同源物质明细')
    lines.append('')
    for item in homology_materials:
        name = item.get('name', '未知')
        lines.append(f'### {name}')
        lines.append(f"- **拉丁名**：{item.get('latin_name', '')}")
        lines.append(f"- **类别**：{item.get('category', '')}")
        lines.append(f"- **批准日期**：{item.get('approval_date', '')}")
        lines.append(f"- **状态**：{item.get('status', '')}")
        if item.get('max_dosage'):
            lines.append(f"- **最大用量**：{item['max_dosage']}")
        if item.get('restrictions'):
            lines.append('- **限制**：' + '；'.join(item['restrictions']))
        lines.append('')

    # 新食品原料
    lines.append('## 新食品原料（新资源食品）')
    lines.append('')
    for item in new_food_materials:
        name = item.get('name', '未知')
        lines.append(f'### {name}')
        lines.append(f"- **英文名**：{item.get('english_name', '')}")
        lines.append(f"- **来源**：{item.get('source', '')}")
        lines.append(f"- **批准日期**：{item.get('approval_date', '')}")
        lines.append(f"- **状态**：{item.get('status', '')}")
        if item.get('daily_intake'):
            lines.append(f"- **每日摄入量**：{item['daily_intake']}")
        if item.get('restrictions'):
            lines.append('- **限制**：' + '；'.join(item['restrictions']))
        lines.append('')

    # 食品添加剂
    lines.append('## 食品添加剂使用标准')
    lines.append('')
    for item in food_additives:
        name = item.get('name', '未知')
        code = item.get('code', '')
        lines.append(f'### {name} ({code})')
        lines.append(f"- **功能**：{item.get('function', '')}")
        lines.append(f"- **最大使用量**：{item.get('max_level', '')}")
        if item.get('allowed_foods'):
            lines.append('- **允许食品**：' + '、'.join(item['allowed_foods'][:10]))
        lines.append('')

    return '\n'.join(lines)


def build_seed_documents():
    """构建种子文档列表"""
    documents = []

    # 1. 药材百科
    herbs = _load_herb_database()
    if herbs:
        lines = ['# 药食同源药材百科', '']
        lines.append('以下为药食同源药材的详细信息，包含性味功效、活性成分、靶点和适应症。')
        lines.append('')
        for herb in herbs:
            lines.append(_format_herb_record(herb))
        documents.append(('tcm_herb_encyclopedia.md', '\n'.join(lines)))

    # 2. 药食同源目录
    homology_text = _format_homology_catalog()
    if homology_text.strip():
        documents.append(('food_homology_catalog.md', homology_text))

    # 3. 食品安全法规
    regulations_text = _format_regulations()
    if regulations_text.strip():
        documents.append(('food_safety_regulations.md', regulations_text))

    return documents


async def seed_if_needed(rag_service=None):
    """幂等种子注入"""
    default_service = None
    try:
        from .rag_service import rag_service as ds
        default_service = ds
    except Exception as e:
        logger.debug("RAG 服务导入失败: %s", e)

    svc = rag_service or default_service
    if svc is None:
        logger.error('无法获取 RAGService 实例，种子注入中止')
        return {'seeded': False, 'documents': 0, 'total_chunks': 0}

    # 幂等逻辑：检查种子文档特定的 source 名称是否已存在
    # 而非检查 total_chunks > 0（用户上传任意文档后不应阻断种子注入）
    # P2-8：改为按单个 filename 判断——部分失败重试时只注入缺失的，
    # 不重复注入已存在的种子文档（ingest_document 无按 source 去重）。
    seed_documents = build_seed_documents()
    if not seed_documents:
        logger.warning('没有可用的种子文档')
        return {'seeded': False, 'documents': 0, 'total_chunks': 0}

    seed_filenames = {fn for fn, _ in seed_documents}
    # existing_sources 只取 system 种子源（种子注入均以 user_id="system" 存储）
    existing_sources = set(svc.list_documents(user_id="system"))
    missing = [(fn, txt) for fn, txt in seed_documents if fn not in existing_sources]

    if not missing:
        stats = svc.get_stats(user_id="system")
        logger.info('种子文档已全部存在 (%d/%d)，跳过注入', len(seed_filenames), len(seed_documents))
        return {
            'seeded': True,
            'documents': len(stats.get('documents', []) or []),
            'total_chunks': stats.get('total_chunks', 0),
            'files': list(seed_filenames),
            'skipped': True,
        }

    logger.info('种子文档不完整，需注入 %d/%d ...', len(missing), len(seed_documents))

    total_chunks = 0
    seeded_files = []
    seed_errors = []

    for filename, text in missing:
        try:
            content_bytes = text.encode('utf-8')
            info = await svc.ingest_document(content_bytes, filename, user_id="system")
            total_chunks += info.chunk_count
            seeded_files.append(filename)
            logger.info('种子文档注入成功: %s (%d 块)', filename, info.chunk_count)
        except Exception as e:
            logger.error('种子文档注入失败 %s: %s', filename, e, exc_info=True)
            seed_errors.append(f'{filename}: {e}')

    # 修复：全部种子注入失败（如 Embedding 不可用）时不得返回 seeded=true，
    # 否则 /seed 响应与 /seed/status 的 is_seeded 矛盾，给前端/用户造成「知识库已就绪」的错觉。
    # 全部种子文档均成功注入（无错误）才 seeded=true；有错误则 seeded=false 并返回 errors。
    all_present = seed_filenames.issubset(set(svc.list_documents(user_id="system")))
    return {
        'seeded': len(seed_errors) == 0 and all_present,
        'documents': len(seeded_files),
        'total_chunks': total_chunks,
        'files': seeded_files,
        'errors': seed_errors if seed_errors else None,
    }
