'use client'

import { usePathname } from 'next/navigation'

import { AppHeader } from '@/components/app-header'
import { CompetitionWorkspaceNav } from '@/components/competition-workspace-nav'
import { Footer } from '@/components/footer'
import { LanguageProvider } from '@/lib/i18n/context'


function isCompetitionWorkspace(
  pathname: string,
) {
  const segments =
    pathname
      .split('/')
      .filter(Boolean)

  return (
    segments[0] === 'evaluations' &&
    segments.length >= 2 &&
    segments[1] !== 'new'
  )
}


export function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname =
    usePathname()


  const insideCompetition =
    isCompetitionWorkspace(
      pathname,
    )


  return (
    <LanguageProvider>

      <div
        className="
          flex
          min-h-dvh
          w-full
          flex-col
          bg-white
        "
      >

        {insideCompetition ? (
          <CompetitionWorkspaceNav />
        ) : (
          <AppHeader />
        )}


        <main className="flex-1">
          {children}
        </main>


        <Footer />

      </div>

    </LanguageProvider>
  )
}