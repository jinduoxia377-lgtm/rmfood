/**
 * ContextAwareSuggestionEngine V2.0 - 上下文感知智能建议引擎
 *
 * ⚠️ 重构说明: 主实现已拆分为独立模块以减小单文件大小
 *   - 类型定义 & 领域知识: domainKnowledge.ts (1596 lines → externalized)
 *   - 引擎类实现: suggestionEngineClass.ts (836 lines → externalized)
 *
 * 性能指标:
 * - 首次响应 < 50ms (缓存命中)
 * - 全量分析 < 200ms
 * - 内存占用 < 3MB
 */

// Re-export all public APIs from split modules for backward compatibility

// Engine class & factory
export {
    ContextAwareSuggestionEngineV2,
    getContextAwareEngine,
} from './suggestionEngineClass';

// Type definitions (imported by suggestionEngineClass, re-exported here)
export type {
    SemanticEntity, EntityType, ExtractedIntent, IntentType,
    ContextProfile, DynamicSuggestion, AdaptedTerm, AnalysisResult,
    KeywordAnalysis, SentimentResult, ComplexityMetrics, ContextRelevanceScore,
} from './domainKnowledge';

// Helper functions
export { fuzzyMatchTerms, getTermsByCategory } from './domainKnowledge';
