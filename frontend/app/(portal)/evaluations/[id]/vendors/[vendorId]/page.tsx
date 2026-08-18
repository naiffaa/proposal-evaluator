'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Ban,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { RiskBadge } from '@/components/domain-badges'
import { ScoreRing, ScoreBar } from '@/components/score-progress'
import { RequirementResults } from '@/components/requirement-results'
import { evaluationsApi } from '@/lib/api'
import { formatPercent } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Vendor } from '@/lib/types'

export default function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string; vendorId: string }>
}) {
  const { id, vendorId } = use(params)
  const [vendor, setVendor] = useState<Vendor | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    evaluationsApi.getVendor(id, vendorId).then((data) => {
      if (active) setVendor(data ?? null)
    })
    return () => {
      active = false
    }
  }, [id, vendorId])

  if (vendor === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (vendor === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState
          icon={Ban}
          title="Vendor not found"
          description="This vendor is not part of the evaluation."
          action={
            <Button asChild>
              <Link href={`/evaluations/${id}`}>Back to Results</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={`Rank #${vendor.rank} · Evaluation ${id}`}
        title={vendor.name}
        description={vendor.summary}
        breadcrumbs={[
          { label: 'Evaluations', href: '/evaluations' },
          { label: id, href: `/evaluations/${id}` },
          { label: vendor.name },
        ]}
        badge={<RiskBadge level={vendor.riskLevel} />}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/evaluations/${id}/compare`}>Compare vendors</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Score summary */}
        <Card className="flex flex-col items-center justify-center gap-4 p-6 text-center lg:col-span-1">
          <ScoreRing value={vendor.overallScore} label="Weighted Score" />
          <div className="w-full space-y-3 border-t border-border pt-4">
            <ScoreBar
              label="Mandatory Compliance"
              value={vendor.overallMandatoryCompliance}
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Eligibility</span>
              {vendor.eligible ? (
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <CheckCircle2 className="size-4" />
                  Eligible
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-destructive">
                  <Ban className="size-4" />
                  Ineligible
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Criterion breakdown */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            Score by Criterion
          </h2>
          <div className="space-y-4">
            {vendor.criterionScores.map((c) => (
              <div key={c.criterionId}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-foreground">
                    {c.criterionName}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    weight {c.weight}% &middot; contributes{' '}
                    <span className="font-medium tabular-nums text-foreground">
                      {c.contribution.toFixed(1)}
                    </span>
                  </span>
                </div>
                <ScoreBar value={c.score} showValue />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Strengths & Gaps */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="size-4 text-success" />
            <h3 className="font-medium text-foreground">Key Strengths</h3>
          </div>
          <ul className="space-y-2.5">
            {vendor.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown className="size-4 text-warning" />
            <h3 className="font-medium text-foreground">Identified Gaps</h3>
          </div>
          <ul className="space-y-2.5">
            {vendor.gaps.map((g, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <span className="leading-relaxed">{g}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Compliance assessment */}
      <Card
        className={cn(
          'mt-6 p-5',
          vendor.eligible ? '' : 'border-destructive/30 bg-destructive/5',
        )}
      >
        <div className="flex items-start gap-3">
          <ShieldCheck
            className={cn(
              'mt-0.5 size-5 shrink-0',
              vendor.eligible ? 'text-success' : 'text-destructive',
            )}
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-foreground">Mandatory Compliance Assessment</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {vendor.complianceAssessment}
            </p>
            {vendor.missingRequirements.length > 0 && (
              <div className="mt-4 space-y-2">
                {vendor.missingRequirements.map((m) => (
                  <div
                    key={m.requirementId}
                    className="rounded-md border border-destructive/20 bg-background/60 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Ban className="size-3.5 shrink-0 text-destructive" />
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {m.criterionName}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{m.requirement}</p>
                    <p className="mt-1 text-sm text-destructive">{m.issue}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {m.source}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Requirement-level results */}
      <div className="mt-8">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Requirement-Level Analysis
          </h2>
          <span className="text-sm text-muted-foreground">
            {formatPercent(vendor.overallScore, 1)} overall
          </span>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          How this proposal addresses each requirement in the RFP framework, with
          supporting evidence and scoring rationale.
        </p>
        <RequirementResults results={vendor.requirementResults} />
      </div>
    </div>
  )
}
