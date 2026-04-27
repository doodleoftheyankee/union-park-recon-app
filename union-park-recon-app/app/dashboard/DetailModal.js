'use client'

import { useState } from 'react'
import { s } from './styles'
import { STAGES, PRIORITY_FLAGS, BILL_SHOPS, BILL_CATEGORIES, SHOP_DEFAULT_CATEGORY } from '@/lib/constants'
import {
  getTotalDays, getHoldingCost, isStageOverdue, formatTimeAgo, formatMoney,
} from '@/lib/utils'

export default function DetailModal({
  vehicle: v,
  notes,
  stageHistory,
  bills,
  permissions,
  onClose,
  onAddNote,
  onMoveStage,
  onSetPriority,
  onEdit,
  onReject,
  onAddBill,
  onDeleteBill,
}) {
  const [newNote, setNewNote] = useState('')
  const [showBillForm, setShowBillForm] = useState(false)
  const [bill, setBill] = useState({
    shop: 'gmc', category: 'mechanical', invoice_number: '', description: '',
    amount: '', billed_on: new Date().toISOString().slice(0, 10),
  })

  const vehicleNotes = notes || []
  const vehicleHistory = stageHistory || []
  const vehicleBills = bills || []
  const billsTotal = vehicleBills.reduce((a, b) => a + (Number(b.amount) || 0), 0)
  const overdue = isStageOverdue(vehicleHistory, v.stage)

  const canMove = (stageId) =>
    permissions.canMoveAnyStage || permissions.allowedStages?.includes(stageId)

  const handleNote = () => {
    if (newNote.trim()) {
      onAddNote(v.id, newNote.trim())
      setNewNote('')
    }
  }

  const handleWholesale = () => {
    const reason = prompt('Reason for wholesale?', v.reject_reason || '')
    if (reason == null) return
    onReject?.(v.id, reason)
    onClose()
  }

  const handleSaveBill = async () => {
    const amt = parseFloat(bill.amount)
    if (!amt || amt <= 0) { alert('Enter a valid dollar amount'); return }
    await onAddBill?.(v.id, {
      ...bill,
      amount: amt,
      shop: bill.shop || 'other',
      category: bill.category || SHOP_DEFAULT_CATEGORY[bill.shop] || 'mechanical',
    })
    setBill({ shop: 'gmc', category: 'mechanical', invoice_number: '', description: '', amount: '', billed_on: new Date().toISOString().slice(0, 10) })
    setShowBillForm(false)
  }

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={{ ...s.modalBox, maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.detailHead}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <div style={s.detailTitle}>{v.year} {v.make} {v.model}</div>
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
                <span>#{v.stock_number}</span>
                {v.mileage && <span>{v.mileage.toLocaleString()} mi</span>}
                <span style={s.gradeBadge(v.grade)}>Grade {v.grade}</span>
                <span>{v.service_location === 'gmc' ? '🔧 GMC' : v.service_location === 'honda' ? '🔧 Honda' : '⚠️ unassigned'}</span>
                {v.exterior_color && <span>{v.exterior_color}</span>}
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

        {/* Stage buttons */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stage</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 6 }}>
            {STAGES.map((st) => {
              const isCurrent = v.stage === st.id
              const allowed = canMove(st.id)
              return (
                <button
                  key={st.id}
                  disabled={isCurrent || !allowed}
                  onClick={() => { onMoveStage(v.id, st.id); onClose() }}
                  style={{
                    padding: '10px',
                    background: isCurrent ? 'rgba(34,197,94,0.25)' : allowed ? 'rgba(15,23,42,0.8)' : 'rgba(15,23,42,0.4)',
                    border: `1px solid ${isCurrent ? '#22c55e' : allowed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 6,
                    color: isCurrent ? '#86efac' : allowed ? 'white' : '#475569',
                    fontSize: 12, fontWeight: 600,
                    cursor: isCurrent || !allowed ? 'default' : 'pointer',
                  }}
                >
                  {st.icon} {st.name}{isCurrent ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
        </div>

        {/* Priority */}
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

        {/* Cost summary */}
        <div style={{ padding: '12px 18px', background: 'rgba(15,23,42,0.5)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div><div style={s.costLabel}>Days</div><div style={{ ...s.costVal, color: getTotalDays(v) > 5 ? '#ef4444' : '#22c55e' }}>{getTotalDays(v)}</div></div>
          <div><div style={s.costLabel}>Estimate</div><div style={s.costVal}>{formatMoney(v.estimated_cost)}</div></div>
          <div><div style={s.costLabel}>Spent</div><div style={{ ...s.costVal, color: billsTotal > v.estimated_cost ? '#f59e0b' : '#22c55e' }}>{formatMoney(billsTotal || v.actual_cost)}</div></div>
          <div><div style={s.costLabel}>Holding</div><div style={{ ...s.costVal, color: '#ef4444' }}>{formatMoney(getHoldingCost(v))}</div></div>
        </div>

        {/* Shop bills */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
              Shop Bills ({vehicleBills.length}) — {formatMoney(billsTotal)}
            </div>
            {permissions.canEditAnyField && !showBillForm && (
              <button
                style={{ padding: '4px 10px', background: '#22c55e', border: 'none', borderRadius: 4, color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setShowBillForm(true)}
              >
                + Add Bill
              </button>
            )}
          </div>

          {vehicleBills.length > 0 && (
            <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
              {vehicleBills.map((b) => (
                <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '6px 8px', background: 'rgba(15,23,42,0.6)', borderRadius: 5, marginBottom: 4, fontSize: 11, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {BILL_SHOPS[b.shop] || b.shop} <span style={{ color: '#64748b', fontWeight: 400 }}>· {BILL_CATEGORIES[b.category] || b.category}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      {b.invoice_number && `Inv #${b.invoice_number} · `}
                      {b.billed_on ? new Date(b.billed_on).toLocaleDateString() : ''}
                      {b.description && ` · ${b.description}`}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{formatMoney(b.amount)}</div>
                  {permissions.canEditAnyField && (
                    <button
                      style={{ padding: '2px 8px', background: 'transparent', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 4, color: '#fca5a5', fontSize: 10, cursor: 'pointer' }}
                      onClick={() => { if (confirm('Delete this bill?')) onDeleteBill?.(b.id, v.id) }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {showBillForm && (
            <div style={{ padding: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={s.label}>Shop</label>
                  <select style={s.input} value={bill.shop} onChange={(e) => setBill((p) => ({ ...p, shop: e.target.value, category: SHOP_DEFAULT_CATEGORY[e.target.value] || p.category }))}>
                    {Object.entries(BILL_SHOPS).map(([k, v2]) => <option key={k} value={k}>{v2}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Category</label>
                  <select style={s.input} value={bill.category} onChange={(e) => setBill((p) => ({ ...p, category: e.target.value }))}>
                    {Object.entries(BILL_CATEGORIES).map(([k, v2]) => <option key={k} value={k}>{v2}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Amount</label>
                  <input style={s.input} type="number" step="0.01" placeholder="0.00" value={bill.amount} onChange={(e) => setBill((p) => ({ ...p, amount: e.target.value }))} autoFocus />
                </div>
                <div>
                  <label style={s.label}>Billed on</label>
                  <input style={s.input} type="date" value={bill.billed_on} onChange={(e) => setBill((p) => ({ ...p, billed_on: e.target.value }))} />
                </div>
                <div>
                  <label style={s.label}>Invoice #</label>
                  <input style={s.input} value={bill.invoice_number} onChange={(e) => setBill((p) => ({ ...p, invoice_number: e.target.value }))} />
                </div>
                <div>
                  <label style={s.label}>Description</label>
                  <input style={s.input} value={bill.description} onChange={(e) => setBill((p) => ({ ...p, description: e.target.value }))} placeholder="Brakes, oil change, etc." />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={s.actionBtn(false)} onClick={() => setShowBillForm(false)}>Cancel</button>
                <button style={s.actionBtn(true)} onClick={handleSaveBill}>Save Bill</button>
              </div>
            </div>
          )}

          {!showBillForm && vehicleBills.length === 0 && (
            <div style={{ padding: 10, textAlign: 'center', color: '#64748b', fontSize: 11 }}>No bills yet</div>
          )}
        </div>

        {/* Notes */}
        <div style={s.notesSection}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>Notes ({vehicleNotes.length})</div>
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

        {/* Wholesale action */}
        {permissions.canReject && !v.is_rejected && (
          <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              style={{ width: '100%', padding: '10px', background: '#f59e0b', border: 'none', borderRadius: 5, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              onClick={handleWholesale}
            >
              Flag Wholesale
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
