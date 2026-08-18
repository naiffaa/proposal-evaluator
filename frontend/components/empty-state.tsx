import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  tone?: 'neutral' | 'warning' | 'danger'
  className?: string
}

const toneMap = {
  neutral: 'bg-secondary text-primary',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-12 items-center justify-center rounded-full',
          toneMap[tone],
        )}
      >
        <Icon className="size-6" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground text-pretty">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
