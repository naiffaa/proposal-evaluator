import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { recommendationStatusLabel } from '@/lib/labels'
import type { Evaluation } from '@/lib/types'

// Advisory-only banner. The system never auto-selects a winner; it surfaces a
// recommendation for human review, or flags that human review is required.
export function RecommendationBanner({ evaluation }: { evaluation: Evaluation }) {
  const status = evaluation.recommendationStatus

  const config = {
    RECOMMENDED_FOR_REVIEW: {
      icon: CheckCircle2,
      wrap: 'border-success/30 bg-success/5',
      iconWrap: 'bg-success/10 text-success',
      label: 'text-success',
    },
    REQUIRES_HUMAN_REVIEW: {
      icon: AlertTriangle,
      wrap: 'border-warning/30 bg-warning/5',
      iconWrap: 'bg-warning/10 text-warning',
      label: 'text-warning',
    },
    NO_ELIGIBLE_VENDOR: {
      icon: XCircle,
      wrap: 'border-destructive/30 bg-destructive/5',
      iconWrap: 'bg-destructive/10 text-destructive',
      label: 'text-destructive',
    },
  }[status ?? 'REQUIRES_HUMAN_REVIEW']

  const Icon = config.icon

  return (
    <div className={cn('rounded-xl border p-5', config.wrap)}>
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-lg',
            config.iconWrap,
          )}
        >
          <Icon className="size-5.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className={cn('text-sm font-semibold', config.label)}>
              {status ? recommendationStatusLabel[status] : 'Pending'}
            </p>
            {evaluation.recommendedVendor && (
              <span className="text-sm text-muted-foreground">
                Advisory: <span className="font-medium text-foreground">{evaluation.recommendedVendor}</span>
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {evaluation.advisoryRecommendation}
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-md bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" />
            <span>
              This is an advisory recommendation to support the procurement team. Final
              award decisions require human review and approval.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
