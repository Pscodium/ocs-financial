"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Bill, Category, MonthData } from "@/lib/types"
import { createId, getCurrentMonthKey } from "@/lib/types"
import { api, ApiError, NetworkError } from "@/lib/api"

async function saveToApi(months: MonthData[], serverMonthKeys?: Set<string>, modifiedMonthKey?: string): Promise<void> {
  if (!modifiedMonthKey) {
    return
  }

  const modifiedMonth = months.find((m) => m.monthKey === modifiedMonthKey)
  if (!modifiedMonth) {
    return
  }

  const hasServerMonth = serverMonthKeys?.has(modifiedMonth.monthKey)

  try {
    if (hasServerMonth) {
      await api.updateMonth(modifiedMonth.monthKey, modifiedMonth)
    } else {
      await api.createMonth(modifiedMonth)
      serverMonthKeys?.add(modifiedMonth.monthKey)
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      await api.createMonth(modifiedMonth)
      serverMonthKeys?.add(modifiedMonth.monthKey)
      return
    }

    if (error instanceof ApiError && error.status === 409) {
      await api.updateMonth(modifiedMonth.monthKey, modifiedMonth)
      serverMonthKeys?.add(modifiedMonth.monthKey)
      return
    }

    throw error
  }
}

export function useFinance() {
  const [allMonths, setAllMonths] = useState<MonthData[]>([])
  const [currentMonthKey, setCurrentMonthKey] = useState(getCurrentMonthKey())
  const [loaded, setLoaded] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestSaveRef = useRef<MonthData[] | null>(null)
  const modifiedMonthKeyRef = useRef<string | null>(null)
  const serverMonthKeysRef = useRef<Set<string>>(new Set())

  const scheduleSave = useCallback((months: MonthData[], modifiedMonthKey?: string) => {
    latestSaveRef.current = months
    modifiedMonthKeyRef.current = modifiedMonthKey || null
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(async () => {
      if (!latestSaveRef.current) return

      try {
        await saveToApi(latestSaveRef.current, serverMonthKeysRef.current, modifiedMonthKeyRef.current || undefined)
      } catch (error) {
        if (error instanceof NetworkError) return
        console.error("Erro ao salvar mês:", error)
      }
    }, 500)
  }, [])

  useEffect(() => {
    async function loadData() {
      setIsSyncing(true)

      try {
        const apiMonths = await api.getMonths()

        const validMonths = apiMonths.filter((m) => m && m.monthKey)
        serverMonthKeysRef.current = new Set(validMonths.map((m) => m.monthKey))

        if (validMonths.length === 0) {
          setAllMonths([])
        } else {
          setAllMonths(validMonths)
        }
        setHasPendingChanges(false)
      } catch {
        setAllMonths([])
        setHasPendingChanges(false)
      } finally {
        setIsSyncing(false)
        setLoaded(true)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  const currentMonth = allMonths.find((m) => m.monthKey === currentMonthKey)

  const persist = useCallback((updated: MonthData[], modifiedMonthKey?: string) => {
    setAllMonths(updated)
    scheduleSave(updated, modifiedMonthKey)
  }, [scheduleSave])

  const applyLocalUpdate = useCallback((updated: MonthData[]) => {
    setAllMonths(updated)
  }, [])

  const syncOfflineChanges = useCallback(async () => {
    setHasPendingChanges(false)
  }, [])

  const discardOfflineChanges = useCallback(async () => {
    setHasPendingChanges(false)
  }, [])

  const ensureMonth = useCallback(
    (monthKey: string): MonthData[] => {
      const existing = allMonths.find((m) => m.monthKey === monthKey)
      if (existing) return allMonths
      const newMonth: MonthData = { monthKey, categories: [] }
      return [...allMonths, newMonth]
    },
    [allMonths],
  )

  // Category operations
  const addCategory = useCallback(
    (name: string, type: "bills" | "income", splitBy?: number) => {
      const months = ensureMonth(currentMonthKey)
      const updated = months.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          categories: [...m.categories, { id: createId(), name, type, bills: [], splitBy }],
        }
      })
      persist(updated, currentMonthKey)
    },
    [currentMonthKey, ensureMonth, persist],
  )

  const updateCategory = useCallback(
    (categoryId: string, name: string, splitBy?: number) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          categories: m.categories.map((c) => (c.id === categoryId ? { ...c, name, splitBy } : c)),
        }
      })
      persist(updated, currentMonthKey)
    },
    [allMonths, currentMonthKey, persist],
  )

  const removeCategory = useCallback(
    (categoryId: string) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          categories: m.categories.filter((c) => c.id !== categoryId),
        }
      })
      persist(updated, currentMonthKey)
    },
    [allMonths, currentMonthKey, persist],
  )

  // Bill / entry operations
  const addBill = useCallback(
    (categoryId: string, bill: Omit<Bill, "id" | "categoryId">) => {
      const months = ensureMonth(currentMonthKey)
      const updated = months.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          categories: m.categories.map((c) => {
            if (c.id !== categoryId) return c
            return {
              ...c,
              bills: [...c.bills, { ...bill, id: createId(), categoryId }],
            }
          }),
        }
      })
      persist(updated, currentMonthKey)
    },
    [currentMonthKey, ensureMonth, persist],
  )

  const updateBill = useCallback(
    (categoryId: string, billId: string, updates: Partial<Omit<Bill, "id" | "categoryId">>) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          categories: m.categories.map((c) => {
            if (c.id !== categoryId) return c
            return {
              ...c,
              bills: c.bills.map((b) => (b.id === billId ? { ...b, ...updates } : b)),
            }
          }),
        }
      })
      persist(updated, currentMonthKey)
    },
    [allMonths, currentMonthKey, persist],
  )

  const removeBill = useCallback(
    (categoryId: string, billId: string) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          categories: m.categories.map((c) => {
            if (c.id !== categoryId) return c
            return {
              ...c,
              bills: c.bills.filter((b) => b.id !== billId),
            }
          }),
        }
      })
      persist(updated, currentMonthKey)
    },
    [allMonths, currentMonthKey, persist],
  )

  const toggleBillPaid = useCallback(
    (categoryId: string, billId: string) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          categories: m.categories.map((c) => {
            if (c.id !== categoryId) return c
            return {
              ...c,
              bills: c.bills.map((b) => (b.id === billId ? { ...b, paid: !b.paid } : b)),
            }
          }),
        }
      })
      persist(updated, currentMonthKey)
    },
    [allMonths, currentMonthKey, persist],
  )

  const duplicateMonthTo = useCallback(
    (targetMonthKey: string) => {
      if (!currentMonth) return
      const existing = allMonths.find((m) => m.monthKey === targetMonthKey)
      if (existing) return

      const newMonth: MonthData = {
        monthKey: targetMonthKey,
        categories: currentMonth.categories.map((c) => ({
          ...c,
          id: createId(),
          bills: c.bills.map((b) => ({
            ...b,
            id: createId(),
            paid: false,
            amount: b.amount,
          })),
        })),
      }
      const updated = [...allMonths, newMonth]
      persist(updated, targetMonthKey)
      setCurrentMonthKey(targetMonthKey)
    },
    [allMonths, currentMonth, persist],
  )

  const getNextAvailableMonthKey = useCallback((removedMonthKey: string, remaining: MonthData[]) => {
    if (remaining.length === 0) {
      return getCurrentMonthKey()
    }

    const sortedKeys = remaining.map((m) => m.monthKey).sort()
    const currentIndex = sortedKeys.indexOf(removedMonthKey)

    if (currentIndex > 0) {
      return sortedKeys[currentIndex - 1]
    }

    if (currentIndex === -1) {
      return sortedKeys[sortedKeys.length - 1]
    }

    return sortedKeys[0]
  }, [])

  const deleteMonth = useCallback(async (monthKey: string): Promise<boolean> => {
    if (!monthKey) {
      return false
    }

    const existing = allMonths.find((m) => m.monthKey === monthKey)
    if (!existing) {
      return false
    }

    try {
      await api.deleteMonth(monthKey)

      const remaining = allMonths.filter((m) => m.monthKey !== monthKey)
      const nextKey = monthKey === currentMonthKey
        ? getNextAvailableMonthKey(monthKey, remaining)
        : currentMonthKey

      serverMonthKeysRef.current.delete(monthKey)
      applyLocalUpdate(remaining)
      setCurrentMonthKey(nextKey)

      return true
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        console.error("Rate limit ao deletar mes:", error)
        return false
      }
      if (error instanceof NetworkError) throw error
      throw error
    }
  }, [allMonths, applyLocalUpdate, currentMonthKey, getNextAvailableMonthKey])

  // Computed values
  const getBillCategories = useCallback((): Category[] => {
    if (!currentMonth) return []
    return currentMonth.categories.filter((c) => c.type === "bills" || !c.type)
  }, [currentMonth])

  const getIncomeCategories = useCallback((): Category[] => {
    if (!currentMonth) return []
    return currentMonth.categories.filter((c) => c.type === "income")
  }, [currentMonth])

  const getTotalByCategory = useCallback((category: Category) => {
    return category.bills.reduce((sum, b) => sum + b.amount, 0)
  }, [])

  const getPaidByCategory = useCallback((category: Category) => {
    return category.bills.filter((b) => b.paid).reduce((sum, b) => sum + b.amount, 0)
  }, [])

  const getGrandTotal = useCallback(() => {
    if (!currentMonth) return 0
    return getBillCategories().reduce((sum, c) => sum + getTotalByCategory(c), 0)
  }, [currentMonth, getBillCategories, getTotalByCategory])

  const getGrandPaid = useCallback(() => {
    if (!currentMonth) return 0
    return getBillCategories().reduce((sum, c) => sum + getPaidByCategory(c), 0)
  }, [currentMonth, getBillCategories, getPaidByCategory])

  const getIncomeTotal = useCallback(() => {
    if (!currentMonth) return 0
    return getIncomeCategories().reduce((sum, c) => sum + getTotalByCategory(c), 0)
  }, [currentMonth, getIncomeCategories, getTotalByCategory])

  /** Minha parte real: para categorias com splitBy, divide o total; senão usa total cheio */
  const getMyShare = useCallback(() => {
    if (!currentMonth) return 0
    return getBillCategories().reduce((sum, c) => {
      const catTotal = getTotalByCategory(c)
      return sum + (c.splitBy && c.splitBy > 1 ? catTotal / c.splitBy : catTotal)
    }, 0)
  }, [currentMonth, getBillCategories, getTotalByCategory])

  /** Sobra = saldo - minha parte (não o montante total) */
  const getSobra = useCallback(() => {
    return getIncomeTotal() - getMyShare()
  }, [getIncomeTotal, getMyShare])

  // Budget operations
  const addBudget = useCallback(
    async (budget: import("@/lib/types").Budget) => {
      const months = ensureMonth(currentMonthKey)
      const updated = months.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          budgets: [...(m.budgets || []), budget],
        }
      })
      
      // Call specific API endpoint
      try {
        await api.createBudget(currentMonthKey, budget)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao criar budget:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to create budget:', error)
      }
    },
    [applyLocalUpdate, currentMonthKey, ensureMonth],
  )

  const updateBudget = useCallback(
    async (budget: import("@/lib/types").Budget) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          budgets: (m.budgets || []).map((b) => (b.id === budget.id ? budget : b)),
        }
      })
      
      // Call specific API endpoint
      try {
        await api.updateBudget(currentMonthKey, budget.id, budget)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao atualizar budget:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to update budget:', error)
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
  )

  const removeBudget = useCallback(
    async (budgetId: string) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          budgets: (m.budgets || []).filter((b) => b.id !== budgetId),
        }
      })
      
      // Call specific API endpoint
      try {
        await api.deleteBudget(currentMonthKey, budgetId)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao remover budget:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to delete budget:', error)
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
  )

  // Investment operations
  const addInvestment = useCallback(
    async (investment: import("@/lib/types").Investment) => {
      const months = ensureMonth(currentMonthKey)
      const updated = months.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          investments: [...(m.investments || []), investment],
        }
      })
      
      // Call specific API endpoint
      try {
        await api.createInvestment(currentMonthKey, investment)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao criar investimento:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to create investment:', error)
      }
    },
    [applyLocalUpdate, currentMonthKey, ensureMonth],
  )

  const updateInvestment = useCallback(
    async (investment: import("@/lib/types").Investment) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          investments: (m.investments || []).map((i) => (i.id === investment.id ? investment : i)),
        }
      })
      
      // Call specific API endpoint
      try {
        await api.updateInvestment(currentMonthKey, investment.id, investment)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao atualizar investimento:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to update investment:', error)
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
  )

  const removeInvestment = useCallback(
    async (investmentId: string) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          investments: (m.investments || []).filter((i) => i.id !== investmentId),
        }
      })
      
      // Call specific API endpoint
      try {
        await api.deleteInvestment(currentMonthKey, investmentId)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao remover investimento:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to delete investment:', error)
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
  )

  // Goal operations
  const addGoal = useCallback(
    async (goal: import("@/lib/types").FinancialGoal) => {
      const months = ensureMonth(currentMonthKey)
      const updated = months.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          goals: [...(m.goals || []), goal],
        }
      })
      
      // Call specific API endpoint
      try {
        await api.createGoal(currentMonthKey, goal)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao criar meta:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to create goal:', error)
      }
    },
    [applyLocalUpdate, currentMonthKey, ensureMonth],
  )

  const updateGoal = useCallback(
    async (goal: import("@/lib/types").FinancialGoal) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          goals: (m.goals || []).map((g) => (g.id === goal.id ? goal : g)),
        }
      })
      
      // Call specific API endpoint
      try {
        await api.updateGoal(currentMonthKey, goal.id, goal)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao atualizar meta:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to update goal:', error)
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
  )

  const removeGoal = useCallback(
    async (goalId: string) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          goals: (m.goals || []).filter((g) => g.id !== goalId),
        }
      })
      
      // Call specific API endpoint
      try {
        await api.deleteGoal(currentMonthKey, goalId)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao remover meta:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to delete goal:', error)
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
  )

  // Subscription operations
  const addSubscription = useCallback(
    async (subscription: import("@/lib/types").Subscription) => {
      const months = ensureMonth(currentMonthKey)
      const updated = months.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          subscriptions: [...(m.subscriptions || []), subscription],
        }
      })
      
      // Call specific API endpoint
      try {
        await api.createSubscription(currentMonthKey, subscription)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao criar assinatura:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to create subscription:', error)
      }
    },
    [applyLocalUpdate, currentMonthKey, ensureMonth],
  )

  const updateSubscription = useCallback(
    async (subscription: import("@/lib/types").Subscription) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          subscriptions: (m.subscriptions || []).map((s) => (s.id === subscription.id ? subscription : s)),
        }
      })
      
      // Call specific API endpoint
      try {
        await api.updateSubscription(currentMonthKey, subscription.id, subscription)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao atualizar assinatura:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to update subscription:', error)
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
  )

  const removeSubscription = useCallback(
    async (subscriptionId: string) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          subscriptions: (m.subscriptions || []).filter((s) => s.id !== subscriptionId),
        }
      })
      
      // Call specific API endpoint
      try {
        await api.deleteSubscription(currentMonthKey, subscriptionId)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao remover assinatura:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to delete subscription:', error)
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
  )

  return {
    loaded,
    allMonths,
    currentMonthKey,
    setCurrentMonthKey,
    currentMonth,
    isSyncing,
    hasPendingChanges: false,
    syncOfflineChanges,
    discardOfflineChanges,
    addCategory,
    updateCategory,
    removeCategory,
    addBill,
    updateBill,
    removeBill,
    toggleBillPaid,
    duplicateMonthTo,
    deleteMonth,
    getBillCategories,
    getIncomeCategories,
    getTotalByCategory,
    getPaidByCategory,
    getGrandTotal,
    getGrandPaid,
    getIncomeTotal,
    getMyShare,
    getSobra,
    // New features
    addBudget,
    updateBudget,
    removeBudget,
    addInvestment,
    updateInvestment,
    removeInvestment,
    addGoal,
    updateGoal,
    removeGoal,
    addSubscription,
    updateSubscription,
    removeSubscription,
  }
}
