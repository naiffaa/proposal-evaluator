'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  GitCompareArrows,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'

import { evaluationsApi } from '@/lib/api'
import type { Vendor } from '@/lib/types'


export default function EvaluationComparisonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    evaluationsApi
      .getComparison(id)
      .then((data) => {
        if (active) {
          setVendors(data)
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [id])

  const sortedVendors = useMemo(
    () =>
      [...vendors].sort(
        (a, b) => a.rank - b.rank,
      ),
    [vendors],
  )

  const topVendor = sortedVendors[0]

  if (loading) {
    return <LoadingState />
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:py-10">

      {/* ====================================== */}
      {/* HEADER */}
      {/* ====================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Evaluation {id}
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">
            Vendor Comparison
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Compare vendor scores, mandatory compliance, eligibility,
            risk level, and criterion-level performance.
          </p>

        </div>

        <Link
          href="/comparison"
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
          Back to Comparisons
        </Link>

      </div>

      {/* ====================================== */}
      {/* SUMMARY */}
      {/* ====================================== */}

      {topVendor && (
        <div className="mt-8 border border-primary/15 bg-primary/[0.035] px-6 py-5">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-4">

              <div className="flex size-12 shrink-0 items-center justify-center bg-primary text-white">
                <Trophy className="size-5" />
              </div>

              <div>

                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
                  Top Ranked Vendor
                </p>

                <h2 className="mt-1 text-xl font-semibold text-primary">
                  {topVendor.name}
                </h2>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Ranked #1 based on weighted scoring and the extracted
                  RFP evaluation framework.
                </p>

              </div>

            </div>

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">

              <SummaryValue
                label="Overall Score"
                value={`${topVendor.overallScore}%`}
              />

              <SummaryValue
                label="Mandatory"
                value={`${topVendor.overallMandatoryCompliance}%`}
              />

              <SummaryValue
                label="Status"
                value={
                  topVendor.eligible
                    ? 'Eligible'
                    : 'Not Eligible'
                }
              />

            </div>

          </div>

        </div>
      )}

      {/* ====================================== */}
      {/* VENDOR OVERVIEW */}
      {/* ====================================== */}

      <section className="mt-10">

        <div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Overall Comparison
          </p>

          <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary">
            Vendor Performance
          </h2>

        </div>

        {sortedVendors.length === 0 ? (

          <div className="mt-6 border border-border bg-white px-6 py-16 text-center">

            <GitCompareArrows className="mx-auto size-8 text-muted-foreground" />

            <h3 className="mt-4 text-base font-semibold text-foreground">
              No vendor results available
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              Vendor comparison will appear after proposal evaluation is completed.
            </p>

          </div>

        ) : (

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">

            {sortedVendors.map((vendor) => (
              <VendorSummaryCard
                key={vendor.id}
                vendor={vendor}
                evaluationId={id}
              />
            ))}

          </div>
        )}

      </section>

      {/* ====================================== */}
      {/* CRITERIA COMPARISON */}
      {/* ====================================== */}

      {sortedVendors.length > 0 && (
        <section className="mt-10">

          <div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
              Score Breakdown
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary">
              Criteria Comparison
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Compare how each vendor performed across every weighted RFP criterion.
            </p>

          </div>

          <CriteriaComparisonTable
            vendors={sortedVendors}
          />

        </section>
      )}

    </div>
  )
}


function VendorSummaryCard({
  vendor,
  evaluationId,
}: {
  vendor: Vendor
  evaluationId: string
}) {
  return (
    <div className="flex h-full flex-col border border-border bg-white">

      {/* TOP */}

      <div className="border-b border-border px-5 py-5">

        <div className="flex items-start justify-between gap-3">

          <div className="flex items-start gap-3">

            <div
              className={`
                flex
                size-10
                shrink-0
                items-center
                justify-center
                text-sm
                font-semibold
                ${
                  vendor.rank === 1
                    ? 'bg-primary text-white'
                    : 'bg-primary/[0.06] text-primary'
                }
              `}
            >
              #{vendor.rank}
            </div>

            <div>

              <h3 className="text-[15px] font-semibold text-foreground">
                {vendor.name}
              </h3>

              <p className="mt-1 text-xs text-muted-foreground">
                Overall vendor evaluation
              </p>

            </div>

          </div>

          {vendor.rank === 1 && (
            <Award className="size-5 text-amber-600" />
          )}

        </div>

      </div>

      {/* METRICS */}

      <div className="grid grid-cols-2 border-b border-border">

        <div className="border-r border-border px-5 py-4">

          <p className="text-xs text-muted-foreground">
            Overall Score
          </p>

          <p className="mt-1 text-2xl font-semibold text-primary">
            {vendor.overallScore}%
          </p>

        </div>

        <div className="px-5 py-4">

          <p className="text-xs text-muted-foreground">
            Mandatory Compliance
          </p>

          <p className="mt-1 text-2xl font-semibold text-primary">
            {vendor.overallMandatoryCompliance}%
          </p>

        </div>

      </div>

      {/* STATUS */}

      <div className="grid grid-cols-2 gap-4 px-5 py-4">

        <div>

          <p className="text-xs text-muted-foreground">
            Eligibility
          </p>

          <div className="mt-2">

            {vendor.eligible ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <CheckCircle2 className="size-3.5" />
                Eligible
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                <ShieldAlert className="size-3.5" />
                Not Eligible
              </span>
            )}

          </div>

        </div>

        <div>

          <p className="text-xs text-muted-foreground">
            Risk
          </p>

          <div className="mt-2">
            <RiskBadge risk={vendor.riskLevel} />
          </div>

        </div>

      </div>

      {/* SUMMARY */}

      <div className="flex-1 border-t border-border px-5 py-4">

        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Assessment
        </p>

        <p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">
          {vendor.summary}
        </p>

      </div>

      {/* ACTION */}

      <div className="border-t border-border px-5 py-4">

        <Link
          href={`/evaluations/${evaluationId}/vendors/${vendor.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80"
        >
          View Vendor Details
          <ArrowLeft className="size-4 rotate-180" />
        </Link>

      </div>

    </div>
  )
}


function CriteriaComparisonTable({
  vendors,
}: {
  vendors: Vendor[]
}) {
  const criteria =
    vendors[0]?.criterionScores ?? []

  return (
    <div className="mt-6 overflow-x-auto border border-border bg-white">

      <table className="w-full min-w-[780px]">

        <thead>

          <tr className="border-b border-border bg-slate-50/70">

            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Criterion
            </th>

            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Weight
            </th>

            {vendors.map((vendor) => (
              <th
                key={vendor.id}
                className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                {vendor.name}
              </th>
            ))}

          </tr>

        </thead>

        <tbody className="divide-y divide-border">

          {criteria.map((criterion) => (

            <tr key={criterion.criterionId}>

              <td className="px-5 py-4">

                <p className="text-sm font-medium text-foreground">
                  {criterion.criterionName}
                </p>

              </td>

              <td className="px-5 py-4">

                <span className="text-sm font-semibold text-primary">
                  {criterion.weight}%
                </span>

              </td>

              {vendors.map((vendor) => {
                const score =
                  vendor.criterionScores.find(
                    (item) =>
                      item.criterionId ===
                      criterion.criterionId,
                  )

                return (
                  <td
                    key={vendor.id}
                    className="px-5 py-4"
                  >

                    <div className="flex items-center gap-3">

                      <span className="w-12 text-sm font-semibold text-foreground">
                        {score?.score ?? 0}%
                      </span>

                      <div className="h-1.5 flex-1 bg-slate-100">

                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${score?.score ?? 0}%`,
                          }}
                        />

                      </div>

                    </div>

                  </td>
                )
              })}

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  )
}


function SummaryValue({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>

      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-primary">
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
      <ShieldCheck className="size-3.5" />
      {risk.charAt(0) +
        risk.slice(1).toLowerCase()} Risk
    </span>
  )
}


function LoadingState() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">

      <div className="h-24 animate-pulse bg-muted" />

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map(
          (_, index) => (
            <div
              key={index}
              className="h-80 animate-pulse bg-muted"
            />
          ),
        )}
      </div>

      <div className="mt-8 h-72 animate-pulse bg-muted" />

    </div>
  )
}