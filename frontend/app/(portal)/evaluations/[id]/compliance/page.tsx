'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  FileWarning,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

import { evaluationsApi } from '@/lib/api'
import type { Evaluation, Vendor } from '@/lib/types'


export default function EvaluationCompliancePage({
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
            : 'Failed to load compliance data.',
        )

        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])


  const summary = useMemo(() => {
    if (!evaluation) {
      return {
        eligible: 0,
        notEligible: 0,
        highRisk: 0,
        averageCompliance: 0,
      }
    }

    const vendors =
      evaluation.vendors

    const eligible =
      vendors.filter(
        (vendor) => vendor.eligible,
      ).length

    const notEligible =
      vendors.length - eligible

    const highRisk =
      vendors.filter(
        (vendor) =>
          vendor.riskLevel === 'HIGH',
      ).length

    const averageCompliance =
      vendors.length > 0
        ? vendors.reduce(
            (total, vendor) =>
              total +
              vendor.overallMandatoryCompliance,
            0,
          ) / vendors.length
        : 0

    return {
      eligible,
      notEligible,
      highRisk,
      averageCompliance,
    }
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

          <FileWarning className="mx-auto size-8 text-muted-foreground" />

          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Compliance data not found
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            This evaluation does not have compliance results available.
          </p>

        </div>

      </div>
    )
  }


  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:py-10">

      {/* ====================================== */}
      {/* HEADER */}
      {/* ====================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Evaluation {evaluation.id}
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">
            Compliance Review
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review mandatory requirement coverage, vendor eligibility,
            compliance risks, and outstanding gaps for this evaluation.
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
      {/* RFP CONTEXT */}
      {/* ====================================== */}

      <div className="mt-8 border border-primary/15 bg-primary/[0.035] px-6 py-5">

        <div className="flex items-start gap-4">

          <div className="flex size-11 shrink-0 items-center justify-center bg-primary/[0.08] text-primary">
            <ShieldCheck className="size-5" />
          </div>

          <div>

            <h2 className="text-sm font-semibold text-primary">
              {evaluation.rfpName}
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              This review checks each vendor against the mandatory
              requirements extracted from the RFP framework.
            </p>

          </div>

        </div>

      </div>

      {/* ====================================== */}
      {/* SUMMARY METRICS */}
      {/* ====================================== */}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <SummaryCard
          label="Average Compliance"
          value={`${summary.averageCompliance.toFixed(1)}%`}
          description="mandatory requirement coverage"
          icon={ShieldCheck}
        />

        <SummaryCard
          label="Eligible Vendors"
          value={summary.eligible}
          description="passed compliance gating"
          icon={CheckCircle2}
        />

        <SummaryCard
          label="Not Eligible"
          value={summary.notEligible}
          description="failed compliance gating"
          icon={XCircle}
        />

        <SummaryCard
          label="High Risk"
          value={summary.highRisk}
          description="vendors requiring attention"
          icon={ShieldAlert}
        />

      </div>

      {/* ====================================== */}
      {/* VENDOR COMPLIANCE */}
      {/* ====================================== */}

      <section className="mt-10">

        <div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Vendor Review
          </p>

          <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary">
            Compliance by Vendor
          </h2>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Review the compliance outcome and outstanding mandatory
            requirements for each evaluated vendor.
          </p>

        </div>

        <div className="mt-6 space-y-5">

          {evaluation.vendors.map((vendor) => (
            <VendorComplianceCard
              key={vendor.id}
              vendor={vendor}
              evaluationId={evaluation.id}
            />
          ))}

        </div>

      </section>

    </div>
  )
}


