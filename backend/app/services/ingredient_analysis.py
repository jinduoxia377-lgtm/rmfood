"""
Ingredient Analysis Service - 六维分析引擎
Nutri-Score / NOVA分组 / E编码添加剂 / 过敏原 / 药食同源 / GB28050营养表
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

# ========== 常量定义 ==========

GRADE_COLORS = {
    'A': '#008751', 'B': '#84BD00', 'C': '#D1BE00',
    'D': '#F5A623', 'E': '#D33A39'
}

NOVA_LABELS = {
    1: '未加工/最低限度加工',
    2: '加工烹饪原料',
    3: '加工食品',
    4: '超加工食品'
}

RISK_LEVELS = {
    'low': {'label': '安全', 'color': '#22C55E', 'bg': 'rgba(34,197,94,0.08)'},
    'medium': {'label': '需注意', 'color': '#F59E0B', 'bg': 'rgba(245,158,11,0.08)'},
    'high': {'label': '高风险', 'color': '#EF4444', 'bg': 'rgba(239,68,68,0.08)'}
}


# ========== E编码添加剂数据库 ==========

ADDITIVE_DB: Dict[str, Dict[str, Any]] = {
    # 防腐剂
    '200': {'name': '山梨酸', 'eCode': 'E200', 'function': '防腐剂', 'risk': 'low', 'maxUsage': '按GMP'},
    '201': {'name': '山梨酸钾', 'eCode': 'E201', 'function': '防腐剂', 'risk': 'low', 'maxUsage': '0.5-2.0g/kg'},
    '202': {'name': '丙酸钙', 'eCode': 'E202', 'function': '防腐剂', 'risk': 'low', 'maxUsage': '3.0g/kg'},
    '211': {'name': '苯甲酸钠', 'eCode': 'E211', 'function': '防腐剂', 'risk': 'medium', 'maxUsage': '0.5-2.0g/kg'},
    '212': {'name': '碳酸钾', 'eCode': 'E212', 'function': '防腐剂', 'risk': 'low', 'maxUsage': '按GMP'},
    '220': {'name': '二氧化硫', 'eCode': 'E220', 'function': '防腐剂/抗氧化剂', 'risk': 'medium', 'maxUsage': '0.1-0.35g/kg', 'allergen': True},
    '223': {'name': '焦亚硫酸钠', 'eCode': 'E223', 'function': '防腐剂', 'risk': 'medium', 'maxUsage': '0.1-0.35g/kg', 'allergen': True},
    '250': {'name': '亚硝酸钠', 'eCode': 'E250', 'function': '护色剂/防腐剂', 'risk': 'high', 'maxUsage': '0.15g/kg (肉类)', 'carcinogen': True},
    '251': {'name': '硝酸钾', 'eCode': 'E251', 'function': '护色剂', 'risk': 'medium', 'maxUsage': '0.5g/kg'},
    # 抗氧化剂
    '300': {'name': '抗坏血酸(VC)', 'eCode': 'E300', 'function': '抗氧化剂/营养强化剂', 'risk': 'low'},
    '301': {'name': '抗坏血酸钠', 'eCode': 'E301', 'function': '抗氧化剂', 'risk': 'low'},
    '310': {'name': '没食子酸丙酯', 'eCode': 'E310', 'function': '抗氧化剂', 'risk': 'medium', 'maxUsage': '0.1g/kg'},
    '320': {'name': 'BHA', 'eCode': 'E320', 'function': '抗氧化剂', 'risk': 'high', 'maxUsage': '0.1g/kg', 'carcinogen': True},
    '321': {'name': 'BHT', 'eCode': 'E321', 'function': '抗氧化剂', 'risk': 'medium', 'maxUsage': '0.1g/kg'},
    '322': {'name': '磷脂', 'eCode': 'E322', 'function': '乳化剂', 'risk': 'low', 'allergen': True},
    # 着色剂
    '100': {'name': '姜黄素', 'eCode': 'E100', 'function': '着色剂', 'risk': 'low'},
    '102': {'name': '柠檬黄', 'eCode': 'E102', 'function': '着色剂', 'risk': 'medium', 'allergen': True},
    '104': {'name': '喹啉黄', 'eCode': 'E104', 'function': '着色剂', 'risk': 'medium'},
    '122': {'name': '偶氮玉红', 'eCode': 'E122', 'function': '着色剂', 'risk': 'medium'},
    '133': {'name': '亮蓝', 'eCode': 'E133', 'function': '着色剂', 'risk': 'low'},
    '160a': {'name': 'β-胡萝卜素', 'eCode': 'E160a', 'function': '着色剂', 'risk': 'low'},
    '162': {'name': '甜菜红', 'eCode': 'E162', 'function': '着色剂', 'risk': 'low'},
    '179': {'name': '叶绿素铜钠', 'eCode': 'E179', 'function': '着色剂', 'risk': 'low'},
    # 甜味剂
    '951': {'name': '阿斯巴甜', 'eCode': 'E951', 'function': '甜味剂', 'risk': 'medium', 'phenylketonuria': True},
    '952': {'name': '安赛蜜', 'eCode': 'E952', 'function': '甜味剂', 'risk': 'low'},
    '955': {'name': '甜菊糖苷', 'eCode': 'E955', 'function': '甜味剂', 'risk': 'low'},
    '960': {'name': '甜菊糖提取物', 'eCode': 'E960', 'function': '甜味剂', 'risk': 'low'},
    # 增稠剂/稳定剂
    '400': {'name': '藻酸', 'eCode': 'E400', 'function': '增稠剂', 'risk': 'low'},
    '401': {'name': '藻酸钠', 'eCode': 'E401', 'function': '增稠剂', 'risk': 'low'},
    '407': {'name': '卡拉胶', 'eCode': 'E407', 'function': '增稠剂', 'risk': 'low'},
    '412': {'name': '刺槐豆胶', 'eCode': 'E412', 'function': '增稠剂', 'risk': 'low'},
    '415': {'name': '黄原胶', 'eCode': 'E415', 'function': '增稠剂', 'risk': 'low'},
    # 乳化剂
    '471': {'name': '单双甘油脂肪酸酯', 'eCode': 'E471', 'function': '乳化剂', 'risk': 'low'},
    '472e': {'name': '柠檬酸酯', 'eCode': 'E472e', 'function': '乳化剂', 'risk': 'low'},
    # 酸度调节剂
    '330': {'name': '柠檬酸', 'eCode': 'E330', 'function': '酸度调节剂', 'risk': 'low'},
    '331': {'name': '柠檬酸钠', 'eCode': 'E331', 'function': '酸度调节剂', 'risk': 'low'},
    '332': {'name': '柠檬酸钾', 'eCode': 'E332', 'function': '酸度调节剂', 'risk': 'low'},
    '325': {'name': '乳酸钠', 'eCode': 'E325', 'function': '酸度调节剂', 'risk': 'low'},
    # 膨松剂
    '500': {'name': '碳酸氢铵', 'eCode': 'E500', 'function': '膨松剂', 'risk': 'low'},
    '503': {'name': '碳酸氢钠', 'eCode': 'E503', 'function': '膨松剂', 'risk': 'low'},
    # 面粉改良剂
    '350': {'name': '苹果酸', 'eCode': 'E350', 'function': '酸度调节剂', 'risk': 'low'},
    '631': {'name': '磷酸氢二钠', 'eCode': 'E631', 'function': '酸度调节剂', 'risk': 'low'},
    '341': {'name': '磷酸钙', 'eCode': 'E341', 'function': '酸度调节剂', 'risk': 'low'},
    # 其他
    '621': {'name': '谷氨酸钠(味精)', 'eCode': 'E621', 'function': '增味剂', 'risk': 'low'},
    '635': {"name": "5'-呈味核苷酸二钠", "eCode": "E635", "function": "增味剂", "risk": "low"},
}


# ========== 八大过敏原映射 ==========

ALLERGEN_MAP: Dict[str, Dict[str, Any]] = {
    'gluten': {'name': '麸质', 'keywords': ['小麦', '大麦', '黑麦', '燕麦', '面粉', '麸质', 'gluten', 'wheat']},
    'crustaceans': {'name': '甲壳类', 'keywords': ['虾', '蟹', '龙虾', '蟹肉', 'crustacean', 'shrimp', 'crab']},
    'egg': {'name': '鸡蛋', 'keywords': ['鸡蛋', '蛋', '蛋清', '蛋黄', '卵', 'albumen', 'egg']},
    'fish': {'name': '鱼类', 'keywords': ['鱼', '鱼肉', '鱼油', '鱼粉', 'fish', 'anchovy']},
    'peanut': {'name': '花生', 'keywords': ['花生', '花生油', '落花生', 'peanut']},
    'soy': {'name': '大豆', 'keywords': ['大豆', '黄豆', '黑豆', '豆腐', '豆浆', 'soy', 'soya']},
    'milk': {'name': '乳制品', 'keywords': ['牛奶', '奶粉', '奶酪', '奶油', '乳清', 'milk', 'lactose', 'casein']},
    'nuts': {'name': '坚果', 'keywords': ['杏仁', '核桃', '腰果', '榛子', '花生', '栗子', 'cashew', 'almond', 'walnut', 'hazelnut', 'pecan']},
}


# ========== 药食同源目录 ==========

FOOD_HOMOLOGY_DB: List[Dict[str, str]] = [
    {'name': '山药', 'property': '甘温', 'category': '补气', 'effect': '健脾补肺、固肾益精'},
    {'name': '黄芪', 'property': '甘微温', 'category': '补气', 'effect': '补气升阳、固表止汗'},
    {'name': '枸杞子', 'property': '甘平', 'category': '补阴', 'effect': '滋补肝肾、益精明目'},
    {'name': '红枣', 'property': '甘温', 'category': '补气', 'effect': '补中益气、养血安神'},
    {'name': '莲子', 'property': '甘涩平', 'category': '收涩', 'effect': '补脾止泻、养心安神'},
    {'name': '薏苡仁', 'property': '甘淡凉', 'category': '利水渗湿', 'effect': '利水渗湿、健脾止泻'},
    {'name': '茯苓', 'property': '甘淡平', 'category': '利水渗湿', 'effect': '利水渗湿、健脾宁心'},
    {'name': '菊花', 'property': '辛甘苦微寒', 'category': '解表', 'effect': '疏散风热、平抑肝阳'},
    {'name': '桑叶', 'property': '甘苦寒', 'category': '解表', 'effect': '疏散风热、清肺润燥'},
    {'name': '玫瑰花', 'property': '甘微苦温', 'category': '理气', 'effect': '行气解郁、和血散瘀'},
    {'name': '决明子', 'property': '甘苦咸微寒', 'category': '清热', 'effect': '清热明目、润肠通便'},
    {'name': '胖大海', 'property': '甘寒', 'category': '清热', 'effect': '清热润肺、利咽开音'},
    {'name': '山楂', 'property': '酸甘微温', 'category': '消食', 'effect': '消食健胃、行气散瘀'},
    {'name': '麦芽', 'property': '甘平', 'category': '消食', 'effect': '行气消食、健脾开胃'},
    {'name': '鸡内金', 'property': '甘平', 'category': '消食', 'effect': '健胃消食、涩精止遗'},
    {'name': '陈皮', 'property': '辛苦温', 'category': '理气', 'effect': '理气健脾、燥湿化痰'},
    {'name': '砂仁', 'property': '辛温', 'category': '化湿', 'effect': '化湿行气、温中止泻'},
    {'name': '八角', 'property': '辛热', 'category': '温里', 'effect': '温阳散寒、理气止痛'},
    {'name': '丁香', 'property': '辛温', 'category': '温里', 'effect': '温中降逆、补肾助阳'},
    {'name': '肉桂', 'property': '辛甘大热', 'category': '温里', 'effect': '补火助阳、散寒止痛'},
    {'name': '干姜', 'property': '辛热', 'category': '温里', 'effect': '温中散寒、回阳通脉'},
    {'name': '生姜', 'property': '辛微温', 'category': '解表', 'effect': '解表散寒、温中止呕'},
    {'name': '大枣', 'property': '甘温', 'category': '补气', 'effect': '补中益气、养血安神'},
    {'name': '桂圆', 'property': '甘温', 'category': '补气', 'effect': '补益心脾、养血安神'},
    {'name': '百合', 'property': '甘寒', 'category': '养阴', 'effect': '养阴润肺、清心安神'},
    {'name': '银耳', 'property': '甘淡平', 'category': '养阴', 'effect': '滋阴润肺、养胃生津'},
    {'name': '玉竹', 'property': '甘微寒', 'category': '养阴', 'effect': '养阴润燥、生津止渴'},
    {'name': '麦冬', 'property': '甘微苦微寒', 'category': '养阴', 'effect': '养阴生津、润肺清心'},
    {'name': '西洋参', 'property': '甘微苦凉', 'category': '补气', 'effect': '补气养阴、清热生津'},
    {'name': '人参', 'property': '甘微苦温', 'category': '补气', 'effect': '大补元气、复脉固脱'},
    {'name': '何首乌', 'property': '苦涩微温', 'category': '补阴', 'effect': '制用补肝肾、生用通便'},
    {'name': '阿胶', 'property': '甘平', 'category': '补血', 'effect': '补血滋阴、润燥止血'},
    {'name': '当归', 'property': '甘辛温', 'category': '补血', 'effect': '补血活血、调经止痛'},
    {'name': '党参', 'property': '甘平', 'category': '补气', 'effect': '补中益气、健脾益肺'},
    {'name': '白术', 'property': '苦甘温', 'category': '补气', 'effect': '健脾益气、燥湿利水'},
    {'name': '甘草', 'property': '甘平', 'category': '调和', 'effect': '补脾益气、清热解毒、调和诸药'},
    {'name': '防风', 'property': '辛甘微温', 'category': '解表', 'effect': '祛风解表、胜湿止痛'},
    {'name': '荆芥', 'property': '辛微温', 'category': '解表', 'effect': '解表散风、透疹消疮'},
    {'name': '薄荷', 'property': '辛凉', 'category': '解表', 'effect': '疏散风热、清利头目'},
    {'name': '淡竹叶', 'property': '甘淡寒', 'category': '清热', 'effect': '清热泻火、除烦利尿'},
    {'name': '金银花', 'property': '甘寒', 'category': '清热', 'effect': '清热解毒、疏散风热'},
    {'name': '连翘', 'property': '苦微寒', 'category': '清热', 'effect': '清热解毒、消肿散结'},
    {'name': '罗汉果', 'property': '甘凉', 'category': '清热', 'effect': '清热润肺、利咽开音'},
    {'name': '栀子', 'property': '苦寒', 'category': '清热', 'effect': '清热泻火、凉血解毒'},
    {'name': '荷叶', 'property': '苦平', 'category': '清热', 'effect': '清暑利湿、升发清阳'},
    {'name': '桑葚', 'property': '甘寒', 'category': '补阴', 'effect': '滋阴补血、生津润燥'},
    {'name': '乌梅', 'property': '酸涩平', 'category': '收涩', 'effect': '敛肺涩肠、生津安蛔'},
    {'name': '木瓜', 'property': '酸温', 'category': '化湿', 'effect': '舒筋活络、和胃化湿'},
    {'name': '辣木叶', 'property': '甘凉', 'category': '清热', 'effect': '清热消肿、健胃补血'},
    {'name': '菊花脑', 'property': '甘凉', 'category': '清热', 'effect': '清热解毒、清肝明目'},
]


# ========== GB 28050 营养成分表模板 ==========

GB28050_BASE = [
    {'name': '能量', 'unit': 'kJ', 'nrv': 8400, 'important': True},
    {'name': '蛋白质', 'unit': 'g', 'nrv': 60, 'important': True},
    {'name': '脂肪', 'unit': 'g', 'nrv': 60, 'important': True},
    {'name': '碳水化合物', 'unit': 'g', 'nrv': 300, 'important': True},
    {'name': '钠', 'unit': 'mg', 'nrv': 2000, 'important': True},
]

GB28050_OPTIONAL = [
    {'name': '饱和脂肪', 'unit': 'g', 'nrv': 20},
    {'name': '胆固醇', 'unit': 'mg', 'nrv': 300},
    {'name': '糖', 'unit': 'g', 'nrv': None},
    {'name': '膳食纤维', 'unit': 'g', 'nrv': 25},
    {'name': '维生素A', 'unit': 'μg RE', 'nrv': 800},
    {'name': '维生素B1', 'unit': 'mg', 'nrv': 1.4},
    {'name': '维生素B2', 'unit': 'mg', 'nrv': 1.4},
    {'name': '维生素C', 'unit': 'mg', 'nrv': 100},
    {'name': '钙', 'unit': 'mg', 'nrv': 800},
    {'name': '铁', 'unit': 'mg', 'nrv': 15},
]


# ========== 核心分析引擎 ==========

class IngredientAnalysisService:
    """配料分析服务 - 六维分析引擎"""

    # ---- Nutri-Score ----
    def calculate_nutri_score(self, ingredients: List[Dict], nutrition: Dict) -> int:
        """计算 Nutri-Score 健康评分（0-100分）"""
        score = 50

        if nutrition:
            energy = nutrition.get('energy', 0)
            sat_fat = nutrition.get('saturatedFat', 0)
            sugar = nutrition.get('sugar', 0)
            sodium = nutrition.get('sodium', 0)
            fiber = nutrition.get('fiber', 0)
            protein = nutrition.get('protein', 0)

            # 负向扣分
            if energy > 335:
                score -= min(20, (energy - 335) / 100 * 2)
            if sat_fat > 1.5:
                score -= min(15, (sat_fat - 1.5) / 1.5 * 3)
            if sugar > 5:
                score -= min(15, (sugar - 5) / 5 * 3)
            if sodium > 200:
                score -= min(20, (sodium - 200) / 200 * 4)

            # 正向加分
            score += min(10, fiber * 0.5)
            score += min(10, protein * 0.3)

        # 检查添加剂风险
        for ing in (ingredients or []):
            additive_code = ing.get('additive')
            if additive_code and additive_code in ADDITIVE_DB:
                info = ADDITIVE_DB[additive_code]
                if info.get('risk') == 'high':
                    score -= 5
                elif info.get('risk') == 'medium':
                    score -= 2
                if info.get('carcinogen'):
                    score -= 10

        return max(0, min(100, round(score)))

    def get_nutri_grade(self, score: int) -> Dict:
        """获取 Nutri-Score 等级"""
        if score >= 85:
            return {'grade': 'A', 'color': GRADE_COLORS['A'], 'label': '优秀'}
        elif score >= 70:
            return {'grade': 'B', 'color': GRADE_COLORS['B'], 'label': '良好'}
        elif score >= 55:
            return {'grade': 'C', 'color': GRADE_COLORS['C'], 'label': '一般'}
        elif score >= 40:
            return {'grade': 'D', 'color': GRADE_COLORS['D'], 'label': '较差'}
        else:
            return {'grade': 'E', 'color': GRADE_COLORS['E'], 'label': '差'}

    # ---- NOVA分组 ----
    def calculate_nova_group(self, ingredients: List[Dict]) -> Dict:
        """计算 NOVA 超加工食品分组"""
        group = 1
        ultra_processed_keywords = [
            '防腐剂', '乳化剂', '增稠剂', '甜味剂', '人工色素', '香精',
            '山梨酸钾', '苯甲酸钠', '阿斯巴甜', '柠檬黄', '日落黄',
            'BHA', 'BHT', '亚硝酸钠', '焦亚硫酸钠'
        ]
        processed_keywords = ['糖', '油', '盐', '面粉', '奶油', '黄油', '奶酪']

        for ing in (ingredients or []):
            name = (ing.get('name') or '').lower()
            for kw in ultra_processed_keywords:
                if kw.lower() in name:
                    group = max(group, 4)
                    break
            for kw in processed_keywords:
                if kw in name:
                    group = max(group, 3)
                    break

            # 含添加剂确认超加工
            if ing.get('additive'):
                group = max(group, 4)

        # 药食同源成分可降低分组
        herbal_count = sum(1 for ing in (ingredients or [])
                          if self._is_food_homology(ing.get('name', '')))
        if herbal_count >= 3:
            group = max(1, group - 1)

        return {
            'group': group,
            'label': NOVA_LABELS[group],
            'description': self._get_nova_description(group)
        }

    def _get_nova_description(self, group: int) -> str:
        descriptions = {
            1: '未加工或最低限度加工的食品，如新鲜水果、蔬菜、肉类、蛋类、奶类',
            2: '加工的烹饪原料，如油、黄油、糖、盐、调味品',
            3: '加工食品，如罐头、新鲜面包、奶酪、酿造啤酒',
            4: '超加工食品，如软饮料、零食、速食、重组肉制品'
        }
        return descriptions.get(group, '')

    # ---- E编码添加剂识别 ----
    def identify_additives(self, ingredient_text: str, ingredients: List[Dict]) -> List[Dict]:
        """识别 E 编码添加剂"""
        found = []
        text_lower = ingredient_text.lower()

        for code, info in ADDITIVE_DB.items():
            # 名称匹配
            if info['name'].lower() in text_lower:
                found.append({**info, 'code': code, 'detected': 'name'})
            # E编码匹配
            elif code in text_lower or info['eCode'].lower() in text_lower:
                if not any(f['code'] == code for f in found):
                    found.append({**info, 'code': code, 'detected': 'code'})

        return found

    # ---- 过敏原检测 ----
    def detect_allergens(self, ingredient_text: str, ingredients: List[Dict]) -> List[Dict]:
        """检测八大过敏原"""
        found = []
        text_lower = ingredient_text.lower()

        for key, info in ALLERGEN_MAP.items():
            matched = [kw for kw in info['keywords'] if kw.lower() in text_lower]
            if matched:
                found.append({'id': key, 'name': info['name'], 'matched': matched})

        # E编码过敏原
        for code, info in ADDITIVE_DB.items():
            if info.get('allergen') and info['name'].lower() in text_lower:
                if not any(f['id'] == 'additive_risk' for f in found):
                    found.append({'id': 'additive_risk', 'name': '添加剂风险', 'matched': [info['name']]})

        return found

    # ---- 药食同源识别 ----
    def identify_herbal_ingredients(self, ingredient_text: str) -> List[Dict]:
        """识别药食同源成分"""
        found = []
        for herb in FOOD_HOMOLOGY_DB:
            if herb['name'] in ingredient_text:
                found.append(herb)
        return found

    def _is_food_homology(self, name: str) -> bool:
        """判断是否为药食同源成分"""
        return any(herb['name'] in name for herb in FOOD_HOMOLOGY_DB)

    # ---- GB 28050 营养表 ----
    def generate_nutrition_table(self, nutrition: Dict) -> List[Dict]:
        """生成 GB 28050 格式营养成分表"""
        result = [dict(item) for item in GB28050_BASE]

        # 补充可选成分
        if nutrition:
            mapping = {
                'saturatedFat': '饱和脂肪',
                'cholesterol': '胆固醇',
                'sugar': '糖',
                'fiber': '膳食纤维',
                'vitaminA': '维生素A',
                'vitaminC': '维生素C',
                'calcium': '钙',
                'iron': '铁',
            }
            for key, name in mapping.items():
                if key in nutrition and nutrition[key] is not None:
                    nrv_info = next((g for g in GB28050_OPTIONAL if g['name'] == name), None)
                    if nrv_info:
                        result.append({
                            'name': name,
                            'unit': nrv_info['unit'],
                            'nrv': nrv_info['nrv'],
                            'value': nutrition[key],
                        })

        # 计算NRV%
        for item in result:
            name_lower = item['name'].lower().replace(' ', '')
            value = nutrition.get(name_lower, nutrition.get(item['name'], 0)) if nutrition else 0
            item['value'] = value
            item['nrvPercent'] = round((value / item['nrv']) * 100) if item.get('nrv') else None

        return result

    # ---- 健康建议 ----
    def generate_suggestions(self, score: int, additives: List[Dict], allergens: List[Dict], herbs: List[Dict]) -> List[Dict]:
        """生成健康建议"""
        suggestions = []

        if score >= 85:
            suggestions.append({'type': 'positive', 'text': '整体营养评价优秀，可放心食用'})
        elif score >= 70:
            suggestions.append({'type': 'neutral', 'text': '整体营养评价良好，适合日常食用'})
        elif score >= 55:
            suggestions.append({'type': 'warning', 'text': '部分成分需控制摄入，建议适量食用'})
        else:
            suggestions.append({'type': 'danger', 'text': '建议减少食用频率，注意成分控制'})

        high_risk = [a for a in additives if a.get('risk') == 'high']
        if high_risk:
            names = ', '.join(a['name'] for a in high_risk)
            suggestions.append({
                'type': 'danger',
                'text': f'含{len(high_risk)}种高风险添加剂({names})，建议谨慎食用'
            })

        if allergens:
            names = ', '.join(a['name'] for a in allergens)
            suggestions.append({
                'type': 'warning',
                'text': f'含有{names}等过敏原，过敏体质者慎食'
            })

        if herbs:
            names = ', '.join(h['name'] for h in herbs)
            suggestions.append({
                'type': 'positive',
                'text': f'含{len(herbs)}种药食同源成分({names})，具有调理功效'
            })

        suggestions.append({'type': 'neutral', 'text': '建议关注每日糖分摄入量，控制添加糖使用'})
        return suggestions

    # ---- 主分析入口 ----
    def analyze(self, ingredient_text: str, ingredients: List[Dict], nutrition: Optional[Dict] = None) -> Dict:
        """六维分析主入口"""
        full_text = ingredient_text
        if ingredients:
            ing_names = ', '.join(i.get('name', '') for i in ingredients)
            full_text = ing_names + '，' + ingredient_text if ingredient_text else ing_names

        nutri_score = self.calculate_nutri_score(ingredients, nutrition or {})
        nutri_grade = self.get_nutri_grade(nutri_score)
        nova_result = self.calculate_nova_group(ingredients)
        additives = self.identify_additives(full_text, ingredients)
        allergens = self.detect_allergens(full_text, ingredients)
        herbs = self.identify_herbal_ingredients(full_text)
        nutrition_table = self.generate_nutrition_table(nutrition or {})
        suggestions = self.generate_suggestions(nutri_score, additives, allergens, herbs)

        risk_level = 'low' if nutri_score >= 70 else 'medium' if nutri_score >= 50 else 'high'
        risk_messages = []
        if nutri_score < 50:
            risk_messages.append('整体营养评分较低')
        high_risk_adds = [a for a in additives if a.get('risk') == 'high']
        if high_risk_adds:
            risk_messages.append(f'含{len(high_risk_adds)}种高风险添加剂')
        if allergens:
            risk_messages.append(f'含{len(allergens)}类过敏原')

        return {
            'timestamp': datetime.now().isoformat(),
            'ingredientText': ingredient_text,
            'ingredients': [i.get('name', '') for i in (ingredients or [])],
            'nutriScore': nutri_score,
            'nutriGrade': nutri_grade,
            'novaResult': nova_result,
            'additives': additives,
            'allergens': allergens,
            'herbalIngredients': herbs,
            'nutritionTable': nutrition_table,
            'suggestions': suggestions,
            'overallScore': nutri_score,
            'overallGrade': nutri_grade,
            'riskLevel': risk_level,
            'riskMessages': risk_messages,
            'servingSize': '100g',
        }


# 单例
analysis_service = IngredientAnalysisService()
