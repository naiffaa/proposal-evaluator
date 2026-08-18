import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Layers,
  Plus,
  Users,
} from 'lucide-react'

import { dashboardApi, evaluationsApi } from '@/lib/api'
import { MetricCard } from '@/components/metric-card'
import { EvaluationsTable } from '@/components/evaluations-table'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'


export default async function EvaluationsPage() {
  const [stats, evaluations] = await Promise.all([
    dashboardApi.getStats(),
    evaluationsApi.list(),
  ])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:py-10">

      {/* ====================================== */}
      {/* PAGE HEADER */}
      {/* ====================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Evaluation Management
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">
            Evaluations
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            View, manage, and review all RFP and vendor proposal evaluations
            from one place.
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
      {/* ACTIVITY OVERVIEW */}
      {/* ====================================== */}

      <section className="mt-10">

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Overview
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-primary">
            Evaluation Activity
          </h2>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <MetricCard
            label="Total Evaluations"
            value={stats.totalEvaluations}
            icon={ClipboardList}
            hint="across all RFPs"
          />

          <MetricCard
            label="Active Evaluations"
            value={stats.activeEvaluations}
            icon={Layers}
            accent="warning"
            hint="in progress or review"
          />

          <MetricCard
            label="Vendors Analyzed"
            value={stats.vendorsAnalyzed}
            icon={Users}
            hint="proposals evaluated"
          />

          <MetricCard
            label="Completed Reports"
            value={stats.completedReports}
            icon={CheckCircle2}
            accent="success"
            hint="ready to export"
          />

        </div>

      </section>

      {/* ====================================== */}
      {/* ALL EVALUATIONS */}
      {/* ====================================== */}

      <Card className="mt-8">

        <CardHeader className="flex-row items-center justify-between">

          <div>
            <CardTitle className="text-lg">
              All Evaluations
            </CardTitle>

            <p className="mt-1 text-sm text-muted-foreground">
              Review evaluation status, vendors, rankings, and results.
            </p>
          </div>

          <Link
            href="/evaluations/new"
            className="hidden items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 sm:inline-flex"
          >
            Start New
            <ArrowRight className="size-4" />
          </Link>

        </CardHeader>

        <CardContent>
          <EvaluationsTable
            evaluations={evaluations}
          />
        </CardContent>

      </Card>

    </div>
  )
}