import type {
  Evaluation,
  EvaluationSummary,
  RfpCriterion,
  RfpFramework,
  RequirementMatchStatus,
  Vendor,
  VendorCriterionScore,
  VendorRequirementResult,
} from './types'

// ---------------------------------------------------------------------------
// RFP framework (dynamic criteria — names are data, never hardcoded in the UI)
// ---------------------------------------------------------------------------

const criteria: RfpCriterion[] = [
  {
    id: 'C1',
    name: 'Technical Proposal',
    weight: 50,
    description:
      'Functional and technical requirements for the Smart Hospital Management System, covering clinical modules, interoperability, security, and platform architecture.',
    requirements: [
      { id: 'R001', requirement: 'Patient registration and master patient index', source: 'Section 4.1', mandatory: true, mandatoryEvidence: 'shall provide' },
      { id: 'R002', requirement: 'Electronic health records with clinical documentation', source: 'Section 4.2', mandatory: true, mandatoryEvidence: 'shall support' },
      { id: 'R003', requirement: 'Appointment scheduling and resource management', source: 'Section 4.3', mandatory: true, mandatoryEvidence: 'shall provide' },
      { id: 'R004', requirement: 'Pharmacy and medication management module', source: 'Section 4.4', mandatory: true, mandatoryEvidence: 'must include' },
      { id: 'R005', requirement: 'Laboratory information system integration', source: 'Section 4.5', mandatory: true, mandatoryEvidence: 'shall integrate' },
      { id: 'R006', requirement: 'HL7 / FHIR interoperability support', source: 'Section 5.1', mandatory: true, mandatoryEvidence: 'shall comply' },
      { id: 'R007', requirement: 'Role-based access control and audit logging', source: 'Section 6.1', mandatory: true, mandatoryEvidence: 'shall enforce' },
      { id: 'R008', requirement: 'Data encryption at rest and in transit', source: 'Section 6.2', mandatory: true, mandatoryEvidence: 'must encrypt' },
      { id: 'R009', requirement: 'High availability with 99.9% uptime SLA', source: 'Section 7.1', mandatory: true, mandatoryEvidence: 'shall guarantee' },
      { id: 'R010', requirement: 'Native mobile applications for clinicians', source: 'Section 4.9', mandatory: false },
      { id: 'R011', requirement: 'Configurable clinical decision support rules', source: 'Section 4.10', mandatory: false },
      { id: 'R012', requirement: 'Business intelligence and analytics dashboards', source: 'Section 8.1', mandatory: true, mandatoryEvidence: 'shall provide' },
    ],
  },
  {
    id: 'C2',
    name: 'Healthcare Experience',
    weight: 20,
    description:
      'Demonstrated experience delivering hospital information systems of comparable scale and complexity within the healthcare sector.',
    requirements: [
      { id: 'R013', requirement: 'Minimum three comparable hospital deployments', source: 'Section 9.1', mandatory: true, mandatoryEvidence: 'shall demonstrate' },
      { id: 'R014', requirement: 'Reference sites with contactable clients', source: 'Section 9.2', mandatory: true, mandatoryEvidence: 'shall provide' },
      { id: 'R015', requirement: 'Regional healthcare regulatory experience', source: 'Section 9.3', mandatory: true, mandatoryEvidence: 'must demonstrate' },
      { id: 'R016', requirement: 'Case studies of successful go-live transitions', source: 'Section 9.4', mandatory: false },
    ],
  },
  {
    id: 'C3',
    name: 'Team Qualifications',
    weight: 10,
    description:
      'Qualifications, certifications, and availability of the proposed implementation and support team.',
    requirements: [
      { id: 'R017', requirement: 'Certified project manager (PMP or equivalent)', source: 'Section 10.1', mandatory: true, mandatoryEvidence: 'shall assign' },
      { id: 'R018', requirement: 'Clinical informatics specialist on the team', source: 'Section 10.2', mandatory: true, mandatoryEvidence: 'shall include' },
      { id: 'R019', requirement: 'Dedicated security and compliance officer', source: 'Section 10.3', mandatory: false },
      { id: 'R020', requirement: 'Local on-site support resources', source: 'Section 10.4', mandatory: true, mandatoryEvidence: 'shall provide' },
    ],
  },
  {
    id: 'C4',
    name: 'Financial Proposal',
    weight: 20,
    description:
      'Total cost of ownership, pricing transparency, and value for money across licensing, implementation, and support.',
    requirements: [
      { id: 'R021', requirement: 'Transparent total cost of ownership breakdown', source: 'Section 11.1', mandatory: true, mandatoryEvidence: 'shall itemize' },
      { id: 'R022', requirement: 'Fixed implementation pricing', source: 'Section 11.2', mandatory: true, mandatoryEvidence: 'shall provide' },
      { id: 'R023', requirement: 'Multi-year support and maintenance pricing', source: 'Section 11.3', mandatory: true, mandatoryEvidence: 'shall provide' },
      { id: 'R024', requirement: 'Optional module pricing schedule', source: 'Section 11.4', mandatory: false },
    ],
  },
]

