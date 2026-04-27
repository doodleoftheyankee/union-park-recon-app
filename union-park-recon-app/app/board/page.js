'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { STAGES } from '@/lib/constants'
import { getTotalDays } from '@/lib/utils'

// Public TV board — no login required. Auto-refreshes every 30s.
// Reads from public_vehicles view so cost/bill data never leaks.
export default function BoardPage() {
  const supabase = createClient()
  const [vehicles, setVehicles] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('public_vehicles')
        .select('*')
        .order('created_at', { ascending: true })
      setVehicles(data || [])
      setUpdatedAt(new Date())
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [supabase])

  const stageColor = (id) => ({
    stock_in: '#64748b',
    in_service: '#6366f1',
    detail: '#f59e0b',
    frontline: '#22c55e',
  })[id] || '#64748b'

  // Limit Frontline column to cars that hit the line in the last 7 days
  // so the board doesn't grow forever.
  const sevenDaysAgo = Date.now() - 7 * 86400000
  const grouped = STAGES.map((st) => ({
    ...st,
    list: vehicles
      .filter((v) => v.stage === st.id)
      .filter((v) => st.id !== 'frontline' || (v.frontline_at && new Date(v.frontline_at).getTime() > sevenDaysAgo))
      .sort((a, b) => getTotalDays(b) - getTotalDays(a)),
  }))

  return (
    <div style={{ minHeight: '100vh', padding: '20px 28px', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#dc2626', letterSpacing: '-0.02em' }}>
            Union Park · Recon Board
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 2 }}>
            Buick GMC · Live status of every used vehicle in recon
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            {grouped.reduce((a, g) => a + g.list.length, 0)} vehicles · auto-refreshing
          </div>
          {updatedAt && (
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Updated {updatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
          )}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 14, flex: 1, minHeight: 0 }}>
        {grouped.map((st) => (
          <div
            key={st.id}
            style={{
              background: 'rgba(30,41,59,0.85)',
              border: `2px solid ${stageColor(st.id)}`,
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{
              background: `${stageColor(st.id)}33`,
              padding: '14px 18px',
              borderBottom: `1px solid ${stageColor(st.id)}55`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{st.icon} {st.name}</div>
              <div style={{
                background: stageColor(st.id),
                padding: '4px 14px',
                borderRadius: 14,
                fontSize: 18,
                fontWeight: 800,
              }}>
                {st.list.length}
              </div>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>
              {st.list.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#475569', fontSize: 16 }}>—</div>
              ) : st.list.map((v) => {
                const days = getTotalDays(v)
                const aging = days > 5 ? '#ef4444' : days > 3 ? '#f59e0b' : '#22c55e'
                return (
                  <div key={v.id} style={{
                    background: 'rgba(15,23,42,0.7)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{v.year} {v.make} {v.model}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>#{v.stock_number}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        {v.exterior_color ? v.exterior_color : ''}
                        {v.exterior_color && v.mileage ? ' · ' : ''}
                        {v.mileage ? `${v.mileage.toLocaleString()} mi` : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {v.service_location && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            background: v.service_location === 'gmc' ? 'rgba(220,38,38,0.2)' : 'rgba(59,130,246,0.2)',
                            border: `1px solid ${v.service_location === 'gmc' ? '#dc2626' : '#3b82f6'}`,
                          }}>
                            {v.service_location === 'gmc' ? 'GMC' : 'HONDA'}
                          </span>
                        )}
                        <span style={{ fontSize: 14, fontWeight: 700, color: aging }}>{days}d</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
