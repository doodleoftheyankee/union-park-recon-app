'use client'

import { useState } from 'react'
import { s } from './styles'
import { GRADES } from '@/lib/constants'
import { estimateReconCosts } from '@/lib/intelligence'
import { formatMoney } from '@/lib/utils'

const FIELDS = [
  { key: 'stock_number',     label: 'Stock #',         type: 'text' },
  { key: 'acquisition_date', label: 'Stock-in date',   type: 'date' },
  { key: 'year',             label: 'Year',            type: 'number' },
  { key: 'make',             label: 'Make',            type: 'text' },
  { key: 'model',            label: 'Model',           type: 'text' },
  { key: 'mileage',          label: 'Mileage',         type: 'number' },
  { key: 'exterior_color',   label: 'Color',           type: 'text' },
  { key: 'vin',              label: 'VIN',             type: 'text', maxLength: 17, upper: true },
  { key: 'estimated_cost',   label: 'Estimated recon', type: 'number' },
  { key: 'actual_cost',      label: 'Actual recon',    type: 'number' },
]

const prepare = (v) => {
  const out = { ...v }
  if (out.acquisition_date) out.acquisition_date = String(out.acquisition_date).slice(0, 10)
  return out
}

export default function EditModal({ vehicle, onClose, onSave, onDelete, onReject, canDelete, canReject }) {
  const [form, setForm] = useState(prepare(vehicle))
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const applySuggestedEstimate = () => {
    const est = estimateReconCosts({
      grade: form.grade,
      mileage: form.mileage,
      year: form.year,
      total: Number(form.estimated_cost) || undefined,
    })
    setForm((p) => ({
      ...p,
      cost_mechanical: est.cost_mechanical,
      cost_body: est.cost_body,
      cost_detail: est.cost_detail,
      cost_parts: est.cost_parts,
      cost_vendor: est.cost_vendor,
      estimated_cost: Number(p.estimated_cost) || est.estimated_cost,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const handleReject = async () => {
    const reason = prompt('Reason for wholesale?', form.reject_reason || '')
    if (reason == null) return
    await onReject(form.id, reason)
  }

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}>
          <div style={s.modalTitle}>
            Edit · {form.year} {form.make} {form.model}
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>#{form.stock_number}</span>
          </div>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={s.modalBody}>
          {/* Grade */}
          <div style={s.formGroup}>
            <label style={s.label}>Grade</label>
            <div style={s.gradeGrid}>
              {Object.entries(GRADES).map(([k, g]) => (
                <div key={k} style={s.gradeBtn(k, form.grade === k)} onClick={() => set('grade', k)}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{k}</div>
                  <div style={{ fontSize: 9 }}>≤${g.maxCost}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div style={s.formGroup}>
            <label style={s.label}>Shop</label>
            <select style={s.input} value={form.service_location || ''} onChange={(e) => set('service_location', e.target.value || null)}>
              <option value="">Unassigned</option>
              <option value="gmc">GMC (domestic)</option>
              <option value="honda">Honda (import)</option>
            </select>
          </div>

          {/* Core fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {FIELDS.map((f) => (
              <div key={f.key} style={s.formGroup}>
                <label style={s.label}>
                  {f.label}
                  {f.key === 'estimated_cost' && (
                    <button
                      type="button"
                      onClick={applySuggestedEstimate}
                      style={{ marginLeft: 8, padding: '1px 6px', fontSize: 9, background: 'rgba(59,130,246,0.2)', border: '1px solid #3b82f6', borderRadius: 3, color: 'white', cursor: 'pointer' }}
                    >
                      💡 Suggest {formatMoney(estimateReconCosts({ grade: form.grade, mileage: form.mileage, year: form.year, total: Number(form.estimated_cost) || undefined }).estimated_cost)}
                    </button>
                  )}
                </label>
                <input
                  style={s.input}
                  type={f.type}
                  maxLength={f.maxLength}
                  value={form[f.key] == null ? '' : form[f.key]}
                  onChange={(e) => {
                    const v = f.upper ? e.target.value.toUpperCase() : e.target.value
                    set(f.key, f.type === 'number' ? (v === '' ? null : Number(v)) : v)
                  }}
                />
              </div>
            ))}
          </div>

          {form.is_rejected && (
            <div style={{ padding: 10, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', marginTop: 14, fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Flagged as wholesale</div>
              {form.reject_reason && <div style={{ color: '#94a3b8' }}>{form.reject_reason}</div>}
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, is_rejected: false, reject_reason: null }))}
                style={{ marginTop: 6, padding: '4px 10px', fontSize: 10, background: 'transparent', border: '1px solid #94a3b8', borderRadius: 4, color: '#94a3b8', cursor: 'pointer' }}
              >
                Un-flag
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
            <button style={{ ...s.submitBtn, flex: 1 }} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : '💾 Save'}
            </button>
            {canReject && !form.is_rejected && (
              <button style={{ ...s.submitBtn, background: '#f59e0b', flex: 'none', width: 160 }} onClick={handleReject}>
                Flag Wholesale
              </button>
            )}
            {canDelete && (
              <button
                style={{ ...s.submitBtn, background: '#dc2626', flex: 'none', width: 110 }}
                onClick={() => {
                  if (confirm('Delete this vehicle permanently?')) onDelete(form.id)
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
