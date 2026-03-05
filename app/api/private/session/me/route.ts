import { NextRequest, NextResponse } from "next/server"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://finapi.pscodium.dev"

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cookieHeader = request.headers.get("cookie")

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (authHeader) {
    headers.Authorization = authHeader
  }

  if (cookieHeader) {
    headers.Cookie = cookieHeader
  }

  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE_URL}/check/auth`, {
      method: "GET",
      headers,
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ message: "User upstream unavailable" }, { status: 502 })
  }

  const responseBody = await upstream.text()
  const response = new NextResponse(responseBody, { status: upstream.status })

  const upstreamType = upstream.headers.get("content-type")
  if (upstreamType) {
    response.headers.set("content-type", upstreamType)
  }

  return response
}
