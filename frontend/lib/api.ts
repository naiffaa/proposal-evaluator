import { dashboardStats } from './mock-data'

import type {
  Evaluation,
  EvaluationStatus,
  EvaluationSummary,
  MissingRequirement,
  RecommendationStatus,
  RequirementMatchStatus,
  RfpCriterion,
  RfpFramework,
  RiskLevel,
  Vendor,
  VendorCriterionScore,
  VendorRequirementResult,
} from './types'


// =========================================================
// API CONFIG
// =========================================================

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://127.0.0.1:8000/api'


// =========================================================
// GENERIC REQUEST
// =========================================================

export async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const isFormData =
    init?.body instanceof FormData

  const headers =
    new Headers(init?.headers)

  if (!isFormData) {
    headers.set(
      'Content-Type',
      'application/json',
    )
  }

  const response =
    await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...init,
        headers,
        cache: 'no-store',
      },
    )

  if (!response.ok) {
    let message =
      `API request failed: ${response.status} ${response.statusText}`

    try {
      const errorData =
        await response.json()

      if (
        errorData &&
        typeof errorData.detail === 'string'
      ) {
        message =
          errorData.detail
      }
    } catch {
      // Keep default message.
    }

    throw new Error(
      message,
    )
  }

  return response.json() as Promise<T>
}


// =========================================================
// BACKEND RAW TYPES
// =========================================================

interface BackendRequirement {
  id?: string
  requirement?: string
  source?: string
  mandatory?: boolean
  mandatory_evidence?: string
}

interface BackendCriterion {
  name?: string
  description?: string
  source?: string
  weight?: number
  requirements?: BackendRequirement[]
}

interface BackendRfp {
  fileName?: string

  analysis?: {
    rfp_summary?: string

    metadata?: {
      criteria_count?: number
      requirement_count?: number
      mandatory_requirement_count?: number
      total_weight?: number
    }

    criteria?: BackendCriterion[]
  }

  criteria?: BackendCriterion[]
  totalCriteria?: number
  totalWeight?: number
}

interface BackendRequirementResult {
  requirement_id?: string
  requirement?: string
  rfp_source?: string
  mandatory?: boolean

  status?:
    | 'FULL_MATCH'
    | 'PARTIAL_MATCH'
    | 'NO_MATCH'
    | 'NOT_PROVIDED'

  match_score?: number
  proposal_evidence?: string
  rationale?: string
}

interface BackendEvaluationResult {
  criterion?: string
  score?: number
  mandatory_compliance_percentage?: number | null
  requirement_results?: BackendRequirementResult[]
  strengths?: string[]
  gaps?: string[]
  rationale?: string
}

interface BackendCriterionScore {
  criterion?: string
  score?: number
  weight?: number
  weighted_score?: number
}

interface BackendVendor {
  vendor?: string
  rank?: number
  overallScore?: number
  overallMandatoryCompliance?: number | null
  riskLevel?: string
  compliant?: boolean | null

  missingRequirements?: Array<
    string | Record<string, unknown>
  >

  complianceRationale?: string

  evaluations?: BackendEvaluationResult[]

  scoring?: {
    criterion_scores?: BackendCriterionScore[]
  }
}

interface BackendEvaluationResultRoot {
  rfp?: BackendRfp

  totalVendors?: number

  vendors?: BackendVendor[]

  topRankedVendor?: string | null
  topRankedVendorScore?: number | null

  recommendedVendor?: string | null
  recommendedVendorScore?: number | null

  recommendationStatus?: string | null
  humanReviewRequired?: boolean

  ranking?: {
    finalRecommendation?: string
    final_recommendation?: string
    rationale?: string
  }
}

interface BackendStoredEvaluation {
  id: string
  status: string
  createdDate: string
  result: BackendEvaluationResultRoot
}


// =========================================================
// RUN EVALUATION
// =========================================================

export interface RunEvaluationPayload {
  rfp: File
  proposals: File[]
}

export interface RunEvaluationResponse {
  id: string
  status: 'completed'
  result: BackendEvaluationResultRoot
}


// =========================================================
// HELPERS
// =========================================================