const allRequirements = criteria.flatMap((c) => c.requirements)

export const rfpFramework: RfpFramework = {
  fileName: 'RFP 01 - Smart Hospital Management System.pdf',
  summary:
    'This RFP solicits proposals for the design, implementation, and support of a Smart Hospital Management System serving a 600-bed tertiary facility. It defines four weighted evaluation criteria spanning technical capability, healthcare experience, team qualifications, and financial proposal, with the majority of technical requirements marked mandatory.',
  processedDate: '2026-08-12',
  totalCriteria: criteria.length,
  totalRequirements: allRequirements.length,
  mandatoryRequirements: allRequirements.filter((r) => r.mandatory).length,
  totalWeight: criteria.reduce((sum, c) => sum + c.weight, 0),
  criteria,
}

// ---------------------------------------------------------------------------
// Deterministic vendor result generation
// ---------------------------------------------------------------------------

function statusFromScore(score: number): RequirementMatchStatus {
  if (score >= 85) return 'FULL_MATCH'
  if (score >= 50) return 'PARTIAL_MATCH'
  if (score >= 15) return 'NO_MATCH'
  return 'NOT_PROVIDED'
}

// Small deterministic pseudo-random based on requirement id + vendor seed.
function jitter(seed: string, spread: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 997
  return ((h % (spread * 2 + 1)) - spread)
}

interface VendorProfile {
  id: string
  name: string
  base: Record<string, number> // criterionId -> base score
  criterionScores: VendorCriterionScore[]
  overallScore: number
  overallMandatoryCompliance: number
  riskLevel: Vendor['riskLevel']
  eligible: boolean
  strengths: string[]
  gaps: string[]
  summary: string
  complianceAssessment: string
  // requirement ids that should be forced to a specific status
  forced?: Record<string, RequirementMatchStatus>
}

function buildRequirementResults(profile: VendorProfile): VendorRequirementResult[] {
  return criteria.flatMap((criterion) =>
    criterion.requirements.map((req) => {
      const forced = profile.forced?.[req.id]
      const raw = profile.base[criterion.id] + jitter(profile.id + req.id, 14)
      const score = forced
        ? forced === 'FULL_MATCH'
          ? 92
          : forced === 'PARTIAL_MATCH'
            ? 62
            : forced === 'NO_MATCH'
              ? 28
              : 0
        : Math.max(0, Math.min(100, Math.round(raw)))
      const status = forced ?? statusFromScore(score)
      return {
        requirementId: req.id,
        requirement: req.requirement,
        criterionId: criterion.id,
        criterionName: criterion.name,
        source: req.source,
        mandatory: req.mandatory,
        status,
        matchScore: status === 'NOT_PROVIDED' ? 0 : score,
        evidence:
          status === 'NOT_PROVIDED'
            ? 'No corresponding evidence located in the vendor submission.'
            : `Section referencing "${req.requirement.toLowerCase()}" was identified in the proposal narrative and supporting appendices.`,
        rationale:
          status === 'FULL_MATCH'
            ? 'The proposal explicitly addresses the requirement with concrete, verifiable evidence.'
            : status === 'PARTIAL_MATCH'
              ? 'The proposal partially addresses the requirement but lacks complete detail or verifiable commitment.'
              : status === 'NO_MATCH'
                ? 'The proposal references the area but does not satisfy the stated requirement.'
                : 'The requirement is not addressed anywhere in the submission.',
      }
    }),
  )
}

function buildMissing(results: VendorRequirementResult[]) {
  return results
    .filter((r) => r.mandatory && r.status !== 'FULL_MATCH')
    .map((r) => ({
      requirementId: r.requirementId,
      requirement: r.requirement,
      criterionName: r.criterionName,
      source: r.source,
      issue:
        r.status === 'NOT_PROVIDED'
          ? 'Mandatory requirement not addressed in submission.'
          : r.status === 'NO_MATCH'
            ? 'Mandatory requirement referenced but not satisfied.'
            : 'Mandatory requirement only partially satisfied.',
    }))
}

