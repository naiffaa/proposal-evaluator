import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

interface MetricCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  hint?: string
  trend?: { value: string; direction: 'up' | 'down' | 'flat' }
  accent?: 'brand' | 'success' | 'warning' | 'danger'
  className?: string
}

const accentMap = {
  brand: 'bg-primary/5 text-primary',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  accent = 'brand',
  className,
}: MetricCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        </div>
        {Icon && (
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg',
              accentMap[accent],
            )}
          >
            <Icon className="size-4.5" strokeWidth={2} />
          </span>
        )}
      </div>
      {(hint || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                'font-medium',
                trend.direction === 'up' && 'text-success',
                trend.direction === 'down' && 'text-danger',
                trend.direction === 'flat' && 'text-muted-foreground',
              )}
            >
              {trend.value}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Card>
  )
}
