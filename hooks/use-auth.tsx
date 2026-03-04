"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, type User, type OAuthProvider, ApiError, NetworkError } from "@/lib/api"
import { getUserPlanIdentifier } from "@/lib/feature-flags"
import { RateLimitModal } from "@/components/rate-limit-modal"
import { queryKeys } from "@/lib/query-keys"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isInitializing: boolean
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
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [isRateLimitOpen, setIsRateLimitOpen] = useState(false)
  const [rateLimitPlanLabel, setRateLimitPlanLabel] = useState("seu plano atual")

  const userQuery = useQuery({
    queryKey: queryKeys.authUser,
    queryFn: async () => {
      try {
        await api.startAuthSession()
      } catch {
        // usuário pode não estar autenticado ainda
      }

      return api.getCurrentUser()
    },
    staleTime: 60_000,
  })

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await api.login(email, password)
      return api.getCurrentUser()
    },
    onSuccess: (nextUser) => {
      queryClient.setQueryData(queryKeys.authUser, nextUser)
    },
  })

  const providerMutation = useMutation({
    mutationFn: async (provider: OAuthProvider) => {
      await api.loginWithProvider(provider)
    },
  })

  const oauthCallbackMutation = useMutation({
    mutationFn: async (payload: { code?: string; state?: string }) => {
      if (payload.code) {
        await api.exchangeCode(payload.code)
      } else {
        throw new ApiError(400, "Callback OAuth sem code")
      }

      return api.getCurrentUser()
    },
    onSuccess: (nextUser) => {
      queryClient.setQueryData(queryKeys.authUser, nextUser)
    },
  })

  const registerMutation = useMutation({
    mutationFn: async ({
      email,
      password,
      fullName,
    }: {
      email: string
      password: string
      fullName: string
    }) => {
      await api.register({ email, password, fullName })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.logout()
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.authUser, null)
    },
  })

  const user = userQuery.data ?? null

  const loginMutateAsync = loginMutation.mutateAsync
  const providerMutateAsync = providerMutation.mutateAsync
  const oauthCallbackMutateAsync = oauthCallbackMutation.mutateAsync
  const registerMutateAsync = registerMutation.mutateAsync
  const logoutMutateAsync = logoutMutation.mutateAsync

  const isInitializing = userQuery.isPending
  const isLoading =
    loginMutation.isPending ||
    providerMutation.isPending ||
    oauthCallbackMutation.isPending ||
    registerMutation.isPending ||
    logoutMutation.isPending

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
    setError(null)
    try {
      await loginMutateAsync({ email, password })
    } catch (err) {
      if (err instanceof ApiError) {
        setError("Email ou senha inválidos")
      } else if (err instanceof NetworkError) {
        setError("Não foi possível conectar ao servidor")
      } else {
        setError("Erro ao fazer login")
      }
      throw err
    }
  }, [loginMutateAsync])

  const loginWithProvider = useCallback(async (provider: OAuthProvider) => {
    setError(null)
    try {
      await providerMutateAsync(provider)
    } catch (err) {
      if (err instanceof NetworkError) {
        setError("Não foi possível conectar ao servidor")
      } else {
        setError("Erro ao iniciar login com provedor")
      }
      throw err
    }
  }, [providerMutateAsync])

  const handleOAuthCallback = useCallback(async (payload: {
    code?: string
    state?: string
  }) => {
    setError(null)

    try {
      await oauthCallbackMutateAsync(payload)
    } catch (err) {
      if (err instanceof ApiError) {
        setError("Não foi possível concluir login com provedor")
      } else if (err instanceof NetworkError) {
        setError("Não foi possível conectar ao servidor")
      } else {
        setError("Erro ao concluir login")
      }
      throw err
    }
  }, [oauthCallbackMutateAsync])

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    setError(null)
    try {
      await registerMutateAsync({ email, password, fullName })
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
    }
  }, [registerMutateAsync])

  const logout = useCallback(async () => {
    await logoutMutateAsync()
    setError(null)
  }, [logoutMutateAsync])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isInitializing,
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
