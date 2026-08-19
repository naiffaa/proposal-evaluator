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
      title: isArabic
        ? 'التقييمات'
        : 'Evaluations',

      description: isArabic
        ? 'استعرض جميع التقييمات السابقة وحالتها والنتائج المرتبطة بها.'
        : 'Review previous evaluations, their status, rankings, and completed results.',

      href:
        '/evaluations',

      icon:
        ListChecks,
    },

    {
      title: isArabic
        ? 'إطار متطلبات طلب العرض'
        : 'RFP Framework',

      description: isArabic
        ? 'راجع المعايير والأوزان والمتطلبات والبنود الإلزامية المستخرجة من طلب العرض.'
        : 'Review extracted criteria, weights, requirements, and mandatory eligibility gates.',

      href:
        '/rfp-analysis',

      icon:
        FileText,
    },

    {
      title: isArabic
        ? 'مقارنة الموردين'
        : 'Vendor Comparison',

      description: isArabic
        ? 'قارن الموردين حسب الدرجات والامتثال والمخاطر ونقاط القوة والفجوات.'
        : 'Compare vendors across scoring, compliance, risk, strengths, gaps, and ranking.',

      href:
        '/comparison',

      icon:
        GitCompareArrows,
    },

    {
      title: isArabic
        ? 'مراجعة الامتثال'
        : 'Compliance Review',

      description: isArabic
        ? 'راجع المتطلبات الإلزامية وحالة أهلية الموردين ومخاطر الامتثال.'
        : 'Review mandatory requirements, vendor eligibility, and compliance risks.',

      href:
        '/compliance',

      icon:
        ShieldCheck,
    },
  ]


  return (
    <div className="w-full">

      {/* ========================================= */}
      {/* HERO */}
      {/* ========================================= */}

      <HeroBanner />


      {/* ========================================= */}
      {/* PAGE CONTENT */}
      {/* ========================================= */}

      <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">

        {/* ======================================= */}
        {/* QUICK ACCESS */}
        {/* ======================================= */}

        <section>

          <div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
              {isArabic
                ? 'الوصول السريع'
                : 'Quick Access'}
            </p>


            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              {isArabic
                ? 'كل ما تحتاجه في مكان واحد'
                : 'Everything you need in one place'}
            </h2>


            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              {isArabic
                ? 'أدر عملية تقييم طلبات العروض بالكامل، بدءًا من مراجعة التقييمات وإطار المتطلبات وحتى مقارنة الموردين ومراجعة الامتثال والنتائج النهائية.'
                : 'Manage the complete proposal evaluation process — from reviewing evaluations and RFP frameworks to vendor comparison, compliance, and final results.'}
            </p>

          </div>


          {/* ===================================== */}
          {/* QUICK ACCESS CARDS */}
          {/* ===================================== */}

          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

            {quickAccess.map(
              (item) => {
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
                    className="group block h-full"
                  >

                    <div
                      className="
                        relative
                        flex
                        h-full
                        min-h-[220px]
                        flex-col
                        overflow-hidden
                        border
                        border-border
                        bg-white
                        p-5
                        transition-all
                        duration-200

                        hover:-translate-y-1
                        hover:border-primary
                        hover:shadow-[0_14px_35px_rgba(22,31,86,0.12)]
                      "
                    >

                      {/* ================================= */}
                      {/* TOP HOVER LINE */}
                      {/* ================================= */}

                      <div
                        className="
                          absolute
                          inset-x-0
                          top-0
                          h-[3px]
                          origin-left
                          scale-x-0
                          bg-primary
                          transition-transform
                          duration-200
                          group-hover:scale-x-100
                        "
                      />


                      {/* ================================= */}
                      {/* ICON */}
                      {/* ================================= */}

                      <div
                        className="
                          flex
                          size-11
                          items-center
                          justify-center
                          bg-primary/[0.06]
                          text-primary
                          transition-all
                          duration-200

                          group-hover:bg-primary
                          group-hover:text-white
                        "
                      >
                        <Icon className="size-5" />
                      </div>


                      {/* ================================= */}
                      {/* TITLE */}
                      {/* ================================= */}

                      <h3
                        className="
                          mt-5
                          text-[15px]
                          font-semibold
                          text-primary
                        "
                      >
                        {item.title}
                      </h3>


                      {/* ================================= */}
                      {/* DESCRIPTION */}
                      {/* ================================= */}

                      <p
                        className="
                          mt-2
                          text-sm
                          leading-6
                          text-muted-foreground
                        "
                      >
                        {item.description}
                      </p>


                      {/* ================================= */}
                      {/* ARROW */}
                      {/* ================================= */}

                      <div className="mt-auto pt-5">

                        <div
                          className="
                            flex
                            size-8
                            items-center
                            justify-center
                            text-primary
                            transition-all
                            duration-200

                            group-hover:bg-primary/[0.07]
                          "
                        >
                          <ArrowRight
                            className={cn(
                              `
                                size-4
                                transition-transform
                                duration-200
                              `,

                              isArabic
                                ? 'rotate-180 group-hover:-translate-x-1'
                                : 'group-hover:translate-x-1',
                            )}
                          />
                        </div>

                      </div>

                    </div>

                  </Link>
                )
              },
            )}

          </div>


          {/* ===================================== */}
          {/* MAIN CTA */}
          {/* ===================================== */}

          <div className="mt-5 bg-primary px-6 py-6 text-white sm:px-8">

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              {/* ================================= */}
              {/* CTA CONTENT */}
              {/* ================================= */}

              <div className="flex items-start gap-4">

                <div className="flex size-11 shrink-0 items-center justify-center bg-white/10">

                  <Plus className="size-5" />

                </div>


                <div>

                  <h3 className="text-base font-semibold">
                    {isArabic
                      ? 'ابدأ تقييمًا جديدًا للعروض'
                      : 'Start a New Proposal Evaluation'}
                  </h3>


                  <p className="mt-1 max-w-2xl text-sm leading-6 text-white/70">
                    {isArabic
                      ? 'ارفع طلب عرض وواحدًا أو أكثر من عروض الموردين لبدء مطابقة المتطلبات وتقييم الامتثال وحساب الدرجات والترتيب وإعداد التوصية.'
                      : 'Upload an RFP and one or more vendor proposals to begin requirement matching, compliance assessment, scoring, ranking, and recommendation.'}
                  </p>

                </div>

              </div>


              {/* ================================= */}
              {/* CTA BUTTON */}
              {/* ================================= */}

              <Link
                href="/evaluations/new"
                className="
                  inline-flex
                  h-11
                  shrink-0
                  items-center
                  justify-center
                  gap-2
                  bg-white
                  px-5
                  text-sm
                  font-semibold
                  text-primary
                  transition-all
                  duration-200

                  hover:-translate-y-0.5
                  hover:bg-white/95
                  hover:shadow-lg
                "
              >

                {isArabic
                  ? 'بدء التقييم'
                  : 'Start Evaluation'}


                <ArrowRight
                  className={cn(
                    'size-4 transition-transform duration-200',

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

    </div>
  )
}