const vendorProfiles: VendorProfile[] = [
  {
    id: 'V1',
    name: 'HealthTech Solutions',
    base: { C1: 84, C2: 40, C3: 82, C4: 96 },
    criterionScores: [
      { criterionId: 'C1', criterionName: 'Technical Proposal', score: 83.19, weight: 50, contribution: 41.59 },
      { criterionId: 'C2', criterionName: 'Healthcare Experience', score: 33.33, weight: 20, contribution: 6.67 },
      { criterionId: 'C3', criterionName: 'Team Qualifications', score: 80, weight: 10, contribution: 8.0 },
      { criterionId: 'C4', criterionName: 'Financial Proposal', score: 98, weight: 20, contribution: 19.6 },
    ],
    overallScore: 75.86,
    overallMandatoryCompliance: 81.82,
    riskLevel: 'MEDIUM',
    eligible: false,
    strengths: [
      'Highly competitive and transparent financial proposal',
      'Strong technical architecture with full interoperability support',
      'Experienced, well-certified implementation team',
    ],
    gaps: [
      'Limited comparable healthcare deployments in the region',
      'Two mandatory experience requirements only partially evidenced',
    ],
    summary:
      'HealthTech Solutions presents the strongest overall submission, driven by an excellent financial proposal and a robust technical architecture. However, gaps in demonstrated healthcare experience prevent full mandatory compliance.',
    complianceAssessment:
      'The vendor satisfies the majority of mandatory technical and financial requirements but falls short on mandatory healthcare experience evidence, resulting in incomplete mandatory compliance. Human review is recommended before any award decision.',
    forced: { R014: 'PARTIAL_MATCH', R015: 'NO_MATCH' },
  },
  {
    id: 'V2',
    name: 'MediCore Systems',
    base: { C1: 72, C2: 78, C3: 70, C4: 66 },
    criterionScores: [
      { criterionId: 'C1', criterionName: 'Technical Proposal', score: 71.4, weight: 50, contribution: 35.7 },
      { criterionId: 'C2', criterionName: 'Healthcare Experience', score: 78.5, weight: 20, contribution: 15.7 },
      { criterionId: 'C3', criterionName: 'Team Qualifications', score: 70, weight: 10, contribution: 7.0 },
      { criterionId: 'C4', criterionName: 'Financial Proposal', score: 66, weight: 20, contribution: 13.2 },
    ],
    overallScore: 71.6,
    overallMandatoryCompliance: 86.36,
    riskLevel: 'MEDIUM',
    eligible: false,
    strengths: [
      'Extensive regional healthcare deployment track record',
      'Strong clinical informatics expertise on the proposed team',
    ],
    gaps: [
      'Higher total cost of ownership than competing proposals',
      'One mandatory technical security requirement partially met',
    ],
    summary:
      'MediCore Systems offers deep healthcare domain experience and a credible delivery team, but a higher price point and a partial security commitment reduce its competitiveness relative to the leading proposal.',
    complianceAssessment:
      'The vendor meets most mandatory requirements with strong healthcare evidence, but a partially satisfied mandatory security requirement leaves mandatory compliance below the full threshold. Human review is required.',
    forced: { R008: 'PARTIAL_MATCH', R022: 'PARTIAL_MATCH' },
  },
  {
    id: 'V3',
    name: 'Nexus Care Platforms',
    base: { C1: 58, C2: 55, C3: 60, C4: 74 },
    criterionScores: [
      { criterionId: 'C1', criterionName: 'Technical Proposal', score: 57.8, weight: 50, contribution: 28.9 },
      { criterionId: 'C2', criterionName: 'Healthcare Experience', score: 54.5, weight: 20, contribution: 10.9 },
      { criterionId: 'C3', criterionName: 'Team Qualifications', score: 60, weight: 10, contribution: 6.0 },
      { criterionId: 'C4', criterionName: 'Financial Proposal', score: 73, weight: 20, contribution: 14.6 },
    ],
    overallScore: 60.4,
    overallMandatoryCompliance: 63.64,
    riskLevel: 'HIGH',
    eligible: false,
    strengths: [
      'Modern cloud-native platform architecture',
      'Reasonable mid-range pricing',
    ],
    gaps: [
      'Multiple mandatory technical requirements unmet or not provided',
      'Insufficient evidence of comparable hospital deployments',
      'No dedicated on-site support commitment',
    ],
    summary:
      'Nexus Care Platforms presents a modern platform at a reasonable price, but significant gaps across mandatory technical and experience requirements introduce elevated delivery risk.',
    complianceAssessment:
      'The vendor fails to satisfy several mandatory requirements, including interoperability and on-site support commitments, resulting in the lowest mandatory compliance of the evaluated vendors and a high overall risk rating.',
    forced: {
      R006: 'NO_MATCH',
      R009: 'PARTIAL_MATCH',
      R013: 'NO_MATCH',
      R020: 'NOT_PROVIDED',
    },
  },
]

