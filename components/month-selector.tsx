"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { getMonthLabel } from "@/lib/types"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

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
  const isMobile = useIsMobile()

  useEffect(() => {
    setSelectedYear(year)
  }, [year])
  
  // Get current month/year (today's date)
  const today = new Date()
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()

  const getShortMonthLabel = (monthKey: string) => {
    const [yearValue, monthValue] = monthKey.split("-").map(Number)
    const date = new Date(yearValue, monthValue - 1)
    const monthLabel = date.toLocaleDateString("pt-BR", { month: "short" })
    const shortMonth = monthLabel.replace(".", "").slice(0, 3)
    return `${shortMonth} ${yearValue}`
  }

  const handleMonthSelect = (monthIndex: number) => {
    const monthStr = String(monthIndex + 1).padStart(2, "0")
    onChange(`${selectedYear}-${monthStr}`)
    setIsOpen(false)
  }

  const handleYearChange = (delta: number) => {
    setSelectedYear(prev => prev + delta)
  }

  const monthPickerContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => handleYearChange(-1)}
          aria-label="Ano anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold">{selectedYear}</span>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => handleYearChange(1)}
          aria-label="Próximo ano"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

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
  )

  return (
    <div className="flex items-center select-none">
      {isMobile ? (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 bg-transparent"
              aria-label={`Selecionar mês (${getMonthLabel(currentMonthKey)})`}
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Selecionar mês</DrawerTitle>
              <DrawerDescription>{getMonthLabel(currentMonthKey)}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6">{monthPickerContent}</div>
          </DrawerContent>
        </Drawer>
      ) : (
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

          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="min-w-[10rem] justify-center gap-2 bg-transparent font-medium capitalize"
              >
                <Calendar className="h-4 w-4" />
                <span>{getMonthLabel(currentMonthKey)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="center">
              {monthPickerContent}
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
      )}
    </div>
  )
}
