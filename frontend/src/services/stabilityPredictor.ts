/**
 * StabilityPredictor - 稳定性预测算法
 *
 * 基于 Arrhenius 方程和 Q10 法则的货架寿命预测引擎
 * 支持多因素分析、时间序列模拟和储存条件优化
 */

import type {
  StabilityDataPoint,
  StabilityAssessment,
  StorageCondition,
  FactorContribution,
  ArrheniusParams,
} from '@/types/stability.types'

interface PredictionInput {
  /** 初始有效成分含量 (%) */
  initialPotency: number
  /** 目标最低含量 (通常为 90% 或 80%) */
  targetPotency: number
  /** 储存条件 */
  storageCondition: StorageCondition
  /** 配方成分列表 */
  ingredients?: string[]
}

const Q10_VALUE = 2.0

export class StabilityPredictor {
  private arrheniusParams: ArrheniusParams = {
    A: 1e10,
    Ea: 75000,
    R: 8.314,
  }

  predict(input: PredictionInput): StabilityAssessment {
    const degradationRate = this.calculateDegradationRate(input.storageCondition)
    const shelfLifeDays = this.calculateShelfLife(
      input.initialPotency,
      input.targetPotency,
      degradationRate,
    )

    const timeSeriesData = this.generateTimeSeries(
      input.initialPotency,
      degradationRate,
      Math.min(shelfLifeDays * 1.5, 730),
    )

    const criticalFactors = this.identifyCriticalFactors(input)
    const storageRecommendations = this.generateRecommendations(
      input.storageCondition,
      shelfLifeDays,
    )
    const factorContributions = this.calculateFactorContributions(
      input.storageCondition,
    )

    return {
      score: this.calculateStabilityScore(shelfLifeDays, timeSeriesData),
      shelfLifeDays,
      degradationPathway: this.identifyDegradationPathways(),
      criticalFactors,
      storageRecommendations,
      timeSeriesData,
      factorContributions,
    }
  }

  private calculateDegradationRate(condition: StorageCondition): number {
    const tempFactor = this.calculateTemperatureFactor(condition.temperature)
    const humidityFactor = this.calculateHumidityFactor(condition.humidity)
    const lightFactor = this.calculateLightFactor(condition.lightExposure)
    const packagingFactor = this.calculatePackagingFactor(condition.packaging)

    const baseRate = 0.001

    return baseRate * tempFactor * humidityFactor * lightFactor * packagingFactor
  }

  private calculateTemperatureFactor(tempCelsius: number): number {
    if (tempCelsius <= 0) return 0.1
    if (tempCelsius <= 25) return 1.0

    const deltaT = tempCelsius - 25
    return Math.pow(Q10_VALUE, deltaT / 10)
  }

  private calculateHumidityFactor(humidityPercent: number): number {
    if (humidityPercent <= 30) return 0.8
    if (humidityPercent <= 60) return 1.0
    if (humidityPercent <= 75) return 2.0

    return 4.0 + (humidityPercent - 75) * 0.1
  }

  private calculateLightFactor(lightExposure: StorageCondition['lightExposure']): number {
    switch (lightExposure) {
      case 'dark':
        return 0.3
      case 'ambient':
        return 1.0
      case 'bright':
        return 3.0
      default:
        return 1.0
    }
  }

  private calculatePackagingFactor(packaging: StorageCondition['packaging']): number {
    switch (packaging) {
      case 'sealed':
        return 0.5
      case 'semi-permeable':
        return 1.0
      case 'open':
        return 3.0
      default:
        return 1.0
    }
  }

  private calculateShelfLife(
    initialPotency: number,
    targetPotency: number,
    rate: number,
  ): number {
    if (rate <= 0 || initialPotency <= targetPotency) return Infinity

    const k = rate / 30

    const t = -Math.log(targetPotency / initialPotency) / k

    return Math.round(Math.max(30, Math.min(t, 1825)))
  }

  private generateTimeSeries(
    initialPotency: number,
    rate: number,
    maxDays: number,
  ): StabilityDataPoint[] {
    const data: StabilityDataPoint[] = []
    const intervalDays = Math.max(7, Math.floor(maxDays / 24))

    for (let day = 0; day <= maxDays; day += intervalDays) {
      const k = rate / 30
      const potency = initialPotency * Math.exp(-k * day)
      const impurities = (100 - potency) * 0.8

      data.push({
        time: day,
        timeUnit: 'day',
        potency: Math.max(0, potency),
        impurities: Math.min(100, impurities),
        ph: undefined,
        moisture: undefined,
      })
    }

    return data
  }

