// User roles and permissions
export const ROLES = {
  admin: {
    canAddVehicles: true,
    canApprove: true,
    canMoveAnyStage: true,
    canEditAnyField: true,
    canImport: true,
    canReject: true,
    canSeeFullPipeline: true,
  },
  recon_manager: {
    canAddVehicles: true,
    canApprove: true,
    canMoveAnyStage: true,
    canEditAnyField: true,
    canImport: true,
    canReject: true,
    canSeeFullPipeline: true,
  },
  service: {
    canAddVehicles: false,
    canApprove: false,
    canMoveAnyStage: false,
    canEditAnyField: false,
    canImport: false,
    canReject: false,
    allowedStages: ['service_queue', 'service', 'parts_hold'],
    editableFields: ['cost_mechanical', 'cost_parts', 'engine', 'transmission'],
    canSeeFullPipeline: true,
  },
  detail: {
    canAddVehicles: false,
    canApprove: false,
    canMoveAnyStage: false,
    canEditAnyField: false,
    canImport: false,
    canReject: false,
    allowedStages: ['detail'],
    editableFields: ['cost_detail'],
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

// Workflow stages — kept intentionally short.
// All the legacy fine-grained stages (appraisal, service_queue, parts_hold,
// approval, vendor, inspection) collapse into in_service or detail and are
// represented as notes / bills on the card instead of separate columns.
export const STAGES = [
  { id: 'stock_in',  name: 'Stock In',   icon: '📋', maxDays: 1 },
  { id: 'in_service', name: 'In Service', icon: '🛠️', maxDays: 3 },
  { id: 'detail',    name: 'Detail',     icon: '✨', maxDays: 1 },
  { id: 'frontline', name: 'Frontline',  icon: '🏁', maxDays: null },
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

// ---------------------------------------------------------------------------
// Brand classification
//   domestic  -> GMC shop
//   import    -> Honda shop
//   high_end  -> do not recondition (flag + reject)
// ---------------------------------------------------------------------------
export const BRAND_CLASS = {
  // GM family (domestic)
  gmc: 'domestic', chevrolet: 'domestic', chevy: 'domestic', buick: 'domestic',
  cadillac: 'domestic', oldsmobile: 'domestic', pontiac: 'domestic',
  saturn: 'domestic', hummer: 'domestic',
  // Ford / Lincoln
  ford: 'domestic', lincoln: 'domestic', mercury: 'domestic',
  // Stellantis / Chrysler
  chrysler: 'domestic', dodge: 'domestic', jeep: 'domestic', ram: 'domestic',
  plymouth: 'domestic',
  // Tesla / Rivian (US-built, go to GMC shop)
  tesla: 'domestic', rivian: 'domestic',

  // Japanese / Korean imports
  honda: 'import', acura: 'import', toyota: 'import', lexus: 'import',
  nissan: 'import', infiniti: 'import', mazda: 'import', subaru: 'import',
  mitsubishi: 'import', suzuki: 'import', scion: 'import',
  hyundai: 'import', kia: 'import', genesis: 'import',
  // VW group non-premium
  volkswagen: 'import', vw: 'import',
  // MINI (treat as standard import service)
  mini: 'import',
  // Fiat
  fiat: 'import', alfa: 'import', 'alfa romeo': 'import',

  // High-end brands we DO NOT recondition
  audi: 'high_end', bmw: 'high_end', mercedes: 'high_end',
  'mercedes-benz': 'high_end', volvo: 'high_end',
  'range rover': 'high_end', 'land rover': 'high_end',
  jaguar: 'high_end', porsche: 'high_end', maserati: 'high_end',
  bentley: 'high_end', ferrari: 'high_end', lamborghini: 'high_end',
  'rolls-royce': 'high_end', 'rolls royce': 'high_end',
  'aston martin': 'high_end', 'aston-martin': 'high_end',
  mclaren: 'high_end', lotus: 'high_end', smart: 'high_end',
  saab: 'high_end',
}

// Human-readable list of brands we refuse
export const HIGH_END_BRANDS = Object.entries(BRAND_CLASS)
  .filter(([, c]) => c === 'high_end')
  .map(([k]) => k)

// Acquisition sources
export const ACQUISITION_SOURCES = {
  trade: 'Trade-In',
  auction: 'Auction',
  lease_return: 'Lease Return',
  purchase: 'Street Purchase',
  dealer_transfer: 'Dealer Transfer',
  wholesale: 'Wholesale Buy',
  other: 'Other',
}

// Recon cost categories (used for breakdown in edit modal + analytics)
export const COST_CATEGORIES = [
  { id: 'cost_mechanical', label: 'Mechanical', icon: '🛠️', color: '#6366f1' },
  { id: 'cost_body', label: 'Body / PDR', icon: '🔨', color: '#f59e0b' },
  { id: 'cost_detail', label: 'Detail', icon: '✨', color: '#22c55e' },
  { id: 'cost_parts', label: 'Parts', icon: '📦', color: '#3b82f6' },
  { id: 'cost_vendor', label: 'Vendor', icon: '🚐', color: '#8b5cf6' },
]

// Shops that bill us - used on the shop-bill entry form
export const BILL_SHOPS = {
  gmc: 'GMC Service',
  honda: 'Honda Service',
  pdr: 'PDR Guy',
  wheel_medic: 'Wheel Medic',
  key_guy: 'Key Guy',
  hubcap_jack: 'Hubcap Jack',
  body_shop: 'Body Shop',
  parts: 'Parts Dept',
  other: 'Other',
}

// Map shops to the default cost category they roll up to
export const SHOP_DEFAULT_CATEGORY = {
  gmc: 'mechanical',
  honda: 'mechanical',
  pdr: 'body',
  wheel_medic: 'vendor',
  key_guy: 'vendor',
  hubcap_jack: 'vendor',
  body_shop: 'body',
  parts: 'parts',
  other: 'mechanical',
}

// Categories for a shop bill (shorthand form of COST_CATEGORIES)
export const BILL_CATEGORIES = {
  mechanical: 'Mechanical',
  body: 'Body / PDR',
  detail: 'Detail',
  parts: 'Parts',
  vendor: 'Vendor',
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

// Target frontline turnaround (days from stock-in)
export const TARGET_FRONTLINE_DAYS = 5

// Final inspection checklist items
export const INSPECTION_CHECKLIST = [
  { id: 'exteriorClean', label: 'Exterior Clean' },
  { id: 'interiorClean', label: 'Interior Clean, No Odor' },
  { id: 'serviceVerified', label: 'Service Work Verified' },
  { id: 'keyFobsWorking', label: 'Key Fobs Working' },
  { id: 'floorMats', label: 'Floor Mats In Place' },
  { id: 'gasLevel', label: 'Gas Level Acceptable' },
  { id: 'ownerManual', label: "Owner's Manual Present" },
  { id: 'secondKey', label: 'Second Key (if applicable)' },
]

// Fields that get written to the audit log when edited
export const AUDITED_FIELDS = [
  'stock_number', 'year', 'make', 'model', 'trim', 'vin', 'mileage',
  'exterior_color', 'interior_color', 'grade', 'service_location',
  'estimated_cost', 'actual_cost', 'cost_mechanical', 'cost_body',
  'cost_detail', 'cost_parts', 'cost_vendor', 'priority', 'decision',
  'acquisition_source', 'acquisition_date', 'purchase_price',
  'asking_price', 'target_frontline_date', 'is_rejected', 'reject_reason',
  'engine', 'transmission', 'drivetrain', 'fuel_type', 'body_style',
]
