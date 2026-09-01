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
  GitCompareArrows,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { evaluationsApi } from '@/lib/api'
import { formatDate, formatPercent } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/context'

import type {
  Evaluation,
  Vendor,
} from '@/lib/types'


export default function EvaluationComparisonPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = use(params)

  const {
    language,
    isArabic,
  } = useLanguage()

  const [
    evaluation,
    setEvaluation,
  ] = useState<Evaluation | null>(null)

  const [
    vendors,
    setVendors,
  ] = useState<Vendor[]>([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  /* ========================================== */
  /* LOAD */
  /* ========================================== */

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

          setLoading(
            false,
          )
        },
      )
      .catch(
        (
          error,
        ) => {
          console.error(
            'Failed to load vendor comparison:',
            error,
          )

          if (!active) {
            return
          }

          setEvaluation(
            null,
          )

          setVendors(
            [],
          )

          setLoading(
            false,
          )
        },
      )

    return () => {
      active = false
    }
  }, [
    id,
  ])

  /* ========================================== */
  /* DERIVED DATA */
  /* ========================================== */

  const sortedVendors =
    useMemo(
      () =>
        [...vendors].sort(
          (
            a,
            b,
          ) =>
            a.rank -
            b.rank,
        ),
      [
        vendors,
      ],
    )

  const topVendor =
    sortedVendors[0] ??
    null

  const eligibleVendors =
    useMemo(
      () =>
        sortedVendors.filter(
          (
            vendor,
          ) =>
            vendor.eligible,
        ),
      [
        sortedVendors,
      ],
    )

  const eligibleCount =
    eligibleVendors.length

  const highestEligibleVendor =
    eligibleVendors[0] ??
    null

  const recommendedVendor =
    evaluation?.recommendedVendor
      ? sortedVendors.find(
          (
            vendor,
          ) =>
            vendor.name ===
            evaluation.recommendedVendor,
        ) ??
        null
      : null

  const noEligibleVendor =
    evaluation?.recommendationStatus ===
      'NO_ELIGIBLE_VENDOR'
    ||
    eligibleCount === 0

  const highestScore =
    topVendor?.overallScore ??
    0

  const averageCompliance =
    sortedVendors.length >
    0
      ? sortedVendors.reduce(
          (
            sum,
            vendor,
          ) =>
            sum +
            vendor.overallMandatoryCompliance,
          0,
        ) /
        sortedVendors.length
      : 0

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
              GitCompareArrows
            }
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
      {/* SECTION 1 — COMPARISON OVERVIEW */}
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
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4
                "
              >
                <span
                  className="
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
                    ? 'مقارنة الموردين'
                    : 'VENDOR COMPARISON'}
                </span>

                <span
                  className="
                    text-xs
                    text-white/45
                  "
                >
                  #{evaluation.id}
                </span>
              </div>

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
                  ? 'مقارنة موحدة'
                  : 'SIDE-BY-SIDE REVIEW'}
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
                  ? 'شوف الفرق بين عروض الموردين بوضوح'
                  : 'See how vendor proposals compare'}
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
                  ? 'تقارن الصفحة الدرجات والامتثال والأهلية والمخاطر على نفس إطار المنافسة، مع فصل أعلى نتيجة رقمية عن التوصية النهائية.'
                  : 'Compare scores, compliance, eligibility, and risk on the same evaluation framework while keeping the highest numeric score separate from the final recommendation.'}
              </p>

              <div
                className="
                  mt-7
                  flex
                  flex-wrap
                  items-center
                  gap-x-5
                  gap-y-2
                  border-t
                  border-white/15
                  pt-5
                  text-[13px]
                  text-white/55
                "
              >
                <span>
                  {
                    evaluation.rfpName
                  }
                </span>

                <span
                  className="
                    hidden
                    size-1
                    rounded-full
                    bg-white/30
                    sm:block
                  "
                />

                <span>
                  {formatDate(
                    evaluation.createdDate,
                    language,
                  )}
                </span>
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
            <ComparisonOverviewCard
              number="01"
              eyebrow={
                isArabic
                  ? 'العروض المقارنة'
                  : 'PROPOSALS COMPARED'
              }
              title={
                isArabic
                  ? `${sortedVendors.length} عروض في المقارنة`
                  : `${sortedVendors.length} proposals compared`
              }
              description={
                isArabic
                  ? 'تم تقييم جميع الموردين على نفس المعايير والأوزان لضمان مقارنة موحدة.'
                  : 'Every vendor was evaluated using the same criteria and weights for a consistent comparison.'
              }
              icon={
                Users
              }
            />

            <ComparisonOverviewCard
              number="02"
              eyebrow={
                isArabic
                  ? 'الأهلية'
                  : 'ELIGIBILITY'
              }
              title={
                isArabic
                  ? `${eligibleCount} موردين مستوفين للأهلية`
                  : `${eligibleCount} eligible vendors`
              }
              description={
                isArabic
                  ? 'الأهلية مستقلة عن ترتيب الدرجات، وتعتمد على استيفاء المتطلبات الإلزامية.'
                  : 'Eligibility is separate from score ranking and depends on satisfying mandatory requirements.'
              }
              icon={
                ShieldCheck
              }
            />

            <ComparisonOverviewCard
              number="03"
              eyebrow={
                noEligibleVendor
                  ? (
                    isArabic
                      ? 'حالة التوصية'
                      : 'RECOMMENDATION STATUS'
                  )
                  : (
                    isArabic
                      ? 'المورد الموصى به'
                      : 'RECOMMENDED VENDOR'
                  )
              }
              title={
                noEligibleVendor
                  ? (
                    isArabic
                      ? 'لا يوجد مورد مؤهل حاليًا'
                      : 'No vendor is currently eligible'
                  )
                  : (
                    recommendedVendor?.name ??
                    highestEligibleVendor?.name ??
                    (
                      isArabic
                        ? 'تتطلب النتيجة مراجعة بشرية'
                        : 'Human review is required'
                    )
                  )
              }
              description={
                noEligibleVendor
                  ? (
                    topVendor
                      ? (
                        isArabic
                          ? `أعلى نتيجة رقمية هي ${formatPercent(
                              topVendor.overallScore,
                              1,
                            )}، لكنها لا تمثل توصية لأن المورد غير مستوفٍ للأهلية.`
                          : `The highest numeric score is ${formatPercent(
                              topVendor.overallScore,
                              1,
                            )}, but it is not a recommendation because the vendor is not eligible.`
                      )
                      : (
                        isArabic
                          ? 'لا توجد نتائج موردين متاحة.'
                          : 'No vendor results are available.'
                      )
                  )
                  : (
                    isArabic
                      ? 'يعكس هذا الحقل التوصية الفعلية من نتيجة التقييم، وليس مجرد أعلى درجة رقمية.'
                      : 'This reflects the actual recommendation returned by the evaluation, not simply the highest numeric score.'
                  )
              }
              icon={
                noEligibleVendor
                  ? ShieldAlert
                  : Trophy
              }
            />
          </div>
        </div>
      </section>

      {/* ===================================== */}
      {/* SECTION 2 — HIGHEST SCORE */}
      {/* ===================================== */}

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
            w-full
            max-w-[1500px]
          "
        >
          <div
            className="
              grid
              gap-10
              lg:grid-cols-[330px_1fr]
            "
          >
            <div>
              <SectionEyebrow>
                {isArabic
                  ? 'أعلى نتيجة رقمية'
                  : 'HIGHEST NUMERIC SCORE'}
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
                  ? 'من حصل على أعلى درجة؟'
                  : 'Who received the highest score?'}
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
                  ? 'أعلى درجة موزونة لا تعني تلقائيًا أن المورد مؤهل أو موصى به. لذلك نعرض الأهلية والتوصية بشكل منفصل.'
                  : 'The highest weighted score does not automatically mean the vendor is eligible or recommended, so eligibility and recommendation are shown separately.'}
              </p>
            </div>

            {topVendor ? (
              <div
                className="
                  grid
                  overflow-hidden
                  md:grid-cols-[1fr_0.42fr]
                "
              >
                <div
                  className="
                    flex
                    min-h-[340px]
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
                          ? 'أعلى نتيجة'
                          : 'HIGHEST SCORE'}
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
                        max-w-[700px]
                        break-words
                        text-[clamp(30px,3.4vw,48px)]
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
                        max-w-[760px]
                        text-[15px]
                        leading-8
                        text-[#6F7788]
                      "
                    >
                      {isArabic
                        ? topVendor.eligible
                          ? `حقق العرض درجة ${formatPercent(
                              topVendor.overallScore,
                              1,
                            )} مع امتثال إلزامي ${formatPercent(
                              topVendor.overallMandatoryCompliance,
                              1,
                            )}، وهو مستوفٍ للأهلية وفق نتائج التقييم الحالية.`
                          : `حقق العرض أعلى درجة رقمية وهي ${formatPercent(
                              topVendor.overallScore,
                              1,
                            )}، لكنه غير مستوفٍ للأهلية. لا تُعد هذه النتيجة توصية نهائية قبل مراجعة فجوات الامتثال.`
                        : topVendor.eligible
                          ? `The proposal scored ${formatPercent(
                              topVendor.overallScore,
                              1,
                            )} with ${formatPercent(
                              topVendor.overallMandatoryCompliance,
                              1,
                            )} mandatory compliance and is currently eligible.`
                          : `The proposal has the highest numeric score at ${formatPercent(
                              topVendor.overallScore,
                              1,
                            )}, but it is not eligible. This should not be treated as a final recommendation before compliance review.`}
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
                    min-h-[340px]
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
                        ? 'الدرجة الموزونة'
                        : 'WEIGHTED SCORE'}
                    </p>

                    <Trophy
                      className="
                        size-5
                        text-[#CDB78F]
                      "
                    />
                  </div>

                  <div>
                    <p
                      className="
                        text-[clamp(64px,7vw,96px)]
                        font-light
                        leading-none
                        tracking-[-0.075em]
                      "
                    >
                      {formatPercent(
                        topVendor.overallScore,
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
                        ? `الامتثال الإلزامي ${formatPercent(
                            topVendor.overallMandatoryCompliance,
                            1,
                          )}`
                        : `Mandatory compliance ${formatPercent(
                            topVendor.overallMandatoryCompliance,
                            1,
                          )}`}
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
            ) : (
              <div
                className="
                  border
                  border-dashed
                  border-[#D7DBE4]
                  px-6
                  py-14
                  text-center
                "
              >
                <GitCompareArrows
                  className="
                    mx-auto
                    size-7
                    text-[#9AA1AF]
                  "
                />

                <p
                  className="
                    mt-3
                    text-sm
                    font-medium
                    text-[#727A8C]
                  "
                >
                  {isArabic
                    ? 'لا توجد نتائج للموردين'
                    : 'No vendor results available'}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===================================== */}
      {/* SECTION 3 — SNAPSHOT */}
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
              ? 'ملخص المقارنة'
              : 'COMPARISON SNAPSHOT'}
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
              : 'Key comparison numbers'}
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
            <ComparisonMetric
              value={
                String(
                  sortedVendors.length,
                )
              }
              label={
                isArabic
                  ? 'العروض المقارنة'
                  : 'Vendors compared'
              }
              helper={
                isArabic
                  ? 'إجمالي العروض المقيمة'
                  : 'Total evaluated proposals'
              }
            />

            <ComparisonMetric
              value={
                String(
                  eligibleCount,
                )
              }
              label={
                isArabic
                  ? 'الموردون المؤهلون'
                  : 'Eligible vendors'
              }
              helper={
                isArabic
                  ? 'استوفوا متطلبات الأهلية'
                  : 'Passed eligibility conditions'
              }
            />

            <ComparisonMetric
              value={
                formatPercent(
                  highestScore,
                  1,
                )
              }
              label={
                isArabic
                  ? 'أعلى نتيجة'
                  : 'Highest score'
              }
              helper={
                isArabic
                  ? 'أعلى درجة موزونة بين العروض'
                  : 'Highest weighted score among proposals'
              }
            />

            <ComparisonMetric
              value={
                formatPercent(
                  averageCompliance,
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
                  ? 'متوسط استيفاء المتطلبات الإلزامية'
                  : 'Average mandatory compliance'
              }
              last
            />
          </div>
        </div>
      </section>

      {/* ===================================== */}
      {/* SECTION 4 — ALL VENDORS */}
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
                  ? 'أداء الموردين'
                  : 'VENDOR PERFORMANCE'}
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
                  ? 'قارن كل عرض بشكل مباشر'
                  : 'Compare every proposal directly'}
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
                  ? 'كل عرض يعرض الدرجة والامتثال والأهلية والمخاطر بنفس الشكل، بدون خلط بين الترتيب والتوصية.'
                  : 'Each proposal shows score, compliance, eligibility, and risk in the same format without confusing ranking with recommendation.'}
              </p>
            </div>

            <div>
              {sortedVendors.length === 0 ? (
                <div
                  className="
                    bg-white
                    px-6
                    py-16
                    text-center
                  "
                >
                  <GitCompareArrows
                    className="
                      mx-auto
                      size-8
                      text-[#9AA1AF]
                    "
                  />

                  <h3
                    className="
                      mt-3
                      text-base
                      font-semibold
                      text-[#131B4F]
                    "
                  >
                    {isArabic
                      ? 'لا توجد نتائج للموردين'
                      : 'No vendor results available'}
                  </h3>
                </div>
              ) : (
                <div
                  className={cn(
                    `
                      grid
                      gap-4
                    `,
                    sortedVendors.length ===
                      1 &&
                      'grid-cols-1',
                    sortedVendors.length ===
                      2 &&
                      'lg:grid-cols-2',
                    sortedVendors.length >=
                      3 &&
                      `
                        lg:grid-cols-2
                        2xl:grid-cols-3
                      `,
                  )}
                >
                  {sortedVendors.map(
                    (
                      vendor,
                    ) => (
                      <VendorSummaryCard
                        key={
                          vendor.id
                        }
                        vendor={
                          vendor
                        }
                        evaluationId={
                          id
                        }
                        isArabic={
                          isArabic
                        }
                      />
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===================================== */}
      {/* SECTION 5 — CRITERIA COMPARISON */}
      {/* ===================================== */}

      {sortedVendors.length >
        0 && (
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
                    ? 'مقارنة المعايير'
                    : 'CRITERIA COMPARISON'}
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
                    ? 'وين يتفوق كل مورد؟'
                    : 'Where does each vendor perform best?'}
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
                    ? 'علامة الأفضل تُحسب لكل معيار على حدة، وليس حسب ترتيب المورد العام.'
                    : 'The best marker is calculated per criterion rather than using the vendor’s overall rank.'}
                </p>
              </div>

              <div
                className="
                  overflow-hidden
                  border
                  border-[#E3E5EA]
                  bg-white
                "
              >
                <CriteriaComparisonTable
                  vendors={
                    sortedVendors
                  }
                  isArabic={
                    isArabic
                  }
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===================================== */}
      {/* SECTION 6 — NEXT STEP */}
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
                {noEligibleVendor
                  ? (
                    isArabic
                      ? 'لا يوجد مورد مؤهل — راجع فجوات الامتثال'
                      : 'No vendor is eligible — review compliance gaps'
                  )
                  : (
                    isArabic
                      ? 'راجع الامتثال قبل الانتقال للقرار النهائي'
                      : 'Review compliance before the final decision'
                  )}
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
                {noEligibleVendor
                  ? (
                    isArabic
                      ? 'جميع العروض الحالية غير مستوفية للأهلية. راجع المتطلبات الإلزامية غير المستوفاة قبل أي قرار أو توصية.'
                      : 'All current proposals are ineligible. Review unmet mandatory requirements before making any decision or recommendation.'
                  )
                  : (
                    isArabic
                      ? 'بعد مقارنة الدرجات، راجع المتطلبات الإلزامية وحالات عدم الاستيفاء لكل مورد.'
                      : 'After comparing scores, review mandatory requirements and any compliance gaps for each vendor.'
                  )}
              </p>
            </div>

            <Link
              href={`/evaluations/${id}/compliance`}
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
                ? 'عرض الامتثال'
                : 'View Compliance'}

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
/* COMPARISON OVERVIEW CARD */
/* ========================================== */

function ComparisonOverviewCard({
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
/* COMPARISON METRIC */
/* ========================================== */

function ComparisonMetric({
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
        border
        border-[#E3E5EA]
        bg-white
        transition-all
        duration-300
        hover:-translate-y-1
        hover:border-[#CDD1DA]
        hover:shadow-[0_16px_35px_rgba(19,27,79,0.07)]
      "
    >
      <div
        className="
          flex
          items-start
          justify-between
          gap-4
          border-b
          border-[#ECEEF2]
          px-5
          py-5
        "
      >
        <div
          className="
            min-w-0
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <span
              className={cn(
                `
                  flex
                  size-9
                  shrink-0
                  items-center
                  justify-center
                  text-xs
                  font-semibold
                `,
                vendor.rank ===
                  1
                  ? `
                      bg-[#131B4F]
                      text-white
                    `
                  : `
                      bg-[#F4F5F7]
                      text-[#131B4F]
                    `,
              )}
            >
              #{vendor.rank}
            </span>

            <div
              className="
                min-w-0
              "
            >
              <h3
                className="
                  truncate
                  text-[18px]
                  font-medium
                  tracking-[-0.02em]
                  text-[#131B4F]
                "
              >
                {vendor.name}
              </h3>

              <p
                className="
                  mt-1
                  text-[11px]
                  text-[#969DAC]
                "
              >
                {isArabic
                  ? 'تقييم المورد'
                  : 'Vendor evaluation'}
              </p>
            </div>
          </div>
        </div>

        {vendor.rank ===
          1 && (
          <Trophy
            className="
              size-4
              shrink-0
              text-[#CDB78F]
            "
          />
        )}
      </div>

      <div
        className="
          grid
          grid-cols-2
          border-b
          border-[#ECEEF2]
        "
      >
        <CardMetric
          label={
            isArabic
              ? 'الدرجة'
              : 'Score'
          }
          value={
            formatPercent(
              vendor.overallScore,
              1,
            )
          }
        />

        <CardMetric
          label={
            isArabic
              ? 'الامتثال'
              : 'Compliance'
          }
          value={
            formatPercent(
              vendor.overallMandatoryCompliance,
              1,
            )
          }
          last
        />
      </div>

      <div
        className="
          flex
          flex-wrap
          gap-3
          border-b
          border-[#ECEEF2]
          px-5
          py-4
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

      <div
        className="
          flex-1
          px-5
          py-5
        "
      >
        <p
          className="
            line-clamp-4
            text-[14px]
            leading-7
            text-[#646D7F]
          "
        >
          {isArabic
            ? vendor.eligible
              ? `درجة موزونة ${formatPercent(
                  vendor.overallScore,
                  1,
                )} وامتثال إلزامي ${formatPercent(
                  vendor.overallMandatoryCompliance,
                  1,
                )}. المورد مستوفٍ للأهلية وفق نتائج التقييم الحالية.`
              : `درجة موزونة ${formatPercent(
                  vendor.overallScore,
                  1,
                )} وامتثال إلزامي ${formatPercent(
                  vendor.overallMandatoryCompliance,
                  1,
                )}. المورد غير مستوفٍ للأهلية ويحتاج مراجعة فجوات الامتثال.`
            : vendor.eligible
              ? `Weighted score ${formatPercent(
                  vendor.overallScore,
                  1,
                )} with ${formatPercent(
                  vendor.overallMandatoryCompliance,
                  1,
                )} mandatory compliance. The vendor is currently eligible.`
              : `Weighted score ${formatPercent(
                  vendor.overallScore,
                  1,
                )} with ${formatPercent(
                  vendor.overallMandatoryCompliance,
                  1,
                )} mandatory compliance. The vendor is not eligible and requires compliance-gap review.`}
        </p>
      </div>

      <div
        className="
          border-t
          border-[#ECEEF2]
          px-5
          py-4
        "
      >
        <span
          className="
            inline-flex
            items-center
            gap-2
            text-sm
            font-semibold
            text-[#131B4F]
          "
        >
          {isArabic
            ? 'عرض التفاصيل'
            : 'View details'}

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
                ? 'group-hover:translate-x-[-4px]'
                : 'group-hover:translate-x-1',
            )}
          />
        </span>
      </div>
    </Link>
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
        `
          px-5
          py-4
        `,
        !last &&
          'border-e border-[#ECEEF2]',
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
    <div
      className="
        overflow-x-auto
        [scrollbar-color:#B9BEC8_transparent]
        [scrollbar-width:thin]
        [&::-webkit-scrollbar]:h-[7px]
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-[#B9BEC8]
        hover:[&::-webkit-scrollbar-thumb]:bg-[#9299A8]
      "
    >
      <table
        className="
          w-full
          min-w-[850px]
        "
      >
        <thead>
          <tr
            className="
              border-b
              border-[#E7E9EE]
              bg-[#FAFBFC]
            "
          >
            <th
              className="
                px-6
                py-4
                text-start
                text-[11px]
                font-semibold
                text-[#6F7788]
              "
            >
              {isArabic
                ? 'المعيار'
                : 'Criterion'}
            </th>

            <th
              className="
                px-5
                py-4
                text-start
                text-[11px]
                font-semibold
                text-[#6F7788]
              "
            >
              {isArabic
                ? 'الوزن'
                : 'Weight'}
            </th>

            {vendors.map(
              (
                vendor,
              ) => (
                <th
                  key={
                    vendor.id
                  }
                  className="
                    px-5
                    py-4
                    text-start
                    text-[11px]
                    font-semibold
                    text-[#6F7788]
                  "
                >
                  {
                    vendor.name
                  }
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
            ) => {
              const bestScoreForCriterion =
                Math.max(
                  ...vendors.map(
                    (
                      candidate,
                    ) =>
                      candidate.criterionScores.find(
                        (
                          item,
                        ) =>
                          item.criterionId ===
                          criterion.criterionId,
                      )?.score ??
                      0,
                  ),
                )

              return (
                <tr
                  key={
                    criterion.criterionId
                  }
                  className={cn(
                    `
                      transition-colors
                      hover:bg-[#FBFCFD]
                    `,
                    index !==
                      criteria.length -
                        1 &&
                      `
                        border-b
                        border-[#ECEEF2]
                      `,
                  )}
                >
                  <td
                    className="
                      px-6
                      py-5
                    "
                  >
                    <p
                      className="
                        text-[14px]
                        font-semibold
                        text-[#131B4F]
                      "
                    >
                      {
                        criterion.criterionName
                      }
                    </p>
                  </td>

                  <td
                    className="
                      px-5
                      py-5
                    "
                  >
                    <span
                      className="
                        bg-[#F4F5F7]
                        px-2.5
                        py-1
                        text-xs
                        font-semibold
                        text-[#131B4F]
                      "
                    >
                      {
                        criterion.weight
                      }
                      %
                    </span>
                  </td>

                  {vendors.map(
                    (
                      vendor,
                    ) => {
                      const score =
                        vendor.criterionScores.find(
                          (
                            item,
                          ) =>
                            item.criterionId ===
                            criterion.criterionId,
                        )

                      const scoreValue =
                        score?.score ??
                        0

                      const isBestForCriterion =
                        scoreValue ===
                        bestScoreForCriterion

                      return (
                        <td
                          key={
                            vendor.id
                          }
                          className="
                            px-5
                            py-5
                          "
                        >
                          <div
                            className="
                              min-w-[150px]
                            "
                          >
                            <div
                              className="
                                mb-2
                                flex
                                items-center
                                justify-between
                                gap-3
                              "
                            >
                              <span
                                className="
                                  text-sm
                                  font-semibold
                                  text-[#131B4F]
                                "
                              >
                                {
                                  scoreValue
                                }
                                %
                              </span>

                              {isBestForCriterion && (
                                <span
                                  className="
                                    inline-flex
                                    items-center
                                    gap-1.5
                                    text-[10px]
                                    font-semibold
                                    text-[#8F7546]
                                  "
                                >
                                  <Trophy
                                    className="
                                      size-3.5
                                      text-[#CDB78F]
                                    "
                                  />

                                  {isArabic
                                    ? 'الأفضل'
                                    : 'Best'}
                                </span>
                              )}
                            </div>

                            <div
                              className="
                                h-1.5
                                overflow-hidden
                                bg-[#ECEEF2]
                              "
                            >
                              <div
                                className="
                                  h-full
                                  bg-[#131B4F]
                                "
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
              )
            },
          )}
        </tbody>
      </table>
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
      <ShieldAlert
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
      <ShieldCheck
        className="
          size-3.5
        "
      />

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
            h-[260px]
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
            h-[420px]
            animate-pulse
            bg-[#F5F6F8]
          "
        />
      </div>
    </div>
  )
}