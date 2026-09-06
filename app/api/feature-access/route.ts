import { NextRequest, NextResponse } from "next/server"
import { resolveTabFeatureAccessFromFeatureMap, resolveSectionFlagsFromFeatureMap } from "@/lib/feature-flags"
import { fetchFeaturesByIdentity } from "@/lib/server/feature-flags"

export async function GET(request: NextRequest) {
  try {
    const featureMap = await fetchFeaturesByIdentity({
      authorizationHeader: request.headers.get("authorization"),
      cookieHeader: request.headers.get("cookie"),
    })
    const access = resolveTabFeatureAccessFromFeatureMap(featureMap)
    const flags = resolveSectionFlagsFromFeatureMap(featureMap)

    return NextResponse.json({ access, flags })
  } catch {
    return NextResponse.json(
      { access: resolveTabFeatureAccessFromFeatureMap(null), flags: resolveSectionFlagsFromFeatureMap(null) },
      { status: 200 },
    )
  }
}
