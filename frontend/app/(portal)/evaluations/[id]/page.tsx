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
  BarChart3,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  XCircle,
} from 'lucide-react'

import { EmptyState } from '@/components/empty-state'

import {
  API_BASE_URL,
  evaluationsApi,
} from '@/lib/api'

import { useLanguage } from '@/lib/i18n/context'

import {
  formatDate,
  formatPercent,
} from '@/lib/labels'

import { cn } from '@/lib/utils'

import type {
  Evaluation,
  Vendor,
} from '@/lib/types'

export default function EvaluationResultsPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = use(params)

  const { language, isArabic } = useLanguage()

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [loading, setLoading] = useState(true)

  /* ========================================== */
  /* LOAD DATA */
  /* ========================================== */

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
      .catch((error) => {
        console.error('Failed to load evaluation:', error)

        if (!active) {
          return
        }

        setEvaluation(null)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])

  /* ========================================== */
  /* DERIVED DATA */
  /* ========================================== */

  const sortedVendors = useMemo(() => {
    if (!evaluation) {
      return []
    }

    return [...evaluation.vendors].sort((a, b) => a.rank - b.rank)
  }, [evaluation])

  const topVendor = sortedVendors[0] ?? null
  const topThreeVendors = sortedVendors.slice(0, 3)

  const eligibleCount = sortedVendors.filter((vendor) => vendor.eligible).length
  const notEligibleCount = sortedVendors.length - eligibleCount

  const highRiskCount = sortedVendors.filter(
    (vendor) => vendor.riskLevel === 'HIGH',
  ).length

  const totalMissingRequirements = sortedVendors.reduce(
    (total, vendor) => total + vendor.missingRequirements.length,
    0,
  )

  const ArrowIcon = isArabic ? ArrowLeft : ArrowRight

  /* ========================================== */
  /* DOCUMENT URLS */
  /* ========================================== */

  const rfpDownloadUrl = `${API_BASE_URL}/evaluations/${encodeURIComponent(
    id,
  )}/documents/rfp`

  const topProposalDownloadUrl = `${API_BASE_URL}/evaluations/${encodeURIComponent(
    id,
  )}/documents/top-proposal`

  /* ========================================== */
  /* LOADING */
  /* ========================================== */

  if (loading) {
    return <LoadingState />
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
            icon={FileText}
            title={isArabic ? 'لم يتم العثور على المنافسة' : 'Competition not found'}
            description={
              isArabic
                ? 'تعذر العثور على هذه المنافسة.'
                : 'The competition could not be found.'
            }
            action={
              <Link
                href="/evaluations"
                className="
                  inline-flex
                  h-11
                  items-center
                  justify-center
                  bg-[#131B4F]
                  px-5
                  text-sm
                  font-semibold
                  text-white
                "
              >
                {isArabic ? 'سجل المنافسات' : 'Competition History'}
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="
        min-h-screen
        bg-white
        text-[#131B4F]
      "
    >
      {/* ===================================== */}
      {/* HERO */}
      {/* ===================================== */}

      <section
        className="
          bg-[#F1ECE0]
          px-5
          py-14

          sm:px-8
          sm:py-16

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
              max-w-[980px]
            "
          >
            <p
              className="
                text-[10px]
                font-semibold
                tracking-[0.14em]
                text-[#9466C4]
              "
            >
              {isArabic ? 'نظرة عامة على المنافسة' : 'COMPETITION OVERVIEW'}
            </p>

            <h1
              className="
                mt-5
                max-w-[960px]
                break-words
                text-[clamp(42px,5.2vw,76px)]
                font-medium
                leading-[0.99]
                tracking-[-0.06em]
                text-[#131B4F]
              "
            >
              {evaluation.rfpName}
            </h1>

            <p
              className="
                mt-7
                max-w-[700px]
                text-[16px]
                leading-8
                text-[#696F7D]
              "
            >
              {isArabic
                ? 'هنا تبدأ قراءة المنافسة كاملة: من إطار التقييم، إلى ترتيب الموردين، ثم الامتثال والتقرير النهائي.'
                : 'Start here for the full competition picture — from the evaluation framework to vendor ranking, compliance, and the final report.'}
            </p>

            {/* META */}

            <div
              className="
                mt-8
                flex
                flex-wrap
                gap-x-7
                gap-y-3
                border-t
                border-[#D8CCB6]
                pt-6
                text-[13px]
                text-[#817768]
              "
            >
              <span>
                {isArabic
                  ? `${evaluation.vendorCount} عروض`
                  : `${evaluation.vendorCount} proposals`}
              </span>

              <span>{formatDate(evaluation.createdDate, language)}</span>

              <span>
                {isArabic ? `${eligibleCount} مؤهلين` : `${eligibleCount} eligible`}
              </span>
            </div>

            {/* ACTIONS */}

            <div
              className="
                mt-9
                flex
                flex-wrap
                gap-3
              "
            >
              {/* DOWNLOAD ORIGINAL RFP */}

              <a
                href={rfpDownloadUrl}
                download
                className="
                  group
                  inline-flex
                  h-12
                  items-center
                  justify-center
                  gap-2.5
                  bg-[#CDB78F]
                  px-6
                  text-sm
                  font-semibold
                  text-[#131B4F]
                  transition-all
                  duration-300

                  hover:bg-[#D8C6A4]
                "
              >
                <Download
                  className="
                    size-4
                  "
                />

                {isArabic ? 'تحميل ملف المنافسة الأصلي' : 'Download Original RFP'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================== */}
      {/* SECTION 1 — WHAT IS EVALUATED */}
      {/* ===================================== */}

      <section
        className="
          bg-white
          px-5
          py-20

          sm:px-8

          lg:px-12
          lg:py-28
        "
      >
        <div
          className="
            mx-auto
            grid
            w-full
            max-w-[1500px]
            items-center
            gap-12

            lg:grid-cols-[0.82fr_1.18fr]
            lg:gap-20
          "
        >
          {/* COPY */}

          <div
            className="
              max-w-[580px]
            "
          >
            <SectionEyebrow>
              {isArabic ? 'إطار التقييم' : 'EVALUATION FRAMEWORK'}
            </SectionEyebrow>

            <h2
              className="
                mt-4
                text-[clamp(36px,4.2vw,58px)]
                font-medium
                leading-[1.03]
                tracking-[-0.052em]
                text-[#131B4F]
              "
            >
              {isArabic
                ? 'وش يتم تقييمه في هذه المنافسة؟'
                : 'What is being evaluated in this competition?'}
            </h2>

            <p
              className="
                mt-6
                text-[15px]
                leading-8
                text-[#707789]
              "
            >
              {isArabic
                ? 'كل عرض يتم تحليله على نفس الإطار المستخرج من مستند المنافسة، بحيث تكون المقارنة بين الموردين مبنية على أساس موحد.'
                : 'Every proposal is assessed against the same framework extracted from the competition document, creating one consistent basis for comparison.'}
            </p>

            <Link
              href={`/evaluations/${id}/rfp`}
              className="
                group
                mt-8
                inline-flex
                items-center
                gap-2
                text-sm
                font-semibold
                text-[#131B4F]
              "
            >
              {isArabic ? 'عرض إطار المنافسة' : 'Explore the RFP framework'}

              <ArrowIcon
                className={cn(
                  `
                    size-4
                    transition-transform
                    duration-300
                  `,
                  isArabic ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1',
                )}
              />
            </Link>
          </div>

          {/* VISUAL */}

          <div
            className="
              bg-[#F1ECE0]
              p-6

              sm:p-8

              lg:p-10
            "
          >
            <div
              className="
                bg-white
              "
            >
              <div
                className="
                  border-b
                  border-[#ECEEF2]
                  px-6
                  py-6

                  sm:px-8
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-4
                  "
                >
                  <div
                    className="
                      flex
                      size-11
                      items-center
                      justify-center
                      bg-[#131B4F]
                      text-white
                    "
                  >
                    <FileCheck2
                      className="
                        size-5
                      "
                    />
                  </div>

                  <div
                    className="
                      min-w-0
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
                      RFP
                    </p>

                    <p
                      className="
                        mt-1
                        break-words
                        text-[16px]
                        font-semibold
                        text-[#131B4F]
                      "
                    >
                      {evaluation.rfpName}
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="
                  grid

                  sm:grid-cols-3
                "
              >
                <FrameworkMetric
                  value={evaluation.rfp.totalCriteria}
                  label={isArabic ? 'معايير التقييم' : 'Evaluation Criteria'}
                  helper={
                    isArabic ? 'تحدد مجالات التقييم' : 'Defines evaluation areas'
                  }
                />

                <FrameworkMetric
                  value={evaluation.rfp.totalRequirements}
                  label={isArabic ? 'المتطلبات' : 'Requirements'}
                  helper={isArabic ? 'تفاصيل يتم فحصها' : 'Detailed checks'}
                />

                <FrameworkMetric
                  value={evaluation.rfp.mandatoryRequirements}
                  label={isArabic ? 'متطلبات إلزامية' : 'Mandatory'}
                  helper={isArabic ? 'قد تؤثر على الأهلية' : 'May affect eligibility'}
                  last
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================== */}
      {/* SECTION 2 — LEADING VENDOR */}
      {/* ===================================== */}

      <section
        className="
          bg-[#F7F7F5]
          px-5
          py-20

          sm:px-8

          lg:px-12
          lg:py-28
        "
      >
        <div
          className="
            mx-auto
            grid
            w-full
            max-w-[1500px]
            items-center
            gap-12

            lg:grid-cols-[1.18fr_0.82fr]
            lg:gap-20
          "
        >
          {/* VISUAL */}

          <div
            className="
              order-2
              overflow-hidden
              bg-[#131B4F]
              text-white

              lg:order-1
            "
          >
            <div
              className="
                grid

                md:grid-cols-[0.42fr_1fr]
              "
            >
              {/* SCORE COLUMN */}

              <div
                className="
                  flex
                  min-h-[390px]
                  flex-col
                  justify-between
                  bg-[#1D208E]
                  p-7

                  sm:p-9
                "
              >
                <div>
                  <p
                    className="
                      text-[10px]
                      font-semibold
                      tracking-[0.13em]
                      text-[#CDB78F]
                    "
                  >
                    {isArabic ? 'الترتيب' : 'RANK'}
                  </p>

                  <p
                    className="
                      mt-4
                      text-[84px]
                      font-light
                      leading-none
                      tracking-[-0.08em]
                    "
                  >
                    {topVendor ? `#${topVendor.rank}` : '—'}
                  </p>
                </div>

                <div>
                  <p
                    className="
                      text-[10px]
                      font-semibold
                      tracking-[0.12em]
                      text-white/40
                    "
                  >
                    {isArabic ? 'الدرجة النهائية' : 'FINAL SCORE'}
                  </p>

                  <p
                    className="
                      mt-3
                      text-[38px]
                      font-medium
                      tracking-[-0.05em]
                    "
                  >
                    {topVendor ? formatPercent(topVendor.overallScore, 1) : '—'}
                  </p>
                </div>
              </div>

              {/* VENDOR COLUMN */}

              <div
                className="
                  flex
                  min-h-[390px]
                  flex-col
                  justify-between
                  p-7

                  sm:p-9
                "
              >
                <div>
                  <p
                    className="
                      text-[10px]
                      font-semibold
                      tracking-[0.13em]
                      text-[#CDB78F]
                    "
                  >
                    {isArabic ? 'العرض المتصدر' : 'LEADING PROPOSAL'}
                  </p>

                  <h3
                    className="
                      mt-5
                      max-w-[640px]
                      break-words
                      text-[clamp(30px,3.8vw,52px)]
                      font-medium
                      leading-[1.05]
                      tracking-[-0.05em]
                    "
                  >
                    {topVendor?.name ??
                      (isArabic ? 'لا يوجد عرض متصدر' : 'No leading proposal')}
                  </h3>
                </div>

                {topVendor && (
                  <div>
                    <div
                      className="
                        flex
                        flex-wrap
                        gap-2
                      "
                    >
                      <EligibilityBadge
                        eligible={topVendor.eligible}
                        isArabic={isArabic}
                      />

                      <RiskBadge risk={topVendor.riskLevel} isArabic={isArabic} />
                    </div>

                    <div
                      className="
                        mt-6
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
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COPY */}

          <div
            className="
              order-1
              max-w-[580px]

              lg:order-2
            "
          >
            <SectionEyebrow>
              {isArabic ? 'النتيجة الحالية' : 'CURRENT OUTCOME'}
            </SectionEyebrow>

            <h2
              className="
                mt-4
                text-[clamp(36px,4.2vw,58px)]
                font-medium
                leading-[1.03]
                tracking-[-0.052em]
                text-[#131B4F]
              "
            >
              {isArabic
                ? 'مين يتصدر المنافسة الآن؟'
                : 'Who is currently leading the competition?'}
            </h2>

            <p
              className="
                mt-6
                text-[15px]
                leading-8
                text-[#707789]
              "
            >
              {isArabic
                ? 'الترتيب يعرض النتيجة الموزونة، لكن القرار ما يعتمد عليها وحدها. حالة الأهلية والمخاطر والامتثال تظل عوامل مستقلة لازم تتم مراجعتها.'
                : 'The ranking reflects weighted scoring, but score alone does not determine the final decision. Eligibility, risk, and compliance remain separate review factors.'}
            </p>

            <div
              className="
                mt-8
                space-y-5
              "
            >
              <InsightRow
                icon={Trophy}
                title={isArabic ? 'أعلى نتيجة موزونة' : 'Highest weighted result'}
                value={topVendor ? formatPercent(topVendor.overallScore, 1) : '—'}
              />

              <InsightRow
                icon={ShieldCheck}
                title={isArabic ? 'حالة الأهلية' : 'Eligibility status'}
                value={
                  topVendor
                    ? topVendor.eligible
                      ? isArabic
                        ? 'مؤهل'
                        : 'Eligible'
                      : isArabic
                        ? 'غير مؤهل'
                        : 'Not Eligible'
                    : '—'
                }
              />

              <InsightRow
                icon={ShieldAlert}
                title={isArabic ? 'مستوى المخاطر' : 'Risk level'}
                value={
                  topVendor
                    ? isArabic
                      ? formatRiskArabic(topVendor.riskLevel)
                      : formatRisk(topVendor.riskLevel)
                    : '—'
                }
              />
            </div>

            {/* LEADING VENDOR ACTIONS */}

            {topVendor && (
              <div
                className="
                  mt-9
                  flex
                  flex-wrap
                  items-center
                  gap-5
                "
              >
                {/* DOWNLOAD ORIGINAL PROPOSAL */}

                <a
                  href={topProposalDownloadUrl}
                  download
                  className="
                    group
                    inline-flex
                    h-11
                    items-center
                    justify-center
                    gap-2.5
                    bg-[#131B4F]
                    px-5
                    text-sm
                    font-semibold
                    text-white
                    transition-all
                    duration-300

                    hover:bg-[#1D208E]
                  "
                >
                  <Download
                    className="
                      size-4
                    "
                  />

                  {isArabic
                    ? 'تحميل عرض المورد المتصدر'
                    : 'Download Leading Proposal'}
                </a>

                {/* VIEW VENDOR */}

                <Link
                  href={`/evaluations/${id}/vendors/${topVendor.id}`}
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
                  {isArabic ? 'عرض تفاصيل المورد' : 'View vendor details'}

                  <ArrowIcon
                    className={cn(
                      `
                        size-4
                        transition-transform
                        duration-300
                      `,
                      isArabic ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1',
                    )}
                  />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===================================== */}
      {/* SECTION 3 — COMPARISON */}
      {/* ===================================== */}

      <section
        className="
          bg-white
          px-5
          py-20

          sm:px-8

          lg:px-12
          lg:py-28
        "
      >
        <div
          className="
            mx-auto
            grid
            w-full
            max-w-[1500px]
            items-center
            gap-12

            lg:grid-cols-[0.82fr_1.18fr]
            lg:gap-20
          "
        >
          {/* COPY */}

          <div
            className="
              max-w-[580px]
            "
          >
            <SectionEyebrow>
              {isArabic ? 'مقارنة الموردين' : 'VENDOR COMPARISON'}
            </SectionEyebrow>

            <h2
              className="
                mt-4
                text-[clamp(36px,4.2vw,58px)]
                font-medium
                leading-[1.03]
                tracking-[-0.052em]
                text-[#131B4F]
              "
            >
              {isArabic
                ? 'شوف الفروقات بين العروض في مكان واحد'
                : 'See how the proposals differ in one place'}
            </h2>

            <p
              className="
                mt-6
                text-[15px]
                leading-8
                text-[#707789]
              "
            >
              {isArabic
                ? 'المقارنة تجمع الترتيب، الدرجة، الامتثال والأهلية جنبًا إلى جنب عشان يكون الفرق بين الموردين واضح قبل الدخول في التفاصيل.'
                : 'The comparison brings ranking, score, compliance, and eligibility side by side so vendor differences are clear before deeper review.'}
            </p>

            <Link
              href={`/evaluations/${id}/comparison`}
              className="
                group
                mt-8
                inline-flex
                items-center
                gap-2
                text-sm
                font-semibold
                text-[#131B4F]
              "
            >
              {isArabic ? 'فتح المقارنة الكاملة' : 'Open full comparison'}

              <ArrowIcon
                className={cn(
                  `
                    size-4
                    transition-transform
                    duration-300
                  `,
                  isArabic ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1',
                )}
              />
            </Link>
          </div>

          {/* VISUAL */}

          <div
            className="
              bg-[#F1ECE0]
              p-5

              sm:p-7

              lg:p-9
            "
          >
            <div
              className="
                bg-white
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4
                  border-b
                  border-[#E8EAF0]
                  px-5
                  py-5

                  sm:px-7
                "
              >
                <div>
                  <p
                    className="
                      text-[10px]
                      font-semibold
                      tracking-[0.12em]
                      text-[#9466C4]
                    "
                  >
                    {isArabic ? 'أفضل العروض' : 'TOP PROPOSALS'}
                  </p>

                  <p
                    className="
                      mt-1
                      text-[16px]
                      font-semibold
                      text-[#131B4F]
                    "
                  >
                    {isArabic
                      ? 'ملخص المقارنة الحالية'
                      : 'Current comparison snapshot'}
                  </p>
                </div>

                <BarChart3
                  className="
                    size-5
                    text-[#131B4F]
                  "
                />
              </div>

              <div>
                {topThreeVendors.map((vendor, index) => (
                  <ComparisonPreviewRow
                    key={vendor.id}
                    vendor={vendor}
                    isArabic={isArabic}
                    last={index === topThreeVendors.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================== */}
      {/* SECTION 4 — COMPLIANCE */}
      {/* ===================================== */}

      <section
        className="
          bg-[#F7F7F5]
          px-5
          py-20

          sm:px-8

          lg:px-12
          lg:py-28
        "
      >
        <div
          className="
            mx-auto
            grid
            w-full
            max-w-[1500px]
            items-center
            gap-12

            lg:grid-cols-[1.18fr_0.82fr]
            lg:gap-20
          "
        >
          {/* VISUAL */}

          <div
            className="
              order-2
              bg-white
              p-6

              sm:p-8

              lg:order-1
              lg:p-10
            "
          >
            <div
              className="
                grid
                gap-px
                overflow-hidden
                bg-[#E8EAF0]

                sm:grid-cols-2
              "
            >
              <ComplianceMetric
                value={String(eligibleCount)}
                label={isArabic ? 'موردين مؤهلين' : 'Eligible Vendors'}
                icon={CheckCircle2}
              />

              <ComplianceMetric
                value={String(notEligibleCount)}
                label={isArabic ? 'غير مؤهلين' : 'Not Eligible'}
                icon={XCircle}
              />

              <ComplianceMetric
                value={String(totalMissingRequirements)}
                label={isArabic ? 'فجوات إلزامية' : 'Mandatory Gaps'}
                icon={ShieldAlert}
              />

              <ComplianceMetric
                value={String(highRiskCount)}
                label={isArabic ? 'مخاطر مرتفعة' : 'High Risk'}
                icon={ShieldAlert}
              />
            </div>

            <div
              className="
                mt-6
                bg-[#131B4F]
                px-6
                py-6
                text-white

                sm:px-7
              "
            >
              <div
                className="
                  flex
                  items-start
                  gap-4
                "
              >
                <ShieldCheck
                  className="
                    mt-1
                    size-5
                    shrink-0
                    text-[#CDB78F]
                  "
                />

                <p
                  className="
                    text-[14px]
                    leading-7
                    text-white/70
                  "
                >
                  {isArabic
                    ? 'المورد قد يتصدر بالدرجة، لكن عدم استيفاء متطلب إلزامي يظل عاملًا مستقلًا في قرار الأهلية.'
                    : 'A vendor may lead on score while still having mandatory compliance gaps that independently affect eligibility.'}
                </p>
              </div>
            </div>
          </div>

          {/* COPY */}

          <div
            className="
              order-1
              max-w-[580px]

              lg:order-2
            "
          >
            <SectionEyebrow>
              {isArabic ? 'الأهلية والامتثال' : 'ELIGIBILITY & COMPLIANCE'}
            </SectionEyebrow>

            <h2
              className="
                mt-4
                text-[clamp(36px,4.2vw,58px)]
                font-medium
                leading-[1.03]
                tracking-[-0.052em]
                text-[#131B4F]
              "
            >
              {isArabic ? 'الدرجة وحدها ما تكفي' : 'Score alone is not enough'}
            </h2>

            <p
              className="
                mt-6
                text-[15px]
                leading-8
                text-[#707789]
              "
            >
              {isArabic
                ? 'لهذا السبب يتم فحص الامتثال الإلزامي بشكل مستقل عن الترتيب. هنا تظهر العروض التي تحتاج مراجعة إضافية قبل القرار النهائي.'
                : 'Mandatory compliance is reviewed separately from numerical ranking. This reveals proposals that need additional review before the final decision.'}
            </p>

            <Link
              href={`/evaluations/${id}/compliance`}
              className="
                group
                mt-8
                inline-flex
                items-center
                gap-2
                text-sm
                font-semibold
                text-[#131B4F]
              "
            >
              {isArabic ? 'مراجعة الامتثال' : 'Review compliance'}

              <ArrowIcon
                className={cn(
                  `
                    size-4
                    transition-transform
                    duration-300
                  `,
                  isArabic ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1',
                )}
              />
            </Link>
          </div>
        </div>
      </section>

      {/* ===================================== */}
      {/* FINAL CTA */}
      {/* ===================================== */}

      <section
        className="
          bg-[#131B4F]
          px-5
          py-16
          text-white

          sm:px-8

          lg:px-12
          lg:py-20
        "
      >
        <div
          className="
            mx-auto
            flex
            w-full
            max-w-[1500px]
            flex-col
            gap-8

            md:flex-row
            md:items-center
            md:justify-between
          "
        >
          <div
            className="
              max-w-[850px]
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
              {isArabic ? 'الخطوة الأخيرة' : 'FINAL STEP'}
            </p>

            <h2
              className="
                mt-4
                text-[clamp(34px,4vw,54px)]
                font-medium
                leading-[1.04]
                tracking-[-0.05em]
              "
            >
              {isArabic
                ? 'جاهز لمراجعة الخلاصة النهائية؟'
                : 'Ready to review the final outcome?'}
            </h2>

            <p
              className="
                mt-5
                max-w-[720px]
                text-[15px]
                leading-8
                text-white/60
              "
            >
              {isArabic
                ? 'راجع ترتيب الموردين، الامتثال، المخاطر والتوصية النهائية في تقرير واحد.'
                : 'Review vendor ranking, compliance, risk, and the final recommendation in one report.'}
            </p>
          </div>

          <Link
            href={`/evaluations/${id}/report`}
            className="
              group
              inline-flex
              min-h-[54px]
              shrink-0
              items-center
              justify-center
              gap-3
              bg-[#CDB78F]
              px-7
              text-sm
              font-semibold
              text-[#131B4F]
              transition-all
              duration-300

              hover:bg-white
            "
          >
            {isArabic ? 'عرض التقرير النهائي' : 'View Final Report'}

            <ArrowIcon
              className={cn(
                `
                  size-4
                  transition-transform
                  duration-300
                `,
                isArabic ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1',
              )}
            />
          </Link>
        </div>
      </section>
    </div>
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
/* FRAMEWORK METRIC */
/* ========================================== */

function FrameworkMetric({
  value,
  label,
  helper,
  last = false,
}: {
  value: number
  label: string
  helper: string
  last?: boolean
}) {
  return (
    <div
      className={cn(
        `
          min-h-[220px]
          px-6
          py-7

          sm:px-7
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
          text-[52px]
          font-light
          leading-none
          tracking-[-0.06em]
          text-[#131B4F]
        "
      >
        {value}
      </p>

      <h3
        className="
          mt-8
          text-[15px]
          font-semibold
          text-[#131B4F]
        "
      >
        {label}
      </h3>

      <p
        className="
          mt-2
          text-[13px]
          leading-6
          text-[#858D9C]
        "
      >
        {helper}
      </p>
    </div>
  )
}

/* ========================================== */
/* INSIGHT ROW */
/* ========================================== */

function InsightRow({
  icon: Icon,
  title,
  value,
}: {
  icon: ComponentType<{
    className?: string
  }>
  title: string
  value: string
}) {
  return (
    <div
      className="
        flex
        items-center
        justify-between
        gap-5
        border-b
        border-[#E2E4EA]
        pb-5
      "
    >
      <div
        className="
          flex
          items-center
          gap-3
        "
      >
        <div
          className="
            flex
            size-9
            shrink-0
            items-center
            justify-center
            bg-white
            text-[#131B4F]
          "
        >
          <Icon
            className="
              size-4
            "
          />
        </div>

        <span
          className="
            text-[14px]
            text-[#6F7788]
          "
        >
          {title}
        </span>
      </div>

      <span
        className="
          text-[14px]
          font-semibold
          text-[#131B4F]
        "
      >
        {value}
      </span>
    </div>
  )
}

/* ========================================== */
/* COMPARISON PREVIEW ROW */
/* ========================================== */

function ComparisonPreviewRow({
  vendor,
  isArabic,
  last = false,
}: {
  vendor: Vendor
  isArabic: boolean
  last?: boolean
}) {
  return (
    <div
      className={cn(
        `
          grid
          gap-5
          px-5
          py-5

          sm:grid-cols-[64px_1fr_115px_130px]
          sm:items-center

          sm:px-7
        `,
        !last && 'border-b border-[#E8EAF0]',
      )}
    >
      <div>
        <p
          className="
            text-[10px]
            text-[#9AA0AC]
          "
        >
          {isArabic ? 'الترتيب' : 'Rank'}
        </p>

        <p
          className="
            mt-1
            text-[18px]
            font-semibold
            text-[#131B4F]
          "
        >
          #{vendor.rank}
        </p>
      </div>

      <div
        className="
          min-w-0
        "
      >
        <p
          className="
            truncate
            text-[15px]
            font-semibold
            text-[#131B4F]
          "
        >
          {vendor.name}
        </p>

        <div
          className="
            mt-2
          "
        >
          <EligibilityBadge eligible={vendor.eligible} isArabic={isArabic} />
        </div>
      </div>

      <div>
        <p
          className="
            text-[10px]
            text-[#9AA0AC]
          "
        >
          {isArabic ? 'الدرجة' : 'Score'}
        </p>

        <p
          className="
            mt-1
            text-[18px]
            font-semibold
            text-[#131B4F]
          "
        >
          {formatPercent(vendor.overallScore, 1)}
        </p>
      </div>

      <div>
        <p
          className="
            text-[10px]
            text-[#9AA0AC]
          "
        >
          {isArabic ? 'الامتثال' : 'Compliance'}
        </p>

        <p
          className="
            mt-1
            text-[18px]
            font-semibold
            text-[#131B4F]
          "
        >
          {formatPercent(vendor.overallMandatoryCompliance, 1)}
        </p>
      </div>
    </div>
  )
}

/* ========================================== */
/* COMPLIANCE METRIC */
/* ========================================== */

function ComplianceMetric({
  value,
  label,
  icon: Icon,
}: {
  value: string
  label: string
  icon: ComponentType<{
    className?: string
  }>
}) {
  return (
    <div
      className="
        min-h-[200px]
        bg-[#F8F9FB]
        p-6

        sm:p-7
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
        <Icon
          className="
            size-5
            text-[#9466C4]
          "
        />

        <span
          className="
            text-[10px]
            font-semibold
            tracking-[0.1em]
            text-[#A0A6B2]
          "
        >
          STATUS
        </span>
      </div>

      <p
        className="
          mt-8
          text-[52px]
          font-light
          leading-none
          tracking-[-0.06em]
          text-[#131B4F]
        "
      >
        {value}
      </p>

      <p
        className="
          mt-5
          text-[14px]
          font-semibold
          text-[#131B4F]
        "
      >
        {label}
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

      {isArabic ? 'مؤهل' : 'Eligible'}
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

      {isArabic ? 'غير مؤهل' : 'Not Eligible'}
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
    LOW: 'bg-[#EEF8F2] text-[#25724C]',
    MEDIUM: 'bg-[#FFF8E8] text-[#966515]',
    HIGH: 'bg-[#FFF1F1] text-[#A44444]',
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

      {isArabic ? formatRiskArabic(risk) : formatRisk(risk)}
    </span>
  )
}

/* ========================================== */
/* RISK LABELS */
/* ========================================== */

function formatRisk(risk: Vendor['riskLevel']) {
  if (risk === 'LOW') {
    return 'Low Risk'
  }

  if (risk === 'MEDIUM') {
    return 'Medium Risk'
  }

  return 'High Risk'
}

function formatRiskArabic(risk: Vendor['riskLevel']) {
  if (risk === 'LOW') {
    return 'مخاطر منخفضة'
  }

  if (risk === 'MEDIUM') {
    return 'مخاطر متوسطة'
  }

  return 'مخاطر مرتفعة'
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
          py-16

          sm:px-8

          lg:px-12
        "
      >
        <div
          className="
            mx-auto
            max-w-[1500px]
          "
        >
          <div
            className="
              h-[430px]
              max-w-[980px]
              animate-pulse
              bg-white/55
            "
          />
        </div>
      </div>

      <div
        className="
          mx-auto
          max-w-[1500px]
          px-5
          py-20

          sm:px-8

          lg:px-12
        "
      >
        <div
          className="
            h-[450px]
            animate-pulse
            bg-[#F5F6F8]
          "
        />

        <div
          className="
            mt-16
            h-[450px]
            animate-pulse
            bg-[#F5F6F8]
          "
        />
      </div>
    </div>
  )
}