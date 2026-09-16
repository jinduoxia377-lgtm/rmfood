"""
RMCHM v3.1 完整合并引擎
结合新旧TCMSP数据，保留完整药理学信息
"""
import json
import os
import re
import uuid
from datetime import datetime, timezone
from difflib import SequenceMatcher

CONFIG = {
    'tcmsp_old': 'D:/RMFOODFP/tcmsp_data/data/db_herbs_export.json',
    'tcmsp_new': 'D:/RMFOODFP/data/TCMSP/tcmsp_herbs.json',
    'symmap_herbs': 'D:/RMFOODFP/data/SymMap/symmap_herbs.json',
    'image_dir': 'D:/RMFOODFP/data/106FAM',
    'output_dir': 'D:/RMFOODFP/data/rmchm',
}

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

def load_images():
    image_names = {}
    if os.path.exists(CONFIG['image_dir']):
        for f in os.listdir(CONFIG['image_dir']):
            if f.endswith('.jpg'):
                image_names[f[:-4]] = f
    return image_names

def smart_image_match(herb_name, herb_alias, image_names):
    candidates = set([herb_name])
    base = re.sub(r'[（(].*?[）)]', '', herb_name).strip()
    if base:
        candidates.add(base)
    if herb_alias:
        for alias in herb_alias.split(','):
            alias = alias.strip()
            candidates.add(alias)
            ba = re.sub(r'[（(].*?[）)]', '', alias).strip()
            if ba:
                candidates.add(ba)
    no_xian = re.sub(r'^鲜/', '', herb_name)
    if no_xian != herb_name:
        candidates.add(no_xian)

    for c in candidates:
        if c in image_names:
            return c, 1.0

    best_score, best_name = 0.0, None
    for img_name in image_names:
        score = calculate_similarity(herb_name, img_name)
        if score > best_score:
            best_score, best_name = score, img_name

    return (best_name, best_score) if best_score >= 0.85 else (None, 0.0)

# 图片映射规则（修复版）
IMAGE_RULES = {
    '八角': '八角茴香',
    '杏仁': '苦杏仁',
    '枣': '大枣',
    '橘皮': '陈皮',
    '益智仁': '益智',
    '紫苏籽': '紫苏子',
    '藿香': '广藿香',
    '鲜芦根': '芦根',
    '黄芥子': '芥子',
    '黑胡椒': '胡椒',
    '桔红': '化橘红',
    '槐米': '槐花',
    '代代花': '代代花',
}

