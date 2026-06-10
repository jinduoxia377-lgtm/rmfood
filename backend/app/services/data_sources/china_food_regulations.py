"""
中国食品法规库服务
集成国家食品安全标准、食品添加剂使用标准、新食品原料等法规数据
提供法规查询、合规检查、标准比对等功能
"""
import logging
from typing import Any, List, Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════
# 中国食品安全国家标准目录
# ═══════════════════════════════════════════

FOOD_SAFETY_STANDARDS: List[Dict[str, Any]] = [
    # 食品添加剂使用标准
    {
        "standard_code": "GB 2760-2021",
        "title": "食品安全国家标准 食品添加剂使用标准",
        "title_en": "National Food Safety Standard - Standard for Uses of Food Additives",
        "category": "食品添加剂",
        "status": "现行",
        "publish_date": "2021-02-27",
        "implementation_date": "2021-06-01",
        "summary": "规定了食品添加剂的使用原则、允许使用的食品添加剂品种、使用范围及最大使用量或残留量",
        "scope": ["食品添加剂", "食品生产", "食品加工"],
        "related_topics": ["防腐剂", "甜味剂", "着色剂", "香精香料"],
    },
    # 食品中污染物限量
    {
        "standard_code": "GB 2762-2022",
        "title": "食品安全国家标准 食品中污染物限量",
        "title_en": "National Food Safety Standard - Maximum Levels of Contaminants in Foods",
        "category": "污染物限量",
        "status": "现行",
        "publish_date": "2022-03-11",
        "implementation_date": "2022-09-01",
        "summary": "规定了食品中重金属、农药残留、真菌毒素等污染物的限量要求",
        "scope": ["食品检测", "食品安全", "质量控制"],
        "related_topics": ["重金属", "农药残留", "真菌毒素", "污染物"],
    },
    # 食品营养强化剂使用标准
    {
        "standard_code": "GB 14880-2012",
        "title": "食品安全国家标准 食品营养强化剂使用标准",
        "title_en": "National Food Safety Standard - Standard for Uses of Food Nutritional Fortification Substances",
        "category": "营养强化剂",
        "status": "现行",
        "publish_date": "2012-03-15",
        "implementation_date": "2013-01-01",
        "summary": "规定了食品营养强化剂的使用原则、允许使用的营养强化剂品种、使用范围及使用量",
        "scope": ["营养强化", "食品加工", "保健食品"],
        "related_topics": ["维生素", "矿物质", "氨基酸", "DHA"],
    },
    # 预包装食品标签通则
    {
        "standard_code": "GB 7718-2011",
        "title": "食品安全国家标准 预包装食品标签通则",
        "title_en": "National Food Safety Standard - General Standard for Labeling of Prepackaged Foods",
        "category": "标签标识",
        "status": "现行",
        "publish_date": "2011-04-20",
        "implementation_date": "2012-04-20",
        "summary": "规定了预包装食品标签的基本要求、标示内容和标示方式",
        "scope": ["食品标签", "包装设计", "产品说明"],
        "related_topics": ["配料表", "营养成分表", "生产日期", "保质期"],
    },
    # 预包装食品营养标签通则
    {
        "standard_code": "GB 28050-2011",
        "title": "食品安全国家标准 预包装食品营养标签通则",
        "title_en": "National Food Safety Standard - General Standard for Nutrition Labeling of Prepackaged Foods",
        "category": "营养标签",
        "status": "现行",
        "publish_date": "2011-01-12",
        "implementation_date": "2013-01-01",
        "summary": "规定了预包装食品营养标签的基本要求、标示内容和标示方式",
        "scope": ["营养成分", "食品标签", "消费者信息"],
        "related_topics": ["能量", "蛋白质", "脂肪", "碳水化合物", "钠"],
    },
    # 食品生产通用卫生规范
    {
        "standard_code": "GB 14881-2013",
        "title": "食品安全国家标准 食品生产通用卫生规范",
        "title_en": "National Food Safety Standard - General Hygienic Specification for Food Production",
        "category": "生产规范",
        "status": "现行",
        "publish_date": "2013-05-24",
        "implementation_date": "2014-06-01",
        "summary": "规定了食品生产过程中原料采购、加工、包装、贮存等环节的卫生要求",
        "scope": ["食品工厂", "生产流程", "卫生管理"],
        "related_topics": ["GMP", "HACCP", "卫生控制", "质量体系"],
    },
    # 食品添加剂新品种管理办法
    {
        "standard_code": "GB 1886 series",
        "title": "食品安全国家标准 食品添加剂",
        "title_en": "National Food Safety Standard - Food Additives",
        "category": "食品添加剂",
        "status": "现行",
        "publish_date": "2015-09-22",
        "implementation_date": "2016-03-22",
        "summary": "各类食品添加剂的具体规格和质量要求",
        "scope": ["食品添加剂", "质量标准", "规格要求"],
        "related_topics": ["酸度调节剂", "抗结剂", "消泡剂", "抗氧化剂"],
    },
    # 新食品原料安全性审查管理办法
    {
        "standard_code": "GB 31604 series",
        "title": "食品安全国家标准 食品接触材料及制品",
        "title_en": "National Food Safety Standard - Food Contact Materials and Articles",
        "category": "食品接触材料",
        "status": "现行",
        "publish_date": "2016-10-19",
        "implementation_date": "2017-04-19",
        "summary": "食品接触材料及制品的安全要求和检验方法",
        "scope": ["包装材料", "食品接触", "食品安全"],
        "related_topics": ["塑料", "金属", "纸制品", "橡胶"],
    },
]


