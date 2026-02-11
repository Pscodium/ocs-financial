"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { api, type LoginResponse, ApiError, NetworkError } from "@/lib/api"

interface AuthContextType {
  user: LoginResponse | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LoginResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem("auth_token")
    const userData = localStorage.getItem("user_data")
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData))
      } catch {
        localStorage.removeItem("auth_token")
        localStorage.removeItem("user_data")
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.login(email, password)
      
      // Store token and user data
      localStorage.setItem("auth_token", response.token)
      localStorage.setItem("user_data", JSON.stringify(response))
      document.cookie = `token=${response.token}; path=/; samesite=lax`
      
      setUser(response)
    } catch (err) {
      if (err instanceof ApiError) {
        setError("Email ou senha inválidos")
      } else if (err instanceof NetworkError) {
        setError("Não foi possível conectar ao servidor")
      } else {
        setError("Erro ao fazer login")
      }
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user_data")
    document.cookie = "token=; Max-Age=0; path=/; samesite=lax"
    setUser(null)
    setError(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
