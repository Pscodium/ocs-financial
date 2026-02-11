"use client"

import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/types"
import { DollarSign, CheckCircle2, Clock, TrendingUp, Wallet, PiggyBank, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface SummaryCardsProps {
  total: number
  paid: number
  income: number
  myShare: number
  sobra: number
}

export function SummaryCards({ total, paid, income, myShare, sobra }: SummaryCardsProps) {
  const pending = total - paid
  const paidPercent = total > 0 ? Math.round((paid / total) * 100) : 0
  const hasSplit = myShare !== total

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-3">
      {/* Saldo em Conta */}
      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Saldo em Conta</p>
            <p className="truncate font-mono text-lg font-semibold text-primary">
              {formatCurrency(income)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Total do Mes */}
      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <DollarSign className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Total do Mes</p>
            <p className="truncate font-mono text-lg font-semibold text-foreground">
              {formatCurrency(total)}
            </p>
            {hasSplit && (
              <p className="truncate font-mono text-xs text-muted-foreground">
                Minha parte: {formatCurrency(myShare)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pago */}
      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="truncate font-mono text-lg font-semibold text-success">
              {formatCurrency(paid)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pendente */}
      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="truncate font-mono text-lg font-semibold text-warning">
              {formatCurrency(pending)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sobra do Mes */}
      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              sobra >= 0 ? "bg-primary/10" : "bg-destructive/10",
            )}
          >
            <PiggyBank className={cn("h-5 w-5", sobra >= 0 ? "text-primary" : "text-destructive")} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Sobra do Mes</p>
            <p
              className={cn(
                "truncate font-mono text-lg font-semibold",
                sobra >= 0 ? "text-primary" : "text-destructive",
              )}
            >
              {formatCurrency(sobra)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Progresso */}
      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <TrendingUp className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Progresso</p>
            <p className="font-mono text-lg font-semibold text-foreground">{paidPercent}%</p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${paidPercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