# ═══════════════════════════════════════════
# 药食同源物质目录
# ═══════════════════════════════════════════

FOOD_HOMOLOGY_MATERIALS: List[Dict[str, Any]] = [
    {
        "name": "人参",
        "latin_name": "Panax ginseng",
        "category": "补气药",
        "approval_date": "2012-08-23",
        "status": "允许用于普通食品",
        "restrictions": ["孕妇、哺乳期妇女及14周岁以下儿童不宜食用", "不宜与藜芦、五灵脂同用"],
        "usage_forms": ["片剂", "胶囊", "饮品", "食品添加剂"],
        "max_dosage": "≤3克/天",
    },
    {
        "name": "西洋参",
        "latin_name": "Panax quinquefolius",
        "category": "补气药",
        "approval_date": "2012-08-23",
        "status": "允许用于普通食品",
        "restrictions": ["体质虚寒者不宜单独使用"],
        "usage_forms": ["片剂", "胶囊", "饮品"],
        "max_dosage": "≤5克/天",
    },
    {
        "name": "鹿茸",
        "latin_name": "Cornu Cervi Pantotrichum",
        "category": "补阳药",
        "approval_date": "2014-01-06",
        "status": "允许用于普通食品",
        "restrictions": ["阴虚阳亢者忌用", "孕妇禁用"],
        "usage_forms": ["粉末", "胶囊", "酒制品"],
        "max_dosage": "≤2克/天",
    },
    {
        "name": "灵芝",
        "latin_name": "Ganoderma lucidum",
        "category": "补气药",
        "approval_date": "2012-08-23",
        "status": "允许用于普通食品",
        "restrictions": ["实证者慎用"],
        "usage_forms": ["片剂", "胶囊", "饮品", "提取物"],
        "max_dosage": "≤6克/天",
    },
    {
        "name": "铁皮石斛",
        "latin_name": "Dendrobium officinale",
        "category": "补阴药",
        "approval_date": "2013-01-15",
        "status": "允许用于普通食品",
        "restrictions": ["脾胃虚寒者慎用"],
        "usage_forms": ["粉剂", "胶囊", "饮品"],
        "max_dosage": "≤6克/天",
    },
    {
        "name": "当归",
        "latin_name": "Angelica sinensis",
        "category": "补血药",
        "approval_date": "2018-06-01",
        "status": "试点用于普通食品",
        "restrictions": ["湿盛中满、大便溏泄者慎用"],
        "usage_forms": ["煲汤", "饮片", "提取物"],
        "max_dosage": "≤5克/天",
    },
    {
        "name": "黄芪",
        "latin_name": "Astragalus membranaceus",
        "category": "补气药",
        "approval_date": "2012-08-23",
        "status": "允许用于普通食品",
        "restrictions": ["表实邪盛、气滞湿阻者不宜使用"],
        "usage_forms": ["煲汤", "茶饮", "提取物"],
        "max_dosage": "≤15克/天",
    },
    {
        "name": "枸杞子",
        "latin_name": "Lycium barbarum",
        "category": "补阴药",
        "approval_date": "传统药食同源",
        "status": "允许用于普通食品",
        "restrictions": ["外邪实热、脾虚有湿及泄泻者忌服"],
        "usage_forms": ["直接食用", "茶饮", "煲汤", "食品添加剂"],
        "max_dosage": "无限制",
    },
]


