"use client"

import { useMemo } from "react"
import { useFinance } from "@/hooks/use-finance"
import { AuthGuard } from "@/components/auth-guard"
import { AppTabs } from "@/components/app-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MonthlyChart } from "@/components/monthly-chart"
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, PieChart } from "lucide-react"
import { formatCurrency, getMonthLabel } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function AnalyticsPage() {
  const finance = useFinance()

  const analytics = useMemo(() => {
    const months = finance.allMonths
    if (months.length === 0) return null

    // Calculate averages
    const avgIncome = months.reduce((sum, m) => {
      const income = m.categories
        .filter((c) => c.type === "income")
        .reduce((s, c) => s + c.bills.reduce((bs, b) => bs + b.amount, 0), 0)
      return sum + income
    }, 0) / months.length

    const avgExpenses = months.reduce((sum, m) => {
      const expenses = m.categories
        .filter((c) => c.type === "bills" || !c.type)
        .reduce((s, c) => s + c.bills.reduce((bs, b) => bs + b.amount, 0), 0)
      return sum + expenses
    }, 0) / months.length

    const avgSavings = avgIncome - avgExpenses

    // Find highest and lowest months
    const monthsWithData = months.map((m) => {
      const income = m.categories
        .filter((c) => c.type === "income")
        .reduce((s, c) => s + c.bills.reduce((bs, b) => bs + b.amount, 0), 0)
      const expenses = m.categories
        .filter((c) => c.type === "bills" || !c.type)
        .reduce((s, c) => s + c.bills.reduce((bs, b) => bs + b.amount, 0), 0)
      return {
        monthKey: m.monthKey,
        income,
        expenses,
        savings: income - expenses,
      }
    })

    const highestExpense = monthsWithData.reduce((max, m) => 
      m.expenses > max.expenses ? m : max
    )
    const lowestExpense = monthsWithData.reduce((min, m) => 
      m.expenses < min.expenses ? m : min
    )
    const highestSavings = monthsWithData.reduce((max, m) => 
      m.savings > max.savings ? m : max
    )

    // Category analysis
    const categoryTotals = new Map<string, { name: string; total: number; count: number }>()
    
    months.forEach((m) => {
      m.categories
        .filter((c) => c.type === "bills" || !c.type)
        .forEach((c) => {
          const total = c.bills.reduce((s, b) => s + b.amount, 0)
          const existing = categoryTotals.get(c.name) || { name: c.name, total: 0, count: 0 }
          categoryTotals.set(c.name, {
            name: c.name,
            total: existing.total + total,
            count: existing.count + 1,
          })
        })
    })

    const topCategories = Array.from(categoryTotals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((c) => ({
        name: c.name,
        total: c.total,
        average: c.total / c.count,
      }))

    // Trend analysis (last 3 months vs previous 3)
    let trend: "increasing" | "decreasing" | "stable" = "stable"
    if (months.length >= 6) {
      const recent3 = monthsWithData.slice(-3)
      const previous3 = monthsWithData.slice(-6, -3)
      
      const recentAvg = recent3.reduce((sum, m) => sum + m.expenses, 0) / 3
      const previousAvg = previous3.reduce((sum, m) => sum + m.expenses, 0) / 3
      
      const change = ((recentAvg - previousAvg) / previousAvg) * 100
      
      if (change > 5) trend = "increasing"
      else if (change < -5) trend = "decreasing"
    }

    return {
      avgIncome,
      avgExpenses,
      avgSavings,
      highestExpense,
      lowestExpense,
      highestSavings,
      topCategories,
      trend,
      totalMonths: months.length,
    }
  }, [finance.allMonths])

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

  if (!analytics) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-muted/20">
          <AppTabs />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Dados insuficientes</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Adicione dados financeiros para visualizar análises e insights.
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-muted/20">
        <AppTabs />
        
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Análises e Relatórios</h1>
            <p className="mt-1 text-muted-foreground">
              Insights sobre seus hábitos financeiros baseados em {analytics.totalMonths} meses de dados
            </p>
          </div>

          {/* Average Summary Cards */}
          <div className="mb-8 grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Média</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analytics.avgIncome)}</div>
                <p className="text-xs text-muted-foreground mt-1">Por mês</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Despesa Média</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analytics.avgExpenses)}</div>
                <p className="text-xs text-muted-foreground mt-1">Por mês</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Economia Média</CardTitle>
                <DollarSign className={cn("h-4 w-4", analytics.avgSavings >= 0 ? "text-green-500" : "text-red-500")} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", analytics.avgSavings >= 0 ? "text-green-500" : "text-red-500")}>
                  {formatCurrency(analytics.avgSavings)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Por mês</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tendência</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "text-2xl font-bold",
                  analytics.trend === "increasing" ? "text-red-500" :
                  analytics.trend === "decreasing" ? "text-green-500" : "text-muted-foreground"
                )}>
                  {analytics.trend === "increasing" ? "↑ Crescendo" :
                   analytics.trend === "decreasing" ? "↓ Reduzindo" : "→ Estável"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Despesas</p>
              </CardContent>
            </Card>
          </div>

          {/* Records */}
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Maior Despesa</CardTitle>
                <CardDescription>Registro histórico</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-red-500">
                    {formatCurrency(analytics.highestExpense.expenses)}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {getMonthLabel(analytics.highestExpense.monthKey)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Menor Despesa</CardTitle>
                <CardDescription>Registro histórico</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(analytics.lowestExpense.expenses)}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {getMonthLabel(analytics.lowestExpense.monthKey)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Maior Economia</CardTitle>
                <CardDescription>Registro histórico</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(analytics.highestSavings.savings)}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {getMonthLabel(analytics.highestSavings.monthKey)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Categories */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                <CardTitle>Top 5 Categorias de Despesa</CardTitle>
              </div>
              <CardDescription>
                Suas maiores categorias de gastos no período
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.topCategories.map((cat, index) => {
                  const maxTotal = analytics.topCategories[0].total
                  const percentage = (cat.total / maxTotal) * 100
                  
                  return (
                    <div key={cat.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          <span className="font-medium">{cat.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(cat.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            Média: {formatCurrency(cat.average)}
                          </p>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Evolution Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle>Evolução Financeira</CardTitle>
              </div>
              <CardDescription>
                Visualização histórica de receitas, despesas e economia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MonthlyChart allMonths={finance.allMonths} />
            </CardContent>
          </Card>
        </main>
      </div>
    </AuthGuard>
  )
}
