"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Bill, Category, MonthData } from "@/lib/types"
import { createId, getCurrentMonthKey, getDefaultData } from "@/lib/types"
import { api, ApiError, NetworkError } from "@/lib/api"

const STORAGE_KEY = "gestor-financeiro-data"
const API_STATUS_KEY = "api-status"
const PENDING_CHANGES_KEY = "pending-offline-changes"

// Check if API is online
async function checkApiStatus(): Promise<boolean> {
  try {
    const isOnline = await api.ping()
    localStorage.setItem(API_STATUS_KEY, isOnline ? "online" : "offline")
    return isOnline
  } catch {
    localStorage.setItem(API_STATUS_KEY, "offline")
    return false
  }
}

function loadAllMonths(): MonthData[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as MonthData[]
  } catch {
    return []
  }
}

function saveAllMonths(months: MonthData[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(months))
}

function hasPendingOfflineChanges(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(PENDING_CHANGES_KEY) === "true"
}

function setPendingOfflineChanges(pending: boolean) {
  if (typeof window === "undefined") return
  if (pending) {
    localStorage.setItem(PENDING_CHANGES_KEY, "true")
  } else {
    localStorage.removeItem(PENDING_CHANGES_KEY)
  }
}

// Sync with API
async function syncWithApi(months: MonthData[]): Promise<MonthData[]> {
  try {
    const isOnline = await checkApiStatus()
    if (!isOnline) {
      return months // Return local data if offline
    }

    // Fetch from API
    const apiMonths = await api.getMonths()
    
    // Save to localStorage as cache
    saveAllMonths(apiMonths)
    
    return apiMonths
  } catch (error) {
    if (error instanceof NetworkError) {
      // API offline - use local data
      return months
    }
    throw error
  }
}

// Save to both API and localStorage
async function saveToApi(months: MonthData[], serverMonthKeys?: Set<string>, modifiedMonthKey?: string): Promise<void> {
  try {
    const isOnline = await checkApiStatus()
    
    if (isOnline && modifiedMonthKey) {
      // Save only the modified month to API
      const modifiedMonth = months.find((m) => m.monthKey === modifiedMonthKey)
      if (modifiedMonth) {
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
          } else if (error instanceof ApiError && error.status === 409) {
            await api.updateMonth(modifiedMonth.monthKey, modifiedMonth)
            serverMonthKeys?.add(modifiedMonth.monthKey)
          } else {
            throw error
          }
        }
      }
    }
    
    // Always save to localStorage as cache/fallback
    saveAllMonths(months)
  } catch (error) {
    if (error instanceof NetworkError) {
      // API offline - save only to localStorage
      saveAllMonths(months)
    } else {
      throw error
    }
  }
}

