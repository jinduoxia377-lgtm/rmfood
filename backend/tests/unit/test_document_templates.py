"""app/services/document_templates.py 单元测试

覆盖 Markdown 解析器与中药报告模板生成。
"""

from app.services.document_templates import MarkdownParser, ChineseMedicineReportTemplate


class TestMarkdownParser:
    def test_parse_headings(self):
        parser = MarkdownParser()
        elements = parser.parse("# 一级标题\n## 二级标题\n")
        assert elements[0]["type"] == "heading"
        assert elements[0]["level"] == 1
        assert elements[0]["text"] == "一级标题"
        assert elements[1]["level"] == 2

    def test_parse_list(self):
        parser = MarkdownParser()
        elements = parser.parse("- 第一项\n- 第二项\n")
        assert elements[0]["type"] == "list"
        assert elements[0]["items"] == ["第一项", "第二项"]

    def test_parse_table(self):
        parser = MarkdownParser()
        md = "| 名称 | 用量 |\n|---|---|\n| 人参 | 3g |\n"
        elements = parser.parse(md)
        table = next(e for e in elements if e["type"] == "table")
        assert table["data"][0] == ["名称", "用量"]

    def test_parse_paragraph(self):
        parser = MarkdownParser()
        elements = parser.parse("这是第一段文字。\n")
        assert elements[0]["type"] == "paragraph"
        assert "第一段" in elements[0]["text"]

    def test_extract_plain_text(self):
        parser = MarkdownParser()
        text = parser.extract_plain_text("# 标题\n\n**加粗** 和 *斜体* [链接](http://example.com)\n")
        assert "标题" in text
        assert "#" not in text


class TestChineseMedicineReportTemplate:
    def test_generate_markdown(self):
        template = ChineseMedicineReportTemplate()
        md = template.generate_markdown(
            title="测试报告",
            date="2026-01-01",
            institution="测试机构",
            toc=["封面信息", "配方信息"],
            formula_name="养气方",
            herbs=[{"name": "人参", "dosage": "3g"}],
            efficacy="补气",
            indications="气虚乏力",
            dosage="10g/次",
            usage="煎服",
            precautions="孕妇慎用",
            references=["《中华本草》"],
        )
        assert "测试报告" in md
        assert "养气方" in md
        assert "人参" in md
        assert "补气" in md


class TestDocumentConverter:
    def test_markdown_to_docx_in_memory(self):
        from app.services.document_templates import DocumentConverter
        converter = DocumentConverter()
        result = converter.markdown_to_docx("# 标题\n\n这是一个段落。\n\n- 条目A\n- 条目B\n")
        assert result[1] is None  # 无输出路径时文件名为 None
        doc = result[2]
        assert doc is not None
        assert len(doc.paragraphs) >= 1

    def test_markdown_to_docx_with_path(self, tmp_path):
        from app.services.document_templates import DocumentConverter
        converter = DocumentConverter()
        output = tmp_path / "report.docx"
        result = converter.markdown_to_docx("# 标题\n\n内容", str(output))
        assert result[1] == "report.docx"
        assert output.exists()

    def test_html_to_docx(self, tmp_path):
        from app.services.document_templates import DocumentConverter
        converter = DocumentConverter()
        output = tmp_path / "html_report.docx"
        result = converter.html_to_docx("<h1>标题</h1><p>段落内容</p>", str(output))
        assert result[1] == "html_report.docx"
        assert output.exists()

    def test_markdown_to_pdf(self, tmp_path):
        from app.services.document_templates import DocumentConverter
        converter = DocumentConverter()
        output = tmp_path / "report.pdf"
        returned = converter.markdown_to_pdf("# 标题\n\n这是一个中文 PDF 测试段落。\n", str(output))
        assert returned == str(output)
        assert output.exists()


class TestChineseFontManager:
    def test_get_pdf_font(self):
        from app.services.document_templates import ChineseFontManager
        mgr = ChineseFontManager()
        font = mgr.get_pdf_font()
        assert isinstance(font, str)
        assert font
        bold_font = mgr.get_pdf_font(bold=True)
        assert isinstance(bold_font, str)

    def test_get_docx_font(self):
        from app.services.document_templates import ChineseFontManager
        mgr = ChineseFontManager()
        font, bold = mgr.get_docx_font()
        assert font
        assert bold
        serif_font, _ = mgr.get_docx_font(serif=True)
        assert serif_font


