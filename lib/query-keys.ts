export const queryKeys = {
  authUser: ["auth", "current-user"] as const,
  financeMonths: ["finance", "months"] as const,
  featureAccess: (planKey: string) => ["feature-access", planKey] as const,
}
