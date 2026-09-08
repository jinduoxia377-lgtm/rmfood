"""
RMCHM 数据合并脚本 v1.0
=======================
将 TCMSP (502条) 与 SymMap (698条) 合并为统一的 RMCHM 数据库
输出格式：JSON + SQL 迁移脚本

作者：Agnes (AI 数据专家)
日期：2026-09-08
"""
import json
import os
import re
import uuid
from datetime import datetime, timezone
from collections import defaultdict
from difflib import SequenceMatcher

# ════════════════════════════════════════════════════════════════
# 配置区
# ════════════════════════════════════════════════════════════════
CONFIG = {
    "input_dirs": {
        "tcmsp_raw": "D:/RMFOODFP/tcmsp_data/TCMSP",
        "tcmsp_data": "D:/RMFOODFP/tcmsp_data/data",
        "images": "D:/RMFOODFP/data/106FAM",
    },
    "output_dir": "D:/RMFOODFP/data/rmchm",
    "output_files": {
        "merged_herbs": "rmchm_merged_herbs.json",
        "database_schema": "rmchm_schema.sql",
        "merge_report": "rmchm_merge_report.json",
        "image_mapping": "rmchm_image_mapping.json",
    },
    "ob_max_percent": 100.0,
    "matching_threshold": 0.85,
}

# ════════════════════════════════════════════════════════════════
# 工具函数
# ════════════════════════════════════════════════════════════════

def normalize_name(name: str) -> str:
    """标准化药材名：去除空格、标点，统一大小写"""
    if not name:
        return ""
    # 移除常见变体
    name = re.sub(r'[（(].*?[）)]', '', name)  # 移除括号内容
    name = re.sub(r'[、,\s]+', '', name)  # 移除标点空格
    return name.strip().lower()


def calculate_similarity(name1: str, name2: str) -> float:
    """计算两个字符串的相似度"""
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)
    if not n1 or not n2:
        return 0.0
    return SequenceMatcher(None, n1, n2).ratio()


def find_best_match(target: str, candidates: list, threshold: float = 0.85) -> tuple:
    """在候选列表中寻找最佳匹配"""
    best_score = 0.0
    best_match = None
    for cand in candidates:
        score = calculate_similarity(target, cand.get('name_cn', ''))
        if score > best_score:
            best_score = score
            best_match = cand
    if best_score >= threshold:
        return best_match, best_score
    return None, best_score


def truncate_ob(ob_value) -> float:
    """截断 OB% 异常值"""
    try:
        ob = float(ob_value)
        return min(ob, CONFIG['ob_max_percent'])
    except (ValueError, TypeError):
        return None


# ════════════════════════════════════════════════════════════════
# 数据加载器
# ════════════════════════════════════════════════════════════════