function normalizeStatus(
  value?: string,
): EvaluationStatus {
  switch (value) {
    case 'DRAFT':
      return 'DRAFT'

    case 'PROCESSING':
      return 'PROCESSING'

    case 'REQUIRES_REVIEW':
      return 'REQUIRES_REVIEW'

    default:
      return 'COMPLETED'
  }
}


function normalizeRecommendationStatus(
  value?: string | null,
): RecommendationStatus | null {
  if (
    value ===
    'RECOMMENDED_FOR_REVIEW'
  ) {
    return 'RECOMMENDED_FOR_REVIEW'
  }

  if (
    value ===
    'NO_ELIGIBLE_VENDOR'
  ) {
    return 'NO_ELIGIBLE_VENDOR'
  }

  if (
    value ===
    'REQUIRES_HUMAN_REVIEW'
  ) {
    return 'REQUIRES_HUMAN_REVIEW'
  }

  return null
}


function normalizeRiskLevel(
  value?: string,
): RiskLevel {
  const normalized =
    value?.toUpperCase()

  if (normalized === 'LOW') {
    return 'LOW'
  }

  if (normalized === 'MEDIUM') {
    return 'MEDIUM'
  }

  return 'HIGH'
}


function normalizeMatchStatus(
  value?: string,
): RequirementMatchStatus {
  if (
    value === 'FULL_MATCH'
  ) {
    return 'FULL_MATCH'
  }

  if (
    value === 'PARTIAL_MATCH'
  ) {
    return 'PARTIAL_MATCH'
  }

  if (
    value === 'NO_MATCH'
  ) {
    return 'NO_MATCH'
  }

  return 'NOT_PROVIDED'
}


function makeVendorId(
  name: string,
  index: number,
) {
  const slug =
    name
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-',
      )
      .replace(
        /^-|-$/g,
        '',
      )

  return slug || `vendor-${index + 1}`
}


// =========================================================
// RFP ADAPTER
// =========================================================

function adaptRfp(
  backendRfp: BackendRfp | undefined,
  createdDate: string,
): RfpFramework {
  const rawCriteria =
    backendRfp?.criteria ??
    backendRfp?.analysis?.criteria ??
    []

  const criteria: RfpCriterion[] =
    rawCriteria.map(
      (criterion, index) => ({
        id:
          `criterion-${index + 1}`,

        name:
          criterion.name ??
          `Criterion ${index + 1}`,

        weight:
          Number(
            criterion.weight ?? 0,
          ),

        description:
          criterion.description ?? '',

        requirements:
          (
            criterion.requirements ??
            []
          ).map(
            (
              requirement,
              requirementIndex,
            ) => ({
              id:
                requirement.id ??
                `R${index + 1}-${requirementIndex + 1}`,

              requirement:
                requirement.requirement ??
                'Requirement',

              source:
                requirement.source ??
                '',

              mandatory:
                Boolean(
                  requirement.mandatory,
                ),

              mandatoryEvidence:
                requirement.mandatory_evidence ??
                '',
            }),
          ),
      }),
    )

  const totalRequirements =
    criteria.reduce(
      (total, criterion) =>
        total +
        criterion.requirements.length,
      0,
    )

  const mandatoryRequirements =
    criteria.reduce(
      (total, criterion) =>
        total +
        criterion.requirements.filter(
          (requirement) =>
            requirement.mandatory,
        ).length,
      0,
    )

  const calculatedWeight =
    criteria.reduce(
      (total, criterion) =>
        total + criterion.weight,
      0,
    )

  return {
    fileName:
      backendRfp?.fileName ??
      'RFP Document',

    summary:
      backendRfp?.analysis
        ?.rfp_summary ?? '',

    processedDate:
      createdDate,

    totalCriteria:
      backendRfp?.totalCriteria ??
      backendRfp?.analysis
        ?.metadata
        ?.criteria_count ??
      criteria.length,

    totalRequirements:
      backendRfp?.analysis
        ?.metadata
        ?.requirement_count ??
      totalRequirements,

    mandatoryRequirements:
      backendRfp?.analysis
        ?.metadata
        ?.mandatory_requirement_count ??
      mandatoryRequirements,

    totalWeight:
      backendRfp?.totalWeight ??
      backendRfp?.analysis
        ?.metadata
        ?.total_weight ??
      calculatedWeight,

    criteria,
  }
}


