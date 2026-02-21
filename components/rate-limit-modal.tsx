"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RateLimitModalProps {
  open: boolean
  planLabel: string
  onClose: () => void
}

const planOptions = [
  {
    id: "free_plan",
    title: "Free Plan",
    description: "Ideal para comecar e testar as principais funcoes.",
    limits: {
      calendar: "3",
      budgets: "3",
      investments: "3",
      goals: "3",
      recurring: "3",
    },
  },
  {
    id: "premium_plan",
    title: "Premium Plan",
    description: "Mais limites e recursos avancados para quem usa com frequencia.",
    limits: {
      calendar: "12",
      budgets: "20",
      investments: "50",
      goals: "15",
      recurring: "100",
    },
  },
  {
    id: "ultimate_plan",
    title: "Ultimate Plan",
    description: "Limites maximos e acesso completo para uso intenso.",
    limits: {
      calendar: "Ilimitado",
      budgets: "Ilimitado",
      investments: "Ilimitado",
      goals: "Ilimitado",
      recurring: "Ilimitado",
    },
  },
]

export function RateLimitModal({ open, planLabel, onClose }: RateLimitModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState("premium_plan")
  const selectedPlan = useMemo(
    () => planOptions.find((plan) => plan.id === selectedPlanId) ?? planOptions[0],
    [selectedPlanId],
  )

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) {
        onClose()
      }
    }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Limite do plano excedido</DialogTitle>
          <DialogDescription>
            Voce excedeu o uso do {planLabel}. Para continuar usando essa funcao, escolha um plano com mais limite.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {planOptions.map((plan) => {
              const isSelected = plan.id === selectedPlanId
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    isSelected ? "border-primary bg-primary/10" : "bg-muted/30 hover:border-muted-foreground/40",
                  )}
                >
                  <div className="text-sm font-semibold text-foreground">{plan.title}</div>
                  <div className="text-xs text-muted-foreground">{plan.description}</div>
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border">
            <div className="grid grid-cols-2 gap-2 border-b bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground">
              <span>Limite mensal</span>
              <span className="text-right">{selectedPlan.title}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 py-3 text-sm">
              <span>Registros no calendario</span>
              <span className="text-right font-semibold">{selectedPlan.limits.calendar}</span>
              <span>Orcamentos</span>
              <span className="text-right font-semibold">{selectedPlan.limits.budgets}</span>
              <span>Investimentos</span>
              <span className="text-right font-semibold">{selectedPlan.limits.investments}</span>
              <span>Metas</span>
              <span className="text-right font-semibold">{selectedPlan.limits.goals}</span>
              <span>Recorrencias</span>
              <span className="text-right font-semibold">{selectedPlan.limits.recurring}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Agora nao</Button>
          <Button>Escolher {selectedPlan.title}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