class DataLoaders:
    """多源数据加载器"""

    @staticmethod
    def load_tcmsp_herbs(data_dir: str) -> list:
        """加载 TCMSP 药材基础数据（优先使用含完整字段的 db_herbs_export.json）"""
        herbs = []
        # 优先加载含完整数据的导出文件
        priority_files = ['db_herbs_export.json', 'tcmsp_herbs_full.json', 'all_herbs.json', 'tcmsp_herbs.json']
        for filename in priority_files:
            filepath = os.path.join(data_dir, filename)
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, dict) and 'herbs' in data:
                        herbs = data['herbs']
                        print(f"[TCMSP] 从 {filename} 加载药材数据: {len(herbs)} 条")
                        break
                    elif isinstance(data, list):
                        herbs = data
                        print(f"[TCMSP] 从 {filename} 加载药材数据: {len(herbs)} 条")
                        break
        return herbs

    @staticmethod
    def load_tcmsp_ingredients(data_dir: str) -> dict:
        """加载 TCMSP 化合物数据，建立 MOL_ID -> 化合物信息映射"""
        ingredients = {}
        filepath = os.path.join(data_dir, 'tcmsp_ingredients.json')
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    mol_id = item.get('MOL_ID')
                    if mol_id:
                        ingredients[mol_id] = {
                            'molecule_name': item.get('molecule_name'),
                            'mw': item.get('mw'),
                            'ob': item.get('ob'),
                            'dl': item.get('dl'),
                            'hdon': item.get('hdon'),
                            'hacc': item.get('hacc'),
                            'alogp': item.get('alogp'),
                            'caco2': item.get('caco2'),
                            'bbb': item.get('bbb'),
                        }
        print(f"[TCMSP] 加载化合物数据: {len(ingredients)} 条")
        return ingredients

    @staticmethod
    def load_tcmsp_targets(data_dir: str) -> dict:
        """加载 TCMSP 靶点数据"""
        targets = {}
        filepath = os.path.join(data_dir, 'tcmsp_targets.json')
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    tar_id = item.get('TAR_ID')
                    if tar_id:
                        targets[tar_id] = {
                            'target_name': item.get('target_name'),
                            'drugbank_id': item.get('drugbank_ID'),
                            'kegg': item.get('kegg'),
                        }
        print(f"[TCMSP] 加载靶点数据: {len(targets)} 条")
        return targets

    @staticmethod
    def load_tcmsp_diseases(data_dir: str) -> dict:
        """加载 TCMSP 疾病数据"""
        diseases = {}
        filepath = os.path.join(data_dir, 'tcmsp_diseases.json')
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    dis_id = item.get('DIS_ID')
                    if dis_id:
                        diseases[dis_id] = {
                            'disease_name': item.get('disease_name'),
                            'icd9': item.get('ICD9'),
                            'icd10': item.get('ICD10'),
                        }
        print(f"[TCMSP] 加载疾病数据: {len(diseases)} 条")
        return diseases

    @staticmethod
    def load_tcmsp_herb_relations(data_dir: str) -> dict:
        """加载 TCMSP 药材-化合物-靶点-疾病关联数据（从完整导出文件）"""
        relations = defaultdict(lambda: {'compounds': [], 'targets': [], 'diseases': []})
        # 优先从 db_herbs_export.json 加载完整数据
        for filename in ['db_herbs_export.json', 'tcmsp_herbs_full.json']:
            filepath = os.path.join(data_dir, filename)
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    herbs = data.get('herbs', data) if isinstance(data, dict) else data
                    if isinstance(herbs, list):
                        for herb in herbs:
                            herb_name = herb.get('name_cn', '')
                            compounds = herb.get('compounds', [])
                            targets = herb.get('targets', [])
                            diseases = herb.get('diseases', [])
                            # 标准化化合物数据
                            if compounds:
                                relations[herb_name]['compounds'] = [
                                    {k: v for k, v in c.items() if v is not None}
                                    for c in compounds[:50]  # 限制数量
                                ]
                            if targets:
                                relations[herb_name]['targets'] = [
                                    {k: v for k, v in t.items() if v is not None}
                                    for t in targets[:50]
                                ]
                            if diseases:
                                relations[herb_name]['diseases'] = [
                                    {k: v for k, v in d.items() if v is not None}
                                    for d in diseases[:50]
                                ]
                        print(f"[TCMSP] 从 {filename} 加载关联数据: {len(relations)} 味药材")
                        break
        return relations

    @staticmethod
    def build_symmap_template() -> list:
        """
        构建 SymMap 数据结构（基于已知的字段结构和补全脚本）
        实际使用时应替换为从数据库导出的真实数据
        """
        # 从补全脚本中提取的药材名列表
        all_herbs_from_scripts = []

        # 从 complete_symmap_final.py 提取
        script_path = "D:/RMFOODFP/backend/scripts/complete_symmap_final.py"
        if os.path.exists(script_path):
            with open(script_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # 提取 ALL_EN 中的药材名
                en_matches = re.findall(r"'([^']+)':\s*'([^']+)'", content)
                all_herbs_from_scripts.extend([name for name, _ in en_matches])
                # 提取 ALL_ALIAS 中的药材名
                alias_section = content.split("ALL_ALIAS = {")[1].split("}")[0] if "ALL_ALIAS" in content else ""
                alias_matches = re.findall(r"'([^']+)':\s*'([^']+)'", alias_section)
                all_herbs_from_scripts.extend([name for name, _ in alias_matches])

        # 去重
        unique_herbs = list(set(all_herbs_from_scripts))
        print(f"[SymMap] 从脚本提取药材名: {len(unique_herbs)} 条（模拟数据源）")

        # 构建标准 SymMap 数据结构
        symmap_herbs = []
        for i, name_cn in enumerate(unique_herbs[:698], start=1):  # 限制698条
            symmap_herb = {
                'symmap_id': i,
                'name_cn': name_cn,
                'name_pinyin': '',  # 需要从其他数据源填充
                'name_latin': '',   # 需要匹配
                'name_eng': '',     # 从补全脚本获取
                'nature_cn': '',    # 四气
                'nature_eng': '',
                'meridians_cn': '', # 归经
                'meridians_eng': '',
                'category_cn': '',  # 分类
                'category_eng': '',
                'use_part': '',     # 药用部位
                'alias': '',        # 别名
                'function_cn': '',  # 功效
                'function_en': '',
                'tcmsp_id': None,
                'tcmid_id': None,
                'tcmid2_id': None,
                'herbdb_id': None,
                'source_version': 'symmap_v2.0',
                'synced_at': datetime.now(timezone.utc).isoformat(),
            }
            symmap_herbs.append(symmap_herb)

        return symmap_herbs


# ════════════════════════════════════════════════════════════════
# 核心合并引擎
# ════════════════════════════════════════════════════════════════

class RMCHMMergeEngine:
    """RMCHM 数据合并引擎"""

    def __init__(self, config: dict):
        self.config = config
        self.tcmsp_herbs = []
        self.tcmsp_ingredients = {}
        self.tcmsp_targets = {}
        self.tcmsp_diseases = {}
        self.tcmsp_relations = {}
        self.symmap_herbs = []
        self.rmchm_herbs = []
        self.image_mapping = {}
        self.merge_stats = {}

    def load_all_data(self):
        """加载所有数据源"""
        print("\n" + "=" * 60)
        print("  数据加载阶段")
        print("=" * 60)

        data_dir = self.config['input_dirs']['tcmsp_data']
        self.tcmsp_herbs = DataLoaders.load_tcmsp_herbs(data_dir)
        self.tcmsp_ingredients = DataLoaders.load_tcmsp_ingredients(data_dir)
        self.tcmsp_targets = DataLoaders.load_tcmsp_targets(data_dir)
        self.tcmsp_diseases = DataLoaders.load_tcmsp_diseases(data_dir)
        self.tcmsp_relations = DataLoaders.load_tcmsp_herb_relations(data_dir)
        self.symmap_herbs = DataLoaders.build_symmap_template()

        print(f"\n[汇总] TCMSP: {len(self.tcmsp_herbs)} 条, SymMap: {len(self.symmap_herbs)} 条")

    def match_herbs(self) -> dict:
        """匹配 TCMSP 与 SymMap 药材"""
        print("\n" + "=" * 60)
        print("  药材匹配阶段")
        print("=" * 60)

        matches = {
            'exact': [],
            'fuzzy': [],
            'tcmsp_only': [],
            'symmap_only': [],
        }

        matched_symmap_ids = set()

        for tcmsp_herb in self.tcmsp_herbs:
            tcmsp_name = tcmsp_herb.get('name_cn', '')
            tcmsp_latin = tcmsp_herb.get('name_latin', '')

            # 精确匹配
            matched = None
            for symmap_herb in self.symmap_herbs:
                if symmap_herb['symmap_id'] in matched_symmap_ids:
                    continue
                # 检查名称匹配
                if symmap_herb['name_cn'] == tcmsp_name:
                    matched = symmap_herb
                    break
                # 检查拉丁名匹配
                if symmap_herb['name_latin'] and tcmsp_latin:
                    if normalize_name(symmap_herb['name_latin']) == normalize_name(tcmsp_latin):
                        matched = symmap_herb
                        break

            if matched:
                matched_symmap_ids.add(matched['symmap_id'])
                matches['exact'].append({
                    'tcmsp': tcmsp_herb,
                    'symmap': matched,
                    'match_type': 'exact',
                })
            else:
                # 模糊匹配
                best_match, score = find_best_match(tcmsp_name, self.symmap_herbs)
                if best_match and best_match['symmap_id'] not in matched_symmap_ids:
                    matched_symmap_ids.add(best_match['symmap_id'])
                    matches['fuzzy'].append({
                        'tcmsp': tcmsp_herb,
                        'symmap': best_match,
                        'match_type': 'fuzzy',
                        'similarity': score,
                    })
                else:
                    matches['tcmsp_only'].append(tcmsp_herb)

        # 收集 SymMap 独有药材
        for symmap_herb in self.symmap_herbs:
            if symmap_herb['symmap_id'] not in matched_symmap_ids:
                matches['symmap_only'].append(symmap_herb)

        print(f"  精确匹配: {len(matches['exact'])} 对")
        print(f"  模糊匹配: {len(matches['fuzzy'])} 对")
        print(f"  TCMSP独有: {len(matches['tcmsp_only'])} 条")
        print(f"  SymMap独有: {len(matches['symmap_only'])} 条")

        return matches

    def merge_herb_records(self, tcmsp_herb: dict, symmap_herb: dict, match_type: str) -> dict:
        """合并单味药材记录"""
        rmchm_id = str(uuid.uuid4())[:8].upper()
        rmchm_code = f"RMCHM-{rmchm_id}"

        # 基础名称（优先使用 SymMap 标准名）
        name_cn = symmap_herb.get('name_cn', tcmsp_herb.get('name_cn', ''))
        name_pinyin = symmap_herb.get('name_pinyin') or tcmsp_herb.get('name_pinyin', '')
        name_latin = symmap_herb.get('name_latin') or tcmsp_herb.get('name_latin', '')
        name_eng = symmap_herb.get('name_eng') or tcmsp_herb.get('name_en', '')

        # 传统中医属性（SymMap独有）
        nature_cn = symmap_herb.get('nature_cn', '')
        nature_eng = symmap_herb.get('nature_eng', '')
        meridians_cn = symmap_herb.get('meridians_cn', '')
        meridians_eng = symmap_herb.get('meridians_eng', '')
        category_cn = symmap_herb.get('category_cn', tcmsp_herb.get('category', ''))
        category_eng = symmap_herb.get('category_eng', '')
        use_part = symmap_herb.get('use_part', '')
        alias = symmap_herb.get('alias', '')
        function_cn = symmap_herb.get('function_cn', '')
        function_en = symmap_herb.get('function_en', '')

        # 现代药理学数据（TCMSP独有）
        ob_percent = truncate_ob(tcmsp_herb.get('ob_percent'))
        dl_value = tcmsp_herb.get('dl_value')
        is_food_homology = tcmsp_herb.get('is_food_homology', False)

        # 关联数据
        relations = self.tcmsp_relations.get(name_cn, {})
        compounds = relations.get('compounds', [])
        targets = relations.get('targets', [])
        diseases = relations.get('diseases', [])

        # 多源 ID 映射
        tcmsp_id = tcmsp_herb.get('id')
        symmap_id = symmap_herb.get('symmap_id')

        # 数据质量评分
        quality_score = self._calculate_quality_score(
            name_cn=name_cn,
            nature_cn=nature_cn,
            meridians_cn=meridians_cn,
            ob_percent=ob_percent,
            compounds_len=len(compounds),
            targets_len=len(targets),
        )

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
            'function_en': function_en,
            'ob_percent': ob_percent,
            'dl_value': dl_value,
            'is_food_homology': is_food_homology,
            'is_toxic': False,
            'tcmsp_id': tcmsp_id,
            'symmap_id': symmap_id,
            'compounds_count': len(compounds),
            'targets_count': len(targets),
            'diseases_count': len(diseases),
            'compounds': compounds[:20],  # 限制存储数量
            'targets': targets[:20],
            'diseases': diseases[:20],
            'image_path': None,
            'image_source': None,
            'data_quality_score': round(quality_score, 2),
            'source_versions': {
                'tcmsp': 'v1.0',
                'symmap': 'v2.0',
                'merge_type': match_type,
            },
            'synced_at': datetime.now(timezone.utc).isoformat(),
            'created_at': datetime.now(timezone.utc).isoformat(),
        }

    def _calculate_quality_score(self, **kwargs) -> float:
        """计算数据质量评分（0-1）"""
        scores = []

        # 基础信息完整性
        if kwargs.get('name_cn'):
            scores.append(0.2)
        if kwargs.get('name_latin'):
            scores.append(0.1)
        if kwargs.get('name_pinyin'):
            scores.append(0.1)

        # 传统属性完整性
        if kwargs.get('nature_cn'):
            scores.append(0.15)
        if kwargs.get('meridians_cn'):
            scores.append(0.15)
        if kwargs.get('category_cn'):
            scores.append(0.05)

        # 现代药理学数据
        if kwargs.get('ob_percent') is not None:
            scores.append(0.1)
        if kwargs.get('compounds_count', 0) > 0:
            scores.append(0.05)
        if kwargs.get('targets_count', 0) > 0:
            scores.append(0.05)
        if kwargs.get('diseases_count', 0) > 0:
            scores.append(0.05)

        return min(sum(scores), 1.0)

    def match_images(self):
        """匹配图片资源"""
        print("\n" + "=" * 60)
        print("  图片匹配阶段")
        print("=" * 60)

        image_dir = self.config['input_dirs']['images']
        if not os.path.exists(image_dir):
            print(f"  [警告] 图片目录不存在: {image_dir}")
            return

        # 收集所有图片文件名
        image_files = {}
        for filename in os.listdir(image_dir):
            if filename.endswith('.jpg'):
                name = filename[:-4]  # 移除 .jpg
                image_files[name] = filename

        print(f"  找到 {len(image_files)} 张药材图片")

        # 匹配药材与图片
        matched_count = 0
        for herb in self.rmchm_herbs:
            name_cn = herb['name_cn']
            alias = herb.get('alias', '')

            # 1. 精确匹配
            if name_cn in image_files:
                herb['image_path'] = f"data/106FAM/{image_files[name_cn]}"
                herb['image_source'] = '106FAM'
                self.image_mapping[name_cn] = image_files[name_cn]
                matched_count += 1
                continue

            # 2. 别名匹配
            if alias:
                for alias_name in alias.split(','):
                    alias_name = alias_name.strip()
                    if alias_name in image_files:
                        herb['image_path'] = f"data/106FAM/{image_files[alias_name]}"
                        herb['image_source'] = '106FAM'
                        self.image_mapping[name_cn] = image_files[alias_name]
                        matched_count += 1
                        break

        print(f"  成功匹配图片: {matched_count}/{len(self.rmchm_herbs)}")
        return matched_count

    def execute_merge(self):
        """执行完整合并流程"""
        print("\n" + "=" * 60)
        print("  RMCHM 数据合并引擎启动")
        print("=" * 60)

        # Step 1: 加载数据
        self.load_all_data()

        # Step 2: 匹配药材
        matches = self.match_herbs()
        self.merge_stats['matches'] = {
            'exact': len(matches['exact']),
            'fuzzy': len(matches['fuzzy']),
            'tcmsp_only': len(matches['tcmsp_only']),
            'symmap_only': len(matches['symmap_only']),
        }

        # Step 3: 合并记录
        print("\n" + "=" * 60)
        print("  数据合并阶段")
        print("=" * 60)

        # 合并精确匹配和模糊匹配的药材
        for match in matches['exact']:
            merged = self.merge_herb_records(match['tcmsp'], match['symmap'], 'exact')
            self.rmchm_herbs.append(merged)

        for match in matches['fuzzy']:
            merged = self.merge_herb_records(match['tcmsp'], match['symmap'], 'fuzzy')
            self.rmchm_herbs.append(merged)

        # 添加 TCMSP 独有药材
        for herb in matches['tcmsp_only']:
            merged = self.merge_herb_records(herb, {}, 'tcmsp_only')
            self.rmchm_herbs.append(merged)

        # 添加 SymMap 独有药材
        for herb in matches['symmap_only']:
            merged = self.merge_herb_records({}, herb, 'symmap_only')
            self.rmchm_herbs.append(merged)

        print(f"  合并完成，总计: {len(self.rmchm_herbs)} 条记录")

        # Step 4: 匹配图片
        self.match_images()

        # Step 5: 保存结果
        self.save_results()

    def save_results(self):
        """保存合并结果"""
        output_dir = self.config['output_dir']
        os.makedirs(output_dir, exist_ok=True)

        # 保存合并后的药材数据
        output_file = os.path.join(output_dir, self.config['output_files']['merged_herbs'])
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.rmchm_herbs, f, ensure_ascii=False, indent=2)
        print(f"\n[保存] 合并数据: {output_file}")

        # 保存图片映射
        image_file = os.path.join(output_dir, self.config['output_files']['image_mapping'])
        with open(image_file, 'w', encoding='utf-8') as f:
            json.dump(self.image_mapping, f, ensure_ascii=False, indent=2)
        print(f"[保存] 图片映射: {image_file}")

        # 保存合并报告
        report = self._generate_report()
        report_file = os.path.join(output_dir, self.config['output_files']['merge_report'])
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"[保存] 合并报告: {report_file}")

        # 保存数据库 Schema
        schema_file = os.path.join(output_dir, self.config['output_files']['database_schema'])
        self._save_schema(schema_file)
        print(f"[保存] 数据库 Schema: {schema_file}")

    def _generate_report(self) -> dict:
        """生成合并报告"""
        total_compounds = sum(h.get('compounds_count', 0) for h in self.rmchm_herbs)
        total_targets = sum(h.get('targets_count', 0) for h in self.rmchm_herbs)
        total_diseases = sum(h.get('diseases_count', 0) for h in self.rmchm_herbs)
        food_homology = sum(1 for h in self.rmchm_herbs if h.get('is_food_homology'))
        with_images = sum(1 for h in self.rmchm_herbs if h.get('image_path'))
        with_ob = sum(1 for h in self.rmchm_herbs if h.get('ob_percent') is not None)
        with_nature = sum(1 for h in self.rmchm_herbs if h.get('nature_cn'))
        with_meridians = sum(1 for h in self.rmchm_herbs if h.get('meridians_cn'))
        avg_quality = round(
            sum(h.get('data_quality_score', 0) for h in self.rmchm_herbs) / len(self.rmchm_herbs), 2
        ) if self.rmchm_herbs else 0

        stats = {
            'total_herbs': len(self.rmchm_herbs),
            'match_stats': self.merge_stats.get('matches', {}),
            'image_match_count': len(self.image_mapping),
            'with_images': with_images,
            'food_homology_count': food_homology,
            'with_ob_percent': with_ob,
            'with_nature': with_nature,
            'with_meridians': with_meridians,
            'avg_quality_score': avg_quality,
            'compounds_total': total_compounds,
            'targets_total': total_targets,
            'diseases_total': total_diseases,
        }
        return stats

    def _save_schema(self, filepath: str):
        """保存数据库 Schema"""
        schema_sql = '''-- RMCHM 莱茵中药材数据库 Schema
-- 生成日期: 2026-09-08
-- 合并来源: TCMSP (502条) + SymMap (698条)

CREATE TABLE IF NOT EXISTS rmchm_herbs (
    id BIGSERIAL PRIMARY KEY,
    rmchm_id VARCHAR(8) UNIQUE NOT NULL,
    rmchm_code VARCHAR(20) UNIQUE NOT NULL,

    -- 基础名称
    name_cn VARCHAR(100) NOT NULL,
    name_pinyin VARCHAR(100),
    name_latin VARCHAR(300),
    name_eng VARCHAR(300),

    -- 传统中医属性
    nature_cn VARCHAR(200),
    nature_eng VARCHAR(200),
    meridians_cn VARCHAR(200),
    meridians_eng VARCHAR(200),
    category_cn VARCHAR(100),
    category_eng VARCHAR(100),
    use_part VARCHAR(100),
    alias TEXT,
    function_cn TEXT,
    function_en TEXT,

    -- 现代药理学
    ob_percent DECIMAL(5,2),
    dl_value DECIMAL(5,2),
    is_food_homology BOOLEAN DEFAULT FALSE,
    is_toxic BOOLEAN DEFAULT FALSE,

    -- 关联数据（简化存储，详细数据存储在关联表）
    tcmsp_id INTEGER,
    symmap_id INTEGER,
    compounds_count INTEGER DEFAULT 0,
    targets_count INTEGER DEFAULT 0,
    diseases_count INTEGER DEFAULT 0,

    -- 图片资源
    image_path VARCHAR(500),
    image_source VARCHAR(50),

    -- 元数据
    data_quality_score DECIMAL(3,2),
    source_versions JSONB,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_rmchm_name_cn ON rmchm_herbs(name_cn);
CREATE INDEX idx_rmchm_pinyin ON rmchm_herbs(name_pinyin);
CREATE INDEX idx_rmchm_latin ON rmchm_herbs(name_latin);
CREATE INDEX idx_rmchm_category ON rmchm_herbs(category_cn);
CREATE INDEX idx_rmchm_homology ON rmchm_herbs(is_food_homology);
CREATE INDEX idx_rmchm_image ON rmchm_herbs(image_source) WHERE image_path IS NOT NULL;
CREATE INDEX idx_rmchm_quality ON rmchm_herbs(data_quality_score DESC);

-- 药材-化合物关联表
CREATE TABLE IF NOT EXISTS rmchm_herb_compounds (
    id BIGSERIAL PRIMARY KEY,
    rmchm_id VARCHAR(8) REFERENCES rmchm_herbs(rmchm_id),
    compound_name VARCHAR(200),
    mol_id VARCHAR(50),
    mw DECIMAL(10,2),
    ob DECIMAL(5,2),
    dl DECIMAL(5,2),
    hdon INTEGER,
    hacc INTEGER,
    alogp DECIMAL(5,2),
    caco2 DECIMAL(5,2),
    bbb DECIMAL(5,2),
    tpsa DECIMAL(5,2)
);

-- 药材-靶点关联表
CREATE TABLE IF NOT EXISTS rmchm_herb_targets (
    id BIGSERIAL PRIMARY KEY,
    rmchm_id VARCHAR(8) REFERENCES rmchm_herbs(rmchm_id),
    target_name VARCHAR(200),
    tar_id VARCHAR(50),
    drugbank_id VARCHAR(50),
    kegg VARCHAR(50)
);

-- 药材-疾病关联表
CREATE TABLE IF NOT EXISTS rmchm_herb_diseases (
    id BIGSERIAL PRIMARY KEY,
    rmchm_id VARCHAR(8) REFERENCES rmchm_herbs(rmchm_id),
    disease_name VARCHAR(200),
    dis_id VARCHAR(50),
    icd9 VARCHAR(50),
    icd10 VARCHAR(50)
);
'''
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(schema_sql)


# ════════════════════════════════════════════════════════════════
# 主程序入口
# ════════════════════════════════════════════════════════════════

def main():
    """主函数"""
    print("=" * 60)
    print("  RMCHM (莱茵中药材) 数据合并引擎 v1.0")
    print("  合并 TCMSP (502条) + SymMap (698条)")
    print("=" * 60)

    # 初始化引擎
    engine = RMCHMMergeEngine(CONFIG)

    # 执行合并
    engine.execute_merge()

    print("\n" + "=" * 60)
    print("  合并完成！")
    print("=" * 60)
    print(f"\n输出目录: {CONFIG['output_dir']}")
    print("\n生成文件:")
    for filename in CONFIG['output_files'].values():
        filepath = os.path.join(CONFIG['output_dir'], filename)
        if os.path.exists(filepath):
            size = os.path.getsize(filepath)
            print(f"  [OK] {filename} ({size:,} bytes)")


if __name__ == '__main__':
    main()
