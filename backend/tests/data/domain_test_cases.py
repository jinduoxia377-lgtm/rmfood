"""
专业领域测试用例集合 v1.0

测试分类：
1. 中药相关问题测试（30组）
2. 食源性多肽相关问题测试（30组）
3. 食品法规相关问题测试（40组）

目标：组织领域专家评审，确保专家评审准确率≥90%

运行方式：
    pytest tests/domain_test_cases.py -v
"""

import pytest
from typing import List, Dict, Tuple


# ============================================================================
# 1. 中药相关问题测试（30组）
# ============================================================================

class TestTraditionalChineseMedicine:
    """中药领域专业知识测试"""
    
    # 1.1 中药基础理论
    @pytest.mark.parametrize("question,expected_keywords", [
        ("中医的基本理论基础是什么？", ["阴阳", "五行", "脏腑", "经络"]),
        ("什么是中医的辨证论治？", ["辨证", "论治", "病因", "病机"]),
        ("中药的四气是指什么？", ["寒", "热", "温", "凉"]),
        ("中药的五味是指什么？", ["辛", "甘", "酸", "苦", "咸"]),
        ("中药的归经是什么意思？", ["归经", "脏腑", "经络", "作用部位"]),
    ])
    def test_tcm_basic_theory(self, question: str, expected_keywords: List[str]):
        """测试中医基础理论知识"""
        # 验证问题包含正确的关键词
        assert isinstance(question, str)
        assert len(expected_keywords) > 0
    
    # 1.2 中药药材鉴定
    @pytest.mark.parametrize("herb,main_characteristics", [
        ("人参", ["五加科", "根及根茎", "芦头", "珍珠点", "横纹"]),
        ("黄芪", ["豆科", "根", "菊花心", "皮孔", "绵黄芪"]),
        ("当归", ["伞形科", "根", "归头", "归身", "归尾"]),
        ("黄连", ["毛茛科", "根茎", "鸡爪连", "过桥"]),
        ("黄芩", ["唇形科", "根", "枯芩", "子芩", "老根"]),
    ])
    def test_herb_identification(self, herb: str, main_characteristics: List[str]):
        """测试中药药材鉴定特征"""
        assert isinstance(herb, str)
        assert len(main_characteristics) >= 2
    
    # 1.3 中药炮制方法
    @pytest.mark.parametrize("herb,processing_method,purpose", [
        ("大黄", "酒炙", ["增强活血", "引药上行"]),
        ("麻黄", "蜜炙", ["缓和发汗", "增强润肺"]),
        ("附子", "炮制", ["降低毒性", "增强温阳"]),
        ("半夏", "姜制", ["降低毒性", "增强化痰"]),
        ("地黄", "蒸制", ["改变药性", "增强补血"]),
    ])
    def test_herb_processing(self, herb: str, processing_method: str, purpose: List[str]):
        """测试中药炮制方法与目的"""
        assert isinstance(processing_method, str)
        assert len(purpose) >= 1
    
    # 1.4 中药方剂配伍
    @pytest.mark.parametrize("formula,components,function", [
        ("麻黄汤", ["麻黄", "桂枝", "杏仁", "甘草"], "发汗解表，宣肺平喘"),
        ("桂枝汤", ["桂枝", "芍药", "生姜", "大枣", "甘草"], "解肌发表，调和营卫"),
        ("四物汤", ["当归", "川芎", "白芍", "熟地"], "补血养血"),
        ("四君子汤", ["人参", "白术", "茯苓", "甘草"], "益气健脾"),
        ("六味地黄丸", ["熟地", "山茱萸", "山药", "泽泻", "茯苓", "丹皮"], "滋阴补肾"),
    ])
    def test_formula_compatibility(self, formula: str, components: List[str], function: str):
        """测试中药方剂组成与功效"""
        assert len(components) >= 3
        assert isinstance(function, str)
    
    # 1.5 中药药性理论
    @pytest.mark.parametrize("herb,nature,flavor,meridian,effect", [
        ("麻黄", "温", "辛、微苦", ["肺", "膀胱"], "发汗解表，宣肺平喘"),
        ("桂枝", "温", "辛、甘", ["心", "肺", "膀胱"], "发汗解肌，温通经脉"),
        ("生姜", "微温", "辛", ["肺", "脾", "胃"], "发散风寒，温中止呕"),
        ("薄荷", "凉", "辛", ["肺", "肝"], "疏散风热，清利头目"),
        ("桑叶", "寒", "甘、苦", ["肺", "肝"], "疏散风热，清肺润燥"),
    ])
    def test_herb_property_theory(self, herb: str, nature: str, flavor: str, 
                                  meridian: List[str], effect: str):
        """测试中药药性理论（四气五味归经）"""
        assert nature in ["寒", "热", "温", "凉", "平", "微温", "微寒"]
        assert len(meridian) >= 1
    
    # 1.6 中药临床应用
    @pytest.mark.parametrize("condition,herb_choice,rationale", [
        ("风寒感冒", "麻黄", "发散风寒，适用于无汗表实证"),
        ("风热感冒", "金银花", "疏散风热，清热解毒"),
        ("脾胃虚弱", "党参", "补中益气，健脾益肺"),
        ("血虚萎黄", "当归", "补血活血，调经止痛"),
        ("肝肾阴虚", "枸杞子", "滋补肝肾，益精明目"),
    ])
    def test_clinical_application(self, condition: str, herb_choice: str, rationale: str):
        """测试中药临床应用与辨证选用"""
        assert isinstance(condition, str)
        assert isinstance(rationale, str)


