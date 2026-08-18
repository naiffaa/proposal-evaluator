'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  FileText,
  GitCompareArrows,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { MetricCard } from '@/components/metric-card'
import { RecommendationBanner } from '@/components/recommendation-banner'
import { VendorRankCard } from '@/components/vendor-rank-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { StatusBadge } from '@/components/domain-badges'

import { evaluationsApi } from '@/lib/api'
import { formatDate, formatPercent } from '@/lib/labels'
import type { Evaluation } from '@/lib/types'


export default function EvaluationResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [evaluation, setEvaluation] =
    useState<Evaluation | null>(null)

  const [loading, setLoading] =
    useState(true)


  useEffect(() => {
    let active = true

    evaluationsApi
      .get(id)
      .then((data) => {
        if (active) {
          setEvaluation(data)
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [id])


  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="h-32 animate-pulse rounded-lg bg-muted" />

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">

          {Array.from({
            length: 4,
          }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-lg bg-muted"
            />
          ))}

        </div>

      </div>
    )
  }


  if (!evaluation) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

        <EmptyState
          icon={FileText}
          title="Evaluation not found"
          description="We couldn't find this evaluation. It may have been removed."
          action={
            <Button asChild>
              <Link href="/evaluations">
                Back to Evaluations
              </Link>
            </Button>
          }
        />

      </div>
    )
  }


  const eligibleCount =
    evaluation.vendors.filter(
      (vendor) => vendor.eligible,
    ).length


  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

      <PageHeader
        eyebrow={`Evaluation ${evaluation.id}`}
        title={evaluation.rfpName}
        description={`${evaluation.vendorCount} vendor proposals evaluated against ${evaluation.rfp.totalCriteria} weighted criteria. Created ${formatDate(evaluation.createdDate)}.`}
        breadcrumbs={[
          {
            label: 'Evaluations',
            href: '/evaluations',
          },
          {
            label: evaluation.id,
          },
        ]}
        badge={
          <StatusBadge
            status={evaluation.status}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">

            <Button
              variant="outline"
              asChild
            >
              <Link
                href={`/evaluations/${id}/rfp`}
              >
                <FileText className="size-4" />
                RFP Framework
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
            >
              <Link
                href={`/evaluations/${id}/comparison`}
              >
                <GitCompareArrows className="size-4" />
                Compare
              </Link>
            </Button>

            <Button asChild>
              <Link
                href={`/evaluations/${id}/report`}
              >
                <BarChart3 className="size-4" />
                Report
              </Link>
            </Button>

          </div>
        }
      />

      <div className="space-y-6">

        {/* ================================= */}
        {/* RECOMMENDATION */}
        {/* ================================= */}

        <RecommendationBanner
          evaluation={evaluation}
        />

        {/* ================================= */}
        {/* METRICS */}
        {/* ================================= */}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

          <MetricCard
            label="Top Ranked"
            value={
              evaluation.topRankedVendor ??
              '—'
            }
            hint={
              evaluation.topRankedVendorScore
                ? `${formatPercent(
                    evaluation.topRankedVendorScore,
                    1,
                  )} weighted score`
                : undefined
            }
            icon={Trophy}
            tone="brand"
          />

          <MetricCard
            label="Vendors Evaluated"
            value={
              evaluation.vendorCount
            }
            hint={`${eligibleCount} eligible`}
            icon={Users}
          />

          <MetricCard
            label="Criteria"
            value={
              evaluation.rfp.totalCriteria
            }
            hint={`${evaluation.rfp.totalRequirements} requirements`}
            icon={ShieldCheck}
          />

          <MetricCard
            label="Mandatory Reqs"
            value={
              evaluation.rfp
                .mandatoryRequirements
            }
            hint="Pass/fail gating"
            icon={FileText}
            tone="warning"
          />

        </div>

        {/* ================================= */}
        {/* VENDOR RANKING */}
        {/* ================================= */}

        <div>

          <div className="mb-3 flex items-baseline justify-between">

            <h2 className="text-lg font-semibold text-foreground">
              Vendor Ranking
            </h2>

            <p className="text-sm text-muted-foreground">
              Ranked by weighted score
              &middot; mandatory compliance
              gated
            </p>

          </div>

          <div className="space-y-3">

            {evaluation.vendors.map(
              (vendor) => (
                <VendorRankCard
                  key={vendor.id}
                  vendor={vendor}
                  href={`/evaluations/${id}/vendors/${vendor.id}`}
                />
              ),
            )}

          </div>

        </div>

        {/* ================================= */}
        {/* METHODOLOGY */}
        {/* ================================= */}

        <Card className="p-5">

          <div className="flex items-start gap-3">

            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />

            <div>

              <h3 className="font-medium text-foreground">
                Methodology
              </h3>

              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Each proposal is scored
                requirement-by-requirement
                against the RFP framework,
                then aggregated using the
                published criteria weights.
                Vendors that fail mandatory
                requirements may be marked
                ineligible regardless of their
                weighted score. All outputs are
                advisory and intended to support,
                not replace, human procurement
                decisions.
              </p>

            </div>

          </div>

        </Card>

      </div>

    </div>
  )
}