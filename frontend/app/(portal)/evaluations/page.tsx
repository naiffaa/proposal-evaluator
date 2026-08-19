'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  ArrowRight,
  FileCheck2,
  Plus,
} from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'

import {
  RecommendationBadge,
  StatusBadge,
} from '@/components/domain-badges'

import { evaluationsApi } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import { useLanguage } from '@/lib/i18n/context'

import type {
  EvaluationSummary,
} from '@/lib/types'


type OverviewStats = {
  totalEvaluations: number
  activeEvaluations: number
  vendorsAnalyzed: number
  completedReports: number
}


export default function EvaluationsPage() {
  const router = useRouter()

  const {
    language,
    isArabic,
  } = useLanguage()


  const [
    evaluations,
    setEvaluations,
  ] =
    useState<
      EvaluationSummary[]
    >([])

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    )


  useEffect(() => {
    let active = true


    async function loadEvaluations() {
      try {
        setLoading(true)
        setError(null)

        const data =
          await evaluationsApi.list()


        if (!active) {
          return
        }


        setEvaluations(
          Array.isArray(data)
            ? data
            : [],
        )
      } catch (err) {
        console.error(
          'Failed to load evaluations:',
          err,
        )


        if (!active) {
          return
        }


        setEvaluations([])

        setError(
          isArabic
            ? 'تعذر تحميل التقييمات.'
            : err instanceof Error
              ? err.message
              : 'Failed to load evaluations.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }


    loadEvaluations()


    return () => {
      active = false
    }
  }, [isArabic])


  const overviewStats =
    useMemo<OverviewStats>(
      () => ({
        totalEvaluations:
          evaluations.length,

        activeEvaluations:
          evaluations.filter(
            (evaluation) =>
              evaluation.status !==
              'COMPLETED',
          ).length,

        vendorsAnalyzed:
          evaluations.reduce(
            (
              total,
              evaluation,
            ) =>
              total +
              evaluation.vendorCount,
            0,
          ),

        completedReports:
          evaluations.filter(
            (evaluation) =>
              evaluation.status ===
              'COMPLETED',
          ).length,
      }),
      [evaluations],
    )


  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1380px] px-4 py-8 md:px-6 lg:py-10">

        <div className="h-32 animate-pulse rounded-2xl bg-muted" />

        <div className="mt-7 h-36 animate-pulse rounded-2xl bg-muted" />

        <div className="mt-7 h-[420px] animate-pulse rounded-2xl bg-muted" />

      </div>
    )
  }


  return (
    <div className="mx-auto w-full max-w-[1380px] px-4 py-8 md:px-6 lg:py-10">

      {/* ===================================== */}
      {/* PAGE HEADER */}
      {/* ===================================== */}

      <PageHeader
        eyebrow={
          isArabic
            ? 'إدارة التقييمات'
            : 'Evaluation Management'
        }
        title={
          isArabic
            ? 'التقييمات'
            : 'Evaluations'
        }
        description={
          isArabic
            ? 'عرض وإدارة ومراجعة جميع تقييمات طلبات العروض ومقترحات الموردين من مكان واحد.'
            : 'View, manage, and review all RFP and vendor proposal evaluations from one place.'
        }
        actions={
          <Button
            size="lg"
            nativeButton={false}
            render={
              <Link href="/evaluations/new" />
            }
          >
            <Plus className="size-4" />

            {isArabic
              ? 'تقييم جديد'
              : 'New Evaluation'}
          </Button>
        }
      />


      {/* ===================================== */}
      {/* ERROR */}
      {/* ===================================== */}

      {error && (
        <div
          className="
            mt-6
            rounded-xl
            border
            border-rose-200
            bg-rose-50
            px-4
            py-3
            text-sm
            text-rose-700
          "
        >
          {error}
        </div>
      )}


      {/* ===================================== */}
      {/* SUMMARY PANEL */}
      {/* ===================================== */}

      <section className="mt-8">

        <div
          className="
            overflow-hidden
            rounded-2xl
            border
            border-[#DCE4F5]
            bg-white
            shadow-sm
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-[#DCE4F5]
              bg-[#F8FAFF]
              px-6
              py-3.5
              sm:px-7
              lg:px-8
            "
          >

            <div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5367A5]">
                {isArabic
                  ? 'نظرة عامة'
                  : 'Overview'}
              </p>

              <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#161F56]">
                {isArabic
                  ? 'نشاط التقييمات'
                  : 'Evaluation Activity'}
              </h2>

            </div>


            <span className="hidden text-xs text-[#667085] md:block">
              {isArabic
                ? 'ملخص التقييمات الحالي'
                : 'Current portfolio summary'}
            </span>

          </div>


          <div className="grid grid-cols-2 md:grid-cols-4">

            <SummaryMetric
              label={
                isArabic
                  ? 'إجمالي التقييمات'
                  : 'Total Evaluations'
              }
              value={
                overviewStats.totalEvaluations
              }
              helper={
                isArabic
                  ? 'لجميع طلبات العروض'
                  : 'Across all RFPs'
              }
              tone="one"
            />

            <SummaryMetric
              label={
                isArabic
                  ? 'التقييمات النشطة'
                  : 'Active Evaluations'
              }
              value={
                overviewStats.activeEvaluations
              }
              helper={
                isArabic
                  ? 'قيد التنفيذ أو المراجعة'
                  : 'In progress or review'
              }
              tone="two"
            />

            <SummaryMetric
              label={
                isArabic
                  ? 'الموردون المحللون'
                  : 'Vendors Analyzed'
              }
              value={
                overviewStats.vendorsAnalyzed
              }
              helper={
                isArabic
                  ? 'العروض التي تم تقييمها'
                  : 'Proposals evaluated'
              }
              tone="three"
            />

            <SummaryMetric
              label={
                isArabic
                  ? 'التقارير المكتملة'
                  : 'Completed Reports'
              }
              value={
                overviewStats.completedReports
              }
              helper={
                isArabic
                  ? 'جاهزة للمراجعة'
                  : 'Ready for review'
              }
              tone="four"
              last
            />

          </div>

        </div>

      </section>


      {/* ===================================== */}
      {/* ALL EVALUATIONS */}
      {/* ===================================== */}

      <section
        className="
          mt-7
          overflow-hidden
          rounded-2xl
          border
          border-border
          bg-white
          shadow-[0_10px_35px_rgba(22,31,86,0.05)]
        "
      >

        <div
          className="
            flex
            flex-col
            gap-4
            border-b
            border-border
            px-6
            py-5
            sm:px-7
            lg:flex-row
            lg:items-center
            lg:justify-between
            lg:px-8
          "
        >

          <div>

            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              {isArabic
                ? 'جميع التقييمات'
                : 'All Evaluations'}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {isArabic
                ? 'راجع حالة التقييم والموردين والترتيب والنتائج.'
                : 'Review evaluation status, vendors, rankings, and results.'}
            </p>

          </div>


          <div className="flex items-center gap-3">

            <span
              className="
                rounded-full
                border
                border-primary/10
                bg-primary/[0.04]
                px-3
                py-1.5
                text-xs
                font-medium
                text-primary
              "
            >
              {isArabic
                ? `${evaluations.length} تقييم`
                : `${evaluations.length} evaluation${
                    evaluations.length !== 1
                      ? 's'
                      : ''
                  }`}
            </span>


            <Button
              variant="ghost"
              nativeButton={false}
              render={
                <Link href="/evaluations/new" />
              }
              className="gap-2 text-primary"
            >
              {isArabic
                ? 'بدء تقييم جديد'
                : 'Start New'}

              <ArrowRight
                className={`size-4 ${
                  isArabic
                    ? 'rotate-180'
                    : ''
                }`}
              />
            </Button>

          </div>

        </div>


        {evaluations.length === 0 ? (

          <div className="p-8">

            <EmptyState
              icon={FileCheck2}
              title={
                error
                  ? isArabic
                    ? 'تعذر تحميل التقييمات'
                    : 'Unable to load evaluations'
                  : isArabic
                    ? 'لا توجد تقييمات بعد'
                    : 'No evaluations yet'
              }
              description={
                error
                  ? isArabic
                    ? 'تعذر تحميل قائمة التقييمات من النظام.'
                    : 'The evaluation list could not be loaded from the API.'
                  : isArabic
                    ? 'ابدأ أول تقييم للعروض حتى تظهر النتائج هنا.'
                    : 'Start your first proposal evaluation to see results here.'
              }
              action={
                <Button
                  nativeButton={false}
                  render={
                    <Link href="/evaluations/new" />
                  }
                >
                  <Plus className="size-4" />

                  {isArabic
                    ? 'تقييم جديد'
                    : 'New Evaluation'}
                </Button>
              }
            />

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="min-w-full">

              <thead>

                <tr className="bg-slate-50/70">

                  <th className="px-6 py-3.5 text-start text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:px-7 lg:px-8">
                    {isArabic
                      ? 'طلب العرض / التقييم'
                      : 'RFP / Evaluation'}
                  </th>

                  <th className="px-5 py-3.5 text-start text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {isArabic
                      ? 'الموردون'
                      : 'Vendors'}
                  </th>

                  <th className="px-5 py-3.5 text-start text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {isArabic
                      ? 'الحالة'
                      : 'Status'}
                  </th>

                  <th className="px-5 py-3.5 text-start text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {isArabic
                      ? 'التوصية'
                      : 'Recommendation'}
                  </th>

                  <th className="px-5 py-3.5 text-start text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {isArabic
                      ? 'المورد الأعلى ترتيبًا'
                      : 'Top Ranked Vendor'}
                  </th>

                  <th className="px-5 py-3.5 text-start text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {isArabic
                      ? 'التاريخ'
                      : 'Date'}
                  </th>

                  <th className="px-6 py-3.5 text-end text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:px-7 lg:px-8">
                    {isArabic
                      ? 'الإجراء'
                      : 'Action'}
                  </th>

                </tr>

              </thead>


              <tbody>

                {evaluations.map(
                  (
                    evaluation,
                    index,
                  ) => (

                    <tr
                      key={
                        evaluation.id
                      }
                      tabIndex={0}
                      role="button"
                      onClick={() =>
                        router.push(
                          `/evaluations/${evaluation.id}`,
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' ||
                          event.key === ' '
                        ) {
                          event.preventDefault()

                          router.push(
                            `/evaluations/${evaluation.id}`,
                          )
                        }
                      }}
                      className={`
                        cursor-pointer
                        transition-all
                        duration-150

                        hover:bg-[#F6F8FF]

                        focus-visible:outline-none
                        focus-visible:ring-2
                        focus-visible:ring-inset
                        focus-visible:ring-[#161F56]/30

                        ${
                          index !==
                          evaluations.length - 1
                            ? 'border-b border-border'
                            : ''
                        }
                      `}
                    >

                      <td className="px-6 py-5 align-middle sm:px-7 lg:px-8">

                        <div className="min-w-[280px]">

                          <p className="text-sm font-semibold text-slate-950">
                            {evaluation.rfpName}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {evaluation.id}
                          </p>

                        </div>

                      </td>


                      <td className="px-5 py-5 align-middle">

                        <div>

                          <p className="text-sm font-semibold text-slate-900">
                            {
                              evaluation.vendorCount
                            }
                          </p>

                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {isArabic
                              ? evaluation.vendorCount === 1
                                ? 'عرض'
                                : 'عروض'
                              : `proposal${
                                  evaluation.vendorCount !== 1
                                    ? 's'
                                    : ''
                                }`}
                          </p>

                        </div>

                      </td>


                      <td className="px-5 py-5 align-middle">

                        <StatusBadge
                          status={
                            evaluation.status
                          }
                        />

                      </td>


                      <td className="px-5 py-5 align-middle">

                        {evaluation.recommendationStatus ? (

                          <RecommendationBadge
                            status={
                              evaluation.recommendationStatus
                            }
                          />

                        ) : (

                          <span className="text-sm text-muted-foreground">
                            —
                          </span>

                        )}

                      </td>


                      <td className="px-5 py-5 align-middle">

                        <div className="min-w-[170px]">

                          <p className="text-sm font-medium text-slate-900">
                            {
                              evaluation.topRankedVendor ??
                              '—'
                            }
                          </p>

                        </div>

                      </td>


                      <td className="px-5 py-5 align-middle">

                        <p className="whitespace-nowrap text-sm text-slate-700">
                          {formatDate(
                            evaluation.createdDate,
                            language,
                          )}
                        </p>

                      </td>


                      <td className="px-6 py-5 text-end align-middle sm:px-7 lg:px-8">

                        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">

                          {isArabic
                            ? 'عرض'
                            : 'View'}

                          <ArrowRight
                            className={`size-3.5 ${
                              isArabic
                                ? 'rotate-180'
                                : ''
                            }`}
                          />

                        </div>

                      </td>

                    </tr>

                  ),
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>
  )
}