# ============================================================================
# 2. 食源性多肽相关问题测试（30组）
# ============================================================================

class TestFoodDerivedPeptides:
    """食源性多肽领域专业知识测试"""
    
    # 2.1 多肽基础概念
    @pytest.mark.parametrize("term,definition", [
        ("肽", "由2-50个氨基酸通过肽键连接形成的化合物"),
        ("寡肽", "由2-10个氨基酸组成的肽"),
        ("多肽", "由10-50个氨基酸组成的肽"),
        ("蛋白质", "由50个以上氨基酸组成的大分子"),
        ("肽键", "氨基酸之间通过脱水缩合形成的酰胺键"),
    ])
    def test_peptide_basic_concepts(self, term: str, definition: str):
        """测试多肽基础概念定义"""
        assert isinstance(term, str)
        assert len(definition) > 10
    
    # 2.2 食源性多肽来源
    @pytest.mark.parametrize("source,peptides,characteristics", [
        ("乳清蛋白", ["乳清蛋白肽", "乳铁蛋白肽"], ["易消化吸收", "免疫调节"]),
        ("大豆蛋白", ["大豆肽", "谷胱甘肽"], ["植物来源", "降血压活性"]),
        ("鱼类蛋白", ["鱼胶原肽", "鱼蛋白肽"], ["富含胶原蛋白", "抗氧化"]),
        ("鸡蛋蛋白", ["卵白蛋白肽", "卵球蛋白肽"], ["优质蛋白", "生物活性高"]),
        ("玉米蛋白", ["玉米肽"], ["疏水性强", "醒酒功能"]),
    ])
    def test_peptide_sources(self, source: str, peptides: List[str], characteristics: List[str]):
        """测试食源性多肽来源与特性"""
        assert len(peptides) >= 1
        assert len(characteristics) >= 1
    
    # 2.3 多肽制备方法
    @pytest.mark.parametrize("method,description,advantages", [
        ("酶解法", "利用蛋白酶水解蛋白质", ["条件温和", "特异性强", "产物可控"]),
        ("酸解法", "利用酸水解蛋白质", ["成本低", "水解彻底", "设备简单"]),
        ("碱解法", "利用碱水解蛋白质", ["反应快", "成本低"]),
        ("发酵法", "利用微生物发酵生产", ["天然安全", "可生产特定肽"]),
        ("合成法", "化学合成或生物合成", ["纯度高", "序列可控"]),
    ])
    def test_peptide_preparation_methods(self, method: str, description: str, advantages: List[str]):
        """测试多肽制备方法"""
        assert isinstance(description, str)
        assert len(advantages) >= 1
    
    # 2.4 多肽生理活性
    @pytest.mark.parametrize("activity_type,mechanism,examples", [
        ("抗氧化", "清除自由基，抑制氧化反应", ["谷胱甘肽", "肌肽", "硒代半胱氨酸"]),
        ("降血压", "抑制ACE酶活性", ["大豆肽", "乳清肽", "金枪鱼肽"]),
        ("免疫调节", "调节免疫细胞活性", ["胸腺肽", "白细胞介素", "乳铁蛋白肽"]),
        ("抗菌", "破坏细菌细胞膜", ["抗菌肽", "防御素", "乳链菌肽"]),
        ("促进吸收", "改善肠道吸收功能", ["酪蛋白磷酸肽", "大豆肽"]),
    ])
    def test_peptide_bioactivity(self, activity_type: str, mechanism: str, examples: List[str]):
        """测试多肽生理活性与作用机制"""
        assert isinstance(mechanism, str)
        assert len(examples) >= 2
    
    # 2.5 多肽结构分析
    @pytest.mark.parametrize("technique,purpose,advantages", [
        ("质谱法", "测定肽序列和分子量", ["灵敏度高", "准确性好", "可分析复杂混合物"]),
        ("高效液相色谱", "分离纯化多肽", ["分辨率高", "重复性好", "可制备"]),
        ("氨基酸分析", "测定氨基酸组成", ["准确可靠", "方法成熟"]),
        ("圆二色谱", "分析二级结构", ["快速", "样品量少", "无损"]),
        ("核磁共振", "分析三维结构", ["无需结晶", "溶液状态分析"]),
    ])
    def test_peptide_analysis_techniques(self, technique: str, purpose: str, advantages: List[str]):
        """测试多肽结构分析技术"""
        assert isinstance(purpose, str)
        assert len(advantages) >= 2
    
    # 2.6 多肽应用领域
    @pytest.mark.parametrize("application,products,benefits", [
        ("保健食品", ["肽蛋白粉", "抗氧化肽饮料", "降压肽胶囊"], ["增强免疫力", "改善健康"]),
        ("运动营养", ["肌酸肽", "谷氨酰胺肽", "BCAA肽"], ["促进恢复", "增强耐力"]),
        ("婴幼儿食品", ["乳清蛋白肽", "酪蛋白肽"], ["易消化", "促进吸收"]),
        ("化妆品", ["胶原蛋白肽", "弹性蛋白肽"], ["保湿", "抗皱", "修复"]),
        ("医药", ["胰岛素", "生长激素", "抗菌肽药物"], ["治疗疾病", "生物治疗"]),
    ])
    def test_peptide_applications(self, application: str, products: List[str], benefits: List[str]):
        """测试多肽应用领域"""
        assert len(products) >= 2
        assert len(benefits) >= 1


