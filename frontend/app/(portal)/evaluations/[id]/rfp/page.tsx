'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, FileText, ListChecks, ShieldCheck, Layers } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { MetricCard } from '@/components/metric-card'
import { Card } from '@/components/ui/card'
import { RfpCriterionCard } from '@/components/rfp-criterion-card'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { evaluationsApi } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import type { RfpFramework } from '@/lib/types'

export default function RfpAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [rfp, setRfp] = useState<RfpFramework | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    evaluationsApi.getRfp(id).then((data) => {
      if (active) {
        setRfp(data)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [id])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={`Evaluation ${id}`}
        title="RFP Requirements Framework"
        description="The evaluation criteria and requirements extracted from the RFP document. Vendor proposals are scored against this framework."
        breadcrumbs={[
          { label: 'Evaluations', href: '/evaluations' },
          { label: id, href: `/evaluations/${id}` },
          { label: 'RFP Framework' },
        ]}
        actions={
          <Button asChild>
            <Link href={`/evaluations/${id}`}>
              View Results
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : !rfp ? (
        <EmptyState
          icon={FileText}
          title="No RFP framework found"
          description="This evaluation does not have a processed RFP framework yet."
        />
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm text-foreground">{rfp.fileName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Processed {formatDate(rfp.processedDate)}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {rfp.summary}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Evaluation Criteria"
              value={rfp.totalCriteria}
              icon={Layers}
            />
            <MetricCard
              label="Total Requirements"
              value={rfp.totalRequirements}
              icon={ListChecks}
            />
            <MetricCard
              label="Mandatory"
              value={rfp.mandatoryRequirements}
              icon={ShieldCheck}
              tone="warning"
            />
            <MetricCard
              label="Total Weight"
              value={`${rfp.totalWeight}%`}
              icon={FileText}
            />
          </div>

          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Weighted Criteria
              </h2>
              <p className="text-sm text-muted-foreground">
                {rfp.criteria.length} criteria &middot; select to expand
              </p>
            </div>
            <div className="space-y-3">
              {rfp.criteria.map((criterion) => (
                <RfpCriterionCard key={criterion.id} criterion={criterion} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}
