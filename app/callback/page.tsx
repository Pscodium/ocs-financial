"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"

export default function OAuthCallbackPage() {
  const router = useRouter()
  const { handleOAuthCallback } = useAuth()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    const state = params.get("state")

    if (!code) {
      router.replace("/login")
      return
    }

    handleOAuthCallback(code, state ?? undefined)
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
