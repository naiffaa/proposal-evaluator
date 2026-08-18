import type {
  EvaluationStatus,
  RecommendationStatus,
  RequirementMatchStatus,
  RiskLevel,
} from './types'

// Human-readable labels. The UI should never render raw enum values.

export const evaluationStatusLabel: Record<EvaluationStatus, string> = {
  DRAFT: 'Draft',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  REQUIRES_REVIEW: 'Requires Review',
}

export const recommendationStatusLabel: Record<RecommendationStatus, string> = {
  RECOMMENDED_FOR_REVIEW: 'Recommended for Review',
  NO_ELIGIBLE_VENDOR: 'No Eligible Vendor',
  REQUIRES_HUMAN_REVIEW: 'Requires Human Review',
}

export const riskLevelLabel: Record<RiskLevel, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

export const matchStatusLabel: Record<RequirementMatchStatus, string> = {
  FULL_MATCH: 'Full Match',
  PARTIAL_MATCH: 'Partial Match',
  NO_MATCH: 'No Match',
  NOT_PROVIDED: 'Not Provided',
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(digits)}%`
}

export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
