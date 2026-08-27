'use client'

import { useLanguage } from '@/lib/i18n/context'

const decorativeGroups = [
  {
    main: '/images/brand-icons/pinwheel-beige.svg',
    secondary: '/images/brand-icons/circle-beige.svg',
  },
  {
    main: '/images/brand-icons/pyramid-beige.svg',
    secondary: '/images/brand-icons/triangle-beige.svg',
  },
  {
    main: '/images/brand-icons/cluster-beige.svg',
    secondary: '/images/brand-icons/diamond-beige.svg',
  },
]

export function HeroBanner() {
  const { isArabic } = useLanguage()

  return (
    <section
      className="
        relative
        w-full
        overflow-hidden
        bg-[#131B4F]
        text-white
      "
      style={{
        aspectRatio: '1741 / 350',
      }}
    >
      {/* ===================================== */}
      {/* MAIN CONTENT */}
      {/* ===================================== */}

      <div
        className="
          relative
          z-10
          flex
          h-full
          w-full
          items-center
          px-6
          pb-[145px]
          pt-10
          sm:px-8
          lg:px-12
        "
      >
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className={`
            w-full
            ${
              isArabic
                ? `
                    ml-auto
                    mr-[1%]
                    max-w-[850px]
                    text-right
                  `
                : `
                    ml-[1%]
                    mr-auto
                    max-w-[850px]
                    text-left
                  `
            }
          `}
        >
          {/* TITLE */}
          <h1
            className="
              text-2xl
              font-semibold
              leading-[1.25]
              tracking-tight
              text-white
              sm:text-3xl
              lg:text-[36px]
            "
          >
            {isArabic
              ? 'من طلب المنافسة إلى قرار أوضح'
              : 'From Procurement Request to a Clearer Decision'}
          </h1>

          {/* DESCRIPTION */}
          <p
            className={`
              mt-4
              text-sm
              leading-7
              text-white/85
              sm:text-[15px]
              lg:text-base
              ${
                isArabic
                  ? `
                      mr-0
                      ml-auto
                      max-w-[700px]
                    `
                  : `
                      ml-0
                      mr-auto
                      max-w-[760px]
                    `
              }
            `}
          >
            {isArabic
              ? 'حلّل مستندات المنافسة، قارن عروض الموردين، وراجع الامتثال والنتائج في مكان واحد.'
              : 'Analyze competition documents, compare vendor proposals, and review compliance and results in one place.'}
          </p>
        </div>
      </div>

      {/* ===================================== */}
      {/* DECORATIVE BRAND ELEMENTS */}
      {/* ===================================== */}

      <div
        className="
          absolute
          inset-x-0
          bottom-5
          z-20
          px-6
          sm:px-8
          lg:px-10
        "
      >
        <div
          className="
            flex
            w-full
            items-center
            justify-center
          "
        >
          {decorativeGroups.map((group, index) => (
            <div
              key={group.main}
              className="
                flex
                items-center
              "
            >
              {/* ICON GROUP */}
              <div
                className="
                  flex
                  shrink-0
                  items-center
                  justify-center
                  gap-5
                  px-4
                  sm:gap-6
                  sm:px-5
                  lg:gap-7
                  lg:px-6
                "
              >
                {/* LEFT SECONDARY */}
                <img
                  src={group.secondary}
                  alt=""
                  aria-hidden="true"
                  className="
                    h-[30px]
                    w-auto
                    shrink-0
                    object-contain
                    sm:h-[34px]
                    lg:h-[38px]
                  "
                />

                {/* MAIN */}
                <img
                  src={group.main}
                  alt=""
                  aria-hidden="true"
                  className="
                    h-[68px]
                    w-auto
                    shrink-0
                    object-contain
                    sm:h-[76px]
                    lg:h-[86px]
                  "
                />

                {/* RIGHT SECONDARY */}
                <img
                  src={group.secondary}
                  alt=""
                  aria-hidden="true"
                  className="
                    h-[30px]
                    w-auto
                    shrink-0
                    object-contain
                    sm:h-[34px]
                    lg:h-[38px]
                  "
                />
              </div>

              {/* CONNECTING LINES ONLY BETWEEN GROUPS */}
              {index < decorativeGroups.length - 1 && (
                <div
                  className="
                    h-px
                    w-[180px]
                    bg-[#CDB78F]/80
                    sm:w-[240px]
                    lg:w-[320px]
                  "
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}