'use client'

import {
  use,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import Link from 'next/link'

import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'

import {
  API_BASE_URL,
  evaluationsApi,
} from '@/lib/api'

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
  params: Promise<{
    id: string
  }>
}) {
  const {
    id,
  } =
    use(params)


  const {
    language,
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
    let active = true


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
              ? 'تعذر تحميل تقرير التقييم.'
              : err instanceof Error
                ? err.message
                : 'Failed to load evaluation report.',
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
    isArabic,
  ])


  /* ========================================== */
  /* DERIVED DATA */
  /* ========================================== */

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


  const eligibleVendors =
    sortedVendors.filter(
      (
        vendor,
      ) =>
        vendor.eligible,
    )


  const highRiskVendors =
    sortedVendors.filter(
      (
        vendor,
      ) =>
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
        vendor.missingRequirements.length,
      0,
    )


  /* ========================================== */
  /* ORIGINAL DOCUMENT URLS */
  /* ========================================== */

  const rfpDownloadUrl =
    `${API_BASE_URL}/evaluations/${encodeURIComponent(
      id,
    )}/documents/rfp`


  const rfpViewUrl =
    `${API_BASE_URL}/evaluations/${encodeURIComponent(
      id,
    )}/documents/rfp/view`


  const topProposalDownloadUrl =
    `${API_BASE_URL}/evaluations/${encodeURIComponent(
      id,
    )}/documents/top-proposal`


  const topProposalViewUrl =
    `${API_BASE_URL}/evaluations/${encodeURIComponent(
      id,
    )}/documents/top-proposal/view`


  /* ========================================== */
  /* PRINT */
  /* ========================================== */

  function handleDownloadReport() {
    window.print()
  }


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
              FileText
            }
            title={
              isArabic
                ? 'لم يتم العثور على التقرير'
                : 'Report not found'
            }
            description={
              isArabic
                ? 'لا يتوفر تقرير تقييم لهذه المنافسة.'
                : 'No evaluation report is available for this evaluation.'
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
    <>
      {/* ===================================== */}
      {/* PRINT SETTINGS */}
      {/* ===================================== */}

      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 12mm;
            }

            html,
            body {
              background: white !important;
            }

            body {
              margin: 0 !important;
              padding: 0 !important;
            }

            header,
            footer {
              display: none !important;
            }

            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            a {
              text-decoration: none !important;
            }

            iframe {
              display: none !important;
            }
          }
        `}
      </style>


      <div
        dir={
          isArabic
            ? 'rtl'
            : 'ltr'
        }
        className="
          min-h-screen
          bg-[#F5F5F3]
          text-[#131B4F]

          print:min-h-0
          print:bg-white
        "
      >

        {/* =================================== */}
        {/* TOOLBAR */}
        {/* =================================== */}

        <div
          className="
            border-b
            border-[#E3E5EA]
            bg-white
            px-5
            py-4

            print:hidden

            sm:px-8

            lg:px-12
          "
        >
          <div
            className="
              mx-auto
              flex
              w-full
              max-w-[1280px]
              flex-col
              gap-4

              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div>
              <p
                className="
                  text-[10px]
                  font-semibold
                  tracking-[0.13em]
                  text-[#9466C4]
                "
              >
                {isArabic
                  ? 'تقرير التقييم النهائي'
                  : 'FINAL EVALUATION REPORT'}
              </p>


              <p
                className="
                  mt-1
                  text-sm
                  text-[#727A8C]
                "
              >
                {isArabic
                  ? 'نسخة شاملة قابلة للطباعة والحفظ كملف PDF'
                  : 'Complete report ready for printing or saving as PDF'}
              </p>
            </div>


            <button
              type="button"
              onClick={
                handleDownloadReport
              }
              className="
                inline-flex
                h-11
                items-center
                justify-center
                gap-2
                bg-[#131B4F]
                px-5
                text-sm
                font-semibold
                text-white
                transition-colors

                hover:bg-[#1D208E]
              "
            >
              <Download
                className="
                  size-4
                "
              />

              {isArabic
                ? 'تحميل التقرير PDF'
                : 'Download Report PDF'}
            </button>
          </div>
        </div>


        {/* =================================== */}
        {/* DOCUMENT */}
        {/* =================================== */}

        <main
          className="
            mx-auto
            my-8
            w-full
            max-w-[1280px]
            overflow-hidden
            bg-white
            shadow-[0_20px_70px_rgba(19,27,79,0.08)]

            print:my-0
            print:max-w-none
            print:overflow-visible
            print:shadow-none
          "
        >

          {/* ================================= */}
          {/* COVER */}
          {/* ================================= */}

          <section
            className="
              bg-[#131B4F]
              px-7
              py-10
              text-white

              print:break-after-page
              print:px-8
              print:py-10

              sm:px-10
              sm:py-12

              lg:px-14
              lg:py-14
            "
          >
            <div
              className="
                flex
                flex-wrap
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
                  tracking-[0.14em]
                  text-white
                "
              >
                {isArabic
                  ? 'التقرير النهائي'
                  : 'FINAL EVALUATION REPORT'}
              </span>


              <span
                className="
                  text-xs
                  text-white/45
                "
              >
                {evaluation.id}
              </span>
            </div>


            <div
              className="
                mt-16
                max-w-[900px]

                print:mt-12
              "
            >
              <p
                className="
                  text-[10px]
                  font-semibold
                  tracking-[0.14em]
                  text-[#CDB78F]
                "
              >
                {isArabic
                  ? 'ملف المنافسة'
                  : 'COMPETITION RFP'}
              </p>


              {/* RFP NAME -> ORIGINAL RFP */}

              <a
                href={
                  rfpViewUrl
                }
                target="_blank"
                rel="noreferrer"
                className="
                  mt-5
                  block
                  max-w-[900px]
                  break-words
                  text-[clamp(34px,5vw,62px)]
                  font-medium
                  leading-[1.03]
                  tracking-[-0.05em]
                  text-white
                  transition-opacity

                  hover:opacity-80

                  print:text-[34px]
                "
              >
                {evaluation.rfpName}
              </a>


              <p
                className="
                  mt-7
                  max-w-[760px]
                  text-[15px]
                  leading-8
                  text-white/65

                  print:text-[12px]
                  print:leading-6
                "
              >
                {isArabic
                  ? 'تقرير شامل يلخص إطار المنافسة، نتائج تقييم عروض الموردين، الترتيب، الامتثال الإلزامي، المخاطر والتوصية النهائية لدعم المراجعة البشرية قبل قرار الترسية.'
                  : 'A comprehensive report covering the competition framework, vendor evaluation results, ranking, mandatory compliance, risk, and the final recommendation for human review before award.'}
              </p>
            </div>


            <div
              className="
                mt-14
                grid
                gap-px
                bg-white/15

                sm:grid-cols-3

                print:grid-cols-3
              "
            >
              <CoverMetric
                label={
                  isArabic
                    ? 'عدد العروض'
                    : 'VENDOR PROPOSALS'
                }
                value={
                  String(
                    evaluation.vendorCount,
                  )
                }
              />


              <CoverMetric
                label={
                  isArabic
                    ? 'العروض المؤهلة'
                    : 'ELIGIBLE VENDORS'
                }
                value={
                  String(
                    eligibleVendors.length,
                  )
                }
              />


              <CoverMetric
                label={
                  isArabic
                    ? 'تاريخ التقييم'
                    : 'EVALUATION DATE'
                }
                value={
                  formatDate(
                    evaluation.createdDate,
                    language,
                  )
                }
                compact
              />
            </div>


            <p
              className="
                mt-6
                hidden
                text-[9px]
                text-white/40

                print:block
              "
            >
              {isArabic
                ? 'اسم ملف المنافسة أعلاه رابط قابل للنقر للوصول إلى المستند الأصلي.'
                : 'The RFP filename above is a clickable link to the original source document.'}
            </p>
          </section>


          {/* ================================= */}
          {/* 01 EXECUTIVE SUMMARY */}
          {/* ================================= */}

          <ReportSection
            number="01"
            eyebrow={
              isArabic
                ? 'الملخص التنفيذي'
                : 'EXECUTIVE SUMMARY'
            }
            title={
              isArabic
                ? 'خلاصة نتيجة المنافسة'
                : 'Competition outcome at a glance'
            }
          >

            {/* RECOMMENDATION */}

            <div
              className="
                border
                border-[#E3E5EA]
                bg-[#F8F8F6]
                p-7

                print:break-inside-avoid
                print:p-5

                sm:p-8
              "
            >
              <RecommendationBadge
                evaluation={
                  evaluation
                }
                isArabic={
                  isArabic
                }
              />


              <h3
                className="
                  mt-5
                  max-w-[980px]
                  break-words
                  text-[clamp(25px,3vw,38px)]
                  font-medium
                  leading-[1.1]
                  tracking-[-0.04em]
                  text-[#131B4F]

                  print:text-[22px]
                "
              >
                {getRecommendationTitle(
                  evaluation.recommendationStatus,
                  evaluation.recommendedVendor,
                  isArabic,
                )}
              </h3>


              <p
                className="
                  mt-5
                  max-w-[1050px]
                  text-[14px]
                  leading-7
                  text-[#646D7F]

                  print:text-[11px]
                  print:leading-5
                "
              >
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
                    mt-6
                    flex
                    items-start
                    gap-3
                    border-t
                    border-[#DEE1E7]
                    pt-5
                  "
                >
                  <ShieldAlert
                    className="
                      mt-1
                      size-4
                      shrink-0
                      text-[#9466C4]
                    "
                  />

                  <p
                    className="
                      text-[13px]
                      leading-6
                      text-[#727A8C]

                      print:text-[10px]
                      print:leading-5
                    "
                  >
                    {isArabic
                      ? 'هذه التوصية استشارية ويجب إجراء مراجعة بشرية قبل أي قرار ترسية نهائي.'
                      : 'This recommendation is advisory and requires human review before any final award decision.'}
                  </p>
                </div>
              )}
            </div>


            {/* SUMMARY RESULT */}

            <div
              className="
                mt-5
                border
                border-[#E3E5EA]
                bg-white

                print:break-inside-avoid
              "
            >

              {/* TOP VENDOR */}

              <div
                className="
                  grid
                  gap-5
                  border-b
                  border-[#E3E5EA]
                  px-6
                  py-6

                  md:grid-cols-[1fr_auto]
                  md:items-center

                  print:grid-cols-[1fr_120px]
                  print:items-center
                  print:px-5
                  print:py-4
                "
              >
                <div
                  className="
                    min-w-0
                  "
                >
                  <p
                    className="
                      text-[9px]
                      font-semibold
                      tracking-[0.12em]
                      text-[#9466C4]
                    "
                  >
                    {isArabic
                      ? 'المورد المتصدر'
                      : 'TOP-RANKED VENDOR'}
                  </p>


                  {topVendor ? (
                    <Link
                      href={`/evaluations/${evaluation.id}/vendors/${topVendor.id}`}
                      className="
                        mt-2
                        block
                        break-words
                        text-[22px]
                        font-medium
                        leading-[1.2]
                        tracking-[-0.03em]
                        text-[#131B4F]
                        underline-offset-4

                        hover:underline

                        print:text-[16px]
                      "
                    >
                      {topVendor.name}
                    </Link>
                  ) : (
                    <p
                      className="
                        mt-2
                        text-[22px]
                        font-medium
                        text-[#131B4F]
                      "
                    >
                      —
                    </p>
                  )}
                </div>


                <div>
                  <p
                    className="
                      text-[9px]
                      font-semibold
                      tracking-[0.1em]
                      text-[#949BAA]
                    "
                  >
                    {isArabic
                      ? 'أعلى درجة'
                      : 'TOP SCORE'}
                  </p>


                  <p
                    className="
                      mt-1
                      text-[32px]
                      font-semibold
                      tracking-[-0.05em]
                      text-[#131B4F]

                      print:text-[24px]
                    "
                  >
                    {topVendor
                      ? formatPercent(
                          topVendor.overallScore,
                          1,
                        )
                      : '—'}
                  </p>
                </div>
              </div>


              {/* OTHER METRICS */}

              <div
                className="
                  grid

                  sm:grid-cols-3

                  print:grid-cols-3
                "
              >
                <ExecutiveMetric
                  label={
                    isArabic
                      ? 'الموردين المؤهلين'
                      : 'Eligible Vendors'
                  }
                  value={`${eligibleVendors.length}/${evaluation.vendorCount}`}
                />


                <ExecutiveMetric
                  label={
                    isArabic
                      ? 'الفجوات الإلزامية'
                      : 'Mandatory Gaps'
                  }
                  value={
                    String(
                      totalMissing,
                    )
                  }
                />


                <ExecutiveMetric
                  label={
                    isArabic
                      ? 'مخاطر مرتفعة'
                      : 'High-Risk Vendors'
                  }
                  value={
                    String(
                      highRiskVendors.length,
                    )
                  }
                  last
                />
              </div>
            </div>

          </ReportSection>


          {/* ================================= */}
          {/* 02 ORIGINAL DOCUMENTS */}
          {/* ================================= */}

          <ReportSection
            number="02"
            eyebrow={
              isArabic
                ? 'المستندات الأصلية'
                : 'SOURCE DOCUMENTS'
            }
            title={
              isArabic
                ? 'المستندات التي بُني عليها التقييم'
                : 'Original documents used in this evaluation'
            }
            cream
          >
            <p
              className="
                mb-7
                max-w-[850px]
                text-[14px]
                leading-7
                text-[#706A60]

                print:mb-5
                print:text-[11px]
                print:leading-5
              "
            >
              {isArabic
                ? 'يمكن الرجوع إلى ملف المنافسة الأصلي وعرض المورد المتصدر مباشرة من التقرير للتحقق من المستندات المصدر التي استند إليها التحليل.'
                : 'The original RFP and leading proposal can be accessed directly from this report to verify the source documents used during evaluation.'}
            </p>


            <div
              className="
                grid
                gap-5

                lg:grid-cols-2

                print:grid-cols-2
              "
            >
              <OriginalDocumentCard
                eyebrow={
                  isArabic
                    ? 'ملف المنافسة الأصلي'
                    : 'ORIGINAL RFP'
                }
                title={
                  evaluation.rfpName
                }
                description={
                  isArabic
                    ? 'المستند الأصلي المستخدم لاستخراج معايير التقييم والأوزان والمتطلبات والبنود الإلزامية.'
                    : 'Original competition document used to extract evaluation criteria, weights, requirements, and mandatory clauses.'
                }
                viewUrl={
                  rfpViewUrl
                }
                downloadUrl={
                  rfpDownloadUrl
                }
                isArabic={
                  isArabic
                }
              />


              {topVendor && (
                <OriginalDocumentCard
                  eyebrow={
                    isArabic
                      ? 'عرض المورد المتصدر'
                      : 'LEADING PROPOSAL'
                  }
                  title={
                    topVendor.name
                  }
                  description={
                    isArabic
                      ? 'النسخة الأصلية من العرض الذي حصل على المركز الأول في نتيجة التقييم الحالية.'
                      : 'Original uploaded proposal corresponding to the current highest-ranked vendor.'
                  }
                  viewUrl={
                    topProposalViewUrl
                  }
                  downloadUrl={
                    topProposalDownloadUrl
                  }
                  isArabic={
                    isArabic
                  }
                />
              )}
            </div>


            {/* PDF PREVIEWS — SCREEN ONLY */}

            <div
              className="
                mt-8
                grid
                gap-6

                print:hidden

                xl:grid-cols-2
              "
            >
              <PdfPreview
                title={
                  isArabic
                    ? 'معاينة ملف المنافسة'
                    : 'Original RFP Preview'
                }
                src={
                  rfpViewUrl
                }
              />


              {topVendor && (
                <PdfPreview
                  title={
                    isArabic
                      ? 'معاينة عرض المورد المتصدر'
                      : 'Leading Proposal Preview'
                  }
                  src={
                    topProposalViewUrl
                  }
                />
              )}
            </div>
          </ReportSection>


          {/* ================================= */}
          {/* 03 RANKING */}
          {/* ================================= */}

          <ReportSection
            number="03"
            eyebrow={
              isArabic
                ? 'ترتيب الموردين'
                : 'VENDOR RANKING'
            }
            title={
              isArabic
                ? 'النتائج النهائية لجميع العروض'
                : 'Final ranking across all proposals'
            }
          >
            <div
              className="
                overflow-hidden
                border
                border-[#E3E5EA]
                bg-white
              "
            >
              <div
                className="
                  hidden
                  grid-cols-[64px_minmax(220px,1fr)_100px_120px_110px]
                  gap-4
                  border-b
                  border-[#E3E5EA]
                  bg-[#F8F9FB]
                  px-5
                  py-3
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.08em]
                  text-[#8A91A0]

                  md:grid

                  print:grid
                  print:grid-cols-[50px_minmax(180px,1fr)_80px_95px_90px]
                  print:px-4
                  print:text-[8px]
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
                    ? 'الامتثال'
                    : 'Compliance'}
                </span>

                <span>
                  {isArabic
                    ? 'الأهلية'
                    : 'Eligibility'}
                </span>
              </div>


              {sortedVendors.map(
                (
                  vendor,
                  index,
                ) => (
                  <VendorReportRow
                    key={
                      vendor.id
                    }
                    vendor={
                      vendor
                    }
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
          </ReportSection>


          {/* ================================= */}
          {/* 04 TOP PROPOSAL */}
          {/* ================================= */}

          {topVendor && (
            <ReportSection
              number="04"
              eyebrow={
                isArabic
                  ? 'مراجعة العرض المتصدر'
                  : 'TOP PROPOSAL REVIEW'
              }
              title={
                isArabic
                  ? 'تحليل المورد الأعلى ترتيبًا'
                  : 'Detailed review of the leading vendor'
              }
              cream
            >
              <div
                className="
                  border
                  border-[#DDD5C7]
                  bg-white
                "
              >
                <div
                  className="
                    grid
                    gap-6
                    border-b
                    border-[#E8EAF0]
                    p-7

                    lg:grid-cols-[1fr_auto]

                    print:grid-cols-[1fr_180px]
                    print:p-5

                    sm:p-8
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
                        items-start
                        gap-3
                      "
                    >
                      <span
                        className="
                          flex
                          size-10
                          shrink-0
                          items-center
                          justify-center
                          bg-[#131B4F]
                          text-xs
                          font-semibold
                          text-white
                        "
                      >
                        #{topVendor.rank}
                      </span>


                      <div
                        className="
                          min-w-0
                        "
                      >
                        <p
                          className="
                            text-[9px]
                            font-semibold
                            tracking-[0.1em]
                            text-[#9466C4]
                          "
                        >
                          {isArabic
                            ? 'تقييم المورد'
                            : 'VENDOR EVALUATION'}
                        </p>


                        {/* VENDOR NAME -> VENDOR EVALUATION PAGE */}

                        <Link
                          href={`/evaluations/${evaluation.id}/vendors/${topVendor.id}`}
                          className="
                            mt-2
                            block
                            break-words
                            text-[24px]
                            font-medium
                            leading-[1.15]
                            tracking-[-0.035em]
                            text-[#131B4F]
                            underline-offset-4

                            hover:underline

                            print:text-[16px]
                          "
                        >
                          {topVendor.name}
                        </Link>
                      </div>
                    </div>


                    <div
                      className="
                        mt-4
                        flex
                        flex-wrap
                        gap-2
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
                      grid
                      grid-cols-2
                      gap-6
                    "
                  >
                    <SmallResult
                      label={
                        isArabic
                          ? 'الدرجة'
                          : 'Score'
                      }
                      value={
                        formatPercent(
                          topVendor.overallScore,
                          1,
                        )
                      }
                    />


                    <SmallResult
                      label={
                        isArabic
                          ? 'الامتثال'
                          : 'Compliance'
                      }
                      value={
                        formatPercent(
                          topVendor.overallMandatoryCompliance,
                          1,
                        )
                      }
                    />
                  </div>
                </div>


                <div
                  className="
                    px-7
                    py-6

                    print:px-5
                    print:py-4

                    sm:px-8
                  "
                >
                  <p
                    className="
                      text-[14px]
                      leading-7
                      text-[#646D7F]

                      print:text-[10px]
                      print:leading-5
                    "
                  >
                    {topVendor.summary ||
                      topVendor.complianceAssessment ||
                      (
                        isArabic
                          ? 'لم يتم إرجاع ملخص لهذا المورد.'
                          : 'No summary was returned for this vendor.'
                      )}
                  </p>
                </div>


                <div
                  className="
                    grid
                    border-t
                    border-[#E8EAF0]

                    lg:grid-cols-2

                    print:grid-cols-2
                  "
                >
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


                {/* ORIGINAL PROPOSAL ACTIONS */}

                <div
                  className="
                    flex
                    flex-wrap
                    gap-3
                    border-t
                    border-[#E8EAF0]
                    px-7
                    py-5

                    print:hidden

                    sm:px-8
                  "
                >
                  <Link
                    href={`/evaluations/${evaluation.id}/vendors/${topVendor.id}`}
                    className="
                      inline-flex
                      h-10
                      items-center
                      gap-2
                      bg-[#131B4F]
                      px-4
                      text-xs
                      font-semibold
                      text-white
                    "
                  >
                    {isArabic
                      ? 'فتح تقييم المورد'
                      : 'Open Vendor Evaluation'}
                  </Link>


                  <a
                    href={
                      topProposalViewUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="
                      inline-flex
                      h-10
                      items-center
                      gap-2
                      border
                      border-[#D3D7E0]
                      px-4
                      text-xs
                      font-semibold
                      text-[#131B4F]
                    "
                  >
                    <ExternalLink
                      className="
                        size-3.5
                      "
                    />

                    {isArabic
                      ? 'فتح العرض الأصلي'
                      : 'View Original Proposal'}
                  </a>


                  <a
                    href={
                      topProposalDownloadUrl
                    }
                    download
                    className="
                      inline-flex
                      h-10
                      items-center
                      gap-2
                      border
                      border-[#D3D7E0]
                      px-4
                      text-xs
                      font-semibold
                      text-[#131B4F]
                    "
                  >
                    <Download
                      className="
                        size-3.5
                      "
                    />

                    {isArabic
                      ? 'تحميل العرض'
                      : 'Download Proposal'}
                  </a>
                </div>
              </div>
            </ReportSection>
          )}


          {/* ================================= */}
          {/* 05 COMPLIANCE */}
          {/* ================================= */}

          <ReportSection
            number="05"
            eyebrow={
              isArabic
                ? 'الامتثال والمخاطر'
                : 'COMPLIANCE & RISK'
            }
            title={
              isArabic
                ? 'مراجعة الامتثال لجميع الموردين'
                : 'Compliance review across all vendors'
            }
          >
            <div
              className="
                grid
                gap-4

                lg:grid-cols-2

                print:grid-cols-2
                print:gap-3
              "
            >
              {sortedVendors.map(
                (
                  vendor,
                ) => (
                  <ComplianceCard
                    key={
                      vendor.id
                    }
                    vendor={
                      vendor
                    }
                    isArabic={
                      isArabic
                    }
                  />
                ),
              )}
            </div>
          </ReportSection>


          {/* ================================= */}
          {/* 06 METHODOLOGY */}
          {/* ================================= */}

          <ReportSection
            number="06"
            eyebrow={
              isArabic
                ? 'منهجية التقييم'
                : 'METHODOLOGY'
            }
            title={
              isArabic
                ? 'كيف تم بناء النتيجة؟'
                : 'How the evaluation was produced'
            }
            cream
          >
            <div
              className="
                grid
                gap-5

                lg:grid-cols-3

                print:grid-cols-3
                print:gap-3
              "
            >
              <MethodologyItem
                number="01"
                title={
                  isArabic
                    ? 'استخراج إطار المنافسة'
                    : 'RFP Framework Extraction'
                }
                description={
                  isArabic
                    ? 'يتم استخراج معايير التقييم والأوزان والمتطلبات والبنود الإلزامية من مستند المنافسة الأصلي.'
                    : 'Evaluation criteria, weights, requirements, and mandatory clauses are extracted from the original RFP.'
                }
              />


              <MethodologyItem
                number="02"
                title={
                  isArabic
                    ? 'تقييم العروض'
                    : 'Proposal Evaluation'
                }
                description={
                  isArabic
                    ? 'يتم تحليل كل عرض مقابل نفس إطار المنافسة وحساب النتيجة الموزونة وفق المعايير المحددة.'
                    : 'Each proposal is assessed against the same framework and weighted according to the competition criteria.'
                }
              />


              <MethodologyItem
                number="03"
                title={
                  isArabic
                    ? 'الامتثال والمراجعة'
                    : 'Compliance & Review'
                }
                description={
                  isArabic
                    ? 'يتم فحص المتطلبات الإلزامية والمخاطر والأهلية بشكل مستقل عن الترتيب، وتظل التوصية النهائية خاضعة للمراجعة البشرية.'
                    : 'Mandatory compliance, risk, and eligibility are reviewed separately from ranking, with the final recommendation remaining subject to human review.'
                }
              />
            </div>


            <div
              className="
                mt-6
                flex
                items-start
                gap-3
                bg-[#131B4F]
                px-6
                py-5
                text-white

                print:break-inside-avoid
                print:px-5
                print:py-4
              "
            >
              <ShieldAlert
                className="
                  mt-1
                  size-4
                  shrink-0
                  text-[#CDB78F]
                "
              />


              <p
                className="
                  text-[13px]
                  leading-7
                  text-white/70

                  print:text-[9px]
                  print:leading-5
                "
              >
                {isArabic
                  ? 'هذا التقرير أداة دعم قرار ولا يمثل قرار ترسية آلي. يجب التحقق من المستندات الأصلية وإجراء المراجعة البشرية المطلوبة قبل أي قرار شراء نهائي.'
                  : 'This report is a decision-support tool and does not represent an automated award decision. Original documents should be verified and the required human review completed before any final procurement decision.'}
              </p>
            </div>
          </ReportSection>


          {/* ================================= */}
          {/* SCREEN END BAR */}
          {/* ================================= */}

          <div
            className="
              border-t
              border-[#E3E5EA]
              bg-[#131B4F]
              px-8
              py-7
              text-white

              print:hidden
            "
          >
            <div
              className="
                flex
                flex-col
                gap-4

                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div>
                <p
                  className="
                    text-[10px]
                    font-semibold
                    tracking-[0.12em]
                    text-[#CDB78F]
                  "
                >
                  {isArabic
                    ? 'نهاية التقرير'
                    : 'END OF REPORT'}
                </p>


                <p
                  className="
                    mt-1
                    text-sm
                    text-white/60
                  "
                >
                  {evaluation.rfpName}
                </p>
              </div>


              <button
                type="button"
                onClick={
                  handleDownloadReport
                }
                className="
                  inline-flex
                  h-11
                  items-center
                  justify-center
                  gap-2
                  bg-[#CDB78F]
                  px-5
                  text-sm
                  font-semibold
                  text-[#131B4F]
                "
              >
                <Download
                  className="
                    size-4
                  "
                />

                {isArabic
                  ? 'تحميل PDF'
                  : 'Download PDF'}
              </button>
            </div>
          </div>

        </main>
      </div>
    </>
  )
}


/* ========================================== */
/* REPORT SECTION */
/* ========================================== */

function ReportSection({
  number,
  eyebrow,
  title,
  children,
  cream = false,
}: {
  number: string
  eyebrow: string
  title: string
  children: ReactNode
  cream?: boolean
}) {
  return (
    <section
      className={cn(
        `
          px-7
          py-12

          print:px-6
          print:py-6

          sm:px-10
          sm:py-14

          lg:px-14
        `,

        cream
          ? `
              bg-[#F1ECE0]

              print:bg-[#F7F4ED]
            `
          : 'bg-white',
      )}
    >
      <div
        className="
          mb-8
          grid
          gap-4
          border-b
          border-[#DDE0E6]
          pb-6

          md:grid-cols-[70px_1fr]

          print:mb-5
          print:grid-cols-[52px_1fr]
          print:pb-4
        "
      >
        <span
          className="
            text-[36px]
            font-light
            leading-none
            tracking-[-0.055em]
            text-[#CDB78F]

            print:text-[28px]
          "
        >
          {number}
        </span>


        <div>
          <p
            className="
              text-[10px]
              font-semibold
              tracking-[0.13em]
              text-[#9466C4]

              print:text-[8px]
            "
          >
            {eyebrow}
          </p>


          <h2
            className="
              mt-2
              text-[clamp(28px,3vw,40px)]
              font-medium
              leading-[1.08]
              tracking-[-0.04em]
              text-[#131B4F]

              print:text-[24px]
            "
          >
            {title}
          </h2>
        </div>
      </div>


      {children}
    </section>
  )
}


/* ========================================== */
/* COVER METRIC */
/* ========================================== */

function CoverMetric({
  label,
  value,
  compact = false,
}: {
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div
      className="
        bg-[#131B4F]
        px-5
        py-5
      "
    >
      <p
        className="
          text-[9px]
          font-semibold
          tracking-[0.12em]
          text-white/40
        "
      >
        {label}
      </p>


      <p
        className={cn(
          `
            mt-2
            font-medium
            tracking-[-0.04em]
            text-white
          `,

          compact
            ? `
                text-[17px]

                print:text-[13px]
              `
            : `
                text-[28px]

                print:text-[22px]
              `,
        )}
      >
        {value}
      </p>
    </div>
  )
}


/* ========================================== */
/* EXECUTIVE METRIC */
/* ========================================== */

function ExecutiveMetric({
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
          min-h-[120px]
          px-6
          py-5

          print:min-h-0
          print:px-4
          print:py-4
        `,

        !last &&
          `
            border-b
            border-[#E3E5EA]

            sm:border-b-0
            sm:border-e

            print:border-b-0
            print:border-e
          `,
      )}
    >
      <p
        className="
          text-[9px]
          font-semibold
          tracking-[0.1em]
          text-[#949BAA]

          print:text-[7px]
        "
      >
        {label}
      </p>


      <p
        className="
          mt-3
          text-[29px]
          font-semibold
          tracking-[-0.04em]
          text-[#131B4F]

          print:text-[20px]
        "
      >
        {value}
      </p>
    </div>
  )
}


