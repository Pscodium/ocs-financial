"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getMonthLabel } from "@/lib/types"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

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

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
]

export function MonthSelector({ currentMonthKey, onChange }: MonthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [year, month] = currentMonthKey.split("-").map(Number)
  const [selectedYear, setSelectedYear] = useState(year)
  
  // Get current month/year (today's date)
  const today = new Date()
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()

  const handleMonthSelect = (monthIndex: number) => {
    const monthStr = String(monthIndex + 1).padStart(2, "0")
    onChange(`${selectedYear}-${monthStr}`)
    setIsOpen(false)
  }

  const handleYearChange = (delta: number) => {
    setSelectedYear(prev => prev + delta)
  }

  return (
    <div className="flex items-center gap-2 select-none">
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8 bg-transparent"
        onClick={() => onChange(shiftMonth(currentMonthKey, -1))}
        aria-label="Mes anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="min-w-[10rem] justify-center gap-2 bg-transparent font-medium capitalize"
          >
            <Calendar className="h-4 w-4" />
            {getMonthLabel(currentMonthKey)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="center">
          <div className="space-y-4">
            {/* Year selector */}
            <div className="flex items-center justify-between">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => handleYearChange(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold">{selectedYear}</span>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => handleYearChange(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((monthName, index) => {
                const isSelected = selectedYear === year && index === month - 1
                const isCurrentMonth = selectedYear === currentYear && index === currentMonth - 1
                return (
                  <Button
                    key={monthName}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "h-10 text-sm",
                      isSelected && "font-semibold",
                      isCurrentMonth && !isSelected && "ring-2 ring-primary ring-offset-1"
                    )}
                    onClick={() => handleMonthSelect(index)}
                  >
                    {monthName}
                  </Button>
                )
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>

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
