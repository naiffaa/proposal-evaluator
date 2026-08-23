'use client'

import Link from 'next/link'

import { useLanguage } from '@/lib/i18n/context'


export function Footer() {
  const {
    isArabic,
  } = useLanguage()


  const quickLinks = isArabic
    ? [
        {
          label: 'الرئيسية',
          href: '/',
        },
        {
          label: 'تقييم جديد',
          href: '/evaluations/new',
        },
        {
          label: 'التقييمات',
          href: '/evaluations',
        },
      ]
    : [
        {
          label: 'Home',
          href: '/',
        },
        {
          label: 'New Evaluation',
          href: '/evaluations/new',
        },
        {
          label: 'Evaluations',
          href: '/evaluations',
        },
      ]


  const resourceLinks = isArabic
    ? [
        {
          label: 'المساعدة والدعم',
          href: '#',
        },
        {
          label: 'الإعدادات',
          href: '/settings',
        },
      ]
    : [
        {
          label: 'Help & Support',
          href: '#',
        },
        {
          label: 'Settings',
          href: '/settings',
        },
      ]


  return (
    <footer
      dir={isArabic ? 'rtl' : 'ltr'}
      className="
        relative
        overflow-hidden
        bg-[#131B4F]
        text-white
      "
    >

      {/* TOP LINE */}

      <div className="h-px w-full bg-[#CDB78F]/45" />


      {/* MAIN FOOTER */}

      <div
        className="
          mx-auto
          grid
          w-full
          max-w-[1500px]
          gap-8
          px-6
          py-8
          sm:px-8
          md:grid-cols-[1.5fr_0.8fr_0.8fr]
          lg:px-12
          lg:py-9
        "
      >

        {/* BRAND */}

        <div className="max-w-[500px]">

          <Link
            href="/"
            aria-label="King Salman Foundation"
            className="inline-flex"
          >
            <img
              src="/images/ksf-logo-white.png"
              alt="King Salman Foundation"
              className="
                h-[56px]
                w-auto
                object-contain
              "
            />
          </Link>


          <h2
            className="
              mt-4
              text-base
              font-semibold
              text-white
            "
          >
            {isArabic
              ? 'بوابة تقييم العروض'
              : 'KSF Proposal Evaluation Portal'}
          </h2>


          <p
            className="
              mt-2
              max-w-[460px]
              text-sm
              leading-6
              text-white/65
            "
          >
            {isArabic
              ? 'منصة مدعومة بالذكاء الاصطناعي لدعم تقييم طلبات العروض وطلبات الأسعار وطلبات المعلومات وعروض الموردين.'
              : 'AI-assisted procurement evaluation for RFPs, RFQs, RFIs, and vendor submissions.'}
          </p>

        </div>


        {/* QUICK LINKS */}

        <div>

          <h3
            className="
              text-sm
              font-semibold
              text-[#CDB78F]
            "
          >
            {isArabic
              ? 'روابط سريعة'
              : 'Quick Links'}
          </h3>


          <nav
            className="
              mt-4
              flex
              flex-col
              gap-2.5
            "
          >
            {quickLinks.map(
              (item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="
                    w-fit
                    text-sm
                    text-white/70
                    transition-colors
                    duration-200
                    hover:text-white
                  "
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

        </div>


        {/* RESOURCES */}

        <div>

          <h3
            className="
              text-sm
              font-semibold
              text-[#CDB78F]
            "
          >
            {isArabic
              ? 'الموارد'
              : 'Resources'}
          </h3>


          <nav
            className="
              mt-4
              flex
              flex-col
              gap-2.5
            "
          >
            {resourceLinks.map(
              (item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="
                    w-fit
                    text-sm
                    text-white/70
                    transition-colors
                    duration-200
                    hover:text-white
                  "
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

        </div>

      </div>

    </footer>
  )
}