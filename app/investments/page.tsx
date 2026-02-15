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
import { Plus, TrendingUp, TrendingDown, Wallet, Building2, Bitcoin, Landmark, Home, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/types"
import type { Investment } from "@/lib/types"
import { cn } from "@/lib/utils"

const investmentTypes = [
  { value: "stocks", label: "Ações", icon: TrendingUp },
  { value: "funds", label: "Fundos", icon: Building2 },
  { value: "crypto", label: "Criptomoedas", icon: Bitcoin },
  { value: "savings", label: "Poupança/CDB", icon: Landmark },
  { value: "real-estate", label: "Imóveis", icon: Home },
  { value: "other", label: "Outros", icon: Wallet },
]

export default function InvestmentsPage() {
  const finance = useFinance()
  const [showAddInvestment, setShowAddInvestment] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null)
  
  const [name, setName] = useState("")
  const [type, setType] = useState<Investment["type"]>("stocks")
  const [amount, setAmount] = useState("")
  const [currentValue, setCurrentValue] = useState("")
  const [purchaseDate, setPurchaseDate] = useState("")
  const [notes, setNotes] = useState("")

  const investments = finance.currentMonth?.investments || []

  const resetForm = () => {
    setName("")
    setType("stocks")
    setAmount("")
    setCurrentValue("")
    setPurchaseDate("")
    setNotes("")
    setEditingInvestment(null)
  }

  const handleAddInvestment = () => {
    if (!name.trim() || !amount || !purchaseDate) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }

    const investment: Investment = {
      id: editingInvestment?.id || `inv-${Date.now()}`,
      name: name.trim(),
      type,
      amount: parseFloat(amount),
      currentValue: currentValue ? parseFloat(currentValue) : undefined,
      purchaseDate,
      notes: notes.trim() || undefined,
    }

    if (editingInvestment) {
      finance.updateInvestment(investment)
      toast.success("Investimento atualizado!")
    } else {
      finance.addInvestment(investment)
      toast.success("Investimento adicionado!")
    }

    resetForm()
    setShowAddInvestment(false)
  }

  const handleEdit = (investment: Investment) => {
    setEditingInvestment(investment)
    setName(investment.name)
    setType(investment.type)
    setAmount(investment.amount.toString())
    setCurrentValue(investment.currentValue?.toString() || "")
    setPurchaseDate(investment.purchaseDate)
    setNotes(investment.notes || "")
    setShowAddInvestment(true)
  }

  const handleDelete = (id: string) => {
    finance.removeInvestment(id)
    toast.success("Investimento removido!")
  }

  const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0)
  const totalCurrent = investments.reduce((sum, inv) => sum + (inv.currentValue || inv.amount), 0)
  const totalReturn = totalCurrent - totalInvested
  const returnPercentage = totalInvested > 0 ? ((totalReturn / totalInvested) * 100) : 0

  const getTypeIcon = (type: Investment["type"]) => {
    const typeObj = investmentTypes.find((t) => t.value === type)
    return typeObj?.icon || Wallet
  }

  const getTypeLabel = (type: Investment["type"]) => {
    const typeObj = investmentTypes.find((t) => t.value === type)
    return typeObj?.label || "Outro"
  }

  const calculateReturn = (investment: Investment) => {
    const current = investment.currentValue || investment.amount
    return current - investment.amount
  }

  const calculateReturnPercentage = (investment: Investment) => {
    const returnValue = calculateReturn(investment)
    return (returnValue / investment.amount) * 100
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
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Investimentos</h1>
              <p className="mt-1 text-muted-foreground">
                Acompanhe seu portfólio e patrimônio investido
              </p>
            </div>
            
            <Button onClick={() => setShowAddInvestment(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Investimento
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="mb-8 grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalInvested)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Capital aplicado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Atual</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalCurrent)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Patrimônio total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retorno</CardTitle>
                {totalReturn >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", totalReturn >= 0 ? "text-green-500" : "text-red-500")}>
                  {formatCurrency(totalReturn)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalReturn >= 0 ? "Lucro" : "Prejuízo"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rentabilidade</CardTitle>
                {returnPercentage >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", returnPercentage >= 0 ? "text-green-500" : "text-red-500")}>
                  {returnPercentage >= 0 ? "+" : ""}{returnPercentage.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Retorno total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Investments List */}
          {investments.length > 0 ? (
            <div className="grid gap-4">
              {investments.map((investment) => {
                const Icon = getTypeIcon(investment.type)
                const returnValue = calculateReturn(investment)
                const returnPerc = calculateReturnPercentage(investment)
                const isPositive = returnValue >= 0

                return (
                  <Card key={investment.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg bg-primary/10 p-2.5">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{investment.name}</CardTitle>
                            <CardDescription className="mt-1 flex items-center gap-2">
                              <Badge variant="secondary">{getTypeLabel(investment.type)}</Badge>
                              <span>Comprado em {new Date(investment.purchaseDate).toLocaleDateString("pt-BR")}</span>
                            </CardDescription>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(investment)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(investment.id)}
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
                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Investido</p>
                          <p className="text-lg font-semibold">{formatCurrency(investment.amount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Valor Atual</p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(investment.currentValue || investment.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Retorno</p>
                          <p className={cn("text-lg font-semibold", isPositive ? "text-green-500" : "text-red-500")}>
                            {isPositive ? "+" : ""}{formatCurrency(returnValue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Rentabilidade</p>
                          <p className={cn("text-lg font-semibold", isPositive ? "text-green-500" : "text-red-500")}>
                            {isPositive ? "+" : ""}{returnPerc.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      {investment.notes && (
                        <div className="mt-4 rounded-lg bg-muted p-3">
                          <p className="text-sm text-muted-foreground">{investment.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 select-none">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhum investimento registrado</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  Comece a registrar seus investimentos e acompanhe a evolução do seu patrimônio.
                </p>
                <Button onClick={() => setShowAddInvestment(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Investimento
                </Button>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Add/Edit Investment Dialog */}
        <Dialog open={showAddInvestment} onOpenChange={(open) => {
          if (!open) resetForm()
          setShowAddInvestment(open)
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingInvestment ? "Editar" : "Novo"} Investimento</DialogTitle>
              <DialogDescription>
                Registre seus investimentos e acompanhe a rentabilidade.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="inv-name">Nome do Investimento</Label>
                <Input
                  id="inv-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Ações PETR4, Tesouro Direto"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="inv-type">Tipo</Label>
                <Select value={type} onValueChange={(value) => setType(value as Investment["type"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {investmentTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="inv-amount">Valor Investido (R$)</Label>
                  <Input
                    id="inv-amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="inv-current">Valor Atual (R$)</Label>
                  <Input
                    id="inv-current"
                    type="number"
                    step="0.01"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="inv-date">Data da Compra</Label>
                <Input
                  id="inv-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="inv-notes">Observações (opcional)</Label>
                <Textarea
                  id="inv-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas sobre este investimento..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => {
                resetForm()
                setShowAddInvestment(false)
              }}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleAddInvestment}>
                {editingInvestment ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  )
}
