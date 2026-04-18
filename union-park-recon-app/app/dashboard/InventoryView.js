'use client'

import { useMemo, useState } from 'react'
import { s } from './styles'
import { STAGES } from '@/lib/constants'
import { getTotalDays, formatMoney, formatShortDate } from '@/lib/utils'
import { classifyBrand } from '@/lib/intelligence'

const SORTS = {
  newest: { label: 'Newest', fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
  oldest: { label: 'Oldest', fn: (a, b) => new Date(a.created_at) - new Date(b.created_at) },
  stock: { label: 'Stock #', fn: (a, b) => (a.stock_number || '').localeCompare(b.stock_number || '') },
  make: { label: 'Make', fn: (a, b) => (a.make || '').localeCompare(b.make || '') },
  cost_desc: { label: 'Cost (high-low)', fn: (a, b) => (b.estimated_cost || 0) - (a.estimated_cost || 0) },
  days_desc: { label: 'Oldest in recon', fn: (a, b) => getTotalDays(b.created_at) - getTotalDays(a.created_at) },
}

export default function InventoryView({ vehicles, onOpen, onEdit, onExport, canEdit }) {
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [showRejected, setShowRejected] = useState(false)
  const [sort, setSort] = useState('newest')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return vehicles
      .filter((v) => (showRejected ? true : !v.is_rejected))
      .filter((v) => (stageFilter === 'all' ? true : v.stage === stageFilter))
      .filter((v) => {
        if (classFilter === 'all') return true
        const c = v.origin_class || classifyBrand(v.make)
        return c === classFilter
      })
      .filter((v) => {
        if (!q) return true
        return [v.stock_number, v.vin, v.make, v.model, v.trim, v.exterior_color, v.year]
          .some((f) => String(f || '').toLowerCase().includes(q))
      })
      .sort(SORTS[sort].fn)
  }, [vehicles, query, stageFilter, classFilter, showRejected, sort])

  return (
    <>
      <div style={s.inventoryCtrl}>
        <input
          style={s.searchInput}
          placeholder="Search by stock#, VIN, make, model, color…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select style={s.select} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="all">All stages</option>
          {STAGES.map((st) => (
            <option key={st.id} value={st.id}>{st.name}</option>
          ))}
        </select>
        <select style={s.select} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="all">All origins</option>
          <option value="domestic">Domestic (→GMC)</option>
          <option value="import">Import (→Honda)</option>
          <option value="high_end">High-end (excluded)</option>
          <option value="unknown">Unclassified</option>
        </select>
        <select style={s.select} value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} />
          Show rejected
        </label>
        <button style={{ padding: '9px 14px', background: '#8b5cf6', border: 'none', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={onExport}>
          ⬇ Export CSV
        </button>
      </div>

      <div style={{ marginBottom: 10, fontSize: 12, color: '#94a3b8' }}>
        Showing {filtered.length} of {vehicles.length} vehicles
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Stock</th>
              <th style={s.th}>Vehicle</th>
              <th style={s.th}>Trim</th>
              <th style={s.th}>Color</th>
              <th style={s.th}>Miles</th>
              <th style={s.th}>Grade</th>
              <th style={s.th}>Shop</th>
              <th style={s.th}>Stage</th>
              <th style={s.th}>Days</th>
              <th style={s.th}>Est. Cost</th>
              <th style={s.th}>Stock-In</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const stage = STAGES.find((st) => st.id === v.stage)
              return (
                <tr key={v.id} style={s.tr(v.is_rejected)} onClick={() => onOpen(v)}>
                  <td style={s.td}>
                    <div style={{ fontWeight: 700 }}>#{v.stock_number}</div>
                    {v.is_high_end && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600 }}>HIGH-END</div>}
                    {v.is_rejected && !v.is_high_end && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600 }}>REJECTED</div>}
                  </td>
                  <td style={s.td}>
                    <div style={{ fontWeight: 600 }}>{v.year} {v.make} {v.model}</div>
                    {v.vin && <div style={{ fontSize: 9, color: '#64748b' }}>{v.vin}</div>}
                  </td>
                  <td style={s.td}>{v.trim || '—'}</td>
                  <td style={s.td}>
                    {v.exterior_color || '—'}
                    {v.interior_color && <div style={{ fontSize: 9, color: '#64748b' }}>{v.interior_color}</div>}
                  </td>
                  <td style={s.td}>{v.mileage ? v.mileage.toLocaleString() : '—'}</td>
                  <td style={s.td}><span style={s.gradeBadge(v.grade)}>{v.grade}</span></td>
                  <td style={s.td}>{v.service_location === 'gmc' ? 'GMC' : v.service_location === 'honda' ? 'Honda' : '—'}</td>
                  <td style={s.td}>{stage ? `${stage.icon} ${stage.name}` : v.stage}</td>
                  <td style={s.td}>{getTotalDays(v.created_at)}d</td>
                  <td style={s.td}>{formatMoney(v.estimated_cost)}</td>
                  <td style={s.td}>{formatShortDate(v.acquisition_date || v.created_at)}</td>
                  <td style={s.td} onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <button
                        style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.2)', border: '1px solid #3b82f6', borderRadius: 4, color: 'white', fontSize: 11, cursor: 'pointer' }}
                        onClick={() => onEdit(v)}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={12} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No vehicles match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
