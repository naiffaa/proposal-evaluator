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
  ChevronDown,
  FileText,
  ListChecks,
  Scale,
  ShieldCheck,
} from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'

import { evaluationsApi } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/context'

import type {
  Evaluation,
} from '@/lib/types'


type AnyRecord =
  Record<string, unknown>


interface RequirementItem {
  id: string
  text: string
  mandatory: boolean
  note?: string
}


interface CriterionItem {
  key: string
  name: string
  description: string
  weight: number
  requirements: RequirementItem[]
  totalCount: number
  mandatoryCount: number
}


export default function EvaluationRfpPage({
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
    rfpFramework,
    setRfpFramework,
  ] =
    useState<AnyRecord | null>(
      null,
    )


  const [
    loading,
    setLoading,
  ] =
    useState(true)


  const [
    expandedKey,
    setExpandedKey,
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


    Promise.all([
      evaluationsApi.get(id),
      evaluationsApi.getRfp(id),
    ])
      .then(
        ([
          evaluationData,
          rfpData,
        ]) => {
          if (!active) {
            return
          }


          setEvaluation(
            evaluationData,
          )


          setRfpFramework(
            asRecord(
              rfpData,
            ),
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
            'Failed to load RFP framework:',
            error,
          )


          if (!active) {
            return
          }


          setEvaluation(
            null,
          )


          setRfpFramework(
            null,
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
  ])


  /* ========================================== */
  /* NORMALIZED CRITERIA */
  /* ========================================== */

  const criteria =
    useMemo(
      () => {
        return normalizeCriteria(
          rfpFramework,
          isArabic,
        )
      },
      [
        rfpFramework,
        isArabic,
      ],
    )


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
              FileText
            }
            title={
              isArabic
                ? 'لم يتم العثور على إطار المنافسة'
                : 'RFP framework not found'
            }
            description={
              isArabic
                ? 'تعذر تحميل إطار التقييم لهذه المنافسة.'
                : "We couldn't load the framework for this evaluation."
            }
            action={
              <Button
                nativeButton={
                  false
                }
                render={
                  <Link
                    href={`/evaluations/${id}`}
                  />
                }
              >
                {isArabic
                  ? 'العودة إلى نظرة عامة'
                  : 'Back to Overview'}
              </Button>
            }
          />
        </div>
      </div>
    )
  }


  /* ========================================== */
  /* DERIVED DATA */
  /* ========================================== */

  const totalCriteria =
    evaluation.rfp
      .totalCriteria ??
    criteria.length


  const totalRequirements =
    evaluation.rfp
      .totalRequirements ??
    criteria.reduce(
      (
        sum,
        criterion,
      ) =>
        sum +
        criterion.totalCount,
      0,
    )


  const mandatoryRequirements =
    evaluation.rfp
      .mandatoryRequirements ??
    criteria.reduce(
      (
        sum,
        criterion,
      ) =>
        sum +
        criterion.mandatoryCount,
      0,
    )


  const totalWeight =
    getNumber(
      rfpFramework?.totalWeight,

      criteria.reduce(
        (
          sum,
          criterion,
        ) =>
          sum +
          criterion.weight,
        0,
      ) || 100,
    )


  const rfpSummary =
    getString(
      rfpFramework?.summary,
    ) ||
    getString(
      rfpFramework?.description,
    ) ||
    getString(
      rfpFramework?.overview,
    ) ||
    getString(
      rfpFramework?.rfpSummary,
    ) ||
    (
      isArabic
        ? 'إطار موحد يحدد ما الذي يتم تقييمه في عروض الموردين، وأهمية كل معيار، والمتطلبات التي تؤثر على نتيجة وأهلية المورد.'
        : 'A unified framework defining what is evaluated in vendor proposals, the importance of each criterion, and the requirements affecting score and eligibility.'
    )


  const ArrowIcon =
    isArabic
      ? ArrowLeft
      : ArrowRight


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
      {/* SECTION 1 — FRAMEWORK OVERVIEW */}
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

          {/* ================================= */}
          {/* MAIN FRAMEWORK PANEL */}
          {/* ================================= */}

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


            {/* TOP */}

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
                  RFP FRAMEWORK
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
                  ? 'إطار المنافسة'
                  : 'COMPETITION FRAMEWORK'}
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
                  ? 'هنا نحدد كيف يتم تقييم كل عرض'
                  : 'This defines how every proposal is evaluated'}
              </h1>

            </div>


            {/* BOTTOM */}

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
                {rfpSummary}
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
                  {evaluation.rfpName}
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


          {/* ================================= */}
          {/* THREE KEY PARTS */}
          {/* ================================= */}

          <div
            className="
              grid
              gap-5
            "
          >

            <FrameworkOverviewCard
              number="01"
              eyebrow={
                isArabic
                  ? 'المعايير والأوزان'
                  : 'CRITERIA & WEIGHTS'
              }
              title={
                isArabic
                  ? `${totalCriteria} معايير بإجمالي وزن ${totalWeight}%`
                  : `${totalCriteria} criteria with ${totalWeight}% total weight`
              }
              description={
                isArabic
                  ? 'تحدد المعايير ما الذي نقيمه، بينما يحدد الوزن مقدار تأثير كل معيار على النتيجة النهائية.'
                  : 'Criteria define what is assessed, while weights determine how strongly each area affects the final score.'
              }
              icon={
                Scale
              }
            />


            <FrameworkOverviewCard
              number="02"
              eyebrow={
                isArabic
                  ? 'المتطلبات'
                  : 'REQUIREMENTS'
              }
              title={
                isArabic
                  ? `${totalRequirements} متطلب يتم فحص العرض مقابلها`
                  : `${totalRequirements} requirements reviewed per proposal`
              }
              description={
                isArabic
                  ? 'كل معيار يحتوي على متطلبات تفصيلية تساعد على معرفة مستوى التغطية والمطابقة في عرض المورد.'
                  : 'Each criterion contains detailed requirements used to identify proposal coverage and matching.'
              }
              icon={
                FileText
              }
            />


            <FrameworkOverviewCard
              number="03"
              eyebrow={
                isArabic
                  ? 'الأهلية'
                  : 'ELIGIBILITY'
              }
              title={
                isArabic
                  ? `${mandatoryRequirements} متطلب إلزامي`
                  : `${mandatoryRequirements} mandatory requirements`
              }
              description={
                isArabic
                  ? 'البنود الإلزامية لا تؤثر فقط على الدرجة؛ عدم استيفائها قد يؤثر مباشرة على أهلية المورد.'
                  : 'Mandatory clauses do more than affect scoring; unmet items can directly affect vendor eligibility.'
              }
              icon={
                ShieldCheck
              }
            />

          </div>

        </div>

      </section>


      {/* ===================================== */}
      {/* SECTION 2 — CRITERIA */}
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

          {/* ================================= */}
          {/* INTRO */}
          {/* ================================= */}

          <div
            className="
              grid
              gap-8

              lg:grid-cols-[340px_1fr]
              lg:items-end
            "
          >

            <div>

              <SectionEyebrow>
                {isArabic
                  ? 'تفاصيل الإطار'
                  : 'FRAMEWORK DETAIL'}
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
                  ? 'المعايير الموزونة'
                  : 'Weighted criteria'}
              </h2>

            </div>


            <div
              className="
                flex
                flex-col
                gap-5

                md:flex-row
                md:items-end
                md:justify-between
              "
            >

              <p
                className="
                  max-w-[720px]
                  text-[15px]
                  leading-8
                  text-[#70788A]
                "
              >
                {isArabic
                  ? 'هنا يظهر الجزء العملي من إطار المنافسة. افتح أي معيار لمراجعة وزنه والمتطلبات التابعة له، ومعرفة أي البنود إلزامي وأيها اختياري.'
                  : 'This is the working part of the framework. Open any criterion to review its weight, related requirements, and which items are mandatory or optional.'
                }
              </p>


              <div
                className="
                  flex
                  shrink-0
                  items-center
                  gap-2
                  border
                  border-[#E5E7EC]
                  bg-white
                  px-4
                  py-3
                "
              >

                <ListChecks
                  className="
                    size-4
                    text-[#131B4F]
                  "
                />


                <span
                  className="
                    text-sm
                    font-semibold
                    text-[#131B4F]
                  "
                >
                  {isArabic
                    ? `${criteria.length} معايير`
                    : `${criteria.length} criteria`}
                </span>

              </div>

            </div>

          </div>


          {/* ================================= */}
          {/* CRITERIA LIST */}
          {/* ================================= */}

          <div
            className="
              mt-10
              border-t
              border-[#E3E5EA]
            "
          >

            {criteria.map(
              (
                criterion,
                index,
              ) => {
                const isOpen =
                  expandedKey ===
                  criterion.key


                const shouldScroll =
                  criterion.requirements.length >
                  8


                return (
                  <article
                    key={
                      criterion.key
                    }
                    className="
                      border-b
                      border-[#E3E5EA]
                      bg-white
                    "
                  >

                    {/* ================================= */}
                    {/* CRITERION ROW */}
                    {/* ================================= */}

                    <div
                      className="
                        grid
                        gap-6
                        py-7

                        sm:py-8

                        lg:grid-cols-[150px_1fr_auto]
                        lg:items-center

                        xl:py-9
                      "
                    >

                      {/* WEIGHT */}

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
                            ? `معيار ${String(
                                index + 1,
                              ).padStart(
                                2,
                                '0',
                              )}`
                            : `CRITERION ${String(
                                index + 1,
                              ).padStart(
                                2,
                                '0',
                              )}`}
                        </p>


                        <div
                          className="
                            mt-3
                            flex
                            items-end
                            gap-1
                          "
                        >

                          <span
                            className="
                              text-[48px]
                              font-light
                              leading-none
                              tracking-[-0.065em]
                              text-[#131B4F]
                            "
                          >
                            {criterion.weight}
                          </span>


                          <span
                            className="
                              pb-1
                              text-sm
                              text-[#8E95A5]
                            "
                          >
                            %
                          </span>

                        </div>


                        <p
                          className="
                            mt-1
                            text-[10px]
                            text-[#8E95A5]
                          "
                        >
                          {isArabic
                            ? 'من الدرجة النهائية'
                            : 'of final score'}
                        </p>

                      </div>


                      {/* TEXT */}

                      <div
                        className="
                          min-w-0
                          max-w-[850px]
                        "
                      >

                        <h3
                          className="
                            text-[24px]
                            font-medium
                            leading-[1.15]
                            tracking-[-0.035em]
                            text-[#131B4F]

                            sm:text-[28px]
                          "
                        >
                          {criterion.name}
                        </h3>


                        <p
                          className="
                            mt-3
                            text-[14px]
                            leading-7
                            text-[#727A8C]
                          "
                        >
                          {criterion.description}
                        </p>

                      </div>


                      {/* COUNTS + OPEN */}

                      <div
                        className="
                          flex
                          items-center
                          gap-5

                          sm:gap-7
                        "
                      >

                        <CriterionCount
                          value={
                            criterion.totalCount
                          }
                          label={
                            isArabic
                              ? 'متطلبات'
                              : 'Requirements'
                          }
                        />


                        <CriterionCount
                          value={
                            criterion.mandatoryCount
                          }
                          label={
                            isArabic
                              ? 'إلزامي'
                              : 'Mandatory'
                          }
                          highlight={
                            criterion.mandatoryCount >
                            0
                          }
                        />


                        <button
                          type="button"
                          onClick={
                            () =>
                              setExpandedKey(
                                isOpen
                                  ? null
                                  : criterion.key,
                              )
                          }
                          className="
                            flex
                            size-12
                            shrink-0
                            items-center
                            justify-center
                            border
                            border-[#E3E5EA]
                            bg-white
                            text-[#131B4F]
                            transition-all
                            duration-300

                            hover:border-[#CDD1DA]
                            hover:bg-[#F7F8FA]

                            focus:outline-none
                            focus:ring-2
                            focus:ring-[#131B4F]/10
                          "
                          aria-expanded={
                            isOpen
                          }
                          aria-label={
                            isArabic
                              ? isOpen
                                ? `إغلاق ${criterion.name}`
                                : `فتح ${criterion.name}`
                              : isOpen
                                ? `Collapse ${criterion.name}`
                                : `Expand ${criterion.name}`
                          }
                        >

                          <ChevronDown
                            className={cn(
                              `
                                size-4
                                transition-transform
                                duration-300
                              `,

                              isOpen &&
                                'rotate-180',
                            )}
                          />

                        </button>

                      </div>

                    </div>


                    {/* ================================= */}
                    {/* OPEN REQUIREMENTS */}
                    {/* ================================= */}

                    {isOpen && (
                      <div
                        className="
                          mb-7
                          overflow-hidden
                          border
                          border-[#E3E5EA]
                          bg-white
                        "
                      >

                        {/* HEADER */}

                        <div
                          className="
                            flex
                            flex-wrap
                            items-center
                            justify-between
                            gap-4
                            border-b
                            border-[#ECEEF2]
                            bg-[#FAFBFC]
                            px-5
                            py-4

                            sm:px-6

                            xl:px-8
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
                              {isArabic
                                ? 'متطلبات المعيار'
                                : 'CRITERION REQUIREMENTS'}
                            </p>


                            <p
                              className="
                                mt-1
                                text-[14px]
                                text-[#676F80]
                              "
                            >
                              {isArabic
                                ? `${criterion.requirements.length} متطلبات مرتبطة بهذا المعيار`
                                : `${criterion.requirements.length} requirements associated with this criterion`}
                            </p>

                          </div>


                          {shouldScroll && (
                            <div
                              className="
                                flex
                                items-center
                                gap-2
                                text-xs
                                text-[#8B92A0]
                              "
                            >

                              <span
                                className="
                                  hidden
                                  h-4
                                  w-px
                                  bg-[#D9DCE3]

                                  sm:block
                                "
                              />


                              <span>
                                {isArabic
                                  ? 'مرر لعرض بقية المتطلبات'
                                  : 'Scroll to view all requirements'}
                              </span>

                            </div>
                          )}

                        </div>


                        {/* REQUIREMENTS */}

                        <div
                          className={cn(
                            `
                              bg-[#F8F9FB]
                              p-4

                              sm:p-5

                              xl:p-6
                            `,

                            shouldScroll &&
                              `
                                max-h-[520px]
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

                          {criterion.requirements.length >
                          0 ? (
                            <div
                              className="
                                grid
                                gap-3

                                lg:grid-cols-2
                              "
                            >

                              {criterion.requirements.map(
                                (
                                  requirement,
                                  requirementIndex,
                                ) => (
                                  <RequirementRow
                                    key={
                                      requirement.id
                                    }
                                    index={
                                      requirementIndex +
                                      1
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
                          ) : (
                            <div
                              className="
                                border
                                border-dashed
                                border-[#DCE0E7]
                                bg-white
                                px-5
                                py-10
                                text-center
                              "
                            >

                              <p
                                className="
                                  text-sm
                                  text-[#727A8C]
                                "
                              >
                                {isArabic
                                  ? 'لم يتم إرجاع تفاصيل للمتطلبات ضمن هذا المعيار.'
                                  : 'No requirement details were returned for this criterion.'}
                              </p>

                            </div>
                          )}

                        </div>

                      </div>
                    )}

                  </article>
                )
              },
            )}

          </div>

        </div>

      </section>


      {/* ===================================== */}
      {/* SECTION 3 — NEXT STEP */}
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

              <p
                className="
                  text-[10px]
                  font-semibold
                  tracking-[0.13em]
                  text-[#9466C4]
                "
              >
                {isArabic
                  ? 'الخطوة التالية'
                  : 'NEXT STEP'}
              </p>


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
                  ? 'شوف كيف تقارن عروض الموردين على هذا الإطار'
                  : 'See how proposals compare against this framework'}
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
                  ? 'بعد ما صار أساس التقييم واضح، انتقل للمقارنة لمراجعة درجات الموردين والفروقات بينهم على نفس المعايير.'
                  : 'Now that the evaluation basis is clear, move to comparison to review vendor scores and differences using the same criteria.'
                }
              </p>

            </div>


            <Link
              href={`/evaluations/${id}/comparison`}
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
                ? 'مقارنة الموردين'
                : 'Vendor Comparison'}


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
/* FRAMEWORK OVERVIEW CARD */
/* ========================================== */

function FrameworkOverviewCard({
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
/* CRITERION COUNT */
/* ========================================== */

function CriterionCount({
  value,
  label,
  highlight = false,
}: {
  value: number
  label: string
  highlight?: boolean
}) {
  return (
    <div
      className="
        min-w-[62px]
        text-center
      "
    >

      <p
        className={cn(
          `
            text-[18px]
            font-semibold
          `,

          highlight
            ? 'text-[#9466C4]'
            : 'text-[#131B4F]',
        )}
      >
        {value}
      </p>


      <p
        className="
          mt-0.5
          text-[10px]
          text-[#949BAA]
        "
      >
        {label}
      </p>

    </div>
  )
}


/* ========================================== */
/* REQUIREMENT ROW */
/* ========================================== */

function RequirementRow({
  index,
  requirement,
  isArabic,
}: {
  index: number
  requirement: RequirementItem
  isArabic: boolean
}) {
  return (
    <article
      className="
        border
        border-[#E7E9EE]
        bg-white
        px-4
        py-4
        transition-colors
        duration-200

        hover:border-[#D8DBE3]

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
              justify-between
              gap-4
            "
          >

            <p
              className="
                text-[14px]
                leading-7
                text-[#3E4658]
              "
            >
              {requirement.text}
            </p>


            <span
              className={cn(
                `
                  shrink-0
                  px-2.5
                  py-1
                  text-[10px]
                  font-semibold
                `,

                requirement.mandatory
                  ? `
                      bg-[#F5EAF3]
                      text-[#8A477C]
                    `
                  : `
                      bg-[#F4F5F7]
                      text-[#666D7C]
                    `,
              )}
            >
              {requirement.mandatory
                ? isArabic
                  ? 'إلزامي'
                  : 'Mandatory'
                : isArabic
                  ? 'اختياري'
                  : 'Optional'}
            </span>

          </div>


          {requirement.note && (
            <p
              className="
                mt-3
                border-t
                border-[#ECEEF2]
                pt-3
                text-xs
                leading-6
                text-[#8B92A0]
              "
            >
              {requirement.note}
            </p>
          )}

        </div>

      </div>

    </article>
  )
}


/* ========================================== */
/* DATA HELPERS */
/* ========================================== */

function asRecord(
  value: unknown,
): AnyRecord | null {
  if (
    value &&
    typeof value ===
      'object' &&
    !Array.isArray(
      value,
    )
  ) {
    return value as AnyRecord
  }


  return null
}


function getString(
  value: unknown,
): string | null {
  return (
    typeof value ===
      'string' &&
    value.trim().length >
      0
  )
    ? value
    : null
}


function getNumber(
  value: unknown,
  fallback = 0,
): number {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value,
    )
  ) {
    return value
  }


  if (
    typeof value ===
      'string'
  ) {
    const parsed =
      Number(
        value,
      )


    if (
      Number.isFinite(
        parsed,
      )
    ) {
      return parsed
    }
  }


  return fallback
}


function getBoolean(
  value: unknown,
): boolean {
  if (
    typeof value ===
      'boolean'
  ) {
    return value
  }


  if (
    typeof value ===
      'string'
  ) {
    return (
      value === 'true' ||
      value === 'yes' ||
      value === 'mandatory'
    )
  }


  return false
}


function getArray(
  value: unknown,
): unknown[] {
  return Array.isArray(
    value,
  )
    ? value
    : []
}


function normalizeCriteria(
  framework:
    AnyRecord | null,
  isArabic: boolean,
): CriterionItem[] {
  const rawCriteria =
    getArray(
      framework?.criteria,
    ).length >
    0
      ? getArray(
          framework?.criteria,
        )
      : getArray(
          framework?.weightedCriteria,
        )


  return rawCriteria.map(
    (
      rawCriterion,
      index,
    ) => {
      const criterion =
        asRecord(
          rawCriterion,
        ) ?? {}


      const rawRequirements =
        getArray(
          criterion.requirements,
        ).length >
        0
          ? getArray(
              criterion.requirements,
            )
          : getArray(
              criterion.items,
            )


      const requirements =
        rawRequirements.map(
          (
            rawRequirement,
            requirementIndex,
          ) => {
            const item =
              asRecord(
                rawRequirement,
              ) ?? {}


            return {
              id:
                getString(
                  item.id,
                ) ??
                `${index}-${requirementIndex}`,

              text:
                getString(
                  item.requirement,
                ) ??
                getString(
                  item.text,
                ) ??
                getString(
                  item.title,
                ) ??
                getString(
                  item.name,
                ) ??
                (
                  isArabic
                    ? 'متطلب بدون اسم'
                    : 'Unnamed requirement'
                ),

              mandatory:
                getBoolean(
                  item.mandatory,
                ) ||
                getBoolean(
                  item.isMandatory,
                ) ||
                getBoolean(
                  item.required,
                ),

              note:
                getString(
                  item.note,
                ) ??
                getString(
                  item.description,
                ) ??
                getString(
                  item.rationale,
                ) ??
                undefined,
            }
          },
        )


      const mandatoryCount =
        requirements.filter(
          (
            requirement,
          ) =>
            requirement.mandatory,
        ).length


      return {
        key:
          getString(
            criterion.id,
          ) ??
          getString(
            criterion.name,
          ) ??
          `criterion-${index}`,

        name:
          getString(
            criterion.name,
          ) ??
          getString(
            criterion.title,
          ) ??
          getString(
            criterion.criterionName,
          ) ??
          (
            isArabic
              ? `المعيار ${index + 1}`
              : `Criterion ${index + 1}`
          ),

        description:
          getString(
            criterion.description,
          ) ??
          getString(
            criterion.summary,
          ) ??
          getString(
            criterion.criterionDescription,
          ) ??
          (
            isArabic
              ? 'لا يوجد وصف متاح.'
              : 'No description available.'
          ),

        weight:
          getNumber(
            criterion.weight,

            getNumber(
              criterion.weightPercent,

              getNumber(
                criterion.percentage,
                0,
              ),
            ),
          ),

        requirements,

        totalCount:
          requirements.length,

        mandatoryCount,
      }
    },
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
            h-[140px]
            animate-pulse
            bg-[#F5F6F8]
          "
        />


        <div
          className="
            mt-10
            h-[460px]
            animate-pulse
            bg-[#F5F6F8]
          "
        />

      </div>

    </div>
  )
}