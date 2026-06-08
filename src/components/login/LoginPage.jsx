// src/components/login/LoginPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const ok = await login(username.trim(), password)
    setLoading(false)
    if (ok) {
      navigate('/hub', { replace: true })
    } else {
      setError('Identifiant ou mot de passe incorrect.')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b2e63',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: 400,
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        padding: '48px 40px 40px',
      }}>
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/jesa-logo.png"
            alt="JESA Reliability Hub"
            style={{ width: 140, height: 'auto', objectFit: 'contain', marginBottom: 12 }}
          />
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 28, color: '#0f1f3d', letterSpacing: '-0.5px', lineHeight: 1 }}>
            JES<span style={{ color: '#2563eb' }}>A</span>
          </div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13, color: '#0f1f3d', letterSpacing: '2.5px', marginTop: 4 }}>
            RELIABILITY HUB
          </div>
          <div style={{ fontSize: 10.5, color: '#94a3b8', letterSpacing: '1.5px', marginTop: 6 }}>
            — PLATEFORME DE FIABILITÉ INDUSTRIELLE —
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0ea5e9', letterSpacing: '2px', marginTop: 5 }}>
            IA
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Entité 
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Votre identifiant"
              autoComplete="username"
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                fontSize: 14, color: '#1e293b',
                outline: 'none', transition: 'border-color .15s',
              }}
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
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                fontSize: 14, color: '#1e293b',
                outline: 'none', transition: 'border-color .15s',
              }}
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
              fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity .15s',
            }}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: '#94a3b8' }}>
          
        </div>
      </div>
    </div>
  )
}
