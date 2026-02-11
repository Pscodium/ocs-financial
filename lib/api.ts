import { parse } from "cookie"
import type { MonthData } from "./types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://finapi.pscodium.dev"
const API_AUTH_URL = process.env.NEXT_PUBLIC_API_AUTH_URL || API_BASE_URL

console.log('API_BASE_URL:', API_BASE_URL)
console.log('API_AUTH_URL:', API_AUTH_URL)

export interface User {
  id: string
  profileIcon?: string
  nickname?: string
  external_id?: string | null
  role: string
  status: string
  firstName: string
  lastName: string
  email: string
  verifiedEmail: boolean
  createdAt: string
  updatedAt: string
  token: string
}

export interface LoginResponse {
  id: string
  profileIcon?: string
  nickname?: string
  external_id?: string | null
  role: string
  status: string
  firstName: string
  lastName: string
  email: string
  verifiedEmail: boolean
  createdAt: string
  updatedAt: string
  token: string
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
  const cookieToken = typeof document !== "undefined" ? parse(document.cookie).token : undefined
  const token = cookieToken || localStorage.getItem("auth_token")
  
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

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    })

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
  // Auth
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_AUTH_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        throw new ApiError(response.status, "Credenciais inválidas")
      }

      const data = await response.json()
      return data
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new NetworkError()
    }
  },

  // Months CRUD
  async getMonths(): Promise<MonthData[]> {
    const response = await fetchWithAuth("/months")
    return response.json()
  },

  async getMonthByKey(monthKey: string): Promise<MonthData> {
    const response = await fetchWithAuth(`/month/${monthKey}`, {
      method: "GET",
    })
    return response.json()
  },

  async createMonth(monthData: MonthData): Promise<MonthData> {
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
    const response = await fetchWithAuth(`/months/${monthKey}`, {
      method: "PUT",
      body: JSON.stringify(monthData),
    })
    return await response.json()
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

  async logout(): Promise<void> {
    const cookieToken = typeof document !== "undefined" ? parse(document.cookie).token : undefined
    const token = cookieToken || localStorage.getItem("auth_token")

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`
    }

    await fetch(`${API_AUTH_URL}/logout`, {
        method: "GET",
        headers
    })
    return
  }
}
