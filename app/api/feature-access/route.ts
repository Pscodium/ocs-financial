import { NextRequest, NextResponse } from "next/server"
import { resolveTabFeatureAccessFromFeatureMap } from "@/lib/feature-flags"
import { fetchFlagsmithFeaturesByIdentity } from "@/lib/server/flagsmith"

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { plan?: unknown }
    const plan = typeof payload.plan === "string" ? payload.plan.trim() : ""

    if (!plan) {
      return NextResponse.json({ access: resolveTabFeatureAccessFromFeatureMap(null) })
    }

    const featureMap = await fetchFlagsmithFeaturesByIdentity(plan)
    const access = resolveTabFeatureAccessFromFeatureMap(featureMap)

    return NextResponse.json({ access })
  } catch {
    return NextResponse.json({ access: resolveTabFeatureAccessFromFeatureMap(null) }, { status: 200 })
  }
}
