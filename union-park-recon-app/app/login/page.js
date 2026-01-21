'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    },
    card: {
      background: 'rgba(30, 41, 59, 0.9)',
      borderRadius: '16px',
      padding: '40px',
      width: '100%',
      maxWidth: '400px',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    },
    logo: {
      textAlign: 'center',
      marginBottom: '32px',
    },
    logoText: {
      fontSize: '28px',
      fontWeight: '700',
      color: '#dc2626',
      marginBottom: '4px',
    },
    logoSub: {
      fontSize: '12px',
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '2px',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    label: {
      fontSize: '12px',
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    input: {
      padding: '14px 16px',
      background: 'rgba(15, 23, 42, 0.8)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      color: '#f1f5f9',
      fontSize: '15px',
      outline: 'none',
      transition: 'border-color 0.2s',
    },
    button: {
      padding: '16px',
      background: 'linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)',
      border: 'none',
      borderRadius: '8px',
      color: 'white',
      fontSize: '16px',
      fontWeight: '700',
      cursor: 'pointer',
      marginTop: '10px',
      opacity: loading ? 0.7 : 1,
    },
    error: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid #ef4444',
      borderRadius: '8px',
      padding: '12px',
      color: '#fca5a5',
      fontSize: '14px',
      textAlign: 'center',
    },
    footer: {
      marginTop: '24px',
      textAlign: 'center',
      fontSize: '13px',
      color: '#64748b',
    },
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoText}>Union Park</div>
          <div style={styles.logoSub}>Buick GMC • Recon Tracker</div>
        </div>

        <form style={styles.form} onSubmit={handleLogin}>
          {error && <div style={styles.error}>{error}</div>}
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@unionpark.com"
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={styles.footer}>
          Contact admin if you need an account
        </div>
      </div>
    </div>
  )
}
