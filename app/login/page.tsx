"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

const passwordChecks = [
  { key: "length", label: "Pelo menos 8 caracteres", test: (value: string) => value.length >= 8 },
  { key: "lower", label: "Ao menos 1 letra minúscula", test: (value: string) => /[a-z]/.test(value) },
  { key: "upper", label: "Ao menos 1 letra maiúscula", test: (value: string) => /[A-Z]/.test(value) },
  { key: "number", label: "Ao menos 1 número", test: (value: string) => /\d/.test(value) },
  { key: "special", label: "Ao menos 1 caractere especial (@$!%*?&)", test: (value: string) => /[@$!%*?&]/.test(value) },
]

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
  const { login, register, isLoading, error } = useAuth()
  const router = useRouter()

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
      router.push("/")
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
            </TabsContent>

            <TabsContent value="register" className="mt-4">
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
