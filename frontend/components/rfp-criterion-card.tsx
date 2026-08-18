'use client'

import { useState } from 'react'
import {
  ChevronDown,
  FileText,
  ShieldAlert,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { RfpCriterion } from '@/lib/types'


export function RfpCriterionCard({
  criterion,
}: {
  criterion: RfpCriterion
}) {
  const [open, setOpen] = useState(false)

  const mandatoryCount =
    criterion.requirements.filter(
      (requirement) => requirement.mandatory,
    ).length

  return (
    <div
      className={cn(
        'overflow-hidden border bg-white transition-all duration-200',
        open
          ? 'border-primary/25 shadow-[0_8px_24px_rgba(22,31,86,0.06)]'
          : 'border-border',
      )}
    >

      {/* ===================================== */}
      {/* CRITERION HEADER */}
      {/* ===================================== */}

      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        aria-expanded={open}
        className="
          flex
          w-full
          items-center
          gap-4
          px-5
          py-5
          text-left
          transition-colors
          hover:bg-primary/[0.025]
          sm:px-6
        "
      >

        {/* WEIGHT */}

        <div
          className="
            flex
            size-14
            shrink-0
            flex-col
            items-center
            justify-center
            bg-primary/[0.06]
            text-primary
          "
        >
          <span className="text-lg font-semibold leading-none">
            {criterion.weight}
          </span>

          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-primary/60">
            Weight %
          </span>
        </div>

        {/* CRITERION DETAILS */}

        <div className="min-w-0 flex-1">

          <p className="text-[15px] font-semibold text-primary">
            {criterion.name}
          </p>

          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {criterion.description}
          </p>

        </div>

        {/* STATS */}

        <div className="hidden shrink-0 items-center gap-7 lg:flex">

          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">
              {criterion.requirements.length}
            </p>

            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Requirements
            </p>
          </div>

          <div className="text-right">
            <p
              className={cn(
                'text-sm font-semibold',
                mandatoryCount > 0
                  ? 'text-amber-700'
                  : 'text-foreground',
              )}
            >
              {mandatoryCount}
            </p>

            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Mandatory
            </p>
          </div>

        </div>

        {/* EXPAND */}

        <div
          className={cn(
            `
              ml-1
              flex
              size-9
              shrink-0
              items-center
              justify-center
              border
              transition-colors
            `,
            open
              ? 'border-primary/20 bg-primary/[0.06] text-primary'
              : 'border-border text-muted-foreground',
          )}
        >
          <ChevronDown
            className={cn(
              'size-4 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </div>

      </button>

      {/* ===================================== */}
      {/* REQUIREMENTS */}
      {/* ===================================== */}

      {open && (
        <div className="border-t border-border bg-slate-50/40">

          {/* SECTION HEADER */}

          <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">

            <div>
              <p className="text-sm font-semibold text-foreground">
                Requirements
              </p>

              <p className="mt-0.5 text-xs text-muted-foreground">
                Extracted requirements under this evaluation criterion.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">

              <span>
                {criterion.requirements.length} total
              </span>

              {mandatoryCount > 0 && (
                <>
                  <span className="h-3 w-px bg-border" />

                  <span className="flex items-center gap-1.5 font-medium text-amber-700">
                    <ShieldAlert className="size-3.5" />
                    {mandatoryCount} mandatory
                  </span>
                </>
              )}

            </div>

          </div>

          {/* REQUIREMENTS LIST */}

          <ul className="divide-y divide-border">

            {criterion.requirements.map(
              (requirement, index) => (
                <li
                  key={requirement.id}
                  className="
                    flex
                    gap-4
                    bg-white
                    px-5
                    py-4
                    transition-colors
                    hover:bg-slate-50/70
                    sm:px-6
                  "
                >

                  {/* NUMBER */}

                  <div
                    className="
                      flex
                      size-7
                      shrink-0
                      items-center
                      justify-center
                      border
                      border-border
                      bg-white
                      text-[11px]
                      font-semibold
                      text-muted-foreground
                    "
                  >
                    {index + 1}
                  </div>

                  {/* CONTENT */}

                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-start gap-2">

                      <p className="flex-1 text-sm leading-6 text-foreground">
                        {requirement.requirement}
                      </p>

                      {requirement.mandatory && (
                        <span
                          className="
                            inline-flex
                            shrink-0
                            items-center
                            gap-1
                            bg-amber-50
                            px-2
                            py-1
                            text-[10px]
                            font-semibold
                            uppercase
                            tracking-wide
                            text-amber-700
                            ring-1
                            ring-inset
                            ring-amber-200
                          "
                        >
                          <ShieldAlert className="size-3" />
                          Mandatory
                        </span>
                      )}

                    </div>

                    {/* SOURCE */}

                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">

                      <FileText className="size-3.5 shrink-0" />

                      <span className="font-medium">
                        Source:
                      </span>

                      <span className="truncate">
                        {requirement.source}
                      </span>

                    </div>

                  </div>

                </li>
              ),
            )}

          </ul>

        </div>
      )}

    </div>
  )
}