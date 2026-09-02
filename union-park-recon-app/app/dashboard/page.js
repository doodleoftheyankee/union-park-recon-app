'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { STAGES, PRIORITY_FLAGS, ROLES, AUDITED_FIELDS } from '@/lib/constants'
import {
  getTotalDays, isStageOverdue, getStageStatus, getReconDays, downloadFile, formatMoney,
} from '@/lib/utils'
import { exportCsv } from '@/lib/inventory'

import { s } from './styles'
import PipelineView from './PipelineView'
import InventoryView from './InventoryView'
import AddModal from './AddModal'
import EditModal from './EditModal'
import DetailModal from './DetailModal'
import ImportModal from './ImportModal'
import StageSettingsModal from './StageSettingsModal'

const TABS = [
  { id: 'pipeline', label: '📊 Pipeline' },
  { id: 'inventory', label: '🚗 Inventory' },
]

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [notes, setNotes] = useState({})
  const [stageHistory, setStageHistory] = useState({})
  const [bills, setBills] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pipeline')

  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [showStageSettings, setShowStageSettings] = useState(false)
  const [notifications, setNotifications] = useState([])
  // Per-stage aging thresholds, keyed by stage id. Sensible fallback in case
  // the row is missing so the first render doesn't crash before load.
  const [stageSettings, setStageSettings] = useState({
    stock_in:   { yellow_at_days: 1, red_at_days: 2 },
    in_service: { yellow_at_days: 2, red_at_days: 3 },
    detail:     { yellow_at_days: 2, red_at_days: 3 },
    frontline:  { yellow_at_days: 15, red_at_days: 30 },
  })

  useEffect(() => {
    const loadData = async () => {
      // Public read: /dashboard renders for anyone at the dealership without
      // requiring a login. Signed-in users with admin or recon_manager get
      // edit controls; everyone else (including guests with no session) sees
      // the same board read-only. RLS at the DB level enforces the same rule
      // so no rogue client can flip a boolean and start writing.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUser(session.user)
        const { data: profileData } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).single()
        setProfile(profileData)
      }

      const [
        { data: vehiclesData },
        { data: notesData },
        { data: historyData },
        { data: billsData },
        { data: settingsData },
      ] = await Promise.all([
        supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
        supabase.from('notes').select('*').order('created_at', { ascending: false }),
        supabase.from('stage_history').select('*').order('entered_at', { ascending: true }),
        supabase.from('shop_bills').select('*').order('billed_on', { ascending: false }),
        supabase.from('stage_settings').select('*'),
      ])

      setVehicles(vehiclesData || [])
      if (settingsData?.length) {
        const bystage = {}
        for (const r of settingsData) bystage[r.stage_id] = r
        setStageSettings((prev) => ({ ...prev, ...bystage }))
      }

      const notesByVehicle = {}
      notesData?.forEach((n) => {
        if (!notesByVehicle[n.vehicle_id]) notesByVehicle[n.vehicle_id] = []
        notesByVehicle[n.vehicle_id].push(n)
      })
      setNotes(notesByVehicle)

      const historyByVehicle = {}
      historyData?.forEach((h) => {
        if (!historyByVehicle[h.vehicle_id]) historyByVehicle[h.vehicle_id] = []
        historyByVehicle[h.vehicle_id].push(h)
      })
      setStageHistory(historyByVehicle)

      const billsByVehicle = {}
      billsData?.forEach((b) => {
        if (!billsByVehicle[b.vehicle_id]) billsByVehicle[b.vehicle_id] = []
        billsByVehicle[b.vehicle_id].push(b)
      })
      setBills(billsByVehicle)

      setLoading(false)
    }

    loadData()

    const vehiclesChannel = supabase
      .channel('vehicles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, (payload) => {
        if (payload.eventType === 'INSERT') setVehicles((prev) => [payload.new, ...prev.filter((v) => v.id !== payload.new.id)])
        else if (payload.eventType === 'UPDATE') setVehicles((prev) => prev.map((v) => (v.id === payload.new.id ? payload.new : v)))
        else if (payload.eventType === 'DELETE') setVehicles((prev) => prev.filter((v) => v.id !== payload.old.id))
      })
      .subscribe()

    const notesChannel = supabase
      .channel('notes-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (payload) => {
        setNotes((prev) => ({
          ...prev,
          [payload.new.vehicle_id]: [payload.new, ...(prev[payload.new.vehicle_id] || [])],
        }))
      })
      .subscribe()

    const historyChannel = supabase
      .channel('history-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stage_history' }, (payload) => {
        setStageHistory((prev) => {
          const vid = payload.new?.vehicle_id || payload.old?.vehicle_id
          const list = prev[vid] ? [...prev[vid]] : []
          if (payload.eventType === 'INSERT') list.push(payload.new)
          else if (payload.eventType === 'UPDATE') {
            const idx = list.findIndex((h) => h.id === payload.new.id)
            if (idx >= 0) list[idx] = payload.new
          }
          return { ...prev, [vid]: list }
        })
      })
      .subscribe()

    const billsChannel = supabase
      .channel('bills-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_bills' }, (payload) => {
        setBills((prev) => {
          const vid = payload.new?.vehicle_id || payload.old?.vehicle_id
          const list = prev[vid] ? [...prev[vid]] : []
          if (payload.eventType === 'INSERT') {
            if (!list.find((b) => b.id === payload.new.id)) list.unshift(payload.new)
          } else if (payload.eventType === 'UPDATE') {
            const i = list.findIndex((b) => b.id === payload.new.id)
            if (i >= 0) list[i] = payload.new
          } else if (payload.eventType === 'DELETE') {
            return { ...prev, [vid]: list.filter((b) => b.id !== payload.old.id) }
          }
          return { ...prev, [vid]: list }
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(vehiclesChannel)
      supabase.removeChannel(notesChannel)
      supabase.removeChannel(historyChannel)
      supabase.removeChannel(billsChannel)
    }
  }, [router, supabase])

  const notify = (message, type = 'info') => {
    const id = Date.now() + Math.random()
    setNotifications((prev) => [...prev, { id, message, type }])
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 4000)
  }

  // Only admins and the recon manager get edit controls. Everyone else
  // (guest with no session, service techs, detail techs) gets the guest
  // permission set — pipeline visible, nothing editable. Match this with the
  // is_editor() RLS check on the database side.
  const isEditor = !!(profile && (profile.role === 'admin' || profile.role === 'recon_manager'))
  const permissions = isEditor ? (ROLES[profile.role] || ROLES.guest) : ROLES.guest

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const addNote = async (vehicleId, text, noteType = 'note') => {
    const { error } = await supabase.from('notes').insert({
      vehicle_id: vehicleId,
      text,
      note_type: noteType,
      created_by_id: user.id,
      created_by_name: profile.full_name,
    })
    if (error) notify('Error adding note', 'error')
  }

  const moveVehicle = async (vehicleId, newStage, noteText = null) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId)
    if (!vehicle) return

    const currentHistory = stageHistory[vehicleId]?.find((h) => !h.exited_at)
    if (currentHistory) {
      await supabase.from('stage_history').update({ exited_at: new Date().toISOString() }).eq('id', currentHistory.id)
    }
    await supabase.from('stage_history').insert({
      vehicle_id: vehicleId, stage: newStage,
      moved_by_id: user.id, moved_by_name: profile.full_name,
    })
    const patch = { stage: newStage, updated_at: new Date().toISOString() }
    if (newStage === 'frontline') patch.frontline_at = new Date().toISOString()
    // First move into in_service stamps the recon clock. Once set we never
    // reset it — subsequent bounces back to in_service are still "in recon".
    if (newStage === 'in_service' && !vehicle.recon_started_at) {
      patch.recon_started_at = new Date().toISOString()
    }
    await supabase.from('vehicles').update(patch).eq('id', vehicleId)
    const stageName = STAGES.find((st) => st.id === newStage)?.name
    await addNote(vehicleId, `Moved to ${stageName}${noteText ? ': ' + noteText : ''}`, 'movement')
    notify(`${vehicle.year} ${vehicle.make} ${vehicle.model} → ${stageName}`, 'success')
  }

  const setPriority = async (vehicleId, priority) => {
    await supabase.from('vehicles').update({ priority, updated_at: new Date().toISOString() }).eq('id', vehicleId)
    await addNote(vehicleId, `Priority: ${PRIORITY_FLAGS[priority].label}`, 'priority')
    notify('Priority updated', 'info')
  }

  const addVehicle = async (vehicleData) => {
    const { initialNote, ...payload } = vehicleData
    // Dedupe by stock_number
    const existing = vehicles.find((v) => v.stock_number === payload.stock_number)
    if (existing) {
      const ok = confirm(`Stock #${payload.stock_number} already exists. Update it instead?`)
      if (!ok) return
      await updateVehicle(existing.id, payload)
      notify(`Updated #${payload.stock_number}`, 'success')
      setShowAddModal(false)
      return
    }
    const { data, error } = await supabase.from('vehicles').insert({
      ...payload,
      appraiser_id: user.id,
      appraiser_name: profile.full_name,
    }).select().single()

    if (error) { notify(`Error: ${error.message}`, 'error'); return }

    await supabase.from('stage_history').insert({
      vehicle_id: data.id, stage: 'stock_in',
      moved_by_id: user.id, moved_by_name: profile.full_name,
    })
    if (initialNote) await addNote(data.id, initialNote, 'note')
    if (payload.is_high_end) {
      notify(`⚠️ ${payload.make} flagged as high-end — wholesale`, 'warn')
    } else {
      notify(`${payload.year} ${payload.make} ${payload.model} added`, 'success')
    }
    setShowAddModal(false)
  }

  // updateVehicle writes audit rows for any AUDITED_FIELDS that changed
  const updateVehicle = async (vehicleId, patch) => {
    const existing = vehicles.find((v) => v.id === vehicleId)
    if (!existing) return
    const clean = { ...patch }
    delete clean.id
    clean.updated_at = new Date().toISOString()

    const auditRows = []
    AUDITED_FIELDS.forEach((k) => {
      if (k in clean) {
        const oldV = existing[k]
        const newV = clean[k]
        if (String(oldV ?? '') !== String(newV ?? '')) {
          auditRows.push({
            vehicle_id: vehicleId, field: k,
            old_value: oldV == null ? null : String(oldV),
            new_value: newV == null ? null : String(newV),
            changed_by_id: user.id, changed_by_name: profile.full_name,
          })
        }
      }
    })

    const { error } = await supabase.from('vehicles').update(clean).eq('id', vehicleId)
    if (error) { notify(`Error: ${error.message}`, 'error'); return }
    if (auditRows.length) await supabase.from('vehicle_audit').insert(auditRows)
    notify('Saved', 'success')
    setEditingVehicle(null)
  }

  const rejectVehicle = async (vehicleId, reason) => {
    await updateVehicle(vehicleId, { is_rejected: true, reject_reason: reason, priority: 'none' })
    await addNote(vehicleId, `Flagged for wholesale: ${reason}`, 'priority')
  }

  const deleteVehicle = async (vehicleId) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId)
    if (error) notify(`Delete failed: ${error.message}`, 'error')
    else { notify('Vehicle deleted', 'success'); setEditingVehicle(null); setSelectedVehicle(null) }
  }

  // Shop bills
  const addBill = async (vehicleId, data) => {
    const { error } = await supabase.from('shop_bills').insert({
      vehicle_id: vehicleId,
      shop: data.shop,
      category: data.category,
      invoice_number: data.invoice_number || null,
      description: data.description || null,
      amount: data.amount,
      billed_on: data.billed_on || null,
      entered_by_id: user.id,
      entered_by_name: profile.full_name,
    })
    if (error) { notify(`Error adding bill: ${error.message}`, 'error'); return }
    // Roll up: update vehicle.actual_cost to sum of all bills
    const vehicleBills = [...(bills[vehicleId] || []), { amount: data.amount }]
    const total = vehicleBills.reduce((a, b) => a + (Number(b.amount) || 0), 0)
    await supabase.from('vehicles').update({ actual_cost: total, updated_at: new Date().toISOString() }).eq('id', vehicleId)
    await addNote(vehicleId, `Shop bill: ${formatMoney(data.amount)} · ${data.shop}${data.description ? ` · ${data.description}` : ''}`, 'note')
    notify(`Bill added: ${formatMoney(data.amount)}`, 'success')
  }

  const deleteBill = async (billId, vehicleId) => {
    const { error } = await supabase.from('shop_bills').delete().eq('id', billId)
    if (error) { notify(`Error: ${error.message}`, 'error'); return }
    const remaining = (bills[vehicleId] || []).filter((b) => b.id !== billId)
    const total = remaining.reduce((a, b) => a + (Number(b.amount) || 0), 0)
    await supabase.from('vehicles').update({ actual_cost: total, updated_at: new Date().toISOString() }).eq('id', vehicleId)
    notify('Bill removed', 'info')
  }

  // Bulk move vehicles to a stage (used from inventory view)
  const bulkMove = async (vehicleIds, newStage) => {
    const now = new Date().toISOString()
    for (const vehicleId of vehicleIds) {
      const vehicle = vehicles.find((v) => v.id === vehicleId)
      if (!vehicle || vehicle.stage === newStage) continue
      const currentHistory = stageHistory[vehicleId]?.find((h) => !h.exited_at)
      if (currentHistory) {
        await supabase.from('stage_history').update({ exited_at: now }).eq('id', currentHistory.id)
      }
      await supabase.from('stage_history').insert({
        vehicle_id: vehicleId, stage: newStage,
        moved_by_id: user.id, moved_by_name: profile.full_name,
      })
      const patch = { stage: newStage, updated_at: now }
      if (newStage === 'frontline') patch.frontline_at = now
      await supabase.from('vehicles').update(patch).eq('id', vehicleId)
    }
    notify(`Moved ${vehicleIds.length} vehicle${vehicleIds.length === 1 ? '' : 's'} to ${STAGES.find((s) => s.id === newStage)?.name}`, 'success')
  }

  // Bulk import
  const importVehicles = async (rows, fileName, onProgress) => {
    let created = 0, updated = 0, rejected = 0, errors = 0
    const errorDetails = []
    // Track stock numbers we've already inserted/updated during THIS run so
    // same-CSV duplicates become updates instead of unique-index violations.
    const seenStocks = new Map()

    // Columns we actually write to the DB. Anything else in the row is dropped
    // so unmapped/junk CSV columns don't cause "column does not exist" errors.
    const DB_COLS = new Set([
      'stock_number', 'vin', 'year', 'make', 'model', 'trim', 'body_style',
      'exterior_color', 'interior_color', 'mileage', 'drivetrain', 'fuel_type',
      'transmission', 'engine', 'grade', 'service_location', 'estimated_cost',
      'actual_cost', 'priority', 'decision', 'vendors', 'stage',
      'acquisition_source', 'acquisition_date', 'purchase_price',
      'target_frontline_date', 'asking_price', 'photos', 'origin_class',
      'is_high_end', 'is_rejected', 'reject_reason',
      'cost_mechanical', 'cost_body', 'cost_detail', 'cost_parts', 'cost_vendor',
      'external_id', 'appraiser_id', 'appraiser_name',
    ])

    const sanitize = (row) => {
      const clean = {}
      for (const [k, v] of Object.entries(row)) {
        if (!DB_COLS.has(k)) continue
        // Normalize empty strings to null so NOT-NULL-but-nullable columns
        // and CHECK constraints stop rejecting them.
        if (typeof v === 'string' && v.trim() === '') continue
        clean[k] = v
      }
      return clean
    }

    // Fields that are safe to refresh from the daily DMS export. Anything
    // not in this list (stage, priority, is_rejected, bills, notes, etc.) is
    // never touched by re-imports — that's the user's workflow state and the
    // import has no opinion on it.
    const UPDATE_SAFE_FIELDS = new Set([
      'year', 'make', 'model', 'trim', 'body_style', 'vin',
      'exterior_color', 'interior_color', 'mileage',
      'drivetrain', 'fuel_type', 'transmission', 'engine',
      'asking_price', 'purchase_price',
      'acquisition_date', 'acquisition_source',
      'origin_class', 'service_location', 'grade',
      'estimated_cost', 'external_id',
    ])

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        if (!row.stock_number) throw new Error('missing stock number')
        if (!row.year) throw new Error('missing year')
        if (!row.make) throw new Error('missing make')
        if (!row.model) throw new Error('missing model')
        const clean = sanitize(row)
        if (!clean.grade) clean.grade = 'B'

        const existing =
          seenStocks.get(clean.stock_number) ||
          vehicles.find((v) => v.stock_number === clean.stock_number || (clean.vin && v.vin === clean.vin))

        if (existing) {
          // Re-import: only refresh identity / spec fields. Preserve stage,
          // priority, is_rejected, vendors, costs, etc. so the manager's
          // workflow state isn't trampled by Micah's daily upload.
          const patch = { updated_at: new Date().toISOString() }
          for (const k of Object.keys(clean)) {
            if (UPDATE_SAFE_FIELDS.has(k)) patch[k] = clean[k]
          }
          const { error } = await supabase
            .from('vehicles')
            .update(patch)
            .eq('id', existing.id)
          if (error) throw error
          seenStocks.set(clean.stock_number, existing)
          updated++
        } else {
          // Brand-new car: full insert, default to stock_in.
          const insertPayload = {
            stage: 'stock_in', priority: 'none', vendors: [],
            ...clean,
            appraiser_id: user.id, appraiser_name: profile.full_name,
          }
          const { data, error } = await supabase
            .from('vehicles')
            .insert(insertPayload)
            .select()
            .single()
          if (error) throw error
          await supabase.from('stage_history').insert({
            vehicle_id: data.id,
            stage: 'stock_in',
            moved_by_id: user.id,
            moved_by_name: profile.full_name,
          })
          seenStocks.set(clean.stock_number, data)
          created++
          if (clean.is_rejected) rejected++
        }
      } catch (e) {
        errors++
        const msg = e?.message || e?.details || String(e)
        errorDetails.push({
          row: i + 1,
          stock: row.stock_number || '(no stock#)',
          vehicle: [row.year, row.make, row.model].filter(Boolean).join(' ') || '(incomplete)',
          message: msg,
        })
        console.error('Import row failed', row, e)
      }
      onProgress?.(i + 1)
    }

    await supabase.from('inventory_imports').insert({
      source: 'csv',
      file_name: fileName,
      rows_total: rows.length,
      rows_created: created,
      rows_updated: updated,
      rows_rejected: rejected,
      rows_skipped: errors,
      meta: errorDetails.length ? { errors: errorDetails.slice(0, 50) } : {},
      imported_by_id: user.id,
      imported_by_name: profile.full_name,
    })
    const msg = errors
      ? `Imported ${created} new, ${updated} updated — ${errors} failed (see details)`
      : `Import complete: ${created} new, ${updated} updated`
    notify(msg, errors ? 'warn' : 'success')
    return { created, updated, rejected, errors, errorDetails }
  }

  const exportInventory = () => {
    const csv = exportCsv(vehicles)
    downloadFile(csv, `union-park-inventory-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Aging alerts list (for header dropdown). Uses per-stage red thresholds
  // from stage_settings — a car only shows here if it's past its own stage's
  // red_at_days, not because of any single hardcoded number.
  const agingAlerts = vehicles
    .filter((v) => v.stage !== 'frontline' && !v.is_rejected)
    .filter((v) => getStageStatus(stageHistory[v.id], v.stage, stageSettings) === 'red')
    .sort((a, b) => getTotalDays(b) - getTotalDays(a))

  // Shop workload: how many cars are actively at each service shop right now.
  // Shows next to the header so it's visible without changing tabs.
  const shopWorkload = {
    gmc: vehicles.filter((v) => v.stage === 'in_service' && v.service_location === 'gmc' && !v.is_rejected).length,
    honda: vehicles.filter((v) => v.stage === 'in_service' && v.service_location === 'honda' && !v.is_rejected).length,
    unassigned: vehicles.filter((v) => v.stage === 'in_service' && !v.service_location && !v.is_rejected).length,
  }

  const getStageCount = (stageId) => vehicles.filter((v) => v.stage === stageId && !v.is_rejected).length

  const openVehicle = useCallback((v) => setSelectedVehicle(v), [])
  const openEdit = useCallback((v) => { setSelectedVehicle(null); setEditingVehicle(v) }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading…</div>
      </div>
    )
  }

  const liveSelected = selectedVehicle ? vehicles.find((v) => v.id === selectedVehicle.id) : null
  const liveEditing = editingVehicle ? vehicles.find((v) => v.id === editingVehicle.id) : null

  return (
    <div>
      <div style={s.notifBar}>
        {notifications.map((n) => <div key={n.id} style={s.notif(n.type)}>{n.message}</div>)}
      </div>

      <header style={s.header}>
        <div>
          <div style={s.logo}>Union Park</div>
          <div style={s.logoSub}>Buick GMC • Recon Tracker</div>
        </div>
        <div style={s.headerRight}>
          {profile ? (
            <span style={s.userInfo}>
              {profile.full_name} <span style={{ fontSize: 10, opacity: 0.7 }}>({profile.role})</span>
              {!isEditor && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 3 }}>read-only</span>}
            </span>
          ) : (
            <span style={s.userInfo}>
              <span style={{ fontSize: 11, padding: '3px 8px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 3 }}>👁 Viewing as guest</span>
            </span>
          )}
          <div style={{ position: 'relative' }}>
            <button style={s.btn('alert', agingAlerts.length)} onClick={() => setShowAlerts(!showAlerts)}>
              ⚠️ Alerts {agingAlerts.length > 0 && `(${agingAlerts.length})`}
            </button>
            {showAlerts && (
              <div style={s.alertDrop}>
                <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, fontSize: 13 }}>
                  ⚠️ Aging Alerts ({agingAlerts.length})
                </div>
                {agingAlerts.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#64748b', fontSize: 12 }}>All clear! 🎉</div>
                ) : agingAlerts.map((v) => (
                  <div key={v.id} style={s.alertItem} onClick={() => { openVehicle(v); setShowAlerts(false) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{v.year} {v.make} {v.model}</div>
                      <span style={s.gradeBadge(v.grade)}>{v.grade}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>#{v.stock_number} • {STAGES.find((x) => x.id === v.stage)?.name}</div>
                    <div style={{ fontSize: 10, color: '#ef4444' }}>⏰ {getTotalDays(v)} days</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {permissions.canImport && <button style={s.btn('import')} onClick={() => setShowImportModal(true)}>📥 Daily Import</button>}
          {permissions.canAddVehicles && <button style={s.btn('add')} onClick={() => setShowAddModal(true)}>+ Add Car</button>}
          {profile?.role === 'admin' && <button style={s.btn()} onClick={() => setShowStageSettings(true)} title="Edit stage aging thresholds">⚙️ Thresholds</button>}
          <a href="/board" target="_blank" rel="noopener noreferrer" style={{ ...s.btn(), textDecoration: 'none' }}>📺 TV</a>
          <a href="/sales" target="_blank" rel="noopener noreferrer" style={{ ...s.btn(), textDecoration: 'none' }}>🚗 Sales</a>
          {profile ? (
            <button style={s.btn()} onClick={handleLogout}>Logout</button>
          ) : (
            <a href="/login" style={{ ...s.btn(), textDecoration: 'none' }}>🔐 Sign in to edit</a>
          )}
        </div>
      </header>

      <div style={s.tabs}>
        {TABS.map((t) => (
          <button key={t.id} style={s.tab(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <main style={s.main}>
        {tab === 'pipeline' && (
          <>
            <div style={s.grid}>
              <div style={s.stat(false)}><div style={s.statLabel}>In Recon</div><div style={s.statVal}>{vehicles.filter((v) => v.stage !== 'frontline' && !v.is_rejected).length}</div></div>
              <div style={s.stat(false)}><div style={s.statLabel}>Frontline</div><div style={{ ...s.statVal, color: '#22c55e' }}>{vehicles.filter((v) => v.stage === 'frontline').length}</div></div>
              <div style={s.stat(agingAlerts.length > 0)}><div style={s.statLabel}>Overdue</div><div style={{ ...s.statVal, color: agingAlerts.length > 0 ? '#ef4444' : '#22c55e' }}>{agingAlerts.length}</div></div>
            </div>

            <div style={s.shopStrip}>
              <div style={s.shopChip('#6366f1')}>
                <span style={{ fontSize: 20 }}>🛠️</span>
                <div>
                  <div style={s.shopChipLabel}>GMC Service</div>
                  <div style={s.shopChipVal}>{shopWorkload.gmc}</div>
                  <div style={s.shopChipSub}>in service now</div>
                </div>
              </div>
              <div style={s.shopChip('#ef4444')}>
                <span style={{ fontSize: 20 }}>🛠️</span>
                <div>
                  <div style={s.shopChipLabel}>Honda Service</div>
                  <div style={s.shopChipVal}>{shopWorkload.honda}</div>
                  <div style={s.shopChipSub}>in service now</div>
                </div>
              </div>
              {shopWorkload.unassigned > 0 && (
                <div style={s.shopChip('#f59e0b')}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <div>
                    <div style={s.shopChipLabel}>Unassigned</div>
                    <div style={s.shopChipVal}>{shopWorkload.unassigned}</div>
                    <div style={s.shopChipSub}>no shop set</div>
                  </div>
                </div>
              )}
            </div>

            <PipelineView
              vehicles={vehicles}
              stageHistory={stageHistory}
              stageSettings={stageSettings}
              onOpen={openVehicle}
              onDropMove={(id, stage) => moveVehicle(id, stage)}
              canMoveTo={(stage) => permissions.canMoveAnyStage || permissions.allowedStages?.includes(stage)}
            />
          </>
        )}

        {tab === 'inventory' && (
          <InventoryView
            vehicles={vehicles}
            onOpen={openVehicle}
            onEdit={openEdit}
            onExport={exportInventory}
            canEdit={permissions.canEditAnyField}
            onBulkMove={bulkMove}
          />
        )}

      </main>

      {showAddModal && <AddModal onClose={() => setShowAddModal(false)} onAdd={addVehicle} />}
      {showImportModal && permissions.canImport && (
        <ImportModal onClose={() => setShowImportModal(false)} onImport={importVehicles} />
      )}
      {showStageSettings && profile?.role === 'admin' && (
        <StageSettingsModal
          settings={stageSettings}
          onClose={() => setShowStageSettings(false)}
          onSave={async (rows) => {
            for (const r of rows) {
              await supabase.from('stage_settings').upsert({
                stage_id: r.stage_id,
                yellow_at_days: r.yellow_at_days,
                red_at_days: r.red_at_days,
                updated_at: new Date().toISOString(),
                updated_by_id: user.id,
                updated_by_name: profile.full_name,
              }, { onConflict: 'stage_id' })
            }
            const bystage = {}
            for (const r of rows) bystage[r.stage_id] = r
            setStageSettings((prev) => ({ ...prev, ...bystage }))
            notify('Thresholds saved', 'success')
          }}
        />
      )}
      {liveSelected && !editingVehicle && (
        <DetailModal
          vehicle={liveSelected}
          notes={notes[liveSelected.id]}
          stageHistory={stageHistory[liveSelected.id]}
          bills={bills[liveSelected.id]}
          permissions={permissions}
          onClose={() => setSelectedVehicle(null)}
          onAddNote={addNote}
          onMoveStage={moveVehicle}
          onSetPriority={setPriority}
          onEdit={() => openEdit(liveSelected)}
          onReject={rejectVehicle}
          onAddBill={addBill}
          onDeleteBill={deleteBill}
        />
      )}
      {liveEditing && (
        <EditModal
          vehicle={liveEditing}
          onClose={() => setEditingVehicle(null)}
          onSave={(patch) => updateVehicle(liveEditing.id, patch)}
          onDelete={deleteVehicle}
          onReject={rejectVehicle}
          canDelete={permissions.canMoveAnyStage}
          canReject={permissions.canReject}
        />
      )}
    </div>
  )
}
