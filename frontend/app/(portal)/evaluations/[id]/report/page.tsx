'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'

import { evaluationsApi } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import type {
  Evaluation,
  Vendor,
} from '@/lib/types'


export default function EvaluationReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [evaluation, setEvaluation] =
    useState<Evaluation | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)


  useEffect(() => {
    let active = true

    evaluationsApi
      .get(id)
      .then((data) => {
        if (!active) return

        setEvaluation(data)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load evaluation report.',
        )

        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])


  const sortedVendors =
    useMemo(() => {
      if (!evaluation) {
        return []
      }

      return [...evaluation.vendors].sort(
        (a, b) => a.rank - b.rank,
      )
    }, [evaluation])


  if (loading) {
    return <LoadingState />
  }


  if (error) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
        <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }


  if (!evaluation) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">

        <div className="border border-border bg-white px-6 py-16 text-center">

          <FileText className="mx-auto size-8 text-muted-foreground" />

          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Report not found
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            No evaluation report is available for this evaluation.
          </p>

        </div>

      </div>
    )
  }


  const topVendor =
    sortedVendors[0] ?? null

  const eligibleVendors =
    sortedVendors.filter(
      (vendor) => vendor.eligible,
    )

  const highRiskVendors =
    sortedVendors.filter(
      (vendor) =>
        vendor.riskLevel === 'HIGH',
    )

  const totalMissing =
    sortedVendors.reduce(
      (total, vendor) =>
        total +
        vendor.missingRequirements.length,
      0,
    )


  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:py-10">

      {/* ====================================== */}
      {/* HEADER */}
      {/* ====================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Evaluation Report · {evaluation.id}
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">
            Final Evaluation Report
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Consolidated assessment of vendor scoring, compliance,
            risk, ranking, and final procurement recommendation.
          </p>

        </div>

        <Link
          href={`/evaluations/${evaluation.id}`}
          className="
            inline-flex
            h-10
            items-center
            justify-center
            gap-2
            rounded-md
            border
            border-border
            bg-white
            px-4
            text-sm
            font-medium
            text-foreground
            transition-colors
            hover:bg-slate-50
          "
        >
          <ArrowLeft className="size-4" />
          Back to Results
        </Link>

      </div>

      {/* ====================================== */}
      {/* RFP INFORMATION */}
      {/* ====================================== */}

      <div className="mt-8 border border-border bg-white px-6 py-5">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

          <div className="flex items-start gap-4">

            <div className="flex size-11 shrink-0 items-center justify-center bg-primary/[0.06] text-primary">
              <FileText className="size-5" />
            </div>

            <div>

              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                RFP Document
              </p>

              <h2 className="mt-1 text-base font-semibold text-primary">
                {evaluation.rfpName}
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Evaluation created {formatDate(evaluation.createdDate)}
              </p>

            </div>

          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">

            <MiniMetric
              label="Criteria"
              value={evaluation.rfp.totalCriteria}
            />

            <MiniMetric
              label="Requirements"
              value={evaluation.rfp.totalRequirements}
            />

            <MiniMetric
              label="Mandatory"
              value={evaluation.rfp.mandatoryRequirements}
            />

          </div>

        </div>

      </div>

      {/* ====================================== */}
      {/* EXECUTIVE SUMMARY */}
      {/* ====================================== */}

      <section className="mt-8">

        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
          Executive Summary
        </p>

        <div className="mt-4 border border-primary/15 bg-primary/[0.035] px-6 py-6">

          <div className="flex items-start gap-4">

            <div className="flex size-11 shrink-0 items-center justify-center bg-primary text-white">
              {evaluation.recommendedVendor ? (
                <Award className="size-5" />
              ) : (
                <ShieldAlert className="size-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">

              <h2 className="text-lg font-semibold text-primary">
                {getRecommendationTitle(
                  evaluation.recommendationStatus,
                  evaluation.recommendedVendor,
                )}
              </h2>

              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {evaluation.advisoryRecommendation ||
                  'No advisory recommendation was returned for this evaluation.'}
              </p>

              {evaluation.humanReviewRequired && (
                <div className="mt-4 flex items-start gap-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">

                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />

                  <p>
                    Human review is required before any final procurement
                    decision or award.
                  </p>

                </div>
              )}

            </div>

          </div>

        </div>

      </section>

      {/* ====================================== */}
      {/* REPORT METRICS */}
      {/* ====================================== */}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <ReportMetric
          label="Top Ranked Vendor"
          value={
            evaluation.topRankedVendor ??
            'None'
          }
          description={
            evaluation.topRankedVendorScore !== null
              ? `${evaluation.topRankedVendorScore.toFixed(1)}% weighted score`
              : 'No score available'
          }
          icon={Trophy}
        />

        <ReportMetric
          label="Vendors Evaluated"
          value={evaluation.vendorCount}
          description={`${eligibleVendors.length} eligible`}
          icon={Users}
        />

        <ReportMetric
          label="High Risk Vendors"
          value={highRiskVendors.length}
          description="require additional review"
          icon={ShieldAlert}
        />

        <ReportMetric
          label="Outstanding Gaps"
          value={totalMissing}
          description="missing mandatory requirements"
          icon={FileText}
        />

      </div>

      {/* ====================================== */}
      {/* VENDOR RANKING */}
      {/* ====================================== */}

      <section className="mt-10">

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
              Evaluation Results
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary">
              Vendor Ranking
            </h2>

          </div>

          <p className="text-sm text-muted-foreground">
            Ranked by deterministic weighted score
          </p>

        </div>

        <div className="mt-6 overflow-hidden border border-border bg-white">

          <div
            className="
              hidden
              grid-cols-[70px_minmax(0,2fr)_140px_170px_140px_140px]
              gap-4
              border-b
              border-border
              bg-slate-50/70
              px-5
              py-3
              text-[11px]
              font-semibold
              uppercase
              tracking-[0.08em]
              text-muted-foreground
              lg:grid
            "
          >
            <span>Rank</span>
            <span>Vendor</span>
            <span>Score</span>
            <span>Mandatory</span>
            <span>Eligibility</span>
            <span>Risk</span>
          </div>

          <div className="divide-y divide-border">

            {sortedVendors.map((vendor) => (
              <VendorReportRow
                key={vendor.id}
                vendor={vendor}
                evaluationId={evaluation.id}
              />
            ))}

          </div>

        </div>

      </section>

      {/* ====================================== */}
      {/* TOP VENDOR ASSESSMENT */}
      {/* ====================================== */}

      {topVendor && (
        <section className="mt-10">

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Detailed Assessment
          </p>

          <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary">
            Top Ranked Vendor Review
          </h2>

          <div className="mt-6 border border-border bg-white">

            <div className="border-b border-border px-6 py-5">

              <div className="flex flex-wrap items-center gap-3">

                <h3 className="text-lg font-semibold text-primary">
                  {topVendor.name}
                </h3>

                <EligibilityBadge
                  eligible={topVendor.eligible}
                />

                <RiskBadge
                  risk={topVendor.riskLevel}
                />

              </div>

            </div>

            {/* SUMMARY */}

            <div className="px-6 py-5">

              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Assessment Summary
              </p>

              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {topVendor.summary ||
                  topVendor.complianceAssessment ||
                  'No summary was returned for this vendor.'}
              </p>

            </div>

            {/* STRENGTHS / GAPS */}

            <div className="grid grid-cols-1 border-t border-border lg:grid-cols-2">

              <div className="px-6 py-5 lg:border-r lg:border-border">

                <div className="flex items-center gap-2">

                  <CheckCircle2 className="size-4 text-emerald-600" />

                  <h4 className="text-sm font-semibold text-foreground">
                    Key Strengths
                  </h4>

                </div>

                {topVendor.strengths.length > 0 ? (
                  <ul className="mt-4 space-y-3">

                    {topVendor.strengths.map(
                      (strength, index) => (
                        <li
                          key={`${strength}-${index}`}
                          className="flex gap-2 text-sm leading-6 text-muted-foreground"
                        >
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                          {strength}
                        </li>
                      ),
                    )}

                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No specific strengths were identified.
                  </p>
                )}

              </div>

              <div className="border-t border-border px-6 py-5 lg:border-t-0">

                <div className="flex items-center gap-2">

                  <XCircle className="size-4 text-red-600" />

                  <h4 className="text-sm font-semibold text-foreground">
                    Key Gaps
                  </h4>

                </div>

                {topVendor.gaps.length > 0 ? (
                  <ul className="mt-4 space-y-3">

                    {topVendor.gaps.map(
                      (gap, index) => (
                        <li
                          key={`${gap}-${index}`}
                          className="flex gap-2 text-sm leading-6 text-muted-foreground"
                        >
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-red-500" />
                          {gap}
                        </li>
                      ),
                    )}

                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No major gaps were identified.
                  </p>
                )}

              </div>

            </div>

          </div>

        </section>
      )}

      {/* ====================================== */}
      {/* COMPLIANCE SUMMARY */}
      {/* ====================================== */}

      <section className="mt-10">

        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
          Compliance
        </p>

        <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary">
          Compliance Summary
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">

          {sortedVendors.map((vendor) => (
            <div
              key={vendor.id}
              className="border border-border bg-white px-5 py-5"
            >

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h3 className="text-sm font-semibold text-foreground">
                    {vendor.name}
                  </h3>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Mandatory Compliance
                  </p>

                </div>

                <p className="text-xl font-semibold text-primary">
                  {vendor.overallMandatoryCompliance.toFixed(1)}%
                </p>

              </div>

              <div className="mt-4 h-2 bg-slate-100">

                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${Math.min(
                      vendor.overallMandatoryCompliance,
                      100,
                    )}%`,
                  }}
                />

              </div>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {vendor.complianceAssessment ||
                  'No compliance assessment was returned.'}
              </p>

              <Link
                href={`/evaluations/${evaluation.id}/compliance`}
                className="mt-4 inline-flex text-sm font-semibold text-primary hover:text-primary/80"
              >
                View Compliance Details
              </Link>

            </div>
          ))}

        </div>

      </section>

      {/* ====================================== */}
      {/* METHODOLOGY */}
      {/* ====================================== */}

      <section className="mt-10 border border-border bg-slate-50/60 px-6 py-5">

        <div className="flex items-start gap-3">

          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />

          <div>

            <h3 className="text-sm font-semibold text-foreground">
              Evaluation Methodology
            </h3>

            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Vendor proposals are assessed requirement-by-requirement
              against the extracted RFP framework. Criterion scores are
              calculated using deterministic Python scoring and the published
              RFP weights. Mandatory compliance, risk, and recommendation
              eligibility are reviewed separately from the numerical ranking.
              All generated recommendations are advisory and require human
              procurement review and approval.
            </p>

          </div>

        </div>

      </section>

    </div>
  )
}


function VendorReportRow({
  vendor,
  evaluationId,
}: {
  vendor: Vendor
  evaluationId: string
}) {
  return (
    <Link
      href={`/evaluations/${evaluationId}/vendors/${vendor.id}`}
      className="
        grid
        grid-cols-1
        gap-4
        px-5
        py-5
        transition-colors
        hover:bg-primary/[0.025]
        lg:grid-cols-[70px_minmax(0,2fr)_140px_170px_140px_140px]
        lg:items-center
      "
    >

      <div>

        <MobileLabel>
          Rank
        </MobileLabel>

        <span className="font-semibold text-primary">
          #{vendor.rank}
        </span>

      </div>

      <div className="min-w-0">

        <MobileLabel>
          Vendor
        </MobileLabel>

        <p className="truncate text-sm font-semibold text-foreground">
          {vendor.name}
        </p>

      </div>

      <div>

        <MobileLabel>
          Score
        </MobileLabel>

        <span className="text-sm font-semibold text-foreground">
          {vendor.overallScore.toFixed(1)}%
        </span>

      </div>

      <div>

        <MobileLabel>
          Mandatory
        </MobileLabel>

        <span className="text-sm font-semibold text-foreground">
          {vendor.overallMandatoryCompliance.toFixed(1)}%
        </span>

      </div>

      <div>

        <MobileLabel>
          Eligibility
        </MobileLabel>

        <EligibilityBadge
          eligible={vendor.eligible}
        />

      </div>

      <div>

        <MobileLabel>
          Risk
        </MobileLabel>

        <RiskBadge
          risk={vendor.riskLevel}
        />

      </div>

    </Link>
  )
}


function ReportMetric({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string
  value: string | number
  description: string
  icon: typeof Trophy
}) {
  return (
    <div className="border border-border bg-white px-5 py-5">

      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">

          <p className="text-sm text-muted-foreground">
            {label}
          </p>

          <p className="mt-2 break-words text-xl font-semibold text-primary">
            {value}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>

        </div>

        <div className="flex size-10 shrink-0 items-center justify-center bg-primary/[0.06] text-primary">
          <Icon className="size-4.5" />
        </div>

      </div>

    </div>
  )
}


function MiniMetric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div>

      <p className="text-[11px] text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-primary">
        {value}
      </p>

    </div>
  )
}


function EligibilityBadge({
  eligible,
}: {
  eligible: boolean
}) {
  return eligible ? (
    <span className="inline-flex items-center gap-1.5 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">

      <CheckCircle2 className="size-3.5" />
      Eligible

    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">

      <XCircle className="size-3.5" />
      Not Eligible

    </span>
  )
}


function RiskBadge({
  risk,
}: {
  risk: Vendor['riskLevel']
}) {
  const styles = {
    LOW:
      'bg-emerald-50 text-emerald-700 ring-emerald-200',

    MEDIUM:
      'bg-amber-50 text-amber-700 ring-amber-200',

    HIGH:
      'bg-red-50 text-red-700 ring-red-200',
  }

  return (
    <span
      className={`
        inline-flex
        items-center
        gap-1.5
        px-2
        py-1
        text-xs
        font-semibold
        ring-1
        ring-inset
        ${styles[risk]}
      `}
    >
      <ShieldAlert className="size-3.5" />

      {risk.charAt(0) +
        risk.slice(1).toLowerCase()} Risk
    </span>
  )
}


function MobileLabel({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
      {children}
    </p>
  )
}


function getRecommendationTitle(
  status: Evaluation['recommendationStatus'],
  recommendedVendor: string | null,
) {
  if (
    status ===
    'NO_ELIGIBLE_VENDOR'
  ) {
    return 'No Eligible Vendor'
  }

  if (
    status ===
    'REQUIRES_HUMAN_REVIEW'
  ) {
    return 'Human Review Required'
  }

  if (
    recommendedVendor
  ) {
    return `Recommended Vendor: ${recommendedVendor}`
  }

  return 'Evaluation Recommendation'
}


function LoadingState() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">

      <div className="h-28 animate-pulse bg-muted" />

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {Array.from({
          length: 4,
        }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse bg-muted"
          />
        ))}

      </div>

      <div className="mt-8 h-72 animate-pulse bg-muted" />

    </div>
  )
}