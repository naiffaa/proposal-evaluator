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
  XCircle,
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


export default function EvaluationReportPage({
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

    evaluationsApi
      .get(id)
      .then((data) => {
        if (!active) {
          return
        }

        setEvaluation(data)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) {
          return
        }

        setError(
          isArabic
            ? 'تعذر تحميل تقرير التقييم.'
            : err instanceof Error
              ? err.message
              : 'Failed to load evaluation report.',
        )

        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [
    id,
    isArabic,
  ])


  const sortedVendors =
    useMemo(() => {
      if (!evaluation) {
        return []
      }

      return [
        ...evaluation.vendors,
      ].sort(
        (a, b) =>
          a.rank - b.rank,
      )
    }, [evaluation])


  if (loading) {
    return (
      <LoadingState />
    )
  }


  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

        <div className="rounded-2xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700 shadow-sm">
          {error}
        </div>

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
              ? 'لم يتم العثور على التقرير'
              : 'Report not found'
          }
          description={
            isArabic
              ? 'لا يتوفر تقرير تقييم لهذا التقييم.'
              : 'No evaluation report is available for this evaluation.'
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


  const topVendor =
    sortedVendors[0] ??
    null


  const eligibleVendors =
    sortedVendors.filter(
      (vendor) =>
        vendor.eligible,
    )


  const highRiskVendors =
    sortedVendors.filter(
      (vendor) =>
        vendor.riskLevel ===
        'HIGH',
    )


  const totalMissing =
    sortedVendors.reduce(
      (
        total,
        vendor,
      ) =>
        total +
        vendor
          .missingRequirements
          .length,
      0,
    )


  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

      {/* ===================================== */}
      {/* HEADER */}
      {/* ===================================== */}

      <header>

        <h1 className="text-[28px] font-semibold tracking-tight text-slate-950 lg:text-[30px]">
          {isArabic
            ? 'تقرير التقييم النهائي'
            : 'Final Evaluation Report'}
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
      {/* WORKSPACE NAV */}
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
            active
          />

        </div>

      </nav>


      {/* ===================================== */}
      {/* CONTENT */}
      {/* ===================================== */}

      <main className="mt-6 space-y-5">

        {/* ================================= */}
        {/* FINAL RECOMMENDATION */}
        {/* ================================= */}

        <section>

          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {isArabic
              ? 'التوصية النهائية'
              : 'Final Recommendation'}
          </h2>


          <p className="mt-1 text-sm text-slate-500">
            {isArabic
              ? 'التوصية النهائية بناءً على الترتيب والامتثال ومستوى المخاطر.'
              : 'Consolidated procurement recommendation based on ranking, compliance, and risk.'}
          </p>


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
                    className={cn(
                      `
                        flex
                        size-12
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                      `,

                      evaluation.recommendedVendor
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700',
                    )}
                  >

                    {evaluation.recommendedVendor ? (
                      <Award className="size-5" />
                    ) : (
                      <ShieldAlert className="size-5" />
                    )}

                  </div>


                  <div className="min-w-0">

                    <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                      {getRecommendationTitle(
                        evaluation.recommendationStatus,
                        evaluation.recommendedVendor,
                        isArabic,
                      )}
                    </h3>

                  </div>

                </div>


                <RecommendationBadge
                  evaluation={
                    evaluation
                  }
                  isArabic={
                    isArabic
                  }
                />

              </div>


              <p className="mt-5 max-w-5xl text-sm leading-7 text-slate-600">
                {evaluation.advisoryRecommendation ||
                  (
                    isArabic
                      ? 'لم يتم إرجاع توصية استشارية لهذا التقييم.'
                      : 'No advisory recommendation was returned for this evaluation.'
                  )}
              </p>


              {evaluation.humanReviewRequired && (
                <div
                  className="
                    mt-5
                    flex
                    items-start
                    gap-3
                    rounded-xl
                    border
                    border-[#E7EBF2]
                    bg-[#F8FAFD]
                    px-4
                    py-3.5
                  "
                >

                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#6676A6]" />


                  <p className="text-sm leading-6 text-slate-600">
                    {isArabic
                      ? 'يلزم إجراء مراجعة بشرية قبل اتخاذ أي قرار شراء أو ترسية نهائي.'
                      : 'Human review is required before any final procurement decision or award.'}
                  </p>

                </div>
              )}

            </div>

          </div>

        </section>


        {/* ================================= */}
        {/* REPORT SNAPSHOT */}
        {/* ================================= */}

        <section>

          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {isArabic
              ? 'ملخص التقرير'
              : 'Report Snapshot'}
          </h2>


          <p className="mt-1 text-sm text-slate-500">
            {isArabic
              ? 'أهم نتائج هذا التقييم.'
              : 'Key outcomes across this evaluation.'}
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
                  ? 'المورد الأعلى ترتيبًا'
                  : 'Top Ranked Vendor'
              }
              value={
                evaluation.topRankedVendor ??
                (
                  isArabic
                    ? 'لا يوجد'
                    : 'None'
                )
              }
              helper={
                evaluation.topRankedVendorScore !==
                null
                  ? isArabic
                    ? `${formatPercent(
                        evaluation.topRankedVendorScore,
                        1,
                      )} درجة موزونة`
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
                  ? 'الموردون المؤهلون'
                  : 'Eligible Vendors'
              }
              value={String(
                eligibleVendors.length,
              )}
              helper={
                isArabic
                  ? `تم تقييم ${evaluation.vendorCount}`
                  : `${evaluation.vendorCount} evaluated`
              }
              icon={CheckCircle2}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'الموردون مرتفعو المخاطر'
                  : 'High Risk Vendors'
              }
              value={String(
                highRiskVendors.length,
              )}
              helper={
                isArabic
                  ? 'يتطلبون مراجعة إضافية'
                  : 'Require additional review'
              }
              icon={ShieldAlert}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'الفجوات القائمة'
                  : 'Outstanding Gaps'
              }
              value={String(
                totalMissing,
              )}
              helper={
                isArabic
                  ? 'المتطلبات الإلزامية'
                  : 'Mandatory requirements'
              }
              icon={FileText}
              last
            />

          </div>

        </section>


        {/* ================================= */}
        {/* RFP SUMMARY */}
        {/* ================================= */}

        <section
          className="
            grid
            overflow-hidden
            rounded-2xl
            border
            border-[#DDE3EE]
            bg-white
            shadow-[0_8px_26px_rgba(22,31,86,0.04)]
            md:grid-cols-[1.5fr_1fr]
          "
        >

          <div className="px-6 py-5 lg:px-7">

            <div className="flex items-start gap-4">

              <div
                className="
                  flex
                  size-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#F2F5FB]
                  text-[#161F56]
                "
              >
                <FileText className="size-5" />
              </div>


              <div className="min-w-0">

                <h2 className="text-base font-semibold text-slate-950">
                  {evaluation.rfpName}
                </h2>


                <p className="mt-1 text-sm text-slate-500">
                  {isArabic
                    ? 'تم إنشاء التقييم في '
                    : 'Evaluation created '}

                  {formatDate(
                    evaluation.createdDate,
                    language,
                  )}
                </p>

              </div>

            </div>

          </div>


          <div
            className="
              grid
              grid-cols-3
              border-t
              border-[#E7EBF2]
              bg-[#F8FAFD]
              md:border-s
              md:border-t-0
            "
          >

            <MiniMetric
              label={
                isArabic
                  ? 'المعايير'
                  : 'Criteria'
              }
              value={
                evaluation.rfp
                  .totalCriteria
              }
            />


            <MiniMetric
              label={
                isArabic
                  ? 'المتطلبات'
                  : 'Requirements'
              }
              value={
                evaluation.rfp
                  .totalRequirements
              }
            />


            <MiniMetric
              label={
                isArabic
                  ? 'إلزامي'
                  : 'Mandatory'
              }
              value={
                evaluation.rfp
                  .mandatoryRequirements
              }
            />

          </div>

        </section>


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
                  ? 'تم ترتيب الموردين باستخدام التقييم الموزون وشروط الامتثال الإلزامية.'
                  : 'Ranked using deterministic weighted scoring and mandatory compliance gating.'}
              </p>

            </div>


            {sortedVendors.length > 1 && (
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
                  className={cn(
                    'size-4',
                    isArabic &&
                      'rotate-180',
                  )}
                />
              </Button>
            )}

          </div>


          <div className="overflow-x-auto">

            <div
              className="
                hidden
                min-w-[900px]
                grid-cols-[70px_minmax(0,2fr)_140px_170px_140px_140px]
                gap-4
                border-b
                border-[#E7EBF2]
                bg-[#F8FAFD]
                px-6
                py-3.5
                text-xs
                font-medium
                text-slate-500
                lg:grid
                lg:px-7
              "
            >
              <span>
                {isArabic
                  ? 'الترتيب'
                  : 'Rank'}
              </span>

              <span>
                {isArabic
                  ? 'المورد'
                  : 'Vendor'}
              </span>

              <span>
                {isArabic
                  ? 'الدرجة'
                  : 'Score'}
              </span>

              <span>
                {isArabic
                  ? 'الإلزامي'
                  : 'Mandatory'}
              </span>

              <span>
                {isArabic
                  ? 'الأهلية'
                  : 'Eligibility'}
              </span>

              <span>
                {isArabic
                  ? 'المخاطر'
                  : 'Risk'}
              </span>
            </div>


            <div className="min-w-[900px]">

              {sortedVendors.map(
                (
                  vendor,
                  index,
                ) => (
                  <VendorReportRow
                    key={vendor.id}
                    vendor={vendor}
                    evaluationId={
                      evaluation.id
                    }
                    last={
                      index ===
                      sortedVendors.length -
                        1
                    }
                    isArabic={
                      isArabic
                    }
                  />
                ),
              )}

            </div>

          </div>

        </section>


        {/* ================================= */}
        {/* TOP RANKED VENDOR REVIEW */}
        {/* ================================= */}

        {topVendor && (
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

              <div className="flex flex-wrap items-center gap-3">

                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  {isArabic
                    ? 'مراجعة المورد الأعلى ترتيبًا'
                    : 'Top Ranked Vendor Review'}
                </h2>


                <EligibilityBadge
                  eligible={
                    topVendor.eligible
                  }
                  isArabic={
                    isArabic
                  }
                />


                <RiskBadge
                  risk={
                    topVendor.riskLevel
                  }
                  isArabic={
                    isArabic
                  }
                />

              </div>

            </div>


            <div className="px-6 py-5 lg:px-7">

              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                <h3 className="text-lg font-semibold text-slate-950">
                  {topVendor.name}
                </h3>


                <Link
                  href={`/evaluations/${evaluation.id}/vendors/${topVendor.id}`}
                  className="
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


              <p className="mt-4 max-w-6xl text-sm leading-7 text-slate-500">
                {topVendor.summary ||
                  topVendor.complianceAssessment ||
                  (
                    isArabic
                      ? 'لم يتم إرجاع ملخص لهذا المورد.'
                      : 'No summary was returned for this vendor.'
                  )}
              </p>

            </div>


            <div className="grid border-t border-[#E7EBF2] lg:grid-cols-2">

              <AssessmentList
                title={
                  isArabic
                    ? 'نقاط القوة الرئيسية'
                    : 'Key Strengths'
                }
                items={
                  topVendor.strengths
                }
                positive
                isArabic={
                  isArabic
                }
              />


              <AssessmentList
                title={
                  isArabic
                    ? 'الفجوات الرئيسية'
                    : 'Key Gaps'
                }
                items={
                  topVendor.gaps
                }
                isArabic={
                  isArabic
                }
              />

            </div>

          </section>
        )}


        {/* ================================= */}
        {/* COMPLIANCE SUMMARY */}
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
                  ? 'ملخص الامتثال'
                  : 'Compliance Summary'}
              </h2>


              <p className="mt-1 text-sm text-slate-500">
                {isArabic
                  ? 'حالة الامتثال للمتطلبات الإلزامية لجميع الموردين.'
                  : 'Mandatory compliance status across evaluated vendors.'}
              </p>

            </div>


            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  href={`/evaluations/${id}/compliance`}
                />
              }
            >
              {isArabic
                ? 'عرض الامتثال'
                : 'View Compliance'}

              <ArrowRight
                className={cn(
                  'size-4',
                  isArabic &&
                    'rotate-180',
                )}
              />
            </Button>

          </div>


          <div className="grid gap-4 bg-[#F8FAFD] p-5 sm:p-6 lg:grid-cols-2">

            {sortedVendors.map(
              (vendor) => (
                <ComplianceCard
                  key={vendor.id}
                  vendor={vendor}
                  isArabic={
                    isArabic
                  }
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
            sm:items-start
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
                  ? 'يتم تقييم عروض الموردين متطلبًا بمتطلب مقابل إطار طلب العرض المستخرج. يتم احتساب درجات المعايير باستخدام نظام تقييم حتمي في Python وأوزان طلب العرض المعتمدة. يتم تقييم الامتثال الإلزامي ومستوى المخاطر وأهلية التوصية بشكل مستقل عن الترتيب الرقمي. جميع التوصيات الصادرة استشارية وتتطلب مراجعة بشرية من فريق المشتريات.'
                  : 'Vendor proposals are assessed requirement-by-requirement against the extracted RFP framework. Criterion scores are calculated using deterministic Python scoring and published RFP weights. Mandatory compliance, risk, and recommendation eligibility are reviewed separately from numerical ranking. All generated recommendations are advisory and require human procurement review.'}
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
              className={cn(
                'size-4',
                isArabic &&
                  'rotate-180',
              )}
            />
          </Link>

        </section>

      </main>

    </div>
  )
}


/* ========================================== */
/* WORKSPACE NAV */
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
            ? 'bg-white/10 text-white'
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
            : 'scale-x-0 bg-[#161F56] group-hover:scale-x-100',
        )}
      />

    </Link>
  )
}


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
/* MINI METRIC */
/* ========================================== */

