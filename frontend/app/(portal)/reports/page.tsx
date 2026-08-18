import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Plus,
  Users,
} from 'lucide-react'

import { evaluationsApi } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import type {
  EvaluationStatus,
  RecommendationStatus,
} from '@/lib/types'


export default async function ReportsPage() {
  const evaluations = await evaluationsApi.list()

  const completedReports = evaluations.filter(
    (evaluation) =>
      evaluation.status === 'COMPLETED' ||
      evaluation.status === 'REQUIRES_REVIEW',
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:py-10">

      {/* ====================================== */}
      {/* PAGE HEADER */}
      {/* ====================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Evaluation Outcomes
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">
            Reports
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review completed proposal evaluations, vendor recommendations,
            ranking outcomes, and final procurement assessment results.
          </p>

        </div>

        <Link
          href="/evaluations/new"
          className="
            inline-flex
            h-11
            shrink-0
            items-center
            justify-center
            gap-2
            rounded-md
            bg-primary
            px-5
            text-sm
            font-semibold
            text-white
            transition-colors
            hover:bg-primary/90
          "
        >
          <Plus className="size-4" />
          New Evaluation
        </Link>

      </div>

      {/* ====================================== */}
      {/* INTRO PANEL */}
      {/* ====================================== */}

      <div className="mt-8 border border-primary/15 bg-primary/[0.035] px-6 py-5">

        <div className="flex items-start gap-4">

          <div className="flex size-11 shrink-0 items-center justify-center bg-primary/[0.08] text-primary">
            <FileText className="size-5" />
          </div>

          <div>

            <h2 className="text-sm font-semibold text-primary">
              Evaluation Reports
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Reports consolidate the evaluation results, vendor ranking,
              compliance assessment, scoring outcomes, and recommendation
              generated for each RFP.
            </p>

          </div>

        </div>

      </div>

      {/* ====================================== */}
      {/* SUMMARY */}
      {/* ====================================== */}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">

        <SummaryCard
          label="Available Reports"
          value={completedReports.length}
          description="completed or ready for review"
          icon={FileText}
        />

        <SummaryCard
          label="Total Vendors"
          value={completedReports.reduce(
            (total, evaluation) =>
              total + evaluation.vendorCount,
            0,
          )}
          description="included in report results"
          icon={Users}
        />

        <SummaryCard
          label="Completed"
          value={
            completedReports.filter(
              (evaluation) =>
                evaluation.status === 'COMPLETED',
            ).length
          }
          description="finalized evaluations"
          icon={CheckCircle2}
        />

      </div>

      {/* ====================================== */}
      {/* REPORT LIST */}
      {/* ====================================== */}

      <section className="mt-10">

        <div className="flex items-end justify-between gap-4">

          <div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
              Report Library
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary">
              Evaluation Reports
            </h2>

          </div>

          <p className="text-sm text-muted-foreground">
            {completedReports.length}{' '}
            {completedReports.length === 1
              ? 'report'
              : 'reports'}
          </p>

        </div>

        {/* ==================================== */}
        {/* EMPTY */}
        {/* ==================================== */}

        {completedReports.length === 0 ? (

          <div className="mt-6 border border-border bg-white px-6 py-16 text-center">

            <div className="mx-auto flex size-12 items-center justify-center bg-primary/[0.06] text-primary">
              <FileText className="size-5" />
            </div>

            <h3 className="mt-4 text-base font-semibold text-foreground">
              No reports available
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Complete a proposal evaluation to generate an evaluation report.
            </p>

            <Link
              href="/evaluations/new"
              className="
                mt-5
                inline-flex
                h-10
                items-center
                justify-center
                gap-2
                rounded-md
                bg-primary
                px-4
                text-sm
                font-semibold
                text-white
                transition-colors
                hover:bg-primary/90
              "
            >
              <Plus className="size-4" />
              New Evaluation
            </Link>

          </div>

        ) : (

          /* ================================== */
          /* TABLE */
          /* ================================== */

          <div className="mt-6 overflow-hidden border border-border bg-white">

            {/* HEADER */}

            <div
              className="
                hidden
                grid-cols-[minmax(0,2.2fr)_130px_170px_150px_170px_44px]
                items-center
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
              <span>RFP / Report</span>
              <span>Vendors</span>
              <span>Recommendation</span>
              <span>Status</span>
              <span>Date</span>
              <span />
            </div>

            {/* ROWS */}

            <div className="divide-y divide-border">

              {completedReports.map((evaluation) => (

                <Link
                  key={evaluation.id}
                  href={`/evaluations/${evaluation.id}`}
                  className="
                    group
                    grid
                    grid-cols-1
                    gap-4
                    px-5
                    py-5
                    transition-colors
                    hover:bg-primary/[0.025]
                    lg:grid-cols-[minmax(0,2.2fr)_130px_170px_150px_170px_44px]
                    lg:items-center
                  "
                >

                  {/* REPORT */}

                  <div className="flex min-w-0 items-start gap-3">

                    <div className="flex size-10 shrink-0 items-center justify-center bg-primary/[0.06] text-primary">
                      <FileText className="size-4.5" />
                    </div>

                    <div className="min-w-0">

                      <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                        {evaluation.rfpName}
                      </p>

                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {evaluation.id}
                      </p>

                    </div>

                  </div>

                  {/* VENDORS */}

                  <div>

                    <MobileLabel>
                      Vendors
                    </MobileLabel>

                    <span className="text-sm font-medium text-foreground">
                      {evaluation.vendorCount}
                    </span>

                  </div>

                  {/* RECOMMENDATION */}

                  <div>

                    <MobileLabel>
                      Recommendation
                    </MobileLabel>

                    <RecommendationBadge
                      status={evaluation.recommendationStatus}
                    />

                  </div>

                  {/* STATUS */}

                  <div>

                    <MobileLabel>
                      Status
                    </MobileLabel>

                    <StatusBadge
                      status={evaluation.status}
                    />

                  </div>

                  {/* DATE */}

                  <div>

                    <MobileLabel>
                      Date
                    </MobileLabel>

                    <span className="text-sm text-muted-foreground">
                      {formatDate(
                        evaluation.createdDate,
                      )}
                    </span>

                  </div>

                  {/* ARROW */}

                  <div className="hidden justify-end lg:flex">

                    <div className="flex size-8 items-center justify-center text-primary transition-transform duration-200 group-hover:translate-x-1">
                      <ArrowRight className="size-4" />
                    </div>

                  </div>

                </Link>
              ))}

            </div>

          </div>
        )}

      </section>

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
  value: number
  description: string
  icon: typeof FileText
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


function StatusBadge({
  status,
}: {
  status: EvaluationStatus
}) {
  const styles: Record<EvaluationStatus, string> = {
    DRAFT:
      'bg-slate-100 text-slate-600 ring-slate-200',

    PROCESSING:
      'bg-blue-50 text-blue-700 ring-blue-200',

    COMPLETED:
      'bg-emerald-50 text-emerald-700 ring-emerald-200',

    REQUIRES_REVIEW:
      'bg-amber-50 text-amber-700 ring-amber-200',
  }

  const labels: Record<EvaluationStatus, string> = {
    DRAFT: 'Draft',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    REQUIRES_REVIEW: 'Requires Review',
  }

  return (
    <span
      className={`
        inline-flex
        w-fit
        px-2
        py-1
        text-[11px]
        font-semibold
        ring-1
        ring-inset
        ${styles[status]}
      `}
    >
      {labels[status]}
    </span>
  )
}


function RecommendationBadge({
  status,
}: {
  status: RecommendationStatus | null
}) {
  if (!status) {
    return (
      <span className="text-xs text-muted-foreground">
        Pending
      </span>
    )
  }

  const styles: Record<
    RecommendationStatus,
    string
  > = {
    RECOMMENDED_FOR_REVIEW:
      'bg-emerald-50 text-emerald-700 ring-emerald-200',

    NO_ELIGIBLE_VENDOR:
      'bg-red-50 text-red-700 ring-red-200',

    REQUIRES_HUMAN_REVIEW:
      'bg-amber-50 text-amber-700 ring-amber-200',
  }

  const labels: Record<
    RecommendationStatus,
    string
  > = {
    RECOMMENDED_FOR_REVIEW:
      'Recommended',

    NO_ELIGIBLE_VENDOR:
      'No Eligible Vendor',

    REQUIRES_HUMAN_REVIEW:
      'Human Review',
  }

  return (
    <span
      className={`
        inline-flex
        w-fit
        px-2
        py-1
        text-[11px]
        font-semibold
        ring-1
        ring-inset
        ${styles[status]}
      `}
    >
      {labels[status]}
    </span>
  )
}