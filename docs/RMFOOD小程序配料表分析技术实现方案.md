# RMFOOD 小程序配料表分析功能技术实现方案

> 版本：V1.0  
> 编制日期：2026-09-06  
> 状态：✅ 技术方案设计

---

## 一、功能概述

### 1.1 核心价值

**配料表分析**是RMFOOD小程序的差异化核心竞争力，解决C端用户的核心痛点：

| 用户痛点 | 解决方案 |
|---------|---------|
| "这个食品配料表健康吗？" | AI分析配料健康价值 |
| "这些成分有什么功效？" | 成分功效解析 |
| "营养标签怎么算？" | 按GB 28050标准计算 |
| "有没有禁忌成分？" | 安全审查与过敏原提示 |
| "能不能改进配方？" | AI给出优化建议 |

### 1.2 功能边界

**输入**：配料表（拍照/手动/语音）  
**输出**：营养成分表 + 健康评估 + 安全审查 + 改进建议

---

## 二、系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          小程序前端（Taro + React）                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   输入模块   │    │   分析模块   │    │   展示模块   │    │  分享模块 │  │
│  │              │    │              │    │              │    │          │  │
│  │ • 拍照识别   │    │ • 成分识别   │    │ • 营养标签   │    │ • 海报生成│  │
│  │ • 手动输入   │    │ • 营养计算   │    │ • 成分详情   │    │ • 保存到相册│ │
│  │ • 语音输入   │    │ • 健康评估   │    │ • 健康评分   │    │ • 微信分享 │  │
│  │ • 历史记录   │    │ • 安全审查   │    │ • 改进建议   │    │          │  │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FastAPI 后端服务                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     配料表分析服务（新增）                            │   │
│  │                                                                      │   │
│  │  POST /api/v1/nutrition/analyze      # 配料表分析                    │   │
│  │  POST /api/v1/nutrition/calculate    # 营养标签计算                  │   │
│  │  GET  /api/v1/nutrition/database     # 营养数据库查询                │   │
│  │  POST /api/v1/nutrition/safety-check # 安全审查                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     核心服务模块                                     │   │
│  │                                                                      │   │
│  │  • nutrition_database.py    # 营养数据库（50+味药材）                │   │
│  │  • nutrition_label_generator.py  # 营养标签生成器（GB 28050）        │   │
│  │  • ingredient_service.py    # 成分管理服务                           │   │
│  │  • safety_checker.py        # 安全审查服务                           │   │
│  │  • health_evaluator.py      # 健康评估服务                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓ PostgreSQL + Redis
┌─────────────────────────────────────────────────────────────────────────────┐
│                            数据存储层                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  PostgreSQL  │    │    Redis     │    │  文件存储    │                  │
│  │  • 分析记录  │    │  • 缓存结果  │    │  • 图片      │                  │
│  │  • 用户数据  │    │  • 会话状态  │    │  • 分析报告  │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **前端框架** | Taro | 4.1.6 | 多端框架，支持微信小程序 |
| **UI框架** | React | 18.2.0 | Taro支持的React版本 |
| **组件库** | NutUI-Taro | 4.11.0 | 京东开源，Taro专属版 |
| **状态管理** | Zustand | 5.0.1 | 轻量级，支持持久化 |
| **图片处理** | Taro.chooseMedia | - | 拍照/相册选择 |
| **OCR识别** | 微信OCR API | - | 图片文字识别 |
| **后端框架** | FastAPI | 0.104.1 | Python异步框架 |
| **数据库** | PostgreSQL | 15+ | 关系型数据库 |
| **缓存** | Redis | 7+ | 缓存和会话存储 |

---

## 三、前端实现方案

### 3.1 页面结构

```
pages/
└── ingredient-analysis/          # 配料表分析页（新增）
    ├── index.tsx                  # 主页面
    ├── components/
    │   ├── InputPanel.tsx         # 输入面板（拍照/手动/语音）
    │   ├── AnalysisResult.tsx     # 分析结果展示
    │   ├── NutritionLabel.tsx     # 营养成分表组件
    │   ├── IngredientDetail.tsx   # 成分详情组件
    │   ├── HealthScore.tsx        # 健康评分组件
    │   └── ImprovementSuggestion.tsx # 改进建议组件
    └── index.scss                 # 样式文件
```

### 3.2 核心页面代码

