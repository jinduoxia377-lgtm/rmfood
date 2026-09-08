# 配料分析模块 - 后端API对接开发方案

> 版本：V2.0 | 更新日期：2026-01-15 | 状态：✅ 后端API已就绪，前端对接完成

---

## 一、架构设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                        小程序前端 (miniprogram)                       │
├─────────────────────────────────────────────────────────────────────┤
│  packages/ingredient/pages/analysis/                                │
│  ├── index.js          → 调用 ingredientService.analyze()           │
│  ├── index.wxml        → 渲染六维分析结果                           │
│  └── utils/ingredient_analysis.js → 封装 API 调用                   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP POST
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      后端服务 (backend)                              │
├─────────────────────────────────────────────────────────────────────┤
│  app/api/v1/ingredient_analysis_router.py                           │
│  ├── POST /api/v1/ingredients/ocr          → OCR识别                │
│  ├── POST /api/v1/ingredients/analyze      → 六维分析                │
│  ├── POST /api/v1/ingredients/batch-analyze→ 批量分析                │
│  ├── GET  /api/v1/ingredients/additives    → 添加剂数据库            │
│  ├── GET  /api/v1/ingredients/food-homology→ 药食同源目录             │
│  ├── GET  /api/v1/ingredients/allergens    → 过敏原配置              │
│  └── GET  /api/v1/ingredients/health-score/{score} → 评分解读         │
├─────────────────────────────────────────────────────────────────────┤
│  app/services/ingredient_analysis.py                                 │
│  ├── IngredientAnalysisService (单例)                                │
│  │   ├── calculate_nutri_score()   → Nutri-Score 评分                │
│  │   ├── calculate_nova_group()    → NOVA 分组                       │
│  │   ├── identify_additives()      → E编码识别                       │
│  │   ├── detect_allergens()        → 过敏原检测                       │
│  │   ├── identify_herbal_ingredients() → 药食同源识别                  │
│  │   └── generate_nutrition_table()  → GB28050营养表                 │
│  └── 常量数据库                                                       │
│      ├── ADDITIVE_DB (50+种E编码)                                     │
│      ├── ALLERGEN_MAP (8大类过敏原)                                   │
│      ├── FOOD_HOMOLOGY_DB (50+种药食同源)                             │
│      └── GB28050_BASE/OPTIONAL (营养成分模板)                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、API接口规范

### 2.1 OCR识别配料表

```http
POST /api/v1/ingredients/ocr
Content-Type: multipart/form-data

Request:
  file: image/jpeg (食品包装配料表照片)

Response:
{
  "success": true,
  "data": {
    "text": "配料：小麦粉、白砂糖、植物油、山梨酸钾(E201)、柠檬黄(E102)...",
    "ingredients": [
      {"name": "小麦粉", "additive": null},
      {"name": "山梨酸钾", "additive": "201"},
      {"name": "柠檬黄", "additive": "102"}
    ]
  }
}
```

### 2.2 六维分析

```http
POST /api/v1/ingredients/analyze
Content-Type: application/json

Request:
{
  "ingredient_text": "小麦粉、白砂糖、植物油...",
  "ingredients": [
    {"name": "小麦粉", "additive": null},
    {"name": "山梨酸钾", "additive": "201"},
    {"name": "柠檬黄", "additive": "102"},
    {"name": "阿斯巴甜", "additive": "951"}
  ],
  "nutrition": {
    "energy": 1672,
    "protein": 8.5,
    "fat": 12.3,
    "carbohydrate": 65.2,
    "sugar": 28.5,
    "sodium": 380,
    "saturatedFat": 4.2,
    "fiber": 2.1
  },
  "serving_size": "100g"
}

Response:
{
  "success": true,
  "data": {
    "timestamp": "2026-01-15T10:30:00Z",
    "overallScore": 72,
    "overallGrade": {"grade": "B", "color": "#84BD00", "label": "良好"},
    "riskLevel": "low",
    "riskMessages": ["含2类过敏原"],
    "nutriScore": 72,
    "nutriGrade": {"grade": "B", "color": "#84BD00", "label": "良好"},
    "novaResult": {
      "group": 3,
      "label": "加工食品",
      "description": "加工食品，如罐头、新鲜面包..."
    },
    "additives": [
      {
        "code": "201",
        "eCode": "E201",
        "name": "山梨酸钾",
        "function": "防腐剂",
        "risk": "low",
        "maxUsage": "0.5-2.0g/kg"
      },
      {
        "code": "102",
        "eCode": "E102",
        "name": "柠檬黄",
        "function": "着色剂",
        "risk": "medium",
        "allergen": true
      },
      {
        "code": "951",
        "eCode": "E951",
        "name": "阿斯巴甜",
        "function": "甜味剂",
        "risk": "medium",
        "phenylketonuria": true
      }
    ],
    "allergens": [
      {"id": "egg", "name": "鸡蛋", "matched": ["鸡蛋"]},
      {"id": "milk", "name": "乳制品", "matched": ["全脂奶粉", "milk"]}
    ],
    "herbalIngredients": [
      {"name": "枸杞子", "property": "甘平", "category": "补阴", "effect": "滋补肝肾..."},
      {"name": "红枣", "property": "甘温", "category": "补气", "effect": "补中益气..."}
    ],
    "nutritionTable": [
      {"name": "能量", "unit": "kJ", "value": 1672, "nrv": 8400, "nrvPercent": 20, "important": true},
      {"name": "蛋白质", "unit": "g", "value": 8.5, "nrv": 60, "nrvPercent": 14, "important": true},
      ...
    ],
    "suggestions": [
      {"type": "neutral", "text": "整体营养评价良好，适合日常食用"},
      {"type": "warning", "text": "含有鸡蛋、乳制品等过敏原，过敏体质者慎食"}
    ]
  }
}
```

