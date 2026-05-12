'use client'

import { Component, useMemo, useRef, useState } from 'react'
import { s } from './styles'
import {
  parseCsv, detectHeaderMap, buildVehiclesFromRows, decodeFileBytes,
  FIELD_LABELS, MAPPABLE_FIELDS,
} from '@/lib/inventory'
import { classifyBrand } from '@/lib/intelligence'

// Last-resort guard. If anything inside the modal throws during render despite
// the inline try/catches, this stops the failure from blowing up the whole
// dashboard and gives the user the actual error string + a way out.
class ImportErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('ImportModal render crashed', error, info) }
  render() {
    if (!this.state.error) return this.props.children
    const msg = this.state.error?.message || String(this.state.error)
    return (
      <div style={s.modal} onClick={this.props.onClose}>
        <div style={{ ...s.modalBox, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
          <div style={s.modalHead}>
            <div style={s.modalTitle}>Import — unexpected error</div>
            <button style={s.closeBtn} onClick={this.props.onClose}>×</button>
          </div>
          <div style={s.modalBody}>
            <div style={{ padding: 10, marginBottom: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>The import modal hit an error</div>
              <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 8 }}>{msg}</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>
                Open DevTools → Console for the full stack, then send the message above to support.
              </div>
            </div>
            <button style={s.submitBtn} onClick={this.props.onClose}>Close</button>
          </div>
        </div>
      </div>
    )
  }
}

function ImportModalInner({ onClose, onImport }) {
  // Stages: idle -> mapping -> review -> importing -> done
  const [stage, setStage] = useState('idle')
  const [fileName, setFileName] = useState(null)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [headerMap, setHeaderMap] = useState({})
  const [modes, setModes] = useState({})
  const [rejectedIdx, setRejectedIdx] = useState(() => new Set())
  const [removedIdx, setRemovedIdx] = useState(() => new Set())
  const [progress, setProgress] = useState({ imported: 0, total: 0 })
  const [summary, setSummary] = useState(null)
  const [parseError, setParseError] = useState(null)
  // Catches anything that throws while we're parsing / building the preview /
  // running the import so the whole page doesn't error out. Surfaces the real
  // message inline instead of letting it bubble up to the global Next.js
  // "Application error" overlay.
  const [runtimeError, setRuntimeError] = useState(null)
  const fileRef = useRef(null)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)
    setRuntimeError(null)
    try {
      const text = decodeFileBytes(await file.arrayBuffer())
      const allRows = parseCsv(text)
      if (allRows.length < 2) {
        setParseError(`Couldn't read this CSV — only found ${allRows.length} row${allRows.length === 1 ? '' : 's'}. Make sure it has a header row plus at least one vehicle.`)
        return
      }
      const hdr = allRows[0]
      const dataRows = allRows.slice(1)
      const detection = detectHeaderMap(hdr)
      setHeaders(hdr)
      setRows(dataRows)
      setHeaderMap(detection.byIndex)
      setModes(detection.modes)
      setFileName(file.name)

      // If everything important auto-detected with exact matches, skip the
      // mapping step and go straight to the preview — that's the old flow
      // most users expect. The mapping screen is only useful when something
      // didn't auto-resolve, in which case we still fall through to it.
      const fields = Object.values(detection.byIndex)
      const hasStock = fields.includes('stock_number')
      const hasVehicle = fields.includes('__vehicle') ||
        (fields.includes('make') && fields.includes('model'))
      const requiredAreExact = Object.entries(detection.byIndex)
        .filter(([, f]) => ['stock_number', 'make', 'model', '__vehicle'].includes(f))
        .every(([i]) => detection.modes[i] === 'exact')

      setStage(hasStock && hasVehicle && requiredAreExact ? 'review' : 'mapping')
    } catch (err) {
      console.error('Import: file read / parse failed', err)
      setParseError(`Failed to read file: ${err?.message || err}`)
    } finally {
      // Reset the input so the same file can be re-picked after a reset
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Recompute the preview vehicles from the current header map. Memoized so
  // edits to the mapping rebuild instantly without re-reading the file.
  // Per-row reject/remove from the review screen is layered on top so we
  // don't have to re-parse anything when the user toggles a row. We stash
  // the original (pre-filter) index on each vehicle as `_idx` so reject /
  // remove buttons keep working after rows above them get removed. The
  // _idx field is dropped by the dashboard's column sanitizer before the
  // row hits the database.
  //
  // Wrapped in try/catch — a single bad row in the CSV (weird date, exotic
  // unicode, whatever) shouldn't bring down the modal. We surface the error
  // in the UI instead.
  const preview = useMemo(() => {
    if (!rows.length || !headers.length) return null
    try {
      const built = buildVehiclesFromRows(headers, rows, headerMap)
      const vehicles = (built.vehicles || []).map((v, i) => ({
        ...(v || {}),
        _idx: i,
        is_rejected: rejectedIdx.has(i) ? true : (v && v.is_rejected),
        reject_reason: rejectedIdx.has(i)
          ? ((v && v.reject_reason) || 'Rejected during review')
          : (v && v.reject_reason),
      })).filter((v) => !removedIdx.has(v._idx))
      return { ...built, vehicles }
    } catch (err) {
      console.error('Import: building preview failed', err, { headers, headerMap, rowCount: rows.length })
      // Defer the state update so we don't setState during render.
      Promise.resolve().then(() => setRuntimeError(`Couldn't build preview: ${err?.message || err}`))
      return null
    }
  }, [headers, rows, headerMap, rejectedIdx, removedIdx])

  const claimed = useMemo(() => new Set(Object.values(headerMap)), [headerMap])

  const remap = (colIndex, field) => {
    setHeaderMap((m) => {
      const next = { ...m }
      // If another column already owns this field, free it.
      if (field) {
        for (const [k, v] of Object.entries(next)) {
          if (v === field && Number(k) !== colIndex) delete next[k]
        }
      }
      if (!field) delete next[colIndex]
      else next[colIndex] = field
      return next
    })
  }

  const counts = preview ? preview.vehicles.reduce((a, v) => {
    const c = (v && v.origin_class) || classifyBrand(v && v.make)
    a[c] = (a[c] || 0) + 1
    return a
  }, {}) : {}

  const hasStock = Object.values(headerMap).includes('stock_number')
  const hasMakeModel =
    (Object.values(headerMap).includes('make') && Object.values(headerMap).includes('model')) ||
    Object.values(headerMap).includes('__vehicle')

  const handleImport = async () => {
    if (!preview) return
    setRuntimeError(null)
    setStage('importing')
    setProgress({ imported: 0, total: preview.vehicles.length })
    try {
      const sum = await onImport(
        preview.vehicles,
        fileName,
        (n) => setProgress((p) => ({ ...p, imported: n })),
      )
      setSummary(sum || { created: 0, updated: 0, rejected: 0, errors: 0, errorDetails: [] })
      setStage('done')
    } catch (err) {
      console.error('Import: onImport callback threw', err)
      setRuntimeError(`Import failed: ${err?.message || err}`)
      setStage('mapping')
    }
  }

  const reset = () => {
    setStage('idle'); setFileName(null); setHeaders([]); setRows([])
    setHeaderMap({}); setModes({}); setSummary(null); setParseError(null)
    setRuntimeError(null)
    setRejectedIdx(new Set()); setRemovedIdx(new Set())
  }

  const toggleReject = (idx) => setRejectedIdx((prev) => {
    const next = new Set(prev)
    if (next.has(idx)) next.delete(idx); else next.add(idx)
    return next
  })
  const removeRow = (idx) => setRemovedIdx((prev) => {
    const next = new Set(prev)
    next.add(idx)
    return next
  })

  return (
    <div style={s.modal} onClick={stage === 'importing' ? undefined : onClose}>
      <div style={{ ...s.modalBox, maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}>
          <div style={s.modalTitle}>
            Bulk Import Inventory
            {fileName && <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>· {fileName}</span>}
          </div>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={s.modalBody}>
          {runtimeError && (
            <div style={{ padding: 10, marginBottom: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Something went wrong</div>
              <div style={{ marginBottom: 6 }}>{runtimeError}</div>
              <button
                style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: 'white', cursor: 'pointer' }}
                onClick={reset}
              >
                Start over
              </button>
            </div>
          )}

          {stage === 'idle' && (
            <>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
                Upload a CSV exported from your DMS (vAuto, HomeNet, Cox, Reynolds, Dealertrack, etc.).
                Column names are auto-detected — common headers like <code>Stock</code>, <code>VIN</code>, <code>Year</code>, <code>Make</code>, <code>Model</code>, <code>Mileage</code>, <code>Color</code>, <code>Cost</code> all work.
                On the next screen you can fix any column we missed before committing.
              </div>
              {parseError && (
                <div style={{ padding: 10, marginBottom: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>
                  {parseError}
                </div>
              )}
              <div
                style={{
                  padding: 30, borderRadius: 12, textAlign: 'center',
                  background: 'rgba(15,23,42,0.5)', border: '2px dashed rgba(255,255,255,0.2)', cursor: 'pointer',
                }}
                onClick={() => fileRef.current?.click()}
              >
                <div style={{ fontSize: 34, marginBottom: 10 }}>📂</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Click to choose CSV file</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>or drag & drop</div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFile} />
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>What happens on import:</div>
                <div>• Each row becomes a vehicle profile</div>
                <div>• Make is auto-classified (domestic → GMC, import → Honda, high-end → rejected)</div>
                <div>• Grade is suggested from mileage, year, and cost</div>
                <div>• Duplicate stock numbers are updated, not duplicated</div>
                <div>• You review and edit rows before committing</div>
              </div>
            </>
          )}

          {stage === 'mapping' && (
            <>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
                Step 1 of 2 — confirm how each column in your CSV maps to a vehicle field.
                Auto-detected matches are marked <span style={{ color: '#22c55e' }}>✓</span>;
                fuzzy matches that are likely-but-not-certain are marked <span style={{ color: '#f59e0b' }}>~</span>.
                Set anything we missed using the dropdown.
              </div>

              <div style={{ ...s.tableWrap, maxHeight: 320, marginBottom: 14 }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Your column</th>
                      <th style={s.th}>Sample value</th>
                      <th style={s.th}>Maps to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((h, i) => {
                      const field = headerMap[i] || ''
                      const mode = modes[i]
                      const sample = rows.find((r) => r[i] && String(r[i]).trim())?.[i]
                      return (
                        <tr key={i}>
                          <td style={s.td}>
                            <span style={{ fontWeight: 600 }}>{h || <em style={{ color: '#64748b' }}>(unnamed)</em>}</span>
                            {mode === 'exact' && <span style={{ marginLeft: 6, color: '#22c55e', fontSize: 11 }}>✓ matched</span>}
                            {mode === 'fuzzy' && <span style={{ marginLeft: 6, color: '#f59e0b', fontSize: 11 }}>~ guessed</span>}
                          </td>
                          <td style={{ ...s.td, color: '#94a3b8', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sample ? String(sample).slice(0, 80) : <em style={{ color: '#475569' }}>—</em>}
                          </td>
                          <td style={s.td}>
                            <select
                              style={{ ...s.input, padding: '5px 8px', minWidth: 200 }}
                              value={field}
                              onChange={(e) => remap(i, e.target.value)}
                            >
                              <option value="">(skip — don't import this column)</option>
                              {MAPPABLE_FIELDS.map((f) => (
                                <option key={f} value={f} disabled={claimed.has(f) && headerMap[i] !== f}>
                                  {FIELD_LABELS[f] || f}
                                  {claimed.has(f) && headerMap[i] !== f ? ' (used)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, fontSize: 12 }}>
                <Pill ok={hasStock}>Stock #</Pill>
                <Pill ok={hasMakeModel}>Make + Model {hasMakeModel ? '' : '(or combined Vehicle)'}</Pill>
                <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>
                  {headers.length} columns · {Object.keys(headerMap).length} mapped · {rows.length} data rows
                </span>
              </div>

              {!hasStock && (
                <div style={{ padding: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', borderRadius: 6, color: '#fca5a5', fontSize: 12, marginBottom: 12 }}>
                  Map one of your columns to <b>Stock #</b> — every vehicle needs one.
                </div>
              )}
              {hasStock && !hasMakeModel && (
                <div style={{ padding: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                  Map either separate <b>Make</b> + <b>Model</b> columns, or a combined <b>"Year Make Model"</b> column. We'll skip rows missing this on import.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...s.submitBtn, flex: 1, background: '#64748b' }} onClick={reset}>
                  Back
                </button>
                <button
                  style={{ ...s.submitBtn, flex: 2, opacity: hasStock && hasMakeModel ? 1 : 0.5, cursor: hasStock && hasMakeModel ? 'pointer' : 'not-allowed' }}
                  disabled={!hasStock || !hasMakeModel}
                  onClick={() => setStage('review')}
                >
                  Continue → Preview
                </button>
              </div>
            </>
          )}

          {stage === 'review' && preview && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <Badge label="Total rows" value={preview.vehicles.length} color="#3b82f6" />
                <Badge label="Domestic → GMC" value={counts.domestic || 0} color="#22c55e" />
                <Badge label="Import → Honda" value={counts.import || 0} color="#3b82f6" />
                <Badge label="High-end (auto-reject)" value={counts.high_end || 0} color="#ef4444" />
                <Badge label="Unclassified" value={counts.unknown || 0} color="#f59e0b" />
                {preview.dropped > 0 && (
                  <Badge label={`Dropped (no stock #)`} value={preview.dropped} color="#64748b" />
                )}
              </div>

              {preview.unmapped.length > 0 && (
                <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 10 }}>
                  Unmapped columns (skipped): {preview.unmapped.join(', ')}
                </div>
              )}

              <div style={{ ...s.tableWrap, maxHeight: 380 }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Stock</th>
                      <th style={s.th}>Vehicle</th>
                      <th style={s.th}>Miles</th>
                      <th style={s.th}>Color</th>
                      <th style={s.th}>Grade</th>
                      <th style={s.th}>Shop</th>
                      <th style={s.th}>Status</th>
                      <th style={s.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.vehicles.map((v, i) => (
                      <tr key={i} style={{ background: v.is_rejected ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                        <td style={s.td}><b>{v.stock_number || '—'}</b></td>
                        <td style={s.td}>{v.year || '?'} {v.make || '?'} {v.model || ''}{v.trim ? ` · ${v.trim}` : ''}</td>
                        <td style={s.td}>{v.mileage ? v.mileage.toLocaleString() : '—'}</td>
                        <td style={s.td}>{v.exterior_color || '—'}</td>
                        <td style={s.td}>{v.grade}</td>
                        <td style={s.td}>{v.service_location === 'gmc' ? 'GMC' : v.service_location === 'honda' ? 'Honda' : '—'}</td>
                        <td style={s.td}>
                          {v.is_high_end ? <span style={{ color: '#ef4444', fontWeight: 600 }}>HIGH-END</span>
                            : v.is_rejected ? <span style={{ color: '#ef4444' }}>REJECT</span>
                              : <span style={{ color: '#22c55e' }}>OK</span>}
                        </td>
                        <td style={s.td}>
                          <button style={miniBtn} onClick={() => toggleReject(v._idx)}>
                            {v.is_rejected ? 'Un-reject' : 'Reject'}
                          </button>
                          <button style={{ ...miniBtn, marginLeft: 4 }} onClick={() => removeRow(v._idx)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={{ ...s.submitBtn, flex: 1, background: '#64748b' }} onClick={() => setStage('mapping')}>
                  ← Back to mapping
                </button>
                <button style={{ ...s.submitBtn, flex: 2 }} onClick={handleImport}>
                  Import {preview.vehicles.length} vehicles
                </button>
              </div>
            </>
          )}

          {stage === 'importing' && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 14, marginBottom: 14 }}>Importing {progress.imported} of {progress.total}…</div>
              <div style={{ ...s.bar, height: 10 }}><div style={s.barFill('#22c55e', (progress.imported / Math.max(1, progress.total)) * 100)} /></div>
            </div>
          )}

          {stage === 'done' && summary && (
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 22, marginBottom: 12 }}>
                {summary.errors ? '⚠️ Import finished with errors' : '✅ Import complete'}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>
                <div><b>{summary.created}</b> new vehicles created</div>
                <div><b>{summary.updated}</b> existing vehicles updated</div>
                <div><b>{summary.rejected}</b> auto-flagged (high-end brands)</div>
                {summary.errors > 0 && <div style={{ color: '#ef4444' }}><b>{summary.errors}</b> rows failed</div>}
              </div>

              {summary.errorDetails && summary.errorDetails.length > 0 && (
                <>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>
                    Failures ({summary.errorDetails.length})
                  </div>
                  <div style={{ ...s.tableWrap, maxHeight: 280, marginBottom: 14 }}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>#</th>
                          <th style={s.th}>Stock</th>
                          <th style={s.th}>Vehicle</th>
                          <th style={s.th}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.errorDetails.map((e, i) => (
                          <tr key={i}>
                            <td style={s.td}>{e.row}</td>
                            <td style={s.td}>{e.stock}</td>
                            <td style={s.td}>{e.vehicle}</td>
                            <td style={{ ...s.td, color: '#ef4444', whiteSpace: 'normal' }}>{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
                    Tip: most failures are missing year / make / model. If a column was unmapped, go back and assign it on the mapping screen.
                  </div>
                </>
              )}

              <button style={s.submitBtn} onClick={onClose}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ImportModal(props) {
  return (
    <ImportErrorBoundary onClose={props.onClose}>
      <ImportModalInner {...props} />
    </ImportErrorBoundary>
  )
}

const miniBtn = {
  padding: '4px 8px', fontSize: 11, background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: 'white', cursor: 'pointer',
}

function Badge({ label, value, color }) {
  return (
    <div style={{ padding: '6px 12px', background: `${color}22`, border: `1px solid ${color}`, borderRadius: 6, fontSize: 11 }}>
      <span style={{ color: '#94a3b8' }}>{label}: </span>
      <b style={{ color }}>{value}</b>
    </div>
  )
}

function Pill({ ok, children }) {
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      border: `1px solid ${ok ? '#22c55e' : '#ef4444'}`,
      color: ok ? '#86efac' : '#fca5a5',
    }}>
      {ok ? '✓' : '×'} {children}
    </span>
  )
}