```typescript
// src/pages/ingredient-analysis/index.tsx
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { nutritionApi } from '@/api/nutrition'
import InputPanel from './components/InputPanel'
import AnalysisResult from './components/AnalysisResult'
import NutritionLabel from './components/NutritionLabel'
import IngredientDetail from './components/IngredientDetail'
import HealthScore from './components/HealthScore'
import ImprovementSuggestion from './components/ImprovementSuggestion'
import Disclaimer from '@/components/Disclaimer'

export default function IngredientAnalysisPage() {
  const [inputMode, setInputMode] = useState<'photo' | 'manual' | 'voice'>('manual')
  const [ingredients, setIngredients] = useState<Array<{name: string; amount?: string}>>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  
  const { isAuthenticated, token } = useAuthStore()

  // 拍照识别
  const handleTakePhoto = useCallback(async () => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
      })
      
      const imagePath = res.tempFiles[0].tempFilePath
      
      // 调用微信OCR识别配料表
      const ocrResult = await Taro.requirePlugin('WechatSI').getChooseImageOCR({
        path: imagePath,
        type: 'ingredient',
      })
      
      // 解析OCR结果，提取配料成分
      const parsedIngredients = parseIngredientText(ocrResult.text)
      setIngredients(parsedIngredients)
      setInputMode('manual') // 切换到手动确认模式
    } catch (error) {
      Taro.showToast({ title: '识别失败，请重试', icon: 'none' })
    }
  }, [])

  // 手动添加配料
  const handleManualInput = useCallback((item: {name: string; amount?: string}) => {
    setIngredients(prev => [...prev, item])
  }, [])

  // 语音输入
  const handleVoiceInput = useCallback(async () => {
    const recorderManager = Taro.getRecorderManager()
    
    recorderManager.onStart(() => {
      Taro.showToast({ title: '正在录音...', icon: 'loading' })
    })
    
    recorderManager.onStop((res) => {
      const { tempFilePath } = res
      // 调用微信语音识别API
      Taro.translateVoice({
        localId: tempFilePath,
        success: (translateRes) => {
          const text = translateRes.translateResult
          // 解析语音文本，提取配料成分
          const parsedIngredients = parseIngredientText(text)
          setIngredients(parsedIngredients)
        },
        fail: () => {
          Taro.showToast({ title: '语音识别失败', icon: 'none' })
        }
      })
    })
    
    recorderManager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 96000,
      format: 'aac'
    })
  }, [])

  // 开始分析
  const handleAnalyze = useCallback(async () => {
    if (!isAuthenticated) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    
    if (ingredients.length === 0) {
      Taro.showToast({ title: '请添加配料成分', icon: 'none' })
      return
    }
    
    setIsAnalyzing(true)
    
    try {
      // 调用后端分析接口
      const result = await nutritionApi.analyze({
        ingredients: ingredients.map(ing => ({
          name: ing.name,
          amount_g: parseFloat(ing.amount) || 0,
        })),
        total_weight_g: ingredients.reduce((sum, ing) => sum + (parseFloat(ing.amount) || 0), 0),
      }, token!)
      
      setAnalysisResult(result)
      
      // 保存到历史记录
      setHistory(prev => [{
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ingredients: ingredients,
        result: result,
      }, ...prev.slice(0, 9)])
      
    } catch (error) {
      Taro.showToast({ title: '分析失败，请重试', icon: 'none' })
    } finally {
      setIsAnalyzing(false)
    }
  }, [ingredients, isAuthenticated, token])

  // 解析配料文本
  const parseIngredientText = (text: string): Array<{name: string; amount?: string}> => {
    // 简单解析：按"、"或","分割
    const items = text.split(/[、，,]/).map(s => s.trim()).filter(s => s.length > 0)
    return items.map(name => ({ name }))
  }

  return (
    <View className='ingredient-analysis-page'>
      {/* 输入面板 */}
      <InputPanel
        mode={inputMode}
        ingredients={ingredients}
        onTakePhoto={handleTakePhoto}
        onManualInput={handleManualInput}
        onVoiceInput={handleVoiceInput}
        onAddIngredient={handleManualInput}
        onRemoveIngredient={(index) => {
          setIngredients(prev => prev.filter((_, i) => i !== index))
        }}
      />

      {/* 分析按钮 */}
      <View className='analyze-btn' onClick={handleAnalyze}>
        <Text className='btn-text'>{isAnalyzing ? '分析中...' : '开始分析'}</Text>
      </View>

      {/* 分析结果 */}
      {analysisResult && (
        <View className='result-section'>
          <AnalysisResult result={analysisResult} />
          
          {/* 营养成分表 */}
          <NutritionLabel data={analysisResult.nutrition_label} />
          
          {/* 成分详情 */}
          <IngredientDetail ingredients={analysisResult.ingredients} />
          
          {/* 健康评分 */}
          <HealthScore score={analysisResult.health_score} />
          
          {/* 改进建议 */}
          <ImprovementSuggestion suggestions={analysisResult.improvements} />
          
          {/* 免责声明 */}
          <Disclaimer />
        </View>
      )}

      {/* 历史记录 */}
      {history.length > 0 && (
        <View className='history-section'>
          <Text className='section-title'>历史分析</Text>
          {history.map(item => (
            <View key={item.id} className='history-item'>
              <Text className='history-time'>{new Date(item.timestamp).toLocaleString()}</Text>
              <Text className='history-ingredients'>
                {item.ingredients.map(ing => ing.name).join('、')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
```

