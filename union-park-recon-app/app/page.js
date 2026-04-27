'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)

  // If a manager is already signed in, send them straight to the dashboard.
  // Anyone else (TV browser, sales floor, public) sees the landing page
  // with the three entry points.
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session) router.replace('/dashboard')
      else setChecking(false)
    })
    return () => { mounted = false }
  }, [router, supabase])

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#94a3b8' }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 880, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: '#dc2626', letterSpacing: '-0.02em' }}>
            Union Park Buick GMC
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px', marginTop: 4 }}>
            Recon Tracker
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <Card
            href="/board"
            icon="📺"
            title="Live Recon Board"
            description="Real-time kanban view for the TV display. Auto-refreshes."
            color="#22c55e"
          />
          <Card
            href="/sales"
            icon="🚗"
            title="Sales Floor View"
            description="Inventory status and ETA-to-frontline for the sales team."
            color="#3b82f6"
          />
          <Card
            href="/login"
            icon="🔧"
            title="Manager Sign-In"
            description="Edit vehicles, log shop bills, manage workflow."
            color="#dc2626"
          />
        </div>

        <div style={{ textAlign: 'center', marginTop: 36, color: '#64748b', fontSize: 12 }}>
          Used Vehicle Reconditioning · Internal Tool
        </div>
      </div>
    </div>
  )
}

function Card({ href, icon, title, description, color }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        background: 'rgba(30,41,59,0.85)',
        border: `2px solid ${color}55`,
        borderRadius: 14,
        padding: '24px 20px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform .15s ease, border-color .15s, background .15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = color
        e.currentTarget.style.background = 'rgba(30,41,59,1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.borderColor = `${color}55`
        e.currentTarget.style.background = 'rgba(30,41,59,0.85)'
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color }}>{title}</div>
      <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{description}</div>
    </Link>
  )
}
