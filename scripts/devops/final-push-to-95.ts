/**
 * 🎯 最终达标脚本 - 从86分提升到95+分
 *
 * 剩余问题:
 * - 40个any类型 (主要是GenerateTab.tsx的30个)
 * - 6个hardcoded strings
 * - 1个emoji
 *
 * 策略: 使用v4版本替换有问题的原版文件
 */

import * as fs from 'fs'
import * as path from 'path'

// ===== 配置 =====

const REPLACEMENTS = [
  // 用v4版本替换原版（消除any类型和hardcoded strings）
  {
    source: './frontend/src/components/ai/features/GenerateTab.v4.tsx',
    target: './frontend/src/components/ai/features/GenerateTab.tsx',
    reason: '消除30个any类型 + 10个hardcoded strings',
  },
  {
    source: './frontend/src/components/ai/features/SafetyTab.v4.tsx',
    target: './frontend/src/components/ai/features/SafetyTab.tsx',
    reason: '消除6个any类型',
  },
  {
    source: './frontend/src/components/ai/features/ChatTab.v4.simple.tsx',
    target: './frontend/src/components/ai/features/ChatTab.tsx',
    reason: '消除2个any类型 + hardcoded strings',
  },
]

// ===== 主函数 =====

function main() {
  console.log('🎯 最终达标脚本启动')
  console.log('='.repeat(50))

  let replacementsMade = 0
  let errors = 0

  console.log('\n📝 Step 1: 用v4版本替换原版文件...')

  REPLACEMENTS.forEach(({ source, target, reason }) => {
    try {
      if (fs.existsSync(source)) {
        // 备份原文件
        if (fs.existsSync(target)) {
          const backupPath = `${target}.backup`
          fs.copyFileSync(target, backupPath)
          console.log(`  📦 已备份: ${path.basename(target)} → ${path.basename(backupPath)}`)
        }

        // 复制v4版本到原位置
        fs.copyFileSync(source, target)
        console.log(`  ✅ 已替换: ${path.basename(target)}`)
        console.log(`     原因: ${reason}`)
        replacementsMade++
      } else {
        console.log(`  ⏭️  源文件不存在: ${source}`)
      }
    } catch (error) {
      console.error(`  ❌ 替换失败: ${target} - ${error}`)
      errors++
    }
  })

  // 统计结果
  console.log('\n' + '='.repeat(50))
  console.log('📊 操作统计:')
  console.log(`  - 替换文件数: ${replacementsMade}`)
  console.log(`  - 错误数: ${errors}`)

  if (errors === 0 && replacementsMade > 0) {
    console.log('\n✅ 所有替换成功完成！')
    console.log('\n预期效果: 评分从86分提升至95+分')
    console.log('\n下一步: 运行合规性检查验证')
    console.log('  npx ts-node --esm scripts/compliance-checker.ts "./frontend/src/components/ai/features" markdown')
  } else if (replacementsMade === 0) {
    console.log('\n⚠️  未执行任何替换（源文件可能不存在）')
  } else {
    console.log(`\n⚠️  完成，但有 ${errors} 个错误`)
  }

  return { replacementsMade, errors }
}

// 运行
const result = main()
