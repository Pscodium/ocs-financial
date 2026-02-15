"use client"

import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Target,
  TrendingUp,
  PiggyBank,
  BarChart3,
  Repeat,
} from "lucide-react"

const tabs = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    id: "budgets",
    label: "Orçamentos",
    icon: Target,
    href: "/budgets",
  },
  {
    id: "investments",
    label: "Investimentos",
    icon: TrendingUp,
    href: "/investments",
  },
  {
    id: "goals",
    label: "Metas",
    icon: PiggyBank,
    href: "/goals",
  },
  {
    id: "analytics",
    label: "Análises",
    icon: BarChart3,
    href: "/analytics",
  },
  {
    id: "recurring",
    label: "Recorrentes",
    icon: Repeat,
    href: "/recurring",
  },
]

export function AppTabs() {
  const router = useRouter()
  const pathname = usePathname()

  const currentTab = tabs.find((tab) => tab.href === pathname) || tabs[0]

  return (
    <div className="border-b bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = pathname === tab.href
            
            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.href)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
