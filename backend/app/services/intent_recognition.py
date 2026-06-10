"""
智能意图识别服务
实现多知识库路由，根据用户查询意图自动路由到正确的知识库
支持中药知识库、食源性多肽知识库、食品法规库的智能查询
"""
import logging
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class KnowledgeBaseType(Enum):
    """知识库类型枚举"""
    TCM = "tcm"                    # 中药知识库
    PEPTIDE = "peptide"            # 食源性多肽知识库
    REGULATION = "regulation"      # 食品法规库
    GENERAL = "general"            # 通用查询
    UNKNOWN = "unknown"            # 未知意图


class IntentType(Enum):
    """意图类型枚举"""
    # 中药相关意图
    TCM_QUERY_HERB = "tcm_query_herb"              # 查询药材信息
    TCM_QUERY_COMPOUND = "tcm_query_compound"      # 查询化合物
    TCM_QUERY_TARGET = "tcm_query_target"          # 查询靶点
    TCM_CHECK_HOMOLOGY = "tcm_check_homology"      # 检查药食同源
    TCM_SEARCH_EFFECTS = "tcm_search_effects"      # 按功效搜索
    
    # 多肽相关意图
    PEPTIDE_QUERY_SEQUENCE = "peptide_query_sequence"    # 查询肽序列
    PEPTIDE_SEARCH_ACTIVITY = "peptide_search_activity"  # 按活性类型搜索
    PEPTIDE_SEARCH_SOURCE = "peptide_search_source"      # 按来源搜索
    
    # 法规相关意图
    REG_QUERY_STANDARD = "reg_query_standard"      # 查询标准
    REG_CHECK_ADDITIVE = "reg_check_additive"      # 检查添加剂
    REG_CHECK_HOMOLOGY = "reg_check_homology"      # 检查药食同源
    REG_VALIDATE_FORMULA = "reg_validate_formula"  # 验证配方合规性
    
    # 通用意图
    GENERAL_HELP = "general_help"                  # 帮助查询
    GENERAL_ABOUT = "general_about"                # 关于系统
    UNKNOWN_INTENT = "unknown_intent"              # 未知意图