### 3.3 输入面板组件

```typescript
// src/pages/ingredient-analysis/components/InputPanel.tsx
import { View, Text, Input, Image } from '@tarojs/components'
import './index.scss'

interface InputPanelProps {
  mode: 'photo' | 'manual' | 'voice'
  ingredients: Array<{name: string; amount?: string}>
  onTakePhoto: () => void
  onManualInput: (item: {name: string; amount?: string}) => void
  onVoiceInput: () => void
  onAddIngredient: (item: {name: string; amount?: string}) => void
  onRemoveIngredient: (index: number) => void
}

export default function InputPanel({
  mode,
  ingredients,
  onTakePhoto,
  onManualInput,
  onVoiceInput,
  onAddIngredient,
  onRemoveIngredient,
}: InputPanelProps) {
  const [manualInput, setManualInput] = useState('')
  const [amountInput, setAmountInput] = useState('')

  const handleAddIngredient = () => {
    if (!manualInput.trim()) return
    onAddIngredient({
      name: manualInput.trim(),
      amount: amountInput.trim() || undefined,
    })
    setManualInput('')
    setAmountInput('')
  }

  return (
    <View className='input-panel'>
      {/* 输入模式切换 */}
      <View className='mode-tabs'>
        <View 
          className={`tab ${mode === 'photo' ? 'active' : ''}`}
          onClick={onTakePhoto}
        >
          <Text className='tab-icon'>📷</Text>
          <Text>拍照</Text>
        </View>
        <View 
          className={`tab ${mode === 'manual' ? 'active' : ''}`}
          onClick={() => {/* 切换到手动模式 */}}
        >
          <Text className='tab-icon'>✏️</Text>
          <Text>手动</Text>
        </View>
        <View 
          className={`tab ${mode === 'voice' ? 'active' : ''}`}
          onClick={onVoiceInput}
        >
          <Text className='tab-icon'>🎤</Text>
          <Text>语音</Text>
        </View>
      </View>

      {/* 手动输入模式 */}
      {mode === 'manual' && (
        <View className='manual-input'>
          <Input
            className='ingredient-input'
            placeholder='输入配料名称'
            value={manualInput}
            onInput={(e) => setManualInput(e.detail.value)}
          />
          <Input
            className='amount-input'
            placeholder='用量（克，可选）'
            value={amountInput}
            onInput={(e) => setAmountInput(e.detail.value)}
            type='digit'
          />
          <View className='add-btn' onClick={handleAddIngredient}>
            <Text>添加</Text>
          </View>
        </View>
      )}

      {/* 已添加配料列表 */}
      {ingredients.length > 0 && (
        <View className='ingredient-list'>
          <Text className='list-title'>已添加配料（{ingredients.length}）</Text>
          {ingredients.map((ing, index) => (
            <View key={index} className='ingredient-item'>
              <View className='ingredient-info'>
                <Text className='ingredient-name'>{ing.name}</Text>
                {ing.amount && (
                  <Text className='ingredient-amount'>{ing.amount}g</Text>
                )}
              </View>
              <View className='remove-btn' onClick={() => onRemoveIngredient(index)}>
                <Text>×</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 示例配方 */}
      <View className='example-section'>
        <Text className='example-title'>快速示例</Text>
        <View className='example-tags'>
          {['黄芪+当归+红枣', '枸杞+菊花+决明子', '山药+莲子+芡实'].map(example => (
            <View key={example} className='example-tag' onClick={() => {/* 加载示例 */}}>
              <Text>{example}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
```

---

## 四、后端实现方案

### 4.1 API设计