function VendorComplianceCard({
  vendor,
  evaluationId,
}: {
  vendor: Vendor
  evaluationId: string
}) {
  return (
    <div className="overflow-hidden border border-border bg-white">

      {/* ==================================== */}
      {/* HEADER */}
      {/* ==================================== */}

      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <div className="flex flex-wrap items-center gap-2">

            <h3 className="text-base font-semibold text-foreground">
              {vendor.name}
            </h3>

            {vendor.eligible ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <CheckCircle2 className="size-3.5" />
                Eligible
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                <XCircle className="size-3.5" />
                Not Eligible
              </span>
            )}

            <RiskBadge
              risk={vendor.riskLevel}
            />

          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Rank #{vendor.rank}
          </p>

        </div>

        <Link
          href={`/evaluations/${evaluationId}/vendors/${vendor.id}`}
          className="text-sm font-semibold text-primary hover:text-primary/80"
        >
          View Vendor Details
        </Link>

      </div>

      {/* ==================================== */}
      {/* COMPLIANCE METRICS */}
      {/* ==================================== */}

      <div className="grid grid-cols-1 border-b border-border sm:grid-cols-3">

        <MetricCell
          label="Mandatory Compliance"
          value={`${vendor.overallMandatoryCompliance.toFixed(1)}%`}
        />

        <MetricCell
          label="Overall Score"
          value={`${vendor.overallScore.toFixed(1)}%`}
          border
        />

        <MetricCell
          label="Missing Requirements"
          value={vendor.missingRequirements.length}
          border
        />

      </div>

      {/* ==================================== */}
      {/* COMPLIANCE ASSESSMENT */}
      {/* ==================================== */}

      <div className="px-5 py-5">

        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Compliance Assessment
        </p>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {vendor.complianceAssessment ||
            'No compliance assessment was returned for this vendor.'}
        </p>

      </div>

      {/* ==================================== */}
      {/* MISSING REQUIREMENTS */}
      {/* ==================================== */}

      <div className="border-t border-border bg-slate-50/40 px-5 py-5">

        <div className="flex items-center justify-between gap-4">

          <div>

            <h4 className="text-sm font-semibold text-foreground">
              Outstanding Mandatory Requirements
            </h4>

            <p className="mt-1 text-xs text-muted-foreground">
              Requirements that were not sufficiently demonstrated in the proposal.
            </p>

          </div>

          <span className="text-sm font-semibold text-primary">
            {vendor.missingRequirements.length}
          </span>

        </div>

        {vendor.missingRequirements.length === 0 ? (

          <div className="mt-4 flex items-center gap-2 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="size-4 shrink-0" />
            No missing mandatory requirements were identified.
          </div>

        ) : (

          <div className="mt-4 divide-y divide-border border border-border bg-white">

            {vendor.missingRequirements.map(
              (requirement) => (
                <div
                  key={requirement.requirementId}
                  className="flex gap-3 px-4 py-4"
                >

                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-600" />

                  <div className="min-w-0 flex-1">

                    <p className="text-sm font-medium text-foreground">
                      {requirement.requirement}
                    </p>

                    {requirement.criterionName && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Criterion: {requirement.criterionName}
                      </p>
                    )}

                    {requirement.source && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Source: {requirement.source}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-red-600">
                      {requirement.issue}
                    </p>

                  </div>

                </div>
              ),
            )}

          </div>
        )}

      </div>

    </div>
  )
}


function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string
  value: string | number
  description: string
  icon: typeof ShieldCheck
}) {
  return (
    <div className="border border-border bg-white px-5 py-5">

      <div className="flex items-start justify-between gap-4">

        <div>

          <p className="text-sm text-muted-foreground">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-primary">
            {value}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>

        </div>

        <div className="flex size-10 items-center justify-center bg-primary/[0.06] text-primary">
          <Icon className="size-4.5" />
        </div>

      </div>

    </div>
  )
}


function MetricCell({
  label,
  value,
  border = false,
}: {
  label: string
  value: string | number
  border?: boolean
}) {
  return (
    <div
      className={`
        px-5
        py-4
        ${
          border
            ? 'border-t border-border sm:border-l sm:border-t-0'
            : ''
        }
      `}
    >

      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-xl font-semibold text-primary">
        {value}
      </p>

    </div>
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


function LoadingState() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">

      <div className="h-24 animate-pulse bg-muted" />

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

      <div className="mt-8 h-80 animate-pulse bg-muted" />

    </div>
  )
}