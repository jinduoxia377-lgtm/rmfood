# NLP配置外部化迁移检查清单

## ✅ 部署前检查

### 1. 文件部署
- [ ] 确认 `public/config/nlp/` 目录包含4个JSON文件
- [ ] 验证JSON文件格式正确（无语法错误）
- [ ] 检查文件权限（可读）

### 2. 代码集成
- [ ] `main.tsx` 已添加 `initializeNLPConfigs()` 调用
- [ ] `suggestionEngine.ts` 已更新为 `await this.entityExtractor.extract()`
- [ ] 无其他直接调用同步 `extract()` 的代码

### 3. 功能验证
- [ ] TextCleaner繁简转换正常（"設計" → "设计"）
- [ ] TextCleaner全角半角转换正常（"Ａ" → "x"）
- [ ] EntityExtractor能识别功能宣称（"降三高"）
- [ ] EntityExtractor能识别目标人群（"中老年"）
- [ ] 配置加载失败时有降级处理

## 🧪 测试场景

### 基础功能测试
```typescript
// 测试1: 文本规范化
const cleaner = new TextCleaner()
console.log(cleaner.normalize('設計一款產品')) // 期望: "设计一款产品"

// 测试2: 实体抽取（异步）
const extractor = new EntityExtractor()
const entities = await extractor.extract('降三高功能食品')
console.log(entities.length > 0) // 期望: true
```

### 边界情况测试
- [ ] 空字符串输入
- [ ] 特殊字符输入
- [ ] 超长文本输入（1000+字符）
- [ ] 网络延迟/失败场景

## 🚀 上线后监控

### 关键指标
- [ ] 控制台无 `[NLPConfigService] ❌` 错误日志
- [ ] 实体识别准确率无明显下降
- [ ] 首次加载时间 < 500ms
- [ ] 内存占用稳定

### 性能基准
```
配置加载时间: _____ ms (目标: <300ms)
文本规范化时间: _____ ms (目标: <5ms)
实体抽取时间: _____ ms (目标: <50ms)
缓存命中率: _____ % (目标: >95%)
```

## 📝 回滚方案

如果遇到严重问题，可快速回滚：

1. **Git回滚**：
   ```bash
   git revert <commit-hash>
   ```

2. **临时禁用**：
   ```typescript
   // main.tsx 中注释掉初始化代码
   // initializeNLPConfigs({...})
   ```

3. **使用旧版本**：恢复 `nlpProcessor.ts` 的硬编码版本

## 🎯 成功标准

✅ **所有检查项通过**  
✅ **性能指标达标**  
✅ **无新增错误**  
✅ **用户无感知**（功能完全兼容）

---

*完成所有检查项后，即可安全上线！*
