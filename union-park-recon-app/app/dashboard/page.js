'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { GRADES, STAGES, PRIORITY_FLAGS, VENDORS, SERVICE_LOCATIONS, ROLES, INSPECTION_CHECKLIST } from '@/lib/constants'
import { getTotalDays, getCurrentStageDays, isStageOverdue, getHoldingCost, formatTimeAgo, formatDate, getNextStage } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [notes, setNotes] = useState({})
  const [stageHistory, setStageHistory] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [notifications, setNotifications] = useState([])

  // Load user and data
  useEffect(() => {
    const loadData = async () => {
      // Check auth
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)

      // Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      setProfile(profileData)

      // Load vehicles
      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false })
      setVehicles(vehiclesData || [])

      // Load notes for all vehicles
      const { data: notesData } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false })
      
      const notesByVehicle = {}
      notesData?.forEach(note => {
        if (!notesByVehicle[note.vehicle_id]) notesByVehicle[note.vehicle_id] = []
        notesByVehicle[note.vehicle_id].push(note)
      })
      setNotes(notesByVehicle)

      // Load stage history
      const { data: historyData } = await supabase
        .from('stage_history')
        .select('*')
        .order('entered_at', { ascending: true })
      
      const historyByVehicle = {}
      historyData?.forEach(h => {
        if (!historyByVehicle[h.vehicle_id]) historyByVehicle[h.vehicle_id] = []
        historyByVehicle[h.vehicle_id].push(h)
      })
      setStageHistory(historyByVehicle)

      setLoading(false)
    }

    loadData()

    // Set up realtime subscriptions
    const vehiclesChannel = supabase
      .channel('vehicles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setVehicles(prev => [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setVehicles(prev => prev.map(v => v.id === payload.new.id ? payload.new : v))
        } else if (payload.eventType === 'DELETE') {
          setVehicles(prev => prev.filter(v => v.id !== payload.old.id))
        }
      })
      .subscribe()

    const notesChannel = supabase
      .channel('notes-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (payload) => {
        setNotes(prev => ({
          ...prev,
          [payload.new.vehicle_id]: [payload.new, ...(prev[payload.new.vehicle_id] || [])]
        }))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(vehiclesChannel)
      supabase.removeChannel(notesChannel)
    }
  }, [router, supabase])

  // Notification helper
  const addNotification = (message, type = 'info') => {
    const id = Date.now()
    setNotifications(prev => [...prev, { id, message, type }])
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000)
  }

  // Get user permissions
  const permissions = profile ? ROLES[profile.role] || ROLES.service : ROLES.service

  // Add a note
  const addNote = async (vehicleId, text, noteType = 'note') => {
    const { error } = await supabase.from('notes').insert({
      vehicle_id: vehicleId,
      text,
      note_type: noteType,
      created_by_id: user.id,
      created_by_name: profile.full_name,
    })
    if (error) {
      addNotification('Error adding note', 'error')
    }
  }

  // Move vehicle to new stage
  const moveVehicle = async (vehicleId, newStage, noteText = null) => {
    const vehicle = vehicles.find(v => v.id === vehicleId)
    if (!vehicle) return

    // Update current stage history entry
    const currentHistory = stageHistory[vehicleId]?.find(h => !h.exited_at)
    if (currentHistory) {
      await supabase
        .from('stage_history')
        .update({ exited_at: new Date().toISOString() })
        .eq('id', currentHistory.id)
    }

    // Create new stage history entry
    await supabase.from('stage_history').insert({
      vehicle_id: vehicleId,
      stage: newStage,
      moved_by_id: user.id,
      moved_by_name: profile.full_name,
    })

    // Update vehicle stage
    await supabase
      .from('vehicles')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', vehicleId)

    // Add movement note
    const stageName = STAGES.find(s => s.id === newStage)?.name
    await addNote(vehicleId, `Moved to ${stageName}${noteText ? ': ' + noteText : ''}`, 'movement')

    addNotification(`${vehicle.year} ${vehicle.make} ${vehicle.model} → ${stageName}`, 'success')
  }

  // Set vehicle priority
  const setPriority = async (vehicleId, priority) => {
    await supabase
      .from('vehicles')
      .update({ priority, updated_at: new Date().toISOString() })
      .eq('id', vehicleId)
    
    await addNote(vehicleId, `Priority: ${PRIORITY_FLAGS[priority].label}`, 'priority')
    addNotification(`Priority updated`, 'info')
  }

  // Add new vehicle
  const addVehicle = async (vehicleData) => {
    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        ...vehicleData,
        appraiser_id: user.id,
        appraiser_name: profile.full_name,
      })
      .select()
      .single()

    if (error) {
      addNotification('Error adding vehicle', 'error')
      return
    }

    // Create initial stage history
    await supabase.from('stage_history').insert({
      vehicle_id: data.id,
      stage: 'appraisal',
      moved_by_id: user.id,
      moved_by_name: profile.full_name,
    })

    // Add initial note if provided
    if (vehicleData.initialNote) {
      await addNote(data.id, vehicleData.initialNote, 'note')
    }

    addNotification(`${vehicleData.year} ${vehicleData.make} ${vehicleData.model} added`, 'success')
    setShowAddModal(false)
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Calculate aging alerts
  const agingAlerts = vehicles
    .filter(v => v.stage !== 'frontline')
    .filter(v => isStageOverdue(stageHistory[v.id], v.stage) || getTotalDays(v.created_at) > 5)
    .sort((a, b) => getTotalDays(b.created_at) - getTotalDays(a.created_at))

  const getStageCount = (stageId) => vehicles.filter(v => v.stage === stageId).length

  // Styles
  const s = {
    header: { background: 'linear-gradient(90deg, #dc2626, #b91c1c)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
    logo: { fontSize: '20px', fontWeight: '700' },
    logoSub: { fontSize: '10px', opacity: 0.9, letterSpacing: '1px', textTransform: 'uppercase' },
    headerRight: { display: 'flex', gap: '10px', alignItems: 'center' },
    userInfo: { fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginRight: '8px' },
    btn: (variant) => ({ padding: '8px 14px', background: variant === 'alert' && agingAlerts.length > 0 ? '#f59e0b' : variant === 'add' ? '#22c55e' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }),
    main: { padding: '20px', maxWidth: '1700px', margin: '0 auto' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' },
    stat: (alert) => ({ background: alert ? 'rgba(239,68,68,0.15)' : 'rgba(30,41,59,0.8)', borderRadius: '10px', padding: '14px', border: `1px solid ${alert ? '#ef4444' : 'rgba(255,255,255,0.1)'}` }),
    statLabel: { fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' },
    statVal: { fontSize: '26px', fontWeight: '700' },
    pipeline: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' },
    stageCard: (color) => ({ background: 'rgba(30,41,59,0.8)', borderRadius: '10px', border: `2px solid ${color}`, overflow: 'hidden' }),
    stageHead: (color) => ({ background: `${color}22`, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${color}44` }),
    stageName: { fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' },
    stageCount: (color) => ({ background: color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }),
    vList: { padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' },
    vCard: (priority, overdue) => ({ background: overdue ? 'rgba(239,68,68,0.1)' : 'rgba(15,23,42,0.6)', borderRadius: '6px', padding: '10px', cursor: 'pointer', border: `1px solid ${overdue ? '#ef4444' : priority !== 'none' ? PRIORITY_FLAGS[priority].color : 'rgba(255,255,255,0.05)'}`, position: 'relative' }),
    priBadge: (p) => ({ position: 'absolute', top: '-4px', right: '-4px', background: PRIORITY_FLAGS[p]?.color, padding: '2px 5px', borderRadius: '3px', fontSize: '8px', fontWeight: '700' }),
    vTitle: { fontSize: '12px', fontWeight: '600', marginBottom: '2px' },
    vStock: { fontSize: '9px', color: '#64748b' },
    gradeBadge: (g) => ({ background: GRADES[g]?.color, padding: '2px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: '700' }),
    daysInd: (d, max) => ({ fontSize: '9px', color: (max && d > max) || d > 5 ? '#ef4444' : d > 3 ? '#f59e0b' : '#22c55e', fontWeight: '600' }),
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalBox: { background: '#1e293b', borderRadius: '12px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)' },
    modalHead: { padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#1e293b', zIndex: 10 },
    modalTitle: { fontSize: '15px', fontWeight: '700' },
    closeBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' },
    modalBody: { padding: '18px' },
    formGroup: { marginBottom: '12px' },
    label: { display: 'block', fontSize: '10px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
    input: { width: '100%', padding: '9px 11px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px', boxSizing: 'border-box' },
    textarea: { width: '100%', padding: '9px 11px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' },
    gradeGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' },
    gradeBtn: (g, sel) => ({ padding: '8px', background: sel ? GRADES[g].color : 'rgba(15,23,42,0.8)', border: `2px solid ${GRADES[g].color}`, borderRadius: '6px', color: 'white', cursor: 'pointer', textAlign: 'center' }),
    vendorGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' },
    vendorBox: (checked) => ({ padding: '7px', background: checked ? 'rgba(59,130,246,0.2)' : 'rgba(15,23,42,0.8)', border: `1px solid ${checked ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }),
    submitBtn: { width: '100%', padding: '11px', background: 'linear-gradient(90deg, #dc2626, #b91c1c)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', marginTop: '10px' },
    detailHead: { padding: '14px 18px', background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    detailTitle: { fontSize: '18px', fontWeight: '700', marginBottom: '6px' },
    detailMeta: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', fontSize: '11px', color: '#94a3b8' },
    priSection: { padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    priBtns: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
    priBtn: (p, active) => ({ padding: '4px 8px', background: active ? PRIORITY_FLAGS[p].color : 'rgba(15,23,42,0.8)', border: `1px solid ${PRIORITY_FLAGS[p].color}`, borderRadius: '4px', color: 'white', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }),
    notesSection: { padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    notesList: { maxHeight: '160px', overflowY: 'auto' },
    noteItem: (type) => ({ padding: '8px', background: type === 'priority' ? 'rgba(245,158,11,0.1)' : type === 'parts' ? 'rgba(59,130,246,0.1)' : type === 'movement' ? 'rgba(34,197,94,0.1)' : 'rgba(15,23,42,0.6)', borderRadius: '5px', marginBottom: '5px', borderLeft: `3px solid ${type === 'priority' ? '#f59e0b' : type === 'parts' ? '#3b82f6' : type === 'movement' ? '#22c55e' : '#64748b'}` }),
    noteText: { fontSize: '12px', marginBottom: '3px' },
    noteMeta: { fontSize: '9px', color: '#64748b' },
    addNoteForm: { display: 'flex', gap: '6px', marginTop: '8px' },
    timelineGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '5px', padding: '12px 18px' },
    timelineItem: (active, complete, overdue) => ({ padding: '6px', background: active ? 'rgba(59,130,246,0.2)' : complete ? 'rgba(34,197,94,0.1)' : 'rgba(15,23,42,0.6)', borderRadius: '5px', border: `1px solid ${overdue ? '#ef4444' : active ? '#3b82f6' : complete ? '#22c55e' : 'rgba(255,255,255,0.05)'}`, textAlign: 'center', opacity: active || complete ? 1 : 0.4 }),
    costBar: { padding: '12px 18px', background: 'rgba(15,23,42,0.5)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center' },
    costLabel: { fontSize: '9px', color: '#64748b', marginBottom: '2px' },
    costVal: { fontSize: '18px', fontWeight: '700' },
    actionBar: { display: 'flex', gap: '6px', padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap' },
    actionBtn: (primary, color) => ({ flex: primary ? 1 : 'none', padding: '9px 12px', background: primary ? (color || 'linear-gradient(90deg, #22c55e, #16a34a)') : 'rgba(15,23,42,0.8)', border: primary ? 'none' : '1px solid rgba(255,255,255,0.2)', borderRadius: '5px', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }),
    alertDrop: { position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#1e293b', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', width: '320px', maxHeight: '350px', overflow: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', zIndex: 100 },
    alertItem: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' },
    notifBar: { position: 'fixed', top: '70px', right: '20px', display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 1001 },
    notif: (type) => ({ padding: '10px 16px', background: type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6', borderRadius: '6px', color: 'white', fontWeight: '500', fontSize: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }),
    prioritySection: { background: 'rgba(30,41,59,0.8)', borderRadius: '10px', border: '2px solid #f59e0b', marginBottom: '16px', overflow: 'hidden' },
    priorityHeader: { background: 'rgba(245,158,11,0.1)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(245,158,11,0.3)', fontWeight: '600', fontSize: '13px' },
    priorityList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px', padding: '10px' },
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    )
  }

  // Add Vehicle Modal Component
  const AddModal = () => {
    const [form, setForm] = useState({ stock_number: '', year: '', make: '', model: '', vin: '', grade: '', service_location: '', estimated_cost: '', vendors: [], initialNote: '' })
    const submit = (e) => {
      e.preventDefault()
      addVehicle({
        ...form,
        year: parseInt(form.year),
        estimated_cost: parseFloat(form.estimated_cost) || 0,
        vendors: form.vendors,
      })
    }
    const toggleVendor = (id) => setForm(prev => ({ ...prev, vendors: prev.vendors.includes(id) ? prev.vendors.filter(v => v !== id) : [...prev.vendors, id] }))
    
    return (
      <div style={s.modal} onClick={() => setShowAddModal(false)}>
        <div style={s.modalBox} onClick={e => e.stopPropagation()}>
          <div style={s.modalHead}><div style={s.modalTitle}>Add Vehicle</div><button style={s.closeBtn} onClick={() => setShowAddModal(false)}>×</button></div>
          <form style={s.modalBody} onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={s.formGroup}><label style={s.label}>Stock #</label><input style={s.input} value={form.stock_number} onChange={e => setForm(p => ({ ...p, stock_number: e.target.value }))} required /></div>
              <div style={s.formGroup}><label style={s.label}>Year</label><input style={s.input} type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} required /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={s.formGroup}><label style={s.label}>Make</label><input style={s.input} value={form.make} onChange={e => setForm(p => ({ ...p, make: e.target.value }))} required /></div>
              <div style={s.formGroup}><label style={s.label}>Model</label><input style={s.input} value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} required /></div>
            </div>
            <div style={s.formGroup}><label style={s.label}>VIN</label><input style={s.input} value={form.vin} onChange={e => setForm(p => ({ ...p, vin: e.target.value.toUpperCase() }))} maxLength={17} /></div>
            <div style={s.formGroup}><label style={s.label}>Grade</label>
              <div style={s.gradeGrid}>{Object.entries(GRADES).map(([k, g]) => (<div key={k} style={s.gradeBtn(k, form.grade === k)} onClick={() => setForm(p => ({ ...p, grade: k }))}><div style={{ fontWeight: '700', fontSize: '14px' }}>{k}</div><div style={{ fontSize: '9px' }}>≤${g.maxCost}</div></div>))}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={s.formGroup}><label style={s.label}>Service Location</label><select style={s.input} value={form.service_location} onChange={e => setForm(p => ({ ...p, service_location: e.target.value }))} required><option value="">Select...</option><option value="gmc">GMC (Domestics)</option><option value="honda">Honda (Imports)</option></select></div>
              <div style={s.formGroup}><label style={s.label}>Est. Cost</label><input style={s.input} type="number" value={form.estimated_cost} onChange={e => setForm(p => ({ ...p, estimated_cost: e.target.value }))} /></div>
            </div>
            <div style={s.formGroup}><label style={s.label}>Vendors Needed</label>
              <div style={s.vendorGrid}>{Object.entries(VENDORS).map(([id, v]) => (<div key={id} style={s.vendorBox(form.vendors.includes(id))} onClick={() => toggleVendor(id)}><div style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid #3b82f6', background: form.vendors.includes(id) ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10 }}>{form.vendors.includes(id) && '✓'}</div><div><div style={{ fontWeight: 500 }}>{v.name}</div><div style={{ fontSize: 9, color: '#64748b' }}>{v.days.join(', ')}</div></div></div>))}</div>
            </div>
            <div style={s.formGroup}><label style={s.label}>Note</label><textarea style={s.textarea} value={form.initialNote} onChange={e => setForm(p => ({ ...p, initialNote: e.target.value }))} placeholder="Optional notes..." /></div>
            <button type="submit" style={s.submitBtn}>Add to Pipeline</button>
          </form>
        </div>
      </div>
    )
  }

  // Vehicle Detail Modal Component
  const DetailModal = ({ v }) => {
    const [newNote, setNewNote] = useState('')
    const [showParts, setShowParts] = useState(false)
    const [parts, setParts] = useState({ partName: '', partNumber: '', supplier: '', days: 2 })
    const vehicleNotes = notes[v.id] || []
    const vehicleHistory = stageHistory[v.id] || []
    const overdue = isStageOverdue(vehicleHistory, v.stage)
    
    const handleNote = () => {
      if (newNote.trim()) {
        addNote(v.id, newNote.trim())
        setNewNote('')
      }
    }

    const handlePartsHold = async () => {
      await supabase.from('parts_holds').insert({
        vehicle_id: v.id,
        part_name: parts.partName,
        part_number: parts.partNumber,
        supplier: parts.supplier,
        expected_at: new Date(Date.now() + parts.days * 24 * 60 * 60 * 1000).toISOString(),
        ordered_by_id: user.id,
        ordered_by_name: profile.full_name,
      })
      await moveVehicle(v.id, 'parts_hold', `Waiting: ${parts.partName}`)
      setShowParts(false)
    }

    const getNext = () => getNextStage(v.stage, v.vendors?.length > 0)

    return (
      <div style={s.modal} onClick={() => setSelectedVehicle(null)}>
        <div style={{ ...s.modalBox, maxWidth: 700 }} onClick={e => e.stopPropagation()}>
          <div style={s.detailHead}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={s.detailTitle}>{v.year} {v.make} {v.model}</div>
                  {v.priority !== 'none' && <span style={{ background: PRIORITY_FLAGS[v.priority].color, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{PRIORITY_FLAGS[v.priority].icon} {PRIORITY_FLAGS[v.priority].label}</span>}
                  {overdue && <span style={{ background: '#ef4444', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>⚠️ OVERDUE</span>}
                </div>
                <div style={s.detailMeta}>
                  <span>Stock: {v.stock_number}</span>
                  {v.vin && <span>VIN: {v.vin}</span>}
                  <span style={s.gradeBadge(v.grade)}>Grade {v.grade}</span>
                  <span>{v.service_location === 'gmc' ? '🔧 GMC' : '🔧 Honda'}</span>
                </div>
              </div>
              <button style={s.closeBtn} onClick={() => setSelectedVehicle(null)}>×</button>
            </div>
          </div>

          {/* Priority */}
          <div style={s.priSection}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5, textTransform: 'uppercase' }}>Priority</div>
            <div style={s.priBtns}>
              {Object.entries(PRIORITY_FLAGS).map(([k, f]) => (
                <button key={k} style={s.priBtn(k, v.priority === k)} onClick={() => setPriority(v.id, k)}>{f.icon} {f.label}</button>
              ))}
            </div>
          </div>

          {/* Parts Hold Form */}
          {showParts && (
            <div style={{ padding: '0 18px 12px' }}>
              <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid #3b82f6', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Add Parts Hold</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <input style={s.input} placeholder="Part Name" value={parts.partName} onChange={e => setParts(p => ({ ...p, partName: e.target.value }))} />
                  <input style={s.input} placeholder="Part Number" value={parts.partNumber} onChange={e => setParts(p => ({ ...p, partNumber: e.target.value }))} />
                  <input style={s.input} placeholder="Supplier" value={parts.supplier} onChange={e => setParts(p => ({ ...p, supplier: e.target.value }))} />
                  <select style={s.input} value={parts.days} onChange={e => setParts(p => ({ ...p, days: parseInt(e.target.value) }))}><option value={1}>1 day</option><option value={2}>2 days</option><option value={3}>3 days</option><option value={5}>5 days</option></select>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button style={s.actionBtn(false)} onClick={() => setShowParts(false)}>Cancel</button>
                  <button style={s.actionBtn(true, '#3b82f6')} onClick={handlePartsHold}>Move to Parts Hold</button>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={s.notesSection}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>Communication Log ({vehicleNotes.length})</div>
            <div style={s.notesList}>
              {vehicleNotes.map(n => (
                <div key={n.id} style={s.noteItem(n.note_type)}>
                  <div style={s.noteText}>{n.text}</div>
                  <div style={s.noteMeta}>{n.created_by_name} • {formatTimeAgo(n.created_at)}</div>
                </div>
              ))}
              {vehicleNotes.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: '#64748b', fontSize: 11 }}>No notes yet</div>}
            </div>
            <div style={s.addNoteForm}>
              <input style={{ ...s.input, flex: 1 }} placeholder="Add a note..." value={newNote} onChange={e => setNewNote(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleNote()} />
              <button style={s.actionBtn(true)} onClick={handleNote}>Add</button>
            </div>
          </div>

          {/* Timeline */}
          <div style={s.timelineGrid}>
            {STAGES.filter(st => st.id !== 'decision').map(st => {
              const h = vehicleHistory.find(x => x.stage === st.id)
              const active = v.stage === st.id
              const complete = h?.exited_at != null
              const days = h ? Math.round((new Date(h.exited_at || new Date()) - new Date(h.entered_at)) / (1000 * 60 * 60 * 24) * 10) / 10 : 0
              const od = active && st.maxDays && days > st.maxDays
              return (
                <div key={st.id} style={s.timelineItem(active, complete, od)}>
                  <div style={{ fontSize: 12 }}>{st.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 600 }}>{st.name}</div>
                  {h && <div style={{ fontSize: 8, color: od ? '#ef4444' : '#64748b' }}>{days > 0 ? `${days}d` : '<1d'}{complete && ' ✓'}</div>}
                </div>
              )
            })}
          </div>

          {/* Costs */}
          <div style={s.costBar}>
            <div><div style={s.costLabel}>Total Days</div><div style={{ ...s.costVal, color: getTotalDays(v.created_at) > 5 ? '#ef4444' : '#22c55e' }}>{getTotalDays(v.created_at)}</div></div>
            <div><div style={s.costLabel}>Est. Cost</div><div style={s.costVal}>${v.estimated_cost?.toLocaleString() || 0}</div></div>
            <div><div style={s.costLabel}>Actual</div><div style={{ ...s.costVal, color: v.actual_cost > v.estimated_cost ? '#f59e0b' : '#22c55e' }}>${v.actual_cost?.toLocaleString() || 0}</div></div>
            <div><div style={s.costLabel}>Holding</div><div style={{ ...s.costVal, color: '#ef4444' }}>${getHoldingCost(v.created_at)}</div></div>
          </div>

          {/* Actions */}
          <div style={s.actionBar}>
            {v.stage === 'service' && !showParts && permissions.allowedStages?.includes('service') || permissions.canMoveAnyStage ? (
              <button style={s.actionBtn(false)} onClick={() => setShowParts(true)}>📦 Parts Hold</button>
            ) : null}
            {v.stage === 'parts_hold' && (
              <button style={s.actionBtn(true)} onClick={() => moveVehicle(v.id, 'service', 'Parts received')}>✓ Parts Received</button>
            )}
            {v.stage === 'approval' && permissions.canApprove && (
              <>
                <button style={s.actionBtn(false)} onClick={() => moveVehicle(v.id, 'decision', 'Wholesale review')}>Wholesale</button>
                <button style={s.actionBtn(true)} onClick={() => moveVehicle(v.id, v.vendors?.length ? 'vendor' : 'detail')}>✓ Approve</button>
              </>
            )}
            {!['approval', 'frontline', 'parts_hold'].includes(v.stage) && (permissions.canMoveAnyStage || permissions.allowedStages?.includes(v.stage)) && (
              <button style={{ ...s.actionBtn(true), flex: 1 }} onClick={() => { const next = getNext(); if (next) moveVehicle(v.id, next.id); }}>
                Move to {getNext()?.name || 'Next'} →
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Priority vehicles
  const priorityVehicles = vehicles.filter(v => v.priority !== 'none' && v.stage !== 'frontline')

  return (
    <div>
      {/* Notifications */}
      <div style={s.notifBar}>{notifications.map(n => <div key={n.id} style={s.notif(n.type)}>{n.message}</div>)}</div>

      {/* Header */}
      <header style={s.header}>
        <div><div style={s.logo}>Union Park</div><div style={s.logoSub}>Buick GMC • Recon Tracker</div></div>
        <div style={s.headerRight}>
          <span style={s.userInfo}>{profile?.full_name}</span>
          <div style={{ position: 'relative' }}>
            <button style={s.btn('alert')} onClick={() => setShowAlerts(!showAlerts)}>⚠️ Alerts {agingAlerts.length > 0 && `(${agingAlerts.length})`}</button>
            {showAlerts && (
              <div style={s.alertDrop}>
                <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, fontSize: 13 }}>⚠️ Aging Alerts ({agingAlerts.length})</div>
                {agingAlerts.length === 0 ? <div style={{ padding: 16, textAlign: 'center', color: '#64748b', fontSize: 12 }}>All clear! 🎉</div> : agingAlerts.map(v => (
                  <div key={v.id} style={s.alertItem} onClick={() => { setSelectedVehicle(v); setShowAlerts(false); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><div style={{ fontWeight: 600, fontSize: 12 }}>{v.year} {v.make} {v.model}</div><span style={s.gradeBadge(v.grade)}>{v.grade}</span></div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>#{v.stock_number} • {STAGES.find(x => x.id === v.stage)?.name}</div>
                    <div style={{ fontSize: 10, color: '#ef4444' }}>⏰ {getTotalDays(v.created_at)} days</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {permissions.canAddVehicles && <button style={s.btn('add')} onClick={() => setShowAddModal(true)}>+ Add</button>}
          <button style={s.btn()} onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* Main */}
      <main style={s.main}>
        {/* Stats */}
        <div style={s.grid}>
          <div style={s.stat(false)}><div style={s.statLabel}>Pipeline</div><div style={s.statVal}>{vehicles.filter(v => v.stage !== 'frontline').length}</div></div>
          <div style={s.stat(false)}><div style={s.statLabel}>Frontline</div><div style={{ ...s.statVal, color: '#22c55e' }}>{vehicles.filter(v => v.stage === 'frontline').length}</div></div>
          <div style={s.stat(getStageCount('approval') > 0)}><div style={s.statLabel}>Approval</div><div style={{ ...s.statVal, color: getStageCount('approval') > 0 ? '#f59e0b' : '#22c55e' }}>{getStageCount('approval')}</div></div>
          <div style={s.stat(getStageCount('parts_hold') > 0)}><div style={s.statLabel}>Parts Hold</div><div style={{ ...s.statVal, color: getStageCount('parts_hold') > 0 ? '#3b82f6' : '#22c55e' }}>{getStageCount('parts_hold')}</div></div>
          <div style={s.stat(agingAlerts.length > 0)}><div style={s.statLabel}>Overdue</div><div style={{ ...s.statVal, color: agingAlerts.length > 0 ? '#ef4444' : '#22c55e' }}>{agingAlerts.length}</div></div>
        </div>

        {/* Priority Section */}
        {priorityVehicles.length > 0 && (
          <div style={s.prioritySection}>
            <div style={s.priorityHeader}><span>🚨 Priority Vehicles</span><span style={{ color: '#f59e0b' }}>{priorityVehicles.length}</span></div>
            <div style={s.priorityList}>
              {priorityVehicles.map(v => (
                <div key={v.id} style={s.vCard(v.priority, isStageOverdue(stageHistory[v.id], v.stage))} onClick={() => setSelectedVehicle(v)}>
                  {v.priority !== 'none' && <div style={s.priBadge(v.priority)}>{PRIORITY_FLAGS[v.priority].label}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><div><div style={s.vTitle}>{v.year} {v.make} {v.model}</div><div style={s.vStock}>#{v.stock_number}</div></div><span style={s.gradeBadge(v.grade)}>{v.grade}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}><span style={{ fontSize: 10, color: '#94a3b8' }}>{STAGES.find(x => x.id === v.stage)?.icon} {STAGES.find(x => x.id === v.stage)?.name}</span><span style={s.daysInd(getTotalDays(v.created_at), 5)}>{getTotalDays(v.created_at)}d</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pipeline */}
        <div style={s.pipeline}>
          {STAGES.filter(st => st.id !== 'decision').map(st => {
            const list = vehicles.filter(v => v.stage === st.id).sort((a, b) => (a.priority !== 'none' ? -1 : 1) - (b.priority !== 'none' ? -1 : 1) || getTotalDays(b.created_at) - getTotalDays(a.created_at))
            const color = st.id === 'frontline' ? '#22c55e' : st.id === 'approval' ? '#f59e0b' : st.id === 'parts_hold' ? '#3b82f6' : ['service', 'service_queue'].includes(st.id) ? '#6366f1' : '#64748b'
            return (
              <div key={st.id} style={s.stageCard(color)}>
                <div style={s.stageHead(color)}><div style={s.stageName}>{st.icon} {st.name}</div><div style={s.stageCount(color)}>{list.length}</div></div>
                <div style={s.vList}>
                  {list.length === 0 ? <div style={{ padding: 12, textAlign: 'center', color: '#64748b', fontSize: 10 }}>Empty</div> : list.map(v => {
                    const od = isStageOverdue(stageHistory[v.id], v.stage)
                    return (
                      <div key={v.id} style={s.vCard(v.priority, od)} onClick={() => setSelectedVehicle(v)}>
                        {v.priority !== 'none' && <div style={s.priBadge(v.priority)}>{PRIORITY_FLAGS[v.priority].icon}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><div><div style={s.vTitle}>{v.year} {v.make} {v.model}</div><div style={s.vStock}>#{v.stock_number}</div></div><span style={s.gradeBadge(v.grade)}>{v.grade}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={s.daysInd(getCurrentStageDays(stageHistory[v.id], v.stage), st.maxDays)}>{getCurrentStageDays(stageHistory[v.id], v.stage)}d</span><span style={{ fontSize: 9, color: '#64748b' }}>${v.estimated_cost || 0}</span></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Modals */}
      {showAddModal && <AddModal />}
      {selectedVehicle && <DetailModal v={selectedVehicle} />}
    </div>
  )
}
