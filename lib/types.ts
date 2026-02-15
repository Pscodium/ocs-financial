export interface Bill {
  id: string
  name: string
  amount: number
  paid: boolean
  categoryId: string
  note?: string
}

export interface Category {
  id: string
  name: string
  bills: Bill[]
  /** "bills" = contas com checkbox, "income" = saldos informativos */
  type: "bills" | "income"
  /** Optional divisor (e.g., split house bills by 2) */
  splitBy?: number
}

export interface MonthData {
  /** Format: "YYYY-MM" */
  monthKey: string
  categories: Category[]
  budgets?: Budget[]
  investments?: Investment[]
  goals?: FinancialGoal[]
  subscriptions?: Subscription[]
}

export interface Budget {
  id: string
  categoryId?: string
  categoryName: string
  limit: number
  spent: number
  monthKey: string
}

export interface Investment {
  id: string
  name: string
  type: "stocks" | "funds" | "crypto" | "savings" | "real-estate" | "other"
  amount: number
  purchaseDate: string
  currentValue?: number
  notes?: string
}

export interface FinancialGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline?: string
  category: "emergency" | "purchase" | "vacation" | "education" | "retirement" | "other"
  icon?: string
}

export interface Subscription {
  id: string
  name: string
  amount: number
  billingCycle: "monthly" | "quarterly" | "yearly"
  nextBillingDate: string
  category?: string
  active: boolean
  notes?: string
}

export function createId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number)
  const date = new Date(year, month - 1)
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
}

export function getCurrentMonthKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export function getDefaultData(): MonthData {
  const monthKey = getCurrentMonthKey()
  return {
    monthKey,
    categories: [
      {
        id: createId(),
        name: "Saldos em Conta",
        type: "income",
        bills: [
          { id: createId(), name: "Salario", amount: 5000, paid: false, categoryId: "" },
        ],
      },
      {
        id: createId(),
        name: "Contas Casa",
        type: "bills",
        splitBy: 2,
        bills: [
          { id: createId(), name: "Agua", amount: 85.76, paid: true, categoryId: "" },
          { id: createId(), name: "Luz", amount: 510.71, paid: true, categoryId: "" },
          { id: createId(), name: "Financiamento Total", amount: 1860.88, paid: true, categoryId: "" },
          { id: createId(), name: "Internet", amount: 139.9, paid: true, categoryId: "", note: "Pago com o meu flash" },
          { id: createId(), name: "Coleta Lixo", amount: 27.32, paid: true, categoryId: "" },
          { id: createId(), name: "IPTU", amount: 64.48, paid: true, categoryId: "" },
        ],
      },
      {
        id: createId(),
        name: "Minhas Contas",
        type: "bills",
        bills: [
          { id: createId(), name: "Bradesco (Cartao de credito)", amount: 587.38, paid: true, categoryId: "" },
          { id: createId(), name: "Caixa (Cartao de credito)", amount: 53.29, paid: true, categoryId: "" },
          { id: createId(), name: "MEI", amount: 80.9, paid: true, categoryId: "" },
          { id: createId(), name: "Cartao MEI", amount: 6.0, paid: true, categoryId: "" },
          { id: createId(), name: "Univille", amount: 402.0, paid: true, categoryId: "" },
        ],
      },
    ],
  }
}
