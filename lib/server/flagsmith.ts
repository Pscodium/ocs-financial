import "server-only"

import { isKnownFeature, type FeatureName } from "@/lib/feature-flags"

type FeatureMap = Partial<Record<FeatureName, boolean>>

const FLAGSMITH_API_URL = process.env.FLAGSMITH_API_URL ?? process.env.NEXT_PUBLIC_FLAGSMITH_API_URL
const FLAGSMITH_ENVIRONMENT_KEY = process.env.FLAGSMITH_ENVIRONMENT_KEY ?? process.env.NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY

const inFlightFeatureRequests = new Map<string, Promise<FeatureMap | null>>()
const inMemoryFeatureMap = new Map<string, FeatureMap>()

function getFlagsmithIdentitiesUrl(): string | null {
  if (!FLAGSMITH_API_URL) {
    return null
  }

  const normalizedBase = FLAGSMITH_API_URL
    .replace(/\/$/, "")
    .replace(/\/api\/v1$/i, "")

  return `${normalizedBase}/api/v1/identities/`
}

export async function fetchFlagsmithFeaturesByIdentity(plan: string): Promise<FeatureMap | null> {
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
      console.warn("[flagsmith] Variáveis ausentes: FLAGSMITH_API_URL e/ou FLAGSMITH_ENVIRONMENT_KEY")
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
        cache: "no-store",
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

      const featureMap: FeatureMap = {}

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
