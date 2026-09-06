"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchWithSessionAuth } from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"
import {
  getUserPlanIdentifier,
  resolveTabFeatureAccessFromFeatureMap,
  resolveSectionFlagsFromFeatureMap,
  type TabFeatureAccess,
  type SectionFeatureFlags,
} from "@/lib/feature-flags"
import { queryKeys } from "@/lib/query-keys"

interface UsePlanFeaturesResult {
  featureAccess: TabFeatureAccess
  flags: SectionFeatureFlags
  isLoading: boolean
}

interface FeatureAccessResponse {
  access?: TabFeatureAccess
  flags?: SectionFeatureFlags
}

interface PlanFeaturesData {
  access: TabFeatureAccess
  flags: SectionFeatureFlags
}

function getPlanKey(planIdentifier: string | null): string {
  return planIdentifier && planIdentifier.trim().length > 0 ? planIdentifier.trim() : "__no_plan__"
}

function getRestrictedPlanFeatures(): PlanFeaturesData {
  return {
    access: resolveTabFeatureAccessFromFeatureMap(null),
    flags: resolveSectionFlagsFromFeatureMap(null),
  }
}

async function fetchFeatureAccess(): Promise<PlanFeaturesData> {
  let next = getRestrictedPlanFeatures()

  try {
    const response = await fetchWithSessionAuth("/api/feature-access", {
      method: "GET",
      cache: "no-store",
    })

    if (response.ok) {
      const data = (await response.json()) as FeatureAccessResponse
      next = {
        access: data.access ?? next.access,
        flags: data.flags ?? next.flags,
      }
    }
  } catch {
    next = getRestrictedPlanFeatures()
  }

  return next
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
        return getRestrictedPlanFeatures()
      }

      return fetchFeatureAccess()
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })

  const data = featureAccessQuery.data ?? getRestrictedPlanFeatures()

  return {
    featureAccess: data.access,
    flags: data.flags,
    isLoading: isAuthInitializing || featureAccessQuery.isPending,
  }
}
