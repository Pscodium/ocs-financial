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

export function isKnownFeature(name: string): name is FeatureName {
  return KNOWN_FEATURES.includes(name as FeatureName)
}

export function resolveTabFeatureAccessFromFeatureMap(
  featureMap: Partial<Record<FeatureName, boolean>> | null | undefined,
): TabFeatureAccess {
  if (!featureMap) {
    return getRestrictedTabFeatureAccess()
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