```python
# backend/app/api/v1/nutrition_router.py
"""
配料表分析API路由
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging

from app.services.nutrition.nutrition_label_generator import NutritionLabelGenerator
from app.services.nutrition.nutrition_database import HERB_NUTRITION_DB, ALLERGEN_MAP
from app.services.safety_checker import safety_checker
from app.services.health_evaluator import health_evaluator
from app.models.user_model import User
from app.api.deps import get_current_user, get_db_session

router = APIRouter(prefix="/nutrition", tags=["营养分析"])
logger = logging.getLogger(__name__)

# 初始化营养标签生成器
label_generator = NutritionLabelGenerator(ingredient_db=HERB_NUTRITION_DB)


# ═══════════════════════════════════════════════════════════════
# 数据模型
# ═══════════════════════════════════════════════════════════════

class IngredientItem(BaseModel):
    """单个配料项"""
    name: str = Field(..., min_length=1, max_length=50, description="成分名称")
    amount_g: float = Field(0, ge=0, description="用量（克）")
    weight_g: Optional[float] = Field(None, description="重量（克，兼容旧字段）")


class AnalyzeRequest(BaseModel):
    """配料表分析请求"""
    ingredients: List[IngredientItem] = Field(..., min_length=1, description="配料列表")
    total_weight_g: float = Field(..., gt=0, description="总重量（克）")
    serving_size_g: Optional[float] = Field(100.0, description="每份重量（克）")
    servings_per_container: int = Field(1, ge=1, description="每容器份数")
    unit_system: str = Field("g", description="单位制：g=固体，ml=液体")
    user_allergens: Optional[List[str]] = Field(None, description="用户过敏原列表")


class AnalyzeResponse(BaseModel):
    """配料表分析响应"""
    # 营养成分表
    nutrition_label: Dict[str, Any]
    
    # 成分详情
    ingredients_detail: List[Dict[str, Any]]
    
    # 健康评分（0-100）
    health_score: int
    
    # 健康评估
    health_assessment: Dict[str, Any]
    
    # 安全审查结果
    safety_check: Dict[str, Any]
    
    # 改进建议
    improvements: List[str]
    
    # 警告信息
    warnings: List[str]
    
    # 分析时间
    analysis_time_ms: int


# ═══════════════════════════════════════════════════════════════
# API端点
# ═══════════════════════════════════════════════════════════════

@router.post("/analyze", response_model=AnalyzeResponse, summary="配料表分析")
async def analyze_ingredient_list(
    req: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    配料表分析接口
    
    功能：
    1. 识别配料成分
    2. 计算营养成分表（按GB 28050）
    3. 评估健康价值
    4. 审查安全性
    5. 生成改进建议
    """
    import time
    start_time = time.time()
    
    try:
        # Step 1: 计算营养成分表
        nutrition_label = label_generator.calculate_label(
            ingredients=[
                {"name": ing.name, "amount_g": ing.amount_g or ing.weight_g or 0}
                for ing in req.ingredients
            ],
            total_weight_g=req.total_weight_g,
            serving_size_g=req.serving_size_g or 100.0,
            servings_per_container=req.servings_per_container,
            unit_system=req.unit_system,
        )
        
        # Step 2: 获取成分详情
        ingredients_detail = []
        for ing in req.ingredients:
            db_entry = HERB_NUTRITION_DB.get(ing.name)
            if db_entry:
                ingredients_detail.append({
                    "name": ing.name,
                    "amount_g": ing.amount_g or ing.weight_g or 0,
                    "nutrition": db_entry,
                    "has_data": True,
                })
            else:
                ingredients_detail.append({
                    "name": ing.name,
                    "amount_g": ing.amount_g or ing.weight_g or 0,
                    "nutrition": {},
                    "has_data": False,
                    "warning": "成分不在营养数据库中"
                })
        
        # Step 3: 健康评估
        health_assessment = health_evaluator.evaluate(
            ingredients=req.ingredients,
            nutrition_label=nutrition_label,
            user_allergens=req.user_allergens or [],
        )
        
        # Step 4: 安全审查
        safety_check = safety_checker.check(
            ingredients=req.ingredients,
            user_allergens=req.user_allergens or [],
        )
        
        # Step 5: 生成改进建议
        improvements = _generate_improvements(
            ingredients=req.ingredients,
            nutrition_label=nutrition_label,
            health_assessment=health_assessment,
            safety_check=safety_check,
        )
        
        # 计算分析耗时
        analysis_time_ms = int((time.time() - start_time) * 1000)
        
        # 计算健康评分
        health_score = _calculate_health_score(
            nutrition_label=nutrition_label,
            health_assessment=health_assessment,
            safety_check=safety_check,
        )
        
        return AnalyzeResponse(
            nutrition_label=nutrition_label,
            ingredients_detail=ingredients_detail,
            health_score=health_score,
            health_assessment=health_assessment,
            safety_check=safety_check,
            improvements=improvements,
            warnings=nutrition_label.get("warnings", []),
            analysis_time_ms=analysis_time_ms,
        )
        
    except Exception as e:
        logger.error(f"配料表分析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/calculate", response_model=Dict[str, Any], summary="营养标签计算")
async def calculate_nutrition_label(
    req: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    仅计算营养标签（不进行分析）
    """
    nutrition_label = label_generator.calculate_label(
        ingredients=[
            {"name": ing.name, "amount_g": ing.amount_g or ing.weight_g or 0}
            for ing in req.ingredients
        ],
        total_weight_g=req.total_weight_g,
        serving_size_g=req.serving_size_g or 100.0,
        servings_per_container=req.servings_per_container,
        unit_system=req.unit_system,
    )
    
    return nutrition_label


@router.get("/database", summary="获取营养数据库")
async def get_nutrition_database(
    current_user: User = Depends(get_current_user),
):
    """
    获取营养数据库（用于前端搜索联想）
    """
    return {
        "ingredients": list(HERB_NUTRITION_DB.keys()),
        "count": len(HERB_NUTRITION_DB),
        "coverage": {
            "energy": True,
            "protein": True,
            "fat": True,
            "carbohydrate": True,
            "dietary_fiber": True,
            "sodium": True,
        }
    }


@router.post("/safety-check", response_model=Dict[str, Any], summary="安全审查")
async def check_safety(
    req: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    安全审查接口
    """
    return safety_checker.check(
        ingredients=req.ingredients,
        user_allergens=req.user_allergens or [],
    )


# ═══════════════════════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════════════════════

def _calculate_health_score(
    nutrition_label: Dict[str, Any],
    health_assessment: Dict[str, Any],
    safety_check: Dict[str, Any],
) -> int:
    """
    计算健康评分（0-100）
    
    评分维度：
    1. 营养均衡度（30分）
    2. 功效成分含量（30分）
    3. 安全性（20分）
    4. 添加剂情况（20分）
    """
    score = 0
    
    # 1. 营养均衡度（30分）
    # 检查是否有高蛋白质、低脂肪等健康特征
    claims = nutrition_label.get("claims", [])
    if "高蛋白质" in claims:
        score += 10
    if "低脂肪" in claims:
        score += 10
    if "高膳食纤维" in claims:
        score += 10
    
    # 2. 功效成分含量（30分）
    # 检查是否有药食同源成分
    known_healthy_ingredients = ["黄芪", "当归", "枸杞", "山药", "灵芝"]
    healthy_count = sum(
        1 for ing in req.ingredients 
        if ing.name in known_healthy_ingredients
    )
    score += min(30, healthy_count * 10)
    
    # 3. 安全性（20分）
    if safety_check.get("is_safe", True):
        score += 20
    else:
        score += max(0, 20 - len(safety_check.get("warnings", [])) * 5)
    
    # 4. 添加剂情况（20分）
    # 检查是否含有添加剂
    additives = ["苯甲酸钠", "山梨酸钾", "阿斯巴甜", "安赛蜜"]
    additive_count = sum(
        1 for ing in req.ingredients 
        if ing.name in additives
    )
    score += max(0, 20 - additive_count * 10)
    
    return min(100, max(0, score))


def _generate_improvements(
    ingredients: List[IngredientItem],
    nutrition_label: Dict[str, Any],
    health_assessment: Dict[str, Any],
    safety_check: Dict[str, Any],
) -> List[str]:
    """生成改进建议"""
    improvements = []
    
    # 检查是否缺乏某些营养素
    per_100g = nutrition_label.get("per_100g", {})
    if per_100g.get("protein", 0) < 5:
        improvements.append("蛋白质含量较低，可考虑添加富含蛋白质的食材（如黑豆、核桃）")
    
    if per_100g.get("dietary_fiber", 0) < 3:
        improvements.append("膳食纤维含量不足，可添加膳食纤维来源（如燕麦、菊粉）")
    
    if per_100g.get("sodium", 0) > 200:
        improvements.append("钠含量偏高，建议减少盐或含钠添加剂的使用")
    
    # 检查安全警告
    if safety_check.get("warnings"):
        for warning in safety_check["warnings"]:
            improvements.append(f"安全提示：{warning}")
    
    # 检查过敏原
    if safety_check.get("allergens_found"):
        improvements.append(f"注意过敏原：{', '.join(safety_check['allergens_found'])}")
    
    # 如果没有建议，给出通用建议
    if not improvements:
        improvements.append("配方整体健康，继续保持！")
    
    return improvements
```

