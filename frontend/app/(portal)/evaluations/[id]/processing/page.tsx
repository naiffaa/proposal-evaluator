'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileStack, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ProcessingTimeline } from '@/components/processing-timeline'
import { ScoreProgress } from '@/components/score-progress'

const STAGES = [
  'Extracting RFP content',
  'Identifying evaluation criteria',
  'Identifying mandatory requirements',
  'Extracting vendor proposal content',
  'Evaluating technical requirements',
  'Evaluating vendor experience',
  'Evaluating team qualifications',
  'Evaluating financial proposal',
  'Assessing compliance and risk',
  'Calculating weighted scores',
  'Ranking vendors',
  'Preparing recommendation',
]

export default function ProcessingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((c) => {
        if (c >= STAGES.length) {
          clearInterval(interval)
          return c
        }
        return c + 1
      })
    }, 900)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (current >= STAGES.length) {
      const t = setTimeout(() => router.push(`/evaluations/${id}`), 1000)
      return () => clearTimeout(t)
    }
  }, [current, id, router])

  const done = Math.min(current, STAGES.length)
  const progress = Math.round((done / STAGES.length) * 100)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 lg:py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
          Analyzing Proposal Submissions
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground text-pretty">
          The evaluation engine is reviewing the RFP and comparing vendor submissions. This may
          take a few moments.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-6">
            <ProcessingTimeline stages={STAGES} current={done} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Current Progress</span>
                <span className="text-sm font-semibold tabular-nums text-primary">{progress}%</span>
              </div>
              <ScoreProgress value={progress} className="mt-3" />
              <p className="mt-3 text-xs text-muted-foreground">
                {progress < 100
                  ? STAGES[Math.min(done, STAGES.length - 1)]
                  : 'Finalizing evaluation…'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/5 text-primary">
                <FileStack className="size-5" />
              </span>
              <div>
                <p className="text-xl font-semibold tabular-nums text-foreground">4</p>
                <p className="text-xs text-muted-foreground">Documents Processed</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/5 text-primary">
                <Users className="size-5" />
              </span>
              <div>
                <p className="text-xl font-semibold tabular-nums text-foreground">3</p>
                <p className="text-xs text-muted-foreground">Vendors Being Evaluated</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
