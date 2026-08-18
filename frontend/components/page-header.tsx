import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Crumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: Crumb[]
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs">
            {breadcrumbs.map((c, i) => {
              const last = i === breadcrumbs.length - 1
              return (
                <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {c.href && !last ? (
                    <Link href={c.href} className="text-muted-foreground transition-colors hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : (
                    <span className={cn(last ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                      {c.label}
                    </span>
                  )}
                  {!last && <ChevronRight className="size-3 text-border" />}
                </span>
              )
            })}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground text-pretty">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
