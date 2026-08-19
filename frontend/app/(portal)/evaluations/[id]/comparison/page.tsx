'use client'

import {
  use,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react'

import Link from 'next/link'

import {
  ArrowRight,
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'

import { evaluationsApi } from '@/lib/api'

import {
  formatDate,
  formatPercent,
} from '@/lib/labels'

import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/context'

import type {
  Evaluation,
  Vendor,
} from '@/lib/types'


export default function EvaluationComparisonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } =
    use(params)

  const {
    language,
    isArabic,
  } = useLanguage()


  const [
    evaluation,
    setEvaluation,
  ] =
    useState<Evaluation | null>(
      null,
    )

  const [
    vendors,
    setVendors,
  ] =
    useState<Vendor[]>([])

  const [
    loading,
    setLoading,
  ] =
    useState(true)


  useEffect(() => {
    let active = true

    Promise.all([
      evaluationsApi.get(id),
      evaluationsApi.getComparison(id),
    ])
      .then(
        ([
          evaluationData,
          vendorData,
        ]) => {
          if (!active) {
            return
          }

          setEvaluation(
            evaluationData,
          )

          setVendors(
            vendorData,
          )

          setLoading(false)
        },
      )
      .catch((error) => {
        console.error(
          'Failed to load vendor comparison:',
          error,
        )

        if (!active) {
          return
        }

        setEvaluation(null)
        setVendors([])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])


  const sortedVendors =
    useMemo(
      () =>
        [...vendors].sort(
          (a, b) =>
            a.rank - b.rank,
        ),
      [vendors],
    )


  const topVendor =
    sortedVendors[0] ??
    null


  const eligibleCount =
    sortedVendors.filter(
      (vendor) =>
        vendor.eligible,
    ).length


  const averageScore =
    sortedVendors.length > 0
      ? sortedVendors.reduce(
          (
            sum,
            vendor,
          ) =>
            sum +
            vendor.overallScore,
          0,
        ) /
        sortedVendors.length
      : 0


  const averageCompliance =
    sortedVendors.length > 0
      ? sortedVendors.reduce(
          (
            sum,
            vendor,
          ) =>
            sum +
            vendor
              .overallMandatoryCompliance,
          0,
        ) /
        sortedVendors.length
      : 0


  if (loading) {
    return (
      <LoadingState />
    )
  }


  if (!evaluation) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

        <EmptyState
          icon={GitCompareArrows}
          title={
            isArabic
              ? 'تعذر العثور على المقارنة'
              : 'Comparison not found'
          }
          description={
            isArabic
              ? 'تعذر تحميل مقارنة الموردين لهذا التقييم.'
              : "We couldn't load the vendor comparison for this evaluation."
          }
          action={
            <Button
              nativeButton={false}
              render={
                <Link href="/evaluations" />
              }
            >
              {isArabic
                ? 'العودة إلى التقييمات'
                : 'Back to Evaluations'}
            </Button>
          }
        />

      </div>
    )
  }


  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

      {/* ===================================== */}
      {/* HEADER */}
      {/* ===================================== */}

      <header>

        <h1 className="text-[28px] font-semibold tracking-tight text-slate-950 lg:text-[30px]">
          {isArabic
            ? 'مقارنة الموردين'
            : 'Vendor Comparison'}
        </h1>


        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">

          <HeaderMeta
            icon={FileText}
            text={
              evaluation.rfpName
            }
          />

          <HeaderMeta
            icon={Users}
            text={
              isArabic
                ? `${evaluation.vendorCount} ${
                    evaluation.vendorCount === 1
                      ? 'مورد'
                      : 'موردين'
                  }`
                : `${evaluation.vendorCount} vendor${
                    evaluation.vendorCount !== 1
                      ? 's'
                      : ''
                  }`
            }
          />

          <HeaderMeta
            icon={CalendarDays}
            text={formatDate(
              evaluation.createdDate,
              language,
            )}
          />

        </div>

      </header>


      {/* ===================================== */}
      {/* EVALUATION WORKSPACE NAV */}
      {/* ===================================== */}

      <nav
        className="
          mt-7
          overflow-x-auto
          rounded-2xl
          border
          border-[#DDE3EE]
          bg-white
          p-2
          shadow-[0_5px_20px_rgba(22,31,86,0.045)]
        "
      >

        <div className="flex min-w-max items-stretch">

          <EvaluationNavItem
            href={`/evaluations/${id}`}
            label={
              isArabic
                ? 'نظرة عامة'
                : 'Overview'
            }
            helper={
              isArabic
                ? 'الملخص'
                : 'Summary'
            }
            icon={LayoutDashboard}
          />

          <NavArrow
            isArabic={
              isArabic
            }
          />

          <EvaluationNavItem
            href={`/evaluations/${id}/rfp`}
            label={
              isArabic
                ? 'إطار طلب العرض'
                : 'RFP Framework'
            }
            helper={
              isArabic
                ? 'المعايير'
                : 'Criteria'
            }
            icon={FileText}
          />

          <NavArrow
            isArabic={
              isArabic
            }
          />

          <EvaluationNavItem
            href={`/evaluations/${id}/comparison`}
            label={
              isArabic
                ? 'مقارنة الموردين'
                : 'Vendor Comparison'
            }
            helper={
              isArabic
                ? 'التقييم'
                : 'Scoring'
            }
            icon={GitCompareArrows}
            active
          />

          <NavArrow
            isArabic={
              isArabic
            }
          />

          <EvaluationNavItem
            href={`/evaluations/${id}/compliance`}
            label={
              isArabic
                ? 'الامتثال'
                : 'Compliance'
            }
            helper={
              isArabic
                ? 'المتطلبات'
                : 'Requirements'
            }
            icon={ShieldCheck}
          />

          <NavArrow
            isArabic={
              isArabic
            }
          />

          <EvaluationNavItem
            href={`/evaluations/${id}/report`}
            label={
              isArabic
                ? 'التقرير'
                : 'Report'
            }
            helper={
              isArabic
                ? 'النتيجة النهائية'
                : 'Final output'
            }
            icon={BarChart3}
          />

        </div>

      </nav>


      {/* ===================================== */}
      {/* CONTENT */}
      {/* ===================================== */}

      <main className="mt-6 space-y-5">

        {/* ================================= */}
        {/* TOP RANKED VENDOR */}
        {/* ================================= */}

        <section>

          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {isArabic
              ? 'المورد الأعلى ترتيبًا'
              : 'Top Ranked Vendor'}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {isArabic
              ? 'أعلى عرض ترتيبًا بناءً على نتائج التقييم الموزونة.'
              : 'Highest ranked proposal based on weighted evaluation results.'}
          </p>


          {topVendor ? (

            <div
              className="
                mt-3
                overflow-hidden
                rounded-2xl
                border
                border-[#DDE3EE]
                bg-white
                shadow-[0_8px_26px_rgba(22,31,86,0.04)]
              "
            >

              <div className="px-6 py-6 lg:px-7">

                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

                  <div className="flex min-w-0 items-start gap-4">

                    <div
                      className="
                        flex
                        size-12
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        bg-[#161F56]
                        text-white
                      "
                    >
                      <Trophy className="size-5" />
                    </div>


                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-3">

                        <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                          {topVendor.name}
                        </h3>


                        <span
                          className="
                            inline-flex
                            items-center
                            rounded-full
                            bg-[#F1F4FA]
                            px-2.5
                            py-1
                            text-xs
                            font-semibold
                            text-[#161F56]
                          "
                        >
                          {isArabic
                            ? `الترتيب #${topVendor.rank}`
                            : `Rank #${topVendor.rank}`}
                        </span>

                      </div>


                      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-500">
                        {topVendor.summary}
                      </p>

                    </div>

                  </div>


                  <EligibilityBadge
                    eligible={
                      topVendor.eligible
                    }
                    isArabic={
                      isArabic
                    }
                  />

                </div>


                <div
                  className="
                    mt-6
                    grid
                    overflow-hidden
                    rounded-xl
                    border
                    border-[#E6EAF2]
                    bg-[#FAFBFD]
                    sm:grid-cols-3
                  "
                >

                  <TopMetric
                    label={
                      isArabic
                        ? 'الدرجة الإجمالية'
                        : 'Overall Score'
                    }
                    value={formatPercent(
                      topVendor.overallScore,
                      1,
                    )}
                  />


                  <TopMetric
                    label={
                      isArabic
                        ? 'الامتثال الإلزامي'
                        : 'Mandatory Compliance'
                    }
                    value={formatPercent(
                      topVendor
                        .overallMandatoryCompliance,
                      1,
                    )}
                  />


                  <TopMetric
                    label={
                      isArabic
                        ? 'مستوى المخاطر'
                        : 'Risk Level'
                    }
                    value={
                      isArabic
                        ? `مخاطر ${formatRiskArabic(
                            topVendor.riskLevel,
                          )}`
                        : `${formatRisk(
                            topVendor.riskLevel,
                          )} Risk`
                    }
                    last
                  />

                </div>


                <Link
                  href={`/evaluations/${id}/vendors/${topVendor.id}`}
                  className="
                    mt-5
                    inline-flex
                    items-center
                    gap-1.5
                    text-sm
                    font-semibold
                    text-[#161F56]
                    transition-all
                    duration-200
                    hover:gap-2.5
                  "
                >
                  {isArabic
                    ? 'عرض تفاصيل المورد'
                    : 'View vendor details'}

                  <ArrowRight
                    className={cn(
                      'size-4',
                      isArabic &&
                        'rotate-180',
                    )}
                  />
                </Link>

              </div>

            </div>

          ) : (

            <div
              className="
                mt-3
                rounded-2xl
                border
                border-dashed
                border-[#D7DFEC]
                bg-white
                px-6
                py-14
                text-center
              "
            >

              <GitCompareArrows className="mx-auto size-7 text-slate-400" />

              <p className="mt-3 text-sm font-medium text-slate-700">
                {isArabic
                  ? 'لا توجد نتائج للموردين'
                  : 'No vendor results available'}
              </p>

            </div>

          )}

        </section>


        {/* ================================= */}
        {/* COMPARISON SNAPSHOT */}
        {/* ================================= */}

        <section>

          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {isArabic
              ? 'ملخص المقارنة'
              : 'Comparison Snapshot'}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {isArabic
              ? 'أهم المؤشرات لجميع الموردين الذين تم تقييمهم.'
              : 'Key metrics across all evaluated vendors.'}
          </p>


          <div
            className="
              mt-3
              grid
              overflow-hidden
              rounded-2xl
              border
              border-[#DDE3EE]
              bg-white
              shadow-[0_8px_26px_rgba(22,31,86,0.045)]
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >

            <SnapshotMetric
              label={
                isArabic
                  ? 'الموردون المقارنون'
                  : 'Vendors Compared'
              }
              value={String(
                sortedVendors.length,
              )}
              helper={
                isArabic
                  ? 'إجمالي العروض التي تم تقييمها'
                  : 'Total evaluated proposals'
              }
              icon={Users}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'الموردون المؤهلون'
                  : 'Eligible Vendors'
              }
              value={String(
                eligibleCount,
              )}
              helper={
                isArabic
                  ? 'اجتازوا شروط الأهلية'
                  : 'Passed eligibility gates'
              }
              icon={CheckCircle2}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'متوسط الدرجة'
                  : 'Average Score'
              }
              value={formatPercent(
                averageScore,
                1,
              )}
              helper={
                isArabic
                  ? 'متوسط جميع الموردين'
                  : 'Across all vendors'
              }
              icon={Award}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'متوسط الامتثال'
                  : 'Average Compliance'
              }
              value={formatPercent(
                averageCompliance,
                1,
              )}
              helper={
                isArabic
                  ? 'الامتثال للمتطلبات الإلزامية'
                  : 'Mandatory compliance'
              }
              icon={ShieldCheck}
              last
            />

          </div>

        </section>


        {/* ================================= */}
        {/* VENDOR PERFORMANCE */}
        {/* ================================= */}

        <section
          className="
            overflow-hidden
            rounded-2xl
            border
            border-[#DDE3EE]
            bg-white
            shadow-[0_8px_28px_rgba(22,31,86,0.04)]
          "
        >

          <div
            className="
              flex
              flex-col
              gap-4
              border-b
              border-[#E7EBF2]
              px-6
              py-5
              sm:flex-row
              sm:items-center
              sm:justify-between
              lg:px-7
            "
          >

            <div>

              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                {isArabic
                  ? 'أداء الموردين'
                  : 'Vendor Performance'}
              </h2>


              <p className="mt-1 text-sm text-slate-500">
                {isArabic
                  ? 'قارن الدرجات والامتثال الإلزامي والأهلية ومستوى المخاطر.'
                  : 'Compare scoring, mandatory compliance, eligibility, and risk.'}
              </p>

            </div>


            <span className="rounded-full bg-[#F5F7FC] px-3 py-1.5 text-sm text-slate-500">
              {isArabic
                ? `${sortedVendors.length} ${
                    sortedVendors.length === 1
                      ? 'مورد'
                      : 'موردين'
                  }`
                : `${sortedVendors.length} vendor${
                    sortedVendors.length !== 1
                      ? 's'
                      : ''
                  }`}
            </span>

          </div>


          {sortedVendors.length === 0 ? (

            <div className="px-6 py-16 text-center">

              <GitCompareArrows className="mx-auto size-8 text-slate-400" />

              <h3 className="mt-3 text-base font-semibold text-slate-800">
                {isArabic
                  ? 'لا توجد نتائج للموردين'
                  : 'No vendor results available'}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {isArabic
                  ? 'ستظهر نتائج الموردين بعد اكتمال عملية التقييم.'
                  : 'Vendor results will appear after evaluation is completed.'}
              </p>

            </div>

          ) : (

            <div className="bg-[#F8FAFD] p-5 sm:p-6">

              <div
                className={cn(
                  'grid gap-4',

                  sortedVendors.length === 1 &&
                    'grid-cols-1',

                  sortedVendors.length === 2 &&
                    'lg:grid-cols-2',

                  sortedVendors.length >= 3 &&
                    'lg:grid-cols-2 xl:grid-cols-3',
                )}
              >

                {sortedVendors.map(
                  (vendor) => (
                    <VendorSummaryCard
                      key={vendor.id}
                      vendor={vendor}
                      evaluationId={id}
                      isArabic={
                        isArabic
                      }
                    />
                  ),
                )}

              </div>

            </div>

          )}

        </section>


        {/* ================================= */}
        {/* CRITERIA COMPARISON */}
        {/* ================================= */}

        {sortedVendors.length > 0 && (

          <section
            className="
              overflow-hidden
              rounded-2xl
              border
              border-[#DDE3EE]
              bg-white
              shadow-[0_8px_28px_rgba(22,31,86,0.04)]
            "
          >

            <div className="border-b border-[#E7EBF2] px-6 py-5 lg:px-7">

              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                {isArabic
                  ? 'مقارنة المعايير'
                  : 'Criteria Comparison'}
              </h2>


              <p className="mt-1 text-sm text-slate-500">
                {isArabic
                  ? 'قارن أداء الموردين عبر كل معيار موزون في طلب العرض.'
                  : 'Compare vendor performance across each weighted RFP criterion.'}
              </p>

            </div>


            <CriteriaComparisonTable
              vendors={
                sortedVendors
              }
              isArabic={
                isArabic
              }
            />

          </section>

        )}

      </main>

    </div>
  )
}


/* ========================================== */
/* VENDOR CARD */
/* ========================================== */

function VendorSummaryCard({
  vendor,
  evaluationId,
  isArabic,
}: {
  vendor: Vendor
  evaluationId: string
  isArabic: boolean
}) {
  return (
    <Link
      href={`/evaluations/${evaluationId}/vendors/${vendor.id}`}
      className="
        group
        flex
        h-full
        flex-col
        overflow-hidden
        rounded-2xl
        border
        border-[#E2E7F0]
        bg-white
        transition-all
        duration-200
        hover:-translate-y-0.5
        hover:border-[#C9D3E7]
        hover:shadow-[0_10px_28px_rgba(22,31,86,0.08)]
      "
    >

      <div className="border-b border-[#E7EBF2] px-5 py-5">

        <div className="flex items-start justify-between gap-4">

          <div className="flex min-w-0 items-start gap-3">

            <div
              className={cn(
                `
                  flex
                  size-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  text-sm
                  font-semibold
                `,
                vendor.rank === 1
                  ? 'bg-[#161F56] text-white'
                  : 'bg-[#F1F4FA] text-[#161F56]',
              )}
            >
              #{vendor.rank}
            </div>


            <div className="min-w-0">

              <h3 className="truncate text-base font-semibold text-slate-950">
                {vendor.name}
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                {isArabic
                  ? 'تقييم المورد'
                  : 'Vendor evaluation'}
              </p>

            </div>

          </div>


          {vendor.rank === 1 && (
            <Award className="size-5 shrink-0 text-amber-500" />
          )}

        </div>

      </div>


      <div className="grid grid-cols-2 border-b border-[#E7EBF2]">

        <CardMetric
          label={
            isArabic
              ? 'الدرجة الإجمالية'
              : 'Overall Score'
          }
          value={formatPercent(
            vendor.overallScore,
            1,
          )}
        />


        <CardMetric
          label={
            isArabic
              ? 'الامتثال الإلزامي'
              : 'Mandatory'
          }
          value={formatPercent(
            vendor.overallMandatoryCompliance,
            1,
          )}
          last
        />

      </div>


      <div className="grid grid-cols-2 gap-5 border-b border-[#E7EBF2] px-5 py-4">

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isArabic
              ? 'الأهلية'
              : 'Eligibility'}
          </p>

          <div className="mt-2">

            <EligibilityBadge
              eligible={
                vendor.eligible
              }
              isArabic={
                isArabic
              }
            />

          </div>

        </div>


        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isArabic
              ? 'المخاطر'
              : 'Risk'}
          </p>

          <div className="mt-2">

            <RiskBadge
              risk={
                vendor.riskLevel
              }
              isArabic={
                isArabic
              }
            />

          </div>

        </div>

      </div>


      <div className="flex-1 px-5 py-4">

        <p className="text-sm font-semibold text-slate-800">
          {isArabic
            ? 'التقييم'
            : 'Assessment'}
        </p>

        <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-500">
          {vendor.summary}
        </p>

      </div>


      <div className="border-t border-[#E7EBF2] px-5 py-4">

        <span
          className="
            inline-flex
            items-center
            gap-1.5
            text-sm
            font-semibold
            text-[#161F56]
            transition-all
            duration-200
            group-hover:gap-2.5
          "
        >
          {isArabic
            ? 'عرض تفاصيل المورد'
            : 'View vendor details'}

          <ArrowRight
            className={cn(
              'size-4',
              isArabic &&
                'rotate-180',
            )}
          />
        </span>

      </div>

    </Link>
  )
}


/* ========================================== */
/* CRITERIA TABLE */
/* ========================================== */

function CriteriaComparisonTable({
  vendors,
  isArabic,
}: {
  vendors: Vendor[]
  isArabic: boolean
}) {
  const criteria =
    vendors[0]?.criterionScores ??
    []

  return (
    <div className="overflow-x-auto">

      <table className="w-full min-w-[820px]">

        <thead>

          <tr className="border-b border-[#E7EBF2] bg-[#F8FAFD]">

            <th className="px-6 py-4 text-start text-xs font-semibold text-slate-500 lg:px-7">
              {isArabic
                ? 'المعيار'
                : 'Criterion'}
            </th>

            <th className="px-5 py-4 text-start text-xs font-semibold text-slate-500">
              {isArabic
                ? 'الوزن'
                : 'Weight'}
            </th>

            {vendors.map(
              (vendor) => (
                <th
                  key={vendor.id}
                  className="px-5 py-4 text-start text-xs font-semibold text-slate-500"
                >
                  {vendor.name}
                </th>
              ),
            )}

          </tr>

        </thead>


        <tbody>

          {criteria.map(
            (
              criterion,
              index,
            ) => (

              <tr
                key={
                  criterion.criterionId
                }
                className={cn(
                  'transition-colors hover:bg-[#FBFCFE]',

                  index !==
                    criteria.length - 1 &&
                    'border-b border-[#E7EBF2]',
                )}
              >

                <td className="px-6 py-5 lg:px-7">

                  <p className="text-sm font-semibold text-slate-900">
                    {
                      criterion.criterionName
                    }
                  </p>

                </td>


                <td className="px-5 py-5">

                  <span className="inline-flex rounded-full bg-[#F1F4FA] px-2.5 py-1 text-xs font-semibold text-[#161F56]">
                    {criterion.weight}%
                  </span>

                </td>


                {vendors.map(
                  (vendor) => {
                    const score =
                      vendor.criterionScores.find(
                        (item) =>
                          item.criterionId ===
                          criterion.criterionId,
                      )

                    const scoreValue =
                      score?.score ??
                      0

                    return (
                      <td
                        key={
                          vendor.id
                        }
                        className="px-5 py-5"
                      >

                        <div className="min-w-[150px]">

                          <div className="mb-2 flex items-center justify-between">

                            <span className="text-sm font-semibold text-slate-900">
                              {
                                scoreValue
                              }
                              %
                            </span>


                            {vendor.rank ===
                              1 && (
                              <Trophy className="size-3.5 text-amber-500" />
                            )}

                          </div>


                          <div className="h-1.5 overflow-hidden rounded-full bg-[#EDF0F5]">

                            <div
                              className="h-full rounded-full bg-[#161F56]"
                              style={{
                                width: `${Math.min(
                                  Math.max(
                                    scoreValue,
                                    0,
                                  ),
                                  100,
                                )}%`,
                              }}
                            />

                          </div>

                        </div>

                      </td>
                    )
                  },
                )}

              </tr>

            ),
          )}

        </tbody>

      </table>

    </div>
  )
}


/* ========================================== */
/* WORKSPACE NAV ITEM */
/* ========================================== */

function EvaluationNavItem({
  href,
  label,
  helper,
  icon: Icon,
  active = false,
}: {
  href: string
  label: string
  helper: string
  icon: ComponentType<{
    className?: string
  }>
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        `
          group
          relative
          flex
          min-w-[176px]
          items-center
          gap-3
          rounded-xl
          px-4
          py-3
          transition-all
          duration-200
          ease-out
        `,

        active
          ? `
              bg-[#161F56]
              text-white
              shadow-[0_5px_16px_rgba(22,31,86,0.20)]
            `
          : `
              text-slate-600
              hover:-translate-y-[1px]
              hover:bg-[#F3F6FC]
            `,
      )}
    >

      <div
        className={cn(
          `
            flex
            size-9
            shrink-0
            items-center
            justify-center
            rounded-lg
            transition-all
            duration-200
          `,

          active
            ? `
                bg-white/10
                text-white
              `
            : `
                bg-[#F2F5FB]
                text-[#60709A]
                group-hover:bg-white
                group-hover:text-[#161F56]
                group-hover:shadow-sm
              `,
        )}
      >

        <Icon className="size-4" />

      </div>


      <div>

        <p
          className={cn(
            `
              text-sm
              font-semibold
              transition-colors
              duration-200
            `,

            active
              ? 'text-white'
              : 'text-slate-700 group-hover:text-[#161F56]',
          )}
        >
          {label}
        </p>


        <p
          className={cn(
            `
              mt-0.5
              text-[10px]
              transition-colors
              duration-200
            `,

            active
              ? 'text-white/55'
              : 'text-slate-400 group-hover:text-[#7180A7]',
          )}
        >
          {helper}
        </p>

      </div>


      <span
        className={cn(
          `
            absolute
            bottom-0
            start-4
            end-4
            h-[2px]
            rounded-full
            transition-transform
            duration-200
          `,

          active
            ? 'scale-x-100 bg-white/60'
            : `
                scale-x-0
                bg-[#161F56]
                group-hover:scale-x-100
              `,
        )}
      />

    </Link>
  )
}


/* ========================================== */
/* NAV FLOW ARROW */
/* ========================================== */

function NavArrow({
  isArabic,
}: {
  isArabic: boolean
}) {
  return (
    <div className="flex w-7 shrink-0 items-center justify-center">

      <ChevronRight
        className={cn(
          'size-3.5 text-slate-300',
          isArabic &&
            'rotate-180',
        )}
      />

    </div>
  )
}


/* ========================================== */
/* HEADER META */
/* ========================================== */

function HeaderMeta({
  icon: Icon,
  text,
}: {
  icon: ComponentType<{
    className?: string
  }>
  text: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">

      <Icon className="size-4 text-[#6C789A]" />

      {text}

    </span>
  )
}


/* ========================================== */
/* SNAPSHOT METRIC */
/* ========================================== */

function SnapshotMetric({
  label,
  value,
  helper,
  icon: Icon,
  last = false,
}: {
  label: string
  value: string
  helper: string
  icon: ComponentType<{
    className?: string
  }>
  last?: boolean
}) {
  return (
    <div
      className={cn(
        `
          group
          flex
          min-h-[110px]
          items-center
          gap-4
          px-5
          py-4
          transition-colors
          duration-200
          hover:bg-[#F7F9FE]
        `,

        !last &&
          `
            border-b
            border-[#E7EBF2]
            sm:border-e
            xl:border-b-0
          `,
      )}
    >

      <div
        className="
          flex
          size-10
          shrink-0
          items-center
          justify-center
          rounded-xl
          bg-[#F2F5FB]
          text-[#60709A]
          transition-all
          duration-200
          group-hover:bg-[#E9EFFB]
          group-hover:text-[#161F56]
        "
      >

        <Icon className="size-4" />

      </div>


      <div className="min-w-0 flex-1">

        <p className="text-[11px] font-medium text-slate-500">
          {label}
        </p>

        <p className="mt-1 truncate text-lg font-semibold text-slate-950">
          {value}
        </p>

        <p className="mt-0.5 text-xs text-slate-400">
          {helper}
        </p>

      </div>

    </div>
  )
}


/* ========================================== */
/* TOP METRIC */
/* ========================================== */

function TopMetric({
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
      className={cn(
        'px-4 py-4',

        !last &&
          'border-b border-[#E6EAF2] sm:border-b-0 sm:border-e',
      )}
    >

      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold text-[#161F56]">
        {value}
      </p>

    </div>
  )
}


/* ========================================== */
/* CARD METRIC */
/* ========================================== */

function CardMetric({
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
      className={cn(
        'px-5 py-4',

        !last &&
          'border-e border-[#E7EBF2]',
      )}
    >

      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold tracking-tight text-[#161F56]">
        {value}
      </p>

    </div>
  )
}


/* ========================================== */
/* ELIGIBILITY BADGE */
/* ========================================== */

function EligibilityBadge({
  eligible,
  isArabic,
}: {
  eligible: boolean
  isArabic: boolean
}) {
  return eligible ? (

    <span
      className="
        inline-flex
        w-fit
        items-center
        gap-1.5
        rounded-full
        border
        border-emerald-200
        bg-emerald-50
        px-2.5
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
        w-fit
        items-center
        gap-1.5
        rounded-full
        border
        border-rose-200
        bg-rose-50
        px-2.5
        py-1
        text-xs
        font-semibold
        text-rose-700
      "
    >
      <ShieldAlert className="size-3.5" />

      {isArabic
        ? 'غير مؤهل'
        : 'Not Eligible'}
    </span>

  )
}


/* ========================================== */
/* RISK BADGE */
/* ========================================== */

function RiskBadge({
  risk,
  isArabic,
}: {
  risk: Vendor['riskLevel']
  isArabic: boolean
}) {
  const styles = {
    LOW:
      'border-emerald-200 bg-emerald-50 text-emerald-700',

    MEDIUM:
      'border-amber-200 bg-amber-50 text-amber-700',

    HIGH:
      'border-rose-200 bg-rose-50 text-rose-700',
  }


  return (
    <span
      className={cn(
        `
          inline-flex
          w-fit
          items-center
          gap-1.5
          rounded-full
          border
          px-2.5
          py-1
          text-xs
          font-semibold
        `,

        styles[risk],
      )}
    >
      <ShieldCheck className="size-3.5" />

      {isArabic
        ? `مخاطر ${formatRiskArabic(
            risk,
          )}`
        : `${formatRisk(
            risk,
          )} Risk`}
    </span>
  )
}


/* ========================================== */
/* RISK FORMAT */
/* ========================================== */

function formatRisk(
  risk: Vendor['riskLevel'],
) {
  return (
    risk.charAt(0) +
    risk
      .slice(1)
      .toLowerCase()
  )
}


function formatRiskArabic(
  risk: Vendor['riskLevel'],
) {
  const labels = {
    LOW: 'منخفضة',
    MEDIUM: 'متوسطة',
    HIGH: 'مرتفعة',
  }

  return labels[risk]
}


/* ========================================== */
/* LOADING */
/* ========================================== */

function LoadingState() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

      <div className="h-20 animate-pulse rounded-2xl bg-muted" />

      <div className="mt-5 h-20 animate-pulse rounded-2xl bg-muted" />

      <div className="mt-6 h-72 animate-pulse rounded-2xl bg-muted" />

      <div className="mt-5 h-72 animate-pulse rounded-2xl bg-muted" />

      <div className="mt-5 h-96 animate-pulse rounded-2xl bg-muted" />

    </div>
  )
}