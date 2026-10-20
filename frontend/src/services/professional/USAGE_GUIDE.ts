/**
 * TCM Service Usage Guide
 *
 * This document provides usage examples for the TCM (Traditional Chinese Medicine) API services.
 */

// ============================================
// 1. Basic Service Initialization
// ============================================

import tcmService from './tcmService';
import { logger } from '@/utils/safeLogger';

async function searchHerbs() {
  // Basic search
  await tcmService.searchHerbs({
    keyword: '人参',
    page: 1,
    pageSize: 10,
  });

  // Advanced search with filters
  await tcmService.searchHerbs({
    keyword: '人参',
    page: 1,
    pageSize: 20,
  });
}

// ============================================
// 3. Herb Detail Retrieval
// ============================================

async function getHerbDetails() {
  const herbId = 'TCM001';

  const detail = await tcmService.getHerbById(herbId);

  if (detail) {
    logger.log('Herb name:', detail.name);
    logger.log('Latin name:', detail.latinName);
  }
}

// ============================================
// 4. Chemical Composition Analysis
// ============================================

async function analyzeChemicalComposition() {
  const herbId = 'TCM001';

  const chemistry = await tcmService.getHerbCompounds(herbId);

  chemistry.compounds.forEach((component) => {
    logger.log(`${component.name}: ${component.molecularWeight}`);
  });
}

// ============================================
// 5. Network Analysis
// ============================================

async function analyzeNetworks() {
  const herbId = 'TCM001';

  const network = await tcmService.getHerbNetwork(herbId);

  logger.log('Target proteins:', network.nodes.length);
  logger.log('Related edges:', network.edges.length);
}

// ============================================
// 6. Multi-herb Comparison
// ============================================

async function compareHerbs() {
  const herbIds = ['TCM001', 'TCM002', 'TCM003'];

  const herbs = await Promise.all(herbIds.map((id) => tcmService.getHerbById(id)));
  const validHerbs = herbs.filter((h): h is NonNullable<typeof h> => h !== null);

  logger.log(
    'Common components:',
    validHerbs.map((h) => h.chemistry.name),
  );
  logger.log(
    'Differences:',
    validHerbs.map((h) => h.properties.nature),
  );
}

// ============================================
// 8. Data Types
// ============================================

export { searchHerbs, getHerbDetails, analyzeChemicalComposition, analyzeNetworks, compareHerbs };
