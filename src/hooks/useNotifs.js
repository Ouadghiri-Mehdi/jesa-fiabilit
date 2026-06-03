// src/hooks/useNotifs.js
import { useState, useCallback } from 'react'

export default function useNotifs() {
  const [notifs, setNotifs] = useState([])

  const showNotif = useCallback((title, body, type = 'blue') => {
    const id = Date.now() + Math.random()
    setNotifs(n => [...n, { id, title, body, type }])
    setTimeout(() => setNotifs(n => n.filter(x => x.id !== id)), 10000)
  }, [])

  const dismissNotif = useCallback((id) => {
    setNotifs(n => n.filter(x => x.id !== id))
  }, [])

  return { notifs, showNotif, dismissNotif }
}
