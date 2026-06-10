"""
RMFOOD Peptide Analysis System v2.0 - 数据库客户端模块

本模块提供与权威生物信息学数据库的标准化接口：
1. UniProt KB/Swiss-Prot (蛋白质序列与功能注释)
2. PDB (蛋白质三维结构)
3. Swiss-Prot (专家级手工注释)

所有客户端均遵循以下原则：
✅ 100% 真实数据来源，零模拟数据
✅ 完善的错误处理与重试机制
✅ 速率限制与API配额管理
✅ 请求日志记录与可追溯性
"""

from .uniprot_client import UniProtClient
from .pdb_client import PDBClient
from .swissprot_client import SwissProtClient

__all__ = ['UniProtClient', 'PDBClient', 'SwissProtClient']
