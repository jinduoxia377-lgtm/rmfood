"""测试文档模板系统"""
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.file_generator import file_generator_service, FileFormat
from app.services.template_manager import get_template_manager


def test_markdown_conversion():
    """测试Markdown转换功能"""
    print("测试Markdown转换功能...")
    
    template_manager = get_template_manager(file_generator_service)
    
    # 测试Markdown内容
    markdown = """# 中药配方报告

## 基本信息
- 配方名称：补气养血汤
- 适用症状：气血两虚
- 制备方法：水煎服

## 成分表
| 药材 | 用量 | 功效 |
|------|------|------|
| 人参 | 10g | 大补元气 |
| 当归 | 15g | 补血活血 |
| 黄芪 | 20g | 补气升阳 |
| 熟地 | 15g | 滋阴补血 |

## 功效主治
本品具有补气养血、健脾益胃的功效，适用于气血两虚所致的面色苍白、头晕乏力、心悸气短等症状。

## 用法用量
每日1剂，分2次服用，饭后温服。

## 注意事项
1. 孕妇慎用
2. 感冒发热者忌用
3. 高血压患者应在医生指导下使用

## 参考文献
1. 《中药学》
2. 《方剂学》
"""
    
    # 转换为内容结构
    content = template_manager.convert_markdown_to_content(markdown, 'tcm_recipe')
    print("✓ Markdown转换成功")
    print(f"  转换后内容包含: {list(content.keys())}")
    
    return content

def test_file_generation(content):
    """测试文件生成功能"""
    print("\n测试文件生成功能...")
    
    template_manager = get_template_manager(file_generator_service)
    
    # 测试PDF生成
    try:
        pdf_path, pdf_name = template_manager.generate_from_markdown(
            markdown_content, FileFormat.PDF, "test_recipe.pdf", "tcm_recipe"
        )
        print(f"✓ PDF生成成功: {pdf_path}")
    except Exception as e:
        print(f"✗ PDF生成失败: {e}")
    
    # 测试Word生成
    try:
        docx_path, docx_name = template_manager.generate_from_markdown(
            markdown_content, FileFormat.DOCX, "test_recipe.docx", "tcm_recipe"
        )
        print(f"✓ Word生成成功: {docx_path}")
    except Exception as e:
        print(f"✗ Word生成失败: {e}")
    
    # 测试Excel生成
    try:
        xlsx_path, xlsx_name = template_manager.generate_from_markdown(
            markdown_content, FileFormat.XLSX, "test_recipe.xlsx", "tcm_recipe"
        )
        print(f"✓ Excel生成成功: {xlsx_path}")
    except Exception as e:
        print(f"✗ Excel生成失败: {e}")

def test_template_from_data():
    """测试从数据生成模板"""
    print("\n测试从数据生成模板...")
    
    template_manager = get_template_manager(file_generator_service)
    
    # 测试数据
    data = {
        "cover": {
            "title": "中药配方报告",
            "subtitle": "专业配方分析报告",
            "date": "2026年4月25日"
        },
        "table_of_contents": [
            {"title": "基本信息", "level": 1},
            {"title": "成分表", "level": 1},
            {"title": "功效主治", "level": 1},
            {"title": "用法用量", "level": 1},
            {"title": "注意事项", "level": 1},
            {"title": "参考文献", "level": 1}
        ],
        "basic_info": [
            {"content": ["配方名称：补气养血汤", "适用症状：气血两虚", "制备方法：水煎服"]}
        ],
        "ingredients": [
            {
                "table": {
                    "headers": ["药材", "用量", "功效"],
                    "data": [
                        ["人参", "10g", "大补元气"],
                        ["当归", "15g", "补血活血"],
                        ["黄芪", "20g", "补气升阳"],
                        ["熟地", "15g", "滋阴补血"]
                    ]
                }
            }
        ],
        "effects": [
            {"content": ["本品具有补气养血、健脾益胃的功效，适用于气血两虚所致的面色苍白、头晕乏力、心悸气短等症状。"]}
        ],
        "usage": [
            {"content": ["每日1剂，分2次服用，饭后温服。"]}
        ],
        "notes": [
            {"content": ["1. 孕妇慎用", "2. 感冒发热者忌用", "3. 高血压患者应在医生指导下使用"]}
        ],
        "references": [
            {"content": ["1. 《中药学》", "2. 《方剂学》"]}
        ]
    }
    
    try:
        pdf_path, pdf_name = template_manager.generate_from_template(
            "tcm_recipe", data, FileFormat.PDF, "test_from_data.pdf"
        )
        print(f"✓ 从数据生成PDF成功: {pdf_path}")
    except Exception as e:
        print(f"✗ 从数据生成PDF失败: {e}")


if __name__ == "__main__":
    print("=== 文档模板系统测试 ===")
    
    # 测试Markdown转换
    content = test_markdown_conversion()
    
    # 保存Markdown内容用于测试
    global markdown_content
    markdown_content = """# 中药配方报告

## 基本信息
- 配方名称：补气养血汤
- 适用症状：气血两虚
- 制备方法：水煎服

## 成分表
| 药材 | 用量 | 功效 |
|------|------|------|
| 人参 | 10g | 大补元气 |
| 当归 | 15g | 补血活血 |
| 黄芪 | 20g | 补气升阳 |
| 熟地 | 15g | 滋阴补血 |

## 功效主治
本品具有补气养血、健脾益胃的功效，适用于气血两虚所致的面色苍白、头晕乏力、心悸气短等症状。

## 用法用量
每日1剂，分2次服用，饭后温服。

## 注意事项
1. 孕妇慎用
2. 感冒发热者忌用
3. 高血压患者应在医生指导下使用

## 参考文献
1. 《中药学》
2. 《方剂学》
"""
    
    # 测试文件生成
    test_file_generation(content)
    
    # 测试从数据生成模板
    test_template_from_data()
    
    print("\n=== 测试完成 ===")
