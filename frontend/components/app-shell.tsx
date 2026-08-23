'use client'

import { AppHeader } from '@/components/app-header'
import { Footer } from '@/components/footer'
import { LanguageProvider } from '@/lib/i18n/context'


export function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LanguageProvider>
      <div className="flex min-h-dvh w-full flex-col bg-background">

        <AppHeader />

        <main className="flex-1">
          {children}
        </main>

        <Footer />

      </div>
    </LanguageProvider>
  )
}