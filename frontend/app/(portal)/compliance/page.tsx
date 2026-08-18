import Link from 'next/link'
import {
  ArrowRight,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { evaluationsApi } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import type { EvaluationStatus } from '@/lib/types'


export default async function CompliancePage() {
  const evaluations = await evaluationsApi.list()

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:py-10">

      {/* ====================================== */}
      {/* PAGE HEADER */}
      {/* ====================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Compliance Review
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">
            Compliance
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review mandatory requirement compliance, missing evidence,
            eligibility, and vendor risk across proposal evaluations.
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
      {/* INTRO */}
      {/* ====================================== */}

      <div className="mt-8 border border-primary/15 bg-primary/[0.035] px-6 py-5">

        <div className="flex items-start gap-4">

          <div className="flex size-11 shrink-0 items-center justify-center bg-primary/[0.08] text-primary">
            <ShieldCheck className="size-5" />
          </div>

          <div>

            <h2 className="text-sm font-semibold text-primary">
              Mandatory Compliance Review
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Select an evaluation to inspect mandatory requirement coverage,
              vendor eligibility, missing requirements, and compliance risks.
            </p>

          </div>

        </div>

      </div>

      {/* ====================================== */}
      {/* EVALUATIONS */}
      {/* ====================================== */}

      <section className="mt-9">

        <div className="flex items-end justify-between gap-4">

          <div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
              Evaluations
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary">
              Available Compliance Reviews
            </h2>

          </div>

          <p className="text-sm text-muted-foreground">
            {evaluations.length}{' '}
            {evaluations.length === 1
              ? 'evaluation'
              : 'evaluations'}
          </p>

        </div>

        {evaluations.length === 0 ? (

          <div className="mt-6 border border-border bg-white px-6 py-16 text-center">

            <div className="mx-auto flex size-12 items-center justify-center bg-primary/[0.06] text-primary">
              <ShieldCheck className="size-5" />
            </div>

            <h3 className="mt-4 text-base font-semibold text-foreground">
              No compliance reviews available
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Complete a proposal evaluation to review vendor compliance.
            </p>

          </div>

        ) : (

          <div className="mt-6 overflow-hidden border border-border bg-white">

            {/* TABLE HEADER */}

            <div
              className="
                hidden
                grid-cols-[minmax(0,2.4fr)_130px_140px_140px_44px]
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
                md:grid
              "
            >
              <span>RFP / Evaluation</span>
              <span>Vendors</span>
              <span>Status</span>
              <span>Date</span>
              <span />
            </div>

            {/* ROWS */}

            <div className="divide-y divide-border">

              {evaluations.map((evaluation) => (

                <Link
                  key={evaluation.id}
                  href={`/evaluations/${evaluation.id}/compliance`}
                  className="
                    group
                    grid
                    grid-cols-1
                    gap-4
                    px-5
                    py-5
                    transition-colors
                    hover:bg-primary/[0.025]
                    md:grid-cols-[minmax(0,2.4fr)_130px_140px_140px_44px]
                    md:items-center
                  "
                >

                  {/* RFP */}

                  <div className="flex min-w-0 items-start gap-3">

                    <div className="flex size-10 shrink-0 items-center justify-center bg-primary/[0.06] text-primary">
                      <ShieldCheck className="size-4.5" />
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

                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden">
                      Vendors
                    </p>

                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Users className="size-4 text-muted-foreground" />

                      <span className="font-medium">
                        {evaluation.vendorCount}
                      </span>
                    </div>

                  </div>

                  {/* STATUS */}

                  <div>

                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden">
                      Status
                    </p>

                    <StatusBadge status={evaluation.status} />

                  </div>

                  {/* DATE */}

                  <div>

                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden">
                      Date
                    </p>

                    <span className="text-sm text-muted-foreground">
                      {formatDate(evaluation.createdDate)}
                    </span>

                  </div>

                  {/* ARROW */}

                  <div className="hidden justify-end md:flex">

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
    REQUIRES_REVIEW: 'Review',
  }

  return (
    <span
      className={`
        inline-flex
        w-fit
        items-center
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