'use client'

import {
  use,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'

import Link from 'next/link'

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'

import { evaluationsApi } from '@/lib/api'

import {
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
  params: Promise<{
    id: string
  }>
}) {
  const {
    id,
  } =
    use(params)


  const {
    isArabic,
  } =
    useLanguage()


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


  /* ========================================== */
  /* LOAD */
  /* ========================================== */

  useEffect(() => {
    let active =
      true


    evaluationsApi
      .get(id)
      .then(
        (
          data,
        ) => {
          if (!active) {
            return
          }


          setEvaluation(
            data,
          )


          setLoading(
            false,
          )
        },
      )
      .catch(
        (
          err,
        ) => {
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


          setLoading(
            false,
          )
        },
      )


    return () => {
      active =
        false
    }
  }, [
    id,
    isArabic,
  ])


  /* ========================================== */
  /* SUMMARY */
  /* ========================================== */

  const summary =
    useMemo(
      () => {
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
            (
              vendor,
            ) =>
              vendor.eligible,
          ).length


        const notEligible =
          vendors.length -
          eligible


        const highRisk =
          vendors.filter(
            (
              vendor,
            ) =>
              vendor.riskLevel ===
              'HIGH',
          ).length


        const averageCompliance =
          vendors.length >
          0
            ? vendors.reduce(
                (
                  total,
                  vendor,
                ) =>
                  total +
                  vendor.overallMandatoryCompliance,
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
      },
      [
        evaluation,
      ],
    )


  const sortedVendors =
    useMemo(
      () => {
        if (!evaluation) {
          return []
        }


        return [
          ...evaluation.vendors,
        ].sort(
          (
            a,
            b,
          ) =>
            a.rank -
            b.rank,
        )
      },
      [
        evaluation,
      ],
    )


  const topVendor =
    sortedVendors[0] ??
    null


  const ArrowIcon =
    isArabic
      ? ArrowLeft
      : ArrowRight


  /* ========================================== */
  /* LOADING */
  /* ========================================== */

  if (loading) {
    return (
      <LoadingState />
    )
  }


  /* ========================================== */
  /* ERROR */
  /* ========================================== */

  if (error) {
    return (
      <div
        className="
          min-h-screen
          bg-white
          px-5
          py-16

          sm:px-8
        "
      >

        <div
          className="
            mx-auto
            max-w-[1100px]
            border
            border-[#F1C9C9]
            bg-[#FFF8F8]
            px-6
            py-5
            text-sm
            text-[#A44444]
          "
        >
          {error}
        </div>

      </div>
    )
  }


  /* ========================================== */
  /* NOT FOUND */
  /* ========================================== */

  if (!evaluation) {
    return (
      <div
        className="
          min-h-screen
          bg-white
          px-5
          py-16

          sm:px-8
        "
      >

        <div
          className="
            mx-auto
            max-w-[1100px]
            border
            border-[#E5E7EC]
            p-10
          "
        >

          <EmptyState
            icon={
              ShieldAlert
            }
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
                nativeButton={
                  false
                }
                render={
                  <Link
                    href="/evaluations"
                  />
                }
              >
                {isArabic
                  ? 'العودة إلى سجل المنافسات'
                  : 'Back to Evaluations'}
              </Button>
            }
          />

        </div>

      </div>
    )
  }


  return (
    <div
      dir={
        isArabic
          ? 'rtl'
          : 'ltr'
      }
      className="
        min-h-screen
        bg-white
        text-[#131B4F]
      "
    >

      {/* ===================================== */}
      {/* SECTION 1 — COMPLIANCE OVERVIEW */}
      {/* ===================================== */}

      <section
        className="
          bg-[#F1ECE0]
          px-5
          py-10

          sm:px-8
          sm:py-12

          lg:px-12
          lg:py-14
        "
      >

        <div
          className="
            mx-auto
            grid
            w-full
            max-w-[1500px]
            gap-5

            xl:grid-cols-[0.68fr_1fr]
          "
        >

          {/* NAVY PANEL */}

          <div
            className="
              relative
              flex
              min-h-[520px]
              flex-col
              overflow-hidden
              bg-[#131B4F]
              p-7
              text-white

              sm:p-9

              lg:p-10
            "
          >

            <div
              className="
                pointer-events-none
                absolute
                -bottom-[160px]
                -start-[130px]
                size-[410px]
                rounded-full
                bg-[#9466C4]/22
                blur-[110px]
              "
            />


            <div
              className="
                relative
                z-10
              "
            >

              <span
                className="
                  inline-flex
                  bg-white/10
                  px-3
                  py-2
                  text-[10px]
                  font-semibold
                  tracking-[0.12em]
                  text-white
                "
              >
                {isArabic
                  ? 'الامتثال'
                  : 'COMPLIANCE REVIEW'}
              </span>


              <p
                className="
                  mt-9
                  text-[10px]
                  font-semibold
                  tracking-[0.13em]
                  text-[#CDB78F]
                "
              >
                {isArabic
                  ? 'المتطلبات الإلزامية'
                  : 'MANDATORY REQUIREMENTS'}
              </p>


              <h1
                className="
                  mt-4
                  max-w-[680px]
                  text-[clamp(40px,4.7vw,64px)]
                  font-medium
                  leading-[1.02]
                  tracking-[-0.055em]
                  text-white
                "
              >
                {isArabic
                  ? 'هنا نعرف مين اجتاز شروط المنافسة'
                  : 'See who satisfies the mandatory requirements'}
              </h1>

            </div>


            <div
              className="
                relative
                z-10
                mt-auto
                max-w-[610px]
              "
            >

              <p
                className="
                  text-[15px]
                  leading-8
                  text-white/72
                "
              >
                {isArabic
                  ? 'تراجع البوابة كل مورد مقابل البنود الإلزامية المستخرجة من إطار المنافسة. عدم استيفاء أحد هذه البنود قد يؤثر مباشرة على أهلية المورد حتى لو كانت درجته الإجمالية مرتفعة.'
                  : 'Each vendor is reviewed against mandatory requirements extracted from the competition framework. Failing one of these conditions can directly affect eligibility even when the overall score is high.'
                }
              </p>


              <div
                className="
                  mt-7
                  border-t
                  border-white/15
                  pt-5
                "
              >

                <p
                  className="
                    text-[13px]
                    leading-7
                    text-white/55
                  "
                >
                  {
                    evaluation.rfpName
                  }
                </p>

              </div>

            </div>

          </div>


          {/* OVERVIEW CARDS */}

          <div
            className="
              grid
              gap-5
            "
          >

            <ComplianceOverviewCard
              number="01"
              eyebrow={
                isArabic
                  ? 'المؤهلون'
                  : 'ELIGIBLE'
              }
              title={
                isArabic
                  ? `${summary.eligible} موردين مستوفين للشروط`
                  : `${summary.eligible} vendors satisfy eligibility`
              }
              description={
                isArabic
                  ? 'هؤلاء الموردون استوفوا شروط الأهلية الحالية حسب المتطلبات الإلزامية.'
                  : 'These vendors currently satisfy the mandatory eligibility requirements.'
              }
              icon={
                CheckCircle2
              }
            />


            <ComplianceOverviewCard
              number="02"
              eyebrow={
                isArabic
                  ? 'غير المؤهلين'
                  : 'NOT ELIGIBLE'
              }
              title={
                isArabic
                  ? `${summary.notEligible} موردين لديهم حالات عدم استيفاء`
                  : `${summary.notEligible} vendors have compliance gaps`
              }
              description={
                isArabic
                  ? 'يحتاج هؤلاء الموردون إلى مراجعة البنود غير المستوفاة قبل الانتقال للقرار النهائي.'
                  : 'These vendors require review of unmet mandatory conditions before final decision-making.'
              }
              icon={
                XCircle
              }
            />


            <ComplianceOverviewCard
              number="03"
              eyebrow={
                isArabic
                  ? 'المخاطر'
                  : 'RISK'
              }
              title={
                isArabic
                  ? `${summary.highRisk} موردين بمخاطر مرتفعة`
                  : `${summary.highRisk} vendors are high risk`
              }
              description={
                isArabic
                  ? 'ارتفاع المخاطر يساعد على تحديد العروض التي تحتاج مراجعة إضافية قبل اتخاذ القرار.'
                  : 'Risk indicators help identify proposals requiring additional review.'
              }
              icon={
                ShieldAlert
              }
            />

          </div>

        </div>

      </section>


      {/* ===================================== */}
      {/* SECTION 2 — TOP VENDOR COMPLIANCE */}
      {/* ===================================== */}

      {topVendor && (
        <section
          className="
            bg-white
            px-5
            py-16

            sm:px-8

            lg:px-12
            lg:py-20
          "
        >

          <div
            className="
              mx-auto
              grid
              w-full
              max-w-[1500px]
              gap-10

              lg:grid-cols-[330px_1fr]
            "
          >

            <div>

              <SectionEyebrow>
                {isArabic
                  ? 'المورد الأعلى ترتيبًا'
                  : 'TOP RANKED VENDOR'}
              </SectionEyebrow>


              <h2
                className="
                  mt-3
                  text-[clamp(32px,3.4vw,48px)]
                  font-medium
                  leading-[1.07]
                  tracking-[-0.045em]
                  text-[#131B4F]
                "
              >
                {isArabic
                  ? 'هل العرض المتصدر مستوفٍ للشروط؟'
                  : 'Does the leading vendor meet compliance?'}
              </h2>


              <p
                className="
                  mt-5
                  text-[15px]
                  leading-8
                  text-[#727A8C]
                "
              >
                {isArabic
                  ? 'الدرجة وحدها ما تكفي. هنا نراجع حالة الأهلية ونسبة الامتثال للمتطلبات الإلزامية.'
                  : 'Score alone is not enough. This section shows eligibility and mandatory compliance for the leading proposal.'
                }
              </p>

            </div>


            <div
              className="
                grid
                overflow-hidden

                md:grid-cols-[1fr_0.44fr]
              "
            >

              <div
                className="
                  flex
                  min-h-[330px]
                  flex-col
                  justify-between
                  bg-[#F7F7F5]
                  p-7

                  sm:p-9
                "
              >

                <div>

                  <div
                    className="
                      flex
                      flex-wrap
                      items-center
                      gap-3
                    "
                  >

                    <span
                      className="
                        text-[10px]
                        font-semibold
                        tracking-[0.13em]
                        text-[#9466C4]
                      "
                    >
                      {isArabic
                        ? 'العرض المتصدر'
                        : 'LEADING PROPOSAL'}
                    </span>


                    <span
                      className="
                        bg-white
                        px-2.5
                        py-1
                        text-[10px]
                        font-semibold
                        text-[#131B4F]
                      "
                    >
                      #{topVendor.rank}
                    </span>

                  </div>


                  <h3
                    className="
                      mt-5
                      max-w-[720px]
                      break-words
                      text-[clamp(30px,3.4vw,46px)]
                      font-medium
                      leading-[1.08]
                      tracking-[-0.045em]
                      text-[#131B4F]
                    "
                  >
                    {
                      topVendor.name
                    }
                  </h3>


                  <p
                    className="
                      mt-5
                      max-w-[720px]
                      text-[15px]
                      leading-8
                      text-[#6F7788]
                    "
                  >
                    {topVendor.complianceAssessment ||
                      (
                        isArabic
                          ? 'لم يتم إرجاع تقييم امتثال تفصيلي لهذا المورد.'
                          : 'No detailed compliance assessment was returned for this vendor.'
                      )}
                  </p>

                </div>


                <div
                  className="
                    mt-8
                    flex
                    flex-wrap
                    items-center
                    gap-3
                  "
                >

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


              <div
                className="
                  flex
                  min-h-[330px]
                  flex-col
                  justify-between
                  bg-[#131B4F]
                  p-7
                  text-white

                  sm:p-9
                "
              >

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-4
                  "
                >

                  <p
                    className="
                      text-[10px]
                      font-semibold
                      tracking-[0.13em]
                      text-[#CDB78F]
                    "
                  >
                    {isArabic
                      ? 'الامتثال الإلزامي'
                      : 'MANDATORY COMPLIANCE'}
                  </p>


                  <ShieldCheck
                    className="
                      size-5
                      text-[#CDB78F]
                    "
                  />

                </div>


                <div>

                  <p
                    className="
                      text-[clamp(62px,6.7vw,94px)]
                      font-light
                      leading-none
                      tracking-[-0.075em]
                    "
                  >
                    {formatPercent(
                      topVendor.overallMandatoryCompliance,
                      1,
                    )}
                  </p>


                  <p
                    className="
                      mt-5
                      text-[13px]
                      leading-7
                      text-white/60
                    "
                  >
                    {isArabic
                      ? `${topVendor.missingRequirements.length} متطلبات إلزامية غير مستوفاة`
                      : `${topVendor.missingRequirements.length} mandatory requirements outstanding`}
                  </p>

                </div>


                <Link
                  href={`/evaluations/${id}/vendors/${topVendor.id}`}
                  className="
                    group
                    inline-flex
                    w-fit
                    items-center
                    gap-2
                    text-sm
                    font-semibold
                    text-white
                  "
                >

                  {isArabic
                    ? 'عرض تفاصيل المورد'
                    : 'View vendor details'}


                  <ArrowIcon
                    className={cn(
                      `
                        size-4
                        transition-transform
                        duration-300
                      `,

                      isArabic
                        ? 'group-hover:-translate-x-1'
                        : 'group-hover:translate-x-1',
                    )}
                  />

                </Link>

              </div>

            </div>

          </div>

        </section>
      )}


      {/* ===================================== */}
      {/* SECTION 3 — COMPLIANCE SNAPSHOT */}
      {/* ===================================== */}

      <section
        className="
          bg-[#F1ECE0]
          px-5
          py-16

          sm:px-8

          lg:px-12
          lg:py-20
        "
      >

        <div
          className="
            mx-auto
            w-full
            max-w-[1500px]
          "
        >

          <SectionEyebrow>
            {isArabic
              ? 'ملخص الامتثال'
              : 'COMPLIANCE SNAPSHOT'}
          </SectionEyebrow>


          <h2
            className="
              mt-3
              text-[32px]
              font-medium
              tracking-[-0.04em]
              text-[#131B4F]

              sm:text-[40px]
            "
          >
            {isArabic
              ? 'الأرقام الرئيسية'
              : 'Key compliance numbers'}
          </h2>


          <div
            className="
              mt-10
              grid
              border-y
              border-[#D8CCB6]

              sm:grid-cols-2

              xl:grid-cols-4
            "
          >

            <ComplianceSnapshotMetric
              value={
                formatPercent(
                  summary.averageCompliance,
                  1,
                )
              }
              label={
                isArabic
                  ? 'متوسط الامتثال'
                  : 'Average compliance'
              }
              helper={
                isArabic
                  ? 'متوسط تغطية البنود الإلزامية'
                  : 'Mandatory requirement coverage'
              }
            />


            <ComplianceSnapshotMetric
              value={
                String(
                  summary.eligible,
                )
              }
              label={
                isArabic
                  ? 'المؤهلون'
                  : 'Eligible vendors'
              }
              helper={
                isArabic
                  ? 'اجتازوا شروط الأهلية'
                  : 'Passed eligibility conditions'
              }
            />


            <ComplianceSnapshotMetric
              value={
                String(
                  summary.notEligible,
                )
              }
              label={
                isArabic
                  ? 'غير المؤهلين'
                  : 'Not eligible'
              }
              helper={
                isArabic
                  ? 'لديهم حالات عدم استيفاء'
                  : 'Have compliance gaps'
              }
            />


            <ComplianceSnapshotMetric
              value={
                String(
                  summary.highRisk,
                )
              }
              label={
                isArabic
                  ? 'مخاطر مرتفعة'
                  : 'High risk'
              }
              helper={
                isArabic
                  ? 'يحتاجون مراجعة إضافية'
                  : 'Require additional review'
              }
              last
            />

          </div>

        </div>

      </section>


      {/* ===================================== */}
      {/* SECTION 4 — COMPLIANCE BY VENDOR */}
      {/* ===================================== */}

      <section
        className="
          bg-[#F7F7F5]
          px-5
          py-16

          sm:px-8

          lg:px-12
          lg:py-20
        "
      >

        <div
          className="
            mx-auto
            w-full
            max-w-[1500px]
          "
        >

          <div
            className="
              grid
              gap-8

              lg:grid-cols-[330px_1fr]
            "
          >

            <div>

              <SectionEyebrow>
                {isArabic
                  ? 'نتائج الموردين'
                  : 'VENDOR COMPLIANCE'}
              </SectionEyebrow>


              <h2
                className="
                  mt-3
                  text-[clamp(32px,3.4vw,46px)]
                  font-medium
                  leading-[1.08]
                  tracking-[-0.045em]
                  text-[#131B4F]
                "
              >
                {isArabic
                  ? 'راجع حالة كل مورد'
                  : 'Review compliance vendor by vendor'}
              </h2>


              <p
                className="
                  mt-5
                  text-[15px]
                  leading-8
                  text-[#727A8C]
                "
              >
                {isArabic
                  ? 'كل مورد يعرض نسبة الامتثال، الأهلية، مستوى المخاطر، والمتطلبات الإلزامية التي ما زالت غير مستوفاة.'
                  : 'Each vendor shows compliance, eligibility, risk, and any mandatory requirements that remain outstanding.'
                }
              </p>

            </div>


            <div
              className="
                space-y-4
              "
            >

              {sortedVendors.map(
                (
                  vendor,
                ) => (
                  <VendorComplianceCard
                    key={
                      vendor.id
                    }
                    vendor={
                      vendor
                    }
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

          </div>

        </div>

      </section>


      {/* ===================================== */}
      {/* SECTION 5 — NEXT STEP */}
      {/* ===================================== */}

      <section
        className="
          bg-[#F1ECE0]
          px-5
          py-12

          sm:px-8

          lg:px-12
          lg:py-14
        "
      >

        <div
          className="
            mx-auto
            w-full
            max-w-[1500px]
          "
        >

          <div
            className="
              grid
              overflow-hidden
              bg-white

              lg:grid-cols-[1fr_auto]
            "
          >

            <div
              className="
                px-6
                py-7

                sm:px-8

                lg:px-10
              "
            >

              <SectionEyebrow>
                {isArabic
                  ? 'الخطوة التالية'
                  : 'NEXT STEP'}
              </SectionEyebrow>


              <h2
                className="
                  mt-2
                  text-[26px]
                  font-medium
                  tracking-[-0.035em]
                  text-[#131B4F]

                  sm:text-[30px]
                "
              >
                {isArabic
                  ? 'راجع التقرير النهائي قبل اتخاذ القرار'
                  : 'Review the final report before making a decision'}
              </h2>


              <p
                className="
                  mt-3
                  max-w-[780px]
                  text-[14px]
                  leading-7
                  text-[#70788A]
                "
              >
                {isArabic
                  ? 'بعد مراجعة الدرجات والامتثال، انتقل للتقرير النهائي لمراجعة خلاصة المنافسة والنتائج النهائية.'
                  : 'After reviewing scores and compliance, move to the final report for the complete competition outcome.'
                }
              </p>

            </div>


            <Link
              href={`/evaluations/${id}/report`}
              className="
                group
                flex
                min-h-[88px]
                min-w-[230px]
                items-center
                justify-center
                gap-3
                bg-[#131B4F]
                px-7
                text-sm
                font-semibold
                text-white
                transition-all
                duration-300

                hover:bg-[#1D208E]

                lg:min-h-full
              "
            >

              {isArabic
                ? 'عرض التقرير النهائي'
                : 'View Final Report'}


              <ArrowIcon
                className={cn(
                  `
                    size-4
                    transition-transform
                    duration-300
                  `,

                  isArabic
                    ? 'group-hover:-translate-x-1'
                    : 'group-hover:translate-x-1',
                )}
              />

            </Link>

          </div>

        </div>

      </section>

    </div>
  )
}


/* ========================================== */
/* COMPLIANCE OVERVIEW CARD */
/* ========================================== */

function ComplianceOverviewCard({
  number,
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  number: string
  eyebrow: string
  title: string
  description: string
  icon: ComponentType<{
    className?: string
  }>
}) {
  return (
    <article
      className="
        grid
        min-h-[155px]
        grid-cols-[1fr_auto]
        gap-6
        bg-white
        px-6
        py-6

        sm:px-8
      "
    >

      <div
        className="
          flex
          items-start
          gap-4
        "
      >

        <div
          className="
            mt-1
            flex
            size-9
            shrink-0
            items-center
            justify-center
            bg-[#F1ECE0]
            text-[#131B4F]
          "
        >

          <Icon
            className="
              size-4
            "
          />

        </div>


        <div>

          <p
            className="
              text-[10px]
              font-semibold
              tracking-[0.12em]
              text-[#9466C4]
            "
          >
            {eyebrow}
          </p>


          <h3
            className="
              mt-2
              text-[21px]
              font-medium
              leading-[1.18]
              tracking-[-0.03em]
              text-[#131B4F]

              sm:text-[24px]
            "
          >
            {title}
          </h3>


          <p
            className="
              mt-3
              max-w-[680px]
              text-[14px]
              leading-7
              text-[#737B8D]
            "
          >
            {description}
          </p>

        </div>

      </div>


      <span
        className="
          text-[46px]
          font-light
          leading-none
          tracking-[-0.06em]
          text-[#131B4F]

          sm:text-[54px]
        "
      >
        {number}
      </span>

    </article>
  )
}


/* ========================================== */
/* SECTION EYEBROW */
/* ========================================== */

function SectionEyebrow({
  children,
}: {
  children: ReactNode
}) {
  return (
    <p
      className="
        text-[10px]
        font-semibold
        tracking-[0.13em]
        text-[#9466C4]
      "
    >
      {children}
    </p>
  )
}


/* ========================================== */
/* SNAPSHOT METRIC */
/* ========================================== */

function ComplianceSnapshotMetric({
  value,
  label,
  helper,
  last = false,
}: {
  value: string
  label: string
  helper: string
  last?: boolean
}) {
  return (
    <div
      className={cn(
        `
          min-h-[175px]
          py-7

          sm:px-6
        `,

        !last &&
          `
            border-b
            border-[#D8CCB6]

            sm:border-e

            xl:border-b-0
          `,
      )}
    >

      <p
        className="
          text-[clamp(38px,3.7vw,52px)]
          font-medium
          leading-none
          tracking-[-0.055em]
          text-[#131B4F]
        "
      >
        {value}
      </p>


      <p
        className="
          mt-5
          text-xs
          font-semibold
          text-[#131B4F]
        "
      >
        {label}
      </p>


      <p
        className="
          mt-2
          text-[13px]
          leading-6
          text-[#7F776A]
        "
      >
        {helper}
      </p>

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
    vendor.missingRequirements.length >
    0


  const shouldScroll =
    vendor.missingRequirements.length >
    8


  return (
    <article
      className="
        overflow-hidden
        border
        border-[#E3E5EA]
        bg-white
        transition-all
        duration-300

        hover:border-[#CDD1DA]
        hover:shadow-[0_14px_32px_rgba(19,27,79,0.055)]
      "
    >

      {/* HEADER */}

      <div
        className="
          flex
          flex-col
          gap-5
          border-b
          border-[#ECEEF2]
          px-5
          py-5

          sm:flex-row
          sm:items-center
          sm:justify-between

          lg:px-6
        "
      >

        <div>

          <div
            className="
              flex
              flex-wrap
              items-center
              gap-3
            "
          >

            <span
              className="
                flex
                size-9
                shrink-0
                items-center
                justify-center
                bg-[#F4F5F7]
                text-xs
                font-semibold
                text-[#131B4F]
              "
            >
              #{vendor.rank}
            </span>


            <h3
              className="
                text-[19px]
                font-medium
                tracking-[-0.025em]
                text-[#131B4F]
              "
            >
              {vendor.name}
            </h3>

          </div>


          <div
            className="
              mt-3
              flex
              flex-wrap
              gap-2
            "
          >

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

        </div>


        <Link
          href={`/evaluations/${evaluationId}/vendors/${vendor.id}`}
          className="
            group
            inline-flex
            items-center
            gap-2
            text-sm
            font-semibold
            text-[#131B4F]
          "
        >

          {isArabic
            ? 'تفاصيل المورد'
            : 'Vendor details'}


          <ArrowRight
            className={cn(
              `
                size-4
                transition-transform
                duration-300
              `,

              isArabic &&
                'rotate-180',

              isArabic
                ? 'group-hover:-translate-x-1'
                : 'group-hover:translate-x-1',
            )}
          />

        </Link>

      </div>


      {/* METRICS */}

      <div
        className="
          grid
          border-b
          border-[#ECEEF2]

          sm:grid-cols-3
        "
      >

        <VendorMetric
          label={
            isArabic
              ? 'الامتثال الإلزامي'
              : 'Mandatory compliance'
          }
          value={
            formatPercent(
              vendor.overallMandatoryCompliance,
              1,
            )
          }
        />


        <VendorMetric
          label={
            isArabic
              ? 'الدرجة الإجمالية'
              : 'Overall score'
          }
          value={
            formatPercent(
              vendor.overallScore,
              1,
            )
          }
        />


        <VendorMetric
          label={
            isArabic
              ? 'غير المستوفى'
              : 'Outstanding'
          }
          value={
            String(
              vendor.missingRequirements.length,
            )
          }
          last
        />

      </div>


      {/* ASSESSMENT */}

      <div
        className="
          px-5
          py-5

          lg:px-6
        "
      >

        <p
          className="
            text-[10px]
            font-semibold
            tracking-[0.12em]
            text-[#9466C4]
          "
        >
          {isArabic
            ? 'تقييم الامتثال'
            : 'COMPLIANCE ASSESSMENT'}
        </p>


        <p
          className="
            mt-3
            max-w-[1050px]
            text-[14px]
            leading-7
            text-[#646D7F]
          "
        >
          {vendor.complianceAssessment ||
            (
              isArabic
                ? 'لم يتم إرجاع تقييم امتثال لهذا المورد.'
                : 'No compliance assessment was returned for this vendor.'
            )}
        </p>

      </div>


      {/* OUTSTANDING REQUIREMENTS */}

      <div
        className="
          border-t
          border-[#ECEEF2]
          bg-[#FAFBFC]
        "
      >

        <div
          className="
            flex
            flex-col
            gap-3
            border-b
            border-[#ECEEF2]
            px-5
            py-4

            sm:flex-row
            sm:items-center
            sm:justify-between

            lg:px-6
          "
        >

          <div>

            <h4
              className="
                text-sm
                font-semibold
                text-[#131B4F]
              "
            >
              {isArabic
                ? 'المتطلبات الإلزامية غير المستوفاة'
                : 'Outstanding mandatory requirements'}
            </h4>


            <p
              className="
                mt-1
                text-xs
                text-[#7D8595]
              "
            >
              {isArabic
                ? 'البنود التي لم يظهر في العرض ما يكفي لإثبات استيفائها.'
                : 'Requirements not sufficiently demonstrated by the proposal.'
              }
            </p>

          </div>


          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            {shouldScroll && (
              <span
                className="
                  text-[11px]
                  text-[#969DAC]
                "
              >
                {isArabic
                  ? 'مرر لعرض الكل'
                  : 'Scroll to view all'}
              </span>
            )}


            <span
              className={cn(
                `
                  px-2.5
                  py-1
                  text-xs
                  font-semibold
                `,

                hasMissing
                  ? `
                      bg-[#FFF1F1]
                      text-[#A44444]
                    `
                  : `
                      bg-[#EEF8F2]
                      text-[#25724C]
                    `,
              )}
            >
              {isArabic
                ? `${vendor.missingRequirements.length} متبقي`
                : `${vendor.missingRequirements.length} outstanding`}
            </span>

          </div>

        </div>


        {!hasMissing ? (
          <div
            className="
              bg-white
              px-5
              py-5

              lg:px-6
            "
          >

            <div
              className="
                flex
                items-center
                gap-2
                border
                border-[#D7EBDD]
                bg-[#F5FBF7]
                px-4
                py-3
                text-sm
                text-[#25724C]
              "
            >

              <CheckCircle2
                className="
                  size-4
                  shrink-0
                "
              />


              {isArabic
                ? 'لم يتم تحديد متطلبات إلزامية مفقودة لهذا المورد.'
                : 'No missing mandatory requirements were identified for this vendor.'}

            </div>

          </div>
        ) : (
          <div
            className={cn(
              `
                bg-[#F8F9FB]
                p-4

                sm:p-5
              `,

              shouldScroll &&
                `
                  max-h-[460px]
                  overflow-y-auto
                  overscroll-contain

                  [scrollbar-color:#B9BEC8_transparent]
                  [scrollbar-width:thin]

                  [&::-webkit-scrollbar]:w-[7px]

                  [&::-webkit-scrollbar-track]:bg-transparent

                  [&::-webkit-scrollbar-thumb]:rounded-full
                  [&::-webkit-scrollbar-thumb]:bg-[#B9BEC8]

                  hover:[&::-webkit-scrollbar-thumb]:bg-[#9299A8]
                `,
            )}
          >

            <div
              className="
                grid
                gap-3

                lg:grid-cols-2
              "
            >

              {vendor.missingRequirements.map(
                (
                  requirement,
                  index,
                ) => (
                  <MissingRequirementCard
                    key={
                      requirement.requirementId
                    }
                    index={
                      index + 1
                    }
                    requirement={
                      requirement
                    }
                    isArabic={
                      isArabic
                    }
                  />
                ),
              )}

            </div>

          </div>
        )}

      </div>

    </article>
  )
}


/* ========================================== */
/* MISSING REQUIREMENT */
/* ========================================== */

function MissingRequirementCard({
  index,
  requirement,
  isArabic,
}: {
  index: number
  requirement: Vendor['missingRequirements'][number]
  isArabic: boolean
}) {
  return (
    <article
      className="
        border
        border-[#E6E8ED]
        bg-white
        px-4
        py-4
        transition-colors
        duration-200

        hover:border-[#D5D9E1]

        sm:px-5
      "
    >

      <div
        className="
          flex
          items-start
          gap-4
        "
      >

        <span
          className="
            pt-0.5
            text-[10px]
            font-semibold
            tracking-[0.1em]
            text-[#A0A6B2]
          "
        >
          {String(
            index,
          ).padStart(
            2,
            '0',
          )}
        </span>


        <div
          className="
            min-w-0
            flex-1
          "
        >

          <div
            className="
              flex
              items-start
              gap-3
            "
          >

            <ShieldAlert
              className="
                mt-1
                size-4
                shrink-0
                text-[#A44444]
              "
            />


            <p
              className="
                text-[14px]
                font-medium
                leading-7
                text-[#3E4658]
              "
            >
              {
                requirement.requirement
              }
            </p>

          </div>


          {(requirement.criterionName ||
            requirement.source) && (
            <div
              className="
                mt-3
                flex
                flex-wrap
                gap-x-4
                gap-y-1
                border-t
                border-[#ECEEF2]
                pt-3
                text-[11px]
                text-[#8B92A0]
              "
            >

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
          )}


          {requirement.issue && (
            <p
              className="
                mt-3
                text-xs
                leading-6
                text-[#A44444]
              "
            >
              {
                requirement.issue
              }
            </p>
          )}

        </div>

      </div>

    </article>
  )
}


/* ========================================== */
/* VENDOR METRIC */
/* ========================================== */

function VendorMetric({
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
        `
          px-5
          py-4

          lg:px-6
        `,

        !last &&
          `
            border-b
            border-[#ECEEF2]

            sm:border-b-0
            sm:border-e
          `,
      )}
    >

      <p
        className="
          text-[10px]
          font-medium
          text-[#8C94A4]
        "
      >
        {label}
      </p>


      <p
        className="
          mt-2
          text-[22px]
          font-semibold
          tracking-[-0.04em]
          text-[#131B4F]
        "
      >
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
        bg-[#EEF8F2]
        px-2.5
        py-1.5
        text-xs
        font-semibold
        text-[#25724C]
      "
    >

      <CheckCircle2
        className="
          size-3.5
        "
      />


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
        bg-[#FFF1F1]
        px-2.5
        py-1.5
        text-xs
        font-semibold
        text-[#A44444]
      "
    >

      <XCircle
        className="
          size-3.5
        "
      />


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
      'bg-[#EEF8F2] text-[#25724C]',

    MEDIUM:
      'bg-[#FFF8E8] text-[#966515]',

    HIGH:
      'bg-[#FFF1F1] text-[#A44444]',
  }


  const arabicLabels = {
    LOW:
      'مخاطر منخفضة',

    MEDIUM:
      'مخاطر متوسطة',

    HIGH:
      'مخاطر مرتفعة',
  }


  return (
    <span
      className={cn(
        `
          inline-flex
          w-fit
          items-center
          gap-1.5
          px-2.5
          py-1.5
          text-xs
          font-semibold
        `,

        styles[risk],
      )}
    >

      <ShieldAlert
        className="
          size-3.5
        "
      />


      {isArabic
        ? arabicLabels[risk]
        : `${
            risk.charAt(
              0,
            ) +
            risk
              .slice(
                1,
              )
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
    <div
      className="
        min-h-screen
        bg-white
      "
    >

      <div
        className="
          bg-[#F1ECE0]
          px-5
          py-10

          sm:px-8

          lg:px-12
        "
      >

        <div
          className="
            mx-auto
            grid
            max-w-[1500px]
            gap-5

            xl:grid-cols-[0.68fr_1fr]
          "
        >

          <div
            className="
              h-[520px]
              animate-pulse
              bg-[#131B4F]/90
            "
          />


          <div
            className="
              grid
              gap-5
            "
          >

            <div
              className="
                h-[155px]
                animate-pulse
                bg-white
              "
            />


            <div
              className="
                h-[155px]
                animate-pulse
                bg-white
              "
            />


            <div
              className="
                h-[155px]
                animate-pulse
                bg-white
              "
            />

          </div>

        </div>

      </div>


      <div
        className="
          mx-auto
          max-w-[1500px]
          px-5
          py-16

          sm:px-8

          lg:px-12
        "
      >

        <div
          className="
            h-[300px]
            animate-pulse
            bg-[#F5F6F8]
          "
        />


        <div
          className="
            mt-12
            h-[180px]
            animate-pulse
            bg-[#F5F6F8]
          "
        />


        <div
          className="
            mt-12
            h-[520px]
            animate-pulse
            bg-[#F5F6F8]
          "
        />

      </div>

    </div>
  )
}