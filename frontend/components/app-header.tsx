'use client'

import {
  useEffect,
  useRef,
  useState,
} from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Bell,
  ChevronDown,
  CircleHelp,
  Languages,
  LogOut,
  Menu,
  Settings,
  User,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/context'


interface AppHeaderProps {
  onOpenMobileNav?: () => void
}


function isActivePath(
  pathname: string,
  href: string,
) {
  if (href === '/') {
    return pathname === '/'
  }

  if (href === '/evaluations/new') {
    return pathname === '/evaluations/new'
  }

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

  const {
    t,
    language,
    toggleLanguage,
    isArabic,
  } = useLanguage()

  const isHome = pathname === '/'

  const [menuOpen, setMenuOpen] =
    useState(false)

  const [mobileOpen, setMobileOpen] =
    useState(false)

  const [isScrolled, setIsScrolled] =
    useState(false)

  const menuRef =
    useRef<HTMLDivElement>(null)


  const desktopNavItems = [
    {
      label: t.header.home,
      href: '/',
      width: 'min-w-[140px]',
    },
    {
      label: t.header.newEvaluation,
      href: '/evaluations/new',
      width: 'min-w-[170px]',
    },
    {
      label: t.header.evaluations,
      href: '/evaluations',
      width: 'min-w-[155px]',
    },
  ]


  useEffect(() => {
    const handleScroll = () => {
      if (isHome) {
        setIsScrolled(
          window.scrollY > 20,
        )
      } else {
        setIsScrolled(true)
      }
    }

    handleScroll()

    window.addEventListener(
      'scroll',
      handleScroll,
      {
        passive: true,
      },
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
        !menuRef.current.contains(
          event.target as Node,
        )
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


  const darkHeader =
    isHome &&
    !isScrolled


  return (
    <>
      <header
        className={cn(
          `
            sticky
            top-0
            z-40
            w-full
            transition-all
            duration-300
          `,
          darkHeader
            ? 'bg-[#131B4F]'
            : 'bg-white/95 shadow-sm backdrop-blur-xl',
        )}
      >

        <div
          className="
            mx-auto
            flex
            h-[84px]
            w-full
            items-center
            gap-3
            px-6
            lg:px-8
          "
          dir={isArabic ? 'rtl' : 'ltr'}
        >

          {/* ========================================== */}
          {/* BRAND / KSF LOGO */}
          {/* ========================================== */}

          <Link
            href="/"
            className="
              flex
              shrink-0
              items-center
            "
            aria-label="King Salman Foundation"
          >

            <img
              src={
                darkHeader
                  ? '/images/ksf-logo-white.png'
                  : '/images/ksf-logo-blue.png'
              }
              alt="King Salman Foundation"
              className="
                h-[54px]
                w-auto
                max-w-[235px]
                shrink-0
                object-contain
                sm:h-[58px]
                lg:h-[60px]
                lg:max-w-[255px]
              "
            />

          </Link>


          {/* ========================================== */}
          {/* DESKTOP NAV */}
          {/* ========================================== */}

          <nav className="hidden min-w-0 flex-1 items-center justify-center lg:flex">

            <div className="flex min-w-0 items-center gap-3">

              {desktopNavItems.map(
                (item) => {
                  const active =
                    isActivePath(
                      pathname,
                      item.href,
                    )

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        `
                          flex
                          items-center
                          justify-center
                          whitespace-nowrap
                          rounded-xl
                          px-6
                          py-3
                          text-[14px]
                          font-medium
                          leading-none
                          transition-all
                          duration-200
                          ease-out
                        `,
                        item.width,
                        active
                          ? darkHeader
                            ? `
                                bg-white/15
                                text-white
                                shadow-sm
                              `
                            : `
                                bg-[#131B4F]
                                text-white
                                shadow-[0_6px_18px_rgba(19,27,79,0.18)]
                              `
                          : darkHeader
                            ? `
                                text-white/80
                                hover:-translate-y-[1px]
                                hover:bg-white/10
                                hover:text-white
                              `
                            : `
                                text-slate-600
                                hover:-translate-y-[1px]
                                hover:bg-[#F7F4EE]
                                hover:text-[#131B4F]
                              `,
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                },
              )}

            </div>

          </nav>


          {/* ========================================== */}
          {/* RIGHT SIDE */}
          {/* ========================================== */}

          <div className="ms-auto flex shrink-0 items-center gap-1">

            {/* LANGUAGE BUTTON */}

            <button
              type="button"
              onClick={toggleLanguage}
              className={cn(
                `
                  me-1
                  flex
                  items-center
                  gap-2
                  rounded-lg
                  px-3
                  py-2
                  text-sm
                  font-medium
                  transition-all
                  duration-200
                `,
                darkHeader
                  ? `
                      text-white/85
                      hover:bg-white/10
                      hover:text-white
                    `
                  : `
                      text-slate-600
                      hover:bg-[#F7F4EE]
                      hover:text-[#131B4F]
                    `,
              )}
              aria-label={t.common.language}
              title={t.common.language}
            >
              <Languages className="size-4" />

              <span className="hidden sm:inline">
                {language === 'en'
                  ? 'العربية'
                  : 'English'}
              </span>
            </button>


            <HeaderIconButton
              label={t.header.notifications}
              badge
              darkHeader={darkHeader}
            >
              <Bell className="size-5" />
            </HeaderIconButton>


            {/* ======================================== */}
            {/* USER */}
            {/* ======================================== */}

            <div
              className="relative ms-1"
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
                  `
                    flex
                    items-center
                    gap-1.5
                    rounded-lg
                    p-1
                    transition-all
                    duration-200
                  `,
                  darkHeader
                    ? 'hover:bg-white/10'
                    : 'hover:bg-[#F7F4EE]',
                )}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >

                <span
                  className={cn(
                    `
                      flex
                      size-11
                      items-center
                      justify-center
                      rounded-full
                      text-sm
                      font-semibold
                      transition-all
                    `,
                    darkHeader
                      ? `
                          bg-white
                          text-[#131B4F]
                        `
                      : `
                          bg-[#131B4F]
                          text-white
                        `,
                  )}
                >
                  NA
                </span>


                <ChevronDown
                  className={cn(
                    `
                      hidden
                      size-3.5
                      md:block
                    `,
                    darkHeader
                      ? 'text-white/70'
                      : 'text-slate-500',
                  )}
                />

              </button>


              {/* ====================================== */}
              {/* USER MENU */}
              {/* ====================================== */}

              {menuOpen && (
                <div
                  role="menu"
                  className={cn(
                    `
                      absolute
                      top-[calc(100%+10px)]
                      w-60
                      overflow-hidden
                      rounded-xl
                      border
                      border-border
                      bg-white
                      shadow-[0_16px_40px_rgba(19,27,79,0.15)]
                    `,
                    isArabic
                      ? 'left-0'
                      : 'right-0',
                  )}
                >

                  <div className="border-b border-border p-4">

                    <p className="text-sm font-semibold text-foreground">
                      {t.header.userName}
                    </p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.header.userRole}
                    </p>

                  </div>


                  <div className="p-2">

                    <MenuLink
                      icon={User}
                      label={t.header.profile}
                    />

                    <MenuLink
                      icon={Settings}
                      label={t.header.settings}
                      href="/settings"
                    />

                    <MenuLink
                      icon={CircleHelp}
                      label={t.header.helpSupport}
                    />

                  </div>


                  <div className="border-t border-border p-2">

                    <MenuLink
                      icon={LogOut}
                      label={t.header.signOut}
                      tone="danger"
                    />

                  </div>

                </div>
              )}

            </div>


            {/* ======================================== */}
            {/* MOBILE MENU BUTTON */}
            {/* ======================================== */}

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
                `
                  flex
                  size-9
                  items-center
                  justify-center
                  rounded-lg
                  transition-colors
                  lg:hidden
                `,
                darkHeader
                  ? `
                      text-white
                      hover:bg-white/10
                    `
                  : `
                      text-[#131B4F]
                      hover:bg-[#F7F4EE]
                    `,
              )}
              aria-label={t.header.openNavigation}
            >
              <Menu className="size-5" />
            </button>

          </div>

        </div>

      </header>


      {/* ========================================== */}
      {/* MOBILE DRAWER */}
      {/* ========================================== */}

      {!onOpenMobileNav &&
        mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">

            <button
              type="button"
              aria-label={t.header.closeNavigation}
              className="
                absolute
                inset-0
                bg-[#131B4F]/40
                backdrop-blur-sm
              "
              onClick={() =>
                setMobileOpen(false)
              }
            />


            <div
              className={cn(
                `
                  absolute
                  top-0
                  flex
                  h-full
                  w-[320px]
                  max-w-[90vw]
                  flex-col
                  bg-white
                  shadow-2xl
                `,
                isArabic
                  ? 'left-0'
                  : 'right-0',
              )}
            >

              {/* MOBILE HEADER */}

              <div
                className="
                  flex
                  min-h-[96px]
                  items-center
                  justify-between
                  border-b
                  border-border
                  px-5
                  py-3
                "
              >

                <Link
                  href="/"
                  onClick={() =>
                    setMobileOpen(false)
                  }
                  className="
                    flex
                    min-w-0
                    flex-1
                    items-center
                  "
                  aria-label="King Salman Foundation"
                >

                  <img
                    src="/images/ksf-logo-blue.png"
                    alt="King Salman Foundation"
                    className="
                      h-[58px]
                      w-auto
                      max-w-[220px]
                      object-contain
                    "
                  />

                </Link>


                <button
                  type="button"
                  onClick={() =>
                    setMobileOpen(false)
                  }
                  className="
                    ms-2
                    flex
                    size-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    text-muted-foreground
                    transition-colors
                    hover:bg-muted
                    hover:text-foreground
                  "
                  aria-label={t.header.closeNavigation}
                >
                  <X className="size-5" />
                </button>

              </div>


              {/* MOBILE NAV */}

              <nav className="flex-1 overflow-y-auto p-4">

                <ul className="flex flex-col gap-2">

                  {desktopNavItems.map(
                    (item) => {
                      const active =
                        isActivePath(
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
                              `
                                flex
                                items-center
                                rounded-lg
                                px-4
                                py-3
                                text-sm
                                font-medium
                                transition-all
                                duration-200
                              `,
                              active
                                ? `
                                    bg-[#131B4F]
                                    text-white
                                  `
                                : `
                                    text-muted-foreground
                                    hover:bg-[#F7F4EE]
                                    hover:text-[#131B4F]
                                  `,
                            )}
                          >
                            {item.label}
                          </Link>

                        </li>
                      )
                    },
                  )}

                </ul>


                <div className="mt-4 border-t border-border pt-4">

                  <button
                    type="button"
                    onClick={() => {
                      toggleLanguage()
                      setMobileOpen(false)
                    }}
                    className="
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-lg
                      px-4
                      py-3
                      text-sm
                      font-medium
                      text-muted-foreground
                      transition-colors
                      hover:bg-[#F7F4EE]
                      hover:text-[#131B4F]
                    "
                  >
                    <Languages className="size-4" />

                    {language === 'en'
                      ? 'العربية'
                      : 'English'}
                  </button>

                </div>

              </nav>

            </div>

          </div>
        )}

    </>
  )
}


/* ========================================== */
/* HEADER ICON BUTTON */
/* ========================================== */

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
        `
          relative
          flex
          size-9
          items-center
          justify-center
          rounded-lg
          transition-all
          duration-300
        `,
        darkHeader
          ? `
              text-white/80
              hover:bg-white/10
              hover:text-white
            `
          : `
              text-slate-500
              hover:bg-[#F7F4EE]
              hover:text-[#131B4F]
            `,
      )}
    >

      {children}


      {badge && (
        <span
          className={cn(
            `
              absolute
              right-1.5
              top-1.5
              size-2
              rounded-full
              bg-red-500
            `,
            darkHeader
              ? 'ring-2 ring-[#131B4F]'
              : 'ring-2 ring-white',
          )}
        />
      )}

    </button>
  )
}


/* ========================================== */
/* MENU LINK */
/* ========================================== */

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
    `
      flex
      w-full
      items-center
      gap-2.5
      rounded-lg
      px-3
      py-2
      text-sm
      font-medium
      transition-colors
    `,
    tone === 'danger'
      ? `
          text-danger
          hover:bg-danger-muted
        `
      : `
          text-foreground
          hover:bg-muted
        `,
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