# ═══════════════════════════════════════════
# 新食品原料目录
# ═══════════════════════════════════════════

NEW_FOOD_MATERIALS: List[Dict[str, Any]] = [
    {
        "name": "玛咖粉",
        "english_name": "Maca powder",
        "source": "玛咖（Lepidium meyenii Walp.）的根茎",
        "approval_date": "2011-05-18",
        "status": "已批准",
        "usage_scope": ["片剂、胶囊、饮品、酒类"],
        "daily_intake": "≤25克/天",
        "restrictions": ["婴幼儿、哺乳期妇女、孕妇不宜食用"],
        "notice": "2011年第13号公告",
    },
    {
        "name": "DHA藻油",
        "english_name": "DHA algal oil",
        "source": "裂壶藻（Schizochytrium sp.）或寇氏隐甲藻（Crypthecodinium cohnii）",
        "approval_date": "2010-03-09",
        "status": "已批准",
        "usage_scope": ["婴幼儿配方食品、乳制品、饮料、糖果"],
        "daily_intake": "≤300毫克/天（以纯DHA计）",
        "restrictions": ["无特殊限制"],
        "notice": "2010年第3号公告",
    },
    {
        "name": "ARA油脂",
        "english_name": "ARA oil",
        "source": "高山被孢霉（Mortierella alpina）",
        "approval_date": "2010-03-09",
        "status": "已批准",
        "usage_scope": ["婴幼儿配方食品、乳制品"],
        "daily_intake": "≤1克/天",
        "restrictions": ["无特殊限制"],
        "notice": "2010年第3号公告",
    },
    {
        "name": "人参果",
        "english_name": "Ginseng fruit",
        "source": "茄科茄属植物人参果（Solanum muricatum Aiton）的果实",
        "approval_date": "2011-08-17",
        "status": "已批准",
        "usage_scope": ["直接食用、果汁、果酱、罐头"],
        "daily_intake": "无限制",
        "restrictions": ["无特殊限制"],
        "notice": "2011年第19号公告",
    },
    {
        "name": "蛹虫草",
        "english_name": "Cordyceps militaris",
        "source": "人工培养的蛹虫草子实体",
        "approval_date": "2014-09-05",
        "status": "已批准",
        "usage_scope": ["片剂、胶囊、饮品、食品添加剂"],
        "daily_intake": "≤2克/天",
        "restrictions": ["婴幼儿、孕妇、哺乳期妇女不宜食用"],
        "notice": "2014年第10号公告",
    },
    {
        "name": "辣木叶",
        "english_name": "Moringa leaf",
        "source": "辣木科辣木属植物辣木（Moringa oleifera Lam.）的干燥叶",
        "approval_date": "2012-11-12",
        "status": "已批准",
        "usage_scope": ["茶、饮料、调味品、保健食品"],
        "daily_intake": "≤10克/天",
        "restrictions": ["无特殊限制"],
        "notice": "2012年第19号公告",
    },
    {
        "name": "金花茶",
        "english_name": "Golden camellia",
        "source": "山茶科山茶属植物金花茶（Camellia nitidissima Chi）的干燥花",
        "approval_date": "2010-12-24",
        "status": "已批准",
        "usage_scope": ["茶、饮料、食品添加剂"],
        "daily_intake": "≤5克/天",
        "restrictions": ["无特殊限制"],
        "notice": "2010年第30号公告",
    },
    {
        "name": "显脉旋覆花（小黑药）",
        "english_name": "Inula nervosa",
        "source": "菊科旋覆花属植物显脉旋覆花（Inula nervosa Wall.）的干燥根及根茎",
        "approval_date": "2016-03-11",
        "status": "已批准",
        "usage_scope": ["调味品、汤料、保健食品"],
        "daily_intake": "≤6克/天",
        "restrictions": ["孕妇、哺乳期妇女不宜食用"],
        "notice": "2016年第8号公告",
    },
]


# ═══════════════════════════════════════════
# 食品添加剂分类及使用标准
# ═══════════════════════════════════════════

