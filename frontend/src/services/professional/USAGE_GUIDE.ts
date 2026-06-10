/**
 * TCM Service Usage Guide
 *
 * This document provides usage examples for the TCM (Traditional Chinese Medicine) API services.
 */

// ============================================
// 1. Basic Service Initialization
// ============================================

import { tcmService } from './tcmService'
import { logger } from '@/utils/safeLogger'

function initializeService() {
  tcmService.configure({
    apiBaseUrl: '/api/v1',
    timeout: 30000,
    retryAttempts: 3,
  })
}

// ============================================
// 2. Herb Search Examples
// ============================================

async function searchHerbs() {
  // Basic search
  const result = await tcmService.searchHerbs({
    keyword: '人参',
    page: 1,
    pageSize: 10,
  })

  // Advanced search with filters
  const filtered = await tcmService.searchHerbs({
    keyword: '清热解毒',
    category: '清热药',
    efficacy: ['清热解毒'],
    page: 1,
    pageSize: 20,
  })
}

// ============================================
// 3. Herb Detail Retrieval
// ============================================

async function getHerbDetails() {
  const herbId = 'TCM001'

  const detail = await tcmService.getHerbDetail(herbId)

  logger.log('Herb name:', detail.name)
  logger.log('Latin name:', detail.latinName)
  logger.log('Efficacy:', detail.efficacy)
}

// ============================================
// 4. Chemical Composition Analysis
// ============================================

async function analyzeChemicalComposition() {
  const herbId = 'TCM001'

  const chemistry = await tcmService.getHerbChemistry(herbId)

  chemistry.components.forEach(component => {
    logger.log(`${component.name}: ${component.content}%`)
  })
}

// ============================================
// 5. Network Analysis
// ============================================

async function analyzeNetworks() {
  const herbId = 'TCM001'

  const network = await tcmService.getHerbNetwork(herbId)

  logger.log('Target proteins:', network.targets.length)
  logger.log('Related herbs:', network.relatedHerbs)
}

// ============================================
// 6. Multi-herb Comparison
// ============================================

async function compareHerbs() {
  const herbIds = ['TCM001', 'TCM002', 'TCM003']

  const comparison = await tcmService.compareHerbs(herbIds)

  logger.log('Common components:', comparison.commonComponents)
  logger.log('Differences:', comparison.differences)
}

// ============================================
// 7. Mock Data Mode
// ============================================

function configureMockMode() {
  tcmService.enableMockMode(true)
  tcmService.setMockDelay(1000)
}

// ============================================
// 8. React Component Usage
// ============================================

function ReactComponentExample() {
  return null
}

// ============================================
// 9. Data Types
// ============================================

interface HerbDetail {
  id: string
  name: string
  latinName: string
  category: string
  efficacy: string[]
  description: string
}

interface ChemicalComponent {
  name: string
  content: number
  molecularFormula: string
}

export {
  initializeService,
  searchHerbs,
  getHerbDetails,
  analyzeChemicalComposition,
  analyzeNetworks,
  compareHerbs,
  configureMockMode,
}
