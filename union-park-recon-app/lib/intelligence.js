// -----------------------------------------------------------------------------
// Intelligence layer
//
// Pure functions that turn raw vehicle data into recommendations:
//   - classifyBrand(make) -> 'domestic' | 'import' | 'high_end' | 'unknown'
//   - routeServiceLocation(make) -> 'gmc' | 'honda' | null
//   - isHighEnd(make) -> boolean
//   - suggestGrade({ mileage, year, estimated_cost }) -> 'A'|'B'|'C'|'D'
//   - predictFrontlineDate(vehicle, stageHistory) -> Date
//   - computeRisks(vehicle, stageHistory, notes) -> array of { level, label, why }
//   - recommendActions(vehicle, stageHistory) -> array of { action, label, why }
//   - decodeVin(vin) -> { year, country, wmiRegion } (offline best-effort)
// -----------------------------------------------------------------------------

import { BRAND_CLASS, STAGES, TARGET_FRONTLINE_DAYS, GRADES } from './constants'
import { getTotalDays, getCurrentStageDays } from './utils'

const norm = (s) => (s || '').toString().trim().toLowerCase()

export function classifyBrand(make) {
  const key = norm(make)
  if (!key) return 'unknown'
  if (BRAND_CLASS[key]) return BRAND_CLASS[key]
  // try first word (e.g. "Land Rover Discovery")
  const first = key.split(/\s+/)[0]
  if (BRAND_CLASS[first]) return BRAND_CLASS[first]
  // multi-word brand keys
  for (const brand of Object.keys(BRAND_CLASS)) {
    if (brand.includes(' ') && key.startsWith(brand)) return BRAND_CLASS[brand]
  }
  return 'unknown'
}

export function isHighEnd(make) {
  return classifyBrand(make) === 'high_end'
}

// GMC shop takes domestics; Honda shop takes imports.
// High-end returns null (should not be reconditioned).
export function routeServiceLocation(make) {
  const c = classifyBrand(make)
  if (c === 'domestic') return 'gmc'
  if (c === 'import') return 'honda'
  return null
}

// Grade heuristic: factors age, mileage, and any estimated cost typed in.
// Can be overridden manually; this is only a suggestion.
export function suggestGrade({ mileage, year, estimated_cost }) {
  const cost = Number(estimated_cost) || 0
  const mi = Number(mileage) || 0
  const age = year ? Math.max(0, new Date().getFullYear() - Number(year)) : 0

  // cost drives grade strongest
  if (cost >= GRADES.D.maxCost || cost >= 1700) return 'D'
  if (cost >= 1200) return 'C'
  if (cost >= 500) return 'B'
  if (cost > 0) return 'A'

  // fall back to age + mileage
  if (age >= 8 || mi >= 110000) return 'D'
  if (age >= 5 || mi >= 75000) return 'C'
  if (age >= 3 || mi >= 40000) return 'B'
  return 'A'
}

// When will the vehicle realistically be frontline-ready?
// Sums remaining maxDays of remaining stages and adds a small buffer.
export function predictFrontlineDate(vehicle, stageHistory = []) {
  if (!vehicle) return null
  if (vehicle.stage === 'frontline') return vehicle.frontline_at || null

  const idx = STAGES.findIndex((s) => s.id === vehicle.stage)
  if (idx < 0) return null

  let daysRemaining = 0
  // remaining time in current stage
  const cur = STAGES[idx]
  const spent = getCurrentStageDays(stageHistory, vehicle.stage)
  const curLeft = Math.max(0, (cur.maxDays || 1) - spent)
  daysRemaining += curLeft

  for (let i = idx + 1; i < STAGES.length; i++) {
    const st = STAGES[i]
    if (st.id === 'frontline') break
    if (st.id === 'parts_hold') continue // only if flagged
    if (st.id === 'approval') continue // only if flagged
    if (st.id === 'vendor' && !(vehicle.vendors && vehicle.vendors.length)) continue
    daysRemaining += st.maxDays || 1
  }
  if (vehicle.stage === 'parts_hold') daysRemaining += 1 // buffer
  const eta = new Date()
  eta.setDate(eta.getDate() + Math.ceil(daysRemaining))
  return eta
}

