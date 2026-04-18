'use client'

import { useMemo } from 'react'
import { s } from './styles'
import { STAGES, GRADES, COST_CATEGORIES, TARGET_FRONTLINE_DAYS, HOLDING_COST_PER_DAY } from '@/lib/constants'
import { getTotalDays, getAgingBucket, formatMoney } from '@/lib/utils'
import { rollupCost } from '@/lib/intelligence'

const PANEL_LABELS = {
  fresh: 'Fresh (≤2d)',
  on_track: `On track (≤${TARGET_FRONTLINE_DAYS}d)`,
  aging: `Aging (${TARGET_FRONTLINE_DAYS + 1}-${TARGET_FRONTLINE_DAYS * 2}d)`,
  stale: `Stale (>${TARGET_FRONTLINE_DAYS * 2}d)`,
}
const PANEL_COLORS = { fresh: '#22c55e', on_track: '#3b82f6', aging: '#f59e0b', stale: '#ef4444' }

export default function AnalyticsView({ vehicles }) {
  const kpi = useMemo(() => {
    const active = vehicles.filter((v) => !v.is_rejected && v.stage !== 'frontline')
    const frontline = vehicles.filter((v) => v.stage === 'frontline')
    const rejected = vehicles.filter((v) => v.is_rejected)

    const daysToFrontline = frontline
      .filter((v) => v.frontline_at && v.created_at)
      .map((v) => (new Date(v.frontline_at) - new Date(v.created_at)) / 86400000)
    const avgTtf = daysToFrontline.length
      ? daysToFrontline.reduce((a, b) => a + b, 0) / daysToFrontline.length
      : null

    const totalRecon = vehicles.reduce((a, v) => a + (Number(v.actual_cost) || rollupCost(v)), 0)
    const totalEstimated = vehicles.reduce((a, v) => a + (Number(v.estimated_cost) || 0), 0)
    const totalHolding = active.reduce((a, v) => a + getTotalDays(v) * HOLDING_COST_PER_DAY, 0)

    const byAging = { fresh: 0, on_track: 0, aging: 0, stale: 0 }
    active.forEach((v) => { byAging[getAgingBucket(v)]++ })

    const byStage = {}
    STAGES.forEach((st) => { byStage[st.id] = active.filter((v) => v.stage === st.id).length })

    const byGrade = { A: 0, B: 0, C: 0, D: 0 }
    active.forEach((v) => { if (v.grade && byGrade[v.grade] != null) byGrade[v.grade]++ })

    const byShop = {
      gmc: active.filter((v) => v.service_location === 'gmc').length,
      honda: active.filter((v) => v.service_location === 'honda').length,
      unassigned: active.filter((v) => !v.service_location).length,
    }

    const costByCategory = COST_CATEGORIES.map((c) => ({
      ...c,
      total: vehicles.reduce((a, v) => a + (Number(v[c.id]) || 0), 0),
    }))

    return {
      activeCount: active.length,
      frontlineCount: frontline.length,
      rejectedCount: rejected.length,
      avgTtf,
      totalRecon,
      totalEstimated,
      totalHolding,
      byAging,
      byStage,
      byGrade,
      byShop,
      costByCategory,
    }
  }, [vehicles])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={s.grid}>
        <div style={s.stat(false)}><div style={s.statLabel}>Active Pipeline</div><div style={s.statVal}>{kpi.activeCount}</div></div>
        <div style={s.stat(false)}><div style={s.statLabel}>Frontline</div><div style={{ ...s.statVal, color: '#22c55e' }}>{kpi.frontlineCount}</div></div>
        <div style={s.stat(false)}><div style={s.statLabel}>Avg Time-to-Frontline</div><div style={s.statVal}>{kpi.avgTtf ? `${kpi.avgTtf.toFixed(1)}d` : '—'}</div></div>
        <div style={s.stat(false)}><div style={s.statLabel}>Est. Recon $</div><div style={s.statVal}>{formatMoney(kpi.totalEstimated)}</div></div>
        <div style={s.stat(false)}><div style={s.statLabel}>Holding Cost (active)</div><div style={{ ...s.statVal, color: '#ef4444' }}>{formatMoney(kpi.totalHolding)}</div></div>
        <div style={s.stat(kpi.rejectedCount > 0)}><div style={s.statLabel}>Rejected / Wholesale</div><div style={{ ...s.statVal, color: kpi.rejectedCount ? '#f59e0b' : '#22c55e' }}>{kpi.rejectedCount}</div></div>
      </div>

      <div style={s.panelGrid}>
        <div style={s.panel}>
          <div style={s.panelHead}>Aging buckets</div>
          {Object.entries(PANEL_LABELS).map(([k, label]) => {
            const count = kpi.byAging[k]
            const pct = kpi.activeCount ? (count / kpi.activeCount) * 100 : 0
            return (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span>{label}</span>
                  <span style={{ color: PANEL_COLORS[k], fontWeight: 600 }}>{count}</span>
                </div>
                <div style={s.bar}><div style={s.barFill(PANEL_COLORS[k], pct)} /></div>
              </div>
            )
          })}
        </div>

        <div style={s.panel}>
          <div style={s.panelHead}>By stage</div>
          {STAGES.filter((st) => st.id !== 'decision' && st.id !== 'frontline').map((st) => {
            const count = kpi.byStage[st.id]
            const pct = kpi.activeCount ? (count / kpi.activeCount) * 100 : 0
            return (
              <div key={st.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span>{st.icon} {st.name}</span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </div>
                <div style={s.bar}><div style={s.barFill('#6366f1', pct)} /></div>
              </div>
            )
          })}
        </div>

        <div style={s.panel}>
          <div style={s.panelHead}>By grade</div>
          {Object.entries(kpi.byGrade).map(([g, count]) => {
            const pct = kpi.activeCount ? (count / kpi.activeCount) * 100 : 0
            return (
              <div key={g} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span>Grade {g} <span style={{ color: '#64748b' }}>(≤{formatMoney(GRADES[g].maxCost)})</span></span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </div>
                <div style={s.bar}><div style={s.barFill(GRADES[g].color, pct)} /></div>
              </div>
            )
          })}
        </div>

        <div style={s.panel}>
          <div style={s.panelHead}>By service shop</div>
          {[
            { id: 'gmc', label: '🔧 GMC shop (domestics)', color: '#ef4444' },
            { id: 'honda', label: '🔧 Honda shop (imports)', color: '#3b82f6' },
            { id: 'unassigned', label: '⚠️ Unassigned', color: '#f59e0b' },
          ].map(({ id, label, color }) => {
            const count = kpi.byShop[id]
            const pct = kpi.activeCount ? (count / kpi.activeCount) * 100 : 0
            return (
              <div key={id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span>{label}</span>
                  <span style={{ color, fontWeight: 600 }}>{count}</span>
                </div>
                <div style={s.bar}><div style={s.barFill(color, pct)} /></div>
              </div>
            )
          })}
        </div>

        <div style={s.panel}>
          <div style={s.panelHead}>Recon spend by category</div>
          {kpi.costByCategory.map((c) => {
            const max = Math.max(1, ...kpi.costByCategory.map((x) => x.total))
            const pct = (c.total / max) * 100
            return (
              <div key={c.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span>{c.icon} {c.label}</span>
                  <span style={{ fontWeight: 600 }}>{formatMoney(c.total)}</span>
                </div>
                <div style={s.bar}><div style={s.barFill(c.color, pct)} /></div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
