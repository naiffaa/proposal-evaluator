import Link from 'next/link'
import {
  ArrowRight,
  FileSearch,
  FileText,
  Plus,
} from 'lucide-react'

import { evaluationsApi } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import type { EvaluationStatus } from '@/lib/types'


export default async function RfpAnalysisPage() {
  const evaluations = await evaluationsApi.list()

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:py-10">

      {/* ====================================== */}
      {/* PAGE HEADER */}
      {/* ====================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Document Intelligence
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">
            RFP Analysis
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review the evaluation frameworks extracted from your RFP documents,
            including criteria, requirements, mandatory items, and scoring weights.
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
            <FileSearch className="size-5" />
          </div>

          <div>

            <h2 className="text-sm font-semibold text-primary">
              Extracted RFP Frameworks
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Select an RFP to inspect the framework generated during analysis.
              Each framework is used as the scoring foundation for its associated
              vendor proposals.
            </p>

          </div>

        </div>

      </div>

      {/* ====================================== */}
      {/* RFP LIST HEADER */}
      {/* ====================================== */}

      <section className="mt-9">

        <div className="flex items-end justify-between gap-4">

          <div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
              RFP Documents
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary">
              Available Analysis
            </h2>

          </div>

          <p className="text-sm text-muted-foreground">
            {evaluations.length}{' '}
            {evaluations.length === 1 ? 'RFP' : 'RFPs'}
          </p>

        </div>

        {/* ==================================== */}
        {/* EMPTY STATE */}
        {/* ==================================== */}

        {evaluations.length === 0 ? (

          <div className="mt-6 border border-border bg-white px-6 py-16 text-center">

            <div className="mx-auto flex size-12 items-center justify-center bg-primary/[0.06] text-primary">
              <FileSearch className="size-5" />
            </div>

            <h3 className="mt-4 text-base font-semibold text-foreground">
              No RFP analyses available
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Start a new proposal evaluation to upload and analyze an RFP.
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
          /* RFP TABLE */
          /* ================================== */

          <div className="mt-6 overflow-hidden border border-border bg-white">

            {/* TABLE HEADER */}

            <div className="hidden grid-cols-[minmax(0,2.5fr)_140px_120px_150px_44px] items-center gap-4 border-b border-border bg-slate-50/70 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:grid">

              <span>RFP Document</span>

              <span>Evaluation</span>

              <span>Status</span>

              <span>Date</span>

              <span />

            </div>

            {/* TABLE ROWS */}

            <div className="divide-y divide-border">

              {evaluations.map((evaluation) => (
                <Link
                  key={evaluation.id}
                  href={`/evaluations/${evaluation.id}/rfp`}
                  className="
                    group
                    grid
                    grid-cols-1
                    gap-4
                    px-5
                    py-5
                    transition-colors
                    hover:bg-primary/[0.025]
                    md:grid-cols-[minmax(0,2.5fr)_140px_120px_150px_44px]
                    md:items-center
                  "
                >

                  {/* RFP NAME */}

                  <div className="flex min-w-0 items-start gap-3">

                    <div className="flex size-10 shrink-0 items-center justify-center bg-primary/[0.06] text-primary">
                      <FileText className="size-4.5" />
                    </div>

                    <div className="min-w-0">

                      <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                        {evaluation.rfpName}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {evaluation.vendorCount}{' '}
                        {evaluation.vendorCount === 1
                          ? 'vendor proposal'
                          : 'vendor proposals'}
                      </p>

                    </div>

                  </div>

                  {/* EVALUATION ID */}

                  <div>

                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden">
                      Evaluation
                    </p>

                    <span className="font-mono text-xs font-medium text-primary">
                      {evaluation.id}
                    </span>

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