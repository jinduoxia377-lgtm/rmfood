"""
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


class AnalyzeRequest(BaseModel):
    sequence: str = Field(..., min_length=2, max_length=100)


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
async def analyze_peptide(req: AnalyzeRequest):
    try:
        from app.services.peptide_analyzer.food_peptide_service import FoodPeptideAnalyzer
        analyzer = FoodPeptideAnalyzer()
        result = await analyzer.analyze(req.sequence)
        return result.to_dict()
    except Exception as e:
        logger.error(f"分析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


__all__ = ["router"]
