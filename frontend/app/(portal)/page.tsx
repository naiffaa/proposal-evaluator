'use client'

import Link from 'next/link'

import {
  ArrowRight,
  FileText,
  GitCompareArrows,
  ListChecks,
  Plus,
  ShieldCheck,
} from 'lucide-react'

import { HeroBanner } from '@/components/hero-banner'
import { useLanguage } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'


export default function HomePage() {
  const {
    isArabic,
  } = useLanguage()


  const quickAccess = [
    {
      number: '01',

      title: isArabic
        ? 'سجل المنافسات'
        : 'Competition History',

      description: isArabic
        ? 'ارجع للمنافسات الحالية والسابقة وتابع حالتها ونتائجها.'
        : 'Review current and previous competitions, their status, and results.',

      href:
        '/evaluations',

      icon:
        ListChecks,
    },

    {
      number: '02',

      title: isArabic
        ? 'متطلبات المنافسة'
        : 'Competition Requirements',

      description: isArabic
        ? 'راجع المعايير والأوزان والمتطلبات المستخرجة من مستند المنافسة.'
        : 'Review criteria, weights, and requirements extracted from the competition document.',

      href:
        '/rfp-analysis',

      icon:
        FileText,
    },

    {
      number: '03',

      title: isArabic
        ? 'مقارنة الموردين'
        : 'Vendor Comparison',

      description: isArabic
        ? 'قارن ترتيب الموردين ودرجاتهم والامتثال وأبرز الفروقات.'
        : 'Compare vendor ranking, scores, compliance, and key differences.',

      href:
        '/comparison',

      icon:
        GitCompareArrows,
    },

    {
      number: '04',

      title: isArabic
        ? 'مراجعة الامتثال'
        : 'Compliance Review',

      description: isArabic
        ? 'راجع المتطلبات الإلزامية والحالات التي تحتاج مراجعة إضافية.'
        : 'Review mandatory requirements and cases that need further attention.',

      href:
        '/compliance',

      icon:
        ShieldCheck,
    },
  ]


  return (
    <div
      className="
        w-full
        overflow-x-hidden
        bg-[#F7F3E9]
      "
    >

      {/* ========================================= */}
      {/* HERO */}
      {/* ========================================= */}

      <HeroBanner />


      {/* ========================================= */}
      {/* QUICK ACCESS */}
      {/* ========================================= */}

      <section
        className="
          bg-white
          px-5
          py-20

          sm:px-8
          sm:py-24

          lg:px-12
          lg:py-24

          xl:px-16
        "
      >

        <div
          className="
            mx-auto
            max-w-[1500px]
          "
        >

          {/* HEADER */}

          <div
            className="
              flex
              flex-col
              gap-5

              lg:flex-row
              lg:items-end
              lg:justify-between
            "
          >

            <div>

              <p
                className="
                  text-[11px]
                  font-semibold
                  tracking-[0.16em]
                  text-[#9466C4]
                "
              >
                {isArabic
                  ? 'الوصول السريع'
                  : 'QUICK ACCESS'}
              </p>


              <h2
                className="
                  mt-4
                  max-w-[760px]
                  text-[clamp(34px,4vw,56px)]
                  font-medium
                  leading-[1.06]
                  tracking-[-0.04em]
                  text-[#131B4F]
                "
              >
                {isArabic
                  ? 'كل اللي تحتاجه لمتابعة المنافسة'
                  : 'Everything you need to follow the competition'}
              </h2>

            </div>


            <p
              className="
                max-w-[500px]
                text-sm
                leading-7
                text-[#65708D]

                sm:text-base
              "
            >
              {isArabic
                ? 'انتقل مباشرة للجزء اللي تحتاجه من المنافسة بدون ما ترجع لكل الخطوات.'
                : 'Go directly to the part of the competition you need without repeating the full journey.'}
            </p>

          </div>


          {/* ===================================== */}
          {/* FOUR CARDS */}
          {/* ===================================== */}

          <div
            className="
              mt-12
              grid
              gap-4

              sm:grid-cols-2

              xl:grid-cols-4
            "
          >

            {quickAccess.map(
              (
                item,
              ) => {

                const Icon =
                  item.icon


                return (
                  <Link
                    key={
                      item.title
                    }
                    href={
                      item.href
                    }
                    className="
                      group
                      block
                      h-full
                    "
                  >

                    <article
                      className="
                        relative
                        flex
                        h-full
                        min-h-[240px]
                        flex-col
                        overflow-hidden
                        border
                        border-[#E2E5ED]
                        bg-white
                        p-6
                        transition-all
                        duration-300

                        hover:-translate-y-1
                        hover:border-[#131B4F]/25
                        hover:shadow-[0_16px_40px_rgba(19,27,79,0.09)]

                        lg:min-h-[255px]
                      "
                    >

                      {/* TOP ACCENT */}

                      <div
                        className="
                          absolute
                          inset-x-0
                          top-0
                          h-[3px]
                          origin-right
                          scale-x-0
                          bg-[#131B4F]
                          transition-transform
                          duration-500

                          group-hover:scale-x-100
                        "
                      />


                      {/* TOP ROW */}

                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-4
                        "
                      >

                        <div
                          className="
                            flex
                            size-11
                            items-center
                            justify-center
                            bg-[#F4F5F8]
                            text-[#131B4F]
                            transition-all
                            duration-300

                            group-hover:bg-[#131B4F]
                            group-hover:text-white
                          "
                        >

                          <Icon
                            className="
                              size-5
                            "
                          />

                        </div>


                        <span
                          className="
                            text-[11px]
                            font-semibold
                            text-[#131B4F]/30
                          "
                        >
                          {item.number}
                        </span>

                      </div>


                      {/* COPY */}

                      <div
                        className="
                          mt-8
                        "
                      >

                        <h3
                          className="
                            text-[20px]
                            font-medium
                            leading-[1.2]
                            text-[#131B4F]

                            lg:text-[21px]
                          "
                        >
                          {item.title}
                        </h3>


                        <p
                          className="
                            mt-3
                            text-sm
                            leading-6
                            text-[#65708D]
                          "
                        >
                          {item.description}
                        </p>

                      </div>


                      {/* ARROW */}

                      <div
                        className="
                          mt-auto
                          flex
                          justify-end
                          pt-6
                        "
                      >

                        <div
                          className="
                            flex
                            size-8
                            items-center
                            justify-center
                            text-[#131B4F]
                          "
                        >

                          <ArrowRight
                            className={cn(
                              `
                                size-4
                                transition-transform
                                duration-300
                              `,

                              isArabic
                                ? 'rotate-180 group-hover:-translate-x-1'
                                : 'group-hover:translate-x-1',
                            )}
                          />

                        </div>

                      </div>

                    </article>

                  </Link>
                )
              },
            )}

          </div>

        </div>

      </section>


      {/* ========================================= */}
      {/* HOW IT WORKS INTRO */}
      {/* ========================================= */}

      <section
        className="
          bg-[#F7F3E9]
          px-5
          py-20

          sm:px-8
          sm:py-24

          lg:px-12
          lg:py-28

          xl:px-16
        "
      >

        <div
          className="
            mx-auto
            flex
            max-w-[1050px]
            flex-col
            items-center
            text-center
          "
        >

          {/* EYEBROW */}

          <p
            className="
              text-[11px]
              font-semibold
              tracking-[0.16em]
              text-[#9466C4]
            "
          >
            {isArabic
              ? 'ابدأ من هنا'
              : 'START HERE'}
          </p>


          {/* TITLE */}

          <h2
            className="
              mt-4
              max-w-[900px]
              text-[clamp(38px,4.6vw,66px)]
              font-medium
              leading-[1.05]
              tracking-[-0.04em]
              text-[#131B4F]
            "
          >
            {isArabic
              ? 'اعرف كيف تستخدم النظام من البداية للنهاية'
              : 'See how the system works from start to finish'}
          </h2>


          {/* DESCRIPTION */}

          <p
            className="
              mt-6
              max-w-[760px]
              text-base
              leading-8
              text-[#65708D]

              sm:text-lg
            "
          >
            {isArabic
              ? 'من رفع مستند المنافسة وعروض الموردين، إلى تحليل المتطلبات والمقارنة ومراجعة النتيجة. استعرض رحلة البوابة كاملة بخطوات واضحة.'
              : 'From uploading the competition document and vendor proposals to requirement analysis, comparison, and final review. Explore the full portal journey step by step.'}
          </p>


          {/* HOW IT WORKS BUTTON */}

          <Link
            href="/how-it-works"
            className="
              group
              relative
              mt-9
              inline-flex
              h-[54px]
              cursor-pointer
              items-center
              justify-center
              overflow-hidden
              rounded-sm
              bg-[#131B4F]
              px-7
              text-sm
              font-medium
              tracking-[-0.02em]
              text-white
            "
          >

            <span
              className="
                relative
                z-20
                transition-[transform,color]
                duration-300
                ease-out

                group-hover:-translate-y-0.5
                group-hover:text-[#131B4F]
              "
            >
              {isArabic
                ? 'كيف تعمل البوابة'
                : 'How the Portal Works'}
            </span>


            <ArrowRight
              className={cn(
                `
                  relative
                  z-20
                  ms-3
                  size-4
                  transition-[transform,color]
                  duration-300
                  ease-out

                  group-hover:text-[#131B4F]
                `,

                isArabic
                  ? `
                      rotate-180
                      group-hover:-translate-x-1
                    `
                  : `
                      group-hover:translate-x-1
                    `,
              )}
            />


            {/* WHITE SWEEP */}

            <div
              className="
                absolute
                inset-0
                z-10
                h-full
                w-full
                origin-center
                translate-y-[200%]
                rotate-[15deg]
                scale-[1.8]
                rounded-lg
                bg-white
                transition-transform
                duration-1000
                ease-out

                group-hover:translate-y-0
                group-hover:rotate-[8deg]
              "
            />

          </Link>

        </div>

      </section>


      {/* ========================================= */}
      {/* ADD COMPETITION CTA */}
      {/* ========================================= */}

      <section
        className="
          bg-white
          px-5
          py-20

          sm:px-8
          sm:py-24

          lg:px-12
          lg:py-28

          xl:px-16
        "
      >

        <div
          className="
            mx-auto
            max-w-[1500px]
            overflow-hidden
            bg-[#131B4F]
          "
        >

          <div
            className="
              grid
              items-center
              gap-8
              px-7
              py-10

              sm:px-10
              sm:py-12

              lg:grid-cols-[1fr_auto]
              lg:px-14
            "
          >

            <div
              className="
                flex
                items-start
                gap-5
              "
            >

              <div
                className="
                  hidden
                  size-12
                  shrink-0
                  items-center
                  justify-center
                  bg-white/10
                  text-[#CDB78F]

                  sm:flex
                "
              >

                <Plus
                  className="
                    size-5
                  "
                />

              </div>


              <div>

                <p
                  className="
                    text-[10px]
                    font-semibold
                    tracking-[0.14em]
                    text-[#CDB78F]
                  "
                >
                  {isArabic
                    ? 'منافسة جديدة'
                    : 'NEW COMPETITION'}
                </p>


                <h3
                  className="
                    mt-3
                    text-[27px]
                    font-medium
                    leading-[1.15]
                    text-white

                    sm:text-[32px]
                  "
                >
                  {isArabic
                    ? 'ابدأ تقييم المنافسة القادمة'
                    : 'Start evaluating the next competition'}
                </h3>


                <p
                  className="
                    mt-3
                    max-w-[720px]
                    text-sm
                    leading-7
                    text-white/65

                    sm:text-base
                  "
                >
                  {isArabic
                    ? 'ارفع مستند المنافسة وعروض الموردين وابدأ التقييم من مكان واحد.'
                    : 'Upload the competition document and vendor proposals and begin the evaluation in one place.'}
                </p>

              </div>

            </div>


            {/* WHITE BUTTON */}

            <Link
              href="/evaluations/new"
              className="
                inline-flex
                h-14
                shrink-0
                items-center
                justify-center
                gap-3
                bg-white
                px-7
                text-sm
                font-semibold
                text-[#131B4F]
                transition-all
                duration-300
                ease-out

                hover:-translate-y-1
                hover:shadow-[0_14px_30px_rgba(0,0,0,0.16)]
              "
            >

              <span>
                {isArabic
                  ? 'إضافة منافسة'
                  : 'Add Competition'}
              </span>


              <ArrowRight
                className={cn(
                  `
                    size-4
                    transition-transform
                    duration-300
                  `,

                  isArabic
                    ? 'rotate-180'
                    : '',
                )}
              />

            </Link>

          </div>

        </div>

      </section>

    </div>
  )
}