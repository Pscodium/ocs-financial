"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Bill, Category, MonthData } from "@/lib/types"
import { createId, getCurrentMonthKey, getDefaultData } from "@/lib/types"
import { api, ApiError, NetworkError } from "@/lib/api"

const STORAGE_KEY = "gestor-financeiro-data"
const API_STATUS_KEY = "api-status"

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
async function saveToApi(months: MonthData[], serverMonthKeys?: Set<string>): Promise<void> {
  try {
    const isOnline = await checkApiStatus()
    
    if (isOnline) {
      // Save each month to API
      for (const month of months) {
        const hasServerMonth = serverMonthKeys?.has(month.monthKey)

        try {
          if (hasServerMonth) {
            await api.updateMonth(month.monthKey, month)
          } else {
            await api.createMonth(month)
            serverMonthKeys?.add(month.monthKey)
          }
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            await api.createMonth(month)
            serverMonthKeys?.add(month.monthKey)
          } else if (error instanceof ApiError && error.status === 409) {
            await api.updateMonth(month.monthKey, month)
            serverMonthKeys?.add(month.monthKey)
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestSaveRef = useRef<MonthData[] | null>(null)
  const serverMonthKeysRef = useRef<Set<string>>(new Set())

  const scheduleSave = useCallback((months: MonthData[]) => {
    latestSaveRef.current = months
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(async () => {
      if (!latestSaveRef.current) return
      await saveToApi(latestSaveRef.current, serverMonthKeysRef.current)
    }, 500)
  }, [])

  useEffect(() => {
    async function loadData() {
      const localData = loadAllMonths()
      
      if (localData.length === 0) {
        const defaultData = getDefaultData()
        setAllMonths([defaultData])
        await saveToApi([defaultData], serverMonthKeysRef.current)
      } else {
        setAllMonths(localData)
        
        // Try to sync with API in background
        setIsSyncing(true)
        try {
          const syncedData = await syncWithApi(localData)
          setAllMonths(syncedData)
          setIsApiOnline(true)
          serverMonthKeysRef.current = new Set(syncedData.map((m) => m.monthKey))
        } catch {
          setIsApiOnline(false)
        } finally {
          setIsSyncing(false)
        }
      }
      
      setLoaded(true)
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

  const persist = useCallback((updated: MonthData[]) => {
    setAllMonths(updated)
    saveAllMonths(updated)
    scheduleSave(updated)
  }, [scheduleSave])

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
      persist(updated)
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
      persist(updated)
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
      persist(updated)
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
      persist(updated)
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
      persist(updated)
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
      persist(updated)
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
      persist(updated)
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
      persist(updated)
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

  return {
    loaded,
    allMonths,
    currentMonthKey,
    setCurrentMonthKey,
    currentMonth,
    isApiOnline,
    isSyncing,
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
  }
}