### 4.2 安全审查服务

```python
# backend/app/services/safety_checker.py
"""
安全审查服务
"""
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

# 禁忌成分列表（孕妇慎用等）
CONTRAINDICATIONS = {
    "孕妇慎用": ["麝香", "三七", "红花", "桃仁", "牛膝", "薏苡仁"],
    "儿童慎用": ["人参", "西洋参", "鹿茸"],
    "脾胃虚寒慎用": ["金银花", "菊花", "决明子", "黄连"],
}

# 过敏原映射
ALLERGEN_MAP = {
    "gluten": ["小麦", "大麦", "燕麦", "黑麦"],
    "soy": ["大豆", "黄豆", "黑豆", "豆腐"],
    "nuts": ["核桃", "杏仁", "腰果", "花生", "榛子"],
    "dairy": ["牛奶", "奶粉", "奶酪"],
    "egg": ["鸡蛋", "鸭蛋"],
    "shellfish": ["虾", "蟹", "贝类"],
}


class SafetyChecker:
    """安全审查服务"""
    
    def check(
        self,
        ingredients: List[Any],
        user_allergens: List[str] = None,
        target_population: str = "adult",
    ) -> Dict[str, Any]:
        """
        安全审查
        
        Returns:
            {
                "is_safe": bool,
                "warnings": List[str],
                "contraindications": List[str],
                "allergens_found": List[str],
                "severity": str  # "low" | "medium" | "high"
            }
        """
        warnings = []
        contraindications = []
        allergens_found = []
        
        ingredient_names = [ing.name for ing in ingredients]
        
        # 检查禁忌成分
        for condition, forbidden_ingredients in CONTRAINDICATIONS.items():
            found = [name for name in forbidden_ingredients if name in ingredient_names]
            if found:
                contraindications.extend(found)
                warnings.append(f"{condition}：含有{', '.join(found)}")
        
        # 检查过敏原
        if user_allergens:
            for allergen in user_allergens:
                related_ingredients = ALLERGEN_MAP.get(allergen, [])
                found = [name for name in related_ingredients if name in ingredient_names]
                if found:
                    allergens_found.extend(found)
                    warnings.append(f"过敏原提醒：含有{', '.join(found)}")
        
        # 判断严重程度
        severity = "low"
        if len(warnings) > 3:
            severity = "high"
        elif len(warnings) > 0:
            severity = "medium"
        
        return {
            "is_safe": len(warnings) == 0,
            "warnings": warnings,
            "contraindications": contraindications,
            "allergens_found": allergens_found,
            "severity": severity,
        }


safety_checker = SafetyChecker()
```

