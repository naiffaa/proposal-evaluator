import { cn } from '@/lib/utils'

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'auto'

function toneFromScore(score: number): Exclude<Tone, 'auto'> {
  if (score >= 75) return 'success'
  if (score >= 50) return 'warning'
  if (score >= 25) return 'danger'
  return 'danger'
}

const barColor: Record<Exclude<Tone, 'auto'>, string> = {
  brand: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

interface ScoreProgressProps {
  value: number // 0-100
  tone?: Tone
  className?: string
  trackClassName?: string
  height?: 'sm' | 'md'
}

export function ScoreProgress({
  value,
  tone = 'brand',
  className,
  trackClassName,
  height = 'md',
}: ScoreProgressProps) {
  const resolved = tone === 'auto' ? toneFromScore(value) : tone
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-secondary',
        height === 'sm' ? 'h-1.5' : 'h-2.5',
        trackClassName,
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', barColor[resolved])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

interface ScoreBarProps {
  value: number
  label?: string
  showValue?: boolean
  tone?: Tone
  className?: string
}

// Labeled convenience wrapper around ScoreProgress used across detail views.
export function ScoreBar({
  value,
  label,
  showValue,
  tone = 'auto',
  className,
}: ScoreBarProps) {
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          {label && (
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          )}
          {showValue && (
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {value.toFixed(1)}
            </span>
          )}
        </div>
      )}
      <ScoreProgress value={value} tone={tone} height="sm" />
      {label && !showValue && (
        <p className="mt-1 text-xs font-semibold tabular-nums text-foreground">
          {value.toFixed(1)}
        </p>
      )}
    </div>
  )
}

interface ScoreRingProps {
  value: number
  size?: number
  strokeWidth?: number
  tone?: Tone
  label?: string
  className?: string
}

const ringColor: Record<Exclude<Tone, 'auto'>, string> = {
  brand: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

export function ScoreRing({
  value,
  size = 128,
  strokeWidth = 10,
  tone = 'auto',
  label = 'Score',
  className,
}: ScoreRingProps) {
  const resolved = tone === 'auto' ? toneFromScore(value) : tone
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-secondary"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('fill-none transition-all duration-700', ringColor[resolved])}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {clamped.toFixed(1)}
        </span>
        <span className="mt-0.5 max-w-20 text-center text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  )
}
