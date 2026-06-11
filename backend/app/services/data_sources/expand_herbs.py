"""
TCMSP 中药材数据库扩展文件
===========================
本文件包含扩展的中药材数据（EXPANDED_HERBS 列表），
用于补充 tcmsp_client.py 中 TCMSP_HERB_DATABASE 的不足。
tcmsp_client.py 会自动导入并合并此列表。

新增条目：270种（全部为原库中不存在的药材，含补气/补血/清热/解表等各分类）
补充说明：与基础库49条合并去重后，总计约319种中药材

数据已拆分为 6 个子模块（_herb_data_01 ~ _herb_data_06），本文件负责组装。
"""

from app.services.data_sources._herb_data_01 import _HERBS_PART_01
from app.services.data_sources._herb_data_02 import _HERBS_PART_02
from app.services.data_sources._herb_data_03 import _HERBS_PART_03
from app.services.data_sources._herb_data_04 import _HERBS_PART_04
from app.services.data_sources._herb_data_05 import _HERBS_PART_05
from app.services.data_sources._herb_data_06 import _HERBS_PART_06

EXPANDED_HERBS = (
    _HERBS_PART_01
    + _HERBS_PART_02
    + _HERBS_PART_03
    + _HERBS_PART_04
    + _HERBS_PART_05
    + _HERBS_PART_06
)

# Re-export for backward compatibility: from expand_herbs import EXPANDED_HERBS
__all__ = ["EXPANDED_HERBS"]
