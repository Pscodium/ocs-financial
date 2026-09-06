"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { Bill, Category, MonthData } from "@/lib/types"
import { createId, getCurrentMonthKey } from "@/lib/types"
import { api, ApiError, NetworkError } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

function sortCategoriesByOrder(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER
    return orderA - orderB
  })
}

function sortBillsByOrder(bills: Bill[]): Bill[] {
  return [...bills].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER
    return orderA - orderB
  })
}

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
  const queryClient = useQueryClient()
  const [currentMonthKey, setCurrentMonthKey] = useState(getCurrentMonthKey())
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestSaveRef = useRef<MonthData[] | null>(null)
  const modifiedMonthKeyRef = useRef<string | null>(null)
  const serverMonthKeysRef = useRef<Set<string>>(new Set())

  const monthsQuery = useQuery({
    queryKey: queryKeys.financeMonths,
    queryFn: async () => {
      const months = await api.getMonths()
      const validMonths = months.filter((month) => month && month.monthKey)
      serverMonthKeysRef.current = new Set(validMonths.map((month) => month.monthKey))
      setHasPendingChanges(false)
      return months
    },
    staleTime: 30_000,
  })

  const allMonths = monthsQuery.data ?? []

  const setMonthsInCache = useCallback(
    (months: MonthData[]) => {
      queryClient.setQueryData(queryKeys.financeMonths, months)
    },
    [queryClient],
  )

  const scheduleSave = useCallback((months: MonthData[], modifiedMonthKey?: string) => {
    latestSaveRef.current = months
    modifiedMonthKeyRef.current = modifiedMonthKey || null
    setHasPendingChanges(true)

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(async () => {
      if (!latestSaveRef.current) return

      try {
        await saveToApi(latestSaveRef.current, serverMonthKeysRef.current, modifiedMonthKeyRef.current || undefined)
        setHasPendingChanges(false)
      } catch (error) {
        if (error instanceof NetworkError) return
        console.error("Erro ao salvar mês:", error)
      }
    }, 500)
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
    setMonthsInCache(updated)
    scheduleSave(updated, modifiedMonthKey)
  }, [scheduleSave, setMonthsInCache])

  const applyLocalUpdate = useCallback((updated: MonthData[]) => {
    setMonthsInCache(updated)
  }, [setMonthsInCache])

  const syncOfflineChanges = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    if (!latestSaveRef.current || !modifiedMonthKeyRef.current) {
      setHasPendingChanges(false)
      return
    }

    try {
      await saveToApi(latestSaveRef.current, serverMonthKeysRef.current, modifiedMonthKeyRef.current)
      latestSaveRef.current = null
      modifiedMonthKeyRef.current = null
      setHasPendingChanges(false)
    } catch (error) {
      if (error instanceof NetworkError) {
        setHasPendingChanges(true)
        return
      }

      console.error("Erro ao sincronizar alterações pendentes:", error)
      setHasPendingChanges(true)
    }
  }, [])

  const discardOfflineChanges = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    latestSaveRef.current = null
    modifiedMonthKeyRef.current = null
    setHasPendingChanges(false)

    await queryClient.invalidateQueries({ queryKey: queryKeys.financeMonths })
  }, [queryClient])

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

  const reorderCategories = useCallback(
    async (orderedCategoryIds: string[]) => {
      const existingMonth = allMonths.find((m) => m.monthKey === currentMonthKey)
      if (!existingMonth || existingMonth.categories.length <= 1) {
        return
      }

      const originalCategories = existingMonth.categories
      const categoryById = new Map(originalCategories.map((category) => [category.id, category]))
      const uniqueValidIds = Array.from(new Set(orderedCategoryIds)).filter((id) => categoryById.has(id))

      if (uniqueValidIds.length !== originalCategories.length) {
        return
      }

      const reorderedCategories = uniqueValidIds.map((id, index) => {
        const category = categoryById.get(id)
        return {
          ...category!,
          sortOrder: index,
        }
      })

      const updated = allMonths.map((month) => {
        if (month.monthKey !== currentMonthKey) {
          return month
        }

        return {
          ...month,
          categories: reorderedCategories,
        }
      })

      applyLocalUpdate(updated)

      try {
        await api.reorderCategories(currentMonthKey, uniqueValidIds)
      } catch (error) {
        const rollback = allMonths.map((month) => {
          if (month.monthKey !== currentMonthKey) {
            return month
          }

          return {
            ...month,
            categories: originalCategories,
          }
        })
        applyLocalUpdate(rollback)
        throw error
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
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
            const lastSortOrder = c.bills.reduce((max, current) => {
              const value = current.sortOrder ?? -1
              return value > max ? value : max
            }, -1)
            return {
              ...c,
              bills: [...c.bills, { ...bill, id: createId(), categoryId, sortOrder: lastSortOrder + 1 }],
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

  const reorderBills = useCallback(
    async (categoryId: string, orderedBillIds: string[]) => {
      const existingMonth = allMonths.find((m) => m.monthKey === currentMonthKey)
      const existingCategory = existingMonth?.categories.find((category) => category.id === categoryId)

      if (!existingMonth || !existingCategory || existingCategory.bills.length <= 1) {
        return
      }

      const originalBills = existingCategory.bills
      const billById = new Map(originalBills.map((bill) => [bill.id, bill]))
      const uniqueValidIds = Array.from(new Set(orderedBillIds)).filter((id) => billById.has(id))

      if (uniqueValidIds.length !== originalBills.length) {
        return
      }

      const reorderedBills = uniqueValidIds.map((billId, index) => {
        const bill = billById.get(billId)
        return {
          ...bill!,
          sortOrder: index,
        }
      })

      const updated = allMonths.map((month) => {
        if (month.monthKey !== currentMonthKey) {
          return month
        }

        return {
          ...month,
          categories: month.categories.map((category) => {
            if (category.id !== categoryId) {
              return category
            }

            return {
              ...category,
              bills: reorderedBills,
            }
          }),
        }
      })

      applyLocalUpdate(updated)

      try {
        await api.reorderBills(currentMonthKey, categoryId, uniqueValidIds)
      } catch (error) {
        const rollback = allMonths.map((month) => {
          if (month.monthKey !== currentMonthKey) {
            return month
          }

          return {
            ...month,
            categories: month.categories.map((category) => {
              if (category.id !== categoryId) {
                return category
              }

              return {
                ...category,
                bills: originalBills,
              }
            }),
          }
        })
        applyLocalUpdate(rollback)
        throw error
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
  )

  const duplicateMonthTo = useCallback(
    (targetMonthKey: string, sourceMonthKey?: string, mergeIntoTarget = false): boolean => {
      const sourceMonth = sourceMonthKey
        ? allMonths.find((m) => m.monthKey === sourceMonthKey)
        : currentMonth

      if (!sourceMonth || sourceMonth.categories.length === 0) {
        return false
      }

      const copiedCategories = sourceMonth.categories.map((category) => {
        const newCategoryId = createId()
        return {
          ...category,
          id: newCategoryId,
          bills: category.bills.map((bill) => ({
            ...bill,
            id: createId(),
            categoryId: newCategoryId,
            paid: false,
          })),
        }
      })

      const existing = allMonths.find((m) => m.monthKey === targetMonthKey)

      if (existing) {
        if (!mergeIntoTarget) {
          return false
        }

        const updated = allMonths.map((m) => {
          if (m.monthKey !== targetMonthKey) return m
          return {
            ...m,
            categories: [...m.categories, ...copiedCategories],
          }
        })

        persist(updated, targetMonthKey)
        setCurrentMonthKey(targetMonthKey)
        return true
      }

      const newMonth: MonthData = {
        monthKey: targetMonthKey,
        categories: copiedCategories,
      }

      const updated = [...allMonths, newMonth]
      persist(updated, targetMonthKey)
      setCurrentMonthKey(targetMonthKey)
      return true
    },
    [allMonths, currentMonth, persist],
  )

  const copyFromMonthToCurrent = useCallback(
    (sourceMonthKey: string): boolean => {
      return duplicateMonthTo(currentMonthKey, sourceMonthKey, true)
    },
    [currentMonthKey, duplicateMonthTo],
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
    return sortCategoriesByOrder(currentMonth.categories.filter((c) => c.type === "bills" || !c.type))
  }, [currentMonth])

  const getIncomeCategories = useCallback((): Category[] => {
    if (!currentMonth) return []
    return sortCategoriesByOrder(currentMonth.categories.filter((c) => c.type === "income"))
  }, [currentMonth])

  const getTotalByCategory = useCallback((category: Category) => {
    return sortBillsByOrder(category.bills).reduce((sum, b) => sum + b.amount, 0)
  }, [])

  const getPaidByCategory = useCallback((category: Category) => {
    return sortBillsByOrder(category.bills).filter((b) => b.paid).reduce((sum, b) => sum + b.amount, 0)
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

  const getTransactionsTotal = useCallback(() => {
    if (!currentMonth) return 0
    return (currentMonth.transactions ?? []).reduce((sum, t) => sum + t.amount, 0)
  }, [currentMonth])

  const getTransactions = useCallback((): import("@/lib/types").Transaction[] => {
    if (!currentMonth) return []
    return [...(currentMonth.transactions ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  }, [currentMonth])

  /** Sobra = saldo - minha parte - gastos avulsos (não o montante total de contas) */
  const getSobra = useCallback(() => {
    return getIncomeTotal() - getMyShare() - getTransactionsTotal()
  }, [getIncomeTotal, getMyShare, getTransactionsTotal])

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

  // Transaction operations
  const addTransaction = useCallback(
    async (transaction: import("@/lib/types").Transaction) => {
      const months = ensureMonth(currentMonthKey)
      const updated = months.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          transactions: [...(m.transactions || []), transaction],
        }
      })

      try {
        await api.createTransaction(currentMonthKey, transaction)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao criar transação:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to create transaction:', error)
      }
    },
    [applyLocalUpdate, currentMonthKey, ensureMonth],
  )

  const updateTransaction = useCallback(
    async (transaction: import("@/lib/types").Transaction) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          transactions: (m.transactions || []).map((t) => (t.id === transaction.id ? transaction : t)),
        }
      })

      try {
        await api.updateTransaction(currentMonthKey, transaction.id, transaction)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao atualizar transação:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to update transaction:', error)
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
  )

  const removeTransaction = useCallback(
    async (transactionId: string) => {
      const updated = allMonths.map((m) => {
        if (m.monthKey !== currentMonthKey) return m
        return {
          ...m,
          transactions: (m.transactions || []).filter((t) => t.id !== transactionId),
        }
      })

      try {
        await api.deleteTransaction(currentMonthKey, transactionId)
        applyLocalUpdate(updated)
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          console.error("Rate limit ao remover transação:", error)
          return
        }
        if (error instanceof NetworkError) {
          return
        }
        console.error('Failed to delete transaction:', error)
      }
    },
    [allMonths, applyLocalUpdate, currentMonthKey],
  )

  return {
    loaded: !monthsQuery.isPending,
    allMonths,
    currentMonthKey,
    setCurrentMonthKey,
    currentMonth,
    isSyncing: monthsQuery.isFetching || hasPendingChanges,
    hasPendingChanges,
    syncOfflineChanges,
    discardOfflineChanges,
    addCategory,
    updateCategory,
    removeCategory,
    reorderCategories,
    addBill,
    updateBill,
    removeBill,
    toggleBillPaid,
    reorderBills,
    duplicateMonthTo,
    copyFromMonthToCurrent,
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
    getTransactions,
    getTransactionsTotal,
    addTransaction,
    updateTransaction,
    removeTransaction,
  }
}