class IntentRecognitionService:
    """智能意图识别服务"""
    
    def __init__(self):
        # 中药相关关键词
        self.tcm_keywords = {
            "药材": IntentType.TCM_QUERY_HERB,
            "中药": IntentType.TCM_QUERY_HERB,
            "草药": IntentType.TCM_QUERY_HERB,
            "本草": IntentType.TCM_QUERY_HERB,
            "植物": IntentType.TCM_QUERY_HERB,
            "方剂": IntentType.TCM_QUERY_HERB,
            "人参": IntentType.TCM_QUERY_HERB,
            "黄芪": IntentType.TCM_QUERY_HERB,
            "当归": IntentType.TCM_QUERY_HERB,
            "甘草": IntentType.TCM_QUERY_HERB,
            "丹参": IntentType.TCM_QUERY_HERB,
            "枸杞": IntentType.TCM_QUERY_HERB,
            "灵芝": IntentType.TCM_QUERY_HERB,
            "西洋参": IntentType.TCM_QUERY_HERB,
            "白术": IntentType.TCM_QUERY_HERB,
            "茯苓": IntentType.TCM_QUERY_HERB,
            "麦冬": IntentType.TCM_QUERY_HERB,
            "陈皮": IntentType.TCM_QUERY_HERB,
            "山楂": IntentType.TCM_QUERY_HERB,
            "红枣": IntentType.TCM_QUERY_HERB,
            "生姜": IntentType.TCM_QUERY_HERB,
            "蜂蜜": IntentType.TCM_QUERY_HERB,
            "化合物": IntentType.TCM_QUERY_COMPOUND,
            "成分": IntentType.TCM_QUERY_COMPOUND,
            "有效成分": IntentType.TCM_QUERY_COMPOUND,
            "活性成分": IntentType.TCM_QUERY_COMPOUND,
            "靶点": IntentType.TCM_QUERY_TARGET,
            "蛋白": IntentType.TCM_QUERY_TARGET,
            "基因": IntentType.TCM_QUERY_TARGET,
            "药食同源": IntentType.TCM_CHECK_HOMOLOGY,
            "药食两用": IntentType.TCM_CHECK_HOMOLOGY,
            "功效": IntentType.TCM_SEARCH_EFFECTS,
            "作用": IntentType.TCM_SEARCH_EFFECTS,
            "主治": IntentType.TCM_SEARCH_EFFECTS,
            "适应症": IntentType.TCM_SEARCH_EFFECTS,
        }
        
        # 多肽相关关键词
        self.peptide_keywords = {
            "肽": IntentType.PEPTIDE_QUERY_SEQUENCE,
            "多肽": IntentType.PEPTIDE_QUERY_SEQUENCE,
            "活性肽": IntentType.PEPTIDE_QUERY_SEQUENCE,
            "氨基酸序列": IntentType.PEPTIDE_QUERY_SEQUENCE,
            "Ile-Pro-Pro": IntentType.PEPTIDE_QUERY_SEQUENCE,
            "Val-Pro-Pro": IntentType.PEPTIDE_QUERY_SEQUENCE,
            "ACE抑制": IntentType.PEPTIDE_SEARCH_ACTIVITY,
            "抗氧化": IntentType.PEPTIDE_SEARCH_ACTIVITY,
            "抗菌": IntentType.PEPTIDE_SEARCH_ACTIVITY,
            "降糖": IntentType.PEPTIDE_SEARCH_ACTIVITY,
            "DPP-IV": IntentType.PEPTIDE_SEARCH_ACTIVITY,
            "降血压": IntentType.PEPTIDE_SEARCH_ACTIVITY,
            "免疫调节": IntentType.PEPTIDE_SEARCH_ACTIVITY,
            "抗炎": IntentType.PEPTIDE_SEARCH_ACTIVITY,
            "胶原蛋白": IntentType.PEPTIDE_SEARCH_SOURCE,
            "乳清蛋白": IntentType.PEPTIDE_SEARCH_SOURCE,
            "大豆蛋白": IntentType.PEPTIDE_SEARCH_SOURCE,
            "鱼胶原蛋白": IntentType.PEPTIDE_SEARCH_SOURCE,
            "蛋清": IntentType.PEPTIDE_SEARCH_SOURCE,
            "酪蛋白": IntentType.PEPTIDE_SEARCH_SOURCE,
        }
        
        # 法规相关关键词
        self.regulation_keywords = {
            "标准": IntentType.REG_QUERY_STANDARD,
            "国标": IntentType.REG_QUERY_STANDARD,
            "GB": IntentType.REG_QUERY_STANDARD,
            "食品安全": IntentType.REG_QUERY_STANDARD,
            "添加剂": IntentType.REG_CHECK_ADDITIVE,
            "防腐剂": IntentType.REG_CHECK_ADDITIVE,
            "甜味剂": IntentType.REG_CHECK_ADDITIVE,
            "着色剂": IntentType.REG_CHECK_ADDITIVE,
            "抗氧化剂": IntentType.REG_CHECK_ADDITIVE,
            "合规": IntentType.REG_VALIDATE_FORMULA,
            "审查": IntentType.REG_VALIDATE_FORMULA,
            "审批": IntentType.REG_VALIDATE_FORMULA,
            "新食品原料": IntentType.REG_CHECK_HOMOLOGY,
            "药食同源": IntentType.REG_CHECK_HOMOLOGY,
        }
        
        # 通用关键词
        self.general_keywords = {
            "帮助": IntentType.GENERAL_HELP,
            "使用说明": IntentType.GENERAL_HELP,
            "功能": IntentType.GENERAL_HELP,
            "关于": IntentType.GENERAL_ABOUT,
            "介绍": IntentType.GENERAL_ABOUT,
            "系统": IntentType.GENERAL_ABOUT,
        }
        
        # 药材名称列表（用于精确匹配）
        self.herb_names = [
            "人参", "黄芪", "当归", "甘草", "丹参", "枸杞", "灵芝", "西洋参",
            "白术", "茯苓", "麦冬", "陈皮", "山楂", "红枣", "生姜", "蜂蜜",
            "山药", "百合", "桂圆", "黄精", "玉竹", "杏仁", "桃仁", "桑叶",
            "菊花", "金银花", "蒲公英", "鱼腥草", "薄荷", "紫苏", "藿香",
            "砂仁", "豆蔻", "肉桂", "花椒", "八角", "小茴香", "干姜", "高良姜",
            "白芍", "赤芍", "川芎", "熟地", "生地", "玄参", "丹皮", "知母",
            "黄连", "黄芩", "黄柏", "大黄", "枳实", "厚朴", "木香", "香附",
            "郁金", "丹参", "红花", "桃仁", "益母草", "泽兰", "牛膝", "杜仲",
            "续断", "狗脊", "骨碎补", "鹿茸", "鹿角", "巴戟天", "淫羊藿", "仙茅",
            "肉苁蓉", "锁阳", "菟丝子", "沙苑子", "杜仲", "续断", "枸杞子", "女贞子",
            "龟板", "鳖甲", "天冬", "麦冬", "沙参", "玉竹", "黄精", "石斛",
            "百合", "枸杞子", "桑葚", "黑芝麻", "核桃", "大枣", "龙眼肉", "蜂蜜",
        ]
        
        # 肽活性类型列表
        self.peptide_activities = [
            "ACE抑制", "抗氧化", "抗菌", "DPP-IV抑制", "降糖", "降血压",
            "免疫调节", "抗炎", "抗凝血", "神经保护", "细胞穿透", "抗肿瘤",
            "骨刺激", "抗皱", "抗衰老", "矿物质结合", "皮肤保湿",
        ]
        
        # 法规标准代码列表
        self.standard_codes = [
            "GB 2760", "GB 2762", "GB 14880", "GB 7718", "GB 28050",
            "GB 14881", "GB 1886", "GB 31604",
        ]
    
    def recognize_intent(self, query: str) -> Tuple[KnowledgeBaseType, IntentType, Dict[str, Any]]:
        """
        识别用户查询意图
        
        Args:
            query: 用户查询文本
            
        Returns:
            (知识库类型, 意图类型, 解析参数)
        """
        query_lower = query.lower().strip()
        
        # 解析参数
        params = {
            "query": query,
            "keywords": [],
            "entities": [],
        }
        
        # 1. 优先检查通用意图
        for keyword, intent in self.general_keywords.items():
            if keyword in query_lower:
                params["keywords"].append(keyword)
                return KnowledgeBaseType.GENERAL, intent, params
        
        # 2. 检查中药意图
        for keyword, intent in self.tcm_keywords.items():
            if keyword in query_lower:
                params["keywords"].append(keyword)
                
                # 提取药材名称实体
                for herb in self.herb_names:
                    if herb in query:
                        params["entities"].append({"type": "herb", "value": herb})
                
                return KnowledgeBaseType.TCM, intent, params
        
        # 3. 检查肽意图
        for keyword, intent in self.peptide_keywords.items():
            if keyword.lower() in query_lower or keyword in query:
                params["keywords"].append(keyword)
                
                # 提取肽序列
                if "肽" in query or "Peptide" in query or "peptide" in query_lower:
                    # 尝试提取氨基酸序列
                    import re
                    # 匹配氨基酸序列模式（单字母代码）
                    seq_pattern = r'([ACDEFGHIKLMNPQRSTVWY]+)'
                    matches = re.findall(seq_pattern, query)
                    for match in matches:
                        if len(match) >= 2:  # 至少2个氨基酸
                            params["entities"].append({"type": "peptide_sequence", "value": match})
                
                # 提取活性类型
                for activity in self.peptide_activities:
                    if activity in query:
                        params["entities"].append({"type": "activity_type", "value": activity})
                
                return KnowledgeBaseType.PEPTIDE, intent, params
        
        # 4. 检查法规意图
        for keyword, intent in self.regulation_keywords.items():
            if keyword in query_lower:
                params["keywords"].append(keyword)
                
                # 提取标准代码
                for code in self.standard_codes:
                    if code in query:
                        params["entities"].append({"type": "standard_code", "value": code})
                
                # 提取添加剂名称
                additive_names = ["山梨酸", "苯甲酸钠", "防腐剂", "甜味剂", "抗氧化剂"]
                for additive in additive_names:
                    if additive in query:
                        params["entities"].append({"type": "additive", "value": additive})
                
                return KnowledgeBaseType.REGULATION, intent, params
        
        # 5. 尝试识别药材名称（即使没有明确的中药关键词）
        for herb in self.herb_names:
            if herb in query:
                params["entities"].append({"type": "herb", "value": herb})
                params["keywords"].append(herb)
                return KnowledgeBaseType.TCM, IntentType.TCM_QUERY_HERB, params
        
        # 6. 尝试识别肽序列
        import re
        seq_pattern = r'([ACDEFGHIKLMNPQRSTVWY]{2,})'
        matches = re.findall(seq_pattern, query)
        for match in matches:
            if len(match) >= 2:
                params["entities"].append({"type": "peptide_sequence", "value": match})
                return KnowledgeBaseType.PEPTIDE, IntentType.PEPTIDE_QUERY_SEQUENCE, params
        
        # 7. 尝试识别标准代码
        for code in self.standard_codes:
            if code in query:
                params["entities"].append({"type": "standard_code", "value": code})
                return KnowledgeBaseType.REGULATION, IntentType.REG_QUERY_STANDARD, params
        
        # 8. 默认返回未知意图
        return KnowledgeBaseType.UNKNOWN, IntentType.UNKNOWN_INTENT, params
    
    def get_intent_description(self, intent_type: IntentType) -> str:
        """获取意图类型的描述"""
        descriptions = {
            IntentType.TCM_QUERY_HERB: "查询中药材信息",
            IntentType.TCM_QUERY_COMPOUND: "查询中药化合物",
            IntentType.TCM_QUERY_TARGET: "查询作用靶点",
            IntentType.TCM_CHECK_HOMOLOGY: "检查药食同源状态",
            IntentType.TCM_SEARCH_EFFECTS: "按功效搜索药材",
            IntentType.PEPTIDE_QUERY_SEQUENCE: "查询肽序列信息",
            IntentType.PEPTIDE_SEARCH_ACTIVITY: "按活性类型搜索肽",
            IntentType.PEPTIDE_SEARCH_SOURCE: "按来源搜索肽",
            IntentType.REG_QUERY_STANDARD: "查询食品安全标准",
            IntentType.REG_CHECK_ADDITIVE: "检查食品添加剂使用规定",
            IntentType.REG_CHECK_HOMOLOGY: "检查药食同源审批状态",
            IntentType.REG_VALIDATE_FORMULA: "验证配方成分合规性",
            IntentType.GENERAL_HELP: "获取帮助信息",
            IntentType.GENERAL_ABOUT: "获取系统信息",
            IntentType.UNKNOWN_INTENT: "未知意图",
        }
        return descriptions.get(intent_type, "未知")
    
    def get_knowledge_base_description(self, kb_type: KnowledgeBaseType) -> str:
        """获取知识库类型的描述"""
        descriptions = {
            KnowledgeBaseType.TCM: "中药知识库 (TCMSP)",
            KnowledgeBaseType.PEPTIDE: "食源性多肽知识库 (DFBP)",
            KnowledgeBaseType.REGULATION: "中国食品法规库",
            KnowledgeBaseType.GENERAL: "通用查询",
            KnowledgeBaseType.UNKNOWN: "未知知识库",
        }
        return descriptions.get(kb_type, "未知")


# 全局实例
intent_recognition_service = IntentRecognitionService()

logger.info("⚡ 智能意图识别服务初始化完成")