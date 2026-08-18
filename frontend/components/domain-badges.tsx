import { Badge } from '@/components/ui/badge'

import {
  evaluationStatusLabel,
  matchStatusLabel,
  recommendationStatusLabel,
  riskLevelLabel,
} from '@/lib/labels'

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
  return (
    <Badge
      tone={statusTone[status]}
      size={size}
      dot
    >
      {evaluationStatusLabel[status]}
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
  return (
    <Badge
      tone={riskTone[risk]}
      size={size}
      dot
    >
      {riskLevelLabel[risk]} Risk
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
        ? 'Eligible'
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
  return (
    <Badge
      tone={matchTone[status]}
      size={size}
    >
      {matchStatusLabel[status]}
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
  return (
    <Badge
      tone={
        recommendationTone[status]
      }
      size={size}
      dot
    >
      {
        recommendationStatusLabel[
          status
        ]
      }
    </Badge>
  )
}


export function MandatoryBadge({
  mandatory,
}: {
  mandatory: boolean
}) {
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
        ? 'Mandatory'
        : 'Optional'}
    </Badge>
  )
}