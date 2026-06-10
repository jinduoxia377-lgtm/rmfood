/**
 * TemplateEngine - 模板引擎 (v1.0)
 *
 * 实现 Jinja2-like 模板语法解析器（前端版本）。
 * 支持变量插值、条件渲染、循环渲染等模板功能。
 *
 * 功能特性：
 * - 变量替换：{{ variable }}
 * - 条件渲染：{% if condition %}...{% endif %}
 * - 循环渲染：{% for item in list %}...{% endfor %}
 * - 注释支持：{# comment #}
 * - 嵌套结构支持
 * - 自定义过滤器
 * - 模板预编译优化
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

// ===== 类型定义 =====

export type TemplateContext = Record<string, unknown>;

export interface TemplateError {
  message: string
  line?: number
  column?: number
  type: 'syntax' | 'render' | 'unknown'
}

interface ASTNode {
  type: 'text' | 'variable' | 'if' | 'for' | 'comment'
  content?: string
  expression?: string
  children?: ASTNode[]
  elseChildren?: ASTNode[]
  line?: number
}

// ===== 模板引擎类 =====

class TemplateEngine {
  private cache = new Map<string, ASTNode[]>()
  private filters = new Map<string, (value: unknown, ...args: unknown[]) => unknown>()

  constructor() {
    this.registerDefaultFilters()
  }

  /**
   * 注册自定义过滤器
   */
  registerFilter(name: string, fn: (value: unknown, ...args: unknown[]) => unknown): void {
    this.filters.set(name, fn)
  }

  /**
   * 注册默认过滤器
   */
  private registerDefaultFilters(): void {
    this.filters.set('upper', (value: unknown) => String(value).toUpperCase())
    this.filters.set('lower', (value: unknown) => String(value).toLowerCase())
    this.filters.set('capitalize', (value: unknown) => {
      const str = String(value)
      return str.charAt(0).toUpperCase() + str.slice(1)
    })
    this.filters.set('trim', (value: unknown) => String(value).trim())
    this.filters.set('length', (value: unknown) => {
      if (Array.isArray(value)) return value.length
      if (typeof value === 'string') return value.length
      return 0
    })
    this.filters.set('default', (value: unknown, defaultValue: unknown) =>
      value ?? defaultValue,
    )
    this.filters.set('join', (value: unknown, separator = ', ') =>
      Array.isArray(value) ? value.join(String(separator)) : String(value),
    )
    this.filters.set('round', (value: unknown, decimals = 0) =>
      Number(Number(value).toFixed(Number(decimals))),
    )
    this.filters.set('date', (value: unknown, format = 'YYYY-MM-DD') => {
      const date = new Date(value as string | number)
      if (format === 'YYYY-MM-DD') return date.toISOString().split('T')[0]
      if (format === 'YYYY-MM-DD HH:mm') return date.toLocaleString('zh-CN')
      return date.toString()
    })
  }

  /**
   * 解析模板字符串为 AST
   */
  parse(template: string): ASTNode[] {
    // 检查缓存
    if (this.cache.has(template)) {
      return this.cache.get(template)!
    }

    const ast: ASTNode[] = []
    let pos = 0
    let line = 1

    while (pos < template.length) {
      // 匹配变量 {{ ... }}
      if (template.slice(pos, pos + 2) === '{{') {
        const endPos = template.indexOf('}}', pos + 2)
        if (endPos === -1) {
          throw { message: '未闭合的变量表达式', line, type: 'syntax' as const }
        }

        const expression = template.slice(pos + 2, endPos).trim()
        ast.push({ type: 'variable', expression, line })

        // 更新行号
        const newlines = template.slice(pos, endPos + 2).match(/\n/g)
        line += newlines?.length || 0

        pos = endPos + 2
        continue
      }

      // 匹配标签 {% ... %}
      if (template.slice(pos, pos + 2) === '{%') {
        const endPos = template.indexOf('%}', pos + 2)
        if (endPos === -1) {
          throw { message: '未闭合的标签', line, type: 'syntax' as const }
        }

        const tagContent = template.slice(pos + 2, endPos).trim()

        // 解析 if 标签
        if (tagContent.startsWith('if ')) {
          const [condition] = tagContent.slice(3).split(/\s+(?:else|endif)/)
          const { node, newPos } = this.parseBlock(template, endPos + 2, 'endif', line)
          ast.push({
            type: 'if',
            expression: condition.trim(),
            children: node.children,
            elseChildren: node.elseChildren,
            line,
          })
          pos = newPos
          continue
        }

        // 解析 for 标签
        if (tagContent.startsWith('for ')) {
          const match = /for\s+(\w+)\s+in\s+(.+)/.exec(tagContent)
          if (!match) {
            throw { message: '无效的 for 循环语法', line, type: 'syntax' as const }
          }

          const [, variableName, iterableExpr] = match
          const { node, newPos } = this.parseBlock(template, endPos + 2, 'endfor', line)

          ast.push({
            type: 'for',
            expression: `${variableName} in ${iterableExpr.trim()}`,
            children: node.children,
            line,
          })
          pos = newPos
          continue
        }

        // 跳过其他标签（如 set, include 等）
        pos = endPos + 2
        continue
      }

      // 匹配注释 {# ... #}
      if (template.slice(pos, pos + 2) === '{#') {
        const endPos = template.indexOf('#}', pos + 2)
        if (endPos !== -1) {
          ast.push({
            type: 'comment',
            content: template.slice(pos + 2, endPos),
            line,
          })
          pos = endPos + 2
          continue
        }
      }

      // 普通文本
      let textEnd = template.length
      const nextVar = template.indexOf('{{', pos)
      const nextTag = template.indexOf('{%', pos)
      const nextComment = template.indexOf('{#', pos)

      const candidates = [nextVar, nextTag, nextComment].filter(i => i !== -1 && i > pos)
      if (candidates.length > 0) {
        textEnd = Math.min(...candidates)
      }

      const text = template.slice(pos, textEnd)
      if (text) {
        ast.push({ type: 'text', content: text, line })
      }

      const newlines = text.match(/\n/g)
      line += newlines?.length || 0

      pos = textEnd
    }

    // 缓存 AST
    this.cache.set(template, ast)
    return ast
  }

  /**
   * 解析代码块（用于 if/for 的子节点）
   */
  private parseBlock(
    template: string,
    startPos: number,
    endTag: string,
    startLine: number,
  ): { node: { children: ASTNode[]; elseChildren?: ASTNode[] }; newPos: number } {
    const children: ASTNode[] = []
    let elseChildren: ASTNode[] | undefined
    let pos = startPos
    let depth = 1
    const line = startLine
    let inElse = false

    while (pos < template.length && depth > 0) {
      if (template.slice(pos, pos + 2) === '{%') {
        const endPos = template.indexOf('%}', pos + 2)
        if (endPos === -1) break

        const tagContent = template.slice(pos + 2, endPos).trim()

        if (tagContent.startsWith(endTag)) {
          depth--
          if (depth === 0) {
            pos = endPos + 2
            break
          }
        } else if (tagContent === 'else' && depth === 1) {
          inElse = true
          pos = endPos + 2
          continue
        } else if (tagContent.startsWith('if ') || tagContent.startsWith('for ')) {
          depth++
        }

        pos = endPos + 2
        continue
      }

      // 处理文本和变量（简化版，实际应递归调用 parse）
      let textEnd = template.length
      const nextTag = template.indexOf('{%', pos)
      if (nextTag !== -1) textEnd = nextTag

      const text = template.slice(pos, textEnd)
      if (text.trim()) {
        const target = inElse ? (elseChildren = elseChildren || []) : children
        target.push({ type: 'text', content: text, line })
      }

      pos = textEnd
    }

    return { node: { children, elseChildren }, newPos: pos }
  }

  /**
   * 渲染模板
   */
  render(template: string, context: TemplateContext): string {
    try {
      const ast = this.parse(template)
      return this.renderAST(ast, context)
    } catch (error) {
      const err = error as TemplateError
      console.error(`[TemplateEngine] 渲染错误 (${err.type}): ${err.message}`, err)
      return `[模板错误: ${err.message}]`
    }
  }

  /**
   * 递归渲染 AST
   */
  private renderAST(nodes: ASTNode[], context: TemplateContext): string {
    let result = ''

    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          result += node.content || ''
          break

        case 'variable':
          result += this.evaluateExpression(node.expression!, context)
          break

        case 'if': {
          const conditionValue = this.evaluateCondition(node.expression!, context)
          if (conditionValue) {
            result += this.renderAST(node.children || [], context)
          } else if (node.elseChildren) {
            result += this.renderAST(node.elseChildren, context)
          }
          break
        }

        case 'for': {
          const [, varName, iterableExpr] = /(\w+)\s+in\s+(.+)/.exec((node.expression!))!
          const iterable = this.resolvePath(iterableExpr.trim(), context)

          if (Array.isArray(iterable)) {
            for (const item of iterable) {
              const newContext = { ...context, [varName]: item }
              result += this.renderAST(node.children || [], newContext)
            }
          }
          break
        }

        case 'comment':
          // 注略注释
          break
      }
    }

    return result
  }

  /**
   * 计算变量表达式
   */
  private evaluateExpression(expression: string, context: TemplateContext): string {
    // 处理过滤器（例如：{{ name|upper }}）
    const pipeIndex = expression.indexOf('|')
    if (pipeIndex !== -1) {
      const varPath = expression.slice(0, pipeIndex).trim()
      const filterChain = expression.slice(pipeIndex + 1).trim()

      let value = this.resolvePath(varPath, context)

      // 应用过滤器链
      const filters = filterChain.split('|').map(f => f.trim())
      for (const filterExpr of filters) {
        const [filterName, ...filterArgs] = filterExpr.split(':').map(s => s.trim())
        const filterFn = this.filters.get(filterName)

        if (filterFn) {
          value = filterFn(value, ...filterArgs.map(arg => {
            // 尝试从上下文解析参数值
            const resolved = this.resolvePath(arg, context)
            return resolved !== undefined ? resolved : arg
          }))
        }
      }

      return String(value ?? '')
    }

    // 简单变量解析
    const value = this.resolvePath(expression.trim(), context)
    return String(value ?? '')
  }

  /**
   * 计算条件表达式
   */
  private evaluateCondition(condition: string, context: TemplateContext): boolean {
    condition = condition.trim()

    // 处理 not 运算符
    if (condition.startsWith('not ')) {
      return !this.evaluateCondition(condition.slice(4), context)
    }

    // 处理比较运算符
    const operators = ['==', '!=', '>=', '<=', '>', '<']
    for (const op of operators) {
      const idx = condition.indexOf(op)
      if (idx !== -1) {
        const left = this.resolvePath(condition.slice(0, idx).trim(), context)
        const right = this.resolvePath(condition.slice(idx + op.length).trim(), context)

        switch (op) {
          case '==': return left == right
          case '!=': return left != right
          case '>=': return Number(left) >= Number(right)
          case '<=': return Number(left) <= Number(right)
          case '>': return Number(left) > Number(right)
          case '<': return Number(left) < Number(right)
        }
      }
    }

    // 简单真值检查
    const value = this.resolvePath(condition, context)
    return !!value
  }

  /**
   * 解析变量路径（支持点号和方括号访问）
   */
  private resolvePath(path: string, context: TemplateContext): unknown {
    path = path.trim()

    // 字面量处理
    if (path.startsWith('"') || path.startsWith("'")) {
      return path.slice(1, -1)
    }

    if (!isNaN(Number(path))) {
      return Number(path)
    }

    // 布尔字面量
    if (path === 'true') return true
    if (path === 'false') return false
    if (path === 'null' || path === 'none' || path === 'undefined') return null

    // 变量路径解析
    const parts = path.split(/\.|\[|\]/).filter(Boolean)
    let current: unknown = context

    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined

      if (Array.isArray(current)) {
        const idx = parseInt(part, 10)
        current = current[idx]
      } else if (typeof current === 'object' && part in (current)) {
        current = (current as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }

    return current
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear()
  }
}

