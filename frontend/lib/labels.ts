import type {
  EvaluationStatus,
  RecommendationStatus,
  RequirementMatchStatus,
  RiskLevel,
} from './types'

import type {
  Language,
} from './i18n/translations'


const evaluationStatusEnglish: Record<
  EvaluationStatus,
  string
> = {
  DRAFT: 'Draft',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  REQUIRES_REVIEW: 'Requires Review',
}


const evaluationStatusArabic: Record<
  EvaluationStatus,
  string
> = {
  DRAFT: 'مسودة',
  PROCESSING: 'قيد المعالجة',
  COMPLETED: 'مكتمل',
  REQUIRES_REVIEW: 'يتطلب مراجعة',
}


const recommendationStatusEnglish: Record<
  RecommendationStatus,
  string
> = {
  RECOMMENDED_FOR_REVIEW:
    'Recommended for Review',

  NO_ELIGIBLE_VENDOR:
    'No Eligible Vendor',

  REQUIRES_HUMAN_REVIEW:
    'Requires Human Review',
}


const recommendationStatusArabic: Record<
  RecommendationStatus,
  string
> = {
  RECOMMENDED_FOR_REVIEW:
    'موصى به للمراجعة',

  NO_ELIGIBLE_VENDOR:
    'لا يوجد مورد مؤهل',

  REQUIRES_HUMAN_REVIEW:
    'يتطلب مراجعة بشرية',
}


const riskLevelEnglish: Record<
  RiskLevel,
  string
> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}


const riskLevelArabic: Record<
  RiskLevel,
  string
> = {
  LOW: 'منخفض',
  MEDIUM: 'متوسط',
  HIGH: 'مرتفع',
}


const matchStatusEnglish: Record<
  RequirementMatchStatus,
  string
> = {
  FULL_MATCH: 'Full Match',
  PARTIAL_MATCH: 'Partial Match',
  NO_MATCH: 'No Match',
  NOT_PROVIDED: 'Not Provided',
}


const matchStatusArabic: Record<
  RequirementMatchStatus,
  string
> = {
  FULL_MATCH: 'مطابقة كاملة',
  PARTIAL_MATCH: 'مطابقة جزئية',
  NO_MATCH: 'غير مطابق',
  NOT_PROVIDED: 'غير مقدم',
}


/* ========================================== */
/* EVALUATION STATUS */
/* ========================================== */

export function getEvaluationStatusLabel(
  status: EvaluationStatus,
  language: Language = 'en',
): string {
  if (language === 'ar') {
    return (
      evaluationStatusArabic[
        status
      ] ?? status
    )
  }

  return (
    evaluationStatusEnglish[
      status
    ] ?? status
  )
}


/* ========================================== */
/* RECOMMENDATION STATUS */
/* ========================================== */

export function getRecommendationStatusLabel(
  status: RecommendationStatus,
  language: Language = 'en',
): string {
  if (language === 'ar') {
    return (
      recommendationStatusArabic[
        status
      ] ?? status
    )
  }

  return (
    recommendationStatusEnglish[
      status
    ] ?? status
  )
}


/* ========================================== */
/* RISK LEVEL */
/* ========================================== */

export function getRiskLevelLabel(
  risk: RiskLevel,
  language: Language = 'en',
): string {
  if (language === 'ar') {
    return (
      riskLevelArabic[
        risk
      ] ?? risk
    )
  }

  return (
    riskLevelEnglish[
      risk
    ] ?? risk
  )
}


/* ========================================== */
/* REQUIREMENT MATCH STATUS */
/* ========================================== */

export function getMatchStatusLabel(
  status: RequirementMatchStatus,
  language: Language = 'en',
): string {
  if (language === 'ar') {
    return (
      matchStatusArabic[
        status
      ] ?? status
    )
  }

  return (
    matchStatusEnglish[
      status
    ] ?? status
  )
}


/* ========================================== */
/* PERCENT */
/* ========================================== */

export function formatPercent(
  value: number | null | undefined,
  digits = 1,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return '—'
  }

  return `${value.toFixed(
    digits,
  )}%`
}


/* ========================================== */
/* DATE */
/* ========================================== */

export function formatDate(
  value: string,
  language: Language = 'en',
): string {
  const date =
    new Date(value)


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }


  return date.toLocaleDateString(
    language === 'ar'
      ? 'ar-SA'
      : 'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  )
}