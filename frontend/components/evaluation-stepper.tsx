import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EvaluationStepperProps {
  steps: string[]
  current: number // 0-based index
  className?: string
}

export function EvaluationStepper({ steps, current, className }: EvaluationStepperProps) {
  return (
    <ol className={cn('flex w-full items-center', className)}>
      {steps.map((step, i) => {
        const isComplete = i < current
        const isCurrent = i === current
        const last = i === steps.length - 1
        return (
          <li key={step} className={cn('flex items-center', !last && 'flex-1')}>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                  isComplete && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-primary/5 text-primary',
                  !isComplete && !isCurrent && 'border-border bg-card text-muted-foreground',
                )}
              >
                {isComplete ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden whitespace-nowrap text-sm font-medium sm:block',
                  isCurrent || isComplete ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step}
              </span>
            </div>
            {!last && (
              <div
                className={cn(
                  'mx-3 h-px flex-1 transition-colors',
                  isComplete ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
