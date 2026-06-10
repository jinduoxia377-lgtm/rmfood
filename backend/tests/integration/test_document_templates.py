"""文档模板系统测试"""
import sys
sys.path.insert(0, '.')

from app.services.document_templates import (
    DocumentTemplateService,
    DocumentConverter,
    MarkdownParser,
    HTMLParser,
    ChineseMedicineReportTemplate,
    ExperimentDataTemplate,
    FormulaAnalysisReportTemplate,
)

def test_markdown_parser():
    print("=== 测试 Markdown 解析器 ===")
    parser = MarkdownParser()
    md_text = """# 这是一级标题

## 二级标题

### 三级标题

这是一段普通文本。

## 列表测试

- 项目一
- 项目二
- 项目三

## 表格测试

| 列1 | 列2 | 列3 |
|-----|-----|-----|
| A1 | A2 | A3 |
| B1 | B2 | B3 |
"""
    elements = parser.parse(md_text)
    print(f"解析出 {len(elements)} 个元素")
    for elem in elements:
        print(f"  - 类型: {elem['type']}, 内容: {str(elem)[:50]}...")
    print("Markdown 解析器测试通过!\n")

def test_html_parser():
    print("=== 测试 HTML 解析器 ===")
    parser = HTMLParser()
    html_content = """
    <h1>HTML标题</h1>
    <p>这是段落内容</p>
    <ul>
        <li>列表项1</li>
        <li>列表项2</li>
    </ul>
    <table>
        <tr><td>表头1</td><td>表头2</td></tr>
        <tr><td>数据1</td><td>数据2</td></tr>
    </table>
    """
    elements = parser.parse(html_content)
    print(f"解析出 {len(elements)} 个元素")
    for elem in elements:
        print(f"  - 类型: {elem['type']}")
    print("HTML 解析器测试通过!\n")

def test_document_converter():
    print("=== 测试文档转换器 ===")
    converter = DocumentConverter()

    md_text = """# 测试标题

这是一段测试文本。

## 列表

- 项目A
- 项目B

## 表格

| 名称 | 数值 |
|------|------|
| 测试1 | 100 |
| 测试2 | 200 |
"""
    docx_path, docx_name = converter.markdown_to_docx(md_text, "temp_files/test_md.docx")
    print(f"DOCX 生成成功: {docx_name}")

    pdf_path, pdf_name = converter.markdown_to_pdf(md_text, "temp_files/test_md.pdf")
    print(f"PDF 生成成功: {pdf_name}")

    html_content = """<h1>HTML标题</h1><p>HTML段落</p>"""
    docx_path2, docx_name2 = converter.html_to_docx(html_content, "temp_files/test_html.docx")
    print(f"HTML->DOCX 生成成功: {docx_name2}")

    print("文档转换器测试通过!\n")

def test_chinese_medicine_report():
    print("=== 测试中药配方报告模板 ===")
    template = ChineseMedicineReportTemplate()

    result = template.generate_docx(
        output_path="temp_files/test_cm_report.docx",
        title="中药配方报告",
        date="2024-01-15",
        institution="中医药研究院",
        toc=["配方基本信息", "药材组成", "功效主治", "用法用量", "参考文献"],
        formula_name="清肺排毒汤",
        herbs=[
            {"name": "麻黄", "amount": 9, "unit": "g"},
            {"name": "炙甘草", "amount": 6, "unit": "g"},
            {"name": "杏仁", "amount": 9, "unit": "g"},
            {"name": "生石膏", "amount": 30, "unit": "g"},
        ],
        efficacy="清肺排毒、宣肺泄热、化湿解毒",
        indications="用于轻型、普通型、重型患者的治疗",
        dosage="每日1剂，水煎服",
        usage="水煎服，早晚各一次",
        precautions="孕妇慎用",
        references=[
            "《伤寒论》",
            "《温病条辨》",
        ]
    )
    print(f"中药配方报告生成成功: {result}")
    print("中药配方报告模板测试通过!\n")

