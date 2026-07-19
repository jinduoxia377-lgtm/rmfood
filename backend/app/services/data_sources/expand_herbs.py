"""TCMSP 扩展药材数据聚合模块
==========================

聚合所有 _herb_data_XX.py 部分文件中的药材数据，
供 tcmsp_client.py 导入合并到 TCMSP_HERB_DATABASE。

外部直接导入 EXPANDED_HERBS。
"""
import ast
import os
import re

_DATA_DIR = os.path.join(os.path.dirname(__file__))

EXPANDED_HERBS: list[dict] = []
_seen_names: set[str] = set()

for _i in range(1, 7):
    _fp = os.path.join(_DATA_DIR, f'_herb_data_{_i:02d}.py')
    if not os.path.exists(_fp):
        continue
    with open(_fp, 'r', encoding='utf-8') as _f:
        _content = _f.read()

    # 匹配 _HERBS_PART_XX = [<list>] 中的列表内容
    _m = re.search(r'_HERBS_PART_\d+\s*=\s*\[(.+)\]\s*$', _content, re.DOTALL)
    if not _m:
        continue
    try:
        # 使用 ast.literal_eval 安全解析 Python 字面量
        _list_content = '[' + _m.group(1) + ']'
        _herbs = ast.literal_eval(_list_content)
        for _h in _herbs:
            _name = _h.get('name_cn', '')
            if _name and _name not in _seen_names:
                EXPANDED_HERBS.append(_h)
                _seen_names.add(_name)
    except (SyntaxError, ValueError):
        pass
