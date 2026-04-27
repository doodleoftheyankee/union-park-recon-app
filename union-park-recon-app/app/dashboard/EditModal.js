'use client'

import { useState } from 'react'
import { s } from './styles'
import { GRADES, ACQUISITION_SOURCES, COST_CATEGORIES } from '@/lib/constants'
import { estimateReconCosts } from '@/lib/intelligence'
import { formatMoney } from '@/lib/utils'

// Editable fields grouped by section for a clean UI
const SECTIONS = [
  {
    title: 'Identity',
    fields: [
      { key: 'stock_number', label: 'Stock #', type: 'text' },
      { key: 'vin', label: 'VIN', type: 'text', maxLength: 17, upper: true },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'make', label: 'Make', type: 'text' },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'trim', label: 'Trim', type: 'text' },
      { key: 'body_style', label: 'Body style', type: 'text' },
      { key: 'external_id', label: 'DMS / External ID', type: 'text' },
    ],
  },
  {
    title: 'Condition & Specs',
    fields: [
      { key: 'mileage', label: 'Mileage', type: 'number' },
      { key: 'exterior_color', label: 'Exterior color', type: 'text' },
      { key: 'interior_color', label: 'Interior color', type: 'text' },
      { key: 'drivetrain', label: 'Drivetrain', type: 'text' },
      { key: 'transmission', label: 'Transmission', type: 'text' },
      { key: 'fuel_type', label: 'Fuel', type: 'text' },
      { key: 'engine', label: 'Engine', type: 'text' },
    ],
  },
  {
    title: 'Acquisition & Pricing',
    fields: [
      { key: 'acquisition_source', label: 'Acquisition source', type: 'select', options: ACQUISITION_SOURCES },
      { key: 'acquisition_date', label: 'Acquisition date', type: 'date' },
      { key: 'purchase_price', label: 'Purchase price', type: 'number' },
      { key: 'asking_price', label: 'Asking price', type: 'number' },
      { key: 'target_frontline_date', label: 'Target frontline date', type: 'date' },
    ],
  },
  {
    title: 'Recon Budget',
    fields: [
      { key: 'estimated_cost', label: 'Estimated recon', type: 'number' },
      { key: 'actual_cost', label: 'Actual recon', type: 'number' },
      ...COST_CATEGORIES.map((c) => ({ key: c.id, label: `${c.icon} ${c.label}`, type: 'number' })),
    ],
  },
]

const prepare = (v) => {
  const out = { ...v }
  const dateKeys = ['acquisition_date', 'target_frontline_date']
  dateKeys.forEach((k) => {
    if (out[k]) out[k] = String(out[k]).slice(0, 10)
  })
  COST_CATEGORIES.forEach((c) => { if (out[c.id] == null) out[c.id] = 0 })
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
    const reason = prompt('Reason for wholesale / reject?', form.reject_reason || '')
    if (reason == null) return
    await onReject(form.id, reason)
  }

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={{ ...s.modalBox, maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}>
          <div style={s.modalTitle}>
            Edit: {form.year} {form.make} {form.model}
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>#{form.stock_number}</span>
          </div>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={s.modalBody}>
          <div style={{ marginBottom: 14 }}>
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

            <div style={s.formGroup}>
              <label style={s.label}>Service Location</label>
              <select style={s.input} value={form.service_location || ''} onChange={(e) => set('service_location', e.target.value)}>
                <option value="">Unassigned</option>
                <option value="gmc">GMC (Domestics)</option>
                <option value="honda">Honda (Imports)</option>
              </select>
            </div>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f59e0b', fontWeight: 700 }}>{section.title}</div>
                {section.title === 'Recon Budget' && (
                  <button
                    type="button"
                    onClick={applySuggestedEstimate}
                    style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.2)', border: '1px solid #3b82f6', borderRadius: 4, color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    title="Fill category estimates based on grade, mileage, and year"
                  >
                    💡 Suggest ({formatMoney(estimateReconCosts({ grade: form.grade, mileage: form.mileage, year: form.year, total: Number(form.estimated_cost) || undefined }).estimated_cost)})
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {section.fields.map((f) => (
                  <div key={f.key} style={s.formGroup}>
                    <label style={s.label}>{f.label}</label>
                    {f.type === 'select' ? (
                      <select style={s.input} value={form[f.key] || ''} onChange={(e) => set(f.key, e.target.value)}>
                        <option value="">Select…</option>
                        {Object.entries(f.options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
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
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {form.is_rejected && (
            <div style={{ padding: 10, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', marginBottom: 14, fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Flagged as rejected / wholesale</div>
              {form.reject_reason && <div style={{ color: '#94a3b8' }}>{form.reject_reason}</div>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
            <button style={{ ...s.submitBtn, flex: 1 }} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : '💾 Save Changes'}
            </button>
            {canReject && !form.is_rejected && (
              <button style={{ ...s.submitBtn, background: '#f59e0b', flex: 'none', width: 180 }} onClick={handleReject}>
                Flag Wholesale
              </button>
            )}
            {canDelete && (
              <button
                style={{ ...s.submitBtn, background: '#64748b', flex: 'none', width: 120 }}
                onClick={() => {
                  if (confirm('Delete this vehicle permanently? This cannot be undone.')) onDelete(form.id)
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
