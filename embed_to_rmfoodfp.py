"""
RMFOODFP 肽链结构分析模块 - 嵌入脚本（修正版）
将此脚本复制到 D:\RMFOODFP 根目录后运行
"""

import os
import shutil
from pathlib import Path

# 路径配置
SCRIPT_DIR = Path(__file__).parent
MODULE_DIR = SCRIPT_DIR / "rmfoodfp-peptide-analyzer"
SRC_DIR = MODULE_DIR / "src" / "rmfoodfp_peptide_analyzer"
TARGET_BACKEND = Path("D:/RMFOODFP/backend")
TARGET_FRONTEND = Path("D:/RMFOODFP/frontend")

# 后端服务目标目录
SERVICES_TARGET = TARGET_BACKEND / "app" / "services" / "peptide_analyzer"
API_TARGET = TARGET_BACKEND / "app" / "api"


def copy_files():
    """复制文件到 RMFOODFP"""
    
    # 1. 创建服务目录
    SERVICES_TARGET.mkdir(parents=True, exist_ok=True)
    
    # 2. 复制 converter.py
    shutil.copy2(
        SRC_DIR / "core" / "converter.py",
        SERVICES_TARGET / "converter.py"
    )
    
    # 3. 复制 food_peptide_service.py
    shutil.copy2(
        SRC_DIR / "services" / "food_peptide_service.py",
        SERVICES_TARGET / "food_peptide_service.py"
    )
    
    # 4. 创建 __init__.py
    (SERVICES_TARGET / "__init__.py").write_text(
        '"""肽链结构分析服务"""' + '\nfrom .converter import PeptideConverter\nfrom .food_peptide_service import FoodPeptideAnalyzer\n'
    )
    
    # 5. 创建路由文件（使用绝对导入）
    routes_content = '''"""
肽链结构分析路由
基于 PepLink 的肽序列↔SMILES 双向转换
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/peptide-structure", tags=["肽链结构分析"])


class SequenceToSmilesRequest(BaseModel):
    sequence: str = Field(..., min_length=2, max_length=100)
    n_terminal: Optional[str] = None
    c_terminal: Optional[str] = None
    unusual_aaminos: Optional[List[Dict]] = None
    output_format: str = "smiles"


class SmilesToSequenceRequest(BaseModel):
    smiles: str = Field(...)
    format_type: str = "smiles"


class RegisterAARequest(BaseModel):
    name: str = Field(...)
    smiles: str = Field(...)


@router.post("/sequence-to-smiles")
async def sequence_to_smiles(req: SequenceToSmilesRequest):
    try:
        from app.services.peptide_analyzer.converter import PeptideConverter
        converter = PeptideConverter()
        result = converter.sequence_to_smiles(
            req.sequence,
            n_terminal=req.n_terminal,
            c_terminal=req.c_terminal,
            unusual_aaminos=req.unusual_aaminos,
            output_format=req.output_format,
        )
        if not result.success:
            raise HTTPException(status_code=400, detail=result.error_message)
        return {"success": True, "sequence": result.sequence, "smiles": result.smiles, "selfies": result.selfies}
    except Exception as e:
        logger.error(f"序列转换失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/smiles-to-sequence")
async def smiles_to_sequence(req: SmilesToSequenceRequest):
    try:
        from app.services.peptide_analyzer.converter import PeptideConverter
        converter = PeptideConverter()
        result = converter.smiles_to_sequence(req.smiles, req.format_type)
        if not result.success:
            raise HTTPException(status_code=400, detail=result.unsupported_reason or "解析失败")
        return {"success": True, "sequence": result.sequence, "is_cyclic": result.is_cyclic, "cyclization": result.cyclization}
    except Exception as e:
        logger.error(f"SMILES解析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register-custom-aa")
async def register_custom_aa(req: RegisterAARequest):
    try:
        from app.services.peptide_analyzer.converter import PeptideConverter
        converter = PeptideConverter()
        success = converter.register_custom_aa(req.name, req.smiles)
        if not success:
            raise HTTPException(status_code=400, detail="注册失败")
        return {"success": True, "message": f"已注册 {req.name}"}
    except Exception as e:
        logger.error(f"注册失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/supported-aas")
async def list_supported_aas():
    try:
        from app.services.peptide_analyzer.converter import PeptideConverter
        converter = PeptideConverter()
        supported = converter.list_supported_aas()
        return {"count": len(supported), "amino_acids": supported}
    except Exception as e:
        logger.error(f"获取列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_peptide(sequence: str):
    try:
        from app.services.peptide_analyzer.food_peptide_service import FoodPeptideAnalyzer
        analyzer = FoodPeptideAnalyzer()
        result = await analyzer.analyze(sequence)
        return result.to_dict()
    except Exception as e:
        logger.error(f"分析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


__all__ = ["router"]
'''
    (API_TARGET / "peptide_structure_routes.py").write_text(routes_content)
    
    print("✅ 后端文件复制完成")


def modify_init():
    """修改 api/__init__.py 添加路由注册"""
    init_file = TARGET_BACKEND / "app" / "api" / "__init__.py"
    
    if init_file.exists():
        content = init_file.read_text()
        
        # 检查是否已存在
        if "peptide_structure_routes" not in content:
            # 在 _LAZY_ROUTER_MODULES 中添加
            modified = content.replace(
                "'food_peptide_routes',  # RMFOOD食品活性肽分析",
                "'food_peptide_routes',  # RMFOOD食品活性肽分析\n    'peptide_structure_routes',  # 肽链结构分析"
            )
            init_file.write_text(modified)
            print("✅ 路由注册已添加")
        else:
            print("ℹ️ 路由已存在，跳过")
    else:
        print("❌ 找不到 api/__init__.py")


def add_dependencies():
    """添加依赖到 requirements.txt"""
    req_file = TARGET_BACKEND / "requirements.txt"
    
    if req_file.exists():
        content = req_file.read_text()
        
        if "peplink" not in content.lower():
            # 在文件末尾添加
            with open(req_file, "a") as f:
                f.write("\n# 肽链结构分析\npeplink>=0.1.2\nrdkit>=2023.9.0\nselfies>=2.1.1\n")
            print("✅ 依赖已添加到 requirements.txt")
        else:
            print("ℹ️ 依赖已存在，跳过")
    else:
        print("❌ 找不到 requirements.txt")


def main():
    """主函数"""
    print("=" * 60)
    print("RMFOODFP 肽链结构分析模块 - 嵌入脚本")
    print("=" * 60)
    
    # 检查目标目录
    if not TARGET_BACKEND.exists():
        print(f"❌ 目标目录不存在: {TARGET_BACKEND}")
        return
    
    # 执行嵌入
    copy_files()
    modify_init()
    add_dependencies()
    
    print("\n" + "=" * 60)
    print("嵌入完成！请执行以下步骤：")
    print("=" * 60)
    print("1. 安装依赖: pip install -r backend/requirements.txt")
    print("2. 运行迁移: cd backend && alembic upgrade head")
    print("3. 启动服务: cd backend && uvicorn app.main:app --reload")
    print("4. 验证 API: http://localhost:8000/docs")
    print("=" * 60)


if __name__ == "__main__":
    main()
