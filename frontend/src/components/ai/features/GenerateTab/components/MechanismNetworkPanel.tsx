/**
 * MechanismNetworkPanel - 机理网络药理可视化面板
 *
 * @description 把 candidate.mechanism.mechanisms（逐药材 compounds→targets）可视化为
 *              网络药理视图：突出**共享靶点**（被 ≥2 味药材调控 = 配伍协同/多药理学的
 *              物质基础），并按命中药材数着色。消费 buildMechanismNetwork 聚合。
 * @version 1.0.0
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Network, Sparkles, Target } from 'lucide-react'
import { buildMechanismNetwork } from '../utils/mechanismNetwork'
import type { MechanismHerbEntry } from '../utils/mechanismNetwork'

interface MechanismNetworkPanelProps {
  mechanisms: MechanismHerbEntry[] | undefined
}

/** 靶点按命中药材数着色（共享度越高越突出） */
function targetBadgeCls(herbCount: number, maxHerbs: number): string {
  if (herbCount >= 3) return 'bg-primary-100 text-primary-800 dark:bg-primary-300/25 dark:text-primary-200 border-primary-300'
  if (herbCount >= 2) return 'bg-accent-50 text-accent-700 dark:bg-accent-300/20 dark:text-accent-300 border-accent-200'
  if (maxHerbs <= 1) return 'bg-muted text-muted-foreground border-border'
  return 'bg-muted text-muted-foreground border-border'
}

export function MechanismNetworkPanel({ mechanisms }: MechanismNetworkPanelProps) {
  const { t } = useTranslation()

  const network = useMemo(() => buildMechanismNetwork(mechanisms), [mechanisms])

  if (network.stats.targetCount === 0) {
    return (
      <div className="text-caption text-muted-foreground py-3">
        {t('ai.formula.generateTab.noMechanismData')}
      </div>
    )
  }

  const { stats, sharedTargets, herbs } = network

  return (
    <div className="space-y-4">
      {/* 统计摘要 */}
      <div className="flex flex-wrap items-center gap-3 text-caption">
        <span className="flex items-center gap-1 font-semibold text-primary">
          <Network className="w-3.5 h-3.5" />
          {t('ai.formula.generateTab.networkPharmacology')}
        </span>
        <span className="text-muted-foreground">
          {t('ai.formula.generateTab.herbsCount', { count: stats.herbCount })} · {t('ai.formula.generateTab.targetsCount', { count: stats.targetCount })}
        </span>
        {stats.sharedTargetCount > 0 && (
          <span className="flex items-center gap-1 text-accent-700 dark:text-accent-300 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            {t('ai.formula.generateTab.sharedTargetsTitle')}
          </span>
        )}
      </div>

      {/* 共享靶点（配伍协同的物质基础） */}
      {sharedTargets.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-caption font-semibold text-primary flex items-center gap-1">
            <Target className="w-3.5 h-3.5" />
            {t('ai.formula.generateTab.sharedTargetsTitle')}
          </h4>
          <p className="text-caption text-muted-foreground">
            {t('ai.formula.generateTab.sharedTargetsHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            {sharedTargets.map((tg) => (
              <div
                key={tg.name}
                className={`rounded-lg border px-2.5 py-1.5 ${targetBadgeCls(tg.herbCount, stats.maxHerbsPerTarget)}`}
                title={t('ai.formula.generateTab.targetHitByHerbs', { herbs: tg.herbs.join('、') })}
              >
                <span className="font-medium">{tg.name}</span>
                <span className="ml-1.5 text-caption opacity-75">
                  {t('ai.formula.generateTab.targetHitCount', { count: tg.herbCount })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 各药材靶点（共享靶点高亮） */}
      <div className="space-y-2">
        <h4 className="text-caption font-semibold text-primary">
          {t('ai.formula.generateTab.perHerbTargets')}
        </h4>
        <div className="space-y-2">
          {herbs.map((herb) => (
            <div key={herb.name} className="rounded-lg bg-muted/40 p-2.5">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="font-semibold text-body-sm">{herb.name}</span>
                <span className="text-caption text-muted-foreground">
                  {t('ai.formula.generateTab.compoundsCount', { count: herb.compoundCount })} · {t('ai.formula.generateTab.targetsCount', { count: herb.targetCount })}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {herb.targets.slice(0, 12).map((tgName) => {
                  const tg = network.targets.find((x) => x.name === tgName)
                  const shared = tg?.isShared
                  return (
                    <span
                      key={tgName}
                      className={`rounded border px-1.5 py-0.5 text-caption ${
                        shared
                          ? 'border-accent-300 bg-accent-50 text-accent-700 dark:bg-accent-300/20 dark:text-accent-300 font-medium'
                          : 'border-border bg-background text-muted-foreground'
                      }`}
                    >
                      {tgName}
                    </span>
                  )
                })}
                {herb.targets.length > 12 && (
                  <span className="text-caption text-muted-foreground">
                    {t('ai.formula.generateTab.moreCount', { count: herb.targets.length - 12 })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MechanismNetworkPanel
