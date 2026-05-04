// -----------------------------------------------------------------------------
// CSV inventory import
//
// Dealership DMS exports (Reynolds, vAuto, HomeNet, Cox, Dealertrack, etc.)
// all use different column names and shapes. We auto-map common header
// variants into our schema, post-process the rows for things like the
// combined "Vehicle" column on Reynolds exports, then let the user confirm
// (and override) the mapping in a preview grid before committing.
//
// Public surface:
//   parseCsv(text)                            -> raw 2D string array
//   detectHeaderMap(headers)                  -> { byIndex, fuzzyByIndex }
//   buildVehiclesFromRows(headers, rows, map) -> { vehicles, unmapped }
//   importCsv(text)                           -> one-shot wrapper (back-compat)
//   exportCsv(vehicles)                       -> CSV string for download
// -----------------------------------------------------------------------------

import { enrichVehicle } from './intelligence'

// Map of canonical field -> accepted aliases (all normalized to lowercase,
// non-alphanumeric stripped). Aliases are checked exactly first; if no exact
// alias matches we fall back to substring containment against the same list.
//
// Keep aliases generous — the cost of a false positive (one wrong column
// mapped) is small because the user gets to override in the UI, while a
// false negative ("my CSV doesn't import") is the bug we're trying to kill.
const COLUMN_ALIASES = {
  stock_number: [
    'stock', 'stockno', 'stocknumber', 'stocknum', 'stockid', 'stk', 'stknum',
    'stknumber', 'inventoryid', 'invno', 'invnumber', 'unitno', 'unitnumber',
    'vehicleno', 'vehiclenumber', 'serialnumber',
  ],
  vin: ['vin', 'vinnumber', 'fullvin', 'vinno', 'vehicleidnumber'],
  year: ['year', 'modelyear', 'yr', 'vehicleyear'],
  make: ['make', 'manufacturer', 'brand', 'vehiclemake', 'mfg'],
  model: ['model', 'modelname', 'vehiclemodel'],
  trim: ['trim', 'trimlevel', 'series', 'package', 'trimpackage', 'modeltrim'],
  body_style: [
    'body', 'bodystyle', 'bodytype', 'vehiclecategory', 'category',
    'style', 'segment',
  ],
  exterior_color: [
    'exteriorcolor', 'extcolor', 'extercolor', 'color', 'exterior',
    'extcolour', 'exteriorcolour', 'colour', 'paint', 'paintcolor',
  ],
  interior_color: [
    'interiorcolor', 'intcolor', 'interior', 'interiorcolour', 'intcolour',
  ],
  mileage: [
    'mileage', 'miles', 'odometer', 'odo', 'odometerreading', 'mi',
    'currentmileage', 'milesonodometer',
  ],
  drivetrain: ['drivetrain', 'drive', 'drivetype', 'driveline', 'wheeldrive'],
  fuel_type: ['fuel', 'fueltype', 'fuelkind'],
  transmission: ['transmission', 'trans', 'transtype'],
  engine: ['engine', 'enginedesc', 'enginedescription', 'enginetype'],
  acquisition_source: [
    'source', 'acquisitionsource', 'acquiredfrom', 'stocktype',
    'inventorysource', 'inventorytype', 'sourcetype',
  ],
  acquisition_date: [
    'acquired', 'acquisitiondate', 'dateacquired', 'stockindate', 'datein',
    'instockdate', 'inventorydate', 'dateadded', 'dateinventoried',
    'stockdate', 'inservicedate', 'inservice',
  ],
  purchase_price: [
    'purchaseprice', 'cost', 'acv', 'bookvalue', 'unitcost', 'totalcost',
    'invoice', 'invoiceamount', 'wholesale', 'wholesalecost',
  ],
  asking_price: [
    'price', 'askingprice', 'listprice', 'retailprice', 'publishedprice',
    'internetprice', 'msrp', 'sellingprice', 'webprice', 'onlineprice',
    'sticker', 'stickerprice', 'advertisedprice',
  ],
  external_id: ['externalid', 'dmsid', 'recordid', 'rowid'],
  // Special: combined "Year Make Model Trim" column. Post-processed.
  __vehicle: ['vehicle', 'vehicledescription', 'vehicledesc', 'unitdescription', 'unit', 'description', 'fulldescription', 'yearmakemodel', 'ymm'],
  // Special: days-in-stock. Post-processed into acquisition_date.
  __age_days: ['age', 'daysinstock', 'daysinventory', 'days', 'daysonlot', 'dis', 'doi'],
}