FOOD_ADDITIVES: List[Dict[str, Any]] = [
    {
        "code": "INS 200",
        "name": "山梨酸",
        "english_name": "Sorbic acid",
        "function": "防腐剂",
        "allowed_foods": ["糕点", "糖果", "饮料", "肉制品"],
        "max_level": "1.0 g/kg",
        "remarks": "用于抑制霉菌和酵母菌生长",
    },
    {
        "code": "INS 202",
        "name": "山梨酸钾",
        "english_name": "Potassium sorbate",
        "function": "防腐剂",
        "allowed_foods": ["糕点", "糖果", "饮料", "肉制品", "乳制品"],
        "max_level": "1.0 g/kg",
        "remarks": "山梨酸的钾盐，水溶性更好",
    },
    {
        "code": "INS 211",
        "name": "苯甲酸钠",
        "english_name": "Sodium benzoate",
        "function": "防腐剂",
        "allowed_foods": ["饮料", "调味品", "果酱", "蜜饯"],
        "max_level": "0.5-1.0 g/kg",
        "remarks": "酸性条件下效果较好",
    },
    {
        "code": "INS 300",
        "name": "抗坏血酸",
        "english_name": "Ascorbic acid",
        "function": "抗氧化剂、营养强化剂",
        "allowed_foods": ["饮料", "糖果", "肉制品", "面制品"],
        "max_level": "根据需要适量使用",
        "remarks": "维生素C，兼具营养功能",
    },
    {
        "code": "INS 320",
        "name": "BHA",
        "english_name": "Butylated hydroxyanisole",
        "function": "抗氧化剂",
        "allowed_foods": ["油脂", "油炸食品", "坚果", "方便面"],
        "max_level": "0.2 g/kg",
        "remarks": "脂溶性抗氧化剂",
    },
    {
        "code": "INS 321",
        "name": "BHT",
        "english_name": "Butylated hydroxytoluene",
        "function": "抗氧化剂",
        "allowed_foods": ["油脂", "油炸食品", "坚果", "方便面"],
        "max_level": "0.2 g/kg",
        "remarks": "脂溶性抗氧化剂，常与BHA复配使用",
    },
    {
        "code": "INS 420",
        "name": "山梨糖醇",
        "english_name": "Sorbitol",
        "function": "甜味剂、保湿剂",
        "allowed_foods": ["糖果", "饮料", "糕点", "口香糖"],
        "max_level": "根据需要适量使用",
        "remarks": "无糖食品常用甜味剂",
    },
    {
        "code": "INS 955",
        "name": "三氯蔗糖",
        "english_name": "Sucralose",
        "function": "甜味剂",
        "allowed_foods": ["饮料", "糖果", "糕点", "乳制品"],
        "max_level": "根据需要适量使用",
        "remarks": "甜度约为蔗糖的600倍，无热量",
    },
    {
        "code": "INS 951",
        "name": "阿斯巴甜",
        "english_name": "Aspartame",
        "function": "甜味剂",
        "allowed_foods": ["饮料", "糖果", "糕点", "口香糖"],
        "max_level": "40-100 mg/kg",
        "remarks": "甜度约为蔗糖的200倍，苯丙酮尿症患者不宜食用",
    },
    {
        "code": "INS 1505",
        "name": "柠檬酸三乙酯",
        "english_name": "Triethyl citrate",
        "function": "增塑剂、溶剂",
        "allowed_foods": ["胶基糖果", "调味品"],
        "max_level": "根据需要适量使用",
        "remarks": "用于改善食品质地",
    },
]


