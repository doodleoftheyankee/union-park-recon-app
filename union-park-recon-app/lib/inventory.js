// -----------------------------------------------------------------------------
// CSV inventory import
//
// Dealership DMS exports (vAuto, HomeNet, Cox, Dealertrack, etc.) all use
// different column names. We auto-map common header variants into our schema,
// then let the user confirm and edit in a preview grid before committing.
// -----------------------------------------------------------------------------

import { enrichVehicle } from './intelligence'

// Map of canonical field -> accepted aliases (all normalized to lowercase,
// non-alphanumeric stripped).
const COLUMN_ALIASES = {
  stock_number: ['stock', 'stockno', 'stocknumber', 'stock#', 'inventoryid', 'invno'],
  vin: ['vin', 'vinnumber', 'fullvin'],
  year: ['year', 'modelyear', 'yr'],
  make: ['make', 'manufacturer', 'brand'],
  model: ['model', 'modelname'],
  trim: ['trim', 'trimlevel', 'series'],
  body_style: ['body', 'bodystyle', 'bodytype'],
  exterior_color: ['exteriorcolor', 'extcolor', 'color', 'exterior'],
  interior_color: ['interiorcolor', 'intcolor', 'interior'],
  mileage: ['mileage', 'miles', 'odometer', 'odo'],
  drivetrain: ['drivetrain', 'drive', 'drivetype'],
  fuel_type: ['fuel', 'fueltype'],
  transmission: ['transmission', 'trans'],
  engine: ['engine', 'enginedesc'],
  acquisition_source: ['source', 'acquisitionsource', 'acquiredfrom'],
  acquisition_date: ['acquired', 'acquisitiondate', 'dateacquired', 'stockindate', 'datein'],
  purchase_price: ['purchaseprice', 'cost', 'acv', 'bookvalue'],
  asking_price: ['price', 'askingprice', 'listprice', 'retailprice'],
  external_id: ['id', 'externalid', 'dmsid'],
}

const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Build reverse lookup: { normalizedHeader: canonicalField }
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

// Turn CSV text into an array of normalized, enriched vehicle objects.
export function importCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) return { headers: [], vehicles: [], unmapped: [] }
  const headers = rows[0]
  const headerMap = buildHeaderMap(headers)
  const unmapped = headers
    .map((h, i) => (headerMap[i] ? null : h))
    .filter(Boolean)

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
    return enrichVehicle(raw)
  }).filter((v) => v.stock_number || v.vin) // discard blanks

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
