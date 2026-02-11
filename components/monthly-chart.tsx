"use client"

import { useMemo } from "react"
import type { MonthData } from "@/lib/types"
import { getMonthLabel, formatCurrency } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts"

interface MonthlyChartProps {
  allMonths: MonthData[]
}

const GREEN = "hsl(142, 76%, 36%)"      // Pago
const ORANGE = "hsl(35, 92%, 52%)"      // Pendente
const BLUE = "hsl(210, 70%, 50%)"       // Total
const TEAL = "hsl(170, 60%, 40%)"       // Saldo em Conta
const PURPLE = "hsl(262, 70%, 55%)"     // Sobra (Leftover)

const chartConfig = {
  income: {
    label: "Saldo em Conta",
    color: TEAL,
  },
  total: {
    label: "Total Contas",
    color: BLUE,
  },
  leftover: {
    label: "Sobra",
    color: PURPLE,
  },
  paid: {
    label: "Pago",
    color: GREEN,
  },
  pending: {
    label: "Pendente",
    color: ORANGE,
  },
} satisfies ChartConfig

export function MonthlyChart({ allMonths }: MonthlyChartProps) {
  const chartData = useMemo(() => {
    const sorted = [...allMonths]
      .filter((m) => m && m.monthKey)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

    return sorted.map((month) => {
      const billCategories = month.categories.filter((c) => c.type === "bills" || !c.type)
      const incomeCategories = month.categories.filter((c) => c.type === "income")

      const total = billCategories.reduce((sum, c) => sum + c.bills.reduce((s, b) => s + b.amount, 0), 0)
      const paid = billCategories.reduce(
        (sum, c) => sum + c.bills.filter((b) => b.paid).reduce((s, b) => s + b.amount, 0),
        0,
      )
      const income = incomeCategories.reduce((sum, c) => sum + c.bills.reduce((s, b) => s + b.amount, 0), 0)

      const myShare = billCategories.reduce((sum, c) => {
        const catTotal = c.bills.reduce((s, b) => s + b.amount, 0)
        return sum + (c.splitBy && c.splitBy > 1 ? catTotal / c.splitBy : catTotal)
      }, 0)

      const leftover = income - myShare

      const label = getMonthLabel(month.monthKey)
      const shortLabel = label.split(" ")[0]?.substring(0, 3).toUpperCase() || month.monthKey


      return {
        month: shortLabel,
        fullLabel: label,
        income,
        total,
        paid,
        leftover,
        pending: total - paid,
      }
    })
  }, [allMonths])

  if (chartData.length === 0) {
    return null
  }

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">Comparativo Mensal</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`}
              width={60}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    const labels: Record<string, string> = {
                      income: "Saldo em Conta",
                      total: "Total Contas",
                      paid: "Pago",
                      leftover: "Sobra",
                      pending: "Pendente",
                    }
                    const colors: Record<string, string> = {
                      income: TEAL,
                      total: BLUE,
                      paid: GREEN,
                      leftover: PURPLE,
                      pending: ORANGE,
                    }
                    return (
                      <span className="flex items-center gap-2">
                        <span 
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: colors[name as string] }}
                        />
                        <span>
                          {labels[name as string] || name}: {formatCurrency(value as number)}
                        </span>
                      </span>
                    )
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke={TEAL}
              strokeWidth={2.5}
              dot={{ r: 4, fill: TEAL, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke={BLUE}
              strokeWidth={2.5}
              dot={{ r: 4, fill: BLUE, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="paid"
              stroke={GREEN}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 3, fill: GREEN, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="leftover"
              stroke={PURPLE}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 3, fill: PURPLE, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="pending"
              stroke={ORANGE}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 3, fill: ORANGE, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TEAL }} />
            <span className="text-xs text-muted-foreground">Saldo em Conta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BLUE }} />
            <span className="text-xs text-muted-foreground">Total Contas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GREEN }} />
            <span className="text-xs text-muted-foreground">Pago</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PURPLE }} />
            <span className="text-xs text-muted-foreground">Sobra</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ORANGE }} />
            <span className="text-xs text-muted-foreground">Pendente</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
