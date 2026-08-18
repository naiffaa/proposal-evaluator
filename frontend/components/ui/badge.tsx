import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-muted text-muted-foreground',
        brand: 'border-primary/15 bg-primary/5 text-primary',
        success: 'border-success/20 bg-success-muted text-success',
        warning: 'border-warning/20 bg-warning-muted text-warning',
        danger: 'border-danger/20 bg-danger-muted text-danger',
        info: 'border-info/20 bg-info-muted text-info',
        outline: 'border-border bg-transparent text-foreground',
      },
      size: {
        sm: 'px-2 py-0.5 text-[11px]',
        md: 'px-2.5 py-0.5 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, tone, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

export { badgeVariants }
