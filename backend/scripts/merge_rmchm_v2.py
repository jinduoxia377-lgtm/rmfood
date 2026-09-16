"""
RMCHM v2.0 专业合并引擎
========================
合并来源：
  - TCMSP: D:/RMFOODFP/tcmsp_data/data/db_herbs_export.json (498条，含完整化合物/靶点/疾病)
  - SymMap: D:/RMFOODFP/data/SymMap/symmap_herbs.json (698条，含完整传统中医属性)
  - 图片:   D:/RMFOODFP/data/106FAM (107张)

输出：
  - D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v2.json
  - D:/RMFOODFP/data/rmchm/rmchm_merge_report_v2.json
  - D:/RMFOODFP/data/rmchm/rmchm_image_mapping_v2.json
"""
import json
import os
import re
import uuid
from datetime import datetime, timezone
from difflib import SequenceMatcher

# ════════════════════════════════════════════════════════════════
# 配置
# ════════════════════════════════════════════════════════════════
CONFIG = {
    'tcmsp_db_export': 'D:/RMFOODFP/tcmsp_data/data/db_herbs_export.json',
    'tcmsp_herbs_full': 'D:/RMFOODFP/tcmsp_data/data/tcmsp_herbs_full.json',
    'symmap_herbs': 'D:/RMFOODFP/data/SymMap/symmap_herbs.json',
    'image_dir': 'D:/RMFOODFP/data/106FAM',
    'output_dir': 'D:/RMFOODFP/data/rmchm',
}

# ════════════════════════════════════════════════════════════════
# 工具函数
# ════════════════════════════════════════════════════════════════

def normalize_name(name):
    """标准化药材名：去除空格、括号内容、标点"""
    if not name:
        return ''
    # 去除括号及内容（保留基础名）
    name = re.sub(r'[（(].*?[）)]', '', name)
    # 去除"鲜/"等前缀
    name = re.sub(r'^鲜/', '', name)
    # 去除标点
    name = re.sub(r'[、,\s]+', '', name)
    return name.strip().lower()


def calculate_similarity(name1, name2):
    """字符串相似度"""
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)
    if not n1 or not n2:
        return 0.0
    return SequenceMatcher(None, n1, n2).ratio()


def smart_image_match(herb_name, herb_alias, image_names):
    """
    智能图片匹配算法
    优先级：
    1. 原始名精确匹配
    2. 基础名（去括号）精确匹配
    3. 别名精确匹配
    4. 括号内别名匹配
    5. 模糊匹配（相似度>=0.85）
    """
    candidates = set()

    # 1. 原始名
    candidates.add(herb_name)
    # 2. 去除括号后的基础名
    base = re.sub(r'[（(].*?[）)]', '', herb_name).strip()
    if base:
        candidates.add(base)
    # 3. 别名
    if herb_alias:
        for alias in herb_alias.split(','):
            alias = alias.strip()
            candidates.add(alias)
            base_alias = re.sub(r'[（(].*?[）)]', '', alias).strip()
            if base_alias:
                candidates.add(base_alias)
    # 4. 去除"鲜/"前缀
    no_xian = re.sub(r'^鲜/', '', herb_name)
    if no_xian != herb_name:
        candidates.add(no_xian)
        base_no_xian = re.sub(r'[（(].*?[）)]', '', no_xian).strip()
        if base_no_xian:
            candidates.add(base_no_xian)

    # 精确匹配
    for c in candidates:
        if c in image_names:
            return c, 1.0

    # 模糊匹配
    best_score = 0.0
    best_name = None
    for img_name in image_names:
        score = calculate_similarity(herb_name, img_name)
        if score > best_score:
            best_score = score
            best_name = img_name

    if best_score >= 0.85:
        return best_name, best_score

    return None, 0.0


def truncate_ob(ob_value):
    """截断OB异常值"""
    try:
        ob = float(ob_value)
        return min(ob, 100.0)
    except (ValueError, TypeError):
        return None


# ════════════════════════════════════════════════════════════════
# 数据加载
# ════════════════════════════════════════════════════════════════

