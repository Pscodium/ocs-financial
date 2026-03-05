"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import {
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

function getPlanKey(planIdentifier: string | null): string {
  return planIdentifier && planIdentifier.trim().length > 0 ? planIdentifier.trim() : "__no_plan__"
}

async function fetchFeatureAccess(planIdentifier: string | null): Promise<TabFeatureAccess> {
  let nextAccess = resolveTabFeatureAccessFromFeatureMap(null)

  try {
    const response = await fetch("/api/feature-access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan: planIdentifier }),
      cache: "no-store",
    })

    if (response.ok) {
      const data = (await response.json()) as FeatureAccessResponse
      if (data.access) {
        nextAccess = data.access
      }
    }
  } catch {
    nextAccess = resolveTabFeatureAccessFromFeatureMap(null)
  }

  return nextAccess
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
        return resolveTabFeatureAccessFromFeatureMap(null)
      }

      return fetchFeatureAccess(planIdentifier)
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })

  return {
    featureAccess: featureAccessQuery.data ?? resolveTabFeatureAccessFromFeatureMap(null),
    isLoading: isAuthInitializing || featureAccessQuery.isPending,
  }
}
