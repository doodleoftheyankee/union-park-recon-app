// User roles and permissions
export const ROLES = {
  admin: {
    canAddVehicles: true,
    canApprove: true,
    canMoveAnyStage: true,
    canSeeFullPipeline: true,
  },
  recon_manager: {
    canAddVehicles: true,
    canApprove: true,
    canMoveAnyStage: true,
    canSeeFullPipeline: true,
  },
  service: {
    canAddVehicles: false,
    canApprove: false,
    canMoveAnyStage: false,
    allowedStages: ['service_queue', 'service', 'parts_hold'],
    canSeeFullPipeline: true,
  },
  detail: {
    canAddVehicles: false,
    canApprove: false,
    canMoveAnyStage: false,
    allowedStages: ['detail'],
    canSeeFullPipeline: true,
  },
}

// Grade definitions
export const GRADES = {
  A: { label: 'Grade A', maxCost: 500, color: '#22c55e', desc: 'Detail only' },
  B: { label: 'Grade B', maxCost: 1200, color: '#3b82f6', desc: 'Under $1,200' },
  C: { label: 'Grade C', maxCost: 1700, color: '#f59e0b', desc: '$1,200-$1,700' },
  D: { label: 'Grade D', maxCost: 9999, color: '#ef4444', desc: '$1,700+' },
}

// Workflow stages
export const STAGES = [
  { id: 'appraisal', name: 'Appraisal', icon: '📋', maxDays: 1 },
  { id: 'decision', name: 'Trade Decision', icon: '⚖️', maxDays: 1 },
  { id: 'service_queue', name: 'Service Queue', icon: '🔧', maxDays: 1 },
  { id: 'service', name: 'In Service', icon: '🛠️', maxDays: 2 },
  { id: 'parts_hold', name: 'Parts Hold', icon: '📦', maxDays: 3 },
  { id: 'approval', name: 'Approval Needed', icon: '✋', maxDays: 1 },
  { id: 'vendor', name: 'Vendor Work', icon: '🚐', maxDays: 2 },
  { id: 'detail', name: 'Detail', icon: '✨', maxDays: 1 },
  { id: 'inspection', name: 'Final Inspection', icon: '🔍', maxDays: 1 },
  { id: 'frontline', name: 'Frontline Ready', icon: '🏁', maxDays: null },
]

// Priority flags
export const PRIORITY_FLAGS = {
  none: { label: 'Normal', color: '#64748b', icon: '' },
  sold: { label: 'SOLD - Rush', color: '#ef4444', icon: '🔴' },
  customer_waiting: { label: 'Customer Waiting', color: '#f59e0b', icon: '🟡' },
  hot_unit: { label: 'Hot Unit', color: '#8b5cf6', icon: '🟣' },
}

// Vendors and their schedules
export const VENDORS = {
  pdr: { name: 'PDR Guy', days: ['Monday', 'Thursday'] },
  keyGuy: { name: 'Key Guy', days: ['Tuesday'] },
  hubcap: { name: 'Hubcap Jack', days: ['Tuesday'] },
  wheelMedic: { name: 'Wheel Medic', days: ['Wednesday'] },
  bodyShop: { name: 'Body Shop', days: ['Any'] },
}

// Service locations
export const SERVICE_LOCATIONS = {
  gmc: { name: 'GMC Service', label: 'GMC (Domestics)' },
  honda: { name: 'Honda Service', label: 'Honda (Imports)' },
}

// Approval thresholds
export const APPROVAL_THRESHOLDS = [
  { max: 1200, approvers: [], label: 'Auto-Approved' },
  { max: 1500, approvers: ['Micah Molin'], label: '$1,200-$1,500' },
  { max: 1700, approvers: ['Micah Molin', 'Eric VanDyke'], label: '$1,500-$1,700' },
  { max: 2000, approvers: ['Eric VanDyke'], label: '$1,700-$2,000' },
  { max: Infinity, approvers: ['Eric VanDyke', 'Greg Lashbrook'], label: '$2,000+' },
]

// Daily holding cost
export const HOLDING_COST_PER_DAY = 32

// Final inspection checklist items
export const INSPECTION_CHECKLIST = [
  { id: 'exteriorClean', label: 'Exterior Clean' },
  { id: 'interiorClean', label: 'Interior Clean, No Odor' },
  { id: 'serviceVerified', label: 'Service Work Verified' },
  { id: 'keyFobsWorking', label: 'Key Fobs Working' },
  { id: 'floorMats', label: 'Floor Mats In Place' },
  { id: 'gasLevel', label: 'Gas Level Acceptable' },
  { id: 'ownerManual', label: 'Owner\'s Manual Present' },
  { id: 'secondKey', label: 'Second Key (if applicable)' },
]
