'use client'

import { AppHeader } from '@/components/app-header'
import { LanguageProvider } from '@/lib/i18n/context'

export function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LanguageProvider>
      <div className="min-h-dvh w-full bg-background">
        <AppHeader />

        <main className="min-h-[calc(100dvh-72px)]">
          {children}
        </main>
      </div>
    </LanguageProvider>
  )
}