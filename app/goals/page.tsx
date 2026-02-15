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
import { Badge } from "@/components/ui/badge"
import { Plus, PiggyBank, Target, ShoppingBag, Plane, GraduationCap, Home as HomeIcon, MoreHorizontal, Pencil, Trash2, TrendingUp } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/types"
import type { FinancialGoal } from "@/lib/types"
import { cn } from "@/lib/utils"

const goalCategories = [
  { value: "emergency", label: "Fundo de Emergência", icon: PiggyBank, color: "text-red-500" },
  { value: "purchase", label: "Compra", icon: ShoppingBag, color: "text-blue-500" },
  { value: "vacation", label: "Viagem", icon: Plane, color: "text-green-500" },
  { value: "education", label: "Educação", icon: GraduationCap, color: "text-purple-500" },
  { value: "retirement", label: "Aposentadoria", icon: TrendingUp, color: "text-orange-500" },
  { value: "other", label: "Outros", icon: Target, color: "text-gray-500" },
]

export default function GoalsPage() {
  const finance = useFinance()
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null)
  
  const [name, setName] = useState("")
  const [category, setCategory] = useState<FinancialGoal["category"]>("other")
  const [targetAmount, setTargetAmount] = useState("")
  const [currentAmount, setCurrentAmount] = useState("")
  const [deadline, setDeadline] = useState("")

  const goals = finance.currentMonth?.goals || []

  const resetForm = () => {
    setName("")
    setCategory("other")
    setTargetAmount("")
    setCurrentAmount("")
    setDeadline("")
    setEditingGoal(null)
  }

  const handleAddGoal = () => {
    if (!name.trim() || !targetAmount) {
      toast.error("Preencha nome e valor da meta")
      return
    }

    const goal: FinancialGoal = {
      id: editingGoal?.id || `goal-${Date.now()}`,
      name: name.trim(),
      category,
      targetAmount: parseFloat(targetAmount),
      currentAmount: currentAmount ? parseFloat(currentAmount) : 0,
      deadline: deadline || undefined,
    }

    if (editingGoal) {
      finance.updateGoal(goal)
      toast.success("Meta atualizada!")
    } else {
      finance.addGoal(goal)
      toast.success("Meta criada!")
    }

    resetForm()
    setShowAddGoal(false)
  }

  const handleEdit = (goal: FinancialGoal) => {
    setEditingGoal(goal)
    setName(goal.name)
    setCategory(goal.category)
    setTargetAmount(goal.targetAmount.toString())
    setCurrentAmount(goal.currentAmount.toString())
    setDeadline(goal.deadline || "")
    setShowAddGoal(true)
  }

  const handleDelete = (id: string) => {
    finance.removeGoal(id)
    toast.success("Meta removida!")
  }

  const handleAddAmount = (goalId: string, amount: number) => {
    const goal = goals.find((g) => g.id === goalId)
    if (goal) {
      const updatedGoal = {
        ...goal,
        currentAmount: goal.currentAmount + amount,
      }
      finance.updateGoal(updatedGoal)
      toast.success(`${formatCurrency(amount)} adicionado à meta!`)
    }
  }

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0)
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0)
  const completedGoals = goals.filter((g) => g.currentAmount >= g.targetAmount).length

  const getCategoryIcon = (cat: FinancialGoal["category"]) => {
    const catObj = goalCategories.find((c) => c.value === cat)
    return catObj?.icon || Target
  }

  const getCategoryLabel = (cat: FinancialGoal["category"]) => {
    const catObj = goalCategories.find((c) => c.value === cat)
    return catObj?.label || "Outro"
  }

  const getCategoryColor = (cat: FinancialGoal["category"]) => {
    const catObj = goalCategories.find((c) => c.value === cat)
    return catObj?.color || "text-gray-500"
  }

  const calculateProgress = (goal: FinancialGoal) => {
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
  }

  const calculateTimeRemaining = (deadlineStr?: string) => {
    if (!deadlineStr) return null
    const deadline = new Date(deadlineStr)
    const now = new Date()
    const diff = deadline.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    
    if (days < 0) return "Prazo expirado"
    if (days === 0) return "Hoje"
    if (days === 1) return "Amanhã"
    if (days < 30) return `${days} dias`
    if (days < 365) return `${Math.floor(days / 30)} meses`
    return `${Math.floor(days / 365)} anos`
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
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Metas Financeiras</h1>
              <p className="mt-1 text-muted-foreground">
                Defina objetivos e acompanhe seu progresso
              </p>
            </div>
            
            <Button onClick={() => setShowAddGoal(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Meta
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="mb-8 grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Metas</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{goals.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {completedGoals} concluídas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Alvo</CardTitle>
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalTarget)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total das metas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Já Economizado</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{formatCurrency(totalSaved)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalTarget > 0 ? `${((totalSaved / totalTarget) * 100).toFixed(0)}% do total` : "N/A"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Falta</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalTarget - totalSaved)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Para atingir as metas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Goals List */}
          {goals.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {goals.map((goal) => {
                const Icon = getCategoryIcon(goal.category)
                const progress = calculateProgress(goal)
                const remaining = goal.targetAmount - goal.currentAmount
                const isCompleted = progress >= 100
                const timeRemaining = calculateTimeRemaining(goal.deadline)

                return (
                  <Card key={goal.id} className={cn(isCompleted && "border-green-500")}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={cn("rounded-lg bg-primary/10 p-2.5", getCategoryColor(goal.category))}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{goal.name}</CardTitle>
                              {isCompleted && <Badge className="bg-green-500">Concluída</Badge>}
                            </div>
                            <CardDescription className="mt-1">
                              {getCategoryLabel(goal.category)}
                              {goal.deadline && ` • ${timeRemaining}`}
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
                            <DropdownMenuItem onClick={() => handleEdit(goal)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                const amount = prompt("Quanto você quer adicionar?")
                                if (amount) handleAddAmount(goal.id, parseFloat(amount))
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Adicionar Valor
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(goal.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-medium">{progress.toFixed(0)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                      
                      <div className="flex justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Economizado</p>
                          <p className="text-lg font-semibold">{formatCurrency(goal.currentAmount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Meta</p>
                          <p className="text-lg font-semibold">{formatCurrency(goal.targetAmount)}</p>
                        </div>
                      </div>

                      {!isCompleted && (
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-sm">
                            <span className="font-medium text-foreground">Faltam {formatCurrency(remaining)}</span>
                            <span className="text-muted-foreground"> para atingir esta meta</span>
                          </p>
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
                  <PiggyBank className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma meta definida</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  Defina metas financeiras e acompanhe seu progresso para alcançar seus objetivos.
                </p>
                <Button onClick={() => setShowAddGoal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeira Meta
                </Button>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Add/Edit Goal Dialog */}
        <Dialog open={showAddGoal} onOpenChange={(open) => {
          if (!open) resetForm()
          setShowAddGoal(open)
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingGoal ? "Editar" : "Nova"} Meta</DialogTitle>
              <DialogDescription>
                Defina um objetivo financeiro e acompanhe o progresso.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="goal-name">Nome da Meta</Label>
                <Input
                  id="goal-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Viagem para Europa, Carro novo"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="goal-category">Categoria</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as FinancialGoal["category"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {goalCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="goal-target">Valor Alvo (R$)</Label>
                  <Input
                    id="goal-target"
                    type="number"
                    step="0.01"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="goal-current">Já Economizado (R$)</Label>
                  <Input
                    id="goal-current"
                    type="number"
                    step="0.01"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="goal-deadline">Prazo (opcional)</Label>
                <Input
                  id="goal-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => {
                resetForm()
                setShowAddGoal(false)
              }}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleAddGoal}>
                {editingGoal ? "Salvar" : "Criar Meta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  )
}