def load_tcmsp_data():
    """加载TCMSP数据"""
    print("\n[加载] TCMSP数据...")

    # 主数据：db_herbs_export（含完整化合物/靶点/疾病关联）
    with open(CONFIG['tcmsp_db_export'], 'r', encoding='utf-8') as f:
        db_data = json.load(f)
    tcmsp_herbs = db_data.get('herbs', [])
    print(f"  db_herbs_export: {len(tcmsp_herbs)} 条（含化合物/靶点/疾病）")

    # 建立 name_cn -> herb 映射（用于交叉引用）
    tcmsp_by_name = {}
    for h in tcmsp_herbs:
        name = h.get('name_cn', '')
        if name:
            tcmsp_by_name[name] = h
            # 也建拼音映射
            py = h.get('name_pinyin', '')
            if py:
                tcmsp_by_name[py.lower()] = h

    # 全量药材列表（含4条额外药材）
    with open(CONFIG['tcmsp_herbs_full'], 'r', encoding='utf-8') as f:
        full_data = json.load(f)
    full_herbs = full_data.get('data', [])
    print(f"  tcmsp_herbs_full: {len(full_herbs)} 条（含详细化合物列表）")

    return tcmsp_herbs, tcmsp_by_name, full_herbs


def load_symmap_data():
    """加载SymMap数据"""
    print("\n[加载] SymMap数据...")
    with open(CONFIG['symmap_herbs'], 'r', encoding='utf-8') as f:
        symmap_herbs = json.load(f)
    print(f"  symmap_herbs: {len(symmap_herbs)} 条")
    return symmap_herbs


def load_images():
    """加载图片资源"""
    print("\n[加载] 图片资源...")
    image_names = {}
    if os.path.exists(CONFIG['image_dir']):
        for f in os.listdir(CONFIG['image_dir']):
            if f.endswith('.jpg'):
                name = f[:-4]
                image_names[name] = f
    print(f"  找到 {len(image_names)} 张图片")
    return image_names


# ════════════════════════════════════════════════════════════════
# 核心合并引擎
# ════════════════════════════════════════════════════════════════