/* ========================================== */
/* SUMMARY METRIC */
/* ========================================== */

function SummaryMetric({
  label,
  value,
  helper,
  tone,
  last = false,
}: {
  label: string
  value: number
  helper: string
  tone:
    | 'one'
    | 'two'
    | 'three'
    | 'four'
  last?: boolean
}) {
  const tones = {
    one: 'bg-[#F7F9FF]',
    two: 'bg-[#F3F6FF]',
    three: 'bg-[#EEF4FF]',
    four: 'bg-[#EAF1FF]',
  }


  const numberTones = {
    one: 'text-[#161F56]',
    two: 'text-[#243A7A]',
    three: 'text-[#3155A6]',
    four: 'text-[#3B66C4]',
  }


  return (
    <div
      className={`
        border-b
        border-[#DCE4F5]
        px-6
        py-4
        sm:px-7
        md:border-b-0
        md:border-e
        lg:px-8

        ${last ? 'md:border-e-0' : ''}

        ${tones[tone]}
      `}
    >

      <p className="text-xs font-medium text-[#5D6785]">
        {label}
      </p>


      <p
        className={`
          mt-1.5
          text-[30px]
          font-semibold
          leading-none
          tracking-tight
          ${numberTones[tone]}
        `}
      >
        {value}
      </p>


      <p className="mt-2 text-xs text-[#75809A]">
        {helper}
      </p>

    </div>
  )
}