function MiniMetric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex min-h-[92px] flex-col justify-center border-e border-[#E7EBF2] px-4 last:border-e-0">

      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>


      <p className="mt-2 text-xl font-semibold text-[#161F56]">
        {value}
      </p>

    </div>
  )
}


/* ========================================== */
/* VENDOR REPORT ROW */
/* ========================================== */

function VendorReportRow({
  vendor,
  evaluationId,
  last = false,
  isArabic,
}: {
  vendor: Vendor
  evaluationId: string
  last?: boolean
  isArabic: boolean
}) {
  return (
    <Link
      href={`/evaluations/${evaluationId}/vendors/${vendor.id}`}
      className={cn(
        `
          grid
          grid-cols-1
          gap-4
          px-6
          py-5
          transition-colors
          duration-200
          hover:bg-[#F8FAFD]
          lg:grid-cols-[70px_minmax(0,2fr)_140px_170px_140px_140px]
          lg:items-center
          lg:px-7
        `,

        !last &&
          'border-b border-[#E7EBF2]',
      )}
    >

      <div>
        <MobileLabel>
          {isArabic
            ? 'الترتيب'
            : 'Rank'}
        </MobileLabel>

        <span className="font-semibold text-[#161F56]">
          #{vendor.rank}
        </span>
      </div>


      <div className="min-w-0">

        <MobileLabel>
          {isArabic
            ? 'المورد'
            : 'Vendor'}
        </MobileLabel>

        <p className="truncate text-sm font-semibold text-slate-900">
          {vendor.name}
        </p>

      </div>


      <div>

        <MobileLabel>
          {isArabic
            ? 'الدرجة'
            : 'Score'}
        </MobileLabel>

        <span className="text-sm font-semibold text-slate-800">
          {vendor.overallScore.toFixed(
            1,
          )}
          %
        </span>

      </div>


      <div>

        <MobileLabel>
          {isArabic
            ? 'الإلزامي'
            : 'Mandatory'}
        </MobileLabel>

        <span className="text-sm font-semibold text-slate-800">
          {vendor.overallMandatoryCompliance.toFixed(
            1,
          )}
          %
        </span>

      </div>


      <div>

        <MobileLabel>
          {isArabic
            ? 'الأهلية'
            : 'Eligibility'}
        </MobileLabel>

        <EligibilityBadge
          eligible={
            vendor.eligible
          }
          isArabic={
            isArabic
          }
        />

      </div>


      <div>

        <MobileLabel>
          {isArabic
            ? 'المخاطر'
            : 'Risk'}
        </MobileLabel>

        <RiskBadge
          risk={
            vendor.riskLevel
          }
          isArabic={
            isArabic
          }
        />

      </div>

    </Link>
  )
}