### 4.3 健康评估服务

```python
# backend/app/services/health_evaluator.py
"""
健康评估服务
"""
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class HealthEvaluator:
    """健康评估服务"""
    
    def evaluate(
        self,
        ingredients: List[Any],
        nutrition_label: Dict[str, Any],
        user_allergens: List[str] = None,
    ) -> Dict[str, Any]:
        """
        健康评估
        
        Returns:
            {
                "overall_health": str,  # "excellent" | "good" | "fair" | "poor"
                "benefits": List[str],
                "concerns": List[str],
                "suitable_for": List[str],
                "not_suitable_for": List[str],
            }
        """
        per_100g = nutrition_label.get("per_100g", {})
        claims = nutrition_label.get("claims", [])
        
        benefits = []
        concerns = []
        suitable_for = ["一般人群"]
        not_suitable_for = []
        
        # 评估营养特征
        if per_100g.get("protein", 0) >= 12:
            benefits.append("高蛋白：有助于肌肉修复和免疫维持")
        if per_100g.get("fat", 0) <= 3:
            benefits.append("低脂肪：适合控制体重人群")
        if per_100g.get("dietary_fiber", 0) >= 6:
            benefits.append("高膳食纤维：有助于肠道健康")
        if per_100g.get("sodium", 0) <= 120:
            benefits.append("低钠：适合高血压人群")
        if per_100g.get("sugar", 0) <= 0.5:
            benefits.append("无糖：适合糖尿病患者")
        
        if per_100g.get("sodium", 0) > 400:
            concerns.append("高钠：建议限量食用")
        if per_100g.get("fat", 0) > 20:
            concerns.append("高脂肪：建议控制摄入量")
        if per_100g.get("sugar", 0) > 10:
            concerns.append("高糖：糖尿病患者慎用")
        
        # 评估功效成分
        known_beneficial = {
            "黄芪": "补气固表，增强免疫",
            "当归": "补血活血，调经止痛",
            "枸杞": "滋补肝肾，明目养阴",
            "山药": "健脾益胃，补肾涩精",
            "灵芝": "安神定志，增强免疫",
        }
        
        ingredient_names = [ing.name for ing in ingredients]
        for herb, effect in known_beneficial.items():
            if herb in ingredient_names:
                benefits.append(f"含{herb}：{effect}")
        
        # 判断总体健康等级
        if len(benefits) >= 5 and len(concerns) == 0:
            overall_health = "excellent"
        elif len(benefits) >= 3 and len(concerns) <= 1:
            overall_health = "good"
        elif len(benefits) >= 1 and len(concerns) <= 2:
            overall_health = "fair"
        else:
            overall_health = "poor"
        
        return {
            "overall_health": overall_health,
            "benefits": benefits,
            "concerns": concerns,
            "suitable_for": suitable_for,
            "not_suitable_for": not_suitable_for,
        }


health_evaluator = HealthEvaluator()
```

---

## 五、数据模型设计

### 5.1 数据库表结构

```sql
-- 配料表分析记录表
CREATE TABLE ingredient_analysis (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    tenant_id INTEGER NOT NULL,
    
    -- 输入数据
    ingredients JSONB NOT NULL,  -- [{"name": "黄芪", "amount_g": 10}, ...]
    total_weight_g NUMERIC(10,2) NOT NULL,
    serving_size_g NUMERIC(10,2),
    
    -- 分析结果
    nutrition_label JSONB,       -- 营养成分表
    health_score INTEGER,        -- 健康评分（0-100）
    health_assessment JSONB,     -- 健康评估
    safety_check JSONB,          -- 安全审查
    improvements TEXT[],         -- 改进建议
    
    -- 元数据
    input_mode VARCHAR(20),      -- 'photo' | 'manual' | 'voice'
    analysis_time_ms INTEGER,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_ingredient_analysis_user ON ingredient_analysis(user_id);
CREATE INDEX idx_ingredient_analysis_tenant ON ingredient_analysis(tenant_id);
CREATE INDEX idx_ingredient_analysis_created ON ingredient_analysis(created_at DESC);

-- 成分索引表（用于搜索）
CREATE TABLE ingredient_index (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    pinyin VARCHAR(100),
    category VARCHAR(50),        -- '补气类' | '补血类' | '补阴类' | '补阳类'
    is_food_homology BOOLEAN DEFAULT false,
    nutrition_data JSONB,        -- 营养成分数据
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5.2 API响应格式

```typescript
// src/types/nutrition.types.ts
export interface AnalyzeRequest {
  ingredients: Array<{
    name: string
    amount_g?: number
  }>
  total_weight_g: number
  serving_size_g?: number
  servings_per_container?: number
  unit_system?: 'g' | 'ml'
  user_allergens?: string[]
}

