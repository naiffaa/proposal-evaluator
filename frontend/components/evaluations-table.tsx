import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { EvaluationSummary } from '@/lib/types'
import { formatDate } from '@/lib/labels'
import { StatusBadge, RecommendationBadge } from '@/components/domain-badges'

interface EvaluationsTableProps {
  evaluations: EvaluationSummary[]
  showRecommendation?: boolean
}

export function EvaluationsTable({ evaluations, showRecommendation }: EvaluationsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <Th>RFP / Evaluation</Th>
            <Th className="text-center">Vendors</Th>
            <Th>Status</Th>
            <Th>Top Ranked Vendor</Th>
            {showRecommendation && <Th>Recommendation</Th>}
            <Th>Date</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((e) => (
            <tr
              key={e.id}
              className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50"
            >
              <td className="py-3.5 pr-4">
                <p className="font-medium text-foreground">{e.rfpName}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{e.id}</p>
              </td>
              <td className="px-3 py-3.5 text-center tabular-nums text-foreground">
                {e.vendorCount}
              </td>
              <td className="px-3 py-3.5">
                <StatusBadge status={e.status} size="sm" />
              </td>
              <td className="px-3 py-3.5 text-foreground">
                {e.topRankedVendor ?? <span className="text-muted-foreground">—</span>}
              </td>
              {showRecommendation && (
                <td className="px-3 py-3.5">
                  {e.recommendationStatus ? (
                    <RecommendationBadge status={e.recommendationStatus} size="sm" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              )}
              <td className="px-3 py-3.5 whitespace-nowrap text-muted-foreground">
                {formatDate(e.createdDate)}
              </td>
              <td className="py-3.5 pl-3 text-right">
                <Link
                  href={`/evaluations/${e.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  View
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`whitespace-nowrap pb-2.5 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}
    >
      {children}
    </th>
  )
}
