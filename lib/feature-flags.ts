import type { User } from "@/lib/api"

export type FeatureName =
  | "financial_months"
  | "financial_budgets"
  | "financial_investments"
  | "financial_goals"
  | "financial_subscriptions"

type TabRoute = "/" | "/budgets" | "/investments" | "/goals" | "/analytics" | "/recurring"

export type TabFeatureAccess = Record<TabRoute, boolean>

const KNOWN_FEATURES: FeatureName[] = [
  "financial_months",
  "financial_budgets",
  "financial_investments",
  "financial_goals",
  "financial_subscriptions",
]

const TAB_TO_FEATURE: Record<TabRoute, FeatureName | null> = {
  "/": "financial_months",
  "/budgets": "financial_budgets",
  "/investments": "financial_investments",
  "/goals": "financial_goals",
  "/analytics": null,
  "/recurring": "financial_subscriptions",
}

const TAB_ORDER: TabRoute[] = ["/", "/budgets", "/investments", "/goals", "/analytics", "/recurring"]

const FLAGSMITH_API_URL = process.env.NEXT_PUBLIC_FLAGSMITH_API_URL
const FLAGSMITH_ENVIRONMENT_KEY = process.env.NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY
const inFlightFeatureRequests = new Map<string, Promise<Partial<Record<FeatureName, boolean>> | null>>()
const inMemoryFeatureMap = new Map<string, Partial<Record<FeatureName, boolean>>>()

function getFlagsmithIdentitiesUrl(): string | null {
  if (!FLAGSMITH_API_URL) {
    return null
  }

  const normalizedBase = FLAGSMITH_API_URL
    .replace(/\/$/, "")
    .replace(/\/api\/v1$/i, "")

  return `${normalizedBase}/api/v1/identities/`
}

function isKnownFeature(name: string): name is FeatureName {
  return KNOWN_FEATURES.includes(name as FeatureName)
}

function getCachedFeatureMap(plan: string): Partial<Record<FeatureName, boolean>> | null {
  if (typeof window === "undefined") {
    return null
  }

  const cached = window.sessionStorage.getItem(`flagsmith_features_${plan}`)
  if (!cached) {
    return null
  }

  try {
    return JSON.parse(cached) as Partial<Record<FeatureName, boolean>>
  } catch {
    return null
  }
}

function cacheFeatureMap(plan: string, features: Partial<Record<FeatureName, boolean>>): void {
  if (typeof window === "undefined") {
    return
  }
  window.sessionStorage.setItem(`flagsmith_features_${plan}`, JSON.stringify(features))
}

async function fetchFlagsmithFeaturesByIdentity(plan: string): Promise<Partial<Record<FeatureName, boolean>> | null> {
  const inMemoryCached = inMemoryFeatureMap.get(plan)
  if (inMemoryCached) {
    return inMemoryCached
  }

  const inFlightRequest = inFlightFeatureRequests.get(plan)
  if (inFlightRequest) {
    return inFlightRequest
  }

  if (!FLAGSMITH_API_URL || !FLAGSMITH_ENVIRONMENT_KEY) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[flagsmith] Variáveis ausentes: NEXT_PUBLIC_FLAGSMITH_API_URL e/ou NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY")
    }
    return null
  }

  const identitiesUrl = getFlagsmithIdentitiesUrl()
  if (!identitiesUrl) {
    return null
  }

  const requestPromise = (async () => {
    try {
      const response = await fetch(identitiesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Environment-Key": FLAGSMITH_ENVIRONMENT_KEY,
        },
        body: JSON.stringify({
          identifier: plan,
        }),
      })

      if (!response.ok) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[flagsmith] Request falhou (${response.status}) para ${identitiesUrl}`)
        }
        return null
      }

      const data = (await response.json()) as {
        flags?: Array<{ feature?: { name?: string }; enabled?: boolean }>
      }

      const featureMap: Partial<Record<FeatureName, boolean>> = {}

      for (const flag of data.flags ?? []) {
        const name = flag.feature?.name
        if (!name || !isKnownFeature(name)) {
          continue
        }
        featureMap[name] = Boolean(flag.enabled)
      }

      inMemoryFeatureMap.set(plan, featureMap)
      return featureMap
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[flagsmith] Erro de rede ao consultar ${identitiesUrl}`)
      }
      return null
    } finally {
      inFlightFeatureRequests.delete(plan)
    }
  })()

  inFlightFeatureRequests.set(plan, requestPromise)
  return requestPromise
}

export function getDefaultTabFeatureAccess(): TabFeatureAccess {
  return {
    "/": true,
    "/budgets": true,
    "/investments": true,
    "/goals": true,
    "/analytics": true,
    "/recurring": true,
  }
}

function getRestrictedTabFeatureAccess(): TabFeatureAccess {
  return {
    "/": false,
    "/budgets": false,
    "/investments": false,
    "/goals": false,
    "/analytics": true,
    "/recurring": false,
  }
}

export async function resolveTabFeatureAccess(plan: string | null | undefined): Promise<TabFeatureAccess> {
  if (!plan) {
    return getRestrictedTabFeatureAccess()
  }

  const featureMapFromApi = await fetchFlagsmithFeaturesByIdentity(plan)
  const cached = getCachedFeatureMap(plan)
  const featureMap = featureMapFromApi ?? cached

  if (featureMap) {
    if (featureMapFromApi) {
      cacheFeatureMap(plan, featureMap)
    }

    return {
      "/": Boolean(featureMap.financial_months),
      "/budgets": Boolean(featureMap.financial_budgets),
      "/investments": Boolean(featureMap.financial_investments),
      "/goals": Boolean(featureMap.financial_goals),
      "/analytics": true,
      "/recurring": Boolean(featureMap.financial_subscriptions),
    }
  }

  return getRestrictedTabFeatureAccess()
}

export function getUserPlanIdentifier(user: User | null): string | null {
  if (!user) {
    return null
  }

  const maybeUser = user as unknown as Record<string, unknown>

  const plan =
    maybeUser.plan ??
    maybeUser.planIdentifier ??
    maybeUser.plan_identifier ??
    maybeUser.subscriptionPlan ??
    maybeUser.subscription_plan ??
    maybeUser.role

  return typeof plan === "string" && plan.trim().length > 0 ? plan : null
}

function getRouteFromPathname(pathname: string): TabRoute | null {
  if (pathname === "/") {
    return "/"
  }

  for (const route of TAB_ORDER) {
    if (route !== "/" && pathname.startsWith(route)) {
      return route
    }
  }

  return null
}

export function isPathAllowedByFeatures(pathname: string, access: TabFeatureAccess): boolean {
  const route = getRouteFromPathname(pathname)
  if (!route) {
    return true
  }

  const feature = TAB_TO_FEATURE[route]
  if (!feature) {
    return access[route]
  }

  return access[route]
}

export function getFirstAllowedPath(access: TabFeatureAccess): string {
  for (const route of TAB_ORDER) {
    if (access[route]) {
      return route
    }
  }
  return "/"
}
