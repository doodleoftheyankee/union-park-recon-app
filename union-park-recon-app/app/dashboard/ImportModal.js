'use client'

import { useRef, useState } from 'react'
import { s } from './styles'
import { importCsv } from '@/lib/inventory'
import { classifyBrand } from '@/lib/intelligence'

export default function ImportModal({ onClose, onImport }) {
  const [result, setResult] = useState(null) // { vehicles, unmapped, fileName }
  const [stage, setStage] = useState('idle') // idle | review | importing | done
  const [progress, setProgress] = useState({ imported: 0, total: 0 })
  const [summary, setSummary] = useState(null)
  const fileRef = useRef(null)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = importCsv(text)
    if (!parsed.vehicles.length) {
      alert('No vehicles found. Make sure the CSV has at least stock number or VIN columns.')
      return
    }
    setResult({ ...parsed, fileName: file.name })
    setStage('review')
  }

  const counts = result ? result.vehicles.reduce((a, v) => {
    const c = v.origin_class || classifyBrand(v.make)
    a[c] = (a[c] || 0) + 1
    return a
  }, {}) : {}

  const handleImport = async () => {
    setStage('importing')
    setProgress({ imported: 0, total: result.vehicles.length })
    const sum = await onImport(result.vehicles, result.fileName, (n) => setProgress((p) => ({ ...p, imported: n })))
    setSummary(sum)
    setStage('done')
  }

  const toggleReject = (idx) => {
    setResult((r) => ({
      ...r,
      vehicles: r.vehicles.map((v, i) => i === idx ? { ...v, is_rejected: !v.is_rejected } : v),
    }))
  }

  const removeRow = (idx) => {
    setResult((r) => ({ ...r, vehicles: r.vehicles.filter((_, i) => i !== idx) }))
  }

  return (
    <div style={s.modal} onClick={stage === 'importing' ? undefined : onClose}>
      <div style={{ ...s.modalBox, maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}>
          <div style={s.modalTitle}>Bulk Import Inventory</div>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={s.modalBody}>
          {stage === 'idle' && (
            <>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
                Upload a CSV exported from your DMS (vAuto, HomeNet, Cox, Dealertrack, etc.).
                Columns are auto-detected — common names like <code>Stock</code>, <code>VIN</code>, <code>Year</code>,
                <code>Make</code>, <code>Model</code>, <code>Mileage</code>, <code>Color</code>, <code>Cost</code> all work.
              </div>
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

          {stage === 'review' && result && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <Badge label="Total rows" value={result.vehicles.length} color="#3b82f6" />
                <Badge label="Domestic → GMC" value={counts.domestic || 0} color="#22c55e" />
                <Badge label="Import → Honda" value={counts.import || 0} color="#3b82f6" />
                <Badge label="High-end (auto-reject)" value={counts.high_end || 0} color="#ef4444" />
                <Badge label="Unclassified" value={counts.unknown || 0} color="#f59e0b" />
              </div>

              {result.unmapped.length > 0 && (
                <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 10 }}>
                  Unmapped columns (ignored): {result.unmapped.join(', ')}
                </div>
              )}

              <div style={{ ...s.tableWrap, maxHeight: 400 }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Stock</th>
                      <th style={s.th}>Vehicle</th>
                      <th style={s.th}>Miles</th>
                      <th style={s.th}>Grade</th>
                      <th style={s.th}>Shop</th>
                      <th style={s.th}>Status</th>
                      <th style={s.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.vehicles.map((v, i) => (
                      <tr key={i} style={{ background: v.is_rejected ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                        <td style={s.td}><b>{v.stock_number || '—'}</b></td>
                        <td style={s.td}>{v.year || '?'} {v.make} {v.model}</td>
                        <td style={s.td}>{v.mileage ? v.mileage.toLocaleString() : '—'}</td>
                        <td style={s.td}>{v.grade}</td>
                        <td style={s.td}>{v.service_location === 'gmc' ? 'GMC' : v.service_location === 'honda' ? 'Honda' : '—'}</td>
                        <td style={s.td}>
                          {v.is_high_end ? <span style={{ color: '#ef4444', fontWeight: 600 }}>HIGH-END</span>
                            : v.is_rejected ? <span style={{ color: '#ef4444' }}>REJECT</span>
                              : <span style={{ color: '#22c55e' }}>OK</span>}
                        </td>
                        <td style={s.td}>
                          <button style={miniBtn} onClick={() => toggleReject(i)}>{v.is_rejected ? 'Un-reject' : 'Reject'}</button>
                          <button style={{ ...miniBtn, marginLeft: 4 }} onClick={() => removeRow(i)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={{ ...s.submitBtn, flex: 1, background: '#64748b' }} onClick={() => setStage('idle')}>
                  Back
                </button>
                <button style={{ ...s.submitBtn, flex: 2 }} onClick={handleImport}>
                  Import {result.vehicles.length} vehicles
                </button>
              </div>
            </>
          )}

          {stage === 'importing' && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 14, marginBottom: 14 }}>Importing {progress.imported} of {progress.total}…</div>
              <div style={{ ...s.bar, height: 10 }}><div style={s.barFill('#22c55e', (progress.imported / progress.total) * 100)} /></div>
            </div>
          )}

          {stage === 'done' && summary && (
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 22, marginBottom: 12 }}>✅ Import complete</div>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div><b>{summary.created}</b> new vehicles created</div>
                <div><b>{summary.updated}</b> existing vehicles updated</div>
                <div><b>{summary.rejected}</b> auto-flagged (high-end brands)</div>
                {summary.errors > 0 && <div style={{ color: '#ef4444' }}><b>{summary.errors}</b> errors</div>}
              </div>
              <button style={{ ...s.submitBtn, marginTop: 16 }} onClick={onClose}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
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
