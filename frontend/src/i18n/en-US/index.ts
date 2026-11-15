/**
 * English locale bundle
 * Modular files (ai/common/nav/pages/*) merged into the translation namespace
 */
import { deepMerge } from '../utils'
import ai from './ai'
import common from './common'
import nav from './nav'
import dashboard from './pages/dashboard'
import formula from './pages/formula'
import batch from './pages/batch'
import experiment from './pages/experiment'
import stability from './pages/stability'
import document from './pages/document'
import doe from './pages/doe'
import compliance from './pages/compliance'
import labelCheck from './pages/labelCheck'
import ingredient from './pages/ingredient'
import label from './pages/label'
import agent from './pages/agent'
import peptide from './pages/peptide'
import academic from './pages/academic'
import workflow from './pages/workflow'
import regulations from './pages/regulations'
import terminology from './pages/terminology'
import database from './pages/database'
import analytics from './pages/analytics'
import integrations from './pages/integrations'
import notification from './pages/notification'
import auditLog from './pages/auditLog'
import organizations from './pages/organizations'
import userManagement from './pages/userManagement'
import settings from './pages/settings'
import whitelist from './pages/whitelist'
import landing from './pages/landing'
import experimentForm from './pages/experimentForm'
import experimentCalendar from './pages/experimentCalendar'
import experimentShare from './pages/experimentShare'
import experimentDetail from './pages/experimentDetail'

export default {
  translation: deepMerge(
    { ai },
    common,
    nav,
    { pages: deepMerge({}, dashboard, formula, batch, experiment, stability, document, doe, compliance, labelCheck, ingredient, label, agent, peptide, academic, workflow, regulations, terminology, database, analytics, integrations, notification, auditLog, organizations, userManagement, settings, whitelist, experimentForm, experimentCalendar, experimentShare, experimentDetail, landing) },
  ),
}