'use client'

import { Badge } from '@/components/ui/badge'

import {
  getEvaluationStatusLabel,
  getMatchStatusLabel,
  getRecommendationStatusLabel,
  getRiskLevelLabel,
} from '@/lib/labels'

import { useLanguage } from '@/lib/i18n/context'

import type {
  EvaluationStatus,
  RecommendationStatus,
  RequirementMatchStatus,
  RiskLevel,
} from '@/lib/types'


type Tone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'


const statusTone: Record<
  EvaluationStatus,
  Tone
> = {
  DRAFT: 'neutral',
  PROCESSING: 'info',
  COMPLETED: 'success',
  REQUIRES_REVIEW: 'warning',
}


export function StatusBadge({
  status,
  size,
}: {
  status: EvaluationStatus
  size?: 'sm' | 'md'
}) {
  const { language } =
    useLanguage()

  return (
    <Badge
      tone={statusTone[status]}
      size={size}
      dot
    >
      {getEvaluationStatusLabel(
        status,
        language,
      )}
    </Badge>
  )
}


const riskTone: Record<
  RiskLevel,
  Tone
> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
}


export function RiskBadge({
  risk,
  size,
}: {
  risk: RiskLevel
  size?: 'sm' | 'md'
}) {
  const {
    language,
    isArabic,
  } = useLanguage()

  return (
    <Badge
      tone={riskTone[risk]}
      size={size}
      dot
    >
      {isArabic
        ? `مخاطر ${getRiskLevelLabel(
            risk,
            language,
          )}`
        : `${getRiskLevelLabel(
            risk,
            language,
          )} Risk`}
    </Badge>
  )
}


export function EligibilityBadge({
  eligible,
  size,
}: {
  eligible: boolean
  size?: 'sm' | 'md'
}) {
  const { isArabic } =
    useLanguage()

  return (
    <Badge
      tone={
        eligible
          ? 'success'
          : 'danger'
      }
      size={size}
      dot
    >
      {eligible
        ? isArabic
          ? 'مؤهل'
          : 'Eligible'
        : isArabic
          ? 'غير مؤهل'
          : 'Not Eligible'}
    </Badge>
  )
}


const matchTone: Record<
  RequirementMatchStatus,
  Tone
> = {
  FULL_MATCH: 'success',
  PARTIAL_MATCH: 'warning',
  NO_MATCH: 'danger',
  NOT_PROVIDED: 'neutral',
}


export function MatchBadge({
  status,
  size,
}: {
  status: RequirementMatchStatus
  size?: 'sm' | 'md'
}) {
  const { language } =
    useLanguage()

  return (
    <Badge
      tone={matchTone[status]}
      size={size}
    >
      {getMatchStatusLabel(
        status,
        language,
      )}
    </Badge>
  )
}


const recommendationTone: Record<
  RecommendationStatus,
  Tone
> = {
  RECOMMENDED_FOR_REVIEW:
    'success',

  NO_ELIGIBLE_VENDOR:
    'warning',

  REQUIRES_HUMAN_REVIEW:
    'warning',
}


export function RecommendationBadge({
  status,
  size,
}: {
  status: RecommendationStatus
  size?: 'sm' | 'md'
}) {
  const { language } =
    useLanguage()

  return (
    <Badge
      tone={
        recommendationTone[
          status
        ]
      }
      size={size}
      dot
    >
      {getRecommendationStatusLabel(
        status,
        language,
      )}
    </Badge>
  )
}


export function MandatoryBadge({
  mandatory,
}: {
  mandatory: boolean
}) {
  const { isArabic } =
    useLanguage()

  return (
    <Badge
      tone={
        mandatory
          ? 'brand'
          : 'outline'
      }
      size="sm"
    >
      {mandatory
        ? isArabic
          ? 'إلزامي'
          : 'Mandatory'
        : isArabic
          ? 'اختياري'
          : 'Optional'}
    </Badge>
  )
}