/* ========================================== */
/* ASSESSMENT LIST */
/* ========================================== */

function AssessmentList({
  title,
  items,
  positive = false,
  isArabic,
}: {
  title: string
  items: string[]
  positive?: boolean
  isArabic: boolean
}) {
  return (
    <div
      className={cn(
        'px-6 py-5 lg:px-7',

        positive &&
          'lg:border-e lg:border-[#E7EBF2]',
      )}
    >

      <div className="flex items-center gap-2">

        {positive ? (
          <CheckCircle2 className="size-4 text-emerald-600" />
        ) : (
          <XCircle className="size-4 text-rose-600" />
        )}


        <h4 className="text-sm font-semibold text-slate-900">
          {title}
        </h4>

      </div>


      {items.length > 0 ? (

        <ul className="mt-4 space-y-3">

          {items.map(
            (
              item,
              index,
            ) => (

              <li
                key={`${item}-${index}`}
                className="flex gap-2.5 text-sm leading-6 text-slate-500"
              >

                <span
                  className={cn(
                    'mt-2 size-1.5 shrink-0 rounded-full',

                    positive
                      ? 'bg-emerald-500'
                      : 'bg-rose-500',
                  )}
                />

                {item}

              </li>

            ),
          )}

        </ul>

      ) : (

        <p className="mt-4 text-sm text-slate-500">
          {positive
            ? isArabic
              ? 'لم يتم تحديد نقاط قوة محددة.'
              : 'No specific strengths were identified.'
            : isArabic
              ? 'لم يتم تحديد فجوات رئيسية.'
              : 'No major gaps were identified.'}
        </p>

      )}

    </div>
  )
}


