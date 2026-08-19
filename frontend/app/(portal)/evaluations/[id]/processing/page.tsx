'use client'

import {
  use,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'

import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

import {
  evaluationsApi,
  type EvaluationProcessingStatus,
} from '@/lib/api'

import { useLanguage } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'


export default function ProcessingPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } =
    use(params)

  const router =
    useRouter()

  const {
    isArabic,
  } = useLanguage()


  const [
    status,
    setStatus,
  ] =
    useState<EvaluationProcessingStatus>(
      'PROCESSING',
    )


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    )


  const [
    checking,
    setChecking,
  ] =
    useState(true)


  const [
    visualStage,
    setVisualStage,
  ] =
    useState(0)


  const stages =
    useMemo(
      () => [
        {
          title: isArabic
            ? 'معالجة المستندات'
            : 'Processing documents',

          description: isArabic
            ? 'استخراج محتوى طلب العرض وعروض الموردين.'
            : 'Extracting content from the RFP and vendor proposals.',

          icon: FileSearch,
        },

        {
          title: isArabic
            ? 'تحليل إطار التقييم'
            : 'Analyzing evaluation framework',

          description: isArabic
            ? 'تحديد المعايير والمتطلبات الإلزامية وأوزان التقييم.'
            : 'Identifying criteria, mandatory requirements, and scoring weights.',

          icon: Sparkles,
        },

        {
          title: isArabic
            ? 'تقييم عروض الموردين'
            : 'Evaluating vendor proposals',

          description: isArabic
            ? 'مقارنة عروض الموردين بمتطلبات طلب العرض وتحليل النتائج.'
            : 'Comparing vendor proposals against the RFP requirements and analyzing results.',

          icon: ShieldCheck,
        },

        {
          title: isArabic
            ? 'إعداد النتائج النهائية'
            : 'Preparing final results',

          description: isArabic
            ? 'تجميع الدرجات والترتيب والامتثال والتوصية النهائية.'
            : 'Finalizing scores, ranking, compliance, and recommendation.',

          icon: CheckCircle2,
        },
      ],
      [isArabic],
    )


  // =====================================================
  // REAL STATUS POLLING
  // =====================================================

  useEffect(() => {
    let active =
      true

    let timeout:
      ReturnType<
        typeof setTimeout
      > | null =
      null


    async function checkStatus() {
      try {
        const response =
          await evaluationsApi.getStatus(
            id,
          )


        if (!active) {
          return
        }


        setStatus(
          response.status,
        )

        setError(
          response.error ??
          null,
        )

        setChecking(
          false,
        )


        if (
          response.status ===
          'COMPLETED'
        ) {
          router.replace(
            `/evaluations/${id}`,
          )

          return
        }


        if (
          response.status ===
          'FAILED'
        ) {
          return
        }


        timeout =
          setTimeout(
            checkStatus,
            2000,
          )

      } catch (pollError) {
        if (!active) {
          return
        }


        console.error(
          'Failed to check evaluation status:',
          pollError,
        )


        setChecking(
          false,
        )


        setError(
          isArabic
            ? 'تعذر التحقق من حالة التقييم. سيتم المحاولة مرة أخرى.'
            : 'Unable to check the evaluation status. Retrying...',
        )


        timeout =
          setTimeout(
            checkStatus,
            3000,
          )
      }
    }


    checkStatus()


    return () => {
      active =
        false

      if (
        timeout
      ) {
        clearTimeout(
          timeout,
        )
      }
    }
  }, [
    id,
    router,
    isArabic,
  ])


  // =====================================================
  // VISUAL PROGRESS ONLY
  // =====================================================
  //
  // Backend currently exposes PROCESSING / COMPLETED / FAILED,
  // but does not expose the exact active agent/stage.
  //
  // This animation is only visual feedback while the real
  // PROCESSING state is active. It never triggers completion.
  // =====================================================

  useEffect(() => {
    if (
      status !==
      'PROCESSING'
    ) {
      return
    }


    const interval =
      window.setInterval(
        () => {
          setVisualStage(
            (
              current,
            ) => {
              if (
                current >=
                stages.length -
                  1
              ) {
                return current
              }

              return (
                current + 1
              )
            },
          )
        },
        7000,
      )


    return () => {
      window.clearInterval(
        interval,
      )
    }
  }, [
    status,
    stages.length,
  ])


  const progress =
    status ===
    'COMPLETED'
      ? 100
      : Math.min(
          92,
          Math.round(
            (
              (visualStage + 1) /
              stages.length
            ) *
              100,
          ),
        )


  // =====================================================
  // FAILED STATE
  // =====================================================

  if (
    status ===
    'FAILED'
  ) {
    return (
      <div className="mx-auto w-full max-w-[850px] px-4 py-14 md:px-6 lg:py-20">

        <div
          className="
            overflow-hidden
            rounded-2xl
            border
            border-rose-200
            bg-white
            shadow-[0_10px_36px_rgba(22,31,86,0.05)]
          "
        >

          <div className="px-6 py-8 text-center sm:px-8">

            <div
              className="
                mx-auto
                flex
                size-12
                items-center
                justify-center
                rounded-2xl
                bg-rose-50
                text-rose-700
              "
            >
              <AlertTriangle className="size-5" />
            </div>


            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">

              {isArabic
                ? 'تعذر إكمال التقييم'
                : 'Evaluation Could Not Be Completed'}

            </h1>


            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">

              {isArabic
                ? 'حدث خطأ أثناء معالجة المستندات أو تقييم عروض الموردين.'
                : 'An error occurred while processing the documents or evaluating the vendor proposals.'}

            </p>


            {error && (
              <div
                className="
                  mt-6
                  rounded-xl
                  border
                  border-rose-100
                  bg-rose-50/50
                  px-4
                  py-3
                  text-start
                  text-xs
                  leading-5
                  text-rose-700
                "
              >
                {error}
              </div>
            )}


            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">

              <Button
                variant="outline"
                onClick={() =>
                  router.push(
                    '/evaluations/new',
                  )
                }
              >
                {isArabic
                  ? 'بدء تقييم جديد'
                  : 'Start New Evaluation'}
              </Button>


              <Button
                onClick={() =>
                  router.push(
                    '/evaluations',
                  )
                }
              >
                {isArabic
                  ? 'العودة إلى التقييمات'
                  : 'Back to Evaluations'}
              </Button>

            </div>

          </div>

        </div>

      </div>
    )
  }


  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-10 md:px-6 lg:py-14">

      {/* ===================================== */}
      {/* HEADER */}
      {/* ===================================== */}

      <div className="mx-auto max-w-2xl text-center">

        <div
          className="
            mx-auto
            flex
            size-12
            items-center
            justify-center
            rounded-2xl
            bg-[#EEF2FB]
            text-[#161F56]
          "
        >
          <LoaderCircle className="size-5 animate-spin" />
        </div>


        <h1 className="mt-5 text-[28px] font-semibold tracking-tight text-slate-950">

          {isArabic
            ? 'جارٍ تحليل عروض الموردين'
            : 'Analyzing Proposal Submissions'}

        </h1>


        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">

          {isArabic
            ? 'يقوم النظام حاليًا بتحليل طلب العرض ومقارنة عروض الموردين. يمكنك البقاء في هذه الصفحة حتى يكتمل التقييم.'
            : 'The system is analyzing the RFP and comparing vendor submissions. You can stay on this page while the evaluation is completed.'}

        </p>

      </div>


      {/* ===================================== */}
      {/* MAIN PROCESSING CARD */}
      {/* ===================================== */}

      <div
        className="
          mt-8
          overflow-hidden
          rounded-2xl
          border
          border-[#DDE3EE]
          bg-white
          shadow-[0_10px_36px_rgba(22,31,86,0.05)]
        "
      >

        {/* PROGRESS HEADER */}

        <div className="border-b border-[#E7EBF2] px-6 py-5 sm:px-7 lg:px-8">

          <div className="flex items-center justify-between gap-4">

            <div>

              <p className="text-sm font-semibold text-slate-900">

                {isArabic
                  ? 'حالة التقييم'
                  : 'Evaluation Status'}

              </p>


              <p className="mt-1 text-xs text-slate-500">

                {checking
                  ? isArabic
                    ? 'جارٍ التحقق من الحالة...'
                    : 'Checking evaluation status...'
                  : isArabic
                    ? 'التقييم قيد المعالجة'
                    : 'Evaluation is processing'}

              </p>

            </div>


            <div className="flex items-center gap-2">

              <span
                className="
                  size-2
                  animate-pulse
                  rounded-full
                  bg-[#161F56]
                "
              />

              <span className="text-sm font-semibold text-[#161F56]">

                {isArabic
                  ? 'قيد المعالجة'
                  : 'Processing'}

              </span>

            </div>

          </div>


          <div className="mt-5">

            <div className="mb-2 flex items-center justify-between">

              <span className="text-xs text-slate-500">

                {isArabic
                  ? 'تقدم المعالجة'
                  : 'Processing progress'}

              </span>


              <span className="text-xs font-semibold tabular-nums text-[#161F56]">
                {progress}%
              </span>

            </div>


            <div className="h-2 overflow-hidden rounded-full bg-[#EDF0F5]">

              <div
                className="
                  h-full
                  rounded-full
                  bg-[#161F56]
                  transition-all
                  duration-700
                  ease-out
                "
                style={{
                  width:
                    `${progress}%`,
                }}
              />

            </div>

          </div>

        </div>


        {/* STAGES */}

        <div className="px-6 py-6 sm:px-7 lg:px-8">

          <div className="space-y-3">

            {stages.map(
              (
                stage,
                index,
              ) => {
                const completed =
                  index <
                  visualStage

                const active =
                  index ===
                  visualStage

                const Icon =
                  stage.icon


                return (
                  <div
                    key={
                      stage.title
                    }
                    className={cn(
                      `
                        flex
                        items-start
                        gap-4
                        rounded-xl
                        border
                        px-4
                        py-4
                        transition-all
                        duration-300
                      `,

                      active
                        ? `
                            border-[#C9D4EA]
                            bg-[#F7F9FE]
                          `
                        : completed
                          ? `
                              border-emerald-100
                              bg-emerald-50/35
                            `
                          : `
                              border-[#E7EBF2]
                              bg-white
                            `,
                    )}
                  >

                    <div
                      className={cn(
                        `
                          flex
                          size-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          transition-all
                          duration-300
                        `,

                        completed
                          ? `
                              bg-emerald-100
                              text-emerald-700
                            `
                          : active
                            ? `
                                bg-[#161F56]
                                text-white
                              `
                            : `
                                bg-[#F2F4F8]
                                text-slate-400
                              `,
                      )}
                    >

                      {completed ? (
                        <CheckCircle2 className="size-5" />
                      ) : active ? (
                        <LoaderCircle className="size-5 animate-spin" />
                      ) : (
                        <Icon className="size-5" />
                      )}

                    </div>


                    <div className="min-w-0 flex-1">

                      <div className="flex flex-wrap items-center gap-2">

                        <p
                          className={cn(
                            'text-sm font-semibold',

                            active
                              ? 'text-[#161F56]'
                              : completed
                                ? 'text-emerald-900'
                                : 'text-slate-700',
                          )}
                        >
                          {stage.title}
                        </p>


                        {active && (
                          <span
                            className="
                              rounded-full
                              bg-[#E9EEFA]
                              px-2
                              py-0.5
                              text-[10px]
                              font-semibold
                              text-[#161F56]
                            "
                          >
                            {isArabic
                              ? 'جارٍ التنفيذ'
                              : 'In progress'}
                          </span>
                        )}


                        {completed && (
                          <span
                            className="
                              rounded-full
                              bg-emerald-100
                              px-2
                              py-0.5
                              text-[10px]
                              font-semibold
                              text-emerald-700
                            "
                          >
                            {isArabic
                              ? 'مكتمل'
                              : 'Completed'}
                          </span>
                        )}

                      </div>


                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {stage.description}
                      </p>

                    </div>

                  </div>
                )
              },
            )}

          </div>

        </div>

      </div>


      {/* ===================================== */}
      {/* POLLING ERROR */}
      {/* ===================================== */}

      {error && (
        <div
          className="
            mt-4
            flex
            items-start
            gap-3
            rounded-xl
            border
            border-amber-200
            bg-amber-50/60
            px-4
            py-3
          "
        >

          <RefreshCw className="mt-0.5 size-4 shrink-0 text-amber-700" />


          <p className="text-xs leading-5 text-amber-800">
            {error}
          </p>

        </div>
      )}


      {/* ===================================== */}
      {/* FOOT NOTE */}
      {/* ===================================== */}

      <div
        className="
          mt-5
          flex
          items-start
          gap-3
          rounded-xl
          border
          border-[#E1E6EF]
          bg-[#FAFBFD]
          px-4
          py-3.5
        "
      >

        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#6676A6]" />


        <p className="text-xs leading-5 text-slate-500">

          {isArabic
            ? 'سيتم نقلك تلقائيًا إلى نتائج التقييم بمجرد اكتمال المعالجة.'
            : 'You will be redirected automatically to the evaluation results as soon as processing is complete.'}

        </p>

      </div>

    </div>
  )
}