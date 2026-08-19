'use client'

import {
  Check,
  Loader2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/context'


interface ProcessingTimelineProps {
  stages: string[]
  current: number
}


export function ProcessingTimeline({
  stages,
  current,
}: ProcessingTimelineProps) {
  const {
    isArabic,
  } = useLanguage()


  return (
    <ol className="relative">

      {stages.map(
        (
          stage,
          i,
        ) => {
          const isComplete =
            i < current

          const isCurrent =
            i === current

          const last =
            i ===
            stages.length - 1


          return (
            <li
              key={stage}
              className="relative flex gap-4 pb-1"
            >

              {/* CONNECTOR */}

              {!last && (
                <span
                  className={cn(
                    `
                      absolute
                      top-8
                      h-[calc(100%-1rem)]
                      w-px
                    `,

                    isArabic
                      ? 'right-[15px]'
                      : 'left-[15px]',

                    isComplete
                      ? 'bg-primary'
                      : 'bg-border',
                  )}
                  aria-hidden
                />
              )}


              {/* STATUS ICON */}

              <span
                className={cn(
                  `
                    relative
                    z-10
                    mt-0.5
                    flex
                    size-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    border
                    transition-colors
                  `,

                  isComplete &&
                    'border-success bg-success text-success-foreground',

                  isCurrent &&
                    'border-primary bg-primary/5 text-primary',

                  !isComplete &&
                    !isCurrent &&
                    'border-border bg-card text-muted-foreground',
                )}
              >

                {isComplete ? (
                  <Check className="size-4" />
                ) : isCurrent ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span className="text-xs font-semibold">
                    {i + 1}
                  </span>
                )}

              </span>


              {/* STAGE CONTENT */}

              <div className="flex min-h-8 flex-1 items-center gap-3 py-1">

                <p
                  className={cn(
                    `
                      text-sm
                      transition-colors
                    `,

                    isCurrent &&
                      'font-semibold text-foreground',

                    isComplete &&
                      'font-medium text-foreground',

                    !isComplete &&
                      !isCurrent &&
                      'text-muted-foreground',
                  )}
                >
                  {stage}
                </p>


                {isCurrent && (
                  <span className="ms-auto text-xs font-medium text-primary">
                    {isArabic
                      ? 'جارٍ التنفيذ'
                      : 'In progress'}
                  </span>
                )}


                {isComplete && (
                  <span className="ms-auto text-xs font-medium text-success">
                    {isArabic
                      ? 'مكتمل'
                      : 'Complete'}
                  </span>
                )}

              </div>

            </li>
          )
        },
      )}

    </ol>
  )
}