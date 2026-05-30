'use client'

import { useState, useEffect, useCallback } from 'react'
import { User } from '@/lib/types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ user: null, token: null, isLoading: true })

  useEffect(() => {
    const token = localStorage.getItem('junc_token')
    const userJson = localStorage.getItem('junc_user')
    if (token && userJson) {
      try {
        setAuth({ user: JSON.parse(userJson) as User, token, isLoading: false })
      } catch {
        setAuth({ user: null, token: null, isLoading: false })
      }
    } else {
      setAuth({ user: null, token: null, isLoading: false })
    }
  }, [])

  const setLoggedIn = useCallback((user: User, token: string) => {
    localStorage.setItem('junc_token', token)
    localStorage.setItem('junc_user', JSON.stringify(user))
    setAuth({ user, token, isLoading: false })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('junc_token')
    localStorage.removeItem('junc_user')
    setAuth({ user: null, token: null, isLoading: false })
  }, [])

  return { ...auth, setLoggedIn, logout }
}
