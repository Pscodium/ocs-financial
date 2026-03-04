"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import {
  getDefaultTabFeatureAccess,
  getUserPlanIdentifier,
  resolveTabFeatureAccessFromFeatureMap,
  type TabFeatureAccess,
} from "@/lib/feature-flags"
import { queryKeys } from "@/lib/query-keys"

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
  const { user, isAuthenticated, isInitializing: isAuthInitializing } = useAuth()
  const planIdentifier = getUserPlanIdentifier(user)
  const planKey = getPlanKey(planIdentifier)

  const featureAccessQuery = useQuery({
    queryKey: queryKeys.featureAccess(planKey),
    enabled: !isAuthInitializing,
    queryFn: async () => {
      if (!isAuthenticated) {
        return getDefaultTabFeatureAccess()
      }

      return fetchFeatureAccess(planIdentifier)
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    featureAccess: featureAccessQuery.data ?? getDefaultTabFeatureAccess(),
    isLoading: isAuthInitializing || featureAccessQuery.isPending,
  }
}
