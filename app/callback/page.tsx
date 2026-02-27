"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"

export default function OAuthCallbackPage() {
  const router = useRouter()
  const { handleOAuthCallback } = useAuth()

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash
    const hashParams = new URLSearchParams(hash)

    const code = searchParams.get("code") ?? hashParams.get("code") ?? undefined
    const state = searchParams.get("state") ?? hashParams.get("state") ?? undefined
    const accessToken =
      searchParams.get("access_token") ??
      searchParams.get("accessToken") ??
      hashParams.get("access_token") ??
      hashParams.get("accessToken") ??
      undefined
    const refreshToken =
      searchParams.get("refresh_token") ??
      searchParams.get("refreshToken") ??
      hashParams.get("refresh_token") ??
      hashParams.get("refreshToken") ??
      undefined
    const expiresInRaw =
      searchParams.get("expires_in") ??
      searchParams.get("expiresIn") ??
      hashParams.get("expires_in") ??
      hashParams.get("expiresIn")
    const expiresIn = expiresInRaw ? Number(expiresInRaw) : undefined

    if (!code && !accessToken) {
      router.replace("/login")
      return
    }

    handleOAuthCallback({
      code,
      state,
      accessToken,
      refreshToken,
      expiresIn,
    })
      .then(() => {
        router.replace("/")
      })
      .catch(() => {
        router.replace("/login")
      })
  }, [handleOAuthCallback, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
