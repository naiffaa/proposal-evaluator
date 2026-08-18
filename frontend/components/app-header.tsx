'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  ChevronDown,
  CircleHelp,
  LogOut,
  Menu,
  Settings,
  User,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  onOpenMobileNav?: () => void
}

const desktopNavItems = [
  { label: 'Home', href: '/' },
  { label: 'New Evaluation', href: '/evaluations/new' },
  { label: 'Evaluations', href: '/evaluations' },
  { label: 'RFP Analysis', href: '/rfp-analysis' },
  { label: 'Vendor Comparison', href: '/comparison' },
  { label: 'Compliance', href: '/compliance' },
  { label: 'Reports', href: '/reports' },
]

function isActivePath(pathname: string, href: string) {
  // Home
  if (href === '/') {
    return pathname === '/'
  }

  // New Evaluation must be separate
  if (href === '/evaluations/new') {
    return pathname === '/evaluations/new'
  }

  // Evaluations should NOT activate on New Evaluation
  if (href === '/evaluations') {
    return (
      pathname === '/evaluations' ||
      (
        pathname.startsWith('/evaluations/') &&
        !pathname.startsWith('/evaluations/new')
      )
    )
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  )
}

export function AppHeader({
  onOpenMobileNav,
}: AppHeaderProps) {
  const pathname = usePathname()

  const isHome = pathname === '/'

  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      // Scroll effect only applies on Home
      if (isHome) {
        setIsScrolled(window.scrollY > 20)
      } else {
        setIsScrolled(true)
      }
    }

    handleScroll()

    window.addEventListener(
      'scroll',
      handleScroll,
      { passive: true },
    )

    return () => {
      window.removeEventListener(
        'scroll',
        handleScroll,
      )
    }
  }, [isHome])

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent,
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false)
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      )
    }
  }, [])

  // Dark navbar only when we are:
  // 1. On Home
  // 2. At the top of the page
  const darkHeader =
    isHome && !isScrolled

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 w-full transition-all duration-300',

          darkHeader
            ? 'bg-[#161F56]'
            : 'bg-white/95 shadow-sm backdrop-blur-xl',
        )}
        style={
          darkHeader
            ? {
                backgroundImage:
                  'url("/images/navbar-bg.png")',
                backgroundSize: 'cover',
                backgroundPosition: 'left center',
                backgroundRepeat: 'no-repeat',
              }
            : undefined
        }
      >
        <div className="mx-auto flex h-[84px] w-full items-center gap-3 px-6 lg:px-8">

          {/* BRAND */}

          <Link
            href="/"
            className="flex shrink-0 items-center gap-3"
          >
            <img
              src="/images/ksf-logo.png"
              alt="KSF Logo"
              className="h-[62px] w-[62px] shrink-0 object-contain"
            />

            <div className="hidden min-w-0 leading-tight md:block">

              <p
                className={cn(
                  'whitespace-nowrap text-[15px] font-semibold tracking-tight transition-colors',

                  darkHeader
                    ? 'text-white'
                    : 'text-[#161F56]',
                )}
              >
                KSF Proposal Evaluation
              </p>

              <p
                className={cn(
                  'mt-1 text-xs transition-colors',

                  darkHeader
                    ? 'text-white/70'
                    : 'text-muted-foreground',
                )}
              >
                Portal
              </p>

            </div>
          </Link>

          {/* DESKTOP NAV */}

          <nav className="hidden min-w-0 flex-1 items-center justify-center lg:flex">

            <div className="flex min-w-0 items-center gap-1">

              {desktopNavItems.map((item) => {
                const active = isActivePath(
                  pathname,
                  item.href,
                )

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      `
                        whitespace-nowrap
                        rounded-md
                        px-3
                        py-2.5
                        text-[13px]
                        font-medium
                        leading-none
                        transition-all
                        duration-200
                      `,

                      active
                        ? darkHeader
                          ? 'bg-white/15 text-white'
                          : 'bg-[#161F56] text-white'
                        : darkHeader
                          ? 'text-white/80 hover:bg-white/10 hover:text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-[#161F56]',
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}

            </div>

          </nav>

          {/* RIGHT SIDE */}

          <div className="ml-auto flex shrink-0 items-center gap-1">

            <HeaderIconButton
              label="Notifications"
              badge
              darkHeader={darkHeader}
            >
              <Bell className="size-5" />
            </HeaderIconButton>

            {/* USER */}

            <div
              className="relative ml-1"
              ref={menuRef}
            >
              <button
                type="button"
                onClick={() =>
                  setMenuOpen(
                    (value) => !value,
                  )
                }
                className={cn(
                  'flex items-center gap-1.5 rounded-md p-1 transition-colors',

                  darkHeader
                    ? 'hover:bg-white/10'
                    : 'hover:bg-slate-100',
                )}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span
                  className={cn(
                    'flex size-11 items-center justify-center rounded-full text-sm font-semibold transition-all',

                    darkHeader
                      ? 'bg-white text-[#161F56]'
                      : 'bg-[#161F56] text-white',
                  )}
                >
                  NA
                </span>

                <ChevronDown
                  className={cn(
                    'hidden size-3.5 md:block',

                    darkHeader
                      ? 'text-white/70'
                      : 'text-slate-500',
                  )}
                />
              </button>

              {/* USER MENU */}

              {menuOpen && (
                <div
                  role="menu"
                  className="
                    absolute
                    right-0
                    top-[calc(100%+10px)]
                    w-60
                    overflow-hidden
                    rounded-xl
                    border
                    border-border
                    bg-white
                    shadow-[0_16px_40px_rgba(22,31,86,0.15)]
                  "
                >
                  <div className="border-b border-border p-4">

                    <p className="text-sm font-semibold text-foreground">
                      Naifa Alarifi
                    </p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Procurement Analyst
                    </p>

                  </div>

                  <div className="p-2">

                    <MenuLink
                      icon={User}
                      label="Profile"
                    />

                    <MenuLink
                      icon={Settings}
                      label="Settings"
                      href="/settings"
                    />

                    <MenuLink
                      icon={CircleHelp}
                      label="Help & Support"
                    />

                  </div>

                  <div className="border-t border-border p-2">

                    <MenuLink
                      icon={LogOut}
                      label="Sign out"
                      tone="danger"
                    />

                  </div>

                </div>
              )}
            </div>

            {/* MOBILE MENU */}

            <button
              type="button"
              onClick={() => {
                if (onOpenMobileNav) {
                  onOpenMobileNav()
                } else {
                  setMobileOpen(true)
                }
              }}
              className={cn(
                'flex size-9 items-center justify-center rounded-md transition-colors lg:hidden',

                darkHeader
                  ? 'text-white hover:bg-white/10'
                  : 'text-[#161F56] hover:bg-slate-100',
              )}
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>

          </div>

        </div>
      </header>

      {/* MOBILE DRAWER */}

      {!onOpenMobileNav && mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">

          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-[#161F56]/40 backdrop-blur-sm"
            onClick={() =>
              setMobileOpen(false)
            }
          />

          <div className="absolute right-0 top-0 flex h-full w-[320px] max-w-[90vw] flex-col bg-white shadow-2xl">

            <div className="flex h-[82px] items-center justify-between border-b border-border px-5">

              <div className="flex items-center gap-3">

                <img
                  src="/images/ksf-logo.png"
                  alt="KSF Logo"
                  className="size-14 object-contain"
                />

                <div className="leading-tight">

                  <p className="text-sm font-semibold text-[#161F56]">
                    KSF Proposal Evaluation
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Portal
                  </p>

                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMobileOpen(false)
                }
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </button>

            </div>

            <nav className="flex-1 overflow-y-auto p-4">

              <ul className="flex flex-col gap-1">

                {desktopNavItems.map((item) => {
                  const active = isActivePath(
                    pathname,
                    item.href,
                  )

                  return (
                    <li key={item.href}>

                      <Link
                        href={item.href}
                        onClick={() =>
                          setMobileOpen(false)
                        }
                        className={cn(
                          'flex items-center rounded-md px-4 py-3 text-sm font-medium transition-colors',

                          active
                            ? 'bg-[#161F56] text-white'
                            : 'text-muted-foreground hover:bg-muted hover:text-[#161F56]',
                        )}
                      >
                        {item.label}
                      </Link>

                    </li>
                  )
                })}

              </ul>

            </nav>

          </div>

        </div>
      )}
    </>
  )
}


function HeaderIconButton({
  children,
  label,
  badge,
  darkHeader,
}: {
  children: React.ReactNode
  label: string
  badge?: boolean
  darkHeader: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'relative flex size-9 items-center justify-center rounded-md transition-all duration-300',

        darkHeader
          ? 'text-white/80 hover:bg-white/10 hover:text-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-[#161F56]',
      )}
    >
      {children}

      {badge && (
        <span
          className={cn(
            'absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500',

            darkHeader
              ? 'ring-2 ring-[#161F56]'
              : 'ring-2 ring-white',
          )}
        />
      )}

    </button>
  )
}


function MenuLink({
  icon: Icon,
  label,
  href,
  tone = 'default',
}: {
  icon: typeof User
  label: string
  href?: string
  tone?: 'default' | 'danger'
}) {
  const className = cn(
    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',

    tone === 'danger'
      ? 'text-danger hover:bg-danger-muted'
      : 'text-foreground hover:bg-muted',
  )

  const content = (
    <>
      <Icon className="size-4" />
      {label}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        role="menuitem"
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={className}
      role="menuitem"
    >
      {content}
    </button>
  )
}