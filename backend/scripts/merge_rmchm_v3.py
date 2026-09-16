"""
RMCHM v3.0 完整合并引擎
使用正确的TCMSP和SymMap数据路径
"""
import json
import os
import re
import uuid
from datetime import datetime, timezone
from difflib import SequenceMatcher

# ============================================================
# 配置：使用用户指定的正确路径
# ============================================================
CONFIG = {
    'tcmsp_herbs': 'D:/RMFOODFP/data/TCMSP/tcmsp_herbs.json',
    'tcmsp_ingredients': 'D:/RMFOODFP/data/TCMSP/tcmsp_ingredients.json',
    'tcmsp_targets': 'D:/RMFOODFP/data/TCMSP/tcmsp_targets.json',
    'tcmsp_diseases': 'D:/RMFOODFP/data/TCMSP/tcmsp_diseases.json',
    'symmap_herbs': 'D:/RMFOODFP/data/SymMap/symmap_herbs.json',
    'image_dir': 'D:/RMFOODFP/data/106FAM',
    'output_dir': 'D:/RMFOODFP/data/rmchm',
}

# ============================================================
# 工具函数
# ============================================================

def normalize_name(name):
    name = re.sub(r'[（(].*?[）)]', '', name)
    name = re.sub(r'^鲜/', '', name)
    name = re.sub(r'[、,\s]+', '', name)
    return name.strip().lower()

def calculate_similarity(name1, name2):
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)
    if not n1 or not n2:
        return 0.0
    return SequenceMatcher(None, n1, n2).ratio()

def truncate_ob(ob_value):
    try:
        ob = float(ob_value)
        return min(ob, 100.0)
    except (ValueError, TypeError):
        return None

# ============================================================
# 数据加载
# ============================================================

def load_tcmsp_data():
    """加载TCMSP数据"""
    print("\n[加载] TCMSP数据...")

    # 药材基础数据（新格式）
    with open(CONFIG['tcmsp_herbs'], 'r', encoding='utf-8') as f:
        tcmsp_raw = json.load(f)

    # 转换为标准格式
    tcmsp_herbs = []
    for h in tcmsp_raw:
        herb = {
            'id': None,  # TCMSP_id需要从其他地方获取
            'name_cn': h.get('herb_cn_name', ''),
            'name_pinyin': h.get('herb_pinyin', ''),
            'name_latin': h.get('herb_en_name', ''),
            'category_cn': h.get('child_cn_name', ''),
            'category_en': h.get('child_en_name', ''),
        }
        tcmsp_herbs.append(herb)

    print(f"  TCMSP药材: {len(tcmsp_herbs)} 条")

    # 化合物数据
    with open(CONFIG['tcmsp_ingredients'], 'r', encoding='utf-8') as f:
        ingredients = json.load(f)
    print(f"  TCMSP化合物: {len(ingredients)} 条")

    # 靶点数据
    with open(CONFIG['tcmsp_targets'], 'r', encoding='utf-8') as f:
        targets = json.load(f)
    print(f"  TCMSP靶点: {len(targets)} 条")

    # 疾病数据
    with open(CONFIG['tcmsp_diseases'], 'r', encoding='utf-8') as f:
        diseases = json.load(f)
    print(f"  TCMSP疾病: {len(diseases)} 条")

    return tcmsp_herbs, ingredients, targets, diseases

def load_symmap_data():
    """加载SymMap数据"""
    print("\n[加载] SymMap数据...")
    with open(CONFIG['symmap_herbs'], 'r', encoding='utf-8') as f:
        symmap_herbs = json.load(f)
    print(f"  SymMap药材: {len(symmap_herbs)} 条")
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

# ============================================================
# 图片匹配
# ============================================================

def smart_image_match(herb_name, herb_alias, image_names):
    candidates = set()
    candidates.add(herb_name)
    base = re.sub(r'[（(].*?[）)]', '', herb_name).strip()
    if base:
        candidates.add(base)
    if herb_alias:
        for alias in herb_alias.split(','):
            alias = alias.strip()
            candidates.add(alias)
            base_alias = re.sub(r'[（(].*?[）)]', '', alias).strip()
            if base_alias:
                candidates.add(base_alias)
    no_xian = re.sub(r'^鲜/', '', herb_name)
    if no_xian != herb_name:
        candidates.add(no_xian)

    for c in candidates:
        if c in image_names:
            return c, 1.0

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

