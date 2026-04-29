'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// Auth-aware redirect. Logged in → dashboard. Logged out → login.
// Public TV / sales views live at /board and /sales and bypass this.
export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      router.replace(session ? '/dashboard' : '/login')
    }
    checkUser()
  }, [router, supabase])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Union Park Recon
        </div>
        <div style={{ color: '#64748b' }}>Loading…</div>
      </div>
    </div>
  )
}
