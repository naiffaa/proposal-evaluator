'use client'

import Link from 'next/link'

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Info,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/context'

import type { Evaluation } from '@/lib/types'


export function RecommendationBanner({
  evaluation,
}: {
  evaluation: Evaluation
}) {
  const {
    isArabic,
  } = useLanguage()


  const status =
    evaluation.recommendationStatus


  const isRecommended =
    status ===
    'RECOMMENDED_FOR_REVIEW'


  const requiresReview =
    status ===
    'REQUIRES_HUMAN_REVIEW'


  const noEligibleVendor =
    status ===
    'NO_ELIGIBLE_VENDOR'


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


  const mandatoryCompliance =
    topVendor?.overallMandatoryCompliance ??
    null


  const config =
    isRecommended
      ? {
          icon: CheckCircle2,

          title: isArabic
            ? 'موصى به للمراجعة'
            : 'Recommended for Review',

          statusLabel: isArabic
            ? 'مؤهل'
            : 'Eligible',

          iconStyle:
            'bg-emerald-50 text-emerald-700',

          statusStyle:
            'bg-emerald-50 text-emerald-700 border-emerald-200',
        }
      : requiresReview
        ? {
            icon: AlertTriangle,

            title: isArabic
              ? 'يتطلب مراجعة بشرية'
              : 'Human Review Required',

            statusLabel: isArabic
              ? 'يتطلب مراجعة'
              : 'Needs Review',

            iconStyle:
              'bg-amber-50 text-amber-700',

            statusStyle:
              'bg-amber-50 text-amber-700 border-amber-200',
          }
        : {
            icon: CircleAlert,

            title: isArabic
              ? 'لا يوجد مورد مؤهل'
              : 'No Eligible Vendor',

            statusLabel: isArabic
              ? 'غير مؤهل'
              : 'Not Eligible',

            iconStyle:
              'bg-rose-50 text-rose-700',

            statusStyle:
              'bg-rose-50 text-rose-700 border-rose-200',
          }


  const Icon =
    config.icon


  function getPrimaryMessage() {
    if (isRecommended) {
      if (
        evaluation.recommendedVendor
      ) {
        return isArabic
          ? `${evaluation.recommendedVendor} يستوفي شروط الأهلية الحالية ويمكن الانتقال إلى المراجعة البشرية من فريق المشتريات.`
          : `${evaluation.recommendedVendor} meets the current eligibility conditions and can proceed to human procurement review.`
      }

      return isArabic
        ? 'تم تحديد مورد مؤهل ويمكن الانتقال إلى المراجعة البشرية من فريق المشتريات.'
        : 'An eligible vendor has been identified and can proceed to human procurement review.'
    }


    if (requiresReview) {
      return isArabic
        ? 'يحتوي التقييم على حالات تتطلب مراجعة فريق المشتريات قبل إصدار التوصية.'
        : 'The evaluation contains conditions that require procurement review before a recommendation can be made.'
    }


    return isArabic
      ? 'لم يتم تحقيق الحد المطلوب للامتثال الإلزامي، لذلك لا يمكن التوصية حاليًا بأي مورد للترسية.'
      : 'The mandatory compliance threshold was not met, so no vendor can currently be recommended for award.'
  }


  function getRecommendedAction() {
    if (isRecommended) {
      return isArabic
        ? 'راجع تفاصيل الدرجات والأدلة الداعمة قبل اتخاذ قرار الترسية النهائي.'
        : 'Review the detailed scoring and supporting evidence before making a final award decision.'
    }


    if (requiresReview) {
      return isArabic
        ? 'راجع بنود الامتثال والتقييم التي تم تحديدها قبل المتابعة.'
        : 'Review the flagged compliance and scoring items before proceeding.'
    }


    return isArabic
      ? 'راجع فجوات الامتثال للمتطلبات الإلزامية قبل متابعة هذا التقييم.'
      : 'Review the mandatory compliance gaps before proceeding with this evaluation.'
  }


  function getEligibleFinding() {
    if (isArabic) {
      if (eligibleCount === 0) {
        return 'لم يتم تحديد أي مورد مؤهل'
      }

      if (eligibleCount === 1) {
        return 'تم تحديد مورد مؤهل واحد'
      }

      return `تم تحديد ${eligibleCount} موردين مؤهلين`
    }


    return `${eligibleCount} eligible vendor${
      eligibleCount === 1
        ? ''
        : 's'
    }${
      noEligibleVendor
        ? ' identified'
        : ''
    }`
  }


  return (
    <section
      className="
        relative
        overflow-hidden
        rounded-2xl
        border
        border-[#DDE3EE]
        bg-white
        shadow-[0_8px_24px_rgba(22,31,86,0.04)]
      "
    >

      <div className="px-6 py-6 sm:px-7 lg:px-8">

        {/* HEADER */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

          <div className="flex items-start gap-4">

            <div
              className={cn(
                `
                  flex
                  size-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                `,
                config.iconStyle,
              )}
            >
              <Icon className="size-5" />
            </div>


            <div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7B86A4]">
                {isArabic
                  ? 'قرار التقييم'
                  : 'Evaluation Decision'}
              </p>


              <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950">
                {config.title}
              </h2>

            </div>

          </div>


          <span
            className={cn(
              `
                inline-flex
                w-fit
                items-center
                rounded-full
                border
                px-3
                py-1.5
                text-xs
                font-semibold
              `,
              config.statusStyle,
            )}
          >
            {config.statusLabel}
          </span>

        </div>


        {/* MAIN DECISION */}

        <div className="mt-6 max-w-4xl">

          <p className="text-base font-medium leading-7 text-slate-800">
            {getPrimaryMessage()}
          </p>

        </div>


        {/* KEY INFORMATION */}

        <div
          className="
            mt-6
            grid
            overflow-hidden
            rounded-xl
            border
            border-[#E5E9F1]
            bg-[#FAFBFD]
            sm:grid-cols-2
          "
        >

          <div className="px-5 py-4 sm:border-e sm:border-[#E5E9F1]">

            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A94AB]">
              {isArabic
                ? 'النتيجة الرئيسية'
                : 'Key Finding'}
            </p>


            <p className="mt-1.5 text-sm font-medium leading-6 text-slate-800">
              {requiresReview
                ? isArabic
                  ? 'يتطلب تحققًا إضافيًا'
                  : 'Additional validation required'
                : getEligibleFinding()}
            </p>


            {mandatoryCompliance !==
              null && (
              <p className="mt-1 text-xs text-slate-500">
                {isArabic
                  ? 'امتثال المورد الأعلى ترتيبًا للمتطلبات الإلزامية: '
                  : 'Top-ranked mandatory compliance: '}

                {mandatoryCompliance.toFixed(
                  1,
                )}
                %
              </p>
            )}

          </div>


          <div className="border-t border-[#E5E9F1] px-5 py-4 sm:border-t-0">

            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A94AB]">
              {isArabic
                ? 'الإجراء الموصى به'
                : 'Recommended Action'}
            </p>


            <p className="mt-1.5 text-sm font-medium leading-6 text-slate-800">
              {getRecommendedAction()}
            </p>

          </div>

        </div>


        {/* FOOTER */}

        <div
          className="
            mt-5
            flex
            flex-col
            gap-4
            border-t
            border-[#EEF1F5]
            pt-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <div className="flex items-start gap-2">

            <Info className="mt-0.5 size-4 shrink-0 text-[#7C88A5]" />


            <p className="max-w-3xl text-xs leading-5 text-slate-500">
              {isArabic
                ? 'هذا القرار استشاري. تتطلب قرارات الترسية النهائية مراجعة واعتمادًا بشريًا من فريق المشتريات.'
                : 'This decision is advisory. Final award decisions require human procurement review and approval.'}
            </p>

          </div>


          <Link
            href={`/evaluations/${evaluation.id}/compliance`}
            className="
              inline-flex
              shrink-0
              items-center
              gap-1.5
              text-sm
              font-semibold
              text-[#161F56]
              transition-opacity
              hover:opacity-70
            "
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
          </Link>

        </div>

      </div>

    </section>
  )
}