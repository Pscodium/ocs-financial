"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { api, type User, ApiError, NetworkError } from "@/lib/api"
import { getUserPlanIdentifier } from "@/lib/feature-flags"
import { RateLimitModal } from "@/components/rate-limit-modal"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => void
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRateLimitOpen, setIsRateLimitOpen] = useState(false)
  const [rateLimitPlanLabel, setRateLimitPlanLabel] = useState("seu plano atual")

  const formatPlanLabel = useCallback((planIdentifier: string | null) => {
    if (!planIdentifier) {
      return "seu plano atual"
    }
    const words = planIdentifier
      .replace(/[-_]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    return words.length > 0 ? words.join(" ") : "seu plano atual"
  }, [])

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    // Check for existing token on mount
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("access_token") : null
    const userData = typeof localStorage !== 'undefined' ? localStorage.getItem("user_data") : null
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData))
      } catch {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem("access_token")
          localStorage.removeItem("refresh_token")
          localStorage.removeItem("user_data")
        }
      }
    } else if (token) {
      // If we have token but no user data, fetch it
      api.getCurrentUser().then(userData => {
        if (userData) {
          setUser(userData)
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem("user_data", JSON.stringify(userData))
          }
        }
      }).catch(() => {
        // Token is invalid, clear it
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem("access_token")
          localStorage.removeItem("refresh_token")
        }
      })
    }

    intervalId = setInterval(() => {
      const currentToken = typeof localStorage !== 'undefined' ? localStorage.getItem("access_token") : null
      if (!currentToken) {
        return
      }

      api.getCurrentUser().then(currentUser => {
        if (currentUser) {
          setUser(currentUser)
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem("user_data", JSON.stringify(currentUser))
          }
        }
      }).catch(() => {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem("access_token")
          localStorage.removeItem("refresh_token")
          localStorage.removeItem("user_data")
        }
        setUser(null)
      })
    }, 5 * 60 * 1000)

    setIsLoading(false)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleRateLimit = (event: Event) => {
      const planIdentifier = getUserPlanIdentifier(user)
      const planLabel = formatPlanLabel(planIdentifier)
      setRateLimitPlanLabel(planLabel)
      setIsRateLimitOpen(true)
    }

    window.addEventListener("rate-limit", handleRateLimit)
    return () => {
      window.removeEventListener("rate-limit", handleRateLimit)
    }
  }, [formatPlanLabel, user])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // Login returns tokens
      await api.login(email, password)
      
      // Fetch user data
      const userData = await api.getCurrentUser()
      
      if (userData) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem("user_data", JSON.stringify(userData))
        }
        setUser(userData)
      }
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

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await api.register({ email, password, fullName })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError("Este email já está em uso")
        } else if (err.status === 400) {
          setError("Dados de cadastro inválidos")
        } else {
          setError("Erro ao criar conta")
        }
      } else if (err instanceof NetworkError) {
        setError("Não foi possível conectar ao servidor")
      } else {
        setError("Erro ao criar conta")
      }
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem("user_data")
    }
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
        register,
        logout,
        error,
      }}
    >
      {children}
      <RateLimitModal
        open={isRateLimitOpen}
        planLabel={rateLimitPlanLabel}
        onClose={() => setIsRateLimitOpen(false)}
      />
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
