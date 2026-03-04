import React from "react"
import type { Metadata, Viewport } from 'next'
import { cookies } from "next/headers"
import { Inter, JetBrains_Mono } from 'next/font/google'
import { dehydrate, QueryClient } from "@tanstack/react-query"
import { Toaster } from 'sonner'
import { AuthProvider } from '@/hooks/use-auth'
import { PWARegister } from '@/components/pwa-register'
import { IOSBounceGuard } from '@/components/ios-bounce-guard' 
import { QueryProvider } from "@/components/query-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchFlagsmithFeaturesByIdentity } from "@/lib/server/flagsmith"
import { resolveTabFeatureAccessFromFeatureMap } from "@/lib/feature-flags"

import './globals.css'

const _inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const _jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

export const metadata: Metadata = {
  title: 'Gestor Financeiro',
  description: 'Gerencie suas contas mensais de forma simples e organizada',
  manifest: '/manifest.webmanifest',
  applicationName: 'Gestor Financeiro',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#0d9668',
  width: 'device-width',
  initialScale: 1,
}

const FEATURE_PLAN_COOKIE = "feature_plan"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const queryClient = new QueryClient()
  const cookieStore = await cookies()
  const planIdentifier = cookieStore.get(FEATURE_PLAN_COOKIE)?.value?.trim() || ""

  if (planIdentifier) {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.featureAccess(planIdentifier),
      queryFn: async () => {
        const featureMap = await fetchFlagsmithFeaturesByIdentity(planIdentifier)
        return resolveTabFeatureAccessFromFeatureMap(featureMap)
      },
      staleTime: 5 * 60 * 1000,
    })
  }

  const dehydratedState = dehydrate(queryClient)

  return (
    <html lang="pt-BR">
      <body className={`${_inter.variable} ${_jetbrains.variable} font-sans antialiased`}>
        <IOSBounceGuard />
        <PWARegister />
        <QueryProvider state={dehydratedState}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}

