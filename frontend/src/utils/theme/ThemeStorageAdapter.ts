import type { CustomTheme } from '@/types/theme-mode'
import { validateThemeConfig } from '@/types/theme-mode'
import { logger } from '@/utils/safeLogger';


const STORAGE_KEY = 'rmfood_custom_themes'

class ThemeStorageAdapter {
  private themes = new Map<string, CustomTheme>()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw) as CustomTheme[]
        data.forEach((theme) => this.themes.set(theme.id, theme))
      }
    } catch (error) {
      logger.error('[ThemeStorageAdapter] Load failed:', error)
    }
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.themes.values())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      logger.error('[ThemeStorageAdapter] Save failed:', error)
    }
  }

  create(theme: Omit<CustomTheme, 'id' | 'createdAt' | 'updatedAt'>): CustomTheme {
    const now = Date.now()
    const newTheme: CustomTheme = {
      ...theme,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }

    if (!validateThemeConfig(newTheme.config)) {
      throw new Error('Invalid theme configuration')
    }

    this.themes.set(newTheme.id, newTheme)
    this.saveToStorage()
    return newTheme
  }

  read(id: string): CustomTheme | null {
    return this.themes.get(id) ?? null
  }

  update(id: string, partial: Partial<Pick<CustomTheme, 'name' | 'description' | 'config' | 'tags'>>): CustomTheme | null {
    const existing = this.themes.get(id)
    if (!existing) return null

    const updated: CustomTheme = {
      ...existing,
      ...partial,
      updatedAt: Date.now(),
    }

    if (partial.config && !validateThemeConfig(partial.config)) {
      throw new Error('Invalid theme configuration')
    }

    this.themes.set(id, updated)
    this.saveToStorage()
    return updated
  }

  delete(id: string): boolean {
    const existed = this.themes.has(id)
    if (existed) {
      this.themes.delete(id)
      this.saveToStorage()
    }
    return existed
  }

  list(): CustomTheme[] {
    return Array.from(this.themes.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  }
}

export const themeStorageAdapter = new ThemeStorageAdapter()