export interface NutritionLabel {
  unit_system: 'g' | 'ml'
  display_unit: 'g' | 'ml'
  serving_info: {
    serving_size_g: number
    servings_per_container: number
    package_size_g: number
  }
  per_100g: Record<string, number>
  per_serving: Record<string, number>
  nrv_percentages: Record<string, number>
  label_items: LabelRow[]
  energy_check: {
    calculated: number
    reported: number
    difference: number
    is_valid: boolean
  }
  claims: string[]
  compliance: {
    is_compliant: boolean
    warnings: string[]
  }
  unknown_ingredients: string[]
  warnings: string[]
}

export interface IngredientDetail {
  name: string
  amount_g: number
  nutrition: Record<string, number>
  has_data: boolean
  warning?: string
}

export interface SafetyCheck {
  is_safe: boolean
  warnings: string[]
  contraindications: string[]
  allergens_found: string[]
  severity: 'low' | 'medium' | 'high'
}

export interface HealthAssessment {
  overall_health: 'excellent' | 'good' | 'fair' | 'poor'
  benefits: string[]
  concerns: string[]
  suitable_for: string[]
  not_suitable_for: string[]
}

export interface AnalyzeResponse {
  nutrition_label: NutritionLabel
  ingredients_detail: IngredientDetail[]
  health_score: number
  health_assessment: HealthAssessment
  safety_check: SafetyCheck
  improvements: string[]
  warnings: string[]
  analysis_time_ms: number
}
```

---

## 六、前端组件设计

### 6.1 营养成分表组件

```typescript
// src/pages/ingredient-analysis/components/NutritionLabel.tsx
import { View, Text } from '@tarojs/components'
import { NutritionLabel as NutritionLabelType } from '@/types/nutrition.types'
import './index.scss'

interface NutritionLabelProps {
  data: NutritionLabelType
}

export default function NutritionLabelComponent({ data }: NutritionLabelProps) {
  const mandatoryNutrients = ['energy', 'protein', 'fat', 'carbohydrate', 'sodium']
  
  return (
    <View className='nutrition-label'>
      <View className='label-header'>
        <Text className='label-title'>营养成分表</Text>
        <Text className='label-unit'>每{data.display_unit}</Text>
      </View>
      
      <View className='label-table'>
        {/* 表头 */}
        <View className='table-header'>
          <Text className='header-item'>项目</Text>
          <Text className='header-item'>每{data.display_unit}</Text>
          <Text className='header-item'>NRV%</Text>
        </View>
        
        {/* 表体 */}
        {mandatoryNutrients.map(nutrient => {
          const row = data.label_items.find(item => item.nutrient === nutrient)
          if (!row) return null
          
          return (
            <View key={nutrient} className='table-row'>
              <Text className='row-item nutrient-name'>{_getNutrientName(nutrient)}</Text>
              <Text className='row-item nutrient-value'>
                {row.per_100g}{row.unit}
              </Text>
              <Text className={`row-item nrv-percent ${row.nrv_percent >= 30 ? 'high' : ''}`}>
                {row.nrv_percent}%
              </Text>
            </View>
          )
        })}
        
        {/* 能量校验 */}
        {data.energy_check && (
          <View className='energy-check'>
            <Text className='check-text'>
              能量校验：{' '}
              {data.energy_check.is_valid ? '✓ 符合' : '✗ 不符合'}
            </Text>
          </View>
        )}
      </View>
      
      {/* 营养声称 */}
      {data.claims.length > 0 && (
        <View className='claims-section'>
          <Text className='claims-title'>营养声称</Text>
          {data.claims.map((claim, index) => (
            <View key={index} className='claim-tag'>
              <Text>{claim}</Text>
            </View>
          ))}
        </View>
      )}
      
      {/* 合规性提示 */}
      {data.compliance && !data.compliance.is_compliant && (
        <View className='compliance-warning'>
          <Text>⚠️ 营养成分表不符合GB 28050标准，请检查后重新计算</Text>
        </View>
      )}
    </View>
  )
}

