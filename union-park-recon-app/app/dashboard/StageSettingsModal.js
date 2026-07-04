'use client'

import { useState } from 'react'
import { s } from './styles'
import { STAGES } from '@/lib/constants'

// Admin-only editor for the per-stage aging thresholds. Cards render green
// under `yellow_at_days`, yellow between yellow and red, red past red_at_days.
// One row per pipeline stage. Save writes upserts to public.stage_settings.
export default function StageSettingsModal({ settings, onClose, onSave }) {
  const [rows, setRows] = useState(() =>
    STAGES.map((st) => {
      const cur = settings?.[st.id] || {}
      return {
        stage_id: st.id,
        stage_name: st.name,
        icon: st.icon,
        yellow_at_days: Number(cur.yellow_at_days ?? 2),
        red_at_days: Number(cur.red_at_days ?? 3),
      }
    })
  )
  const [busy, setBusy] = useState(false)

  const update = (id, key, val) => {
    setRows((prev) =>
      prev.map((r) => (r.stage_id === id ? { ...r, [key]: Number(val) || 0 } : r))
    )
  }

  const save = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onSave(rows.map((r) => ({
        stage_id: r.stage_id,
        yellow_at_days: r.yellow_at_days,
        red_at_days: r.red_at_days,
      })))
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={{ ...s.modalBox, maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}>
          <div style={s.modalTitle}>⚙️ Stage aging thresholds</div>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={s.modalBody}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
            Cards go <span style={{ color: '#22c55e' }}>green</span> under yellow-days,
            {' '}<span style={{ color: '#f59e0b' }}>yellow</span> in between,
            {' '}<span style={{ color: '#ef4444' }}>red</span> past red-days.
            {' '}Red cards also show up in the ⚠️ Alerts dropdown for the recon manager.
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 8, fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>Stage</div>
              <div>Yellow after (days)</div>
              <div>Red after (days)</div>
            </div>

            {rows.map((r) => (
              <div key={r.stage_id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.icon} {r.stage_name}</div>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={r.yellow_at_days}
                  onChange={(e) => update(r.stage_id, 'yellow_at_days', e.target.value)}
                  style={s.input}
                />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={r.red_at_days}
                  onChange={(e) => update(r.stage_id, 'red_at_days', e.target.value)}
                  style={s.input}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button style={{ ...s.btn(), background: 'rgba(255,255,255,0.06)' }} onClick={onClose}>Cancel</button>
            <button style={{ ...s.submitBtn, marginTop: 0 }} disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save thresholds'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
