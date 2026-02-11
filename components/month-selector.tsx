"use client"

import { Button } from "@/components/ui/button"
import { getMonthLabel } from "@/lib/types"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface MonthSelectorProps {
  currentMonthKey: string
  onChange: (monthKey: string) => void
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number)
  const date = new Date(year, month - 1 + delta)
  const newYear = date.getFullYear()
  const newMonth = String(date.getMonth() + 1).padStart(2, "0")
  return `${newYear}-${newMonth}`
}

export function MonthSelector({ currentMonthKey, onChange }: MonthSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8 bg-transparent"
        onClick={() => onChange(shiftMonth(currentMonthKey, -1))}
        aria-label="Mes anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[10rem] text-center text-sm font-medium capitalize text-foreground">
        {getMonthLabel(currentMonthKey)}
      </span>
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8 bg-transparent"
        onClick={() => onChange(shiftMonth(currentMonthKey, 1))}
        aria-label="Proximo mes"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