  private identifyCriticalFactors(input: PredictionInput): string[] {
    const factors: string[] = []
    const condition = input.storageCondition

    if (condition.temperature > 30) {
      factors.push(`高温环境(${condition.temperature}°C)加速降解`)
    }
    if (condition.humidity > 70) {
      factors.push(`高湿度(${condition.humidity}%)促进水解反应`)
    }
    if (condition.lightExposure === 'bright') {
      factors.push('强光照射导致光敏性成分分解')
    }
    if (condition.packaging === 'open') {
      factors.push('开放包装增加氧化和吸湿风险')
    }
    if (!factors.length) {
      factors.push('当前条件下稳定性良好')
    }

    return factors
  }

  private generateRecommendations(
    condition: StorageCondition,
    shelfLifeDays: number,
  ): string[] {
    const recommendations: string[] = []

    if (condition.temperature > 25) {
      recommendations.push('建议降低储存温度至 25°C 以下，可延长保质期约 50%')
    }
    if (condition.humidity > 60) {
      recommendations.push('建议控制相对湿度在 40-60%，使用干燥剂或密封包装')
    }
    if (condition.lightExposure !== 'dark') {
      recommendations.push('建议避光保存（棕色瓶或不透明容器）')
    }
    if (condition.packaging !== 'sealed') {
      recommendations.push('建议使用密封包装，防止氧气和水分侵入')
    }

    if (shelfLifeDays < 90) {
      recommendations.push('保质期较短，建议小批量生产、快速周转')
    } else if (shelfLifeDays > 365) {
      recommendations.push('稳定性良好，可考虑批量生产和长期储备')
    }

    recommendations.push(
      `预计保质期：${Math.round(shelfLifeDays / 30)} 个月`,
    )

    return recommendations.slice(0, 6)
  }

  private calculateFactorContributions(
    condition: StorageCondition,
  ): FactorContribution[] {
    const contributions: FactorContribution[] = []

    contributions.push({
      factor: '温度',
      impact: this.calculateTemperatureFactor(condition.temperature),
      description:
        condition.temperature > 25
          ? `${condition.temperature}°C 高于标准温度，降解速率加快 ${(
              this.calculateTemperatureFactor(condition.temperature) - 1
            ).toFixed(1)} 倍`
          : '温度适宜',
    })

    contributions.push({
      factor: '湿度',
      impact: this.calculateHumidityFactor(condition.humidity),
      description:
        condition.humidity > 60
          ? `高湿环境促进水解和微生物生长`
          : '湿度可控',
    })

    contributions.push({
      factor: '光照',
      impact: this.calculateLightFactor(condition.lightExposure),
      description:
        condition.lightExposure === 'bright'
          ? '强光导致光敏物质分解'
          : condition.lightExposure === 'dark'
          ? '避光保存效果良好'
          : '正常光照条件',
    })

    contributions.push({
      factor: '包装',
      impact: this.calculatePackagingFactor(condition.packaging),
      description:
        condition.packaging === 'sealed'
          ? '密封包装有效阻隔外界影响'
          : condition.packaging === 'open'
          ? '开放包装风险较高'
          : '半透膜包装需注意',
    })

    return contributions
  }

  private calculateStabilityScore(
    shelfLifeDays: number,
    timeSeries: StabilityDataPoint[],
  ): number {
    if (timeSeries.length < 2) return 50

    const finalPotency = timeSeries[timeSeries.length - 1].potency
    const retentionRate = finalPotency / 100

    let score = retentionRate * 50

    if (shelfLifeDays >= 365) score += 30
    else if (shelfLifeDays >= 180) score += 20
    else if (shelfLifeDays >= 90) score += 10

    score += Math.min(20, shelfLifeDays / 36.5)

    return Math.min(100, Math.max(0, score))
  }

  private identifyDegradationPathways(): string[] {
    return [
      '水解反应（水分参与）',
      '氧化反应（氧气参与）',
      '光解反应（紫外线诱导）',
      '热降解（高温加速）',
      '酶促降解（残留酶活性）',
    ]
  }

  setArrheniusParams(params: Partial<ArrheniusParams>): void {
    this.arrheniusParams = { ...this.arrheniusParams, ...params }
  }
}

export const stabilityPredictor = new StabilityPredictor()
export default StabilityPredictor
