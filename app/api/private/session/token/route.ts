import { NextRequest, NextResponse } from "next/server"

const API_AUTH_URL = process.env.NEXT_PUBLIC_API_AUTH_URL || "http://localhost:3000"
const REFRESH_COOKIE = "app_refresh_token"

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "application/json"
  const cookieHeader = request.headers.get("cookie")
  const rawBody = await request.text()
  const isJson = contentType.includes("application/json")

  let bodyToSend = rawBody

  if (isJson) {
    try {
      const payload = JSON.parse(rawBody || "{}") as Record<string, unknown>
      const grantType = payload.grant_type

      if (grantType === "refresh_token" && !payload.refresh_token) {
        const refreshFromCookie = request.cookies.get(REFRESH_COOKIE)?.value
        if (refreshFromCookie) {
          payload.refresh_token = refreshFromCookie
        }
      }

      bodyToSend = JSON.stringify(payload)
    } catch {
      bodyToSend = rawBody
    }
  }

  let upstream: Response
  try {
    upstream = await fetch(`${API_AUTH_URL}/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: bodyToSend,
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ message: "Auth upstream unavailable" }, { status: 502 })
  }

  const responseBody = await upstream.text()
  const response = new NextResponse(responseBody, { status: upstream.status })

  const upstreamType = upstream.headers.get("content-type")
  if (upstreamType) {
    response.headers.set("content-type", upstreamType)
  }

  if (upstream.ok && upstreamType?.includes("application/json")) {
    try {
      const payload = JSON.parse(responseBody) as Record<string, unknown>
      const refreshToken = payload.refresh_token

      if (typeof refreshToken === "string" && refreshToken.length > 0) {
        response.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions())
      }
    } catch {
      // ignore invalid json payloads
    }
  }

  const upstreamHeaders = upstream.headers as Headers & {
    getSetCookie?: () => string[]
  }
  const setCookies = upstreamHeaders.getSetCookie?.() ?? []

  if (setCookies.length > 0) {
    for (const cookieValue of setCookies) {
      response.headers.append("set-cookie", cookieValue)
    }
  } else {
    const setCookie = upstream.headers.get("set-cookie")
    if (setCookie) {
      response.headers.append("set-cookie", setCookie)
    }
  }

  return response
}
