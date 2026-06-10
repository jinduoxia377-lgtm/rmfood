import type { ThemeStyles } from '@/types/theme-mode'
import { logger } from '@/utils/safeLogger';


interface ThemeVersion {
  id: string
  timestamp: number
  summary: string
  snapshot: ThemeStyles
}

const MAX_VERSIONS = 10

export class VersionController {
  private versions: ThemeVersion[] = []
  private storageKey = 'rmfood_theme_versions'

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (raw) this.versions = JSON.parse(raw)
    } catch (error) {
      logger.error('[VersionController] Load failed:', error)
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.versions))
    } catch (error) {
      logger.error('[VersionController] Save failed:', error)
    }
  }

  createSnapshot(config: ThemeStyles, summary = 'Manual save'): ThemeVersion {
    const version: ThemeVersion = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      summary,
      snapshot: { ...config },
    }

    this.versions.unshift(version)

    if (this.versions.length > MAX_VERSIONS) {
      this.versions = this.versions.slice(0, MAX_VERSIONS)
    }

    this.saveToStorage()
    return version
  }

  rollback(versionId: string): ThemeStyles | null {
    const version = this.versions.find((v) => v.id === versionId)
    return version ? { ...version.snapshot } : null
  }

  getHistory(): ThemeVersion[] {
    return [...this.versions]
  }

  clear(): void {
    this.versions = []
    this.saveToStorage()
  }
}

export const versionController = new VersionController()
