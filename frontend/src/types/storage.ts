/**
 * 数据持久化类型定义
 * 用于 IndexedDB 存储和数据同步
 */

export interface TasteProfile {
  sweetness: number
  bitterness: number
  astringency: number
  umami: number
}

export interface BudgetRange {
  min: number
  max: number
}

export interface StoredUserPreference {
  frequentEffects: string[]
  favoriteIngredients: string[]
  tasteProfile: TasteProfile
  safetyLevel: number
  budgetRange: BudgetRange
  lastUpdated: number
}

export interface StoredGenerationHistory {
  id: string
  effects: string[]
  ingredients: string[]
  scores: {
    synergy: number
    taste: number
    stability: number
    overall: number
  }
  generator: string
  createdAt: number
  liked?: boolean
}

export interface StoredFormulaVersion {
  id: string
  formulaId: string
  versionNumber: number
  data: StoredFormulaData
  createdAt: number
  remark: string
  parentId?: string
  createdBy?: number
}

export interface StoredFormulaData {
  name: string
  effects: string[]
  ingredients: {
    name: string
    dosage: string
    role: string
  }[]
  scores: {
    synergy: number
    taste: number
    stability: number
    overall: number
  }
  composition?: Record<string, unknown>
  processingMethod?: string
  dosage?: string
  storageConditions?: string
  shelfLife?: number
}

export interface StoredShareData {
  shareId: string
  formulaData: StoredFormulaData
  permission: 'public' | 'private' | 'password'
  passwordHash?: string
  expiresAt?: number
  viewCount: number
  createdAt: number
  createdBy?: number
}

export interface SyncMetadata {
  lastSyncTime: number
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline'
  pendingChanges: number
  lastError?: string
  version: number
}

export interface ConflictResolution {
  conflictId: string
  localData: StoredFormulaVersion | StoredShareData
  remoteData: StoredFormulaVersion | StoredShareData
  conflictType: 'version' | 'delete' | 'concurrent'
  timestamp: number
  resolved: boolean
  resolution?: 'local' | 'remote' | 'merge' | 'manual'
  mergedData?: StoredFormulaVersion | StoredShareData
}

export interface SyncQueueItem {
  id: string
  type: 'create' | 'update' | 'delete'
  entityType: 'formula' | 'version' | 'share' | 'preference'
  entityId: string
  data: unknown
  timestamp: number
  retryCount: number
  maxRetries: number
}

export interface DatabaseSchema {
  name: string
  version: number
  stores: {
    name: string
    keyPath: string
    indexes: { name: string; keyPath: string; unique: boolean }[]
  }[]
}

export const DATABASE_CONFIG: DatabaseSchema = {
  name: 'rmfood_database',
  version: 1,
  stores: [
    {
      name: 'user_preferences',
      keyPath: 'id',
      indexes: [{ name: 'lastUpdated', keyPath: 'lastUpdated', unique: false }],
    },
    {
      name: 'generation_history',
      keyPath: 'id',
      indexes: [
        { name: 'createdAt', keyPath: 'createdAt', unique: false },
        { name: 'liked', keyPath: 'liked', unique: false },
      ],
    },
    {
      name: 'formula_versions',
      keyPath: 'id',
      indexes: [
        { name: 'formulaId', keyPath: 'formulaId', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false },
      ],
    },
    {
      name: 'share_data',
      keyPath: 'shareId',
      indexes: [
        { name: 'createdAt', keyPath: 'createdAt', unique: false },
        { name: 'expiresAt', keyPath: 'expiresAt', unique: false },
      ],
    },
    {
      name: 'sync_queue',
      keyPath: 'id',
      indexes: [
        { name: 'timestamp', keyPath: 'timestamp', unique: false },
        { name: 'entityType', keyPath: 'entityType', unique: false },
      ],
    },
    {
      name: 'sync_metadata',
      keyPath: 'id',
      indexes: [],
    },
    {
      name: 'conflicts',
      keyPath: 'conflictId',
      indexes: [{ name: 'resolved', keyPath: 'resolved', unique: false }],
    },
  ],
}

export interface DataMigration {
  fromVersion: number
  toVersion: number
  migrate: (db: IDBDatabase) => Promise<void>
}

export const DATA_MIGRATIONS: DataMigration[] = []