// Human-friendly labels for the canonical fields, used in the mapping UI.
export const FIELD_LABELS = {
  stock_number: 'Stock #',
  vin: 'VIN',
  year: 'Year',
  make: 'Make',
  model: 'Model',
  trim: 'Trim',
  body_style: 'Body style',
  exterior_color: 'Exterior color',
  interior_color: 'Interior color',
  mileage: 'Mileage',
  drivetrain: 'Drivetrain',
  fuel_type: 'Fuel type',
  transmission: 'Transmission',
  engine: 'Engine',
  acquisition_source: 'Acquisition source',
  acquisition_date: 'Stock-in date',
  purchase_price: 'Purchase price',
  asking_price: 'Asking price',
  external_id: 'External ID',
  __vehicle: 'Combined "Year Make Model" column',
  __age_days: 'Days in stock',
}

// Field order for the mapping dropdown.
export const MAPPABLE_FIELDS = [
  'stock_number', 'vin', 'year', 'make', 'model', 'trim', '__vehicle',
  'body_style', 'exterior_color', 'interior_color', 'mileage', 'drivetrain',
  'fuel_type', 'transmission', 'engine', 'acquisition_source',
  'acquisition_date', '__age_days', 'purchase_price', 'asking_price',
  'external_id',
]

const REQUIRED_FIELDS = ['stock_number']

// Headers like "Model #" or "VIN 6" carry an identifier number, NOT the
// thing the field is supposedly named after. If the original header ends
// with a `#` or trailing digit/space, we refuse to map it onto a "name"
// field — those columns hold values like "Civic" or "CR-V", never "375274".
// (`stock_number`, `vin`, `external_id` etc. are not in this set because
// for those fields a number IS the value.)
const NAME_FIELDS = new Set([
  'make', 'model', 'trim', 'engine', 'transmission', 'drivetrain',
  'fuel_type', 'body_style', 'exterior_color', 'interior_color',
  'acquisition_source',
])

const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Trailing `#`, `no`, `number`, or a trailing standalone digit signals
// "this is an identifier" — e.g. "Model #", "Photo No", "VIN 6".
const HEADER_LOOKS_LIKE_ID = (header) => {
  if (!header) return false
  const trimmed = String(header).trim().toLowerCase()
  if (trimmed.endsWith('#')) return true
  if (/\b(no|number|num|id)\.?$/.test(trimmed)) return true
  // "VIN 6" -> trailing standalone digit
  if (/\s\d+$/.test(trimmed)) return true
  return false
}

// Build alias index once. exactIndex maps normKey(alias) -> canonical.
const ALIAS_EXACT = {}
const ALIAS_LIST = [] // [{ key, canonical, len }] for fuzzy contains
for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
  for (const a of aliases) {
    const k = normKey(a)
    if (!k) continue
    // First alias to claim a key wins (avoids "id" overwriting things)
    if (!(k in ALIAS_EXACT)) ALIAS_EXACT[k] = canonical
    ALIAS_LIST.push({ key: k, canonical, len: k.length })
  }
}
// Longest aliases first so contains-match prefers more specific matches.
ALIAS_LIST.sort((a, b) => b.len - a.len)

// Map a single header string to a canonical field, or null. Returns
// { canonical, mode } where mode is 'exact' or 'fuzzy'.
//
// Fuzzy matching is bidirectional: a header like "Asking" matches the
// "askingprice" alias because one contains the other. This handles the
// common case of dealers shortening their column names.
//
// We refuse to map "ID-shaped" headers (anything ending in #, "No", a
// trailing digit, etc.) onto NAME_FIELDS — that's how Reynolds gets
// "Model #" mapped to `model` and clobbers the actual model name with
// a part-number.
export function detectField(header) {
  const k = normKey(header)
  if (!k) return null
  const idShaped = HEADER_LOOKS_LIKE_ID(header)
  if (ALIAS_EXACT[k]) {
    const canonical = ALIAS_EXACT[k]
    if (idShaped && NAME_FIELDS.has(canonical)) return null
    return { canonical, mode: 'exact' }
  }
  for (const { key, canonical } of ALIAS_LIST) {
    if (key.length < 3 || k.length < 3) continue // avoid noise like "yr"
    if (idShaped && NAME_FIELDS.has(canonical)) continue
    if (k.includes(key) || key.includes(k)) return { canonical, mode: 'fuzzy' }
  }
  return null
}

