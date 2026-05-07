// src/components/login/LoginPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const ok = await login(email.trim(), password)
    setLoading(false)
    if (ok) {
      navigate('/hub', { replace: true })
    } else {
      setError('Email ou mot de passe incorrect.')
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 14px', borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    fontSize: 14, color: '#1e293b',
    outline: 'none', transition: 'border-color .15s',
    fontFamily: "'Inter', sans-serif",
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0b2e63 0%, #1a3a6b 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: 400,
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        padding: '48px 40px 40px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: 14,
            background: 'linear-gradient(135deg, #0f1f3d, #1a3a6b)',
            marginBottom: 16,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 22, color: '#0f1f3d', letterSpacing: '-0.3px' }}>
            JESA Fiabilité
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
            Plateforme de fiabilité industrielle
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com"
              autoComplete="email"
              required
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: 8, padding: '10px 14px',
              color: '#b91c1c', fontSize: 13, marginBottom: 18,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              background: loading ? '#94a3b8' : '#0b2e63',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: '#94a3b8' }}>
          JESA © 2025 — Accès réservé
        </div>
      </div>
    </div>
  )
}
