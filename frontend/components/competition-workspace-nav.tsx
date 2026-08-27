'use client'

import {
  useEffect,
  useRef,
  useState,
} from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  ChevronDown,
  CircleHelp,
  FileText,
  GitCompareArrows,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  User,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/context'


function getEvaluationId(
  pathname: string,
) {
  const segments =
    pathname
      .split('/')
      .filter(Boolean)


  if (
    segments[0] !== 'evaluations' ||
    !segments[1] ||
    segments[1] === 'new'
  ) {
    return null
  }


  return segments[1]
}


function isWorkspaceActive(
  pathname: string,
  basePath: string,
  section: string,
) {
  if (
    section === 'overview'
  ) {
    return (
      pathname === basePath ||
      pathname.startsWith(
        `${basePath}/vendors/`,
      )
    )
  }


  return pathname.startsWith(
    `${basePath}/${section}`,
  )
}


export function CompetitionWorkspaceNav() {
  const pathname =
    usePathname()


  const {
    t,
    language,
    toggleLanguage,
    isArabic,
  } =
    useLanguage()


  const evaluationId =
    getEvaluationId(
      pathname,
    )


  const [
    menuOpen,
    setMenuOpen,
  ] =
    useState(false)


  const [
    mobileOpen,
    setMobileOpen,
  ] =
    useState(false)


  const menuRef =
    useRef<HTMLDivElement>(null)


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


  if (
    !evaluationId
  ) {
    return null
  }


  const basePath =
    `/evaluations/${evaluationId}`


  const BackIcon =
    isArabic
      ? ArrowRight
      : ArrowLeft


  const navItems = [
    {
      label:
        isArabic
          ? 'سجل المنافسات'
          : 'Competition History',

      href:
        '/evaluations',

      section:
        'history',

      icon:
        BackIcon,

      width:
        'min-w-[145px]',

      isBack:
        true,
    },

    {
      label:
        isArabic
          ? 'نظرة عامة'
          : 'Overview',

      href:
        basePath,

      section:
        'overview',

      icon:
        LayoutDashboard,

      width:
        'min-w-[130px]',
    },

    {
      label:
        isArabic
          ? 'إطار المنافسة'
          : 'RFP Framework',

      href:
        `${basePath}/rfp`,

      section:
        'rfp',

      icon:
        FileText,

      width:
        'min-w-[145px]',
    },

    {
      label:
        isArabic
          ? 'مقارنة الموردين'
          : 'Vendor Comparison',

      href:
        `${basePath}/comparison`,

      section:
        'comparison',

      icon:
        GitCompareArrows,

      width:
        'min-w-[160px]',
    },

    {
      label:
        isArabic
          ? 'الامتثال'
          : 'Compliance',

      href:
        `${basePath}/compliance`,

      section:
        'compliance',

      icon:
        ShieldCheck,

      width:
        'min-w-[115px]',
    },

    {
      label:
        isArabic
          ? 'التقرير النهائي'
          : 'Final Report',

      href:
        `${basePath}/report`,

      section:
        'report',

      icon:
        BarChart3,

      width:
        'min-w-[140px]',
    },
  ]


  return (
    <>
      {/* ========================================== */}
      {/* HEADER */}
      {/* ========================================== */}

      <header
        className="
          sticky
          top-0
          z-40
          w-full
          bg-white/95
          shadow-sm
          backdrop-blur-xl
        "
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
          dir={
            isArabic
              ? 'rtl'
              : 'ltr'
          }
        >

          {/* ====================================== */}
          {/* KSF LOGO */}
          {/* ====================================== */}

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
              src="/images/ksf-logo-blue.png"
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


          {/* ====================================== */}
          {/* DESKTOP NAVIGATION */}
          {/* ====================================== */}

          <nav
            className="
              hidden
              min-w-0
              flex-1
              items-center
              justify-center

              lg:flex
            "
          >

            <div
              className="
                flex
                min-w-0
                items-center
                gap-2
              "
            >

              {navItems.map(
                (
                  item,
                ) => {

                  const Icon =
                    item.icon


                  const active =
                    item.section === 'history'
                      ? false
                      : isWorkspaceActive(
                          pathname,
                          basePath,
                          item.section,
                        )


                  return (
                    <Link
                      key={
                        item.href
                      }
                      href={
                        item.href
                      }
                      className={cn(
                        `
                          flex
                          items-center
                          justify-center
                          gap-2
                          whitespace-nowrap
                          rounded-xl
                          px-4
                          py-3
                          text-[13px]
                          font-medium
                          leading-none
                          transition-all
                          duration-200
                          ease-out
                        `,

                        item.width,

                        item.isBack
                          ? `
                              text-[#131B4F]

                              hover:-translate-y-[1px]
                              hover:bg-[#F7F4EE]
                            `
                          : active
                            ? `
                                bg-[#131B4F]
                                text-white
                                shadow-[0_6px_18px_rgba(19,27,79,0.18)]
                              `
                            : `
                                text-slate-600

                                hover:-translate-y-[1px]
                                hover:bg-[#F7F4EE]
                                hover:text-[#131B4F]
                              `,
                      )}
                    >

                      <Icon
                        className="
                          size-4
                          shrink-0
                        "
                      />


                      <span>
                        {item.label}
                      </span>

                    </Link>
                  )
                },
              )}

            </div>

          </nav>


          {/* ====================================== */}
          {/* RIGHT SIDE */}
          {/* ====================================== */}

          <div
            className="
              ms-auto
              flex
              shrink-0
              items-center
              gap-1
            "
          >

            {/* LANGUAGE */}

            <button
              type="button"
              onClick={
                toggleLanguage
              }
              className="
                me-1
                flex
                items-center
                gap-2
                rounded-lg
                px-3
                py-2
                text-sm
                font-medium
                text-slate-600
                transition-all
                duration-200

                hover:bg-[#F7F4EE]
                hover:text-[#131B4F]
              "
              aria-label={
                t.common.language
              }
              title={
                t.common.language
              }
            >

              <Languages
                className="
                  size-4
                "
              />


              <span
                className="
                  hidden

                  sm:inline
                "
              >
                {language === 'en'
                  ? 'العربية'
                  : 'English'}
              </span>

            </button>


            {/* NOTIFICATIONS */}

            <HeaderIconButton
              label={
                t.header.notifications
              }
              badge
            >

              <Bell
                className="
                  size-5
                "
              />

            </HeaderIconButton>


            {/* ==================================== */}
            {/* USER */}
            {/* ==================================== */}

            <div
              className="
                relative
                ms-1
              "
              ref={
                menuRef
              }
            >

              <button
                type="button"
                onClick={
                  () =>
                    setMenuOpen(
                      (
                        value,
                      ) =>
                        !value,
                    )
                }
                className="
                  flex
                  items-center
                  gap-1.5
                  rounded-lg
                  p-1
                  transition-all
                  duration-200

                  hover:bg-[#F7F4EE]
                "
                aria-haspopup="menu"
                aria-expanded={
                  menuOpen
                }
              >

                <span
                  className="
                    flex
                    size-11
                    items-center
                    justify-center
                    rounded-full
                    bg-[#131B4F]
                    text-sm
                    font-semibold
                    text-white
                  "
                >
                  NA
                </span>


                <ChevronDown
                  className="
                    hidden
                    size-3.5
                    text-slate-500

                    md:block
                  "
                />

              </button>


              {/* USER MENU */}

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

                  <div
                    className="
                      border-b
                      border-border
                      p-4
                    "
                  >

                    <p
                      className="
                        text-sm
                        font-semibold
                        text-foreground
                      "
                    >
                      {
                        t.header.userName
                      }
                    </p>


                    <p
                      className="
                        mt-0.5
                        text-xs
                        text-muted-foreground
                      "
                    >
                      {
                        t.header.userRole
                      }
                    </p>

                  </div>


                  <div className="p-2">

                    <MenuLink
                      icon={
                        User
                      }
                      label={
                        t.header.profile
                      }
                    />


                    <MenuLink
                      icon={
                        Settings
                      }
                      label={
                        t.header.settings
                      }
                      href="/settings"
                    />


                    <MenuLink
                      icon={
                        CircleHelp
                      }
                      label={
                        t.header.helpSupport
                      }
                    />

                  </div>


                  <div
                    className="
                      border-t
                      border-border
                      p-2
                    "
                  >

                    <MenuLink
                      icon={
                        LogOut
                      }
                      label={
                        t.header.signOut
                      }
                      tone="danger"
                    />

                  </div>

                </div>
              )}

            </div>


            {/* MOBILE */}

            <button
              type="button"
              onClick={
                () =>
                  setMobileOpen(
                    true,
                  )
              }
              className="
                flex
                size-9
                items-center
                justify-center
                rounded-lg
                text-[#131B4F]
                transition-colors

                hover:bg-[#F7F4EE]

                lg:hidden
              "
              aria-label={
                t.header.openNavigation
              }
            >

              <Menu
                className="
                  size-5
                "
              />

            </button>

          </div>

        </div>

      </header>


      {/* ========================================== */}
      {/* MOBILE DRAWER */}
      {/* ========================================== */}

      {mobileOpen && (
        <div
          className="
            fixed
            inset-0
            z-50

            lg:hidden
          "
        >

          <button
            type="button"
            aria-label={
              t.header.closeNavigation
            }
            className="
              absolute
              inset-0
              bg-[#131B4F]/40
              backdrop-blur-sm
            "
            onClick={
              () =>
                setMobileOpen(
                  false,
                )
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
                onClick={
                  () =>
                    setMobileOpen(
                      false,
                    )
                }
                className="
                  flex
                  min-w-0
                  flex-1
                  items-center
                "
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
                onClick={
                  () =>
                    setMobileOpen(
                      false,
                    )
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

                  hover:bg-muted
                  hover:text-foreground
                "
              >

                <X
                  className="
                    size-5
                  "
                />

              </button>

            </div>


            {/* MOBILE NAVIGATION */}

            <nav
              className="
                flex-1
                overflow-y-auto
                p-4
              "
            >

              <ul
                className="
                  flex
                  flex-col
                  gap-2
                "
              >

                {navItems.map(
                  (
                    item,
                  ) => {

                    const Icon =
                      item.icon


                    const active =
                      item.section === 'history'
                        ? false
                        : isWorkspaceActive(
                            pathname,
                            basePath,
                            item.section,
                          )


                    return (
                      <li
                        key={
                          item.href
                        }
                      >

                        <Link
                          href={
                            item.href
                          }
                          onClick={
                            () =>
                              setMobileOpen(
                                false,
                              )
                          }
                          className={cn(
                            `
                              flex
                              items-center
                              gap-3
                              rounded-lg
                              px-4
                              py-3
                              text-sm
                              font-medium
                              transition-all
                            `,

                            item.isBack
                              ? `
                                  bg-[#F7F4EE]
                                  text-[#131B4F]
                                `
                              : active
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

                          <Icon
                            className="
                              size-4
                            "
                          />


                          {
                            item.label
                          }

                        </Link>

                      </li>
                    )
                  },
                )}

              </ul>


              <div
                className="
                  mt-5
                  border-t
                  border-border
                  pt-4
                "
              >

                <button
                  type="button"
                  onClick={
                    () => {
                      toggleLanguage()

                      setMobileOpen(
                        false,
                      )
                    }
                  }
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

                    hover:bg-[#F7F4EE]
                    hover:text-[#131B4F]
                  "
                >

                  <Languages
                    className="
                      size-4
                    "
                  />


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
}: {
  children: React.ReactNode
  label: string
  badge?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={
        label
      }
      className="
        relative
        flex
        size-9
        items-center
        justify-center
        rounded-lg
        text-slate-500
        transition-all
        duration-300

        hover:bg-[#F7F4EE]
        hover:text-[#131B4F]
      "
    >

      {children}


      {badge && (
        <span
          className="
            absolute
            right-1.5
            top-1.5
            size-2
            rounded-full
            bg-red-500
            ring-2
            ring-white
          "
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
  const className =
    cn(
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
      <Icon
        className="
          size-4
        "
      />

      {label}
    </>
  )


  if (
    href
  ) {
    return (
      <Link
        href={
          href
        }
        className={
          className
        }
        role="menuitem"
      >
        {content}
      </Link>
    )
  }


  return (
    <button
      type="button"
      className={
        className
      }
      role="menuitem"
    >
      {content}
    </button>
  )
}