/* ========================================== */
/* ORIGINAL DOCUMENT CARD */
/* ========================================== */

function OriginalDocumentCard({
  eyebrow,
  title,
  description,
  viewUrl,
  downloadUrl,
  isArabic,
}: {
  eyebrow: string
  title: string
  description: string
  viewUrl: string
  downloadUrl: string
  isArabic: boolean
}) {
  return (
    <article
      className="
        border
        border-[#DDD5C7]
        bg-white

        print:break-inside-avoid
      "
    >
      <div
        className="
          p-6

          print:p-4

          sm:p-7
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
              flex
              size-11
              shrink-0
              items-center
              justify-center
              bg-[#131B4F]
              text-white

              print:size-9
            "
          >
            <FileText
              className="
                size-5

                print:size-4
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
                text-[9px]
                font-semibold
                tracking-[0.12em]
                text-[#9466C4]

                print:text-[7px]
              "
            >
              {eyebrow}
            </p>


            {/* ORIGINAL PDF LINK */}

            <a
              href={
                viewUrl
              }
              target="_blank"
              rel="noreferrer"
              className="
                mt-2
                block
                break-words
                text-[17px]
                font-semibold
                leading-6
                text-[#131B4F]

                hover:underline
                hover:underline-offset-4

                print:text-[12px]
                print:leading-5
              "
            >
              {title}
            </a>


            <p
              className="
                mt-3
                text-[13px]
                leading-6
                text-[#727A8C]

                print:text-[9px]
                print:leading-4
              "
            >
              {description}
            </p>
          </div>
        </div>
      </div>


      <div
        className="
          flex
          flex-wrap
          gap-3
          border-t
          border-[#E8EAF0]
          px-6
          py-4

          print:hidden

          sm:px-7
        "
      >
        <a
          href={
            viewUrl
          }
          target="_blank"
          rel="noreferrer"
          className="
            inline-flex
            h-9
            items-center
            gap-2
            bg-[#131B4F]
            px-4
            text-xs
            font-semibold
            text-white
          "
        >
          <ExternalLink
            className="
              size-3.5
            "
          />

          {isArabic
            ? 'فتح الملف الأصلي'
            : 'View Original'}
        </a>


        <a
          href={
            downloadUrl
          }
          download
          className="
            inline-flex
            h-9
            items-center
            gap-2
            border
            border-[#D3D7E0]
            px-4
            text-xs
            font-semibold
            text-[#131B4F]
          "
        >
          <Download
            className="
              size-3.5
            "
          />

          {isArabic
            ? 'تحميل PDF'
            : 'Download PDF'}
        </a>
      </div>


      <div
        className="
          hidden
          border-t
          border-[#E8EAF0]
          px-4
          py-3
          text-[8px]
          text-[#8A91A0]

          print:block
        "
      >
        {isArabic
          ? 'اضغط على اسم المستند لفتح الملف الأصلي.'
          : 'Click the document name to open the original PDF.'}
      </div>
    </article>
  )
}


/* ========================================== */
/* PDF PREVIEW */
/* ========================================== */

function PdfPreview({
  title,
  src,
}: {
  title: string
  src: string
}) {
  return (
    <div
      className="
        border
        border-[#DDD5C7]
        bg-white
      "
    >
      <div
        className="
          flex
          items-center
          gap-2
          border-b
          border-[#E8EAF0]
          px-5
          py-4
        "
      >
        <FileCheck2
          className="
            size-4
            text-[#9466C4]
          "
        />

        <p
          className="
            text-sm
            font-semibold
            text-[#131B4F]
          "
        >
          {title}
        </p>
      </div>


      <iframe
        src={
          src
        }
        title={
          title
        }
        className="
          block
          h-[620px]
          w-full
          border-0
          bg-[#F4F5F7]
        "
      />
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
    <div
      className={cn(
        `
          grid
          gap-4
          px-5
          py-5

          print:break-inside-avoid
          print:grid-cols-[50px_minmax(180px,1fr)_80px_95px_90px]
          print:items-center
          print:px-4
          print:py-3

          md:grid-cols-[64px_minmax(220px,1fr)_100px_120px_110px]
          md:items-center
        `,

        !last &&
          'border-b border-[#E8EAF0]',
      )}
    >
      <div>
        <MobileLabel
          isArabic={
            isArabic
          }
          arabic="الترتيب"
          english="Rank"
        />

        <p
          className="
            text-[17px]
            font-semibold
            text-[#131B4F]

            print:text-[12px]
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
        <MobileLabel
          isArabic={
            isArabic
          }
          arabic="المورد"
          english="Vendor"
        />


        {/* EVERY VENDOR NAME -> ITS EVALUATION PAGE */}

        <Link
          href={`/evaluations/${evaluationId}/vendors/${vendor.id}`}
          className="
            block
            break-words
            text-[14px]
            font-semibold
            leading-5
            text-[#131B4F]
            underline-offset-4

            hover:underline

            print:text-[9px]
            print:leading-4
          "
        >
          {vendor.name}
        </Link>


        <div
          className="
            mt-2

            print:mt-1
          "
        >
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


      <div>
        <MobileLabel
          isArabic={
            isArabic
          }
          arabic="الدرجة"
          english="Score"
        />

        <p
          className="
            text-[16px]
            font-semibold
            text-[#131B4F]

            print:text-[11px]
          "
        >
          {formatPercent(
            vendor.overallScore,
            1,
          )}
        </p>
      </div>


      <div>
        <MobileLabel
          isArabic={
            isArabic
          }
          arabic="الامتثال"
          english="Compliance"
        />

        <p
          className="
            text-[16px]
            font-semibold
            text-[#131B4F]

            print:text-[11px]
          "
        >
          {formatPercent(
            vendor.overallMandatoryCompliance,
            1,
          )}
        </p>
      </div>


      <div>
        <MobileLabel
          isArabic={
            isArabic
          }
          arabic="الأهلية"
          english="Eligibility"
        />

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
  )
}


/* ========================================== */
/* MOBILE LABEL */
/* ========================================== */

function MobileLabel({
  isArabic,
  arabic,
  english,
}: {
  isArabic: boolean
  arabic: string
  english: string
}) {
  return (
    <p
      className="
        mb-1
        text-[9px]
        font-semibold
        uppercase
        tracking-[0.08em]
        text-[#9298A5]

        md:hidden

        print:hidden
      "
    >
      {isArabic
        ? arabic
        : english}
    </p>
  )
}


/* ========================================== */
/* SMALL RESULT */
/* ========================================== */

function SmallResult({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <p
        className="
          text-[9px]
          font-semibold
          tracking-[0.1em]
          text-[#949BAA]

          print:text-[7px]
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1
          text-[22px]
          font-semibold
          tracking-[-0.035em]
          text-[#131B4F]

          print:text-[16px]
        "
      >
        {value}
      </p>
    </div>
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
        `
          px-7
          py-6

          print:px-5
          print:py-4

          sm:px-8
        `,

        positive &&
          `
            border-b
            border-[#E8EAF0]

            lg:border-b-0
            lg:border-e

            print:border-b-0
            print:border-e
          `,
      )}
    >
      <div
        className="
          flex
          items-center
          gap-2
        "
      >
        {positive ? (
          <CheckCircle2
            className="
              size-4
              text-[#25724C]
            "
          />
        ) : (
          <XCircle
            className="
              size-4
              text-[#A44444]
            "
          />
        )}


        <h4
          className="
            text-sm
            font-semibold
            text-[#131B4F]

            print:text-[10px]
          "
        >
          {title}
        </h4>
      </div>


      {items.length >
      0 ? (
        <ul
          className="
            mt-4
            space-y-3

            print:mt-3
            print:space-y-2
          "
        >
          {items.map(
            (
              item,
              index,
            ) => (
              <li
                key={`${item}-${index}`}
                className="
                  flex
                  gap-2.5
                  text-[13px]
                  leading-6
                  text-[#646D7F]

                  print:text-[8px]
                  print:leading-4
                "
              >
                <span
                  className={cn(
                    `
                      mt-[9px]
                      size-1.5
                      shrink-0
                      rounded-full

                      print:mt-[6px]
                      print:size-1
                    `,

                    positive
                      ? 'bg-[#5FAC81]'
                      : 'bg-[#DD3A3B]',
                  )}
                />

                <span>
                  {item}
                </span>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p
          className="
            mt-4
            text-[13px]
            leading-6
            text-[#727A8C]

            print:text-[8px]
            print:leading-4
          "
        >
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
    <article
      className="
        border
        border-[#E3E5EA]
        bg-white
        px-5
        py-5

        print:break-inside-avoid
        print:px-4
        print:py-4

        sm:px-6
      "
    >
      <div
        className="
          flex
          items-start
          justify-between
          gap-4
        "
      >
        <div
          className="
            min-w-0
          "
        >
          <h3
            className="
              break-words
              text-[14px]
              font-semibold
              leading-5
              text-[#131B4F]

              print:text-[9px]
              print:leading-4
            "
          >
            {vendor.name}
          </h3>


          <div
            className="
              mt-3
              flex
              flex-wrap
              gap-2

              print:mt-2
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


        <p
          className="
            shrink-0
            text-[22px]
            font-semibold
            tracking-[-0.04em]
            text-[#131B4F]

            print:text-[15px]
          "
        >
          {formatPercent(
            vendor.overallMandatoryCompliance,
            1,
          )}
        </p>
      </div>


      <div
        className="
          mt-5
          h-1.5
          overflow-hidden
          bg-[#ECEEF2]

          print:mt-3
          print:h-1
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
                vendor.overallMandatoryCompliance,
                0,
              ),
              100,
            )}%`,
          }}
        />
      </div>


      <p
        className="
          mt-5
          text-[12px]
          leading-6
          text-[#727A8C]

          print:mt-3
          print:text-[8px]
          print:leading-4
        "
      >
        {vendor.complianceAssessment ||
          (
            isArabic
              ? 'لم يتم إرجاع تقييم للامتثال.'
              : 'No compliance assessment was returned.'
          )}
      </p>


      {vendor.missingRequirements.length >
        0 && (
        <div
          className="
            mt-5
            border-t
            border-[#E8EAF0]
            pt-4

            print:mt-3
            print:pt-2
          "
        >
          <p
            className="
              text-[10px]
              font-semibold
              text-[#A44444]

              print:text-[7px]
            "
          >
            {isArabic
              ? `${vendor.missingRequirements.length} متطلبات مفقودة`
              : `${vendor.missingRequirements.length} missing requirements`}
          </p>
        </div>
      )}
    </article>
  )
}


/* ========================================== */
/* METHODOLOGY ITEM */
/* ========================================== */

function MethodologyItem({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <article
      className="
        border
        border-[#DDD5C7]
        bg-white
        p-6

        print:break-inside-avoid
        print:p-4
      "
    >
      <p
        className="
          text-[11px]
          font-semibold
          tracking-[0.1em]
          text-[#9466C4]

          print:text-[8px]
        "
      >
        {number}
      </p>


      <h3
        className="
          mt-5
          text-[17px]
          font-semibold
          text-[#131B4F]

          print:mt-3
          print:text-[11px]
        "
      >
        {title}
      </h3>


      <p
        className="
          mt-3
          text-[13px]
          leading-6
          text-[#727A8C]

          print:text-[8px]
          print:leading-4
        "
      >
        {description}
      </p>
    </article>
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
      <span
        className="
          inline-flex
          w-fit
          bg-[#FFF1F1]
          px-3
          py-1.5
          text-xs
          font-semibold
          text-[#A44444]

          print:px-2
          print:py-1
          print:text-[8px]
        "
      >
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
      <span
        className="
          inline-flex
          w-fit
          bg-[#FFF8E8]
          px-3
          py-1.5
          text-xs
          font-semibold
          text-[#966515]

          print:px-2
          print:py-1
          print:text-[8px]
        "
      >
        {isArabic
          ? 'يتطلب مراجعة بشرية'
          : 'Human Review Required'}
      </span>
    )
  }


  return (
    <span
      className="
        inline-flex
        w-fit
        bg-[#EEF8F2]
        px-3
        py-1.5
        text-xs
        font-semibold
        text-[#25724C]

        print:px-2
        print:py-1
        print:text-[8px]
      "
    >
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
    <span
      className="
        inline-flex
        w-fit
        items-center
        gap-1
        bg-[#EEF8F2]
        px-2
        py-1
        text-[10px]
        font-semibold
        text-[#25724C]

        print:px-1.5
        print:py-1
        print:text-[7px]
      "
    >
      <CheckCircle2
        className="
          size-3

          print:size-2.5
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
        gap-1
        bg-[#FFF1F1]
        px-2
        py-1
        text-[10px]
        font-semibold
        text-[#A44444]

        print:px-1.5
        print:py-1
        print:text-[7px]
      "
    >
      <XCircle
        className="
          size-3

          print:size-2.5
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
          gap-1
          px-2
          py-1
          text-[10px]
          font-semibold

          print:px-1.5
          print:py-1
          print:text-[7px]
        `,

        styles[risk],
      )}
    >
      <ShieldAlert
        className="
          size-3

          print:size-2.5
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
      ? 'التقييم يتطلب مراجعة بشرية'
      : 'Evaluation Requires Human Review'
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
    <div
      className="
        min-h-screen
        bg-[#F5F5F3]
        px-5
        py-8

        sm:px-8
      "
    >
      <div
        className="
          mx-auto
          max-w-[1280px]
          bg-white
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
            space-y-8
            px-8
            py-10
          "
        >
          <div
            className="
              h-[260px]
              animate-pulse
              bg-[#F2F3F5]
            "
          />


          <div
            className="
              h-[420px]
              animate-pulse
              bg-[#F2F3F5]
            "
          />


          <div
            className="
              h-[360px]
              animate-pulse
              bg-[#F2F3F5]
            "
          />
        </div>
      </div>
    </div>
  )
}