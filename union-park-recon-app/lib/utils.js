import { STAGES, HOLDING_COST_PER_DAY, APPROVAL_THRESHOLDS } from './constants'

// Calculate days between two dates
export function getDaysBetween(startDate, endDate = new Date()) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end - start)
  const diffDays = diffTime / (1000 * 60 * 60 * 24)
  return Math.round(diffDays * 10) / 10
}

// Get total days vehicle has been in recon
export function getTotalDays(createdAt) {
  return getDaysBetween(createdAt)
}

// Get days in current stage
export function getCurrentStageDays(stageHistory, currentStage) {
  const currentEntry = stageHistory?.find(h => h.stage === currentStage && !h.exited_at)
  if (!currentEntry) return 0
  return getDaysBetween(currentEntry.entered_at)
}

// Check if vehicle is overdue in current stage
export function isStageOverdue(stageHistory, currentStage) {
  const stage = STAGES.find(s => s.id === currentStage)
  if (!stage || !stage.maxDays) return false
  return getCurrentStageDays(stageHistory, currentStage) > stage.maxDays
}

// Calculate holding cost
export function getHoldingCost(createdAt) {
  return Math.round(getTotalDays(createdAt) * HOLDING_COST_PER_DAY)
}

// Get approval level based on cost
export function getApprovalLevel(cost) {
  for (const threshold of APPROVAL_THRESHOLDS) {
    if (cost < threshold.max) {
      return threshold
    }
  }
  return APPROVAL_THRESHOLDS[APPROVAL_THRESHOLDS.length - 1]
}

// Format time ago
export function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Format date
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

// Get next stage in workflow
export function getNextStage(currentStage, hasVendors = false) {
  const stageOrder = STAGES.map(s => s.id)
  let currentIndex = stageOrder.indexOf(currentStage)
  
  if (currentIndex === -1) return null
  
  let nextIndex = currentIndex + 1
  
  // Skip parts_hold in normal flow (it's entered manually)
  if (stageOrder[nextIndex] === 'parts_hold') nextIndex++
  
  // Skip vendor if no vendors needed
  if (stageOrder[nextIndex] === 'vendor' && !hasVendors) nextIndex++
  
  if (nextIndex >= stageOrder.length) return null
  
  return STAGES.find(s => s.id === stageOrder[nextIndex])
}

// Check if user can move vehicle to stage
export function canUserMoveToStage(userRole, targetStage, permissions) {
  if (permissions.canMoveAnyStage) return true
  if (permissions.allowedStages?.includes(targetStage)) return true
  return false
}
