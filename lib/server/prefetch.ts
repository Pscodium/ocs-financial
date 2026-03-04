import "server-only"

import { cookies, headers } from "next/headers"
import type { MonthData } from "@/lib/types"
import type { User } from "@/lib/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://finapi.pscodium.dev"

async function fetchWithForwardedAuth(path: string): Promise<Response> {
  const requestHeaders = await headers()
  const cookieStore = await cookies()

  const forwardedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  }

  const authorization = requestHeaders.get("authorization")
  if (authorization) {
    forwardedHeaders.Authorization = authorization
  }

  const cookieHeader = cookieStore.toString()
  if (cookieHeader) {
    forwardedHeaders.Cookie = cookieHeader
  }

  return fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: forwardedHeaders,
    cache: "no-store",
  })
}

export async function prefetchCurrentUserServer(): Promise<User | null> {
  try {
    const response = await fetchWithForwardedAuth("/check/auth")
    if (!response.ok) {
      return null
    }

    return (await response.json()) as User
  } catch {
    return null
  }
}

export async function prefetchMonthsServer(): Promise<MonthData[]> {
  try {
    const response = await fetchWithForwardedAuth("/months")
    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as MonthData[]
    return data.filter((month) => month && month.monthKey)
  } catch {
    return []
  }
}