function _getNutrientName(nutrient: string): string {
  const names: Record<string, string> = {
    energy: '能量',
    protein: '蛋白质',
    fat: '脂肪',
    carbohydrate: '碳水化合物',
    sodium: '钠',
    saturated_fat: '饱和脂肪',
    trans_fat: '反式脂肪',
    sugar: '糖',
    dietary_fiber: '膳食纤维',
    cholesterol: '胆固醇',
    calcium: '钙',
    iron: '铁',
    zinc: '锌',
  }
  return names[nutrient] || nutrient
}
```

### 6.2 健康评分组件

```typescript
// src/pages/ingredient-analysis/components/HealthScore.tsx
import { View, Text } from '@tarojs/components'
import './index.scss'

interface HealthScoreProps {
  score: number
  assessment?: {
    overall_health: string
    benefits: string[]
    concerns: string[]
  }
}

export default function HealthScoreComponent({ score, assessment }: HealthScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a'  // 绿色
    if (score >= 60) return '#faad14'  // 黄色
    if (score >= 40) return '#fa8c16'  // 橙色
    return '#ff4d4f'                   // 红色
  }
  
  const getScoreLevel = (score: number) => {
    if (score >= 80) return '优秀'
    if (score >= 60) return '良好'
    if (score >= 40) return '一般'
    return '较差'
  }
  
  return (
    <View className='health-score'>
      <View className='score-circle' style={{ borderColor: getScoreColor(score) }}>
        <Text className='score-number' style={{ color: getScoreColor(score) }}>
          {score}
        </Text>
        <Text className='score-unit'>分</Text>
      </View>
      
      <View className='score-info'>
        <Text className='score-level' style={{ color: getScoreColor(score) }}>
          {getScoreLevel(score)}
        </Text>
        
        {assessment?.overall_health && (
          <Text className='health-status'>
            健康等级：{assessment.overall_health}
          </Text>
        )}
      </View>
      
      {/* 优点 */}
      {assessment?.benefits.length > 0 && (
        <View className='benefits-section'>
          <Text className='section-title'>✓ 健康优点</Text>
          {assessment.benefits.slice(0, 3).map((benefit, index) => (
            <Text key={index} className='benefit-item'>• {benefit}</Text>
          ))}
        </View>
      )}
      
      {/* 注意 */}
      {assessment?.concerns.length > 0 && (
        <View className='concerns-section'>
          <Text className='section-title'>⚠ 健康注意</Text>
          {assessment.concerns.slice(0, 3).map((concern, index) => (
            <Text key={index} className='concern-item'>• {concern}</Text>
          ))}
        </View>
      )}
    </View>
  )
}
```

---

## 七、开发计划

### 7.1 里程碑

| 阶段 | 周期 | 任务 | 交付物 |
|------|------|------|--------|
| **Phase 1** | 第1周 | 后端API开发 | 营养分析API、安全审查API |
| **Phase 2** | 第2周 | 前端页面开发 | 配料分析页面、输入组件 |
| **Phase 3** | 第3周 | 组件开发 | 营养标签、健康评分、成分详情组件 |
| **Phase 4** | 第4周 | 联调测试 | 集成测试、性能优化 |

### 7.2 具体任务清单

**后端任务（第1周）**
- [ ] 创建`nutrition_router.py`
- [ ] 实现`analyze`接口
- [ ] 实现`calculate`接口
- [ ] 实现`safety-check`接口
- [ ] 创建`SafetyChecker`服务
- [ ] 创建`HealthEvaluator`服务
- [ ] 数据库迁移脚本

**前端任务（第2-3周）**
- [ ] 创建`ingredient-analysis`页面
- [ ] 开发`InputPanel`组件
- [ ] 开发`NutritionLabel`组件
- [ ] 开发`HealthScore`组件
- [ ] 开发`IngredientDetail`组件
- [ ] 开发`ImprovementSuggestion`组件
- [ ] 集成API调用

**测试任务（第4周）**
- [ ] 单元测试
- [ ] 集成测试
- [ ] 真机测试
- [ ] 性能测试

---

## 八、技术风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 微信OCR识别准确率不高 | 用户体验差 | 提供手动输入作为降级方案 |
| 营养数据库覆盖不足 | 分析结果不准确 | 建立用户反馈机制，持续补充数据 |
| 复杂配料解析困难 | 分析失败 | 引入AI辅助解析，简化输入流程 |
| 小程序包体积限制 | 加载慢 | 使用分包加载，图片压缩 |

---

## 九、总结

**配料表分析**是RMFOOD小程序的核心差异化功能，具有：

1. **技术可行性高**：后端已有完整的营养计算引擎和数据库
2. **用户需求强烈**：C端用户想了解食品配料的健康价值
3. **差异化竞争力**：这是小程序与Web端的核心差异点
4. **易于传播**：分析结果可分享，形成裂变传播

**建议优先级**：P0（核心功能），与AI对话、配方浏览并列三大核心模块。

---

*方案版本：V1.0 | 编制：RMFOOD架构组 | 日期：2026-09-06*
