# RMCHM 图片缺失问题审查报告

**审查日期**：2026-09-08  
**状态**：🔧 修复中

---

## 一、问题现象

用户在前端测试 RMCHM 数据源时，发现药材图片无法显示。

---

## 二、问题根因分析

### 2.1 数据库图片路径

```sql
SELECT name_cn, image_path FROM rmchm_herbs WHERE image_path IS NOT NULL LIMIT 5;
```

**结果**：
| name_cn | image_path |
|---------|------------|
| 八角茴香 | data/106FAM/八角.jpg |
| 白扁豆 | data/106FAM/白扁豆.jpg |
| 白果 | data/106FAM/白果.jpg |
| ... | ... |

**统计**：
- 有图片的药材：111 条
- 总药材数：714 条
- 覆盖率：15.5%

### 2.2 图片存储位置

- 实际目录：`D:\RMFOODFP\data\106FAM\`
- 图片数量：107 个 .jpg 文件
- 文件大小：约 100KB-150KB/个

### 2.3 后端 API 问题

| 问题 | 详情 |
|------|------|
| 🔴 路由未注册 | `rmchm_images.py` 未被自动发现 |
| 🟡 映射文件编码错误 | 中文 key 变成乱码 |
| 🟡 图片路径格式不统一 | 数据库存相对路径，API期望绝对路径 |

---

## 三、已执行的修复

### 3.1 重新生成映射文件

**脚本**：`backend/scripts/regenerate_rmchm_image_map.py`

```python
# 生成正确的 UTF-8 编码映射
mapping = {
    "八角": "/api/v1/rmchm/images/八角.jpg",
    "白扁豆": "/api/v1/rmchm/images/白扁豆.jpg",
    ...
}
```

**输出文件**：`backend/data/rmchm_image_map.json`  
**映射数量**：107 条

### 3.2 更新数据库图片路径

**脚本**：`backend/scripts/fix_rmchm_images.py`

将数据库中的 `image_path` 从相对路径转换为 API 路径：
```
data/106FAM/八角.jpg → /api/v1/rmchm/images/八角.jpg
```

---

## 四、待解决问题

### 4.1 路由注册问题

**现状**：
- `rmchm_images.py` 文件已存在
- 定义了 `router = APIRouter(prefix="/rmchm")`
- 但 API 端点返回 404

**可能原因**：
1. 后端服务未重启，新路由未加载
2. 路由自动发现机制未捕获到新模块
3. 模块名冲突或导入错误

**解决方案**：
- 重启后端服务
- 检查日志确认路由注册状态
- 必要时手动在 `main.py` 中注册路由

### 4.2 前端图片组件适配

**现状**：
- `HerbImage.tsx` 调用 `/api/v1/herbs/image-url/{name}`
- 需要适配新的 RMCHM 图片API `/api/v1/rmchm/image-url/{name}`

**解决方案**：
1. 修改 `HerbImage.tsx` 支持数据源判断
2. 或在 `herb_images.py` 中添加兼容接口

---

## 五、验证步骤

### 5.1 后端验证

```bash
# 测试图片映射
curl "http://localhost:8000/api/v1/rmchm/image-map"

# 测试图片URL查询
curl "http://localhost:8000/api/v1/rmchm/image-url/八角"

# 测试图片文件访问
curl "http://localhost:8000/api/v1/rmchm/images/八角.jpg" -o test.jpg
```

### 5.2 前端验证

刷新 http://localhost:3000/databases

检查：
1. 数据源切换按钮是否正常显示
2. 点击 RMCHM 后数据是否正常加载
3. 药材图片是否正确显示

---

## 六、数据覆盖统计

| 数据类型 | 数量 | 覆盖率 |
|---------|------|--------|
| 药材总数 | 714 | 100% |
| 有化合物 | 498 | 69.7% |
| 有靶点 | 446 | 62.5% |
| 有疾病 | 487 | 68.2% |
| **有图片** | **111** | **15.5%** |

---

## 七、后续优化建议

### 7.1 短期优化

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 重启后端服务 | 🔴 高 | 加载新路由 |
| 补全图片映射 | 🟡 中 | 为更多药材添加图片 |
| 前端组件适配 | 🟡 中 | 支持多数据源图片API |

### 7.2 长期优化

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 图片CDN加速 | 🟢 低 | 提升图片加载速度 |
| 图片懒加载 | 🟢 低 | 优化页面性能 |
| 图片压缩 | 🟢 低 | 减少传输大小 |

---

## 八、总结

### 已完成
✅ 重新生成正确的图片映射文件  
✅ 更新数据库图片路径  
✅ 创建 RMCHM 图片API模块  

### 待完成
⏳ 重启后端服务验证路由注册  
⏳ 前端组件适配多数据源图片API  
⏳ 补全缺失图片的药材  

---

**审查完成！请重启后端服务后验证图片显示功能。**
