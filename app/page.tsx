"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFinance } from "@/hooks/use-finance"
import { useAuth } from "@/hooks/use-auth"
import { AuthGuard } from "@/components/auth-guard"
import { AppTabs } from "@/components/app-tabs"
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
import { 
  Plus, 
  Copy, 
  Wallet, 
  LogOut, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CloudUpload,
  ArrowUpCircle,
  ArrowDownCircle,
  LayoutDashboard
} from "lucide-react"
import { toast } from "sonner"
import { getMonthLabel } from "@/lib/types"
import { cn } from "@/lib/utils"

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
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground animate-pulse">Carregando dados financeiros...</p>
        </div>
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
      <div className="min-h-screen bg-muted/20 pb-12">
        {/* Modern Header */}
        <header className="sticky top-0 z-20 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 px-3 py-1.5 transition-colors hover:bg-primary/20">
                <Wallet className="h-5 w-5 text-primary" />
                <span className="font-semibold tracking-tight select-none text-foreground hidden sm:inline-block">Gestor Financeiro</span>
              </div>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <MonthSelector currentMonthKey={finance.currentMonthKey} onChange={finance.setCurrentMonthKey} />
            </div>

            <div className="flex items-center gap-4 select-none">
              {/* API Status Indicator */}
              <div className="hidden items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs md:flex">
                {finance.isSyncing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Sincronizando...</span>
                  </>
                ) : finance.isApiOnline ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-green-600" />
                    <span className="font-medium text-green-600">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-orange-600" />
                    <span className="font-medium text-orange-600">Offline</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                 <Button 
                  onClick={() => setShowAddCategory(true)} 
                  size="sm"
                  className="hidden sm:flex"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nova Categoria
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
                  <LogOut className="h-5 w-5" />
                  <span className="sr-only">Sair</span>
                </Button>
              </div>
            </div>
          </div>
          <AppTabs />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Welcome & Action Bar Mobile */}
          <div className="mb-8 flex select-none flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
              <p className="mt-1 text-muted-foreground">
                Visão geral e gestão de contas para {getMonthLabel(finance.currentMonthKey)}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:hidden">
              <Button onClick={() => setShowAddCategory(true)} size="sm" className="flex-1">
                <Plus className="mr-1.5 h-4 w-4" />
                Nova Categoria
              </Button>
            </div>

            {finance.currentMonth && finance.currentMonth.categories.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowDuplicateConfirm(true)}
                className="hidden md:flex"
              >
                <Copy className="mr-1.5 h-4 w-4" />
                Copiar para o próximo mês
              </Button>
            )}
          </div>

          {/* Offline Changes Alert - Re-styled */}
          {finance.hasPendingChanges && finance.isApiOnline && (
            <div className="mb-8 overflow-hidden rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/20">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-900/40">
                    <CloudUpload className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100">Sincronização Pendente</h3>
                    <p className="text-sm text-orange-700 dark:text-orange-300">Você tem alterações salvas offline que precisam ser enviadas.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSyncOfflineChanges}
                    disabled={finance.isSyncing}
                    size="sm"
                    className="bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-500"
                  >
                    {finance.isSyncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sincronizar
                  </Button>
                  <Button
                    onClick={handleDiscardOfflineChanges}
                    disabled={finance.isSyncing}
                    size="sm"
                    variant="ghost"
                    className="text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:text-orange-300 dark:hover:bg-orange-900/50"
                  >
                    Descartar Offline
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="mb-10">
            <SummaryCards 
              total={total} 
              paid={paid} 
              income={income} 
              myShare={myShare} 
              sobra={sobra}
              previousMonthData={previousMonthData}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left Column: Income (Takes 4/12 columns on large screens) */}
            <div className="lg:col-span-12 xl:col-span-5 space-y-6">
              <div className="flex items-center justify-between border-b pb-2 select-none">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-green-500" />
                  <h2 className="text-xl font-semibold tracking-tight">Entradas & Saldos</h2>
                </div>
                {incomeCategories.length > 0 && <span className="text-sm text-muted-foreground">{incomeCategories.length} categorias</span>}
              </div>

              {incomeCategories.length > 0 ? (
                <div className="grid gap-5">
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
              ) : (
                <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground bg-card/50">
                   <p className="text-sm">Nenhuma categoria de entrada.</p>
                   <Button variant="link" onClick={() => {
                        setNewCatType('income')
                        setShowAddCategory(true)
                   }} className="mt-2 h-auto p-0">
                     Adicionar Entradas
                   </Button>
                </div>
              )}
            </div>

            {/* Right Column: Bills (Takes 8/12 columns on large screens) */}
            <div className="lg:col-span-12 xl:col-span-7 space-y-6">
              <div className="flex items-center justify-between border-b pb-2 select-none">
                <div className="flex items-center gap-2">
                   <ArrowDownCircle className="h-5 w-5 text-red-500" />
                   <h2 className="text-xl font-semibold tracking-tight">Despesas & Contas</h2>
                </div>
                {billCategories.length > 0 && <span className="text-sm text-muted-foreground">{billCategories.length} categorias</span>}
              </div>

              {billCategories.length > 0 ? (
                <div className="grid gap-5">
                  {billCategories.map((category) => (
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
                  ))}
                </div>
              ) : incomeCategories.length > 0 ? (
                 /* Has income but no bills */
                 <div className="rounded-xl border border-dashed p-10 flex flex-col items-center justify-center text-center text-muted-foreground bg-card/50">
                   <div className="bg-muted p-4 rounded-full mb-4">
                     <Wallet className="w-8 h-8 text-muted-foreground/50" />
                   </div>
                   <p className="font-medium">Nenhuma despesa cadastrada</p>
                   <p className="text-sm mt-1 max-w-xs">Comece adicionando categorias de despesas para controlar seus gastos deste mês.</p>
                   <Button variant="outline" className="mt-4" onClick={() => {
                      setNewCatType('bills')
                      setShowAddCategory(true)
                   }}>
                     Criar Categoria de Despesas
                   </Button>
                   <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowDuplicateConfirm(true)}>
                     <Copy className="mr-1.5 h-3 w-3" />
                     Copiar do mês anterior
                   </Button>
                 </div>
              ) : (
                /* No categories at all - Shown in bills column if empty */
                <div className="rounded-xl border border-dashed p-10 flex flex-col items-center justify-center text-center text-muted-foreground bg-card/50">
                    <p>Você ainda não adicionou nenhuma conta este mês.</p>
                    <div className="flex gap-2 mt-4">
                      <Button onClick={() => setShowAddCategory(true)}>Criar Categoria</Button>
                      <Button variant="outline" onClick={() => setShowDuplicateConfirm(true)}>Copiar Mês Anterior</Button>
                    </div>
                </div>
              )}
            </div>
          </div>

          {/* Chart Section - Dashboard Style */}
          {finance.allMonths.length > 0 && (
             <div className="mt-12 space-y-4 select-none">
                <div className="flex items-center gap-2">
                   <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
                   <h2 className="text-xl font-semibold tracking-tight">Evolução Financeira</h2>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                  <div className="p-6">
                    <MonthlyChart allMonths={finance.allMonths} />
                  </div>
                </div>
             </div>
          )}

        </main>

        {/* Floating Action Button mobile - if needed, but we have the button in header/top */}

        {/* Dialogs */}
        <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
              <DialogDescription>
                Organize suas finanças agrupando contas ou saldos.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-cat-type">Tipo de Categoria</Label>
                <div className="grid grid-cols-2 gap-2">
                   <div 
                      className={cn(
                        "cursor-pointer rounded-lg border-2 p-3 text-center transition-all hover:border-primary/50",
                        newCatType === "bills" ? "border-primary bg-primary/5" : "border-muted bg-transparent"
                      )}
                      onClick={() => setNewCatType("bills")}
                   >
                      <div className="mb-1 flex justify-center"><ArrowDownCircle className="h-5 w-5 text-red-500" /></div>
                      <span className="text-sm font-medium">Contas e Despesas</span>
                   </div>
                   <div 
                      className={cn(
                        "cursor-pointer rounded-lg border-2 p-3 text-center transition-all hover:border-primary/50",
                        newCatType === "income" ? "border-primary bg-primary/5" : "border-muted bg-transparent"
                      )}
                      onClick={() => setNewCatType("income")}
                   >
                      <div className="mb-1 flex justify-center"><ArrowUpCircle className="h-5 w-5 text-green-500" /></div>
                      <span className="text-sm font-medium">Entradas e Saldos</span>
                   </div>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="new-cat-name">Nome da categoria</Label>
                <Input
                  id="new-cat-name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={newCatType === "income" ? "Ex: Banco XYZ, Carteira" : "Ex: Casa, Cartão de Crédito"}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCategory()
                  }}
                />
              </div>

              {newCatType === "bills" && (
                <div className="grid gap-2">
                  <Label htmlFor="new-cat-split">Dividir total por (opcional)</Label>
                  <div className="flex gap-2">
                     <Input
                        id="new-cat-split"
                        value={newCatSplit}
                        onChange={(e) => setNewCatSplit(e.target.value)}
                        placeholder="Ex: 2"
                        type="number"
                        min="1"
                        className="flex-1"
                        onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddCategory()
                        }}
                     />
                  </div>
                  <p className="text-[0.8rem] text-muted-foreground">
                    Ex: Coloque "2" para dividir o valor das contas desta categoria com outra pessoa.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setShowAddCategory(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleAddCategory}>Criar Categoria</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Duplicate Confirm Dialog */}
        <AlertDialog open={showDuplicateConfirm} onOpenChange={setShowDuplicateConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Copiar para próximo mês?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso criará uma cópia de todas as categorias e contas atuais para o mês de{" "}
                <span className="font-semibold text-foreground">{getMonthLabel(shiftMonth(finance.currentMonthKey, 1))}</span>.
                <br/><br/>
                Os valores serão mantidos, mas o status de pagamento será redefinido para "pendente".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDuplicate}>Confirmar Cópia</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AuthGuard>
  )
}
