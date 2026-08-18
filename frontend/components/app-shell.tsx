'use client'

import { AppHeader } from '@/components/app-header'

export function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh w-full bg-background">
      <AppHeader />

      <main className="min-h-[calc(100dvh-72px)]">
        {children}
      </main>
    </div>
  )
}