def test_experiment_data_template():
    print("=== 测试实验数据表模板 ===")
    template = ExperimentDataTemplate()

    sheets = [
        {
            "name": "成分分析",
            "title": "实验数据 - 成分分析",
            "headers": ["序号", "成分名称", "含量(%)", "检测方法"],
            "data": [
                ["1", "蛋白质", "25.3", "凯氏定氮法"],
                ["2", "脂肪", "3.2", "索氏提取法"],
                ["3", "碳水化合物", "65.5", "计算法"],
            ]
        },
        {
            "name": "安全性检测",
            "title": "实验数据 - 安全性检测",
            "headers": ["检测项目", "结果", "标准限值", "判定"],
            "data": [
                ["重金属铅", "<0.1 mg/kg", "≤0.5 mg/kg", "合格"],
                ["重金属汞", "<0.01 mg/kg", "≤0.1 mg/kg", "合格"],
                ["农药残留", "未检出", "不得检出", "合格"],
            ]
        }
    ]

    result = template.generate_xlsx(
        output_path="temp_files/test_exp_data.xlsx",
        title="实验数据汇总",
        sheets=sheets
    )
    print(f"实验数据表生成成功: {result}")
    print("实验数据表模板测试通过!\n")

def test_formula_analysis_report():
    print("=== 测试配方分析报告模板 ===")
    template = FormulaAnalysisReportTemplate()

    result = template.generate_docx(
        output_path="temp_files/test_formula_analysis.docx",
        title="配方分析报告",
        formula_info={
            "配方名称": "人参养荣汤",
            "主要药材": "人参、当归、黄芪、白术",
            "剂型": "汤剂",
            "适用人群": "气血两虚证",
        },
        efficacy_analysis="本方具有益气补血、养心安神的功效。方中人参大补元气，为君药；黄芪、白术健脾益气，共为臣药；当归养血和营，为佐药；诸药合用，共奏奇效。",
        taste_evaluation="汤剂口味微甘，带有淡淡药香，口感较好，患者依从性高。",
        safety_assessment="经毒理学研究证实，本方安全可靠。偶见轻微胃肠道不适，建议饭后服用。不宜与藜芦同用。"
    )
    print(f"配方分析报告生成成功: {result}")
    print("配方分析报告模板测试通过!\n")

def test_document_template_service():
    print("=== 测试文档模板服务 ===")
    service = DocumentTemplateService()

    md_text = """# 报告标题

## 第一章

这是正文内容。

## 第二章

- 要点1
- 要点2

## 数据表

| 项目 | 数值 |
|------|------|
| A | 100 |
| B | 200 |
"""
    docx_path, docx_name = service.markdown_to_docx(md_text, "test_report.docx")
    print(f"Markdown->DOCX: {docx_name}")

    pdf_path, pdf_name = service.markdown_to_pdf(md_text, "test_report.pdf")
    print(f"Markdown->PDF: {pdf_name}")

    cm_path, cm_name = service.generate_chinese_medicine_report(
        title="中药配方报告测试",
        date="2024-01-20",
        institution="测试机构",
        toc=["基本信息", "药材组成"],
        formula_name="测试配方",
        herbs=[{"name": "测试药材", "amount": 10, "unit": "g"}],
        efficacy="测试功效",
        indications="测试主治",
        dosage="测试用量",
        usage="测试用法",
        precautions="测试注意",
        references=["测试文献1", "测试文献2"],
    )
    print(f"中药配方报告: {cm_name}")

    exp_path, exp_name = service.generate_experiment_data(
        title="实验数据",
        sheets=[{
            "name": "Sheet1",
            "title": "测试数据",
            "headers": ["A", "B", "C"],
            "data": [["1", "2", "3"]]
        }]
    )
    print(f"实验数据表: {exp_name}")

    fa_path, fa_name = service.generate_formula_analysis_report(
        title="配方分析报告测试",
        formula_info={"测试": "数据"},
        efficacy_analysis="功效分析内容",
        taste_evaluation="口感评估内容",
        safety_assessment="安全性评估内容",
    )
    print(f"配方分析报告: {fa_name}")

    print("文档模板服务测试通过!\n")

if __name__ == "__main__":
    print("=" * 50)
    print("文档模板系统测试")
    print("=" * 50 + "\n")

    test_markdown_parser()
    test_html_parser()
    test_document_converter()
    test_chinese_medicine_report()
    test_experiment_data_template()
    test_formula_analysis_report()
    test_document_template_service()

    print("=" * 50)
    print("所有测试通过!")
    print("=" * 50)
