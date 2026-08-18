import Link from 'next/link'
import { ArrowUpRight, Ban, CheckCircle2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RiskBadge } from '@/components/domain-badges'
import { ScoreBar } from '@/components/score-progress'
import { formatPercent } from '@/lib/labels'
import type { Vendor } from '@/lib/types'

export function VendorRankCard({
  vendor,
  href,
}: {
  vendor: Vendor
  href: string
}) {
  const isTop = vendor.rank === 1 && vendor.eligible

  return (
    <Link
      href={href}
      className={cn(
        'group block rounded-xl border bg-card p-5 transition-all hover:border-ring/40 hover:shadow-sm',
        isTop ? 'border-secondary/40 ring-1 ring-secondary/20' : 'border-border',
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-lg text-lg font-semibold tabular-nums',
            isTop
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {vendor.rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{vendor.name}</h3>
            {isTop && (
              <span className="inline-flex items-center gap-1 rounded bg-secondary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary">
                <TrendingUp className="size-3" />
                Top Ranked
              </span>
            )}
            {vendor.eligible ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="size-3.5" />
                Eligible
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-destructive">
                <Ban className="size-3.5" />
                Ineligible
              </span>
            )}
            <RiskBadge level={vendor.riskLevel} className="ml-auto" />
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {vendor.summary}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <ScoreBar label="Overall Score" value={vendor.overallScore} />
            <ScoreBar
              label="Mandatory Compliance"
              value={vendor.overallMandatoryCompliance}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex gap-5 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{vendor.strengths.length}</span> strengths
          </span>
          <span>
            <span className="font-medium text-foreground">{vendor.gaps.length}</span> gaps
          </span>
          <span>
            <span className="font-medium text-foreground">
              {formatPercent(vendor.overallScore, 0)}
            </span>{' '}
            weighted
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary group-hover:underline">
          View detail
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>
    </Link>
  )
}
