// Domain types for the Proposal Intelligence Portal.
// These mirror the shape a Python/FastAPI backend is expected to return so the
// UI can swap mock responses for real API responses without changing components.

export type EvaluationStatus = 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'REQUIRES_REVIEW'

export type RecommendationStatus =
  | 'RECOMMENDED_FOR_REVIEW'
  | 'NO_ELIGIBLE_VENDOR'
  | 'REQUIRES_HUMAN_REVIEW'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type RequirementMatchStatus =
  | 'FULL_MATCH'
  | 'PARTIAL_MATCH'
  | 'NO_MATCH'
  | 'NOT_PROVIDED'

export interface RfpRequirement {
  id: string
  requirement: string
  source: string
  mandatory: boolean
  mandatoryEvidence?: string
}

export interface RfpCriterion {
  id: string
  name: string
  weight: number // percentage 0-100
  description: string
  requirements: RfpRequirement[]
}

export interface RfpFramework {
  fileName: string
  summary: string
  processedDate: string
  totalCriteria: number
  totalRequirements: number
  mandatoryRequirements: number
  totalWeight: number
  criteria: RfpCriterion[]
}

export interface VendorRequirementResult {
  requirementId: string
  requirement: string
  criterionId: string
  criterionName: string
  source: string
  mandatory: boolean
  status: RequirementMatchStatus
  matchScore: number // 0-100
  evidence: string
  rationale: string
}

export interface VendorCriterionScore {
  criterionId: string
  criterionName: string
  score: number // 0-100
  weight: number // 0-100
  contribution: number // score * weight / 100
}

export interface MissingRequirement {
  requirementId: string
  requirement: string
  criterionName: string
  source: string
  issue: string
}

export type MandatoryComplianceStatus =
  | 'PASS'
  | 'PARTIAL'
  | 'FAIL'
  | 'UNKNOWN'

export interface Vendor {
  id: string
  rank: number
  name: string
  overallScore: number
  overallMandatoryCompliance: number
  /**
   * Deterministic mandatory-compliance verdict.
   * FAIL only on verified failure of a requirement the RFP
   * treats as grounds for exclusion; UNKNOWN when evidence
   * could not be verified from the uploaded documents.
   * null for evaluations stored before this field existed.
   */
  mandatoryComplianceStatus: MandatoryComplianceStatus | null
  riskLevel: RiskLevel
  eligible: boolean
  strengths: string[]
  gaps: string[]
  summary: string
  criterionScores: VendorCriterionScore[]
  requirementResults: VendorRequirementResult[]
  missingRequirements: MissingRequirement[]
  complianceAssessment: string
}

export interface EvaluationSummary {
  id: string
  rfpName: string
  vendorCount: number
  status: EvaluationStatus
  topRankedVendor: string | null
  recommendationStatus: RecommendationStatus | null
  createdDate: string
}

export interface Evaluation extends EvaluationSummary {
  rfp: RfpFramework
  topRankedVendorScore: number | null
  recommendedVendor: string | null
  humanReviewRequired: boolean
  advisoryRecommendation: string
  vendors: Vendor[]
}
