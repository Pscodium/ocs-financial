"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import {
  getDefaultTabFeatureAccess,
  getUserPlanIdentifier,
  resolveTabFeatureAccessFromFeatureMap,
  type TabFeatureAccess,
} from "@/lib/feature-flags"

interface UsePlanFeaturesResult {
  featureAccess: TabFeatureAccess
  isLoading: boolean
}

interface FeatureAccessResponse {
  access?: TabFeatureAccess
}

const inFlightAccessRequests = new Map<string, Promise<TabFeatureAccess>>()
const accessCache = new Map<string, TabFeatureAccess>()

function getPlanKey(planIdentifier: string | null): string {
  return planIdentifier && planIdentifier.trim().length > 0 ? planIdentifier.trim() : "__no_plan__"
}

async function fetchFeatureAccess(planIdentifier: string | null): Promise<TabFeatureAccess> {
  const planKey = getPlanKey(planIdentifier)

  const cached = accessCache.get(planKey)
  if (cached) {
    return cached
  }

  const inFlightRequest = inFlightAccessRequests.get(planKey)
  if (inFlightRequest) {
    return inFlightRequest
  }

  const requestPromise = (async () => {
    let nextAccess = resolveTabFeatureAccessFromFeatureMap(null)

    try {
      const response = await fetch("/api/feature-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: planIdentifier }),
      })

      if (response.ok) {
        const data = (await response.json()) as FeatureAccessResponse
        if (data.access) {
          nextAccess = data.access
        }
      }
    } catch {
      nextAccess = resolveTabFeatureAccessFromFeatureMap(null)
    } finally {
      inFlightAccessRequests.delete(planKey)
    }

    accessCache.set(planKey, nextAccess)
    return nextAccess
  })()

  inFlightAccessRequests.set(planKey, requestPromise)
  return requestPromise
}

export function usePlanFeatures(): UsePlanFeaturesResult {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const planIdentifier = getUserPlanIdentifier(user)
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

      const nextAccess = await fetchFeatureAccess(planIdentifier)

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
  }, [planIdentifier, isAuthenticated, isAuthLoading])

  return {
    featureAccess,
    isLoading,
  }
}
