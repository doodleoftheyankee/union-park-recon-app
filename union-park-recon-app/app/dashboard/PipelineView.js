'use client'

import { useState } from 'react'
import { s } from './styles'
import { STAGES, PRIORITY_FLAGS } from '@/lib/constants'
import { getTotalDays, getCurrentStageDays, isStageOverdue, formatMoney } from '@/lib/utils'

// Pipeline board with HTML5 drag-and-drop between columns.
// canMoveTo(stageId) -> boolean lets the parent gate drops by role.
export default function PipelineView({ vehicles, stageHistory, onOpen, onDropMove, canMoveTo }) {
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverStage, setDragOverStage] = useState(null)

  const priorityVehicles = vehicles.filter(
    (v) => v.priority && v.priority !== 'none' && v.stage !== 'frontline' && !v.is_rejected,
  )

  const startDrag = (e, v) => {
    e.dataTransfer.setData('text/plain', v.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(v.id)
  }
  const endDrag = () => { setDraggingId(null); setDragOverStage(null) }

  const allowDropOn = (stageId) => canMoveTo?.(stageId) ?? true

  const onDrop = (e, stageId) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setDragOverStage(null)
    setDraggingId(null)
    if (!id) return
    const v = vehicles.find((x) => x.id === id)
    if (!v || v.stage === stageId) return
    if (!allowDropOn(stageId)) return
    onDropMove?.(id, stageId)
  }

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

      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontStyle: 'italic' }}>
        💡 Tip: drag a vehicle card between columns to move it.
      </div>

      <div style={s.pipeline}>
        {STAGES.map((st) => {
          const list = vehicles
            .filter((v) => v.stage === st.id && !v.is_rejected)
            .sort((a, b) => (a.priority !== 'none' ? -1 : 1) - (b.priority !== 'none' ? -1 : 1) || getTotalDays(b.created_at) - getTotalDays(a.created_at))
          const color =
            st.id === 'frontline' ? '#22c55e' :
            st.id === 'approval' ? '#f59e0b' :
            st.id === 'parts_hold' ? '#3b82f6' :
            ['service', 'service_queue'].includes(st.id) ? '#6366f1' : '#64748b'

          const isDraggingOver = dragOverStage === st.id
          const canDropHere = draggingId && allowDropOn(st.id)

          return (
            <div
              key={st.id}
              style={{
                ...s.stageCard(color),
                outline: isDraggingOver && canDropHere ? `2px dashed ${color}` : 'none',
                outlineOffset: 2,
                transform: isDraggingOver && canDropHere ? 'translateY(-2px)' : 'none',
                transition: 'transform .15s ease, outline-color .15s',
                opacity: draggingId && !canDropHere ? 0.55 : 1,
              }}
              onDragOver={(e) => {
                if (!draggingId) return
                e.preventDefault()
                e.dataTransfer.dropEffect = canDropHere ? 'move' : 'none'
                if (!isDraggingOver) setDragOverStage(st.id)
              }}
              onDragLeave={(e) => {
                // Only clear if we left the column, not a child
                if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null)
              }}
              onDrop={(e) => onDrop(e, st.id)}
            >
              <div style={s.stageHead(color)}>
                <div style={s.stageName}>{st.icon} {st.name}</div>
                <div style={s.stageCount(color)}>{list.length}</div>
              </div>
              <div style={s.vList}>
                {list.length === 0 ? (
                  <div style={{ padding: 12, textAlign: 'center', color: '#64748b', fontSize: 10 }}>
                    {isDraggingOver && canDropHere ? 'Drop here' : 'Empty'}
                  </div>
                ) : list.map((v) => {
                  const od = isStageOverdue(stageHistory[v.id], v.stage)
                  return (
                    <div
                      key={v.id}
                      draggable
                      onDragStart={(e) => startDrag(e, v)}
                      onDragEnd={endDrag}
                      onClick={() => onOpen(v)}
                      style={{
                        ...s.vCard(v.priority, od),
                        cursor: 'grab',
                        opacity: draggingId === v.id ? 0.4 : 1,
                        boxShadow: draggingId === v.id ? '0 8px 20px rgba(0,0,0,0.4)' : 'none',
                      }}
                    >
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