function buildVendor(profile: VendorProfile, rank: number): Vendor {
  const requirementResults = buildRequirementResults(profile)
  return {
    id: profile.id,
    rank,
    name: profile.name,
    overallScore: profile.overallScore,
    overallMandatoryCompliance: profile.overallMandatoryCompliance,
    riskLevel: profile.riskLevel,
    eligible: profile.eligible,
    strengths: profile.strengths,
    gaps: profile.gaps,
    summary: profile.summary,
    criterionScores: profile.criterionScores,
    requirementResults,
    missingRequirements: buildMissing(requirementResults),
    complianceAssessment: profile.complianceAssessment,
  }
}

const vendors: Vendor[] = vendorProfiles
  .slice()
  .sort((a, b) => b.overallScore - a.overallScore)
  .map((p, i) => buildVendor(p, i + 1))

// ---------------------------------------------------------------------------
// Evaluations
// ---------------------------------------------------------------------------

const primaryEvaluation: Evaluation = {
  id: 'EVAL-2041',
  rfpName: rfpFramework.fileName,
  vendorCount: vendors.length,
  status: 'REQUIRES_REVIEW',
  topRankedVendor: vendors[0].name,
  topRankedVendorScore: vendors[0].overallScore,
  recommendedVendor: null,
  recommendationStatus: 'NO_ELIGIBLE_VENDOR',
  humanReviewRequired: true,
  advisoryRecommendation:
    'Based on weighted scoring, HealthTech Solutions is the top-ranked submission with the strongest technical and financial position. However, no vendor currently satisfies all mandatory recommendation-eligibility requirements — HealthTech Solutions and MediCore Systems both have outstanding mandatory gaps, and Nexus Care Platforms carries high delivery risk. The evaluation engine does not recommend a single vendor for award at this stage. A procurement committee should review the outstanding mandatory gaps, request clarifications from HealthTech Solutions and MediCore Systems, and determine whether any gap can be resolved before proceeding.',
  createdDate: '2026-08-12',
  rfp: rfpFramework,
  vendors,
}

export const evaluations: EvaluationSummary[] = [
  {
    id: primaryEvaluation.id,
    rfpName: primaryEvaluation.rfpName,
    vendorCount: primaryEvaluation.vendorCount,
    status: primaryEvaluation.status,
    topRankedVendor: primaryEvaluation.topRankedVendor,
    recommendationStatus: primaryEvaluation.recommendationStatus,
    createdDate: primaryEvaluation.createdDate,
  },
  {
    id: 'EVAL-2038',
    rfpName: 'RFP 07 - Enterprise Data Warehouse Modernization.pdf',
    vendorCount: 4,
    status: 'COMPLETED',
    topRankedVendor: 'Orion Data Group',
    recommendationStatus: 'RECOMMENDED_FOR_REVIEW',
    createdDate: '2026-07-29',
  },
  {
    id: 'EVAL-2035',
    rfpName: 'RFP 05 - Citywide Public Transit Ticketing.pdf',
    vendorCount: 3,
    status: 'COMPLETED',
    topRankedVendor: 'TransitOne',
    recommendationStatus: 'REQUIRES_HUMAN_REVIEW',
    createdDate: '2026-07-15',
  },
  {
    id: 'EVAL-2031',
    rfpName: 'RFP 04 - Managed Cybersecurity Services.pdf',
    vendorCount: 5,
    status: 'PROCESSING',
    topRankedVendor: null,
    recommendationStatus: null,
    createdDate: '2026-08-16',
  },
  {
    id: 'EVAL-2028',
    rfpName: 'RFP 02 - Cloud Migration Advisory Services.pdf',
    vendorCount: 2,
    status: 'DRAFT',
    topRankedVendor: null,
    recommendationStatus: null,
    createdDate: '2026-08-17',
  },
]

export function getEvaluation(id: string): Evaluation {
  // In mock mode every id resolves to the primary evaluation dataset.
  return { ...primaryEvaluation, id }
}

export const dashboardStats = {
  totalEvaluations: 24,
  activeEvaluations: 3,
  vendorsAnalyzed: 68,
  completedReports: 19,
}
