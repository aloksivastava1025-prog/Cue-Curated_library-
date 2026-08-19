import React, { createContext, useContext, useState, useCallback } from 'react'

// Global controller for the custom SignInCard so any component in the
// app can call openAuth() to trigger the sign-in overlay.

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('sign-in') // 'sign-in' | 'sign-up'

  const openAuth = useCallback((m = 'sign-in') => {
    setMode(m === 'sign-up' ? 'sign-up' : 'sign-in')
    setOpen(true)
  }, [])
  const closeAuth = useCallback(() => setOpen(false), [])
  const toggleMode = useCallback(() => setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in')), [])

  return (
    <AuthCtx.Provider value={{ authOpen: open, authMode: mode, openAuth, closeAuth, toggleMode }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
