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
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  ShieldAlert,
  ShieldCheck,
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


export default function EvaluationCompliancePage({
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
            ? 'تعذر تحميل بيانات الامتثال.'
            : err instanceof Error
              ? err.message
              : 'Failed to load compliance data.',
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


  const summary =
    useMemo(() => {
      if (!evaluation) {
        return {
          eligible: 0,
          notEligible: 0,
          highRisk: 0,
          averageCompliance: 0,
        }
      }

      const vendors =
        evaluation.vendors

      const eligible =
        vendors.filter(
          (vendor) =>
            vendor.eligible,
        ).length

      const notEligible =
        vendors.length -
        eligible

      const highRisk =
        vendors.filter(
          (vendor) =>
            vendor.riskLevel ===
            'HIGH',
        ).length

      const averageCompliance =
        vendors.length > 0
          ? vendors.reduce(
              (
                total,
                vendor,
              ) =>
                total +
                vendor
                  .overallMandatoryCompliance,
              0,
            ) /
            vendors.length
          : 0

      return {
        eligible,
        notEligible,
        highRisk,
        averageCompliance,
      }
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
          icon={ShieldAlert}
          title={
            isArabic
              ? 'لم يتم العثور على بيانات الامتثال'
              : 'Compliance data not found'
          }
          description={
            isArabic
              ? 'لا تتوفر نتائج امتثال لهذا التقييم.'
              : 'This evaluation does not have compliance results available.'
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
    evaluation.vendors[0] ??
    null


  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

      {/* ===================================== */}
      {/* HEADER */}
      {/* ===================================== */}

      <header>

        <h1 className="text-[28px] font-semibold tracking-tight text-slate-950 lg:text-[30px]">
          {isArabic
            ? 'مراجعة الامتثال'
            : 'Compliance Review'}
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
            active
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
        {/* MANDATORY REQUIREMENT REVIEW */}
        {/* ================================= */}

        <section>

          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {isArabic
              ? 'مراجعة المتطلبات الإلزامية'
              : 'Mandatory Requirement Review'}
          </h2>


          <p className="mt-1 text-sm text-slate-500">
            {isArabic
              ? 'راجع أداء الموردين مقابل المتطلبات الإلزامية في طلب العرض.'
              : 'Review how evaluated vendors performed against mandatory RFP requirements.'}
          </p>


          <div
            className="
              mt-3
              rounded-2xl
              border
              border-[#DDE3EE]
              bg-white
              px-6
              py-6
              shadow-[0_8px_26px_rgba(22,31,86,0.04)]
              lg:px-7
            "
          >

            <div className="flex items-start gap-4">

              <div
                className="
                  flex
                  size-12
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#F1F4FC]
                  text-[#161F56]
                "
              >
                <ShieldCheck className="size-5" />
              </div>


              <div className="min-w-0 flex-1">

                <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                  {evaluation.rfpName}
                </h3>


                <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">
                  {isArabic
                    ? 'يتم التحقق من كل مورد مقابل المتطلبات الإلزامية المستخرجة من إطار طلب العرض المعتمد. تعمل هذه المتطلبات كشرط للأهلية وقد تؤدي إلى استبعاد المورد بغض النظر عن درجته الموزونة.'
                    : 'Each vendor is checked against the mandatory requirements extracted from the frozen RFP framework. These requirements act as eligibility gates and may disqualify a vendor regardless of weighted score.'}
                </p>

              </div>

            </div>


            {topVendor && (
              <div
                className="
                  mt-6
                  grid
                  overflow-hidden
                  rounded-xl
                  border
                  border-[#E7EBF2]
                  bg-[#FAFBFD]
                  sm:grid-cols-3
                "
              >

                <TopMetric
                  label={
                    isArabic
                      ? 'امتثال المورد الأعلى ترتيبًا'
                      : 'Top Vendor Compliance'
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
                      ? 'المتطلبات غير المستوفاة'
                      : 'Missing Requirements'
                  }
                  value={String(
                    topVendor
                      .missingRequirements
                      .length,
                  )}
                />


                <TopMetric
                  label={
                    isArabic
                      ? 'الأهلية'
                      : 'Eligibility'
                  }
                  value={
                    topVendor.eligible
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
            )}

          </div>

        </section>


        {/* ================================= */}
        {/* COMPLIANCE SNAPSHOT */}
        {/* ================================= */}

        <section>

          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {isArabic
              ? 'ملخص الامتثال'
              : 'Compliance Snapshot'}
          </h2>


          <p className="mt-1 text-sm text-slate-500">
            {isArabic
              ? 'أهم مؤشرات الامتثال لجميع الموردين الذين تم تقييمهم.'
              : 'Key compliance indicators across evaluated vendors.'}
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
                  ? 'متوسط الامتثال'
                  : 'Average Compliance'
              }
              value={`${summary.averageCompliance.toFixed(
                1,
              )}%`}
              helper={
                isArabic
                  ? 'تغطية المتطلبات الإلزامية'
                  : 'Mandatory requirement coverage'
              }
              icon={ShieldCheck}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'الموردون المؤهلون'
                  : 'Eligible Vendors'
              }
              value={String(
                summary.eligible,
              )}
              helper={
                isArabic
                  ? 'اجتازوا شروط الامتثال'
                  : 'Passed compliance gating'
              }
              icon={CheckCircle2}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'غير المؤهلين'
                  : 'Not Eligible'
              }
              value={String(
                summary.notEligible,
              )}
              helper={
                isArabic
                  ? 'لم يجتازوا شروط الامتثال'
                  : 'Failed compliance gating'
              }
              icon={XCircle}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'مخاطر مرتفعة'
                  : 'High Risk'
              }
              value={String(
                summary.highRisk,
              )}
              helper={
                isArabic
                  ? 'موردون يحتاجون إلى اهتمام'
                  : 'Vendors requiring attention'
              }
              icon={ShieldAlert}
              last
            />

          </div>

        </section>


        {/* ================================= */}
        {/* COMPLIANCE BY VENDOR */}
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
                  ? 'الامتثال حسب المورد'
                  : 'Compliance by Vendor'}
              </h2>


              <p className="mt-1 text-sm text-slate-500">
                {isArabic
                  ? 'راجع نتائج الامتثال والمتطلبات الإلزامية غير المستوفاة لكل مورد.'
                  : 'Review compliance outcomes and outstanding mandatory requirements for each vendor.'}
              </p>

            </div>


            <span className="rounded-full bg-[#F5F7FC] px-3 py-1.5 text-sm text-slate-500">
              {isArabic
                ? `${evaluation.vendors.length} ${
                    evaluation.vendors.length === 1
                      ? 'مورد'
                      : 'موردين'
                  }`
                : `${evaluation.vendors.length} vendor${
                    evaluation.vendors.length !== 1
                      ? 's'
                      : ''
                  }`}
            </span>

          </div>


          <div className="space-y-4 bg-[#F8FAFD] p-5 sm:p-6">

            {evaluation.vendors.map(
              (vendor) => (
                <VendorComplianceCard
                  key={vendor.id}
                  vendor={vendor}
                  evaluationId={
                    evaluation.id
                  }
                  isArabic={
                    isArabic
                  }
                />
              ),
            )}

          </div>

        </section>

      </main>

    </div>
  )
}


/* ========================================== */
/* VENDOR COMPLIANCE CARD */
/* ========================================== */

function VendorComplianceCard({
  vendor,
  evaluationId,
  isArabic,
}: {
  vendor: Vendor
  evaluationId: string
  isArabic: boolean
}) {
  const hasMissing =
    vendor.missingRequirements
      .length > 0

  const shouldScroll =
    vendor.missingRequirements
      .length > 8


  return (
    <div
      className="
        overflow-hidden
        rounded-2xl
        border
        border-[#E2E7F0]
        bg-white
        transition-all
        duration-200
        hover:border-[#CBD5E7]
        hover:shadow-[0_8px_24px_rgba(22,31,86,0.06)]
      "
    >

      {/* ================================= */}
      {/* HEADER */}
      {/* ================================= */}

      <div
        className="
          flex
          flex-col
          gap-4
          border-b
          border-[#E7EBF2]
          px-5
          py-5
          sm:flex-row
          sm:items-center
          sm:justify-between
          lg:px-6
        "
      >

        <div>

          <div className="flex flex-wrap items-center gap-2">

            <h3 className="text-lg font-semibold text-slate-950">
              {vendor.name}
            </h3>


            <EligibilityBadge
              eligible={
                vendor.eligible
              }
              isArabic={
                isArabic
              }
            />


            <RiskBadge
              risk={
                vendor.riskLevel
              }
              isArabic={
                isArabic
              }
            />

          </div>


          <p className="mt-1 text-xs text-slate-400">
            {isArabic
              ? `الترتيب #${vendor.rank}`
              : `Rank #${vendor.rank}`}
          </p>

        </div>


        <Link
          href={`/evaluations/${evaluationId}/vendors/${vendor.id}`}
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
            : 'View Vendor Details'}

          <ArrowRight
            className={cn(
              'size-4',
              isArabic &&
                'rotate-180',
            )}
          />
        </Link>

      </div>


      {/* ================================= */}
      {/* METRICS */}
      {/* ================================= */}

      <div className="grid grid-cols-1 border-b border-[#E7EBF2] sm:grid-cols-3">

        <ComplianceMetric
          label={
            isArabic
              ? 'الامتثال الإلزامي'
              : 'Mandatory Compliance'
          }
          value={`${vendor.overallMandatoryCompliance.toFixed(
            1,
          )}%`}
        />


        <ComplianceMetric
          label={
            isArabic
              ? 'الدرجة الإجمالية'
              : 'Overall Score'
          }
          value={`${vendor.overallScore.toFixed(
            1,
          )}%`}
          border
        />


        <ComplianceMetric
          label={
            isArabic
              ? 'المتطلبات غير المستوفاة'
              : 'Missing Requirements'
          }
          value={String(
            vendor
              .missingRequirements
              .length,
          )}
          border
        />

      </div>


      {/* ================================= */}
      {/* ASSESSMENT */}
      {/* ================================= */}

      <div className="px-5 py-5 lg:px-6">

        <h4 className="text-sm font-semibold text-slate-900">
          {isArabic
            ? 'تقييم الامتثال'
            : 'Compliance Assessment'}
        </h4>


        <p className="mt-2 max-w-6xl text-sm leading-7 text-slate-500">
          {vendor.complianceAssessment ||
            (
              isArabic
                ? 'لم يتم إرجاع تقييم امتثال لهذا المورد.'
                : 'No compliance assessment was returned for this vendor.'
            )}
        </p>

      </div>


      {/* ================================= */}
      {/* OUTSTANDING REQUIREMENTS */}
      {/* ================================= */}

      <div className="border-t border-[#E7EBF2] bg-[#FBFCFE]">

        <div
          className="
            flex
            flex-col
            gap-3
            border-b
            border-[#E7EBF2]
            px-5
            py-4
            sm:flex-row
            sm:items-center
            sm:justify-between
            lg:px-6
          "
        >

          <div>

            <h4 className="text-sm font-semibold text-slate-900">
              {isArabic
                ? 'المتطلبات الإلزامية غير المستوفاة'
                : 'Outstanding Mandatory Requirements'}
            </h4>


            <p className="mt-1 text-xs text-slate-500">
              {isArabic
                ? 'المتطلبات التي لم يتم إثبات استيفائها بشكل كافٍ في العرض.'
                : 'Requirements not sufficiently demonstrated in the proposal.'}
            </p>

          </div>


          <div className="flex items-center gap-3">

            {shouldScroll && (
              <span className="text-[11px] text-slate-400">
                {isArabic
                  ? 'مرر لعرض الكل'
                  : 'Scroll to view all'}
              </span>
            )}


            <span
              className={cn(
                `
                  inline-flex
                  w-fit
                  rounded-full
                  px-2.5
                  py-1
                  text-xs
                  font-semibold
                `,

                hasMissing
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-emerald-50 text-emerald-700',
              )}
            >
              {isArabic
                ? `${vendor.missingRequirements.length} متبقي`
                : `${vendor.missingRequirements.length} outstanding`}
            </span>

          </div>

        </div>


        {!hasMissing ? (

          <div className="px-5 py-5 lg:px-6">

            <div
              className="
                flex
                items-center
                gap-2
                rounded-xl
                border
                border-emerald-100
                bg-emerald-50/70
                px-4
                py-3
                text-sm
                text-emerald-700
              "
            >

              <CheckCircle2 className="size-4 shrink-0" />

              {isArabic
                ? 'لم يتم تحديد أي متطلبات إلزامية مفقودة.'
                : 'No missing mandatory requirements were identified.'}

            </div>

          </div>

        ) : (

          <div
            className={cn(
              `
                p-4
                sm:p-5
              `,

              shouldScroll &&
                `
                  max-h-[460px]
                  overflow-y-auto
                  overscroll-contain
                `,
            )}
          >

            <div className="grid gap-3 lg:grid-cols-2">

              {vendor.missingRequirements.map(
                (
                  requirement,
                ) => (

                  <div
                    key={
                      requirement
                        .requirementId
                    }
                    className="
                      rounded-xl
                      border
                      border-[#E7EBF2]
                      bg-white
                      px-4
                      py-4
                      transition-colors
                      duration-150
                      hover:border-[#CBD5E7]
                      hover:bg-[#FCFDFF]
                    "
                  >

                    <div className="flex items-start gap-3">

                      <div
                        className="
                          mt-0.5
                          flex
                          size-8
                          shrink-0
                          items-center
                          justify-center
                          rounded-lg
                          bg-rose-50
                          text-rose-600
                        "
                      >
                        <ShieldAlert className="size-4" />
                      </div>


                      <div className="min-w-0 flex-1">

                        <p className="text-sm font-medium leading-6 text-slate-800">
                          {requirement.requirement}
                        </p>


                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">

                          {requirement.criterionName && (
                            <span>
                              {isArabic
                                ? 'المعيار: '
                                : 'Criterion: '}

                              {
                                requirement.criterionName
                              }
                            </span>
                          )}


                          {requirement.source && (
                            <span>
                              {isArabic
                                ? 'المصدر: '
                                : 'Source: '}

                              {
                                requirement.source
                              }
                            </span>
                          )}

                        </div>


                        {requirement.issue && (
                          <p className="mt-2 text-xs leading-5 text-rose-600">
                            {
                              requirement.issue
                            }
                          </p>
                        )}

                      </div>

                    </div>

                  </div>

                ),
              )}

            </div>

          </div>

        )}

      </div>

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
          'border-b border-[#E7EBF2] sm:border-b-0 sm:border-e',
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
/* COMPLIANCE METRIC */
/* ========================================== */

function ComplianceMetric({
  label,
  value,
  border = false,
}: {
  label: string
  value: string
  border?: boolean
}) {
  return (
    <div
      className={cn(
        'px-5 py-4 lg:px-6',

        border &&
          'border-t border-[#E7EBF2] sm:border-s sm:border-t-0',
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
/* LOADING */
/* ========================================== */

function LoadingState() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

      <div className="h-20 animate-pulse rounded-2xl bg-muted" />

      <div className="mt-5 h-20 animate-pulse rounded-2xl bg-muted" />

      <div className="mt-6 h-72 animate-pulse rounded-2xl bg-muted" />

      <div className="mt-5 h-52 animate-pulse rounded-2xl bg-muted" />

      <div className="mt-5 h-96 animate-pulse rounded-2xl bg-muted" />

    </div>
  )
}