'use client'

import {
  use,
  useEffect,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  FileText,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { RiskBadge } from '@/components/domain-badges'

import {
  ScoreBar,
  ScoreRing,
} from '@/components/score-progress'

import { RequirementResults } from '@/components/requirement-results'

import { evaluationsApi } from '@/lib/api'
import { formatPercent } from '@/lib/labels'
import { useLanguage } from '@/lib/i18n/context'

import type { Vendor } from '@/lib/types'


export default function VendorDetailPage({
  params,
}: {
  params: Promise<{
    id: string
    vendorId: string
  }>
}) {
  const {
    id,
    vendorId,
  } = use(params)

  const router =
    useRouter()

  const {
    isArabic,
  } = useLanguage()


  const [
    vendor,
    setVendor,
  ] =
    useState<
      Vendor | null | undefined
    >(undefined)


  useEffect(() => {
    let active = true

    evaluationsApi
      .getVendor(
        id,
        vendorId,
      )
      .then((data) => {
        if (active) {
          setVendor(
            data ?? null,
          )
        }
      })
      .catch((error) => {
        console.error(
          'Failed to load vendor:',
          error,
        )

        if (active) {
          setVendor(null)
        }
      })

    return () => {
      active = false
    }
  }, [id, vendorId])


  if (vendor === undefined) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

        <div className="h-16 animate-pulse rounded-xl bg-muted" />

        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" />

        <div className="mt-5 h-72 animate-pulse rounded-2xl bg-muted" />

      </div>
    )
  }


  if (vendor === null) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

        <EmptyState
          icon={Ban}
          title={
            isArabic
              ? 'لم يتم العثور على المورد'
              : 'Vendor not found'
          }
          description={
            isArabic
              ? 'هذا المورد ليس جزءًا من التقييم المحدد.'
              : 'This vendor is not part of the selected evaluation.'
          }
          action={
            <Button
              onClick={() =>
                router.back()
              }
            >
              {isArabic
                ? 'رجوع'
                : 'Go Back'}
            </Button>
          }
        />

      </div>
    )
  }


  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

      {/* ===================================== */}
      {/* BACK */}
      {/* ===================================== */}

      <button
        type="button"
        onClick={() =>
          router.back()
        }
        className="
          inline-flex
          items-center
          gap-2
          text-sm
          font-medium
          text-slate-500
          transition-colors
          hover:text-[#161F56]
        "
      >
        <ArrowLeft
          className={`size-4 ${
            isArabic
              ? 'rotate-180'
              : ''
          }`}
        />

        {isArabic
          ? 'العودة إلى ترتيب الموردين'
          : 'Back to Vendor Ranking'}
      </button>


      {/* ===================================== */}
      {/* HEADER */}
      {/* ===================================== */}

      <header
        className="
          mt-5
          flex
          flex-col
          gap-4
          border-b
          border-[#DDE3EE]
          pb-6
          lg:flex-row
          lg:items-end
          lg:justify-between
        "
      >

        <div className="min-w-0">

          <h1 className="truncate text-[28px] font-semibold tracking-tight text-slate-950 lg:text-[30px]">
            {vendor.name}
          </h1>


          <div className="mt-3 flex flex-wrap items-center gap-2">

            <span
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-full
                border
                border-[#DDE3EE]
                bg-white
                px-3
                py-1
                text-xs
                font-semibold
                text-[#161F56]
              "
            >
              <Trophy className="size-3.5" />

              {isArabic
                ? `الترتيب #${vendor.rank}`
                : `Rank #${vendor.rank}`}
            </span>


            {vendor.eligible ? (
              <span
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-full
                  bg-emerald-50
                  px-3
                  py-1
                  text-xs
                  font-semibold
                  text-emerald-700
                "
              >
                <CheckCircle2 className="size-3.5" />

                {isArabic
                  ? 'مؤهل'
                  : 'Eligible'}
              </span>
            ) : (
              <span
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-full
                  bg-rose-50
                  px-3
                  py-1
                  text-xs
                  font-semibold
                  text-rose-700
                "
              >
                <Ban className="size-3.5" />

                {isArabic
                  ? 'غير مؤهل'
                  : 'Not Eligible'}
              </span>
            )}


            <RiskBadge
              risk={
                vendor.riskLevel
              }
            />

          </div>

        </div>


        <div className="text-sm text-slate-500">

          {isArabic
            ? `التقييم ${id}`
            : `Evaluation ${id}`}

        </div>

      </header>


      <main className="mt-6 space-y-6">

        {/* ================================= */}
        {/* PERFORMANCE SUMMARY */}
        {/* ================================= */}

        <section>

          <div>

            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              {isArabic
                ? 'ملخص الأداء'
                : 'Performance Summary'}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {isArabic
                ? 'ملخص درجات المورد وامتثاله للمتطلبات.'
                : 'Summary of vendor scoring and mandatory compliance.'}
            </p>

          </div>


          <div
            className="
              mt-3
              grid
              overflow-hidden
              rounded-2xl
              border
              border-[#DDE3EE]
              bg-white
              shadow-[0_8px_26px_rgba(22,31,86,0.04)]
              lg:grid-cols-[300px_minmax(0,1fr)]
            "
          >

            {/* SCORE */}

            <div
              className="
                flex
                items-center
                justify-center
                border-b
                border-[#E7EBF2]
                px-6
                py-7
                lg:border-b-0
                lg:border-e
              "
            >

              <ScoreRing
                value={
                  vendor.overallScore
                }
                label={
                  isArabic
                    ? 'الدرجة الموزونة'
                    : 'Weighted Score'
                }
              />

            </div>


            {/* SUMMARY METRICS */}

            <div className="grid sm:grid-cols-3">

              <SummaryMetric
                label={
                  isArabic
                    ? 'الامتثال الإلزامي'
                    : 'Mandatory Compliance'
                }
                value={
                  formatPercent(
                    vendor.overallMandatoryCompliance,
                    1,
                  )
                }
              />


              <SummaryMetric
                label={
                  isArabic
                    ? 'المتطلبات غير المستوفاة'
                    : 'Outstanding Requirements'
                }
                value={
                  String(
                    vendor.missingRequirements.length,
                  )
                }
              />


              <SummaryMetric
                label={
                  isArabic
                    ? 'الأهلية'
                    : 'Eligibility'
                }
                value={
                  vendor.eligible
                    ? isArabic
                      ? 'مؤهل'
                      : 'Eligible'
                    : isArabic
                      ? 'غير مؤهل'
                      : 'Not Eligible'
                }
                last
              />

            </div>

          </div>

        </section>


        {/* ================================= */}
        {/* SCORE BY CRITERION */}
        {/* ================================= */}

        <section
          className="
            overflow-hidden
            rounded-2xl
            border
            border-[#DDE3EE]
            bg-white
            shadow-[0_8px_26px_rgba(22,31,86,0.04)]
          "
        >

          <div className="border-b border-[#E7EBF2] px-6 py-5 lg:px-7">

            <h2 className="text-lg font-semibold text-slate-950">
              {isArabic
                ? 'الدرجة حسب المعيار'
                : 'Score by Criterion'}
            </h2>

          </div>


          <div className="space-y-6 px-6 py-6 lg:px-7">

            {vendor.criterionScores.map(
              (
                criterion,
              ) => (
                <div
                  key={
                    criterion.criterionId
                  }
                >

                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">

                    <div>

                      <p className="text-sm font-semibold text-slate-800">
                        {
                          criterion.criterionName
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {isArabic
                          ? `الوزن ${criterion.weight}%`
                          : `Weight ${criterion.weight}%`}
                      </p>

                    </div>


                    <div className="text-end">

                      <p className="text-sm font-semibold tabular-nums text-[#161F56]">
                        {
                          criterion.score.toFixed(
                            1,
                          )
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {isArabic
                          ? `المساهمة ${criterion.contribution.toFixed(
                              1,
                            )}`
                          : `Contribution ${criterion.contribution.toFixed(
                              1,
                            )}`}
                      </p>

                    </div>

                  </div>


                  <ScoreBar
                    value={
                      criterion.score
                    }
                  />

                </div>
              ),
            )}

          </div>

        </section>


        {/* ================================= */}
        {/* STRENGTHS + GAPS */}
        {/* ================================= */}

        <section className="grid gap-5 lg:grid-cols-2">

          {/* STRENGTHS */}

          <div
            className="
              overflow-hidden
              rounded-2xl
              border
              border-[#DDE3EE]
              bg-white
            "
          >

            <div className="flex items-center gap-3 border-b border-[#E7EBF2] px-6 py-4">

              <span
                className="
                  flex
                  size-9
                  items-center
                  justify-center
                  rounded-xl
                  bg-emerald-50
                  text-emerald-700
                "
              >
                <TrendingUp className="size-4" />
              </span>


              <h3 className="font-semibold text-slate-950">
                {isArabic
                  ? 'نقاط القوة'
                  : 'Key Strengths'}
              </h3>

            </div>


            <div className="px-6 py-5">

              {vendor.strengths.length >
              0 ? (
                <ul className="space-y-4">

                  {vendor.strengths.map(
                    (
                      strength,
                      index,
                    ) => (
                      <li
                        key={
                          index
                        }
                        className="flex gap-3 text-sm leading-6 text-slate-700"
                      >

                        <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />

                        <span>
                          {
                            strength
                          }
                        </span>

                      </li>
                    ),
                  )}

                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  {isArabic
                    ? 'لا توجد نقاط قوة محددة.'
                    : 'No strengths identified.'}
                </p>
              )}

            </div>

          </div>


          {/* GAPS */}

          <div
            className="
              overflow-hidden
              rounded-2xl
              border
              border-[#DDE3EE]
              bg-white
            "
          >

            <div className="flex items-center gap-3 border-b border-[#E7EBF2] px-6 py-4">

              <span
                className="
                  flex
                  size-9
                  items-center
                  justify-center
                  rounded-xl
                  bg-amber-50
                  text-amber-700
                "
              >
                <TrendingDown className="size-4" />
              </span>


              <h3 className="font-semibold text-slate-950">
                {isArabic
                  ? 'الفجوات'
                  : 'Identified Gaps'}
              </h3>

            </div>


            <div className="px-6 py-5">

              {vendor.gaps.length >
              0 ? (
                <ul className="space-y-4">

                  {vendor.gaps.map(
                    (
                      gap,
                      index,
                    ) => (
                      <li
                        key={
                          index
                        }
                        className="flex gap-3 text-sm leading-6 text-slate-700"
                      >

                        <ShieldAlert className="mt-1 size-4 shrink-0 text-amber-600" />

                        <span>
                          {gap}
                        </span>

                      </li>
                    ),
                  )}

                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  {isArabic
                    ? 'لا توجد فجوات محددة.'
                    : 'No gaps identified.'}
                </p>
              )}

            </div>

          </div>

        </section>


        {/* ================================= */}
        {/* MANDATORY COMPLIANCE */}
        {/* ================================= */}

        <section
          className="
            overflow-hidden
            rounded-2xl
            border
            border-[#DDE3EE]
            bg-white
          "
        >

          <div className="flex items-start gap-4 border-b border-[#E7EBF2] px-6 py-5 lg:px-7">

            <span
              className={`
                flex
                size-10
                shrink-0
                items-center
                justify-center
                rounded-xl

                ${
                  vendor.eligible
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }
              `}
            >
              <ShieldCheck className="size-5" />
            </span>


            <div>

              <h2 className="text-lg font-semibold text-slate-950">
                {isArabic
                  ? 'الامتثال الإلزامي'
                  : 'Mandatory Compliance'}
              </h2>


              <p className="mt-1 max-w-5xl text-sm leading-6 text-slate-500">
                {
                  vendor.complianceAssessment
                }
              </p>

            </div>

          </div>


          {vendor.missingRequirements.length >
            0 ? (
            <div className="bg-[#FAFBFD] px-6 py-5 lg:px-7">

              <div className="flex items-center justify-between gap-4">

                <h3 className="text-sm font-semibold text-slate-900">
                  {isArabic
                    ? 'المتطلبات غير المستوفاة'
                    : 'Outstanding Requirements'}
                </h3>


                <span className="text-xs font-medium text-slate-500">
                  {
                    vendor.missingRequirements.length
                  }
                </span>

              </div>


              <div
                className={`
                  mt-4
                  space-y-3

                  ${
                    vendor.missingRequirements.length >
                    8
                      ? 'max-h-[460px] overflow-y-auto overscroll-contain pe-2'
                      : ''
                  }
                `}
              >

                {vendor.missingRequirements.map(
                  (
                    requirement,
                  ) => (
                    <div
                      key={
                        requirement.requirementId
                      }
                      className="
                        rounded-xl
                        border
                        border-[#E4E8F0]
                        bg-white
                        px-4
                        py-4
                      "
                    >

                      <div className="flex items-start gap-3">

                        <Ban className="mt-0.5 size-4 shrink-0 text-rose-600" />


                        <div className="min-w-0">

                          <p className="text-xs font-semibold text-[#687595]">
                            {
                              requirement.criterionName
                            }
                          </p>


                          <p className="mt-1 text-sm font-medium leading-6 text-slate-900">
                            {
                              requirement.requirement
                            }
                          </p>


                          <p className="mt-1 text-sm leading-6 text-rose-700">
                            {
                              requirement.issue
                            }
                          </p>


                          <p className="mt-2 text-xs text-slate-400">
                            {
                              requirement.source
                            }
                          </p>

                        </div>

                      </div>

                    </div>
                  ),
                )}

              </div>

            </div>
          ) : (
            <div className="flex items-start gap-3 bg-emerald-50/40 px-6 py-5 lg:px-7">

              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />


              <div>

                <p className="text-sm font-semibold text-emerald-900">
                  {isArabic
                    ? 'تم استيفاء جميع المتطلبات الإلزامية'
                    : 'All mandatory requirements satisfied'}
                </p>

              </div>

            </div>
          )}

        </section>


        {/* ================================= */}
        {/* REQUIREMENTS */}
        {/* ================================= */}

        <section>

          <div>

            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              {isArabic
                ? 'تحليل المتطلبات'
                : 'Requirement Analysis'}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {isArabic
                ? 'تفاصيل استجابة العرض لكل متطلب والأدلة الداعمة.'
                : 'Detailed response to each requirement with supporting evidence.'}
            </p>

          </div>


          <div className="mt-4">

            <RequirementResults
              results={
                vendor.requirementResults
              }
            />

          </div>

        </section>

      </main>

    </div>
  )
}


/* ========================================== */
/* SUMMARY METRIC */
/* ========================================== */

function SummaryMetric({
  label,
  value,
  last = false,
}: {
  label: string
  value: string
  last?: boolean
}) {
  return (
    <div
      className={`
        flex
        min-h-[150px]
        flex-col
        justify-center
        px-6
        py-5
        border-b
        border-[#E7EBF2]
        sm:border-b-0
        sm:border-e

        ${
          last
            ? 'sm:border-e-0'
            : ''
        }
      `}
    >

      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>


      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#161F56]">
        {value}
      </p>

    </div>
  )
}