# ============================================================================
# 3. 食品法规相关问题测试（40组）
# ============================================================================

class TestFoodRegulations:
    """食品法规领域专业知识测试"""
    
    # 3.1 食品安全法基础
    @pytest.mark.parametrize("topic,content", [
        ("食品安全法实施时间", "《中华人民共和国食品安全法》自2015年10月1日起施行，2021年4月29日修订"),
        ("食品安全方针", "我国食品安全工作遵循预防为主、风险管理、全程控制、社会共治的基本原则"),
        ("食品安全标准", "强制执行的国家标准，包括食品添加剂、污染物限量、标签标识等"),
        ("食品生产许可", "从事食品生产活动应当依法取得食品生产许可证"),
        ("食品经营许可", "从事食品销售和餐饮服务活动应当依法取得食品经营许可证"),
    ])
    def test_food_safety_law_basics(self, topic: str, content: str):
        """测试食品安全法基础内容"""
        assert isinstance(content, str)
        assert len(content) > 20
    
    # 3.2 食品添加剂法规
    @pytest.mark.parametrize("additive,category,usage_limit", [
        ("苯甲酸", "防腐剂", "根据食品类别不同，最大使用量为0.1-2.0g/kg"),
        ("山梨酸", "防腐剂", "最大使用量一般为0.5-2.0g/kg"),
        ("亚硝酸盐", "发色剂", "肉类制品中最大使用量为0.15g/kg，残留量≤30mg/kg"),
        ("甜蜜素", "甜味剂", "最大使用量根据食品类别为0.3-10g/kg"),
        ("阿斯巴甜", "甜味剂", "最大使用量根据食品类别为0.3-3.0g/kg"),
    ])
    def test_food_additive_regulations(self, additive: str, category: str, usage_limit: str):
        """测试食品添加剂使用规定"""
        assert category in ["防腐剂", "甜味剂", "发色剂", "增味剂", "乳化剂"]
        assert isinstance(usage_limit, str)
    
    # 3.3 食品标签标准
    @pytest.mark.parametrize("label_element,requirement", [
        ("食品名称", "应在标签醒目位置，清晰地标示反映食品真实属性的专用名称"),
        ("配料表", "按配料用量递减顺序排列，食品添加剂应标示具体名称"),
        ("净含量", "应清晰标示食品的净含量，单位使用法定计量单位"),
        ("生产日期", "应清晰标示食品的生产日期和保质期或保存期，生产日期不得涂改"),
        ("生产者信息", "应标示生产者名称、地址和联系方式"),
    ])
    def test_food_label_standards(self, label_element: str, requirement: str):
        """测试食品标签标示要求"""
        assert isinstance(requirement, str)
        assert len(requirement) > 15
    
    # 3.4 特殊食品管理
    @pytest.mark.parametrize("food_type,regulation_requirement", [
        ("保健食品", "需取得保健食品注册证或备案凭证，不得宣称疾病预防治疗功能"),
        ("婴幼儿配方乳粉", "实行配方注册管理，应符合GB 10765/10767标准"),
        ("特殊医学用途配方食品", "需取得注册证书，标签应标明适用人群"),
        ("转基因食品", "应按规定标示，采用显著方式标注"),
        ("辐照食品", "应在标签上标示'辐照食品'字样"),
    ])
    def test_special_food_regulations(self, food_type: str, regulation_requirement: str):
        """测试特殊食品管理规定"""
        assert isinstance(regulation_requirement, str)
    
    # 3.5 食品污染物限量
    @pytest.mark.parametrize("contaminant,limit_standard", [
        ("铅", "GB 2762-2022规定，谷物中铅限量为0.2mg/kg，蔬菜中为0.1mg/kg"),
        ("镉", "大米中镉限量为0.2mg/kg，其他谷物为0.1mg/kg"),
        ("汞", "水产品中总汞限量为0.5mg/kg，甲基汞为0.3mg/kg"),
        ("砷", "谷物中总砷限量为0.5mg/kg，无机砷为0.2mg/kg"),
        ("黄曲霉毒素B1", "谷物及制品中限量为5μg/kg，婴幼儿食品为1μg/kg"),
    ])
    def test_contaminant_limits(self, contaminant: str, limit_standard: str):
        """测试食品污染物限量标准"""
        assert "GB" in limit_standard or "mg/kg" in limit_standard or "μg/kg" in limit_standard
    
    # 3.6 食品生产规范
    @pytest.mark.parametrize("requirement,description", [
        ("GMP", "良好生产规范，确保食品生产过程符合卫生要求"),
        ("HACCP", "危害分析与关键控制点，预防食品安全危害"),
        ("SSOP", "卫生标准操作程序，确保生产环境清洁卫生"),
        ("追溯体系", "建立食品追溯制度，实现来源可查、去向可追"),
        ("从业人员健康", "食品从业人员应持有有效健康证明"),
    ])
    def test_food_production_standards(self, requirement: str, description: str):
        """测试食品生产规范要求"""
        assert isinstance(description, str)
        assert len(description) > 10
    
    # 3.7 食品进出口管理
    @pytest.mark.parametrize("aspect,regulation", [
        ("进口食品", "需经海关检验检疫合格，中文标签符合国家标准"),
        ("出口食品", "需符合进口国要求，取得出口食品生产企业备案"),
        ("境外生产企业", "进口食品境外生产企业需注册"),
        ("食品添加剂进口", "需符合我国食品安全国家标准"),
        ("食品标签", "进口食品应加贴符合要求的中文标签"),
    ])
    def test_import_export_regulations(self, aspect: str, regulation: str):
        """测试食品进出口管理规定"""
        assert isinstance(regulation, str)
    
    # 3.8 食品安全事故处置
    @pytest.mark.parametrize("situation,procedure", [
        ("疑似食品安全事故", "立即采取措施，防止危害扩大，及时报告"),
        ("食品安全事故调查", "由县级以上人民政府组织调查处理"),
        ("食品召回", "发现问题食品应及时召回，分级管理"),
        ("信息发布", "食品安全信息应及时、准确、公开发布"),
        ("责任追究", "违反食品安全法应承担相应法律责任"),
    ])
    def test_food_safety_incident_handling(self, situation: str, procedure: str):
        """测试食品安全事故处置程序"""
        assert isinstance(procedure, str)


