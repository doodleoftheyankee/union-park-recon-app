'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { STAGES } from '@/lib/constants'
import { getTotalDays } from '@/lib/utils'

// Public sales-floor view — no login. Auto-refreshes every minute.
// Shows just the data sales actually cares about: what's the car, how
// many days has it been here, when will it be ready.
export default function SalesPage() {
  const supabase = createClient()
  const [vehicles, setVehicles] = useState([])
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [updatedAt, setUpdatedAt] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('public_vehicles')
        .select('*')
        .order('created_at', { ascending: false })
      setVehicles(data || [])
      setUpdatedAt(new Date())
    }
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [supabase])

  // Best-effort ETA: rough remaining days based on current stage.
  const etaDays = (v) => {
    const remaining = ({
      stock_in: 5,
      in_service: 3,
      detail: 1,
      frontline: 0,
    })[v.stage] ?? 5
    const total = getTotalDays(v)
    if (v.stage === 'frontline') return 'Ready'
    return `~${Math.max(0, Math.ceil(remaining))} day${remaining === 1 ? '' : 's'}`
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return vehicles
      .filter((v) => stageFilter === 'all' ? true : v.stage === stageFilter)
      .filter((v) => {
        if (!q) return true
        return [v.stock_number, v.year, v.make, v.model, v.trim, v.exterior_color]
          .some((f) => String(f || '').toLowerCase().includes(q))
      })
  }, [vehicles, query, stageFilter])

  const counts = STAGES.reduce((a, s) => ({ ...a, [s.id]: vehicles.filter((v) => v.stage === s.id).length }), {})

  return (
    <div style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <header style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626' }}>
          Union Park · Used Inventory Status
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
          {vehicles.length} vehicles · {counts.frontline || 0} frontline ready ·
          live status for the sales floor
          {updatedAt && (
            <span style={{ marginLeft: 8, color: '#64748b' }}>
              · updated {updatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search stock #, year, make, model, color…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: '10px 14px',
            background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: '#f1f5f9', fontSize: 14,
          }}
        />
        <select
          value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
          style={{
            padding: '10px 14px', background: 'rgba(15,23,42,0.8)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            color: '#f1f5f9', fontSize: 14,
          }}
        >
          <option value="all">All stages ({vehicles.length})</option>
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name} ({counts[s.id] || 0})</option>)}
        </select>
      </div>

      <div style={{
        background: 'rgba(30,41,59,0.85)', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.1)', overflow: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {['Stock #', 'Vehicle', 'Color', 'Miles', 'Shop', 'Stage', 'Days Here', 'Ready In'].map((h) => (
                <th key={h} style={{
                  padding: '12px 14px', textAlign: 'left',
                  background: 'rgba(15,23,42,0.6)', color: '#94a3b8',
                  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const stage = STAGES.find((st) => st.id === v.stage)
              const days = getTotalDays(v)
              const isReady = v.stage === 'frontline'
              return (
                <tr key={v.id} style={{ background: isReady ? 'rgba(34,197,94,0.06)' : 'transparent' }}>
                  <td style={td}><b>#{v.stock_number}</b></td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{v.year} {v.make} {v.model}</div>
                    {v.trim && <div style={{ fontSize: 11, color: '#64748b' }}>{v.trim}</div>}
                  </td>
                  <td style={td}>{v.exterior_color || '—'}</td>
                  <td style={td}>{v.mileage ? v.mileage.toLocaleString() : '—'}</td>
                  <td style={td}>
                    {v.service_location === 'gmc' ? (
                      <span style={{ padding: '2px 8px', background: 'rgba(220,38,38,0.2)', border: '1px solid #dc2626', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>GMC</span>
                    ) : v.service_location === 'honda' ? (
                      <span style={{ padding: '2px 8px', background: 'rgba(59,130,246,0.2)', border: '1px solid #3b82f6', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>HONDA</span>
                    ) : '—'}
                  </td>
                  <td style={td}>{stage ? `${stage.icon} ${stage.name}` : v.stage}</td>
                  <td style={td}>{days}d</td>
                  <td style={{ ...td, fontWeight: 700, color: isReady ? '#22c55e' : '#f1f5f9' }}>
                    {etaDays(v)}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                  No vehicles match
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const td = {
  padding: '12px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  whiteSpace: 'nowrap',
}