class TestExperimentDataTemplate:
    def test_generate_xlsx(self, tmp_path):
        from app.services.document_templates import ExperimentDataTemplate
        template = ExperimentDataTemplate()
        output = tmp_path / "experiment.xlsx"
        result = template.generate_xlsx(
            str(output),
            "实验数据",
            [
                {"name": "Sheet1", "headers": ["A", "B"], "data": [[1, 2], [3, 4]]},
            ],
        )
        assert result == str(output)
        assert output.exists()


class TestFormulaAnalysisReportTemplate:
    def test_generate_docx(self, tmp_path):
        from app.services.document_templates import FormulaAnalysisReportTemplate
        template = FormulaAnalysisReportTemplate()
        output = tmp_path / "analysis.docx"
        result = template.generate_docx(
            str(output),
            "分析报告",
            "养气方",
            {"name": "养气方", "safety_status": "安全"},
            [{"name": "人参", "dosage": "3g"}],
            [],
            {"efficacy": 80.0},
            {"status": "pass"},
            {"dosage": "10g"},
            "2026-01-01",
        )
        assert result == str(output)
        assert output.exists()


class TestDocumentTemplateService:
    def test_markdown_to_docx(self):
        from app.services.document_templates import DocumentTemplateService
        svc = DocumentTemplateService()
        result = svc.markdown_to_docx("# 标题\n\n内容", "report.docx")
        assert result is not None

    def test_generate_chinese_medicine_report(self):
        from app.services.document_templates import DocumentTemplateService
        svc = DocumentTemplateService()
        result = svc.generate_chinese_medicine_report(
            title="报告", date="2026-01-01", institution="机构", toc=["封面"],
            formula_name="养气方", herbs=[{"name": "人参", "dosage": "3g"}],
            efficacy="补气", indications="气虚", dosage="10g", usage="煎服",
            precautions="无", references=["文献"],
        )
        assert result is not None

    def test_generate_experiment_data(self):
        from app.services.document_templates import DocumentTemplateService
        svc = DocumentTemplateService()
        result = svc.generate_experiment_data("实验数据", [
            {"name": "Sheet1", "headers": ["A", "B"], "data": [[1, 2]]},
        ])
        assert result is not None

    def test_generate_formula_analysis_report(self):
        from app.services.document_templates import DocumentTemplateService
        svc = DocumentTemplateService()
        result = svc.generate_formula_analysis_report(
            title="分析", formula_name="养气方", formula_info={},
            ingredients=[], peptides=[], scores={}, safety_info={}, usage_info={},
            generated_at="2026-01-01",
        )
        assert result is not None

    def test_generate_explainability_report(self):
        from app.services.document_templates import DocumentTemplateService
        svc = DocumentTemplateService()
        result = svc.generate_explainability_report(
            formula_name="养气方",
            scores={"overall": 80, "efficacy": 85, "safety": 90, "cost": 70},
            core_ingredients=[
                {"name": "人参", "role": "core", "mechanism": "补气", "evidence": "本草"}
            ],
            synergies=[{"a": "黄芪", "b": "人参", "strength": 0.8, "desc": "协同补气"}],
            antagonisms=[],
            compliance_notes=["✓ 合规"],
            recommendations=["建议一"],
            summary="报告摘要",
        )
        assert result is not None
        assert len(result) == 2  # (path, filename)

    def test_generate_explainability_report_pdf(self):
        from app.services.document_templates import DocumentTemplateService
        svc = DocumentTemplateService()
        result = svc.generate_explainability_report_pdf(
            formula_name="养气方",
            scores={"overall": 80, "efficacy": 85, "safety": 90, "cost": 70},
            core_ingredients=[
                {"name": "人参", "role": "core", "mechanism": "补气", "evidence": "本草"}
            ],
            synergies=[{"a": "黄芪", "b": "人参", "strength": 0.8, "desc": "协同补气"}],
            antagonisms=[],
            compliance_notes=["合规"],
            recommendations=["建议一"],
            summary="报告摘要",
        )
        assert result is not None