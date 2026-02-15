"use client"

import { useState } from "react"
import { useFinance } from "@/hooks/use-finance"
import { AuthGuard } from "@/components/auth-guard"
import { AppTabs } from "@/components/app-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Target, AlertTriangle, CheckCircle2, TrendingUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency, getMonthLabel } from "@/lib/types"
import type { Budget } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function BudgetsPage() {
  const finance = useFinance()
  const [showAddBudget, setShowAddBudget] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [budgetName, setBudgetName] = useState("")
  const [budgetLimit, setBudgetLimit] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")

  const budgets = finance.currentMonth?.budgets || []
  const categories = finance.getBillCategories()

  const resetForm = () => {
    setBudgetName("")
    setBudgetLimit("")
    setSelectedCategoryId("")
    setEditingBudget(null)
  }

  const handleAddBudget = () => {
    if (!budgetName.trim() || !budgetLimit) {
      toast.error("Preencha todos os campos")
      return
    }

    const category = categories.find((c) => c.id === selectedCategoryId)
    const budget: Budget = {
      id: editingBudget?.id || `budget-${Date.now()}`,
      categoryId: selectedCategoryId || undefined,
      categoryName: category?.name || budgetName.trim(),
      limit: parseFloat(budgetLimit),
      spent: category ? finance.getTotalByCategory(category) : (editingBudget?.spent || 0),
      monthKey: finance.currentMonthKey,
    }

    if (editingBudget) {
      finance.updateBudget(budget)
      toast.success("Orçamento atualizado!")
    } else {
      finance.addBudget(budget)
      toast.success("Orçamento criado!")
    }

    resetForm()
    setShowAddBudget(false)
  }

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget)
    setBudgetName(budget.categoryName)
    setBudgetLimit(budget.limit.toString())
    setSelectedCategoryId(budget.categoryId || "")
    setShowAddBudget(true)
  }

  const handleDelete = (id: string) => {
    finance.removeBudget(id)
    toast.success("Orçamento removido!")
  }

  const calculatePercentage = (spent: number, limit: number) => {
    return Math.min((spent / limit) * 100, 100)
  }

  const getStatusColor = (spent: number, limit: number) => {
    const percentage = (spent / limit) * 100
    if (percentage >= 100) return "text-red-500"
    if (percentage >= 80) return "text-orange-500"
    return "text-green-500"
  }

  const getProgressColor = (spent: number, limit: number) => {
    const percentage = (spent / limit) * 100
    if (percentage >= 100) return "bg-red-500"
    if (percentage >= 80) return "bg-orange-500"
    return "bg-green-500"
  }

  const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0)

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
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Orçamentos</h1>
              <p className="mt-1 text-muted-foreground">
                Defina e acompanhe seus limites de gastos para {getMonthLabel(finance.currentMonthKey)}
              </p>
            </div>
            
            <Button onClick={() => setShowAddBudget(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Orçamento
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Orçamento Total</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {budgets.length} categorias orçadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Gasto</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(1)}% do orçamento` : "N/A"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Disponível</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", totalBudget - totalSpent < 0 ? "text-red-500" : "text-green-500")}>
                  {formatCurrency(totalBudget - totalSpent)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalBudget - totalSpent < 0 ? "Acima do orçamento" : "Dentro do orçamento"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Budgets List */}
          {budgets.length > 0 ? (
            <div className="grid gap-4">
              {budgets.map((budget) => {
                const percentage = calculatePercentage(budget.spent, budget.limit)
                const remaining = budget.limit - budget.spent
                const isOverBudget = remaining < 0

                return (
                  <Card key={budget.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{budget.categoryName}</CardTitle>
                          <CardDescription className="mt-1">
                            {formatCurrency(budget.spent)} de {formatCurrency(budget.limit)}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={cn("flex items-center gap-1.5", getStatusColor(budget.spent, budget.limit))}>
                            {isOverBudget ? (
                              <AlertTriangle className="h-5 w-5" />
                            ) : percentage >= 80 ? (
                              <AlertTriangle className="h-5 w-5" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5" />
                            )}
                            <span className="font-semibold">{percentage.toFixed(0)}%</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(budget)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(budget.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Progress 
                          value={percentage} 
                          className="h-2"
                        />
                        <div className="flex justify-between text-sm">
                          <span className={cn("font-medium", isOverBudget ? "text-red-500" : "text-muted-foreground")}>
                            {isOverBudget ? "Ultrapassado em " : "Restam "}
                            {formatCurrency(Math.abs(remaining))}
                          </span>
                          <span className="text-muted-foreground">
                            {isOverBudget ? `+${(percentage - 100).toFixed(0)}%` : `${(100 - percentage).toFixed(0)}% disponível`}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 select-none">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Target className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhum orçamento definido</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  Comece definindo orçamentos para suas categorias de despesas e mantenha seus gastos sob controle.
                </p>
                <Button onClick={() => setShowAddBudget(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeiro Orçamento
                </Button>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Add/Edit Budget Dialog */}
        <Dialog open={showAddBudget} onOpenChange={(open) => {
          if (!open) resetForm()
          setShowAddBudget(open)
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingBudget ? "Editar" : "Novo"} Orçamento</DialogTitle>
              <DialogDescription>
                Defina um limite de gastos para uma categoria ou crie um orçamento personalizado.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="budget-category">Categoria (opcional)</Label>
                <Select value={selectedCategoryId} onValueChange={(value) => {
                  setSelectedCategoryId(value)
                  const cat = categories.find((c) => c.id === value)
                  if (cat) setBudgetName(cat.name)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria existente" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="budget-name">Nome do Orçamento</Label>
                <Input
                  id="budget-name"
                  value={budgetName}
                  onChange={(e) => setBudgetName(e.target.value)}
                  placeholder="Ex: Alimentação, Transporte, Lazer"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="budget-limit">Limite (R$)</Label>
                <Input
                  id="budget-limit"
                  type="number"
                  step="0.01"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  placeholder="0.00"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddBudget()
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => {
                resetForm()
                setShowAddBudget(false)
              }}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleAddBudget}>
                {editingBudget ? "Salvar" : "Criar Orçamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  )
}