// =========================================================
// VENDOR ADAPTER
// =========================================================

function adaptVendor(
  backendVendor: BackendVendor,
  index: number,
): Vendor {
  const name =
    backendVendor.vendor ??
    `Vendor ${index + 1}`

  const id =
    makeVendorId(
      name,
      index,
    )

  const evaluations =
    backendVendor.evaluations ??
    []

  const requirementResults:
    VendorRequirementResult[] =
    evaluations.flatMap(
      (evaluation) =>
        (
          evaluation
            .requirement_results ??
          []
        ).map(
          (requirement) => ({
            requirementId:
              requirement
                .requirement_id ??
              '',

            requirement:
              requirement
                .requirement ??
              'Requirement',

            criterionId:
              evaluation
                .criterion ??
              '',

            criterionName:
              evaluation
                .criterion ??
              'Criterion',

            source:
              requirement
                .rfp_source ??
              '',

            mandatory:
              Boolean(
                requirement.mandatory,
              ),

            status:
              normalizeMatchStatus(
                requirement.status,
              ),

            matchScore:
              Number(
                requirement
                  .match_score ??
                0,
              ),

            evidence:
              requirement
                .proposal_evidence ??
              'Not Provided',

            rationale:
              requirement
                .rationale ??
              '',
          }),
        ),
    )

  const criterionScores:
    VendorCriterionScore[] =
    (
      backendVendor.scoring
        ?.criterion_scores ??
      []
    ).map(
      (
        criterion,
        criterionIndex,
      ) => ({
        criterionId:
          criterion.criterion ??
          `criterion-${criterionIndex + 1}`,

        criterionName:
          criterion.criterion ??
          `Criterion ${criterionIndex + 1}`,

        score:
          Number(
            criterion.score ?? 0,
          ),

        weight:
          Number(
            criterion.weight ?? 0,
          ),

        contribution:
          Number(
            criterion
              .weighted_score ??
            0,
          ),
      }),
    )

  const missingRequirements:
    MissingRequirement[] =
    (
      backendVendor
        .missingRequirements ??
      []
    ).map(
      (item, missingIndex) => {
        if (
          typeof item === 'string'
        ) {
          return {
            requirementId:
              `missing-${missingIndex + 1}`,

            requirement:
              item,

            criterionName:
              '',

            source:
              '',

            issue:
              'Mandatory requirement not satisfied.',
          }
        }

        return {
          requirementId:
            String(
              item.requirementId ??
              item.requirement_id ??
              `missing-${missingIndex + 1}`,
            ),

          requirement:
            String(
              item.requirement ??
              item.text ??
              'Missing requirement',
            ),

          criterionName:
            String(
              item.criterionName ??
              item.criterion ??
              '',
            ),

          source:
            String(
              item.source ??
              '',
            ),

          issue:
            String(
              item.issue ??
              'Mandatory requirement not satisfied.',
            ),
        }
      },
    )

  const strengths =
    evaluations.flatMap(
      (evaluation) =>
        evaluation.strengths ??
        [],
    )

  const gaps =
    evaluations.flatMap(
      (evaluation) =>
        evaluation.gaps ??
        [],
    )

  const summary =
    evaluations
      .map(
        (evaluation) =>
          evaluation.rationale,
      )
      .filter(Boolean)
      .join(' ')

  return {
    id,

    rank:
      Number(
        backendVendor.rank ??
        index + 1,
      ),

    name,

    overallScore:
      Number(
        backendVendor
          .overallScore ??
        0,
      ),

    overallMandatoryCompliance:
      Number(
        backendVendor
          .overallMandatoryCompliance ??
        0,
      ),

    riskLevel:
      normalizeRiskLevel(
        backendVendor.riskLevel,
      ),

    eligible:
      backendVendor.compliant ===
      true,

    strengths,

    gaps,

    summary,

    criterionScores,

    requirementResults,

    missingRequirements,

    complianceAssessment:
      backendVendor
        .complianceRationale ??
      '',
  }
}


// =========================================================
// FULL EVALUATION ADAPTER
// =========================================================