class RMCHMMergeEngine:
    def __init__(self):
        self.tcmsp_herbs = []
        self.tcmsp_by_name = {}
        self.tcmsp_full = []
        self.symmap_herbs = []
        self.image_names = {}
        self.rmchm_herbs = []
        self.image_mapping = {}
        self.stats = {}

    def execute(self):
        print("=" * 60)
        print("  RMCHM v2.0 专业合并引擎")
        print("  TCMSP(498) + SymMap(698) + 图片(107)")
        print("=" * 60)

        # 加载数据
        self.tcmsp_herbs, self.tcmsp_by_name, self.tcmsp_full = load_tcmsp_data()
        self.symmap_herbs = load_symmap_data()
        self.image_names = load_images()

        # 执行合并
        self.merge()

        # 保存结果
        self.save_results()

    def merge(self):
        """执行合并"""
        print("\n" + "=" * 60)
        print("  合并阶段")
        print("=" * 60)

        matched_symmap_ids = set()
        match_stats = {'tcmsp_id': 0, 'name_match': 0, 'symmap_only': 0, 'tcmsp_only': 0}

        # 策略：以SymMap 698条为主干，从TCMSP获取补充数据
        for sym_herb in self.symmap_herbs:
            sym_id = sym_herb.get('Herb_id')
            sym_name_cn = sym_herb.get('Chinese_name', '')
            sym_tcmsp_id = sym_herb.get('TCMSP_id')
            sym_alias = sym_herb.get('Alias', '')

            # 尝试通过TCMSP_id匹配
            tcmsp_herb = None
            match_method = None

            if sym_tcmsp_id:
                # 通过TCMSP_id精确查找
                for th in self.tcmsp_herbs:
                    if th.get('id') == sym_tcmsp_id:
                        tcmsp_herb = th
                        match_method = 'tcmsp_id'
                        break

            if not tcmsp_herb:
                # 通过名称匹配
                best_match = None
                best_score = 0.0
                for th in self.tcmsp_herbs:
                    th_name = th.get('name_cn', '')
                    score = calculate_similarity(sym_name_cn, th_name)
                    if score > best_score:
                        best_score = score
                        best_match = th

                if best_score >= 0.9:
                    tcmsp_herb = best_match
                    match_method = 'name_match'
                elif best_score >= 0.7:
                    # 低相似度，记录但不使用
                    pass

            # 构建RMCHM记录
            rmchm = self.build_rmchm_record(sym_herb, tcmsp_herb, match_method)
            self.rmchm_herbs.append(rmchm)
            matched_symmap_ids.add(sym_id)

            if match_method:
                match_stats[match_method] += 1

        # 处理TCMSP独有药材（不在SymMap中的）
        tcmsp_names_in_sym = set()
        for sym_herb in self.symmap_herbs:
            name = sym_herb.get('Chinese_name', '')
            if name:
                tcmsp_names_in_sym.add(normalize_name(name))
            alias = sym_herb.get('Alias', '')
            if alias:
                for a in alias.split(','):
                    tcmsp_names_in_sym.add(normalize_name(a.strip()))

        for th in self.tcmsp_herbs:
            th_name = th.get('name_cn', '')
            if normalize_name(th_name) not in tcmsp_names_in_sym:
                # TCMSP独有，添加为SymMap无对应记录的条目
                rmchm = self.build_rmchm_record({}, th, 'tcmsp_only')
                self.rmchm_herbs.append(rmchm)
                match_stats['tcmsp_only'] += 1

        self.stats = match_stats
        print(f"  合并完成，总计: {len(self.rmchm_herbs)} 条")
        print(f"  匹配统计: {match_stats}")

        # 图片匹配
        self.match_images()

    def build_rmchm_record(self, sym_herb, tcmsp_herb, match_method):
        """构建单条RMCHM记录"""
        rmchm_id = str(uuid.uuid4())[:8].upper()
        rmchm_code = f"RMCHM-{rmchm_id}"

        # 安全获取SymMap字段（sym_herb可能为空dict）
        sym = sym_herb if sym_herb else {}
        # 基础名称
        name_cn = sym.get('Chinese_name') or (tcmsp_herb.get('name_cn') if tcmsp_herb else '')
        name_pinyin = sym.get('Pinyin_name') or (tcmsp_herb.get('name_pinyin') if tcmsp_herb else '')
        name_latin = sym.get('Latin_name') or (tcmsp_herb.get('name_latin') if tcmsp_herb else '')
        name_eng = sym.get('English_name', '')

        # 传统中医属性（SymMap）
        nature_cn = sym.get('Properties_Chinese', '')
        nature_eng = sym.get('Properties_English', '')
        meridians_cn = sym.get('Meridians_Chinese', '')
        meridians_eng = sym.get('Meridians_English', '')
        category_cn = sym.get('Class_Chinese', '')
        category_eng = sym.get('Class_English', '')
        use_part = sym.get('UsePart', '')
        alias = sym.get('Alias', '')

        # 多源ID映射
        tcmsp_id = sym.get('TCMSP_id')
        symmap_id = sym.get('Herb_id')
        tcmid_id = sym.get('TCMID_id')
        tcmid2_id = sym.get('TCM-ID_id')
        herbdb_id = sym.get('HERBDB_ID', '')

        # 现代药理学数据（TCMSP）
        ob_percent = None
        dl_value = None
        is_food_homology = False
        compounds = []
        targets = []
        diseases = []
        compounds_count = 0
        targets_count = 0
        diseases_count = 0

        if tcmsp_herb:
            ob_percent = truncate_ob(tcmsp_herb.get('ob_percent'))
            dl_value = tcmsp_herb.get('dl_value')
            is_food_homology = tcmsp_herb.get('is_food_homology', False)
            compounds = tcmsp_herb.get('compounds', [])[:50]  # 限制存储数量
            targets = tcmsp_herb.get('targets', [])[:50]
            diseases = tcmsp_herb.get('diseases', [])[:50]
            compounds_count = tcmsp_herb.get('compounds_len', len(compounds))
            targets_count = tcmsp_herb.get('targets_len', len(targets))
            diseases_count = tcmsp_herb.get('diseases_len', len(diseases))

        # 功效
        function_cn = sym.get('Properties_Chinese', '')
        effects_cn = tcmsp_herb.get('effects', '') if tcmsp_herb else ''

        # 图片匹配
        image_path = None
        image_source = None
        matched_img_name, match_score = smart_image_match(
            name_cn, alias, self.image_names
        )
        if matched_img_name:
            image_path = f"data/106FAM/{self.image_names[matched_img_name]}"
            image_source = '106FAM'
            self.image_mapping[name_cn] = self.image_names[matched_img_name]

        # 数据质量评分
        quality_score = self.calc_quality_score(
            name_cn=name_cn,
            nature_cn=nature_cn,
            meridians_cn=meridians_cn,
            category_cn=category_cn,
            ob_percent=ob_percent,
            compounds_count=compounds_count,
            targets_count=targets_count,
            diseases_count=diseases_count,
            has_image=image_path is not None,
        )

        now = datetime.now(timezone.utc).isoformat()

        return {
            'rmchm_id': rmchm_id,
            'rmchm_code': rmchm_code,
            'name_cn': name_cn,
            'name_pinyin': name_pinyin,
            'name_latin': name_latin,
            'name_eng': name_eng,
            'nature_cn': nature_cn,
            'nature_eng': nature_eng,
            'meridians_cn': meridians_cn,
            'meridians_eng': meridians_eng,
            'category_cn': category_cn,
            'category_eng': category_eng,
            'use_part': use_part,
            'alias': alias,
            'function_cn': function_cn,
            'effects_cn': effects_cn,
            'ob_percent': ob_percent,
            'dl_value': dl_value,
            'is_food_homology': is_food_homology,
            'is_toxic': False,
            'tcmsp_id': tcmsp_id,
            'symmap_id': symmap_id,
            'tcmid_id': tcmid_id,
            'tcmid2_id': tcmid2_id,
            'herbdb_id': herbdb_id,
            'compounds_count': compounds_count,
            'targets_count': targets_count,
            'diseases_count': diseases_count,
            'compounds': compounds,
            'targets': targets,
            'diseases': diseases,
            'image_path': image_path,
            'image_source': image_source,
            'image_match_score': round(match_score, 2),
            'data_quality_score': round(quality_score, 2),
            'source_info': {
                'match_method': match_method,
                'has_tcmsp_data': tcmsp_herb is not None,
                'has_symmap_data': bool(sym_herb),
            },
            'synced_at': now,
            'created_at': now,
        }

    def calc_quality_score(self, **kwargs):
        """计算数据质量评分（0-1）"""
        scores = []
        if kwargs.get('name_cn'):
            scores.append(0.15)
        if kwargs.get('name_latin'):
            scores.append(0.05)
        if kwargs.get('nature_cn'):
            scores.append(0.1)
        if kwargs.get('meridians_cn'):
            scores.append(0.1)
        if kwargs.get('category_cn'):
            scores.append(0.05)
        if kwargs.get('ob_percent') is not None:
            scores.append(0.1)
        if kwargs.get('compounds_count', 0) > 0:
            scores.append(0.1)
        if kwargs.get('targets_count', 0) > 0:
            scores.append(0.1)
        if kwargs.get('diseases_count', 0) > 0:
            scores.append(0.05)
        if kwargs.get('has_image'):
            scores.append(0.1)
        return min(sum(scores), 1.0)

    def match_images(self):
        """重新验证图片匹配"""
        print("\n  图片匹配验证...")
        total_images = len(self.image_names)
        matched = len(self.image_mapping)
        print(f"  已匹配: {matched}/{total_images} 张图片")

        # 统计未匹配的图片
        unmatched = set(self.image_names.keys()) - set(self.image_mapping.values())
        if unmatched:
            print(f"  未匹配图片: {len(unmatched)} 张")
            for img in sorted(unmatched):
                # 检查是否在药材名列表中
                found = False
                for herb in self.rmchm_herbs:
                    if calculate_similarity(img, herb['name_cn']) >= 0.85:
                        found = True
                        break
                status = "可模糊匹配" if found else "无匹配"
                print(f"    {img} [{status}]")

    def save_results(self):
        """保存合并结果"""
        out_dir = CONFIG['output_dir']
        os.makedirs(out_dir, exist_ok=True)
        now = datetime.now(timezone.utc).isoformat()

        # 保存合并数据
        out_file = os.path.join(out_dir, 'rmchm_merged_herbs_v2.json')
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(self.rmchm_herbs, f, ensure_ascii=False, indent=2)
        print(f"\n[保存] 合并数据: {out_file} ({os.path.getsize(out_file)//1024}KB)")

        # 保存图片映射
        img_file = os.path.join(out_dir, 'rmchm_image_mapping_v2.json')
        with open(img_file, 'w', encoding='utf-8') as f:
            json.dump(self.image_mapping, f, ensure_ascii=False, indent=2)
        print(f"[保存] 图片映射: {img_file}")

        # 生成合并报告
        food_homology = sum(1 for h in self.rmchm_herbs if h.get('is_food_homology'))
        with_images = sum(1 for h in self.rmchm_herbs if h.get('image_path'))
        with_ob = sum(1 for h in self.rmchm_herbs if h.get('ob_percent') is not None)
        with_nature = sum(1 for h in self.rmchm_herbs if h.get('nature_cn'))
        with_meridians = sum(1 for h in self.rmchm_herbs if h.get('meridians_cn'))
        with_compounds = sum(1 for h in self.rmchm_herbs if h.get('compounds_count', 0) > 0)

        total_compounds = sum(h.get('compounds_count', 0) for h in self.rmchm_herbs)
        total_targets = sum(h.get('targets_count', 0) for h in self.rmchm_herbs)
        total_diseases = sum(h.get('diseases_count', 0) for h in self.rmchm_herbs)

        report = {
            'generated_at': now,
            'version': 'v2.0',
            'summary': {
                'total_herbs': len(self.rmchm_herbs),
                'tcmsp_source': 498,
                'symmap_source': 698,
                'images_source': len(self.image_names),
            },
            'match_statistics': {
                'tcmsp_id_match': self.stats.get('exact', 0),
                'name_match': self.stats.get('fuzzy', 0),
                'symmap_only': self.stats.get('symmap_only', 0),
                'tcmsp_only': self.stats.get('tcmsp_only', 0),
            },
            'data_coverage': {
                'with_ob_percent': with_ob,
                'with_nature_cn': with_nature,
                'with_meridians_cn': with_meridians,
                'with_compounds': with_compounds,
                'with_images': with_images,
                'food_homology_count': food_homology,
            },
            'aggregate_stats': {
                'total_compounds': total_compounds,
                'total_targets': total_targets,
                'total_diseases': total_diseases,
            },
            'image_analysis': {
                'total_images': len(self.image_names),
                'matched_images': len(self.image_mapping),
                'unmatched_images': len(self.image_names) - len(self.image_mapping),
            },
            'match_method_breakdown': self.stats,
        }

        report_file = os.path.join(out_dir, 'rmchm_merge_report_v2.json')
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"[保存] 合并报告: {report_file}")

        # 打印报告摘要
        print("\n" + "=" * 60)
        print("  合并报告摘要")
        print("=" * 60)
        print(f"  总药材数:      {report['summary']['total_herbs']}")
        print(f"  TCMSP来源:     {report['summary']['tcmsp_source']}")
        print(f"  SymMap来源:    {report['summary']['symmap_source']}")
        print(f"  图片资源:      {report['summary']['images_source']} 张")
        print(f"  OB%数据:       {with_ob} 条")
        print(f"  四气数据:      {with_nature} 条")
        print(f"  归经数据:      {with_meridians} 条")
        print(f"  化合物关联:    {with_compounds} 条")
        print(f"  药食同源:      {food_homology} 条")
        print(f"  图片匹配:      {with_images} 条")
        print(f"  化合物总数:    {total_compounds:,}")
        print(f"  靶点总数:      {total_targets:,}")
        print(f"  疾病总数:      {total_diseases:,}")


def main():
    engine = RMCHMMergeEngine()
    engine.execute()


if __name__ == '__main__':
    main()
