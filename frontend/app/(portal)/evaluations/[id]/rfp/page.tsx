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
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
} from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'

import { evaluationsApi } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/context'

import type { Evaluation } from '@/lib/types'


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


  useEffect(() => {
    let active = true

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

          setLoading(false)
        },
      )
      .catch((error) => {
        console.error(
          'Failed to load RFP framework:',
          error,
        )

        if (!active) {
          return
        }

        setEvaluation(null)
        setRfpFramework(null)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])


  const criteria =
    useMemo(() => {
      return normalizeCriteria(
        rfpFramework,
        isArabic,
      )
    }, [
      rfpFramework,
      isArabic,
    ])


  if (loading) {
    return (
      <LoadingState />
    )
  }


  if (!evaluation) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

        <EmptyState
          icon={FileText}
          title={
            isArabic
              ? 'لم يتم العثور على إطار طلب العرض'
              : 'RFP framework not found'
          }
          description={
            isArabic
              ? 'تعذر تحميل إطار التقييم لهذا الطلب.'
              : "We couldn't load the framework for this evaluation."
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
        ? 'راجع إطار التقييم المستخرج والمعايير الموزونة والمتطلبات الإلزامية المستخدمة لتقييم عروض الموردين.'
        : 'Review the extracted evaluation framework, weighted criteria, and mandatory requirements used to assess submitted vendor proposals.'
    )


  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 lg:py-9">

      {/* ===================================== */}
      {/* HEADER */}
      {/* ===================================== */}

      <header>

        <h1 className="text-[28px] font-semibold tracking-tight text-slate-950 lg:text-[30px]">
          {isArabic
            ? 'إطار متطلبات طلب العرض'
            : 'RFP Requirements Framework'}
        </h1>


        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">

          <HeaderMeta
            icon={FileText}
            text={
              evaluation.rfpName
            }
          />

          <HeaderMeta
            icon={CalendarDays}
            text={
              isArabic
                ? `تمت المعالجة ${formatDate(
                    evaluation.createdDate,
                    language,
                  )}`
                : `Processed ${formatDate(
                    evaluation.createdDate,
                    language,
                  )}`
            }
          />

          <HeaderMeta
            icon={ShieldCheck}
            text={
              isArabic
                ? `${totalCriteria} معايير`
                : `${totalCriteria} criteria`
            }
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
            active
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
          />

        </div>

      </nav>


      {/* ===================================== */}
      {/* CONTENT */}
      {/* ===================================== */}

      <main className="mt-6 space-y-5">

        {/* ================================= */}
        {/* FRAMEWORK SUMMARY */}
        {/* ================================= */}

        <section>

          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {isArabic
              ? 'ملخص الإطار'
              : 'Framework Summary'}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {isArabic
              ? 'ملخص طلب العرض والسياق المستخدم لبناء إطار التقييم.'
              : 'The extracted brief and key context used to build the evaluation framework.'}
          </p>


          <div
            className="
              mt-3
              rounded-2xl
              border
              border-[#DDE3EE]
              bg-white
              px-6
              py-5
              shadow-[0_8px_26px_rgba(22,31,86,0.04)]
              lg:px-7
            "
          >

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


              <div className="min-w-0 flex-1">

                <p className="text-sm font-semibold text-slate-950">
                  {evaluation.rfpName}
                </p>


                <p className="mt-1 text-xs text-slate-400">
                  {isArabic
                    ? 'تمت المعالجة '
                    : 'Processed '}

                  {formatDate(
                    evaluation.createdDate,
                    language,
                  )}
                </p>


                <p className="mt-4 max-w-6xl text-sm leading-7 text-slate-600">
                  {rfpSummary}
                </p>

              </div>

            </div>

          </div>

        </section>


        {/* ================================= */}
        {/* FRAMEWORK SNAPSHOT */}
        {/* ================================= */}

        <section>

          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {isArabic
              ? 'ملخص هيكل التقييم'
              : 'Framework Snapshot'}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {isArabic
              ? 'أهم الأرقام وهيكل الدرجات المستخرج من طلب العرض.'
              : 'Key counts and scoring structure for this RFP.'}
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
                  ? 'معايير التقييم'
                  : 'Evaluation Criteria'
              }
              value={String(
                totalCriteria,
              )}
              helper={
                isArabic
                  ? 'مجموعات التقييم الموزونة'
                  : 'Weighted evaluation groups'
              }
              icon={ListChecks}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'إجمالي المتطلبات'
                  : 'Total Requirements'
              }
              value={String(
                totalRequirements,
              )}
              helper={
                isArabic
                  ? 'جميع المتطلبات المستخرجة'
                  : 'All extracted requirements'
              }
              icon={FileText}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'المتطلبات الإلزامية'
                  : 'Mandatory'
              }
              value={String(
                mandatoryRequirements,
              )}
              helper={
                isArabic
                  ? 'متطلبات تؤثر على أهلية المورد'
                  : 'Eligibility-gating requirements'
              }
              icon={ShieldCheck}
            />


            <SnapshotMetric
              label={
                isArabic
                  ? 'إجمالي الوزن'
                  : 'Total Weight'
              }
              value={`${totalWeight}%`}
              helper={
                isArabic
                  ? 'إجمالي أوزان التقييم'
                  : 'Combined scoring weight'
              }
              icon={CheckCircle2}
              last
            />

          </div>

        </section>


        {/* ================================= */}
        {/* WEIGHTED CRITERIA */}
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
                  ? 'المعايير الموزونة'
                  : 'Weighted Criteria'}
              </h2>


              <p className="mt-1 text-sm text-slate-500">
                {isArabic
                  ? 'راجع المعايير وأوزان الدرجات والمتطلبات المستخرجة من طلب العرض.'
                  : 'Review criteria, scoring weights, and requirement coverage extracted from the RFP.'}
              </p>

            </div>


            <span
              className="
                rounded-full
                bg-[#F5F7FC]
                px-3
                py-1.5
                text-sm
                text-slate-500
              "
            >
              {isArabic
                ? `${criteria.length} معايير`
                : `${criteria.length} criteria`}
            </span>

          </div>


          <div className="bg-[#F8FAFD] p-4 sm:p-5">

            <div className="space-y-3">

              {criteria.map(
                (
                  criterion,
                ) => {
                  const isOpen =
                    expandedKey ===
                    criterion.key

                  const shouldScroll =
                    criterion.requirements.length >
                    8


                  return (
                    <div
                      key={
                        criterion.key
                      }
                      className="
                        overflow-hidden
                        rounded-2xl
                        border
                        border-[#E4EAF3]
                        bg-white
                        transition-all
                        duration-200
                      "
                    >

                      {/* CRITERION HEADER */}

                      <div
                        className="
                          flex
                          w-full
                          flex-col
                          gap-4
                          px-5
                          py-4
                          lg:flex-row
                          lg:items-center
                          lg:gap-5
                        "
                      >

                        {/* WEIGHT */}

                        <div
                          className="
                            flex
                            min-w-[86px]
                            shrink-0
                            items-center
                            justify-center
                            rounded-xl
                            bg-[#F4F6FB]
                            px-3
                            py-3
                            text-center
                          "
                        >

                          <div>

                            <p className="text-[25px] font-semibold leading-none text-[#161F56]">
                              {
                                criterion.weight
                              }
                            </p>


                            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {isArabic
                                ? 'الوزن %'
                                : 'Weight %'}
                            </p>

                          </div>

                        </div>


                        {/* DETAILS */}

                        <div className="min-w-0 flex-1">

                          <p className="text-base font-semibold text-slate-950">
                            {
                              criterion.name
                            }
                          </p>


                          <p className="mt-1.5 max-w-4xl text-sm leading-6 text-slate-500">
                            {
                              criterion.description
                            }
                          </p>

                        </div>


                        {/* COUNTS + TOGGLE */}

                        <div className="flex shrink-0 items-center gap-6 lg:gap-8">

                          <MiniCount
                            value={
                              criterion.totalCount
                            }
                            label={
                              isArabic
                                ? 'المتطلبات'
                                : 'Requirements'
                            }
                          />

                          <MiniCount
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
                            onClick={() =>
                              setExpandedKey(
                                isOpen
                                  ? null
                                  : criterion.key,
                              )
                            }
                            className="
                              flex
                              size-10
                              items-center
                              justify-center
                              rounded-xl
                              border
                              border-[#DDE3EE]
                              bg-white
                              text-[#5F6D8C]
                              transition-all
                              duration-200

                              hover:border-[#BCC8DE]
                              hover:bg-[#F3F6FC]
                              hover:text-[#161F56]

                              focus:outline-none
                              focus:ring-2
                              focus:ring-[#161F56]/15
                            "
                            aria-label={
                              isArabic
                                ? isOpen
                                  ? `إغلاق ${criterion.name}`
                                  : `فتح ${criterion.name}`
                                : isOpen
                                  ? `Collapse ${criterion.name}`
                                  : `Expand ${criterion.name}`
                            }
                            aria-expanded={
                              isOpen
                            }
                          >
                            <ChevronDown
                              className={cn(
                                `
                                  size-4
                                  transition-transform
                                  duration-200
                                `,
                                isOpen &&
                                  'rotate-180',
                              )}
                            />
                          </button>

                        </div>

                      </div>


                      {/* EXPANDED REQUIREMENTS */}

                      {isOpen && (
                        <div className="border-t border-[#E7EBF2] bg-[#FAFBFD]">

                          {/* REQUIREMENTS HEADER */}

                          <div
                            className="
                              flex
                              items-center
                              justify-between
                              gap-4
                              border-b
                              border-[#E7EBF2]
                              px-5
                              py-3
                            "
                          >

                            <p className="text-xs font-medium text-slate-500">
                              {isArabic
                                ? `${criterion.requirements.length} متطلبات`
                                : `${criterion.requirements.length} requirements`}
                            </p>


                            {shouldScroll && (
                              <p className="text-[11px] text-slate-400">
                                {isArabic
                                  ? 'مرر لعرض الكل'
                                  : 'Scroll to view all'}
                              </p>
                            )}

                          </div>


                          {/* SCROLL AREA */}

                          <div
                            className={cn(
                              `
                                p-4
                                sm:p-5
                              `,

                              shouldScroll &&
                                `
                                  max-h-[430px]
                                  overflow-y-auto
                                  overscroll-contain
                                `,
                            )}
                          >

                            {criterion.requirements.length >
                            0 ? (

                              <div className="grid gap-2.5 md:grid-cols-2">

                                {criterion.requirements.map(
                                  (
                                    requirement,
                                  ) => (

                                    <div
                                      key={
                                        requirement.id
                                      }
                                      className="
                                        rounded-xl
                                        border
                                        border-[#E6EAF2]
                                        bg-white
                                        px-4
                                        py-3
                                        transition-colors
                                        duration-150
                                        hover:border-[#CCD6EA]
                                        hover:bg-[#FCFDFF]
                                      "
                                    >

                                      <div className="flex items-start justify-between gap-3">

                                        <p className="text-sm leading-5 text-slate-700">
                                          {
                                            requirement.text
                                          }
                                        </p>


                                        <span
                                          className={cn(
                                            `
                                              shrink-0
                                              rounded-full
                                              px-2
                                              py-0.5
                                              text-[10px]
                                              font-semibold
                                            `,

                                            requirement.mandatory
                                              ? `
                                                  bg-rose-50
                                                  text-rose-600
                                                `
                                              : `
                                                  bg-slate-100
                                                  text-slate-500
                                                `,
                                          )}
                                        >
                                          {
                                            requirement.mandatory
                                              ? isArabic
                                                ? 'إلزامي'
                                                : 'Mandatory'
                                              : isArabic
                                                ? 'اختياري'
                                                : 'Optional'
                                          }
                                        </span>

                                      </div>


                                      {requirement.note && (
                                        <p className="mt-2 text-xs leading-5 text-slate-400">
                                          {
                                            requirement.note
                                          }
                                        </p>
                                      )}

                                    </div>

                                  ),
                                )}

                              </div>

                            ) : (

                              <div
                                className="
                                  rounded-xl
                                  border
                                  border-dashed
                                  border-[#D7DFEC]
                                  bg-white
                                  px-4
                                  py-8
                                  text-center
                                  text-sm
                                  text-slate-500
                                "
                              >
                                {isArabic
                                  ? 'لم يتم إرجاع تفاصيل للمتطلبات ضمن هذا المعيار.'
                                  : 'No requirement details were returned for this criterion.'}
                              </div>

                            )}

                          </div>

                        </div>
                      )}

                    </div>
                  )
                },
              )}

            </div>

          </div>

        </section>

      </main>

    </div>
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
    !Array.isArray(value)
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
    value.trim().length > 0
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
    Number.isFinite(value)
  ) {
    return value
  }

  if (
    typeof value ===
    'string'
  ) {
    const parsed =
      Number(value)

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
    ).length > 0
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
        ).length > 0
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
          items-center
          gap-4
          px-5
          py-4
          transition-colors
          duration-200
          hover:bg-[#F7F9FE]
        `,

        !last &&
          'border-b border-[#E7EBF2]',
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
/* MINI COUNT */
/* ========================================== */

function MiniCount({
  value,
  label,
  highlight = false,
}: {
  value: number
  label: string
  highlight?: boolean
}) {
  return (
    <div className="min-w-[64px] text-center">

      <p
        className={cn(
          'text-base font-semibold',

          highlight
            ? 'text-amber-600'
            : 'text-slate-900',
        )}
      >
        {value}
      </p>

      <p className="mt-0.5 text-[10px] text-slate-400">
        {label}
      </p>

    </div>
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

      <div className="mt-6 h-56 animate-pulse rounded-2xl bg-muted" />

      <div className="mt-5 h-80 animate-pulse rounded-2xl bg-muted" />

    </div>
  )
}