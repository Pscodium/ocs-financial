"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import {
  getDefaultTabFeatureAccess,
  getUserPlanIdentifier,
  resolveTabFeatureAccess,
  type TabFeatureAccess,
} from "@/lib/feature-flags"

interface UsePlanFeaturesResult {
  featureAccess: TabFeatureAccess
  isLoading: boolean
}

export function usePlanFeatures(): UsePlanFeaturesResult {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [featureAccess, setFeatureAccess] = useState<TabFeatureAccess>(getDefaultTabFeatureAccess)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    const loadFeatures = async () => {
      if (isAuthLoading) {
        return
      }

      if (!isAuthenticated) {
        if (!isCancelled) {
          setFeatureAccess(getDefaultTabFeatureAccess())
          setIsLoading(false)
        }
        return
      }

      const planIdentifier = getUserPlanIdentifier(user)
      const nextAccess = await resolveTabFeatureAccess(planIdentifier)

      if (!isCancelled) {
        setFeatureAccess(nextAccess)
        setIsLoading(false)
      }
    }

    setIsLoading(true)
    loadFeatures()

    return () => {
      isCancelled = true
    }
  }, [user, isAuthenticated, isAuthLoading])

  return {
    featureAccess,
    isLoading,
  }
}
