import { parse } from "cookie"
import type { MonthData } from "./types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://finapi.pscodium.dev"
const API_AUTH_URL = process.env.NEXT_PUBLIC_API_AUTH_URL || "http://localhost:3000"
const CLIENT_ID = "ocs-financial"
const REDIRECT_URI = typeof window !== "undefined" ? `${window.location.origin}/callback` : "http://localhost:3001/callback"
const MONTHS_CACHE_TTL_MS = 2000

let inFlightGetMonthsRequest: Promise<MonthData[]> | null = null
let monthsCache: MonthData[] | null = null
let monthsCacheUpdatedAt = 0

console.log('API_BASE_URL:', API_BASE_URL)
console.log('API_AUTH_URL:', API_AUTH_URL)

// PKCE Helper Functions
function generateRandomString(length: number): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return crypto.subtle.digest('SHA-256', data)
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function generatePKCE() {
  const verifier = generateRandomString(32)
  const hashed = await sha256(verifier)
  const challenge = base64urlEncode(hashed)
  return { verifier, challenge }
}

// Token Management
interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

function storeTokens(tokens: TokenResponse) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    localStorage.setItem('token_expires_at', String(Date.now() + tokens.expires_in * 1000))
  }
}

function getAccessToken(): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('access_token')
  }
  return null
}

function getRefreshToken(): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('refresh_token')
  }
  return null
}

function clearTokens() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('token_expires_at')
    localStorage.removeItem('pkce_verifier')
  }
}

function invalidateMonthsCache() {
  monthsCache = null
  monthsCacheUpdatedAt = 0
}


export interface User {
  id: string
  profileIcon?: string
  nickname?: string
  external_id?: string | null
  plan?: string | null
  role: string
  status: string
  firstName: string
  lastName: string
  email: string
  verifiedEmail: boolean
  createdAt: string
  updatedAt: string
}

export interface LoginResponse {
  code: string
  state?: string
}

export interface RegisterPayload {
  email: string
  password: string
  fullName: string
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export class NetworkError extends Error {
  constructor(message: string = "Network error - API não disponível") {
    super(message)
    this.name = "NetworkError"
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getAccessToken()
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  // Merge existing headers
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value
      })
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value
      })
    } else {
      Object.assign(headers, options.headers)
    }
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const emitRateLimitEvent = (response: Response) => {
    if (typeof window === "undefined") {
      return
    }
    window.dispatchEvent(
      new CustomEvent("rate-limit", {
        detail: {
          path: url,
          status: response.status,
          retryAfter: response.headers.get("Retry-After"),
        },
      }),
    )
  }

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    })

    if (response.status === 429) {
      emitRateLimitEvent(response)
      throw new ApiError(429, "Rate limit exceeded")
    }

    // If unauthorized, try to refresh token
    if (response.status === 401) {
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        try {
          await api.refreshToken()
          // Retry request with new token
          const newToken = getAccessToken()
          if (newToken) {
            headers["Authorization"] = `Bearer ${newToken}`
            const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
              ...options,
              headers,
            })
            if (retryResponse.status === 429) {
              emitRateLimitEvent(retryResponse)
              throw new ApiError(429, "Rate limit exceeded")
            }

            if (!retryResponse.ok) {
              throw new ApiError(retryResponse.status, `API Error: ${retryResponse.statusText}`)
            }
            return retryResponse
          }
        } catch (refreshError) {
          // Refresh failed, clear tokens and throw
          clearTokens()
          throw new ApiError(401, "Session expired")
        }
      }
      throw new ApiError(401, "Unauthorized")
    }

    if (!response.ok) {
      throw new ApiError(response.status, `API Error: ${response.statusText}`)
    }

    return response
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    // Network error or API offline
    throw new NetworkError()
  }
}

