'use client'

import { useMemo, useState } from 'react'
import { s } from './styles'
import { GRADES, VENDORS, ACQUISITION_SOURCES } from '@/lib/constants'
import { classifyBrand, routeServiceLocation, isHighEnd, suggestGrade, decodeVin, enrichVehicle, estimateReconCosts } from '@/lib/intelligence'
import { formatMoney } from '@/lib/utils'

const empty = {
  stock_number: '', year: '', make: '', model: '', trim: '', vin: '',
  mileage: '', exterior_color: '', interior_color: '',
  grade: '', service_location: '', estimated_cost: '',
  acquisition_source: '', purchase_price: '',
  vendors: [], initialNote: '',
}

export default function AddModal({ onClose, onAdd }) {
  const [form, setForm] = useState(empty)

  const classification = classifyBrand(form.make)
  const highEnd = classification === 'high_end'
  const autoRoute = routeServiceLocation(form.make)
  const vinInfo = form.vin ? decodeVin(form.vin) : null

  const suggestedGrade = useMemo(() => suggestGrade(form), [form.mileage, form.year, form.estimated_cost])
  const suggestedEstimate = useMemo(
    () => estimateReconCosts({ grade: form.grade || suggestedGrade, mileage: form.mileage, year: form.year, total: Number(form.estimated_cost) || undefined }),
    [form.grade, form.mileage, form.year, form.estimated_cost, suggestedGrade],
  )

  const set = (patch) => setForm((p) => ({ ...p, ...patch }))
  const toggleVendor = (id) =>
    setForm((p) => ({ ...p, vendors: p.vendors.includes(id) ? p.vendors.filter((v) => v !== id) : [...p.vendors, id] }))

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
      purchase_price: parseFloat(form.purchase_price) || null,
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={s.formGroup}>
              <label style={s.label}>Stock #</label>
              <input style={s.input} value={form.stock_number} onChange={(e) => set({ stock_number: e.target.value })} required />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Year</label>
              <input style={s.input} type="number" value={form.year} onChange={(e) => set({ year: e.target.value })} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={s.formGroup}>
              <label style={s.label}>Make</label>
              <input style={s.input} value={form.make} onChange={(e) => set({ make: e.target.value })} required />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Model</label>
              <input style={s.input} value={form.model} onChange={(e) => set({ model: e.target.value })} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={s.formGroup}>
              <label style={s.label}>Trim</label>
              <input style={s.input} value={form.trim} onChange={(e) => set({ trim: e.target.value })} />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Mileage</label>
              <input style={s.input} type="number" value={form.mileage} onChange={(e) => set({ mileage: e.target.value })} />
            </div>
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>VIN</label>
            <input style={s.input} value={form.vin} onChange={(e) => set({ vin: e.target.value.toUpperCase() })} maxLength={17} />
            {vinInfo && vinInfo.valid && (
              <div style={{ fontSize: 10, color: '#22c55e', marginTop: 4 }}>
                ✓ Valid VIN · {vinInfo.country}{vinInfo.year ? ` · ${vinInfo.year}` : ''}
              </div>
            )}
            {vinInfo && !vinInfo.valid && form.vin.length === 17 && (
              <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>⚠ VIN failed validation</div>
            )}
          </div>

          {form.make && (
            <div style={{
              padding: '10px 12px', borderRadius: 6, marginBottom: 12, fontSize: 12,
              background: highEnd ? 'rgba(239,68,68,0.12)' : autoRoute ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
              border: `1px solid ${highEnd ? '#ef4444' : autoRoute ? '#22c55e' : '#f59e0b'}`,
            }}>
              {highEnd
                ? <>⚠️ <b>{form.make}</b> is high-end. We don’t recondition Audi, BMW, Volvo, Mercedes, Range Rover, etc. Will be flagged wholesale.</>
                : autoRoute
                  ? <>✓ <b>{form.make}</b> is a {classification}. Auto-routing to <b>{autoRoute === 'gmc' ? 'GMC shop' : 'Honda shop'}</b>.</>
                  : <>⚠ <b>{form.make}</b> is not recognized. Please set service location manually.</>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={s.formGroup}>
              <label style={s.label}>Exterior Color</label>
              <input style={s.input} value={form.exterior_color} onChange={(e) => set({ exterior_color: e.target.value })} />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Interior Color</label>
              <input style={s.input} value={form.interior_color} onChange={(e) => set({ interior_color: e.target.value })} />
            </div>
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Grade {suggestedGrade && !form.grade && <span style={{ color: '#22c55e' }}>(suggested: {suggestedGrade})</span>}</label>
            <div style={s.gradeGrid}>
              {Object.entries(GRADES).map(([k, g]) => (
                <div key={k} style={s.gradeBtn(k, form.grade === k)} onClick={() => set({ grade: k })}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{k}</div>
                  <div style={{ fontSize: 9 }}>≤${g.maxCost}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={s.formGroup}>
              <label style={s.label}>Service Location</label>
              <select style={s.input} value={form.service_location} onChange={(e) => set({ service_location: e.target.value })}>
                <option value="">{autoRoute ? `Auto: ${autoRoute === 'gmc' ? 'GMC' : 'Honda'}` : 'Select…'}</option>
                <option value="gmc">GMC (Domestics)</option>
                <option value="honda">Honda (Imports)</option>
              </select>
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Est. Cost {!form.estimated_cost && <span style={{ color: '#22c55e' }}>(auto: {formatMoney(suggestedEstimate.estimated_cost)})</span>}</label>
              <input style={s.input} type="number" value={form.estimated_cost} onChange={(e) => set({ estimated_cost: e.target.value })} placeholder={String(suggestedEstimate.estimated_cost)} />
            </div>
          </div>

          <div style={{ padding: 8, borderRadius: 6, background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.3)', marginBottom: 12, fontSize: 11, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            <div style={{ gridColumn: '1 / -1', color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              💡 Suggested breakdown (editable after add)
            </div>
            <div>🛠️ Mech <b style={{ color: '#f1f5f9' }}>{formatMoney(suggestedEstimate.cost_mechanical)}</b></div>
            <div>🔨 Body <b style={{ color: '#f1f5f9' }}>{formatMoney(suggestedEstimate.cost_body)}</b></div>
            <div>✨ Detail <b style={{ color: '#f1f5f9' }}>{formatMoney(suggestedEstimate.cost_detail)}</b></div>
            <div>📦 Parts <b style={{ color: '#f1f5f9' }}>{formatMoney(suggestedEstimate.cost_parts)}</b></div>
            <div>🚐 Vend <b style={{ color: '#f1f5f9' }}>{formatMoney(suggestedEstimate.cost_vendor)}</b></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={s.formGroup}>
              <label style={s.label}>Acquisition Source</label>
              <select style={s.input} value={form.acquisition_source} onChange={(e) => set({ acquisition_source: e.target.value })}>
                <option value="">Select…</option>
                {Object.entries(ACQUISITION_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Purchase Price</label>
              <input style={s.input} type="number" value={form.purchase_price} onChange={(e) => set({ purchase_price: e.target.value })} />
            </div>
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Vendors Needed</label>
            <div style={s.vendorGrid}>
              {Object.entries(VENDORS).map(([id, v]) => (
                <div key={id} style={s.vendorBox(form.vendors.includes(id))} onClick={() => toggleVendor(id)}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid #3b82f6', background: form.vendors.includes(id) ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10 }}>
                    {form.vendors.includes(id) && '✓'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{v.name}</div>
                    <div style={{ fontSize: 9, color: '#64748b' }}>{v.days.join(', ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Note</label>
            <textarea style={s.textarea} value={form.initialNote} onChange={(e) => set({ initialNote: e.target.value })} placeholder="Optional notes…" />
          </div>
          <button type="submit" style={s.submitBtn}>{highEnd ? 'Add (will be flagged)' : 'Add to Pipeline'}</button>
        </form>
      </div>
    </div>
  )
}