// Detect a header map for a row of headers. Returns:
//   { byIndex: { i: canonical }, modes: { i: 'exact'|'fuzzy'|null } }
// First column to claim a canonical field wins so duplicates don't clobber.
export function detectHeaderMap(headers) {
  const byIndex = {}
  const modes = {}
  const claimed = new Set()
  // First pass: exact matches.
  headers.forEach((h, i) => {
    const det = detectField(h)
    if (det && det.mode === 'exact' && !claimed.has(det.canonical)) {
      byIndex[i] = det.canonical
      modes[i] = 'exact'
      claimed.add(det.canonical)
    }
  })
  // Second pass: fuzzy matches that don't conflict with exacts.
  headers.forEach((h, i) => {
    if (i in byIndex) return
    const det = detectField(h)
    if (det && !claimed.has(det.canonical)) {
      byIndex[i] = det.canonical
      modes[i] = det.mode
      claimed.add(det.canonical)
    } else {
      modes[i] = null
    }
  })
  return { byIndex, modes }
}

// Look at the first non-empty line and pick whichever of `,`, `;`, `\t`
// shows up most. Defaults to comma. Quoted regions are ignored when
// counting so embedded commas in vehicle descriptions don't fool us.
function detectDelimiter(text) {
  const firstLine = text.split(/\r\n|\r|\n/).find((l) => l.trim().length) || ''
  const counts = { ',': 0, ';': 0, '\t': 0 }
  let inQuotes = false
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i]
    if (ch === '"') {
      if (inQuotes && firstLine[i + 1] === '"') { i++; continue }
      inQuotes = !inQuotes
    } else if (!inQuotes && ch in counts) counts[ch]++
  }
  let best = ','
  for (const k of Object.keys(counts)) if (counts[k] > counts[best]) best = k
  return best
}

// Minimal RFC-4180-ish CSV parser. Handles quoted fields, separators inside
// quotes, escaped doubled-quotes, and \r\n / \n / \r line endings. Auto-
// detects comma / semicolon / tab as the delimiter (some DMS exports and
// European Excels use ; or \t).
export function parseCsv(text, delimiter) {
  if (text == null) return []
  text = String(text)
  // Strip BOM if present (Excel exports often add one).
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const sep = delimiter || detectDelimiter(text)
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
      else if (ch === sep) { row.push(cur); cur = '' }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
      else if (ch === '\r') {
        // CR or CRLF — push row, swallow following \n if present
        row.push(cur); rows.push(row); row = []; cur = ''
        if (text[i + 1] === '\n') i++
      } else cur += ch
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.some((c) => c && c.trim().length))
}

// Split a combined "Year Make Model Trim..." string into pieces. Handles:
//   "2023 Honda CR-V EX"        -> { year: 2023, make: 'Honda', model: 'CR-V', trim: 'EX' }
//   "Honda CR-V EX"             -> { make: 'Honda', model: 'CR-V', trim: 'EX' }
//   "Land Rover Range Rover"    -> { make: 'Land Rover', model: 'Range Rover' }
function splitVehicleString(combined) {
  if (!combined) return null
  let s = String(combined).trim()
  if (!s) return null
  const out = {}

  // Leading 4-digit year? Strip it.
  const ym = s.match(/^(\d{4})\s+(.*)$/)
  if (ym) { out.year = parseInt(ym[1], 10); s = ym[2] }

  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length < 1) return out

  // Two-word makes we recognize. Detect them up front so "Land Rover
  // Discovery" doesn't get split as make=Land, model=Rover.
  const TWO_WORD_MAKES = [
    'land rover', 'range rover', 'rolls royce', 'rolls-royce',
    'aston martin', 'aston-martin', 'alfa romeo',
  ]
  const lower = parts.join(' ').toLowerCase()
  const matched = TWO_WORD_MAKES.find((m) => lower.startsWith(m))
  if (matched) {
    out.make = parts.slice(0, 2).join(' ')
    if (parts.length >= 3) out.model = parts[2]
    if (parts.length >= 4) out.trim = parts.slice(3).join(' ')
    return out
  }

  out.make = parts[0]
  if (parts.length >= 2) out.model = parts[1]
  if (parts.length >= 3) out.trim = parts.slice(2).join(' ')
  return out
}

