// Shared styles for dashboard views. Exported as a factory so components
// can override individual tokens when needed. Kept as inline-style objects
// to match the existing project pattern (no CSS-in-JS dep).

import { PRIORITY_FLAGS, GRADES } from '@/lib/constants'

export const s = {
  header: { background: 'linear-gradient(90deg, #dc2626, #b91c1c)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', flexWrap: 'wrap', gap: 10 },
  logo: { fontSize: '20px', fontWeight: '700' },
  logoSub: { fontSize: '10px', opacity: 0.9, letterSpacing: '1px', textTransform: 'uppercase' },
  headerRight: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  userInfo: { fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginRight: '8px' },
  btn: (variant, badge) => ({ padding: '8px 14px', background: variant === 'alert' && badge > 0 ? '#f59e0b' : variant === 'add' ? '#22c55e' : variant === 'import' ? '#3b82f6' : variant === 'export' ? '#8b5cf6' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap' }),

  tabs: { display: 'flex', gap: 4, padding: '12px 20px 0', background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)', overflowX: 'auto' },
  tab: (active) => ({ padding: '10px 18px', background: active ? 'rgba(30,41,59,0.9)' : 'transparent', border: 'none', borderBottom: `2px solid ${active ? '#dc2626' : 'transparent'}`, color: active ? 'white' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderTopLeftRadius: 8, borderTopRightRadius: 8, whiteSpace: 'nowrap' }),

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
  vList: { padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' },
  vCard: (priority, overdue) => ({ background: overdue ? 'rgba(239,68,68,0.1)' : 'rgba(15,23,42,0.6)', borderRadius: '6px', padding: '10px', cursor: 'pointer', border: `1px solid ${overdue ? '#ef4444' : priority && priority !== 'none' ? PRIORITY_FLAGS[priority]?.color : 'rgba(255,255,255,0.05)'}`, position: 'relative' }),
  priBadge: (p) => ({ position: 'absolute', top: '-4px', right: '-4px', background: PRIORITY_FLAGS[p]?.color, padding: '2px 5px', borderRadius: '3px', fontSize: '8px', fontWeight: '700' }),
  vTitle: { fontSize: '12px', fontWeight: '600', marginBottom: '2px' },
  vStock: { fontSize: '9px', color: '#64748b' },
  gradeBadge: (g) => ({ background: GRADES[g]?.color || '#64748b', padding: '2px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: '700' }),
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
  notif: (type) => ({ padding: '10px 16px', background: type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#3b82f6', borderRadius: '6px', color: 'white', fontWeight: '500', fontSize: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }),
  prioritySection: { background: 'rgba(30,41,59,0.8)', borderRadius: '10px', border: '2px solid #f59e0b', marginBottom: '16px', overflow: 'hidden' },
  priorityHeader: { background: 'rgba(245,158,11,0.1)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(245,158,11,0.3)', fontWeight: '600', fontSize: '13px' },
  priorityList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px', padding: '10px' },

  // Inventory table
  inventoryCtrl: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' },
  searchInput: { flex: 1, minWidth: 200, padding: '10px 14px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 13 },
  select: { padding: '10px 12px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 13 },
  tableWrap: { background: 'rgba(30,41,59,0.8)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '10px 12px', textAlign: 'left', background: 'rgba(15,23,42,0.6)', color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap', cursor: 'pointer' },
  td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' },
  tr: (rejected) => ({ cursor: 'pointer', opacity: rejected ? 0.55 : 1, background: rejected ? 'rgba(239,68,68,0.05)' : 'transparent' }),

  // Analytics
  panelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 },
  panel: { background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 16 },
  panelHead: { fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px', marginBottom: 10, fontWeight: 600 },
  bar: { height: 6, background: 'rgba(15,23,42,0.8)', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  barFill: (color, pct) => ({ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: color, transition: 'width .3s' }),
}