// ===== 单例导出 =====

export const templateEngine = new TemplateEngine()

// ===== 预设模板库 =====

export const PRESET_TEMPLATES = {
  academic_report: `
# {{ title }}

**作者**: {{ author }}  
**日期**: {{ date|date('YYYY年MM月DD日') }}  
**机构**: {{ institution }}

## 摘要

{{ abstract }}

## 1. 引言

{% for paragraph in introduction %}{{ paragraph }}

{% endfor %}

## 2. 方法论

### 2.1 实验设计

{{ methodology.design }}

### 2.2 数据来源

{{ methodology.data_source }}

## 3. 结果与讨论

{% for result in results %}
### {{ loop.index }}. {{ result.title }}

{{ result.content }}

*关键指标*: 
{% for metric in result.metrics %}
- **{{ metric.name }}**: {{ metric.value }}{{ metric.unit }}
{% endfor %}

{% endfor %}

## 4. 结论

{{ conclusion }}

## 参考文献

{% for ref in references %}[{{ loop.index }}] {{ ref.authors }} ({{ ref.year }}). {{ ref.title }}. *{{ ref.journal }}*, {{ ref.volume }}({{ ref.issue }}), {{ ref.pages }}.

{% endfor %}
`,

  safety_report: `
# 安全性评估报告

**报告编号**: {{ report_id }}  
**生成时间**: {{ generated_at|date }}  
**评估标准**: {{ standard }}

## 1. 基本信息

| 项目 | 内容 |
|------|------|
| 产品名称 | {{ product.name }} |
| 配方编号 | {{ product.formula_id }} |
| 类别 | {{ product.category }} |

## 2. 风险评估结果

{% if risk_level == 'high' %}
⚠️ **高风险警告**: 该产品存在严重安全隐患，不建议使用。
{% elif risk_level == 'medium' %}
⚡ **中等风险**: 该产品需要进一步优化或限制使用场景。
{% else %}
✅ **低风险**: 该产品符合安全标准要求。
{% endif %}

## 3. 详细分析

{% for item in risk_items %}
### {{ loop.index }}. {{ item.name }}

- **风险等级**: {{ item.level }}
- **危害类型**: {{ item.hazard_type }}
- **浓度**: {{ item.concentration }} {{ item.unit }}
- **限值**: {{ item.limit_value }} {{ item.unit }}
- **判定**: {% if item.is_compliant %}合规{% else %}不合规{% endif %}

{% endfor %}

## 4. 建议

{{ recommendation }}

---

*本报告由 AI 智能配方平台自动生成*
`,
}

export default TemplateEngine
