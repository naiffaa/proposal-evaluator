'use client'

import {
  use,
  useEffect,
  useState,
} from 'react'
import Link from 'next/link'

import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'

import { RecommendationBanner } from '@/components/recommendation-banner'
import { VendorRankCard } from '@/components/vendor-rank-card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'

import { evaluationsApi } from '@/lib/api'
import {
  formatDate,
  formatPercent,
} from '@/lib/labels'

import { useLanguage } from '@/lib/i18n/context'

import type { Evaluation } from '@/lib/types'


export default function EvaluationResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const {
    language,
    isArabic,
  } = useLanguage()

  const [evaluation, setEvaluation] =
    useState<Evaluation | null>(null)

  const [loading, setLoading] =
    useState(true)


  useEffect(() => {
    let active = true

    evaluationsApi
      .get(id)
      .then((data) => {
        if (active) {
          setEvaluation(data)
          setLoading(false)
        }
      })
      .catch((error) => {
        console.error(
          'Failed to load evaluation:',
          error,
        )

        if (active) {
          setEvaluation(null)
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [id])


  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

        <div className="h-24 animate-pulse rounded-2xl bg-muted" />

        <div className="mt-5 h-20 animate-pulse rounded-2xl bg-muted" />

        <div className="mt-6 h-72 animate-pulse rounded-2xl bg-muted" />

        <div className="mt-5 h-80 animate-pulse rounded-2xl bg-muted" />

      </div>
    )
  }


  if (!evaluation) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

        <EmptyState
          icon={FileText}
          title={
            isArabic
              ? 'لم يتم العثور على التقييم'
              : 'Evaluation not found'
          }
          description={
            isArabic
              ? 'تعذر العثور على هذا التقييم. قد يكون قد تم حذفه.'
              : "We couldn't find this evaluation. It may have been removed."
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


  const eligibleCount =
    evaluation.vendors.filter(
      (vendor) =>
        vendor.eligible,
    ).length


  const topVendor =
    evaluation.vendors.find(
      (vendor) =>
        vendor.name ===
        evaluation.topRankedVendor,
    ) ??
    evaluation.vendors[0] ??
    null


  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

      {/* ===================================== */}
      {/* HEADER */}
      {/* ===================================== */}

      <header>

        <h1 className="text-[28px] font-semibold tracking-tight text-slate-950 lg:text-[30px]">
          {evaluation.rfpName}
        </h1>


        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">

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
            icon={ShieldCheck}
            text={
              isArabic
                ? `${evaluation.rfp.totalCriteria} معايير`
                : `${evaluation.rfp.totalCriteria} criteria`
            }
          />

          <HeaderMeta
            icon={FileText}
            text={
              isArabic
                ? `${evaluation.rfp.totalRequirements} متطلبات`
                : `${evaluation.rfp.totalRequirements} requirements`
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
      {/* WORKSPACE NAVIGATION */}
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
            active
          />

          <NavArrow isArabic={isArabic} />

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

          <NavArrow isArabic={isArabic} />

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
          />

          <NavArrow isArabic={isArabic} />

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

          <NavArrow isArabic={isArabic} />

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
      {/* MAIN CONTENT */}
      {/* ===================================== */}

      <main className="mt-6 space-y-5">

        {/* ================================= */}
        {/* RECOMMENDATION */}
        {/* ================================= */}

        <section>

          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {isArabic
              ? 'التوصية'
              : 'Recommendation'}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {isArabic
              ? 'القرار مبني على التقييم الموزون والامتثال للمتطلبات الإلزامية.'
              : 'Decision based on weighted scoring and mandatory compliance.'}
          </p>


          <div className="mt-3">

            <RecommendationBanner
              evaluation={
                evaluation
              }
            />

          </div>

        </section>


        {/* ================================= */}
        {/* EVALUATION SNAPSHOT */}
        {/* ================================= */}

        <section>

          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {isArabic
              ? 'ملخص التقييم'
              : 'Evaluation Snapshot'}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {isArabic
              ? 'أهم نتائج التقييم في نظرة سريعة.'
              : 'Key evaluation results at a glance.'}
          </p>


          <div
            className="
              mt-3
              overflow-hidden
              rounded-2xl
              border
              border-[#DDE3EE]
              bg-white
              shadow-[0_8px_26px_rgba(22,31,86,0.045)]
            "
          >

            <SnapshotMetric
              label={
                isArabic
                  ? 'الأعلى ترتيبًا'
                  : 'Top Ranked'
              }
              value={
                evaluation.topRankedVendor ??
                '—'
              }
              helper={
                evaluation.topRankedVendorScore !==
                null
                  ? isArabic
                    ? `${formatPercent(
                        evaluation.topRankedVendorScore,
                        1,
                      )} الدرجة الموزونة`
                    : `${formatPercent(
                        evaluation.topRankedVendorScore,
                        1,
                      )} weighted score`
                  : isArabic
                    ? 'لا توجد درجة متاحة'
                    : 'No score available'
              }
              icon={Trophy}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'الموردون الذين تم تقييمهم'
                  : 'Vendors Evaluated'
              }
              value={
                String(
                  evaluation.vendorCount,
                )
              }
              helper={
                isArabic
                  ? `${eligibleCount} ${
                      eligibleCount === 1
                        ? 'مورد مؤهل'
                        : 'موردين مؤهلين'
                    }`
                  : `${eligibleCount} eligible vendor${
                      eligibleCount !== 1
                        ? 's'
                        : ''
                    }`
              }
              icon={Users}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'المتطلبات الإلزامية'
                  : 'Mandatory Requirements'
              }
              value={
                String(
                  evaluation.rfp
                    .mandatoryRequirements,
                )
              }
              helper={
                isArabic
                  ? 'تستخدم كشرط للأهلية'
                  : 'Used as eligibility gates'
              }
              icon={ShieldCheck}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'معايير التقييم'
                  : 'Evaluation Criteria'
              }
              value={
                String(
                  evaluation.rfp
                    .totalCriteria,
                )
              }
              helper={
                isArabic
                  ? 'إطار تقييم موزون'
                  : 'Weighted scoring framework'
              }
              icon={FileText}
              last
            />

          </div>

        </section>


        {/* ================================= */}
        {/* LEADING PROPOSAL */}
        {/* ================================= */}

        {topVendor && (
          <section
            className="
              grid
              overflow-hidden
              rounded-2xl
              border
              border-[#DDE3EE]
              bg-white
              shadow-[0_8px_26px_rgba(22,31,86,0.04)]
              md:grid-cols-[1.3fr_1fr]
            "
          >

            <div className="px-6 py-5 lg:px-7">

              <div className="flex flex-wrap items-center gap-3">

                <h2 className="text-xl font-semibold text-slate-950">
                  {topVendor.name}
                </h2>

                <span
                  className={`
                    rounded-full
                    px-2.5
                    py-1
                    text-[11px]
                    font-semibold

                    ${
                      topVendor.eligible
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }
                  `}
                >
                  {topVendor.eligible
                    ? isArabic
                      ? 'مؤهل'
                      : 'Eligible'
                    : isArabic
                      ? 'غير مؤهل'
                      : 'Not Eligible'}
                </span>

              </div>


              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                {topVendor.summary}
              </p>


              <Link
                href={`/evaluations/${id}/vendors/${topVendor.id}`}
                className="
                  mt-4
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
                  className={`size-4 ${
                    isArabic
                      ? 'rotate-180'
                      : ''
                  }`}
                />
              </Link>

            </div>


            <div
              className="
                grid
                grid-cols-2
                border-t
                border-[#E7EBF2]
                bg-[#F8FAFD]
                md:border-s
                md:border-t-0
              "
            >

              <QuickStat
                label={
                  isArabic
                    ? 'الدرجة الإجمالية'
                    : 'Overall Score'
                }
                value={`${formatPercent(
                  topVendor.overallScore,
                  1,
                )}`}
              />

              <QuickStat
                label={
                  isArabic
                    ? 'الامتثال الإلزامي'
                    : 'Mandatory Compliance'
                }
                value={`${formatPercent(
                  topVendor.overallMandatoryCompliance,
                  1,
                )}`}
              />

              <QuickStat
                label={
                  isArabic
                    ? 'نقاط القوة'
                    : 'Strengths'
                }
                value={String(
                  topVendor.strengths.length,
                )}
              />

              <QuickStat
                label={
                  isArabic
                    ? 'الفجوات'
                    : 'Gaps'
                }
                value={String(
                  topVendor.gaps.length,
                )}
              />

            </div>

          </section>
        )}


        {/* ================================= */}
        {/* VENDOR RANKING */}
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
                  ? 'ترتيب الموردين'
                  : 'Vendor Ranking'}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {isArabic
                  ? 'تم الترتيب بناءً على الدرجة الموزونة مع تطبيق شروط الامتثال الإلزامية.'
                  : 'Ranked by weighted score with mandatory compliance gating.'}
              </p>

            </div>


            {evaluation.vendors.length > 1 && (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    href={`/evaluations/${id}/comparison`}
                  />
                }
              >
                {isArabic
                  ? 'مقارنة الموردين'
                  : 'Compare Vendors'}

                <ArrowRight
                  className={`size-4 ${
                    isArabic
                      ? 'rotate-180'
                      : ''
                  }`}
                />
              </Button>
            )}

          </div>


          <div className="space-y-3 bg-[#F8FAFD] p-5 sm:p-6">

            {evaluation.vendors.map(
              (vendor) => (
                <VendorRankCard
                  key={vendor.id}
                  vendor={vendor}
                  href={`/evaluations/${id}/vendors/${vendor.id}`}
                />
              ),
            )}

          </div>

        </section>


        {/* ================================= */}
        {/* METHODOLOGY */}
        {/* ================================= */}

        <section
          className="
            flex
            flex-col
            gap-4
            rounded-2xl
            border
            border-[#DDE3EE]
            bg-white
            px-6
            py-5
            sm:flex-row
            sm:items-center
            sm:justify-between
            lg:px-7
          "
        >

          <div className="flex max-w-5xl items-start gap-4">

            <div
              className="
                flex
                size-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-[#F1F4FC]
                text-[#161F56]
              "
            >
              <ShieldCheck className="size-4" />
            </div>


            <div>

              <h3 className="text-sm font-semibold text-slate-900">
                {isArabic
                  ? 'منهجية التقييم'
                  : 'Evaluation Methodology'}
              </h3>

              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                {isArabic
                  ? 'يتم تقييم العروض متطلبًا بمتطلب مقابل إطار طلب العرض المعتمد، ثم يتم احتساب النتائج باستخدام أوزان المعايير المحددة. تعمل المتطلبات الإلزامية كشرط للأهلية، وتعد النتائج استشارية وتتطلب مراجعة بشرية من فريق المشتريات.'
                  : 'Proposals are evaluated requirement-by-requirement against the frozen RFP framework and aggregated using the published criteria weights. Mandatory requirements act as eligibility gates. Results are advisory and require human procurement review.'}
              </p>

            </div>

          </div>


          <Link
            href={`/evaluations/${id}/rfp`}
            className="
              inline-flex
              shrink-0
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
              ? 'عرض الإطار'
              : 'View Framework'}

            <ArrowRight
              className={`size-4 ${
                isArabic
                  ? 'rotate-180'
                  : ''
              }`}
            />
          </Link>

        </section>

      </main>

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
  icon: typeof Users
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
  icon: typeof FileText
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`
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

        ${
          active
            ? 'bg-[#161F56] text-white shadow-[0_5px_16px_rgba(22,31,86,0.20)]'
            : 'text-slate-600 hover:-translate-y-[1px] hover:bg-[#F3F6FC]'
        }
      `}
    >

      <div
        className={`
          flex
          size-9
          shrink-0
          items-center
          justify-center
          rounded-lg
          transition-all
          duration-200

          ${
            active
              ? 'bg-white/10 text-white'
              : 'bg-[#F2F5FB] text-[#60709A] group-hover:bg-white group-hover:text-[#161F56] group-hover:shadow-sm'
          }
        `}
      >
        <Icon className="size-4" />
      </div>


      <div>

        <p
          className={`
            text-sm
            font-semibold
            transition-colors
            duration-200

            ${
              active
                ? 'text-white'
                : 'text-slate-700 group-hover:text-[#161F56]'
            }
          `}
        >
          {label}
        </p>


        <p
          className={`
            mt-0.5
            text-[10px]
            transition-colors
            duration-200

            ${
              active
                ? 'text-white/55'
                : 'text-slate-400 group-hover:text-[#7180A7]'
            }
          `}
        >
          {helper}
        </p>

      </div>


      <span
        className={`
          absolute
          bottom-0
          start-4
          end-4
          h-[2px]
          origin-left
          rounded-full
          transition-transform
          duration-200

          ${
            active
              ? 'scale-x-100 bg-white/60'
              : 'scale-x-0 bg-[#161F56] group-hover:scale-x-100'
          }
        `}
      />

    </Link>
  )
}


/* ========================================== */
/* NAV ARROW */
/* ========================================== */

function NavArrow({
  isArabic,
}: {
  isArabic: boolean
}) {
  return (
    <div className="flex w-7 shrink-0 items-center justify-center">

      <ArrowRight
        className={`size-3.5 text-slate-300 ${
          isArabic
            ? 'rotate-180'
            : ''
        }`}
      />

    </div>
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
  icon: typeof FileText
  last?: boolean
}) {
  return (
    <div
      className={`
        group
        flex
        items-center
        gap-4
        px-5
        py-4
        transition-colors
        duration-200
        hover:bg-[#F7F9FE]

        ${
          !last
            ? 'border-b border-[#E7EBF2]'
            : ''
        }
      `}
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
/* QUICK STAT */
/* ========================================== */

function QuickStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="border-b border-e border-[#E7EBF2] px-5 py-5">

      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold tracking-tight text-[#161F56]">
        {value}
      </p>

    </div>
  )
}