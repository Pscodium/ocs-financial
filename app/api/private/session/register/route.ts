import { NextRequest, NextResponse } from "next/server"

const API_AUTH_URL = process.env.API_AUTH_URL ?? process.env.NEXT_PUBLIC_API_AUTH_URL ?? "http://localhost:3000"

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "application/json"
  const cookieHeader = request.headers.get("cookie")
  const body = await request.text()

  let upstream: Response
  try {
    upstream = await fetch(`${API_AUTH_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body,
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ message: "Register upstream unavailable" }, { status: 502 })
  }

  const responseBody = await upstream.text()
  const response = new NextResponse(responseBody, { status: upstream.status })

  const upstreamType = upstream.headers.get("content-type")
  if (upstreamType) {
    response.headers.set("content-type", upstreamType)
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