// Coerce a raw cell string into the right type for a canonical field.
function coerceCell(field, raw) {
  if (raw == null) return null
  let value = String(raw).trim()
  if (!value) return null
  if (['year', 'mileage'].includes(field)) {
    return parseInt(value.replace(/[^0-9-]/g, ''), 10) || null
  }
  if (['purchase_price', 'asking_price'].includes(field)) {
    return parseFloat(value.replace(/[^0-9.]/g, '')) || null
  }
  if (field === 'vin') {
    return value.toUpperCase().replace(/\s+/g, '')
  }
  if (field === 'acquisition_date') {
    // Accept anything Date can parse; emit YYYY-MM-DD. Fall through to raw
    // string if Date doesn't understand it (e.g. weird DMS shapes).
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return value
  }
  if (field === 'stock_number' || field === 'external_id') {
    // Preserve leading zeros and dashes as-is.
    return value
  }
  return value
}

// After cell-level parsing, apply row-level fixups for the special fields.
function postProcessRow(raw) {
  if (raw.__vehicle) {
    const split = splitVehicleString(raw.__vehicle)
    if (split) {
      raw.year = raw.year || split.year || null
      raw.make = raw.make || split.make || null
      raw.model = raw.model || split.model || null
      raw.trim = raw.trim || split.trim || null
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

// Build vehicle objects from already-parsed rows + a header map. The header
// map can come from auto-detection or be overridden by the UI.
//
//   headers: array of header strings (used only for the unmapped report)
//   rows:    array of cell-arrays (data rows, NOT including the header row)
//   headerMap: { columnIndex: canonical_field }
//
// Returns { vehicles, unmapped, dropped } where:
//   vehicles - enriched vehicle objects, ready to render in the preview
//   unmapped - header strings that didn't get assigned to any field
//   dropped  - count of rows skipped because they had no stock_number
//
// One bad row (exotic unicode, weird date, whatever blows up enrichVehicle)
// never kills the whole batch — we log it and skip it instead.
export function buildVehiclesFromRows(headers, rows, headerMap) {
  const safeHeaders = Array.isArray(headers) ? headers : []
  const safeRows = Array.isArray(rows) ? rows : []
  const safeMap = headerMap || {}

  const unmapped = safeHeaders
    .map((h, i) => ((i in safeMap) ? null : h))
    .filter((h) => h && String(h).trim().length)

  let dropped = 0
  const vehicles = []
  for (const r of safeRows) {
    if (!Array.isArray(r)) { dropped++; continue }
    try {
      const raw = {}
      r.forEach((cell, i) => {
        const field = safeMap[i]
        if (!field) return
        const v = coerceCell(field, cell)
        if (v == null) return
        raw[field] = v
      })
      postProcessRow(raw)
      const enriched = enrichVehicle(raw)
      const ok = REQUIRED_FIELDS.every((f) => enriched[f] != null && enriched[f] !== '')
      if (!ok) { dropped++; continue }
      vehicles.push(enriched)
    } catch (err) {
      console.warn('CSV import: row skipped', err, r)
      dropped++
    }
  }

  return { vehicles, unmapped, dropped }
}

// One-shot wrapper: text -> { headers, rows, headerMap, modes, vehicles, unmapped, dropped }.
// Old callers that only used { vehicles, unmapped } still work.
export function importCsv(text) {
  const allRows = parseCsv(text)
  if (allRows.length < 2) {
    return {
      headers: [], rows: [], headerMap: {}, modes: {},
      vehicles: [], unmapped: [], dropped: 0,
    }
  }
  const headers = allRows[0]
  const rows = allRows.slice(1)
  const { byIndex, modes } = detectHeaderMap(headers)
  const { vehicles, unmapped, dropped } = buildVehiclesFromRows(headers, rows, byIndex)
  return { headers, rows, headerMap: byIndex, modes, vehicles, unmapped, dropped }
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