---

## 三、数据库扩展指南

### 3.1 扩展E编码添加剂

编辑 `backend/app/services/ingredient_analysis.py`，在 `ADDITIVE_DB` 中添加：

```python
'新编码': {
    'name': '添加剂中文名',
    'eCode': 'E新编码',
    'function': '功能类别',
    'risk': 'low|medium|high',
    'maxUsage': '最大使用量',
    'carcinogen': False,    # 是否可能致癌
    'allergen': False,      # 是否致敏
    'phenylketonuria': False  # 苯丙酮尿症患者是否禁用
}
```

### 3.2 扩展药食同源目录

在 `FOOD_HOMOLOGY_DB` 中添加：

```python
{'name': '药材名称', 'property': '性味', 'category': '归类', 'effect': '功效'}
```

### 3.3 扩展过敏原映射

在 `ALLERGEN_MAP` 中添加新过敏原类别：

```python
'new_allergen': {
    'name': '中文名称',
    'keywords': ['关键词1', '关键词2', '英文关键词']
}
```

---

## 四、OCR接入方案（待实现）

### 方案A：腾讯OCR（推荐）

```python
# backend/app/services/ocr/tencent_ocr.py
import TencentCloudCommon
from tencentcloud.ocr.v20181119 import ocr_client, models

class TencentOCRService:
    async def recognize_ingredient_label(self, image_bytes: bytes) -> str:
        """识别配料表文字"""
        # 使用文字识别(GeneralOCR)接口
        pass
```

### 方案B：百度OCR

```python
# backend/app/services/ocr/baidu_ocr.py
import AipOcr
from aip import AipOcr as BaiduOcr

class BaiduOCRService:
    async def recognize_ingredient_label(self, image_bytes: bytes) -> str:
        """识别配料表文字"""
        pass
```

### 接入步骤

1. 申请OCR API密钥（腾讯云/百度云）
2. 在 `.env` 中添加密钥配置
3. 实现对应的OCR服务类
4. 在 `/api/v1/ingredients/ocr` 中调用

---

## 五、文件清单

### 后端新增文件

| 文件 | 大小 | 说明 |
|------|------|------|
| `app/services/ingredient_analysis.py` | ~12KB | 六维分析引擎 + 数据库 |
| `app/api/v1/ingredient_analysis_router.py` | ~5KB | API路由注册 |

### 前端更新文件

| 文件 | 变更 |
|------|------|
| `utils/ingredient_analysis.js` | 重构为API调用封装 |
| `packages/ingredient/pages/analysis/index.js` | 对接后端API |
| `packages/ingredient/pages/analysis/index.wxml` | 更新UI适配 |
| `components/GlobalIcons/index.wxml` | 新增 icon-arrow-down |

### 后端注册

`backend/app/main.py` 已添加路由注册：
```python
from .api.v1.ingredient_analysis_router import router as ingredient_analysis_router
app.include_router(ingredient_analysis_router, prefix="/api/v1")
```

---

## 六、测试验证

### 6.1 后端测试

```bash
# 启动后端服务
cd backend
python -m uvicorn app.main:app --reload --port 8000

# 测试OCR接口
curl -X POST http://localhost:8000/api/v1/ingredients/ocr \
  -F "file=@test_image.jpg"

# 测试分析接口
curl -X POST http://localhost:8000/api/v1/ingredients/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "ingredient_text": "小麦粉、白砂糖、山梨酸钾、柠檬黄、枸杞子",
    "ingredients": [
      {"name": "小麦粉", "additive": null},
      {"name": "白砂糖", "additive": null},
      {"name": "山梨酸钾", "additive": "201"},
      {"name": "柠檬黄", "additive": "102"},
      {"name": "枸杞子", "additive": null}
    ],
    "nutrition": {
      "energy": 1500,
      "protein": 8.0,
      "fat": 10.0,
      "carbohydrate": 60.0,
      "sugar": 25.0,
      "sodium": 300
    }
  }'
```

### 6.2 小程序测试

```javascript
// 在小程序控制台测试
const service = require('../../utils/ingredient_analysis.js')

// 测试分析接口
const result = await service.analyze({
  ingredientText: '小麦粉、白砂糖、山梨酸钾、枸杞子',
  ingredients: [
    {name: '小麦粉'},
    {name: '白砂糖'},
    {name: '山梨酸钾', additive: '201'},
    {name: '枸杞子'}
  ]
})
console.log(result)
```

---

## 七、后续优化方向

1. **OCR接入**：接入腾讯/百度OCR实现真实图片识别
2. **数据库持久化**：将分析结果存储到PostgreSQL
3. **缓存优化**：对常用配料表结果进行Redis缓存
4. **批量分析**：支持导出分析报告为PDF
5. **AI增强**：接入大模型生成更详细的健康建议

---

## 八、版本记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| V2.0 | 2026-01-15 | 后端API对接完成，六维分析引擎后端化 |
| V1.3 | 2026-01-15 | 前端六维分析系统（本地算法版）|
| V1.2 | 2026-01-15 | 首页布局优化，Icon系统升级 |
| V1.1 | 2026-01-15 | 编译错误修复 |