export const api = {
  // Auth - OAuth2 with PKCE Flow
  async register(payload: RegisterPayload): Promise<void> {
    try {
      const response = await fetch(`${API_AUTH_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new ApiError(response.status, "Falha ao registrar usuário")
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new NetworkError()
    }
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    try {
      // Generate PKCE
      const pkce = await generatePKCE()
      
      // Store verifier for token exchange
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pkce_verifier', pkce.verifier)
      }

      // Step 1: Login to get authorization code
      const loginResponse = await fetch(`${API_AUTH_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          code_challenge: pkce.challenge,
          code_challenge_method: 'S256'
        }),
      })

      if (!loginResponse.ok) {
        throw new ApiError(loginResponse.status, "Credenciais inválidas")
      }

      const { code } = await loginResponse.json() as LoginResponse

      // Step 2: Exchange authorization code for tokens
      return await this.exchangeCode(code, pkce.verifier)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new NetworkError()
    }
  },

  async exchangeCode(code: string, verifier?: string): Promise<TokenResponse> {
    try {
      const codeVerifier = verifier || (typeof localStorage !== 'undefined' ? localStorage.getItem('pkce_verifier') : null)
      
      if (!codeVerifier) {
        throw new Error('PKCE verifier not found')
      }

      const response = await fetch(`${API_AUTH_URL}/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: codeVerifier
        }),
      })

      if (!response.ok) {
        throw new ApiError(response.status, "Failed to exchange authorization code")
      }

      const tokens = await response.json() as TokenResponse
      
      // Store tokens
      storeTokens(tokens)
      
      // Clean up verifier
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('pkce_verifier')
      }

      return tokens
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new NetworkError()
    }
  },

  async refreshToken(): Promise<TokenResponse> {
    try {
      const refreshToken = getRefreshToken()
      
      if (!refreshToken) {
        throw new ApiError(401, 'No refresh token available')
      }

      const response = await fetch(`${API_AUTH_URL}/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: CLIENT_ID
        }),
      })

      if (!response.ok) {
        throw new ApiError(response.status, "Failed to refresh token")
      }

      const tokens = await response.json() as TokenResponse
      storeTokens(tokens)

      return tokens
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new NetworkError()
    }
  },

  async logout(): Promise<void> {
    try {
      const refreshToken = getRefreshToken()

      if (refreshToken) {
        await fetch(`${API_AUTH_URL}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
            client_id: CLIENT_ID
          })
        })
      }

      clearTokens()
    } catch (error) {
      // Always clear tokens even if logout request fails
      clearTokens()
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const token = getAccessToken()
      if (!token) {
        return null
      }

      const response = await fetchWithAuth('/check/auth')

      if (!response.ok) {
        return null
      }

      return response.json()
    } catch (error) {
      return null
    }
  },

  // Months CRUD
  async getMonths(): Promise<MonthData[]> {
    const now = Date.now()

    if (monthsCache && now - monthsCacheUpdatedAt < MONTHS_CACHE_TTL_MS) {
      return monthsCache
    }

    if (inFlightGetMonthsRequest) {
      return inFlightGetMonthsRequest
    }

    const request = (async () => {
      const response = await fetchWithAuth("/months")
      const data = (await response.json()) as MonthData[]
      monthsCache = data
      monthsCacheUpdatedAt = Date.now()
      return data
    })()

    inFlightGetMonthsRequest = request

    try {
      return await request
    } finally {
      inFlightGetMonthsRequest = null
    }
  },

  async getMonthByKey(monthKey: string): Promise<MonthData> {
    const response = await fetchWithAuth(`/month/${monthKey}`, {
      method: "GET",
    })
    return response.json()
  },

  async createMonth(monthData: MonthData): Promise<MonthData> {
    invalidateMonthsCache()
    const response = await fetchWithAuth("/months", {
      method: "POST",
      body: JSON.stringify(monthData),
    })

    if (response.status === 204) {
      return {} as MonthData
    }

    return await response.json()
  },

  async updateMonth(monthKey: string, monthData: MonthData): Promise<MonthData> {
    invalidateMonthsCache()
    const response = await fetchWithAuth(`/months/${monthKey}`, {
      method: "PUT",
      body: JSON.stringify(monthData),
    })
    return await response.json()
  },

  async deleteMonth(monthKey: string): Promise<void> {
    invalidateMonthsCache()
    await fetchWithAuth(`/months/${monthKey}`, {
      method: "DELETE",
    })
  },

  // Health check
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { 
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
      return response.ok
    } catch {
      return false
    }
  },

  // Budgets CRUD
  async getBudgets(monthKey: string): Promise<import("./types").Budget[]> {
    const response = await fetchWithAuth(`/months/${monthKey}/budgets`)
    return response.json()
  },

  async createBudget(monthKey: string, budget: import("./types").Budget): Promise<import("./types").Budget> {
    const response = await fetchWithAuth(`/months/${monthKey}/budgets`, {
      method: "POST",
      body: JSON.stringify(budget),
    })
    return response.json()
  },

  async updateBudget(monthKey: string, budgetId: string, budget: import("./types").Budget): Promise<import("./types").Budget> {
    const response = await fetchWithAuth(`/months/${monthKey}/budgets/${budgetId}`, {
      method: "PUT",
      body: JSON.stringify(budget),
    })
    return response.json()
  },

  async deleteBudget(monthKey: string, budgetId: string): Promise<void> {
    await fetchWithAuth(`/months/${monthKey}/budgets/${budgetId}`, {
      method: "DELETE",
    })
  },

  // Investments CRUD
  async getInvestments(monthKey: string): Promise<import("./types").Investment[]> {
    const response = await fetchWithAuth(`/months/${monthKey}/investments`)
    return response.json()
  },

  async createInvestment(monthKey: string, investment: import("./types").Investment): Promise<import("./types").Investment> {
    const response = await fetchWithAuth(`/months/${monthKey}/investments`, {
      method: "POST",
      body: JSON.stringify(investment),
    })
    return response.json()
  },

  async updateInvestment(monthKey: string, investmentId: string, investment: import("./types").Investment): Promise<import("./types").Investment> {
    const response = await fetchWithAuth(`/months/${monthKey}/investments/${investmentId}`, {
      method: "PUT",
      body: JSON.stringify(investment),
    })
    return response.json()
  },

  async deleteInvestment(monthKey: string, investmentId: string): Promise<void> {
    await fetchWithAuth(`/months/${monthKey}/investments/${investmentId}`, {
      method: "DELETE",
    })
  },

  // Goals CRUD
  async getGoals(monthKey: string): Promise<import("./types").FinancialGoal[]> {
    const response = await fetchWithAuth(`/months/${monthKey}/goals`)
    return response.json()
  },

  async createGoal(monthKey: string, goal: import("./types").FinancialGoal): Promise<import("./types").FinancialGoal> {
    const response = await fetchWithAuth(`/months/${monthKey}/goals`, {
      method: "POST",
      body: JSON.stringify(goal),
    })
    return response.json()
  },

  async updateGoal(monthKey: string, goalId: string, goal: import("./types").FinancialGoal): Promise<import("./types").FinancialGoal> {
    const response = await fetchWithAuth(`/months/${monthKey}/goals/${goalId}`, {
      method: "PUT",
      body: JSON.stringify(goal),
    })
    return response.json()
  },

  async deleteGoal(monthKey: string, goalId: string): Promise<void> {
    await fetchWithAuth(`/months/${monthKey}/goals/${goalId}`, {
      method: "DELETE",
    })
  },

  // Subscriptions CRUD
  async getSubscriptions(monthKey: string): Promise<import("./types").Subscription[]> {
    const response = await fetchWithAuth(`/months/${monthKey}/subscriptions`)
    return response.json()
  },

  async createSubscription(monthKey: string, subscription: import("./types").Subscription): Promise<import("./types").Subscription> {
    const response = await fetchWithAuth(`/months/${monthKey}/subscriptions`, {
      method: "POST",
      body: JSON.stringify(subscription),
    })
    return response.json()
  },

  async updateSubscription(monthKey: string, subscriptionId: string, subscription: import("./types").Subscription): Promise<import("./types").Subscription> {
    const response = await fetchWithAuth(`/months/${monthKey}/subscriptions/${subscriptionId}`, {
      method: "PUT",
      body: JSON.stringify(subscription),
    })
    return response.json()
  },

  async deleteSubscription(monthKey: string, subscriptionId: string): Promise<void> {
    await fetchWithAuth(`/months/${monthKey}/subscriptions/${subscriptionId}`, {
      method: "DELETE",
    })
  },
}