class RMCHMMergeEngine:
    def __init__(self):
        self.rmchm_herbs = []
        self.image_mapping = {}

    def execute(self):
        print("=" * 70)
        print("  RMCHM v3.1 完整合并引擎")
        print("  TCMSP(502) + SymMap(698) + 图片(107)")
        print("=" * 70)

        # 加载旧TCMSP数据（含完整药理学）
        with open(CONFIG['tcmsp_old'], 'r', encoding='utf-8') as f:
            old_data = json.load(f)
        tcmsp_full = old_data.get('herbs', [])
        print(f"\n[加载] TCMSP(完整数据): {len(tcmsp_full)} 条")

        # 加载新TCMSP数据（仅基础名）
        with open(CONFIG['tcmsp_new'], 'r', encoding='utf-8') as f:
            tcmsp_basic = json.load(f)
        print(f"[加载] TCMSP(基础名): {len(tcmsp_basic)} 条")

        # 加载SymMap
        with open(CONFIG['symmap_herbs'], 'r', encoding='utf-8') as f:
            symmap_herbs = json.load(f)
        print(f"[加载] SymMap: {len(symmap_herbs)} 条")

        # 加载图片
        image_names = load_images()
        print(f"[加载] 图片: {len(image_names)} 张")

        # 建立TCMSP名称映射（旧数据有完整信息）
        tcmsp_by_name = {}
        for h in tcmsp_full:
            name = h.get('name_cn', '')
            if name:
                tcmsp_by_name[name] = h

        # 新TCMSP数据中不在旧数据中的药材
        old_names = set(tcmsp_by_name.keys())
        new_tcmsp_only = []
        for h in tcmsp_basic:
            name = h.get('herb_cn_name', '')
            if name and name not in old_names:
                new_tcmsp_only.append({
                    'name_cn': name,
                    'name_pinyin': h.get('herb_pinyin', ''),
                    'name_latin': h.get('herb_en_name', ''),
                    'category_cn': h.get('child_cn_name', ''),
                    'is_new': True,
                })
        print(f"[新TCMSP药材] {len(new_tcmsp_only)} 条（旧数据无）")

        # 合并：以SymMap为主干
        symmap_by_name = {}
        for h in symmap_herbs:
            name = h.get('Chinese_name', '')
            if name:
                symmap_by_name[name] = h

        matched = 0
        only_symmap = 0

        for sym_herb in symmap_herbs:
            sym_name = sym_herb.get('Chinese_name', '')
            tcmsp_herb = tcmsp_by_name.get(sym_name)

            rmchm = self.build_record(sym_herb, tcmsp_herb, image_names)
            self.rmchm_herbs.append(rmchm)

            if tcmsp_herb:
                matched += 1
            else:
                only_symmap += 1

        # TCMSP独有药材
        for th in new_tcmsp_only:
            rmchm = self.build_record({}, th, image_names, is_tcmsp_only=True)
            self.rmchm_herbs.append(rmchm)

        # 应用图片映射规则
        self.apply_image_rules(image_names)

        print(f"\n[合并完成]")
        print(f"  双源匹配: {matched}")
        print(f"  仅SymMap: {only_symmap}")
        print(f"  TCMSP独有: {len(new_tcmsp_only)}")
        print(f"  总计: {len(self.rmchm_herbs)}")
        print(f"  图片匹配: {len(self.image_mapping)}/{len(image_names)}")

        self.save_results()

    def build_record(self, sym_herb, tcmsp_herb, image_names, is_tcmsp_only=False):
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
        symmap_id = sym.get('Herb_id')
        compounds_count = 0
        targets_count = 0
        diseases_count = 0
        compounds = []
        targets = []
        diseases = []

        if tcmsp_herb:
            ob_percent = tcmsp_herb.get('ob_percent')
            dl_value = tcmsp_herb.get('dl_value')
            is_food_homology = tcmsp_herb.get('is_food_homology', False)
            tcmsp_id = tcmsp_herb.get('id')
            compounds = tcmsp_herb.get('compounds', [])[:50]
            targets = tcmsp_herb.get('targets', [])[:50]
            diseases = tcmsp_herb.get('diseases', [])[:50]
            compounds_count = tcmsp_herb.get('compounds_len', len(compounds))
            targets_count = tcmsp_herb.get('targets_len', len(targets))
            diseases_count = tcmsp_herb.get('diseases_len', len(diseases))

        image_path = None
        image_source = None
        matched_img, match_score = smart_image_match(name_cn, alias, image_names)
        if matched_img:
            image_path = f"data/106FAM/{image_names[matched_img]}"
            image_source = '106FAM'
            self.image_mapping[name_cn] = image_names[matched_img]

        has_tcmsp = tcmsp_herb is not None
        has_symmap = bool(sym_herb)

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
            'symmap_id': symmap_id,
            'compounds_count': compounds_count,
            'targets_count': targets_count,
            'diseases_count': diseases_count,
            'compounds': compounds,
            'targets': targets,
            'diseases': diseases,
            'image_path': image_path,
            'image_source': image_source,
            'image_match_score': round(match_score, 2),
            'source_info': {
                'match_method': 'tcmsp_id' if has_tcmsp and has_symmap else ('tcmsp_name' if has_tcmsp else 'symmap_only'),
                'has_tcmsp_data': has_tcmsp,
                'has_symmap_data': has_symmap,
            },
            'synced_at': datetime.now(timezone.utc).isoformat(),
        }

    def apply_image_rules(self, image_names):
        """应用图片映射规则"""
        rules = IMAGE_RULES.copy()
        # 姜特殊处理
        rules['姜（生姜、干姜）'] = ['生姜', '干姜']

        for img_name, target in rules.items():
            if img_name in image_names and img_name not in list(self.image_mapping.values()):
                if isinstance(target, list):
                    for t in target:
                        if t not in self.image_mapping:
                            self.image_mapping[t] = img_name
                else:
                    if target not in self.image_mapping:
                        self.image_mapping[target] = img_name

    def save_results(self):
        out_dir = CONFIG['output_dir']
        os.makedirs(out_dir, exist_ok=True)
        now = datetime.now(timezone.utc).isoformat()

        out_file = os.path.join(out_dir, 'rmchm_merged_herbs_v3.json')
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(self.rmchm_herbs, f, ensure_ascii=False, indent=2)

        img_file = os.path.join(out_dir, 'rmchm_image_mapping_v3.json')
        with open(img_file, 'w', encoding='utf-8') as f:
            json.dump(self.image_mapping, f, ensure_ascii=False, indent=2)

        # 统计
        with_ob = sum(1 for h in self.rmchm_herbs if h.get('ob_percent') is not None)
        with_nature = sum(1 for h in self.rmchm_herbs if h.get('nature_cn'))
        with_meridians = sum(1 for h in self.rmchm_herbs if h.get('meridians_cn'))
        with_images = len(self.image_mapping)
        food_homology = sum(1 for h in self.rmchm_herbs if h.get('is_food_homology'))
        with_compounds = sum(1 for h in self.rmchm_herbs if h.get('compounds_count', 0) > 0)

        total_compounds = sum(h.get('compounds_count', 0) for h in self.rmchm_herbs)
        total_targets = sum(h.get('targets_count', 0) for h in self.rmchm_herbs)
        total_diseases = sum(h.get('diseases_count', 0) for h in self.rmchm_herbs)

        report = {
            'generated_at': now,
            'version': 'v3.1',
            'summary': {
                'total_herbs': len(self.rmchm_herbs),
                'tcmsp_source': 502,
                'symmap_source': 698,
                'images_source': len(CONFIG['image_dir']) and len([f for f in os.listdir(CONFIG['image_dir']) if f.endswith('.jpg')]) if os.path.exists(CONFIG['image_dir']) else 0,
            },
            'data_coverage': {
                'with_ob': with_ob,
                'with_nature': with_nature,
                'with_meridians': with_meridians,
                'with_compounds': with_compounds,
                'with_images': with_images,
                'food_homology': food_homology,
            },
            'aggregate_stats': {
                'total_compounds': total_compounds,
                'total_targets': total_targets,
                'total_diseases': total_diseases,
            },
            'image_analysis': {
                'total_images': 107,
                'matched_images': with_images,
            }
        }

        report_file = os.path.join(out_dir, 'rmchm_merge_report_v3.json')
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        print(f"\n[保存] 合并数据: {out_file}")
        print(f"[保存] 图片映射: {img_file}")
        print(f"[保存] 合并报告: {report_file}")

        print("\n" + "=" * 70)
        print("  RMCHM v3.1 合并报告摘要")
        print("=" * 70)
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