// Risk surfacing - prioritized list, empty = healthy vehicle
export function computeRisks(vehicle, stageHistory = [], notes = []) {
  const risks = []
  if (!vehicle) return risks
  const totalDays = getTotalDays(vehicle.created_at)
  const stageDays = getCurrentStageDays(stageHistory, vehicle.stage)
  const stage = STAGES.find((s) => s.id === vehicle.stage)

  if (vehicle.is_high_end) {
    risks.push({
      level: 'high',
      label: 'High-end brand',
      why: `${vehicle.make} is on the do-not-recondition list`,
    })
  }
  if (vehicle.is_rejected) {
    risks.push({
      level: 'high',
      label: 'Flagged for wholesale',
      why: vehicle.reject_reason || 'Marked as rejected from retail',
    })
  }
  if (vehicle.stage !== 'frontline' && totalDays > TARGET_FRONTLINE_DAYS) {
    risks.push({
      level: totalDays > TARGET_FRONTLINE_DAYS * 2 ? 'high' : 'med',
      label: 'Aging unit',
      why: `${Math.round(totalDays)}d since stock-in (target ${TARGET_FRONTLINE_DAYS}d)`,
    })
  }
  if (stage?.maxDays && stageDays > stage.maxDays) {
    risks.push({
      level: stageDays > stage.maxDays * 2 ? 'high' : 'med',
      label: `Stuck in ${stage.name}`,
      why: `${stageDays}d in stage, max ${stage.maxDays}d`,
    })
  }
  const budget = Number(vehicle.estimated_cost) || 0
  const actual = Number(vehicle.actual_cost) || rollupCost(vehicle)
  if (budget > 0 && actual > budget * 1.1) {
    risks.push({
      level: actual > budget * 1.25 ? 'high' : 'med',
      label: 'Over budget',
      why: `$${actual.toLocaleString()} actual vs $${budget.toLocaleString()} estimate`,
    })
  }
  if (vehicle.stage === 'parts_hold' && stageDays > 2) {
    risks.push({
      level: 'med',
      label: 'Parts taking long',
      why: `${stageDays}d waiting for parts`,
    })
  }
  if (vehicle.priority === 'sold' && totalDays > 2) {
    risks.push({
      level: 'high',
      label: 'Sold unit stalling',
      why: `Customer waiting, ${Math.round(totalDays)}d in recon`,
    })
  }
  return risks
}

// Roll up category costs if no actual_cost set
export function rollupCost(v) {
  if (!v) return 0
  return (
    (Number(v.cost_mechanical) || 0) +
    (Number(v.cost_body) || 0) +
    (Number(v.cost_detail) || 0) +
    (Number(v.cost_parts) || 0) +
    (Number(v.cost_vendor) || 0)
  )
}

// Recommend next action given state
export function recommendActions(vehicle, stageHistory = []) {
  const out = []
  if (!vehicle) return out

  if (vehicle.stage === 'appraisal' && !vehicle.grade) {
    out.push({ action: 'assign_grade', label: 'Assign grade', why: 'Unaged appraisal' })
  }
  if (!vehicle.service_location && !vehicle.is_high_end) {
    const loc = routeServiceLocation(vehicle.make)
    if (loc) {
      out.push({
        action: 'auto_route',
        label: `Auto-route to ${loc === 'gmc' ? 'GMC' : 'Honda'} shop`,
        why: `${vehicle.make} is ${classifyBrand(vehicle.make)}`,
        payload: { service_location: loc },
      })
    }
  }
  if (isHighEnd(vehicle.make) && !vehicle.is_rejected) {
    out.push({
      action: 'flag_highend',
      label: 'Flag as high-end (wholesale)',
      why: `${vehicle.make} is on the do-not-recondition list`,
    })
  }
  if (vehicle.stage === 'approval' && !vehicle.estimated_cost) {
    out.push({ action: 'set_estimate', label: 'Set cost estimate', why: 'Needed before approval' })
  }
  return out
}

// Light VIN validation + country lookup (first char)
export function decodeVin(vin) {
  if (!vin || vin.length !== 17) return { valid: false }
  const c = vin[0].toUpperCase()
  const country =
    'ABCDEFGH'.includes(c) ? 'Africa' :
    'JKLMNPR'.includes(c) ? 'Asia' :
    'STUVWZ'.includes(c) ? 'Europe' :
    '12345'.includes(c) ? 'North America' :
    '67'.includes(c) ? 'Oceania' :
    '89'.includes(c) ? 'South America' : 'Unknown'
  // Year code (10th character) - simplified table
  const yearChar = vin[9].toUpperCase()
  const yearMap = {
    A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016,
    H: 2017, J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023,
    R: 2024, S: 2025, T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
    1: 2001, 2: 2002, 3: 2003, 4: 2004, 5: 2005, 6: 2006, 7: 2007,
    8: 2008, 9: 2009,
  }
  return {
    valid: /^[A-HJ-NPR-Z0-9]{17}$/.test(vin),
    country,
    year: yearMap[yearChar] || null,
  }
}

// Build a full "enrichment" block for a raw row (CSV import / manual entry)
export function enrichVehicle(raw) {
  const make = raw.make
  const classification = classifyBrand(make)
  const highEnd = classification === 'high_end'
  const suggested_service = highEnd ? null : routeServiceLocation(make)
  const suggested_grade = raw.grade || suggestGrade(raw)
  return {
    ...raw,
    origin_class: classification,
    is_high_end: highEnd,
    is_rejected: raw.is_rejected || highEnd,
    reject_reason: highEnd
      ? (raw.reject_reason || `${make} is on the do-not-recondition list`)
      : raw.reject_reason || null,
    service_location: raw.service_location || suggested_service || null,
    grade: suggested_grade,
  }
}
