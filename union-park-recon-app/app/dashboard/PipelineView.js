'use client'

import { s } from './styles'
import { STAGES, PRIORITY_FLAGS } from '@/lib/constants'
import { getTotalDays, getCurrentStageDays, isStageOverdue, formatMoney } from '@/lib/utils'

export default function PipelineView({ vehicles, stageHistory, onOpen }) {
  const priorityVehicles = vehicles.filter((v) => v.priority && v.priority !== 'none' && v.stage !== 'frontline' && !v.is_rejected)

  return (
    <>
      {priorityVehicles.length > 0 && (
        <div style={s.prioritySection}>
          <div style={s.priorityHeader}>
            <span>🚨 Priority Vehicles</span>
            <span style={{ color: '#f59e0b' }}>{priorityVehicles.length}</span>
          </div>
          <div style={s.priorityList}>
            {priorityVehicles.map((v) => (
              <div key={v.id} style={s.vCard(v.priority, isStageOverdue(stageHistory[v.id], v.stage))} onClick={() => onOpen(v)}>
                <div style={s.priBadge(v.priority)}>{PRIORITY_FLAGS[v.priority].label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div>
                    <div style={s.vTitle}>{v.year} {v.make} {v.model}</div>
                    <div style={s.vStock}>#{v.stock_number}</div>
                  </div>
                  <span style={s.gradeBadge(v.grade)}>{v.grade}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>
                    {STAGES.find((x) => x.id === v.stage)?.icon} {STAGES.find((x) => x.id === v.stage)?.name}
                  </span>
                  <span style={s.daysInd(getTotalDays(v.created_at), 5)}>{getTotalDays(v.created_at)}d</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={s.pipeline}>
        {STAGES.filter((st) => st.id !== 'decision').map((st) => {
          const list = vehicles
            .filter((v) => v.stage === st.id && !v.is_rejected)
            .sort((a, b) => (a.priority !== 'none' ? -1 : 1) - (b.priority !== 'none' ? -1 : 1) || getTotalDays(b.created_at) - getTotalDays(a.created_at))
          const color =
            st.id === 'frontline' ? '#22c55e' :
            st.id === 'approval' ? '#f59e0b' :
            st.id === 'parts_hold' ? '#3b82f6' :
            ['service', 'service_queue'].includes(st.id) ? '#6366f1' : '#64748b'

          return (
            <div key={st.id} style={s.stageCard(color)}>
              <div style={s.stageHead(color)}>
                <div style={s.stageName}>{st.icon} {st.name}</div>
                <div style={s.stageCount(color)}>{list.length}</div>
              </div>
              <div style={s.vList}>
                {list.length === 0 ? (
                  <div style={{ padding: 12, textAlign: 'center', color: '#64748b', fontSize: 10 }}>Empty</div>
                ) : list.map((v) => {
                  const od = isStageOverdue(stageHistory[v.id], v.stage)
                  return (
                    <div key={v.id} style={s.vCard(v.priority, od)} onClick={() => onOpen(v)}>
                      {v.priority && v.priority !== 'none' && <div style={s.priBadge(v.priority)}>{PRIORITY_FLAGS[v.priority].icon}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <div>
                          <div style={s.vTitle}>{v.year} {v.make} {v.model}</div>
                          <div style={s.vStock}>#{v.stock_number}{v.mileage ? ` • ${v.mileage.toLocaleString()}mi` : ''}</div>
                        </div>
                        <span style={s.gradeBadge(v.grade)}>{v.grade}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={s.daysInd(getCurrentStageDays(stageHistory[v.id], v.stage), st.maxDays)}>
                          {getCurrentStageDays(stageHistory[v.id], v.stage)}d
                        </span>
                        <span style={{ fontSize: 9, color: '#64748b' }}>{formatMoney(v.estimated_cost)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