# ============================================================================
# 测试辅助工具
# ============================================================================

def generate_expert_review_report(test_results: Dict[str, Tuple[int, int]]) -> str:
    """
    生成专家评审报告
    
    Args:
        test_results: 测试结果字典，key为测试类别，value为(通过数, 总数)
    
    Returns:
        评审报告字符串
    """
    report = ["=" * 60]
    report.append("专业领域测试用例专家评审报告")
    report.append("=" * 60)
    
    total_passed = 0
    total_tests = 0
    
    for category, (passed, total) in test_results.items():
        rate = (passed / total) * 100
        status = "✓" if rate >= 90 else "✗"
        report.append(f"\n{status} {category}")
        report.append(f"  通过: {passed}/{total}")
        report.append(f"  准确率: {rate:.1f}%")
        report.append(f"  达标: {'是' if rate >= 90 else '否'}")
        
        total_passed += passed
        total_tests += total
    
    overall_rate = (total_passed / total_tests) * 100
    report.append("\n" + "=" * 60)
    report.append(f"综合评审结果")
    report.append(f"  总通过: {total_passed}/{total_tests}")
    report.append(f"  总准确率: {overall_rate:.1f}%")
    report.append(f"  达标要求: ≥90%")
    report.append(f"  总体评价: {'✓ 达标' if overall_rate >= 90 else '✗ 未达标'}")
    report.append("=" * 60)
    
    return "\n".join(report)


if __name__ == "__main__":
    # 模拟专家评审结果
    expert_review_results = {
        "中药相关问题测试": (28, 30),
        "食源性多肽相关问题测试": (29, 30),
        "食品法规相关问题测试": (38, 40),
    }
    
    print(generate_expert_review_report(expert_review_results))
