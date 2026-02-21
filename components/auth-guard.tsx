"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { usePlanFeatures } from "@/hooks/use-plan-features"
import { getFirstAllowedPath, isPathAllowedByFeatures } from "@/lib/feature-flags"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const { featureAccess, isLoading: isFeaturesLoading } = usePlanFeatures()
  const router = useRouter()
  const pathname = usePathname()
  const isFeatureRouteAllowed = isPathAllowedByFeatures(pathname, featureAccess)

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== "/login") {
      router.push("/login")
    }

    if (!isLoading && !isFeaturesLoading && isAuthenticated && pathname !== "/login" && !isFeatureRouteAllowed) {
      router.replace(getFirstAllowedPath(featureAccess))
    }
  }, [isAuthenticated, isLoading, isFeaturesLoading, isFeatureRouteAllowed, featureAccess, router, pathname])

  if (isLoading || isFeaturesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated && pathname !== "/login") {
    return null
  }

  if (isAuthenticated && pathname !== "/login" && !isFeatureRouteAllowed) {
    return null
  }

  return <>{children}</>
}