# ============================================================
# 核心合并引擎
# ============================================================

class RMCHMMergeEngine:
    def __init__(self):
        self.tcmsp_herbs = []
        self.symmap_herbs = []
        self.image_names = {}
        self.rmchm_herbs = []
        self.image_mapping = {}

    def execute(self):
        print("=" * 70)
        print("  RMCHM v3.0 专业合并引擎")
        print("  TCMSP(502) + SymMap(698) + 图片(107)")
        print("=" * 70)

        self.tcmsp_herbs, _, _, _ = load_tcmsp_data()
        self.symmap_herbs = load_symmap_data()
        self.image_names = load_images()

        self.merge()
        self.save_results()

    def merge(self):
        print("\n" + "=" * 70)
        print("  合并阶段")
        print("=" * 70)

        # 建立TCMSP名称映射
        tcmsp_by_name = {}
        for h in self.tcmsp_herbs:
            name = h.get('name_cn', '')
            if name:
                tcmsp_by_name[name] = h

        matched_count = 0
        only_symmap = 0

        # 以SymMap为主干
        for sym_herb in self.symmap_herbs:
            sym_name = sym_herb.get('Chinese_name', '')
            sym_tcmsp_id = sym_herb.get('TCMSP_id')

            # 尝试匹配TCMSP
            tcmsp_herb = None
            if sym_tcmsp_id:
                for th in self.tcmsp_herbs:
                    # 新TCMSP数据没有id字段，需要通过名称匹配
                    pass

            # 名称匹配
            if sym_name in tcmsp_by_name:
                tcmsp_herb = tcmsp_by_name[sym_name]

            # 构建RMCHM记录
            rmchm = self.build_record(sym_herb, tcmsp_herb)
            self.rmchm_herbs.append(rmchm)

            if tcmsp_herb:
                matched_count += 1
            else:
                only_symmap += 1

        # TCMSP独有药材
        symmap_names = set(h.get('Chinese_name', '') for h in self.symmap_herbs)
        for th in self.tcmsp_herbs:
            if th.get('name_cn') not in symmap_names:
                rmchm = self.build_record({}, th)
                self.rmchm_herbs.append(rmchm)

        print(f"\n  合并完成:")
        print(f"    双源匹配: {matched_count}")
        print(f"    仅SymMap: {only_symmap}")
        print(f"    总计: {len(self.rmchm_herbs)}")

        # 图片匹配
        self.match_images()

    def build_record(self, sym_herb, tcmsp_herb):
        sym = sym_herb if sym_herb else {}
        rmchm_id = str(uuid.uuid4())[:8].upper()
        rmchm_code = f"RMCHM-{rmchm_id}"

        name_cn = sym.get('Chinese_name') or (tcmsp_herb.get('name_cn') if tcmsp_herb else '')
        name_pinyin = sym.get('Pinyin_name') or (tcmsp_herb.get('name_pinyin') if tcmsp_herb else '')
        name_latin = sym.get('Latin_name') or (tcmsp_herb.get('name_latin') if tcmsp_herb else '')
        nature_cn = sym.get('Properties_Chinese', '')
        meridians_cn = sym.get('Meridians_Chinese', '')
        category_cn = sym.get('Class_Chinese', '')
        use_part = sym.get('UsePart', '')
        alias = sym.get('Alias', '')
        function_cn = sym.get('Properties_Chinese', '')

        ob_percent = None
        dl_value = None
        is_food_homology = False
        tcmsp_id = sym.get('TCMSP_id')

        if tcmsp_herb:
            # 新TCMSP数据没有OB/DL字段，需要从其他地方获取
            pass

        image_path = None
        image_source = None
        matched_img, match_score = smart_image_match(name_cn, alias, self.image_names)
        if matched_img:
            image_path = f"data/106FAM/{self.image_names[matched_img]}"
            image_source = '106FAM'
            self.image_mapping[name_cn] = self.image_names[matched_img]

        return {
            'rmchm_id': rmchm_id,
            'rmchm_code': rmchm_code,
            'name_cn': name_cn,
            'name_pinyin': name_pinyin,
            'name_latin': name_latin,
            'nature_cn': nature_cn,
            'meridians_cn': meridians_cn,
            'category_cn': category_cn,
            'use_part': use_part,
            'alias': alias,
            'function_cn': function_cn,
            'ob_percent': ob_percent,
            'dl_value': dl_value,
            'is_food_homology': is_food_homology,
            'tcmsp_id': tcmsp_id,
            'symmap_id': sym.get('Herb_id'),
            'image_path': image_path,
            'image_source': image_source,
            'image_match_score': round(match_score, 2),
            'source_info': {
                'match_method': 'tcmsp_name' if tcmsp_herb else 'symmap_only',
                'has_tcmsp_data': tcmsp_herb is not None,
                'has_symmap_data': bool(sym_herb),
            },
            'synced_at': datetime.now(timezone.utc).isoformat(),
        }

    def match_images(self):
        print("\n  图片匹配...")
        matched = len(self.image_mapping)
        print(f"  已匹配: {matched}/{len(self.image_names)}")

    def save_results(self):
        out_dir = CONFIG['output_dir']
        os.makedirs(out_dir, exist_ok=True)
        now = datetime.now(timezone.utc).isoformat()

        # 保存合并数据
        out_file = os.path.join(out_dir, 'rmchm_merged_herbs_v3.json')
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(self.rmchm_herbs, f, ensure_ascii=False, indent=2)
        print(f"\n[保存] 合并数据: {out_file}")

        # 保存图片映射
        img_file = os.path.join(out_dir, 'rmchm_image_mapping_v3.json')
        with open(img_file, 'w', encoding='utf-8') as f:
            json.dump(self.image_mapping, f, ensure_ascii=False, indent=2)
        print(f"[保存] 图片映射: {img_file}")

        # 统计报告
        with_images = sum(1 for h in self.rmchm_herbs if h.get('image_path'))
        with_ob = sum(1 for h in self.rmchm_herbs if h.get('ob_percent'))
        with_nature = sum(1 for h in self.rmchm_herbs if h.get('nature_cn'))
        with_meridians = sum(1 for h in self.rmchm_herbs if h.get('meridians_cn'))
        food_homology = sum(1 for h in self.rmchm_herbs if h.get('is_food_homology'))

        report = {
            'generated_at': now,
            'version': 'v3.0',
            'summary': {
                'total_herbs': len(self.rmchm_herbs),
                'tcmsp_source': len(self.tcmsp_herbs),
                'symmap_source': len(self.symmap_herbs),
                'images_source': len(self.image_names),
            },
            'data_coverage': {
                'with_ob': with_ob,
                'with_nature': with_nature,
                'with_meridians': with_meridians,
                'with_images': with_images,
                'food_homology': food_homology,
            },
            'image_analysis': {
                'total_images': len(self.image_names),
                'matched_images': len(self.image_mapping),
            }
        }

        report_file = os.path.join(out_dir, 'rmchm_merge_report_v3.json')
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"[保存] 合并报告: {report_file}")

        print("\n" + "=" * 70)
        print("  合并报告摘要")
        print("=" * 70)
        print(f"  总药材数:    {report['summary']['total_herbs']}")
        print(f"  TCMSP来源:   {report['summary']['tcmsp_source']}")
        print(f"  SymMap来源:  {report['summary']['symmap_source']}")
        print(f"  图片资源:    {report['summary']['images_source']} 张")
        print(f"  四气数据:    {with_nature} 条")
        print(f"  归经数据:    {with_meridians} 条")
        print(f"  图片匹配:    {with_images} 条")
        print(f"  药食同源:    {food_homology} 条")


def main():
    engine = RMCHMMergeEngine()
    engine.execute()


if __name__ == '__main__':
    main()