/* ========================================== */
/* COMPLIANCE CARD */
/* ========================================== */

function ComplianceCard({
  vendor,
  isArabic,
}: {
  vendor: Vendor
  isArabic: boolean
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-[#E2E7F0]
        bg-white
        px-5
        py-5
      "
    >

      <div className="flex items-start justify-between gap-4">

        <div>

          <h3 className="text-sm font-semibold text-slate-900">
            {vendor.name}
          </h3>


          <p className="mt-1 text-xs text-slate-400">
            {isArabic
              ? 'الامتثال الإلزامي'
              : 'Mandatory Compliance'}
          </p>

        </div>


        <p className="text-xl font-semibold text-[#161F56]">
          {vendor.overallMandatoryCompliance.toFixed(
            1,
          )}
          %
        </p>

      </div>


      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EDF0F5]">

        <div
          className="h-full rounded-full bg-[#161F56]"
          style={{
            width: `${Math.min(
              Math.max(
                vendor
                  .overallMandatoryCompliance,
                0,
              ),
              100,
            )}%`,
          }}
        />

      </div>


      <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-500">
        {vendor.complianceAssessment ||
          (
            isArabic
              ? 'لم يتم إرجاع تقييم للامتثال.'
              : 'No compliance assessment was returned.'
          )}
      </p>

    </div>
  )
}


