'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { MatchBadge } from '@/components/domain-badges'
import type { VendorRequirementResult } from '@/lib/types'


export function RequirementResults({
  results,
}: {
  results: VendorRequirementResult[]
}) {
  const [filter, setFilter] =
    useState<'ALL' | 'GAPS' | 'MANDATORY'>('ALL')


  const filtered = useMemo(() => {
    if (filter === 'GAPS') {
      return results.filter(
        (result) =>
          result.status === 'NO_MATCH' ||
          result.status === 'PARTIAL_MATCH' ||
          result.status === 'NOT_PROVIDED',
      )
    }

    if (filter === 'MANDATORY') {
      return results.filter(
        (result) => result.mandatory,
      )
    }

    return results
  }, [results, filter])


  const filters: {
    key: typeof filter
    label: string
    count: number
  }[] = [
    {
      key: 'ALL',
      label: 'All',
      count: results.length,
    },
    {
      key: 'MANDATORY',
      label: 'Mandatory',
      count: results.filter(
        (result) => result.mandatory,
      ).length,
    },
    {
      key: 'GAPS',
      label: 'Gaps',
      count: results.filter(
        (result) =>
          result.status !== 'FULL_MATCH',
      ).length,
    },
  ]


  return (
    <div>

      {/* ===================================== */}
      {/* FILTERS */}
      {/* ===================================== */}

      <div className="mb-3 flex flex-wrap gap-2">

        {filters.map((item) => (

          <button
            key={item.key}
            type="button"
            onClick={() =>
              setFilter(item.key)
            }
            className={cn(
              `
                inline-flex
                items-center
                gap-1.5
                rounded-md
                border
                px-3
                py-1.5
                text-sm
                font-medium
                transition-colors
              `,

              filter === item.key
                ? 'border-secondary bg-secondary text-secondary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >

            {item.label}

            <span
              className={cn(
                'rounded px-1 text-xs tabular-nums',

                filter === item.key
                  ? 'bg-white/15'
                  : 'bg-muted',
              )}
            >
              {item.count}
            </span>

          </button>

        ))}

      </div>

      {/* ===================================== */}
      {/* REQUIREMENT RESULTS */}
      {/* ===================================== */}

      <div className="space-y-2">

        {filtered.map((result) => (
          <RequirementRow
            key={result.requirementId}
            result={result}
          />
        ))}

        {filtered.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No requirements match this filter.
          </p>
        )}

      </div>

    </div>
  )
}


function RequirementRow({
  result,
}: {
  result: VendorRequirementResult
}) {
  const [open, setOpen] =
    useState(false)


  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">

      {/* ===================================== */}
      {/* ROW HEADER */}
      {/* ===================================== */}

      <button
        type="button"
        onClick={() =>
          setOpen(
            (value) => !value,
          )
        }
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {result.criterionName}
            </span>

            {result.mandatory && (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                Mandatory
              </span>
            )}

          </div>

          <p className="mt-1 truncate text-sm text-foreground">
            {result.requirement}
          </p>

        </div>

        {/* MATCH SCORE */}

        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {result.matchScore}
        </span>

        {/* STATUS */}

        <MatchBadge
          status={result.status}
        />

        {/* EXPAND */}

        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',

            open && 'rotate-180',
          )}
        />

      </button>

      {/* ===================================== */}
      {/* DETAILS */}
      {/* ===================================== */}

      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3.5">

          {/* EVIDENCE */}

          <div>

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Evidence from proposal
            </p>

            <p className="mt-1 text-sm leading-relaxed text-foreground">
              {result.evidence}
            </p>

          </div>

          {/* RATIONALE */}

          <div>

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Scoring rationale
            </p>

            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {result.rationale}
            </p>

          </div>

          {/* SOURCE */}

          <p className="font-mono text-xs text-muted-foreground">
            {result.source}
          </p>

        </div>
      )}

    </div>
  )
}