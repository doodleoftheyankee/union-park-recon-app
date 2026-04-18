'use client'

import { useMemo, useState } from 'react'
import { s } from './styles'
import { STAGES, PRIORITY_FLAGS } from '@/lib/constants'
import {
  getTotalDays, getHoldingCost, isStageOverdue, formatTimeAgo,
  formatShortDate, formatMoney,
} from '@/lib/utils'
import {
  computeRisks, recommendActions, predictFrontlineDate, rollupCost,
} from '@/lib/intelligence'

export default function DetailModal({
  vehicle: v,
  notes,
  stageHistory,
  permissions,
  onClose,
  onAddNote,
  onMoveStage,
  onSetPriority,
  onPartsHold,
  onEdit,
  onApplyAction,
  onReject,
}) {
  const [newNote, setNewNote] = useState('')
  const [showParts, setShowParts] = useState(false)
  const [parts, setParts] = useState({ partName: '', partNumber: '', supplier: '', days: 2 })

  const vehicleNotes = notes || []
  const vehicleHistory = stageHistory || []
  const overdue = isStageOverdue(vehicleHistory, v.stage)
  const risks = useMemo(() => computeRisks(v, vehicleHistory, vehicleNotes), [v, vehicleHistory, vehicleNotes])
  const actions = useMemo(() => recommendActions(v, vehicleHistory), [v, vehicleHistory])
  const eta = predictFrontlineDate(v, vehicleHistory)
  const costRollup = rollupCost(v)

  const handleNote = () => {
    if (newNote.trim()) {
      onAddNote(v.id, newNote.trim())
      setNewNote('')
    }
  }

  const handlePartsHold = async () => {
    await onPartsHold(v.id, parts)
    setShowParts(false)
  }

  const canMove = (stageId) =>
    permissions.canMoveAnyStage || permissions.allowedStages?.includes(stageId)

  const handleWholesale = () => {
    const reason = prompt('Reason for wholesale?', v.reject_reason || '')
    if (reason == null) return
    onReject?.(v.id, reason)
    onClose()
  }

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={{ ...s.modalBox, maxWidth: 780 }} onClick={(e) => e.stopPropagation()}>
        <div style={s.detailHead}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <div style={s.detailTitle}>{v.year} {v.make} {v.model} {v.trim}</div>
                {v.priority && v.priority !== 'none' && (
                  <span style={{ background: PRIORITY_FLAGS[v.priority].color, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                    {PRIORITY_FLAGS[v.priority].icon} {PRIORITY_FLAGS[v.priority].label}
                  </span>
                )}
                {v.is_high_end && <span style={{ background: '#ef4444', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>HIGH-END</span>}
                {v.is_rejected && !v.is_high_end && <span style={{ background: '#f59e0b', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>REJECTED</span>}
                {overdue && <span style={{ background: '#ef4444', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>⚠️ OVERDUE</span>}
              </div>
              <div style={s.detailMeta}>
                <span>Stock: {v.stock_number}</span>
                {v.vin && <span>VIN: {v.vin}</span>}
                {v.mileage && <span>{v.mileage.toLocaleString()} mi</span>}
                <span style={s.gradeBadge(v.grade)}>Grade {v.grade}</span>
                <span>{v.service_location === 'gmc' ? '🔧 GMC' : v.service_location === 'honda' ? '🔧 Honda' : '⚠️ unassigned'}</span>
                {v.exterior_color && <span>{v.exterior_color}{v.interior_color ? ` / ${v.interior_color}` : ''}</span>}
                {eta && <span style={{ color: '#22c55e' }}>ETA: {formatShortDate(eta)}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {permissions.canEditAnyField && (
                <button style={{ padding: '6px 12px', background: '#3b82f6', border: 'none', borderRadius: 4, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={onEdit}>
                  ✎ Edit
                </button>
              )}
              <button style={s.closeBtn} onClick={onClose}>×</button>
            </div>
          </div>
        </div>

        {(risks.length > 0 || actions.length > 0) && (
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {risks.map((r, i) => (
              <div key={i} style={{
                padding: 8, marginBottom: 6, borderRadius: 5, fontSize: 12,
                background: r.level === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                borderLeft: `3px solid ${r.level === 'high' ? '#ef4444' : '#f59e0b'}`,
              }}>
                <b>{r.level === 'high' ? '⚠️' : '⚠'} {r.label}</b>
                <span style={{ color: '#94a3b8', marginLeft: 8 }}>{r.why}</span>
              </div>
            ))}
            {actions.map((a, i) => (
              <div key={i} style={{
                padding: 8, marginBottom: 6, borderRadius: 5, fontSize: 12,
                background: 'rgba(34,197,94,0.1)', borderLeft: '3px solid #22c55e',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div><b>💡 {a.label}</b><span style={{ color: '#94a3b8', marginLeft: 8 }}>{a.why}</span></div>
                {a.payload && permissions.canEditAnyField && (
                  <button style={{ padding: '4px 10px', background: '#22c55e', border: 'none', borderRadius: 4, color: 'white', fontSize: 11, cursor: 'pointer' }} onClick={() => onApplyAction(v.id, a)}>
                    Apply
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={s.priSection}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5, textTransform: 'uppercase' }}>Priority</div>
          <div style={s.priBtns}>
            {Object.entries(PRIORITY_FLAGS).map(([k, f]) => (
              <button key={k} style={s.priBtn(k, v.priority === k)} onClick={() => onSetPriority(v.id, k)}>
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>

        {showParts && (
          <div style={{ padding: '0 18px 12px' }}>
            <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid #3b82f6', borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Add Parts Hold</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <input style={s.input} placeholder="Part Name" value={parts.partName} onChange={(e) => setParts((p) => ({ ...p, partName: e.target.value }))} />
                <input style={s.input} placeholder="Part Number" value={parts.partNumber} onChange={(e) => setParts((p) => ({ ...p, partNumber: e.target.value }))} />
                <input style={s.input} placeholder="Supplier" value={parts.supplier} onChange={(e) => setParts((p) => ({ ...p, supplier: e.target.value }))} />
                <select style={s.input} value={parts.days} onChange={(e) => setParts((p) => ({ ...p, days: parseInt(e.target.value) }))}>
                  <option value={1}>1 day</option><option value={2}>2 days</option>
                  <option value={3}>3 days</option><option value={5}>5 days</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button style={s.actionBtn(false)} onClick={() => setShowParts(false)}>Cancel</button>
                <button style={s.actionBtn(true, '#3b82f6')} onClick={handlePartsHold}>Move to Parts Hold</button>
              </div>
            </div>
          </div>
        )}

        <div style={s.notesSection}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>Communication Log ({vehicleNotes.length})</div>
          <div style={s.notesList}>
            {vehicleNotes.map((n) => (
              <div key={n.id} style={s.noteItem(n.note_type)}>
                <div style={s.noteText}>{n.text}</div>
                <div style={s.noteMeta}>{n.created_by_name} • {formatTimeAgo(n.created_at)}</div>
              </div>
            ))}
            {vehicleNotes.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: '#64748b', fontSize: 11 }}>No notes yet</div>}
          </div>
          <div style={s.addNoteForm}>
            <input style={{ ...s.input, flex: 1 }} placeholder="Add a note…" value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleNote()} />
            <button style={s.actionBtn(true)} onClick={handleNote}>Add</button>
          </div>
        </div>

        <div style={s.timelineGrid}>
          {STAGES.map((st) => {
            const h = vehicleHistory.find((x) => x.stage === st.id)
            const active = v.stage === st.id
            const complete = h?.exited_at != null
            const days = h ? Math.round((new Date(h.exited_at || new Date()) - new Date(h.entered_at)) / 86400000 * 10) / 10 : 0
            const od = active && st.maxDays && days > st.maxDays
            return (
              <div key={st.id} style={s.timelineItem(active, complete, od)}>
                <div style={{ fontSize: 12 }}>{st.icon}</div>
                <div style={{ fontSize: 9, fontWeight: 600 }}>{st.name}</div>
                {h && <div style={{ fontSize: 8, color: od ? '#ef4444' : '#64748b' }}>{days > 0 ? `${days}d` : '<1d'}{complete && ' ✓'}</div>}
              </div>
            )
          })}
        </div>

        <div style={s.costBar}>
          <div><div style={s.costLabel}>Total Days</div><div style={{ ...s.costVal, color: getTotalDays(v.created_at) > 5 ? '#ef4444' : '#22c55e' }}>{getTotalDays(v.created_at)}</div></div>
          <div><div style={s.costLabel}>Est. Cost</div><div style={s.costVal}>{formatMoney(v.estimated_cost)}</div></div>
          <div><div style={s.costLabel}>Actual</div><div style={{ ...s.costVal, color: (v.actual_cost || costRollup) > v.estimated_cost ? '#f59e0b' : '#22c55e' }}>{formatMoney(v.actual_cost || costRollup)}</div></div>
          <div><div style={s.costLabel}>Holding</div><div style={{ ...s.costVal, color: '#ef4444' }}>{formatMoney(getHoldingCost(v.created_at))}</div></div>
        </div>

        {(permissions.canMoveAnyStage || permissions.allowedStages?.length > 0) && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Move to stage
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
              {STAGES.map((st) => {
                const isCurrent = v.stage === st.id
                const allowed = canMove(st.id)
                return (
                  <button
                    key={st.id}
                    disabled={isCurrent || !allowed}
                    onClick={() => { onMoveStage(v.id, st.id); onClose() }}
                    style={{
                      padding: '8px 10px',
                      background: isCurrent ? 'rgba(59,130,246,0.25)' : allowed ? 'rgba(15,23,42,0.8)' : 'rgba(15,23,42,0.4)',
                      border: `1px solid ${isCurrent ? '#3b82f6' : allowed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}`,
                      borderRadius: 5,
                      color: isCurrent ? '#93c5fd' : allowed ? 'white' : '#475569',
                      fontSize: 11, fontWeight: 600,
                      cursor: isCurrent || !allowed ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                    }}
                    title={!allowed ? "You don't have permission for this stage" : isCurrent ? 'Current stage' : `Move to ${st.name}`}
                  >
                    {st.icon} {st.name}{isCurrent ? ' • current' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={s.actionBar}>
          {v.stage === 'service' && !showParts && canMove('service') && (
            <button style={s.actionBtn(false)} onClick={() => setShowParts(true)}>📦 Parts Hold</button>
          )}
          {v.stage === 'parts_hold' && canMove('service') && (
            <button style={s.actionBtn(true)} onClick={() => onMoveStage(v.id, 'service', 'Parts received')}>✓ Parts Received</button>
          )}
          {v.stage === 'approval' && permissions.canApprove && (
            <>
              <button style={s.actionBtn(false, '#f59e0b')} onClick={handleWholesale}>Flag Wholesale</button>
              <button style={s.actionBtn(true)} onClick={() => onMoveStage(v.id, v.vendors?.length ? 'vendor' : 'detail')}>✓ Approve</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
