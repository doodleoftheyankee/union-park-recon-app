'use client'

import { useMemo, useState } from 'react'
import { s } from './styles'
import { GRADES } from '@/lib/constants'
import { classifyBrand, routeServiceLocation, suggestGrade, enrichVehicle, estimateReconCosts } from '@/lib/intelligence'
import { formatMoney } from '@/lib/utils'

const empty = {
  stock_number: '', acquisition_date: new Date().toISOString().slice(0, 10),
  year: '', make: '', model: '',
  mileage: '', exterior_color: '',
  grade: '', estimated_cost: '',
  initialNote: '',
}

export default function AddModal({ onClose, onAdd }) {
  const [form, setForm] = useState(empty)

  const classification = classifyBrand(form.make)
  const highEnd = classification === 'high_end'
  const autoRoute = routeServiceLocation(form.make)

  const suggestedGrade = useMemo(() => suggestGrade(form), [form.mileage, form.year, form.estimated_cost])
  const suggestedEstimate = useMemo(
    () => estimateReconCosts({ grade: form.grade || suggestedGrade, mileage: form.mileage, year: form.year, total: Number(form.estimated_cost) || undefined }),
    [form.grade, form.mileage, form.year, form.estimated_cost, suggestedGrade],
  )

  const set = (patch) => setForm((p) => ({ ...p, ...patch }))

  const submit = (e) => {
    e.preventDefault()
    if (highEnd) {
      const ok = confirm(`${form.make} is a high-end brand we don't recondition. Add it anyway (flagged for wholesale)?`)
      if (!ok) return
    }
    const coerced = {
      ...form,
      year: parseInt(form.year) || null,
      mileage: parseInt(form.mileage) || null,
      estimated_cost: parseFloat(form.estimated_cost) || 0,
    }
    onAdd(enrichVehicle(coerced))
  }

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}>
          <div style={s.modalTitle}>Add Vehicle</div>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>
        <form style={s.modalBody} onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={s.formGroup}>
              <label style={s.label}>Stock #</label>
              <input style={s.input} value={form.stock_number} onChange={(e) => set({ stock_number: e.target.value })} required />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Stock-in date</label>
              <input style={s.input} type="date" value={form.acquisition_date} onChange={(e) => set({ acquisition_date: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 10 }}>
            <div style={s.formGroup}>
              <label style={s.label}>Year</label>
              <input style={s.input} type="number" value={form.year} onChange={(e) => set({ year: e.target.value })} required />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Make</label>
              <input style={s.input} value={form.make} onChange={(e) => set({ make: e.target.value })} required />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Model</label>
              <input style={s.input} value={form.model} onChange={(e) => set({ model: e.target.value })} required />
            </div>
          </div>

          {form.make && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 12,
              background: highEnd ? 'rgba(239,68,68,0.12)' : autoRoute ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
              border: `1px solid ${highEnd ? '#ef4444' : autoRoute ? '#22c55e' : '#f59e0b'}`,
            }}>
              {highEnd
                ? <>⚠️ <b>{form.make}</b> is high-end — will be flagged wholesale.</>
                : autoRoute
                  ? <>✓ Routing to <b>{autoRoute === 'gmc' ? 'GMC shop' : 'Honda shop'}</b></>
                  : <>⚠ <b>{form.make}</b> not recognized — set shop on edit.</>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={s.formGroup}>
              <label style={s.label}>Mileage</label>
              <input style={s.input} type="number" value={form.mileage} onChange={(e) => set({ mileage: e.target.value })} />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Color</label>
              <input style={s.input} value={form.exterior_color} onChange={(e) => set({ exterior_color: e.target.value })} />
            </div>
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Grade {!form.grade && <span style={{ color: '#22c55e' }}>(suggested: {suggestedGrade})</span>}</label>
            <div style={s.gradeGrid}>
              {Object.entries(GRADES).map(([k, g]) => (
                <div key={k} style={s.gradeBtn(k, form.grade === k)} onClick={() => set({ grade: k })}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{k}</div>
                  <div style={{ fontSize: 9 }}>≤${g.maxCost}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Estimated recon $ {!form.estimated_cost && <span style={{ color: '#22c55e' }}>(auto: {formatMoney(suggestedEstimate.estimated_cost)})</span>}</label>
            <input style={s.input} type="number" value={form.estimated_cost} onChange={(e) => set({ estimated_cost: e.target.value })} placeholder={String(suggestedEstimate.estimated_cost)} />
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Note (optional)</label>
            <textarea style={s.textarea} value={form.initialNote} onChange={(e) => set({ initialNote: e.target.value })} placeholder="Any notes for the team…" />
          </div>

          <button type="submit" style={s.submitBtn}>{highEnd ? 'Add (will be flagged)' : 'Add Vehicle'}</button>
        </form>
      </div>
    </div>
  )
}
