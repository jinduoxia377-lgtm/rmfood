"""文档模板管理系统

负责管理文档模板、Markdown转换和专业模板生成
"""
import re
from datetime import datetime
from typing import Any, Dict, Tuple

from app.services.file_generator import FileFormat, FileGeneratorService


class TemplateManager:
    """模板管理器"""

    def __init__(self, file_generator: FileGeneratorService):
        self.file_generator = file_generator
        self.templates = {
            'default': self._create_default_template(),
            'tcm_recipe': self._create_tcm_recipe_template(),
            'experiment_report': self._create_experiment_report_template(),
        }

    def _create_default_template(self) -> Dict[str, Any]:
        """创建默认模板"""
        return {
            'name': '默认模板',
            'structure': [
                'title',
                'sections',
                'footer'
            ],
            'styles': {
                'h1': {'font_size': 24, 'bold': True, 'alignment': 'center'},
                'h2': {'font_size': 18, 'bold': True},
                'h3': {'font_size': 16, 'bold': True},
                'paragraph': {'font_size': 12, 'line_spacing': 1.5},
                'table': {'border': True, 'header_bold': True}
            }
        }

    def _create_tcm_recipe_template(self) -> Dict[str, Any]:
        """创建中药配方报告模板"""
        return {
            'name': '中药配方报告',
            'structure': [
                'cover',
                'table_of_contents',
                'basic_info',
                'ingredients',
                'effects',
                'usage',
                'notes',
                'references'
            ],
            'styles': {
                'cover_title': {'font_size': 28, 'bold': True, 'alignment': 'center'},
                'section_title': {'font_size': 16, 'bold': True},
                'subsection_title': {'font_size': 14, 'bold': True},
                'paragraph': {'font_size': 12, 'line_spacing': 1.5},
                'table': {'border': True, 'header_bold': True, 'alignment': 'center'}
            }
        }

    def _create_experiment_report_template(self) -> Dict[str, Any]:
        """创建实验报告模板"""
        return {
            'name': '实验报告',
            'structure': [
                'title',
                'abstract',
                'materials',
                'methods',
                'results',
                'discussion',
                'conclusion',
                'references'
            ],
            'styles': {
                'h1': {'font_size': 20, 'bold': True, 'alignment': 'center'},
                'h2': {'font_size': 16, 'bold': True},
                'h3': {'font_size': 14, 'bold': True},
                'paragraph': {'font_size': 12, 'line_spacing': 1.5},
                'table': {'border': True, 'header_bold': True}
            }
        }

    def get_template(self, template_name: str) -> Dict[str, Any]:
        """获取模板"""
        return self.templates.get(template_name, self.templates['default'])

    def parse_markdown(self, markdown: str) -> Dict[str, Any]:
        """解析Markdown内容"""
        content = {
            'title': '',
            'sections': []
        }

        lines = markdown.strip().split('\n')
        current_section = None
        current_content = []
        current_table = None
        in_code_block = False
        code_language = ''
        code_content = ''

        for line in lines:
            line = line.rstrip()

            # 标题处理
            heading_match = re.match(r'^(#{1,6})\s+(.*)$', line)
            if heading_match:
                level = len(heading_match.group(1))
                text = heading_match.group(2)

                # 保存当前section
                if current_section:
                    if current_content:
                        current_section['content'] = current_content
                    if current_table:
                        current_section['table'] = current_table
                    content['sections'].append(current_section)

                # 新section
                current_section = {
                    'heading': text,
                    'level': level
                }
                current_content = []
                current_table = None
                continue

            # 代码块处理
            if line.startswith('```'):
                if in_code_block:
                    in_code_block = False
                    current_content.append(f'```\n{code_content}\n```')
                    code_content = ''
                else:
                    in_code_block = True
                    code_language = line[3:].strip()
                continue

            if in_code_block:
                code_content += line + '\n'
                continue

            # 表格处理
            if line.startswith('|') and '|' in line[1:]:
                if not current_table:
                    current_table = {'headers': [], 'data': []}

                cells = [cell.strip() for cell in line.split('|') if cell.strip()]
                if any('---' in cell for cell in cells):
                    continue

                if not current_table['headers']:
                    current_table['headers'] = cells
                else:
                    current_table['data'].append(cells)
                continue

            # 列表处理
            list_match = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)$', line)
            if list_match:
                indent = len(list_match.group(1))
                list_type = 'unordered' if list_match.group(2) in ['-', '*'] else 'ordered'
                item = list_match.group(3)
                spaces = '  ' * (indent // 2)
                current_content.append(f'{spaces}{list_match.group(2)} {item}')
                continue

            # 普通段落
            if line:
                current_content.append(line)
            else:
                current_content.append('')

        # 处理最后一个section
        if current_section:
            if current_content:
                current_section['content'] = current_content
            if current_table:
                current_section['table'] = current_table
            content['sections'].append(current_section)

        # 提取标题
        for section in content['sections']:
            if section.get('level') == 1:
                content['title'] = section['heading']
                break

        return content

    def convert_markdown_to_content(self, markdown: str, template_name: str = 'default') -> Dict[str, Any]:
        """将Markdown转换为内容结构"""
        parsed_content = self.parse_markdown(markdown)
        template = self.get_template(template_name)

        organized_content = {
            'title': parsed_content.get('title', '文档'),
            'sections': parsed_content.get('sections', []),
            'footer': f'生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'
        }

        if template_name == 'tcm_recipe':
            organized_content = self._organize_tcm_recipe_content(organized_content)

        return organized_content

    def _organize_tcm_recipe_content(self, content: Dict[str, Any]) -> Dict[str, Any]:
        """组织中药配方报告内容"""
        tcm_content = {
            'cover': {
                'title': content.get('title', '中药配方报告'),
                'subtitle': '专业配方分析报告',
                'date': datetime.now().strftime('%Y年%m月%d日')
            },
            'table_of_contents': [],
            'basic_info': [],
            'ingredients': [],
            'effects': [],
            'usage': [],
            'notes': [],
            'references': []
        }

        for section in content.get('sections', []):
            tcm_content['table_of_contents'].append({
                'title': section.get('heading', ''),
                'level': section.get('level', 1)
            })

        for section in content.get('sections', []):
            heading = section.get('heading', '').lower()
            if '基本信息' in heading or '配方名称' in heading:
                tcm_content['basic_info'].append(section)
            elif '成分' in heading or '药材' in heading:
                tcm_content['ingredients'].append(section)
            elif '功效' in heading or '作用' in heading:
                tcm_content['effects'].append(section)
            elif '用法' in heading or '用量' in heading:
                tcm_content['usage'].append(section)
            elif '注意' in heading or '禁忌' in heading:
                tcm_content['notes'].append(section)
            elif '参考' in heading or '文献' in heading:
                tcm_content['references'].append(section)
            else:
                tcm_content['basic_info'].append(section)

        return tcm_content

    def generate_from_markdown(self, markdown: str, format: FileFormat,
                             filename: str, template_name: str = 'default') -> Tuple[str, str]:
        """从Markdown生成文件"""
        content = self.convert_markdown_to_content(markdown, template_name)
        return self.file_generator.generate_file(content, format, filename)

    def generate_from_template(self, template_name: str, data: Dict[str, Any],
                             format: FileFormat, filename: str) -> Tuple[str, str]:
        """从模板生成文件"""
        template = self.get_template(template_name)

        if template_name == 'tcm_recipe':
            content = {
                'cover': data.get('cover', {}),
                'table_of_contents': data.get('table_of_contents', []),
                'basic_info': data.get('basic_info', []),
                'ingredients': data.get('ingredients', []),
                'effects': data.get('effects', []),
                'usage': data.get('usage', []),
                'notes': data.get('notes', []),
                'references': data.get('references', []),
                'footer': f'生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'
            }
        else:
            content = {
                'title': data.get('title', '文档'),
                'sections': data.get('sections', []),
                'footer': f'生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'
            }

        return self.file_generator.generate_file(content, format, filename)


# 创建模板管理器实例
template_manager = None


def get_template_manager(file_generator: FileGeneratorService) -> TemplateManager:
    """获取模板管理器实例"""
    global template_manager
    if template_manager is None:
        template_manager = TemplateManager(file_generator)
    return template_manager
