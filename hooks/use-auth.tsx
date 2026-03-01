"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { api, type User, type OAuthProvider, ApiError, NetworkError } from "@/lib/api"
import { getUserPlanIdentifier } from "@/lib/feature-flags"
import { RateLimitModal } from "@/components/rate-limit-modal"

const OAUTH_TRANSIENT_TTL_MS = 10 * 60 * 1000
const SESSION_PROPAGATION_RETRY_COUNT = 3
const SESSION_PROPAGATION_RETRY_DELAY_MS = 250

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getTransientStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    try {
      return window.localStorage
    } catch {
      return null
    }
  }
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithProvider: (provider: OAuthProvider) => Promise<void>
  handleOAuthCallback: (payload: {
    code?: string
    state?: string
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

  const resolveAuthenticatedUser = useCallback(async (retryCount: number = 0) => {
    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      const currentUser = await api.getCurrentUser()
      if (currentUser) {
        return currentUser
      }

      if (attempt < retryCount) {
        await sleep(SESSION_PROPAGATION_RETRY_DELAY_MS)
      }
    }

    return null
  }, [])

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const currentUser = await resolveAuthenticatedUser(0)
        if (currentUser) {
          setUser(currentUser)
        }
      } catch {}
    }

    bootstrapAuth().finally(() => {
      setIsLoading(false)
    })
  }, [resolveAuthenticatedUser])

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
      
      // Fetch user data after session propagation
      const userData = await resolveAuthenticatedUser(SESSION_PROPAGATION_RETRY_COUNT)
      
      if (userData) {
        setUser(userData)
      } else {
        throw new ApiError(401, "Sessão não confirmada após login")
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
  }, [resolveAuthenticatedUser])

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
  }) => {
    setIsLoading(true)
    setError(null)

    try {
      if (typeof localStorage === "undefined") {
        throw new ApiError(400, "OAuth state inválido")
      }

      const transientStorage = getTransientStorage()
      const expectedState = transientStorage?.getItem("oauth_state") ?? localStorage.getItem("oauth_state")
      const createdAtRaw =
        transientStorage?.getItem("oauth_transient_created_at") ?? localStorage.getItem("oauth_transient_created_at")
      const callbackState = payload.state
      const createdAt = createdAtRaw ? Number(createdAtRaw) : NaN

      if (expectedState && callbackState) {
        if (!Number.isFinite(createdAt) || Date.now() - createdAt > OAUTH_TRANSIENT_TTL_MS) {
          throw new ApiError(400, "OAuth state expirado")
        }

        if (callbackState !== expectedState) {
          throw new ApiError(400, "OAuth state inválido")
        }
      }

      transientStorage?.removeItem("oauth_state")
      transientStorage?.removeItem("oauth_transient_created_at")
      localStorage.removeItem("oauth_state")
      localStorage.removeItem("oauth_transient_created_at")

      if (payload.code) {
        await api.exchangeCode(payload.code)
      } else {
        throw new ApiError(400, "Callback OAuth sem code")
      }

      const userData = await resolveAuthenticatedUser(SESSION_PROPAGATION_RETRY_COUNT)

      if (userData) {
        setUser(userData)
      } else {
        throw new ApiError(401, "Sessão não confirmada após callback OAuth")
      }
    } catch (err) {
      const transientStorage = getTransientStorage()
      transientStorage?.removeItem("oauth_state")
      transientStorage?.removeItem("oauth_transient_created_at")

      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("oauth_state")
        localStorage.removeItem("oauth_transient_created_at")
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
  }, [resolveAuthenticatedUser])

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
