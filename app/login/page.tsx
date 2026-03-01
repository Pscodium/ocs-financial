"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import type { OAuthProvider } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Github } from "lucide-react"

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
const OAUTH_TRANSIENT_TTL_MS = 10 * 60 * 1000
const OAUTH_TRANSIENT_CREATED_AT_KEY = "oauth_transient_created_at"

const passwordChecks = [
  { key: "length", label: "Pelo menos 8 caracteres", test: (value: string) => value.length >= 8 },
  { key: "lower", label: "Ao menos 1 letra minúscula", test: (value: string) => /[a-z]/.test(value) },
  { key: "upper", label: "Ao menos 1 letra maiúscula", test: (value: string) => /[A-Z]/.test(value) },
  { key: "number", label: "Ao menos 1 número", test: (value: string) => /\d/.test(value) },
  { key: "special", label: "Ao menos 1 caractere especial (@$!%*?&)", test: (value: string) => /[@$!%*?&]/.test(value) },
]

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.249 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4c-7.682 0-14.417 4.337-17.694 10.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.143 35.091 26.715 36 24 36c-5.228 0-9.626-3.329-11.287-7.946l-6.522 5.025C9.435 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.093 5.571l6.19 5.238C36.965 39.147 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path fill="#F35325" d="M2 2h9v9H2z" />
      <path fill="#81BC06" d="M13 2h9v9h-9z" />
      <path fill="#05A6F0" d="M2 13h9v9H2z" />
      <path fill="#FFBA08" d="M13 13h9v9h-9z" />
    </svg>
  )
}

export default function LoginPage() {
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("")
  const [registerFullName, setRegisterFullName] = useState("")
  const [activeTab, setActiveTab] = useState("login")
  const [localError, setLocalError] = useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null)
  const [providerLoading, setProviderLoading] = useState<OAuthProvider | null>(null)
  const { login, loginWithProvider, register, isLoading, isAuthenticated, error } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const cleanupExpiredOAuthTransient = () => {
      if (typeof window === "undefined") {
        return
      }

      const storages: Storage[] = []

      try {
        storages.push(window.sessionStorage)
      } catch {}

      try {
        storages.push(window.localStorage)
      } catch {}

      storages.forEach((storage) => {
        const createdAtRaw = storage.getItem(OAUTH_TRANSIENT_CREATED_AT_KEY)
        const createdAt = createdAtRaw ? Number(createdAtRaw) : NaN

        if (!createdAtRaw) {
          return
        }

        const isExpired = !Number.isFinite(createdAt) || Date.now() - createdAt > OAUTH_TRANSIENT_TTL_MS

        if (isExpired) {
          storage.removeItem("oauth_state")
          storage.removeItem("pkce_verifier")
          storage.removeItem(OAUTH_TRANSIENT_CREATED_AT_KEY)
        }
      })
    }

    cleanupExpiredOAuthTransient()
    const intervalId = window.setInterval(cleanupExpiredOAuthTransient, 15_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/")
    }
  }, [isAuthenticated, router])

  const checks = passwordChecks.map((check) => ({
    ...check,
    passed: check.test(registerPassword),
  }))
  const isPasswordValid = PASSWORD_REGEX.test(registerPassword)
  const isPasswordMatch = registerPassword.length > 0 && registerPassword === registerPasswordConfirm

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    try {
      await login(loginEmail, loginPassword)
    } catch {
      // Error is handled by useAuth
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setRegisterSuccess(null)

    if (!isPasswordValid) {
      setLocalError("A senha não atende aos critérios mínimos")
      return
    }

    if (!isPasswordMatch) {
      setLocalError("As senhas não conferem")
      return
    }

    try {
      await register(registerEmail, registerPassword, registerFullName)
      setRegisterSuccess("Conta criada com sucesso! Faça login para continuar.")
      setActiveTab("login")
      setLoginEmail(registerEmail)
      setRegisterPassword("")
      setRegisterPasswordConfirm("")
    } catch {
      // Error is handled by useAuth
    }
  }

  const handleProviderAuth = async (provider: OAuthProvider) => {
    setLocalError(null)
    setRegisterSuccess(null)
    setProviderLoading(provider)

    try {
      await loginWithProvider(provider)
    } catch {
      // Error is handled by useAuth
      setProviderLoading(null)
    }
  }

  const displayError = localError ?? error

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Acesso</CardTitle>
          <CardDescription>Entre ou crie sua conta para acessar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Registrar</TabsTrigger>
            </TabsList>

            {(displayError || registerSuccess) && (
              <div className="mt-4">
                {displayError && (
                  <Alert variant="destructive">
                    <AlertDescription>{displayError}</AlertDescription>
                  </Alert>
                )}
                {registerSuccess && (
                  <Alert>
                    <AlertDescription>{registerSuccess}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <TabsContent value="login" className="mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleProviderAuth("google")}
                    disabled={isLoading}
                  >
                    <span className="inline-flex items-center gap-2">
                      <GoogleIcon />
                      <span>{providerLoading === "google" ? "Conectando com Google..." : "Continuar com Google"}</span>
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleProviderAuth("github")}
                    disabled={isLoading}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Github className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{providerLoading === "github" ? "Conectando com GitHub..." : "Continuar com GitHub"}</span>
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleProviderAuth("microsoft")}
                    disabled={isLoading}
                  >
                    <span className="inline-flex items-center gap-2">
                      <MicrosoftIcon />
                      <span>{providerLoading === "microsoft" ? "Conectando com Microsoft..." : "Continuar com Microsoft"}</span>
                    </span>
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Ou use email e senha</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="register" className="mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleProviderAuth("google")}
                    disabled={isLoading}
                  >
                    <span className="inline-flex items-center gap-2">
                      <GoogleIcon />
                      <span>{providerLoading === "google" ? "Conectando com Google..." : "Registrar com Google"}</span>
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleProviderAuth("github")}
                    disabled={isLoading}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Github className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{providerLoading === "github" ? "Conectando com GitHub..." : "Registrar com GitHub"}</span>
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleProviderAuth("microsoft")}
                    disabled={isLoading}
                  >
                    <span className="inline-flex items-center gap-2">
                      <MicrosoftIcon />
                      <span>{providerLoading === "microsoft" ? "Conectando com Microsoft..." : "Registrar com Microsoft"}</span>
                    </span>
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Ou cadastre com email e senha</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-full-name">Nome completo</Label>
                  <Input
                    id="register-full-name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={registerFullName}
                    onChange={(e) => setRegisterFullName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Senha</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <ul className="space-y-1 text-sm text-muted-foreground">
                  {checks.map((check) => (
                    <li key={check.key} className={check.passed ? "text-foreground" : ""}>
                      {check.passed ? "✓" : "•"} {check.label}
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  <Label htmlFor="register-password-confirm">Confirmar senha</Label>
                  <Input
                    id="register-password-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={registerPasswordConfirm}
                    onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                  {registerPasswordConfirm.length > 0 && (
                    <p className={`text-sm ${isPasswordMatch ? "text-foreground" : "text-destructive"}`}>
                      {isPasswordMatch ? "✓ As senhas conferem" : "As senhas não conferem"}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || !isPasswordValid || !isPasswordMatch}>
                  {isLoading ? "Registrando..." : "Criar conta"}
                </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
