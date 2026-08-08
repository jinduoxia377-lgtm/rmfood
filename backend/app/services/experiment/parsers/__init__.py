"""
实验数据解析器包

支持标准格式:
- AnIML (Analytical Information Markup Language) - 分析仪器通用XML格式
- JCAMP-DX - 光谱数据交换标准 (FTIR/NMR/MS/GC-MS)
- 通用CSV/TSV 质谱数据
"""
from .animl_parser import AnIMLParser
from .jcamp_parser import JcampDXParser

__all__ = ["AnIMLParser", "JcampDXParser"]
