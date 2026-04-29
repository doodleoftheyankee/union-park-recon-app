// -----------------------------------------------------------------------------
// CSV inventory import
//
// Dealership DMS exports (Reynolds, vAuto, HomeNet, Cox, Dealertrack, etc.)
// all use different column names and shapes. We auto-map common header
// variants into our schema, post-process the rows for things like the
// combined "Vehicle" column on Reynolds exports, then let the user confirm
// in a preview grid before committing.
// -----------------------------------------------------------------------------

import { enrichVehicle } from './intelligence'

// Map of canonical field -> accepted aliases (all normalized to lowercase,
// non-alphanumeric stripped).
const COLUMN_ALIASES = {
  stock_number: ['stock', 'stockno', 'stocknumber', 'stocknum', 'stockid', 'inventoryid', 'invno'],
  vin: ['vin', 'vinnumber', 'fullvin'],
  year: ['year', 'modelyear', 'yr'],
  make: ['make', 'manufacturer', 'brand'],
  model: ['model', 'modelname'],
  trim: ['trim', 'trimlevel', 'series'],
  body_style: ['body', 'bodystyle', 'bodytype', 'vehiclecategory', 'category'],
  exterior_color: ['exteriorcolor', 'extcolor', 'color', 'exterior'],
  interior_color: ['interiorcolor', 'intcolor', 'interior'],
  mileage: ['mileage', 'miles', 'odometer', 'odo'],
  drivetrain: ['drivetrain', 'drive', 'drivetype'],
  fuel_type: ['fuel', 'fueltype'],
  transmission: ['transmission', 'trans'],
  engine: ['engine', 'enginedesc'],
  acquisition_source: ['source', 'acquisitionsource', 'acquiredfrom', 'stocktype'],
  acquisition_date: ['acquired', 'acquisitiondate', 'dateacquired', 'stockindate', 'datein'],
  purchase_price: ['purchaseprice', 'cost', 'acv', 'bookvalue'],
  asking_price: ['price', 'askingprice', 'listprice', 'retailprice', 'publishedprice', 'internetprice', 'msrp'],
  external_id: ['id', 'externalid', 'dmsid'],
  // Special: combined make/model/trim column. Post-processed after parse.
  __vehicle: ['vehicle', 'description'],
  // Special: days-in-stock. Post-processed into acquisition_date.
  __age_days: ['age', 'daysinstock', 'daysinventory', 'days'],
}

const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

function buildHeaderMap(headers) {
  const map = {}
  const aliasIndex = {}
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const a of aliases) aliasIndex[normKey(a)] = canonical
  }
  headers.forEach((h, i) => {
    const k = normKey(h)
    if (aliasIndex[k]) map[i] = aliasIndex[k]
  })
  return map
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas inside quotes,
// escaped quotes, and \r\n / \n line endings).
export function parseCsv(text) {
  const rows = []
  let row = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else {
        cur += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(cur); cur = '' }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
      else if (ch === '\r') { /* swallow */ }
      else cur += ch
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.some((c) => c && c.trim().length))
}

// Split a combined "Make Model Trim..." string into 3 fields. We take the
// first whitespace-separated word as the make, the second as the model, and
// the rest as the trim. Works cleanly for every brand on Union Park's lot
// since none are 2-word makes (Honda, GMC, Buick, Chevrolet, Toyota, etc.).
function splitVehicleString(combined) {
  if (!combined) return null
  const parts = String(combined).trim().split(/\s+/)
  if (parts.length < 2) return null
  return {
    make: parts[0],
    model: parts[1],
    trim: parts.length > 2 ? parts.slice(2).join(' ') : null,
  }
}

// After cell-level parsing, do row-level fixups.
function postProcessRow(raw) {
  if (raw.__vehicle && (!raw.make || !raw.model)) {
    const split = splitVehicleString(raw.__vehicle)
    if (split) {
      raw.make ||= split.make
      raw.model ||= split.model
      raw.trim ||= split.trim
    }
  }
  delete raw.__vehicle

  if (raw.__age_days != null && !raw.acquisition_date) {
    const days = parseInt(String(raw.__age_days).replace(/[^0-9]/g, ''), 10)
    if (!Number.isNaN(days) && days >= 0) {
      const d = new Date()
      d.setDate(d.getDate() - days)
      raw.acquisition_date = d.toISOString().slice(0, 10)
    }
  }
  delete raw.__age_days

  return raw
}

// Turn CSV text into an array of normalized, enriched vehicle objects.
export function importCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) return { headers: [], vehicles: [], unmapped: [] }
  const headers = rows[0]
  const headerMap = buildHeaderMap(headers)
  const unmapped = headers
    .map((h, i) => (headerMap[i] ? null : h))
    .filter((h) => h && h.trim().length)

  const vehicles = rows.slice(1).map((r) => {
    const raw = {}
    r.forEach((cell, i) => {
      const field = headerMap[i]
      if (!field) return
      let value = cell?.trim()
      if (!value) return
      if (['year', 'mileage'].includes(field)) {
        value = parseInt(value.replace(/[^0-9-]/g, ''), 10) || null
      } else if (['purchase_price', 'asking_price'].includes(field)) {
        value = parseFloat(value.replace(/[^0-9.]/g, '')) || null
      } else if (field === 'vin') {
        value = value.toUpperCase().replace(/\s+/g, '')
      }
      raw[field] = value
    })
    postProcessRow(raw)
    return enrichVehicle(raw)
  }).filter((v) => v.stock_number && v.make && v.model)

  return { headers, headerMap, vehicles, unmapped }
}

// Convert in-app vehicles list to CSV for export
export function exportCsv(vehicles) {
  const cols = [
    'stock_number', 'year', 'make', 'model', 'trim', 'vin',
    'mileage', 'exterior_color', 'interior_color', 'grade',
    'service_location', 'stage', 'priority', 'estimated_cost',
    'actual_cost', 'purchase_price', 'asking_price',
    'origin_class', 'is_high_end', 'is_rejected', 'created_at',
  ]
  const esc = (v) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = cols.join(',')
  const body = vehicles.map((v) => cols.map((c) => esc(v[c])).join(',')).join('\n')
  return header + '\n' + body
}