export function useFinance() {
  const [allMonths, setAllMonths] = useState<MonthData[]>([])
  const [currentMonthKey, setCurrentMonthKey] = useState(getCurrentMonthKey())
  const [loaded, setLoaded] = useState(false)
  const [isApiOnline, setIsApiOnline] = useState(false)
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
      
      const isOnline = await checkApiStatus()
      if (!isOnline) {
        // Offline - mark as having pending changes
        setPendingOfflineChanges(true)
        setHasPendingChanges(true)
        saveAllMonths(latestSaveRef.current)
      } else {
        // Online - save normally and clear any pending changes flag
        await saveToApi(latestSaveRef.current, serverMonthKeysRef.current, modifiedMonthKeyRef.current || undefined)
        
        // Clear pending changes since we're now saving online
        setPendingOfflineChanges(false)
        setHasPendingChanges(false)
      }
    }, 500)
  }, [])

  useEffect(() => {
    async function loadData() {
      setIsSyncing(true)
      
      // Check if there are pending offline changes FIRST
      const pending = hasPendingOfflineChanges()
      
      try {
        // Try to fetch from API first
        const apiMonths = await api.getMonths()
        setIsApiOnline(true)
        
        // Filter out any invalid data
        const validMonths = apiMonths.filter((m) => m && m.monthKey)
        serverMonthKeysRef.current = new Set(validMonths.map((m) => m.monthKey))
        
        if (pending) {
          // There are offline changes - DON'T overwrite localStorage
          // Load from localStorage and show sync options
          const localData = loadAllMonths()
          const validLocalData = localData.filter((m) => m && m.monthKey)
          setAllMonths(validLocalData)
          setHasPendingChanges(true)
        } else {
          // No offline changes - safe to use server data
          saveAllMonths(validMonths)
          setAllMonths(validMonths)
          setHasPendingChanges(false)
        }
      } catch {
        // API offline - use localStorage as fallback
        setIsApiOnline(false)
        const localData = loadAllMonths()
        
        if (localData.length === 0) {
          // No data at all - create default
          const defaultData = getDefaultData()
          setAllMonths([defaultData])
          saveAllMonths([defaultData])
        } else {
          // Filter out any invalid cached data
          const validLocalData = localData.filter((m) => m && m.monthKey)
          
          // Use cached data from localStorage
          setAllMonths(validLocalData)
          serverMonthKeysRef.current = new Set(validLocalData.map((m) => m.monthKey))
        }
        
        if (pending) {
          setHasPendingChanges(true)
        }
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

  const syncOfflineChanges = useCallback(async () => {
    if (!hasPendingChanges) return
    
    setIsSyncing(true)
    try {
      const localData = loadAllMonths()
      
      // Send all months to API (offline overwrites online)
      for (const month of localData) {
        const hasServerMonth = serverMonthKeysRef.current.has(month.monthKey)
        
        try {
          if (hasServerMonth) {
            await api.updateMonth(month.monthKey, month)
          } else {
            await api.createMonth(month)
            serverMonthKeysRef.current.add(month.monthKey)
          }
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            await api.createMonth(month)
            serverMonthKeysRef.current.add(month.monthKey)
          } else if (error instanceof ApiError && error.status === 409) {
            await api.updateMonth(month.monthKey, month)
          } else {
            throw error
          }
        }
      }
      
      // Clear pending changes flag
      setPendingOfflineChanges(false)
      setHasPendingChanges(false)
      setIsApiOnline(true)
    } catch (error) {
      console.error("Failed to sync offline changes:", error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [hasPendingChanges])

  const discardOfflineChanges = useCallback(async () => {
    if (!hasPendingChanges) return
    
    setIsSyncing(true)
    try {
      // Fetch fresh data from server
      const apiMonths = await api.getMonths()
      const validMonths = apiMonths.filter((m) => m && m.monthKey)
      
      // Overwrite localStorage with server data
      saveAllMonths(validMonths)
      setAllMonths(validMonths)
      serverMonthKeysRef.current = new Set(validMonths.map((m) => m.monthKey))
      
      // Clear pending changes flag
      setPendingOfflineChanges(false)
      setHasPendingChanges(false)
      setIsApiOnline(true)
    } catch (error) {
      console.error("Failed to discard offline changes:", error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [hasPendingChanges])

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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.createBudget(currentMonthKey, budget)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to create budget:', error)
      }
    },
    [currentMonthKey, ensureMonth],
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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.updateBudget(currentMonthKey, budget.id, budget)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to update budget:', error)
      }
    },
    [allMonths, currentMonthKey],
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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.deleteBudget(currentMonthKey, budgetId)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to delete budget:', error)
      }
    },
    [allMonths, currentMonthKey],
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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.createInvestment(currentMonthKey, investment)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to create investment:', error)
      }
    },
    [currentMonthKey, ensureMonth],
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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.updateInvestment(currentMonthKey, investment.id, investment)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to update investment:', error)
      }
    },
    [allMonths, currentMonthKey],
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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.deleteInvestment(currentMonthKey, investmentId)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to delete investment:', error)
      }
    },
    [allMonths, currentMonthKey],
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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.createGoal(currentMonthKey, goal)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to create goal:', error)
      }
    },
    [currentMonthKey, ensureMonth],
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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.updateGoal(currentMonthKey, goal.id, goal)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to update goal:', error)
      }
    },
    [allMonths, currentMonthKey],
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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.deleteGoal(currentMonthKey, goalId)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to delete goal:', error)
      }
    },
    [allMonths, currentMonthKey],
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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.createSubscription(currentMonthKey, subscription)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to create subscription:', error)
      }
    },
    [currentMonthKey, ensureMonth],
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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.updateSubscription(currentMonthKey, subscription.id, subscription)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to update subscription:', error)
      }
    },
    [allMonths, currentMonthKey],
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
      
      // Update UI immediately
      setAllMonths(updated)
      saveAllMonths(updated)
      
      // Call specific API endpoint
      try {
        const isOnline = await checkApiStatus()
        if (isOnline) {
          await api.deleteSubscription(currentMonthKey, subscriptionId)
          setIsApiOnline(true)
        }
      } catch (error) {
        if (error instanceof NetworkError) {
          setPendingOfflineChanges(true)
          setHasPendingChanges(true)
        }
        console.error('Failed to delete subscription:', error)
      }
    },
    [allMonths, currentMonthKey],
  )

  return {
    loaded,
    allMonths,
    currentMonthKey,
    setCurrentMonthKey,
    currentMonth,
    isApiOnline,
    isSyncing,
    hasPendingChanges,
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