class ChinaFoodRegulationService:
    """中国食品法规库服务"""

    def __init__(self):
        self.version = "2024.1"
        self.data_sources = ["国家卫生健康委员会", "国家市场监督管理总局", "食品安全国家标准"]

    async def get_standards_by_category(self, category: str = "") -> List[Dict[str, Any]]:
        """
        按类别查询食品安全标准
        """
        if not category:
            return FOOD_SAFETY_STANDARDS
        
        return [
            std for std in FOOD_SAFETY_STANDARDS
            if category.lower() in std["category"].lower()
        ]

    async def search_standards(self, keyword: str) -> List[Dict[str, Any]]:
        """
        搜索食品安全标准
        """
        keyword_lower = keyword.lower()
        return [
            std for std in FOOD_SAFETY_STANDARDS
            if (keyword_lower in std["title"].lower() or
                keyword_lower in std["standard_code"].lower() or
                keyword_lower in std["summary"].lower())
        ]

    async def get_food_homology_materials(self, name: str = "") -> List[Dict[str, Any]]:
        """
        查询药食同源物质
        """
        if not name:
            return FOOD_HOMOLOGY_MATERIALS
        
        return [
            mat for mat in FOOD_HOMOLOGY_MATERIALS
            if name.lower() in mat["name"].lower()
        ]

    async def get_new_food_materials(self, name: str = "") -> List[Dict[str, Any]]:
        """
        查询新食品原料
        """
        if not name:
            return NEW_FOOD_MATERIALS
        
        return [
            mat for mat in NEW_FOOD_MATERIALS
            if name.lower() in mat["name"].lower() or
               name.lower() in mat["english_name"].lower()
        ]

    async def search_additives(self, keyword: str = "", function: str = "") -> List[Dict[str, Any]]:
        """
        搜索食品添加剂
        """
        results = FOOD_ADDITIVES
        
        if keyword:
            keyword_lower = keyword.lower()
            results = [
                add for add in results
                if keyword_lower in add["name"].lower() or
                   keyword_lower in add["english_name"].lower() or
                   keyword_lower in add["code"].lower()
            ]
        
        if function:
            function_lower = function.lower()
            results = [
                add for add in results
                if function_lower in add["function"].lower()
            ]
        
        return results

    async def check_additive_usage(self, additive_name: str, food_category: str) -> Dict[str, Any]:
        """
        检查添加剂在特定食品类别中的使用规定
        """
        additive = next(
            (add for add in FOOD_ADDITIVES
             if additive_name.lower() in add["name"].lower()),
            None
        )
        
        if not additive:
            return {
                "found": False,
                "message": f"未找到添加剂: {additive_name}",
            }
        
        is_allowed = food_category in additive["allowed_foods"]
        
        return {
            "found": True,
            "additive": additive,
            "food_category": food_category,
            "is_allowed": is_allowed,
            "max_level": additive["max_level"] if is_allowed else "不允许使用",
            "remarks": additive["remarks"],
        }

    async def check_homology_approval(self, herb_name: str) -> Dict[str, Any]:
        """
        检查中药材是否属于药食同源目录
        """
        material = next(
            (mat for mat in FOOD_HOMOLOGY_MATERIALS
             if herb_name.lower() in mat["name"].lower()),
            None
        )
        
        if not material:
            return {
                "is_homology": False,
                "message": f"{herb_name} 未列入药食同源目录",
                "suggestion": "如需使用，请申请新食品原料审查",
            }
        
        return {
            "is_homology": True,
            "material": material,
            "status": material["status"],
            "max_dosage": material["max_dosage"],
            "restrictions": material["restrictions"],
        }

    async def get_regulation_summary(self) -> Dict[str, Any]:
        """
        获取法规库概览信息
        """
        return {
            "version": self.version,
            "update_date": datetime.now().isoformat(),
            "data_sources": self.data_sources,
            "statistics": {
                "safety_standards": len(FOOD_SAFETY_STANDARDS),
                "food_homology_materials": len(FOOD_HOMOLOGY_MATERIALS),
                "new_food_materials": len(NEW_FOOD_MATERIALS),
                "food_additives": len(FOOD_ADDITIVES),
            },
        }

    async def validate_formula_ingredients(self, ingredients: List[str]) -> Dict[str, Any]:
        """
        验证配方成分的合规性
        """
        results = []
        warnings = []
        errors = []
        
        for ingredient in ingredients:
            # 检查是否为药食同源物质
            homology_check = await self.check_homology_approval(ingredient)
            if homology_check["is_homology"]:
                results.append({
                    "ingredient": ingredient,
                    "type": "food_homology",
                    "status": "approved",
                    "details": homology_check,
                })
            else:
                # 检查是否为新食品原料
                new_materials = await self.get_new_food_materials(ingredient)
                if new_materials:
                    results.append({
                        "ingredient": ingredient,
                        "type": "new_food_material",
                        "status": "approved",
                        "details": new_materials[0],
                    })
                else:
                    # 未知成分
                    results.append({
                        "ingredient": ingredient,
                        "type": "unknown",
                        "status": "warning",
                        "details": {
                            "message": f"成分 {ingredient} 未在已知法规目录中找到",
                        },
                    })
                    warnings.append(f"成分 {ingredient} 未在已知法规目录中找到")
        
        return {
            "valid": len(errors) == 0,
            "results": results,
            "warnings": warnings,
            "errors": errors,
            "summary": {
                "total_ingredients": len(ingredients),
                "approved": len([r for r in results if r["status"] == "approved"]),
                "warnings": len(warnings),
                "errors": len(errors),
            },
        }


# 全局实例
regulation_service = ChinaFoodRegulationService()

logger.info("⚡ 中国食品法规库服务初始化完成")