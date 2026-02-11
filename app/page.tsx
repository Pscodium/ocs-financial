"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFinance } from "@/hooks/use-finance"
import { useAuth } from "@/hooks/use-auth"
import { AuthGuard } from "@/components/auth-guard"
import { SummaryCards } from "@/components/summary-cards"
import { CategoryCard } from "@/components/category-card"
import { MonthSelector } from "@/components/month-selector"
import { MonthlyChart } from "@/components/monthly-chart"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Copy, Wallet, LogOut, Wifi, WifiOff, RefreshCw, CloudUpload } from "lucide-react"
import { toast } from "sonner"
import { getMonthLabel } from "@/lib/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number)
  const date = new Date(year, month - 1 + delta)
  const newYear = date.getFullYear()
  const newMonth = String(date.getMonth() + 1).padStart(2, "0")
  return `${newYear}-${newMonth}`
}

export default function HomePage() {
  const finance = useFinance()
  const { logout, user } = useAuth()
  const router = useRouter()
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatSplit, setNewCatSplit] = useState("")
  const [newCatType, setNewCatType] = useState<"bills" | "income">("bills")
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)

  const handleLogout = () => {
    logout()
    router.push("/login")
    toast.success("Logout realizado")
  }

  const handleAddCategory = () => {
    if (!newCatName.trim()) return
    const splitNum = newCatSplit ? Number.parseInt(newCatSplit, 10) : undefined
    finance.addCategory(
      newCatName.trim(),
      newCatType,
      newCatType === "bills" && splitNum && splitNum > 1 ? splitNum : undefined,
    )
    setNewCatName("")
    setNewCatSplit("")
    setNewCatType("bills")
    setShowAddCategory(false)
    toast.success("Categoria criada!")
  }

  const handleDuplicate = () => {
    const nextMonth = shiftMonth(finance.currentMonthKey, 1)
    finance.duplicateMonthTo(nextMonth)
    setShowDuplicateConfirm(false)
    toast.success(`Contas copiadas para ${getMonthLabel(nextMonth)}`)
  }

  const handleSyncOfflineChanges = async () => {
    try {
      await finance.syncOfflineChanges()
      toast.success("Sincronização concluída! Suas mudanças foram enviadas ao servidor.")
    } catch (error) {
      toast.error("Erro ao sincronizar. Tente novamente.")
    }
  }

  const handleDiscardOfflineChanges = async () => {
    try {
      await finance.discardOfflineChanges()
      toast.success("Dados sincronizados com o servidor. Mudanças offline descartadas.")
    } catch (error) {
      toast.error("Erro ao sincronizar. Tente novamente.")
    }
  }

  if (!finance.loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const total = finance.getGrandTotal()
  const paid = finance.getGrandPaid()
  const income = finance.getIncomeTotal()
  const sobra = finance.getSobra()
  const myShare = finance.getMyShare()

  // Get previous month data for comparison
  const previousMonthKey = shiftMonth(finance.currentMonthKey, -1)
  const previousMonth = finance.allMonths.find((m) => m.monthKey === previousMonthKey)
  
  const previousMonthData = previousMonth ? {
    total: previousMonth.categories
      .filter((c) => c.type === "bills" || !c.type)
      .reduce((sum, c) => sum + c.bills.reduce((s, b) => s + b.amount, 0), 0),
    paid: previousMonth.categories
      .filter((c) => c.type === "bills" || !c.type)
      .reduce((sum, c) => sum + c.bills.filter((b) => b.paid).reduce((s, b) => s + b.amount, 0), 0),
    income: previousMonth.categories
      .filter((c) => c.type === "income")
      .reduce((sum, c) => sum + c.bills.reduce((s, b) => s + b.amount, 0), 0),
    myShare: previousMonth.categories
      .filter((c) => c.type === "bills" || !c.type)
      .reduce((sum, c) => {
        const catTotal = c.bills.reduce((s, b) => s + b.amount, 0)
        return sum + (c.splitBy && c.splitBy > 1 ? catTotal / c.splitBy : catTotal)
      }, 0),
    sobra: 0, // Will be calculated below
  } : undefined
  
  if (previousMonthData) {
    previousMonthData.sobra = previousMonthData.income - previousMonthData.myShare
  }

  const incomeCategories = finance.getIncomeCategories()
  const billCategories = finance.getBillCategories()

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">Gestor Financeiro</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <MonthSelector currentMonthKey={finance.currentMonthKey} onChange={finance.setCurrentMonthKey} />
              
              {/* API Status */}
              <div className="flex items-center gap-1.5 text-xs">
                {finance.isSyncing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="hidden text-muted-foreground sm:inline">Sincronizando...</span>
                  </>
                ) : finance.isApiOnline ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-green-600" />
                    <span className="hidden text-green-600 sm:inline">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-orange-600" />
                    <span className="hidden text-orange-600 sm:inline">Offline</span>
                  </>
                )}
              </div>

              {/* User menu */}
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{user?.firstName || "Sair"}</span>
              </Button>
            </div>
          </div>
        </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Offline Changes Alert */}
        {finance.hasPendingChanges && finance.isApiOnline && (
          <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 px-4 py-4 dark:border-orange-900 dark:bg-orange-950">
            <div className="flex items-start gap-3">
              <CloudUpload className="h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                  Você tem mudanças feitas offline
                </p>
                <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
                  Escolha como sincronizar seus dados:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={handleSyncOfflineChanges}
                    disabled={finance.isSyncing}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {finance.isSyncing ? (
                      <>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <CloudUpload className="mr-1.5 h-3.5 w-3.5" />
                        Enviar Mudanças ao Servidor
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleDiscardOfflineChanges}
                    disabled={finance.isSyncing}
                    size="sm"
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900"
                  >
                    {finance.isSyncing ? (
                      <>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        Usar Dados do Servidor
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <SummaryCards 
          total={total} 
          paid={paid} 
          income={income} 
          myShare={myShare} 
          sobra={sobra}
          previousMonthData={previousMonthData}
        />

        {/* Actions bar */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button onClick={() => setShowAddCategory(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Categoria
          </Button>
          {finance.currentMonth && finance.currentMonth.categories.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowDuplicateConfirm(true)}>
              <Copy className="mr-1.5 h-4 w-4" />
              Copiar para proximo mes
            </Button>
          )}
        </div>

        {/* Income Categories */}
        {incomeCategories.length > 0 && (
          <div className="mt-6 flex flex-col gap-4">
            {incomeCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                totalAmount={finance.getTotalByCategory(category)}
                paidAmount={0}
                onToggleBill={() => {}}
                onUpdateBill={(catId, billId, updates) => {
                  finance.updateBill(catId, billId, updates)
                  toast.success("Saldo atualizado!")
                }}
                onRemoveBill={(catId, billId) => {
                  finance.removeBill(catId, billId)
                  toast.success("Saldo removido!")
                }}
                onAddBill={(catId, bill) => {
                  finance.addBill(catId, bill)
                  toast.success("Saldo adicionado!")
                }}
                onUpdateCategory={(catId, name, splitBy) => {
                  finance.updateCategory(catId, name, splitBy)
                  toast.success("Categoria atualizada!")
                }}
                onRemoveCategory={(catId) => {
                  finance.removeCategory(catId)
                  toast.success("Categoria removida!")
                }}
              />
            ))}
          </div>
        )}

        {/* Bill Categories */}
        <div className="mt-6 flex flex-col gap-4">
          {billCategories.length === 0 && incomeCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-16">
              <Wallet className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-foreground">Nenhuma categoria neste mes</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crie uma nova categoria ou copie de outro mes
                </p>
              </div>
              <Button size="sm" onClick={() => setShowAddCategory(true)} className="mt-2">
                <Plus className="mr-1.5 h-4 w-4" />
                Criar Categoria
              </Button>
            </div>
          ) : (
            billCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                totalAmount={finance.getTotalByCategory(category)}
                paidAmount={finance.getPaidByCategory(category)}
                onToggleBill={(catId, billId) => {
                  finance.toggleBillPaid(catId, billId)
                }}
                onUpdateBill={(catId, billId, updates) => {
                  finance.updateBill(catId, billId, updates)
                  toast.success("Conta atualizada!")
                }}
                onRemoveBill={(catId, billId) => {
                  finance.removeBill(catId, billId)
                  toast.success("Conta removida!")
                }}
                onAddBill={(catId, bill) => {
                  finance.addBill(catId, bill)
                  toast.success("Conta adicionada!")
                }}
                onUpdateCategory={(catId, name, splitBy) => {
                  finance.updateCategory(catId, name, splitBy)
                  toast.success("Categoria atualizada!")
                }}
                onRemoveCategory={(catId) => {
                  finance.removeCategory(catId)
                  toast.success("Categoria removida!")
                }}
              />
            ))
          )}
        </div>

        {/* Chart */}
        {finance.allMonths.length > 0 && (
          <div className="mb-12 mt-8">
            <MonthlyChart allMonths={finance.allMonths} />
          </div>
        )}
      </main>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova Categoria</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Crie uma nova categoria para agrupar suas contas ou saldos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-cat-type" className="text-foreground">
                Tipo
              </Label>
              <Select value={newCatType} onValueChange={(v) => setNewCatType(v as "bills" | "income")}>
                <SelectTrigger id="new-cat-type" className="text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bills">Contas (com checkbox de pagamento)</SelectItem>
                  <SelectItem value="income">Saldos em Conta (lista informativa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-cat-name" className="text-foreground">
                Nome da categoria
              </Label>
              <Input
                id="new-cat-name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder={newCatType === "income" ? "Ex: Saldos em Conta" : "Ex: Contas Casa"}
                className="text-foreground"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCategory()
                }}
              />
            </div>
            {newCatType === "bills" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-cat-split" className="text-foreground">
                  Dividir total por (opcional)
                </Label>
                <Input
                  id="new-cat-split"
                  value={newCatSplit}
                  onChange={(e) => setNewCatSplit(e.target.value)}
                  placeholder="Ex: 2"
                  type="number"
                  min="1"
                  className="text-foreground"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCategory()
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Util para contas compartilhadas (ex: dividir contas da casa por 2)
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategory(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddCategory}>Criar Categoria</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Confirm Dialog */}
      <AlertDialog open={showDuplicateConfirm} onOpenChange={setShowDuplicateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Copiar para proximo mes?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as categorias e contas serao copiadas para{" "}
              <strong>{getMonthLabel(shiftMonth(finance.currentMonthKey, 1))}</strong> com os mesmos valores,
              mas todas marcadas como nao pagas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDuplicate}>Copiar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </AuthGuard>
  )
}
