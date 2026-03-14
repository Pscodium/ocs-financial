import { NextRequest, NextResponse } from "next/server"
import { resolveTabFeatureAccessFromFeatureMap } from "@/lib/feature-flags"
import { fetchFeaturesByIdentity } from "@/lib/server/feature-flags"

export async function GET(request: NextRequest) {
  try {
    const featureMap = await fetchFeaturesByIdentity({
      authorizationHeader: request.headers.get("authorization"),
      cookieHeader: request.headers.get("cookie"),
    })
    const access = resolveTabFeatureAccessFromFeatureMap(featureMap)

    return NextResponse.json({ access })
  } catch {
    return NextResponse.json({ access: resolveTabFeatureAccessFromFeatureMap(null) }, { status: 200 })
  }
}
