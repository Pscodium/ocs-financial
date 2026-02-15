"use client"

import { useState } from "react"
import { useFinance } from "@/hooks/use-finance"
import { AuthGuard } from "@/components/auth-guard"
import { AppTabs } from "@/components/app-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Repeat, Calendar, DollarSign, MoreHorizontal, Pencil, Trash2, AlertCircle } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/types"
import type { Subscription } from "@/lib/types"
import { cn } from "@/lib/utils"

const billingCycles = [
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
]

export default function RecurringPage() {
  const finance = useFinance()
  const [showAddSubscription, setShowAddSubscription] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [billingCycle, setBillingCycle] = useState<Subscription["billingCycle"]>("monthly")
  const [nextBillingDate, setNextBillingDate] = useState("")
  const [category, setCategory] = useState("")
  const [active, setActive] = useState(true)
  const [notes, setNotes] = useState("")

  const subscriptions = finance.currentMonth?.subscriptions || []
  const activeSubscriptions = subscriptions.filter((s) => s.active)
  const inactiveSubscriptions = subscriptions.filter((s) => !s.active)

  const resetForm = () => {
    setName("")
    setAmount("")
    setBillingCycle("monthly")
    setNextBillingDate("")
    setCategory("")
    setActive(true)
    setNotes("")
    setEditingSubscription(null)
  }

  const handleAddSubscription = () => {
    if (!name.trim() || !amount || !nextBillingDate) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }

    const subscription: Subscription = {
      id: editingSubscription?.id || `sub-${Date.now()}`,
      name: name.trim(),
      amount: parseFloat(amount),
      billingCycle,
      nextBillingDate,
      category: category.trim() || undefined,
      active,
      notes: notes.trim() || undefined,
    }

    if (editingSubscription) {
      finance.updateSubscription(subscription)
      toast.success("Assinatura atualizada!")
    } else {
      finance.addSubscription(subscription)
      toast.success("Assinatura adicionada!")
    }

    resetForm()
    setShowAddSubscription(false)
  }

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription)
    setName(subscription.name)
    setAmount(subscription.amount.toString())
    setBillingCycle(subscription.billingCycle)
    setNextBillingDate(subscription.nextBillingDate)
    setCategory(subscription.category || "")
    setActive(subscription.active)
    setNotes(subscription.notes || "")
    setShowAddSubscription(true)
  }

  const handleDelete = (id: string) => {
    finance.removeSubscription(id)
    toast.success("Assinatura removida!")
  }

  const handleToggleActive = (subscription: Subscription) => {
    finance.updateSubscription({ ...subscription, active: !subscription.active })
    toast.success(`Assinatura ${!subscription.active ? "ativada" : "desativada"}!`)
  }

  const calculateMonthlyEquivalent = (amount: number, cycle: Subscription["billingCycle"]) => {
    switch (cycle) {
      case "monthly":
        return amount
      case "quarterly":
        return amount / 3
      case "yearly":
        return amount / 12
    }
  }

  const totalMonthly = activeSubscriptions.reduce((sum, s) => 
    sum + calculateMonthlyEquivalent(s.amount, s.billingCycle), 0
  )
  
  const totalYearly = totalMonthly * 12

  const getDaysUntilBilling = (dateStr: string) => {
    const billingDate = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    billingDate.setHours(0, 0, 0, 0)
    
    const diff = billingDate.getTime() - today.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    
    return days
  }

  const getBillingStatus = (dateStr: string) => {
    const days = getDaysUntilBilling(dateStr)
    
    if (days < 0) return { text: "Vencida", color: "text-red-500", badgeVariant: "destructive" as const }
    if (days === 0) return { text: "Hoje", color: "text-orange-500", badgeVariant: "default" as const }
    if (days <= 7) return { text: `${days} dias`, color: "text-orange-500", badgeVariant: "secondary" as const }
    return { text: `${days} dias`, color: "text-muted-foreground", badgeVariant: "outline" as const }
  }

  const getCycleLabel = (cycle: Subscription["billingCycle"]) => {
    return billingCycles.find((c) => c.value === cycle)?.label || "Mensal"
  }

  if (!finance.loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground animate-pulse">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-muted/20">
        <AppTabs />
        
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between select-none">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Pagamentos Recorrentes</h1>
              <p className="mt-1 text-muted-foreground">
                Gerencie suas assinaturas e pagamentos fixos
              </p>
            </div>
            
            <Button onClick={() => setShowAddSubscription(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Assinatura
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="mb-8 grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium select-none">Assinaturas Ativas</CardTitle>
                <Repeat className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeSubscriptions.length}</div>
                <p className="text-xs text-muted-foreground mt-1 select-none">
                  {inactiveSubscriptions.length} inativas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium select-none">Custo Mensal</CardTitle>
                <DollarSign className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{formatCurrency(totalMonthly)}</div>
                <p className="text-xs text-muted-foreground mt-1 select-none">
                  Total das assinaturas ativas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium select-none">Custo Anual</CardTitle>
                <Calendar className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{formatCurrency(totalYearly)}</div>
                <p className="text-xs text-muted-foreground mt-1 select-none">
                  Projeção anual
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium select-none">Próximo Vencimento</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                {activeSubscriptions.length > 0 ? (
                  <>
                    <div className="text-2xl font-bold">
                      {getDaysUntilBilling(
                        activeSubscriptions.reduce((nearest, s) => {
                          const days = getDaysUntilBilling(s.nextBillingDate)
                          const nearestDays = getDaysUntilBilling(nearest.nextBillingDate)
                          return days < nearestDays ? s : nearest
                        }).nextBillingDate
                      )} dias
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 select-none">
                      Próximo pagamento
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma assinatura</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Active Subscriptions */}
          {activeSubscriptions.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 select-none">Assinaturas Ativas</h2>
              <div className="grid gap-4">
                {activeSubscriptions.map((subscription) => {
                  const billingStatus = getBillingStatus(subscription.nextBillingDate)
                  const monthlyEquivalent = calculateMonthlyEquivalent(subscription.amount, subscription.billingCycle)

                  return (
                    <Card key={subscription.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-lg">{subscription.name}</CardTitle>
                              <Badge variant={billingStatus.badgeVariant} className="text-xs">
                                {billingStatus.text}
                              </Badge>
                            </div>
                            <CardDescription className="flex flex-wrap items-center gap-2">
                              <span>{getCycleLabel(subscription.billingCycle)}</span>
                              {subscription.category && (
                                <>
                                  <span>•</span>
                                  <span>{subscription.category}</span>
                                </>
                              )}
                            </CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(subscription)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(subscription)}>
                                <Switch className="mr-2 h-4 w-4" checked={false} />
                                Desativar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(subscription.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Valor</p>
                            <p className="text-lg font-semibold">{formatCurrency(subscription.amount)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Equivalente Mensal</p>
                            <p className="text-lg font-semibold text-red-500">
                              {formatCurrency(monthlyEquivalent)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Próximo Pagamento</p>
                            <p className={cn("text-lg font-semibold", billingStatus.color)}>
                              {new Date(subscription.nextBillingDate).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </div>
                        {subscription.notes && (
                          <div className="mt-4 rounded-lg bg-muted p-3">
                            <p className="text-sm text-muted-foreground">{subscription.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Inactive Subscriptions */}
          {inactiveSubscriptions.length > 0 && (
            <div className="mb-8 select-none">
              <h2 className="text-xl font-semibold mb-4">Assinaturas Inativas</h2>
              <div className="grid gap-4">
                {inactiveSubscriptions.map((subscription) => (
                  <Card key={subscription.id} className="opacity-60">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{subscription.name}</CardTitle>
                            <Badge variant="outline">Inativa</Badge>
                          </div>
                          <CardDescription>
                            {formatCurrency(subscription.amount)} • {getCycleLabel(subscription.billingCycle)}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleToggleActive(subscription)}>
                              <Switch className="mr-2 h-4 w-4" checked />
                              Ativar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(subscription)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(subscription.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {subscriptions.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Repeat className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma assinatura cadastrada</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  Registre suas assinaturas e pagamentos recorrentes para ter controle total dos seus gastos fixos.
                </p>
                <Button onClick={() => setShowAddSubscription(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeira Assinatura
                </Button>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Add/Edit Subscription Dialog */}
        <Dialog open={showAddSubscription} onOpenChange={(open) => {
          if (!open) resetForm()
          setShowAddSubscription(open)
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingSubscription ? "Editar" : "Nova"} Assinatura</DialogTitle>
              <DialogDescription>
                Registre pagamentos recorrentes como Netflix, academia, etc.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="sub-name">Nome</Label>
                <Input
                  id="sub-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Netflix, Spotify, Academia"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sub-amount">Valor (R$)</Label>
                  <Input
                    id="sub-amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sub-cycle">Ciclo</Label>
                  <Select value={billingCycle} onValueChange={(value) => setBillingCycle(value as Subscription["billingCycle"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {billingCycles.map((cycle) => (
                        <SelectItem key={cycle.value} value={cycle.value}>
                          {cycle.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sub-date">Próximo Pagamento</Label>
                  <Input
                    id="sub-date"
                    type="date"
                    value={nextBillingDate}
                    onChange={(e) => setNextBillingDate(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sub-category">Categoria</Label>
                  <Input
                    id="sub-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Streaming, Saúde"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="sub-active">Assinatura Ativa</Label>
                  <p className="text-xs text-muted-foreground">
                    Incluir nos cálculos de gastos
                  </p>
                </div>
                <Switch
                  id="sub-active"
                  checked={active}
                  onCheckedChange={setActive}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sub-notes">Observações (opcional)</Label>
                <Textarea
                  id="sub-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas sobre esta assinatura..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => {
                resetForm()
                setShowAddSubscription(false)
              }}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleAddSubscription}>
                {editingSubscription ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  )
}
