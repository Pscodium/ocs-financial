import { NextRequest, NextResponse } from "next/server"

const API_AUTH_URL = process.env.NEXT_PUBLIC_API_AUTH_URL || "http://localhost:3000"

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "application/json"
  const cookieHeader = request.headers.get("cookie")
  const body = await request.text()

  let upstream: Response
  try {
    upstream = await fetch(`${API_AUTH_URL}/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body,
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

  const setCookie = upstream.headers.get("set-cookie")
  if (setCookie) {
    response.headers.set("set-cookie", setCookie)
  }

  return response
}
