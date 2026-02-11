"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCurrency } from "@/lib/types"
import { DollarSign, CheckCircle2, Clock, TrendingUp, Wallet, PiggyBank, ArrowUpRight, ArrowDownRight, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface SummaryCardsProps {
  total: number
  paid: number
  income: number
  myShare: number
  sobra: number
  previousMonthData?: {
    total: number
    paid: number
    income: number
    myShare: number
    sobra: number
  }
}

interface PercentageChangeProps {
  current: number
  previous?: number
  showPositiveAsGood?: boolean
}

function PercentageChange({ current, previous, showPositiveAsGood = true }: PercentageChangeProps) {
  if (previous === undefined || previous === 0) return null
  
  const change = ((current - previous) / previous) * 100
  const isPositive = change > 0
  const isGood = showPositiveAsGood ? isPositive : !isPositive
  
  if (Math.abs(change) < 0.01) return null
  
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs font-medium",
      isGood ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
    )}>
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {Math.abs(change).toFixed(1)}%
    </span>
  )
}

export function SummaryCards({ total, paid, income, myShare, sobra, previousMonthData }: SummaryCardsProps) {
  const pending = total - paid
  const paidPercent = total > 0 ? Math.round((paid / total) * 100) : 0
  const hasSplit = myShare !== total
  
  const previousPending = previousMonthData ? previousMonthData.total - previousMonthData.paid : undefined
  const previousPaidPercent = previousMonthData && previousMonthData.total > 0 
    ? Math.round((previousMonthData.paid / previousMonthData.total) * 100) 
    : undefined

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {/* Saldo em Conta */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-none shadow-sm cursor-help transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Saldo em Conta</p>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                  <p className="truncate font-mono text-lg font-semibold text-primary">
                    {formatCurrency(income)}
                  </p>
                  {previousMonthData && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PercentageChange 
                        current={income} 
                        previous={previousMonthData.income}
                        showPositiveAsGood={true}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-semibold mb-1">Saldo Total em Conta</p>
            <p className="text-xs">Soma de todos os rendimentos e valores disponíveis.</p>
            {previousMonthData && (
              <p className="text-xs mt-1 text-muted-foreground">
                Mês anterior: {formatCurrency(previousMonthData.income)}
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Total do Mes */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-none shadow-sm cursor-help transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <DollarSign className="h-5 w-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Total do Mês</p>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                  <p className="truncate font-mono text-lg font-semibold text-foreground">
                    {formatCurrency(total)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {previousMonthData && (
                      <PercentageChange 
                        current={total} 
                        previous={previousMonthData.total}
                        showPositiveAsGood={false}
                      />
                    )}
                    {hasSplit && (
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        Minha parte: {formatCurrency(myShare)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-semibold mb-1">Total de Contas do Mês</p>
            <p className="text-xs">Soma de todas as contas e despesas do mês.</p>
            {hasSplit && (
              <p className="text-xs mt-1">Sua parte: {formatCurrency(myShare)} (contas dividas incluídas)</p>
            )}
            {previousMonthData && (
              <p className="text-xs mt-1 text-muted-foreground">
                Mês anterior: {formatCurrency(previousMonthData.total)}
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Pago */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-none shadow-sm cursor-help transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Pago</p>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                  <p className="truncate font-mono text-lg font-semibold text-success">
                    {formatCurrency(paid)}
                  </p>
                  {previousMonthData && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PercentageChange 
                        current={paid} 
                        previous={previousMonthData.paid}
                        showPositiveAsGood={false}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-semibold mb-1">Contas Pagas</p>
            <p className="text-xs">Total já pago das contas marcadas como concluídas.</p>
            {previousMonthData && (
              <p className="text-xs mt-1 text-muted-foreground">
                Mês anterior: {formatCurrency(previousMonthData.paid)}
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Pendente */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-none shadow-sm cursor-help transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Pendente</p>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                  <p className="truncate font-mono text-lg font-semibold text-warning">
                    {formatCurrency(pending)}
                  </p>
                  {previousMonthData && previousPending !== undefined && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PercentageChange 
                        current={pending} 
                        previous={previousPending}
                        showPositiveAsGood={false}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-semibold mb-1">Contas Pendentes</p>
            <p className="text-xs">Valor que ainda falta pagar das contas do mês.</p>
            {previousMonthData && previousPending !== undefined && (
              <p className="text-xs mt-1 text-muted-foreground">
                Mês anterior: {formatCurrency(previousPending)}
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Sobra do Mes */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-none shadow-sm cursor-help transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    sobra >= 0 ? "bg-primary/10" : "bg-destructive/10",
                  )}
                >
                  <PiggyBank className={cn("h-5 w-5", sobra >= 0 ? "text-primary" : "text-destructive")} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Sobra do Mês</p>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                  <p
                    className={cn(
                      "truncate font-mono text-lg font-semibold",
                      sobra >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {formatCurrency(sobra)}
                  </p>
                  {previousMonthData && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PercentageChange 
                        current={sobra} 
                        previous={previousMonthData.sobra}
                        showPositiveAsGood={true}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-semibold mb-1">Sobra Mensal</p>
            <p className="text-xs">Diferença entre seu saldo em conta e sua parte das contas.</p>
            <p className="text-xs mt-1 font-mono">
              {formatCurrency(income)} - {formatCurrency(myShare)} = {formatCurrency(sobra)}
            </p>
            {previousMonthData && (
              <p className="text-xs mt-1 text-muted-foreground">
                Mês anterior: {formatCurrency(previousMonthData.sobra)}
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Progresso */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-none shadow-sm cursor-help transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <TrendingUp className="h-5 w-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Progresso</p>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-lg font-semibold text-foreground">{paidPercent}%</p>
                    {previousMonthData && previousPaidPercent !== undefined && (
                      <PercentageChange 
                        current={paidPercent} 
                        previous={previousPaidPercent}
                        showPositiveAsGood={true}
                      />
                    )}
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${paidPercent}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-semibold mb-1">Progresso de Pagamento</p>
            <p className="text-xs">Percentual das contas já pagas em relação ao total.</p>
            <p className="text-xs mt-1">{formatCurrency(paid)} de {formatCurrency(total)}</p>
            {previousMonthData && previousPaidPercent !== undefined && (
              <p className="text-xs mt-1 text-muted-foreground">
                Mês anterior: {previousPaidPercent}%
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