/* ========================================== */
/* RECOMMENDATION BADGE */
/* ========================================== */

function RecommendationBadge({
  evaluation,
  isArabic,
}: {
  evaluation: Evaluation
  isArabic: boolean
}) {
  if (
    evaluation.recommendationStatus ===
    'NO_ELIGIBLE_VENDOR'
  ) {
    return (
      <span className="inline-flex w-fit rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
        {isArabic
          ? 'لا يوجد مورد مؤهل'
          : 'No Eligible Vendor'}
      </span>
    )
  }


  if (
    evaluation.recommendationStatus ===
    'REQUIRES_HUMAN_REVIEW'
  ) {
    return (
      <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
        {isArabic
          ? 'يتطلب مراجعة'
          : 'Review Required'}
      </span>
    )
  }


  return (
    <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
      {isArabic
        ? 'موصى به للمراجعة'
        : 'Recommended for Review'}
    </span>
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
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">

      <CheckCircle2 className="size-3.5" />

      {isArabic
        ? 'مؤهل'
        : 'Eligible'}

    </span>
  ) : (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">

      <XCircle className="size-3.5" />

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


  const arabicLabels = {
    LOW: 'مخاطر منخفضة',
    MEDIUM: 'مخاطر متوسطة',
    HIGH: 'مخاطر مرتفعة',
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

      <ShieldAlert className="size-3.5" />

      {isArabic
        ? arabicLabels[risk]
        : `${
            risk.charAt(0) +
            risk
              .slice(1)
              .toLowerCase()
          } Risk`}

    </span>
  )
}


/* ========================================== */
/* MOBILE LABEL */
/* ========================================== */

function MobileLabel({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <p className="mb-1 text-xs font-medium text-slate-400 lg:hidden">
      {children}
    </p>
  )
}


/* ========================================== */
/* RECOMMENDATION TITLE */
/* ========================================== */

function getRecommendationTitle(
  status:
    Evaluation['recommendationStatus'],
  recommendedVendor:
    string | null,
  isArabic: boolean,
) {
  if (
    status ===
    'NO_ELIGIBLE_VENDOR'
  ) {
    return isArabic
      ? 'لا يوجد مورد مؤهل'
      : 'No Eligible Vendor'
  }


  if (
    status ===
    'REQUIRES_HUMAN_REVIEW'
  ) {
    return isArabic
      ? 'يتطلب مراجعة بشرية'
      : 'Human Review Required'
  }


  if (
    recommendedVendor
  ) {
    return isArabic
      ? `المورد الموصى به: ${recommendedVendor}`
      : `Recommended Vendor: ${recommendedVendor}`
  }


  return isArabic
    ? 'توصية التقييم'
    : 'Evaluation Recommendation'
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

      <div className="mt-5 h-32 animate-pulse rounded-2xl bg-muted" />

      <div className="mt-5 h-96 animate-pulse rounded-2xl bg-muted" />

    </div>
  )
}