function adaptEvaluation(
  stored: BackendStoredEvaluation,
): Evaluation {
  const result =
    stored.result ?? {}

  const rfp =
    adaptRfp(
      result.rfp,
      stored.createdDate,
    )

  const vendors =
    (
      result.vendors ??
      []
    ).map(
      (vendor, index) =>
        adaptVendor(
          vendor,
          index,
        ),
    )

  const recommendationStatus =
    normalizeRecommendationStatus(
      result.recommendationStatus,
    )

  const advisoryRecommendation =
    result.ranking
      ?.finalRecommendation ??
    result.ranking
      ?.final_recommendation ??
    result.ranking
      ?.rationale ??
    ''

  return {
    id:
      stored.id,

    rfpName:
      rfp.fileName,

    vendorCount:
      vendors.length,

    status:
      normalizeStatus(
        stored.status,
      ),

    topRankedVendor:
      result.topRankedVendor ??
      null,

    recommendationStatus,

    createdDate:
      stored.createdDate,

    rfp,

    topRankedVendorScore:
      result
        .topRankedVendorScore ??
      null,

    recommendedVendor:
      result
        .recommendedVendor ??
      null,

    humanReviewRequired:
      result
        .humanReviewRequired ??
      true,

    advisoryRecommendation,

    vendors,
  }
}


// =========================================================
// EVALUATIONS API
// =========================================================

export const evaluationsApi = {

  // =======================================================
  // REAL
  // GET /api/evaluations
  // =======================================================

  list(): Promise<EvaluationSummary[]> {
    return request<
      EvaluationSummary[]
    >(
      '/evaluations',
    )
  },


  // =======================================================
  // REAL
  // GET /api/evaluations/{id}
  // =======================================================

  async get(
    id: string,
  ): Promise<Evaluation> {
    const stored =
      await request<
        BackendStoredEvaluation
      >(
        `/evaluations/${id}`,
      )

    return adaptEvaluation(
      stored,
    )
  },


  // =======================================================
  // REAL
  // POST /api/evaluations/run
  // =======================================================

  async runEvaluation(
    payload: RunEvaluationPayload,
  ): Promise<RunEvaluationResponse> {

    if (!payload.rfp) {
      throw new Error(
        'RFP file is required.',
      )
    }

    if (
      !payload.proposals ||
      payload.proposals.length === 0
    ) {
      throw new Error(
        'At least one vendor proposal is required.',
      )
    }

    const formData =
      new FormData()

    formData.append(
      'rfp',
      payload.rfp,
      payload.rfp.name,
    )

    for (
      const proposal
      of payload.proposals
    ) {
      formData.append(
        'proposals',
        proposal,
        proposal.name,
      )
    }

    return request<
      RunEvaluationResponse
    >(
      '/evaluations/run',
      {
        method: 'POST',
        body: formData,
      },
    )
  },


  // =======================================================
  // REAL
  // GET /api/evaluations/{id}/rfp
  //
  // We use get(id) so the raw backend RFP is transformed
  // to the RfpFramework expected by the frontend.
  // =======================================================

  async getRfp(
    id: string,
  ): Promise<RfpFramework> {
    const evaluation =
      await this.get(id)

    return evaluation.rfp
  },


  // =======================================================
  // REAL
  // GET /api/evaluations/{id}/vendors
  // =======================================================

  async getVendors(
    id: string,
  ): Promise<Vendor[]> {
    const evaluation =
      await this.get(id)

    return evaluation.vendors
  },


  // =======================================================
  // REAL
  // GET VENDOR
  // =======================================================

  async getVendor(
    id: string,
    vendorId: string,
  ): Promise<Vendor | undefined> {
    const vendors =
      await this.getVendors(id)

    return vendors.find(
      (vendor) =>
        vendor.id === vendorId,
    )
  },


  // =======================================================
  // REAL
  // COMPARISON
  // =======================================================

  async getComparison(
    id: string,
  ): Promise<Vendor[]> {
    return this.getVendors(id)
  },
}


// =========================================================
// DASHBOARD
// =========================================================
//
// Keep dashboard stats mocked temporarily.
// We will replace these after the evaluation pages
// are confirmed working with real FastAPI data.
//
// =========================================================

export const dashboardApi = {

  getStats() {
    return Promise.resolve(
      dashboardStats,
    )
  },
}