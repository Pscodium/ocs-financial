import "server-only"

import { isKnownFeature, type FeatureName } from "@/lib/feature-flags"

type FeatureMap = Partial<Record<FeatureName, boolean>>
type ForwardedAuthHeaders = {
  authorizationHeader?: string | null
  cookieHeader?: string | null
}

const API_BASE_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL

const inFlightFeatureRequests = new Map<string, Promise<FeatureMap | null>>()
const inMemoryFeatureMap = new Map<string, FeatureMap>()

function getIdentityProxyUrl(): string | null {
  if (!API_BASE_URL) {
    return null
  }

  return `${API_BASE_URL.replace(/\/$/, "")}/identity`
}

function mapFlagsToFeatureMap(data: { flags?: Array<{ feature?: { name?: string }; enabled?: boolean }> }): FeatureMap {
  const featureMap: FeatureMap = {}

  for (const flag of data.flags ?? []) {
    const name = flag.feature?.name
    if (!name || !isKnownFeature(name)) {
      continue
    }
    featureMap[name] = Boolean(flag.enabled)
  }

  return featureMap
}

export async function fetchFlagsmithFeaturesByIdentity(
  { authorizationHeader, cookieHeader }: ForwardedAuthHeaders = {},
): Promise<FeatureMap | null> {
  const cacheKey = authorizationHeader ?? cookieHeader ?? "anonymous"
  const inMemoryCached = inMemoryFeatureMap.get(cacheKey)
  if (inMemoryCached) {
    return inMemoryCached
  }

  const inFlightRequest = inFlightFeatureRequests.get(cacheKey)
  if (inFlightRequest) {
    return inFlightRequest
  }

  const identityProxyUrl = getIdentityProxyUrl()

  if (!identityProxyUrl) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[flagsmith] Variáveis ausentes: API_URL/NEXT_PUBLIC_API_URL")
    }
    return null
  }

  const requestPromise = (async () => {
    try {
      const headers: HeadersInit = {}

      if (authorizationHeader) {
        headers.Authorization = authorizationHeader
      }

      if (cookieHeader) {
        headers.Cookie = cookieHeader
      }

      const response = await fetch(identityProxyUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      })

      if (!response.ok) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[flagsmith] Request falhou (${response.status}) para ${identityProxyUrl}`)
        }
        return null
      }

      const data = (await response.json()) as {
        flags?: Array<{ feature?: { name?: string }; enabled?: boolean }>
      }

      const featureMap = mapFlagsToFeatureMap(data)

      inMemoryFeatureMap.set(cacheKey, featureMap)
      return featureMap
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[flagsmith] Erro de rede ao consultar ${identityProxyUrl}`)
      }
      return null
    } finally {
      inFlightFeatureRequests.delete(cacheKey)
    }
  })()

  inFlightFeatureRequests.set(cacheKey, requestPromise)
  return requestPromise
}
