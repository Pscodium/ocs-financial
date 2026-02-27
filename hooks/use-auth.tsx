"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { api, type User, type OAuthProvider, ApiError, NetworkError } from "@/lib/api"
import { getUserPlanIdentifier } from "@/lib/feature-flags"
import { RateLimitModal } from "@/components/rate-limit-modal"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithProvider: (provider: OAuthProvider) => Promise<void>
  handleOAuthCallback: (payload: {
    code?: string
    state?: string
    accessToken?: string
    refreshToken?: string
    expiresIn?: number
  }) => Promise<void>
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

    const bootstrapAuth = async () => {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null
      const userData = typeof localStorage !== "undefined" ? localStorage.getItem("user_data") : null

      if (token && userData) {
        try {
          setUser(JSON.parse(userData))
          return
        } catch {
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem("access_token")
            localStorage.removeItem("refresh_token")
            localStorage.removeItem("user_data")
          }
        }
      }

      if (token) {
        try {
          const currentUser = await api.getCurrentUser()
          if (currentUser) {
            setUser(currentUser)
            if (typeof localStorage !== "undefined") {
              localStorage.setItem("user_data", JSON.stringify(currentUser))
            }
          }
        } catch {
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem("access_token")
            localStorage.removeItem("refresh_token")
          }
        }
      }
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

    bootstrapAuth().finally(() => {
      setIsLoading(false)
    })

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

  const loginWithProvider = useCallback(async (provider: OAuthProvider) => {
    setIsLoading(true)
    setError(null)
    try {
      await api.loginWithProvider(provider)
    } catch (err) {
      if (err instanceof NetworkError) {
        setError("Não foi possível conectar ao servidor")
      } else {
        setError("Erro ao iniciar login com provedor")
      }
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleOAuthCallback = useCallback(async (payload: {
    code?: string
    state?: string
    accessToken?: string
    refreshToken?: string
    expiresIn?: number
  }) => {
    setIsLoading(true)
    setError(null)

    try {
      if (typeof localStorage === "undefined") {
        throw new ApiError(400, "OAuth state inválido")
      }

      const expectedState = localStorage.getItem("oauth_state")
      const callbackState = payload.state

      if (expectedState && callbackState && callbackState !== expectedState) {
        throw new ApiError(400, "OAuth state inválido")
      }

      localStorage.removeItem("oauth_state")

      if (payload.accessToken) {
        localStorage.setItem("access_token", payload.accessToken)
        if (payload.refreshToken) {
          localStorage.setItem("refresh_token", payload.refreshToken)
        }
        if (payload.expiresIn && Number.isFinite(payload.expiresIn)) {
          localStorage.setItem("token_expires_at", String(Date.now() + payload.expiresIn * 1000))
        }
        localStorage.removeItem("pkce_verifier")
      } else if (payload.code) {
        await api.exchangeCode(payload.code)
      } else {
        throw new ApiError(400, "Callback OAuth sem code/token")
      }

      const userData = await api.getCurrentUser()

      if (userData) {
        localStorage.setItem("user_data", JSON.stringify(userData))
        setUser(userData)
      }
    } catch (err) {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("oauth_state")
      }

      if (err instanceof ApiError) {
        setError("Não foi possível concluir login com provedor")
      } else if (err instanceof NetworkError) {
        setError("Não foi possível conectar ao servidor")
      } else {
        setError("Erro ao concluir login")
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
        loginWithProvider,
        handleOAuthCallback,
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
