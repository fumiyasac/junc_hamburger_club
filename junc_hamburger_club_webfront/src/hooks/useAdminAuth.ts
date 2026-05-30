'use client'

import { useState, useEffect, useCallback } from 'react'

export function useAdminAuth() {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('junc_admin_token')
    setToken(t)
    setIsLoading(false)
  }, [])

  const setLoggedIn = useCallback((t: string) => {
    localStorage.setItem('junc_admin_token', t)
    setToken(t)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('junc_admin_token')
    setToken(null)
  }, [])

  return { token, isLoading, isAuthenticated: !!token, setLoggedIn, logout }
}
