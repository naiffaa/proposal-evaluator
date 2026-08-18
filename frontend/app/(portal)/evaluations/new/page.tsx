'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  FileCheck2,
  Files,
  Info,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { PageHeader } from '@/components/page-header'
import { EvaluationStepper } from '@/components/evaluation-stepper'
import {
  UploadDropzone,
  type UploadedFile,
} from '@/components/upload-dropzone'

import { evaluationsApi } from '@/lib/api'


const STEPS = [
  'Upload Documents',
  'Review RFP Framework',
  'Evaluate Proposals',
  'Review Results',
]


export default function NewEvaluationPage() {
  const router = useRouter()

  const [rfp, setRfp] = useState<UploadedFile[]>([])
  const [proposals, setProposals] = useState<UploadedFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canContinue =
    rfp.length === 1 &&
    proposals.length >= 1


  async function handleContinue() {
    if (!canContinue || submitting) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response =
        await evaluationsApi.runEvaluation({
          rfp: rfp[0].file,
          proposals: proposals.map(
            (proposal) => proposal.file,
          ),
        })

      if (!response.id) {
        throw new Error(
          'The evaluation completed, but no evaluation ID was returned.',
        )
      }

      router.push(
        `/evaluations/${response.id}`,
      )

    } catch (error) {
      console.error(
        'Evaluation failed:',
        error,
      )

      setError(
        error instanceof Error
          ? error.message
          : 'Proposal evaluation failed.',
      )

    } finally {
      setSubmitting(false)
    }
  }


  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:py-10">

      <PageHeader
        title="New Proposal Evaluation"
        subtitle="Upload the RFP and vendor proposals to start a structured AI-assisted evaluation."
      />

      <div className="mt-7 border border-border bg-white px-5 py-5 shadow-sm sm:px-7">
        <EvaluationStepper
          steps={STEPS}
          current={0}
        />
      </div>

      <div className="mt-8">

        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">
          Evaluation Documents
        </p>

        <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary">
          Upload the documents for evaluation
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Add one RFP document and one or more vendor proposals.
          Each proposal will be evaluated against the same extracted
          RFP criteria and requirements.
        </p>

      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">

        <Card className="overflow-hidden">

          <CardHeader className="flex-row items-center justify-between border-b border-border bg-white px-6 py-5">

            <div className="flex items-center gap-3">

              <span className="flex size-10 items-center justify-center bg-primary/[0.06] text-primary">
                <FileCheck2 className="size-5" />
              </span>

              <div>
                <CardTitle className="text-base">
                  RFP Document
                </CardTitle>

                <p className="mt-1 text-xs text-muted-foreground">
                  The source document for the evaluation framework
                </p>
              </div>

            </div>

            <span className="text-xs font-semibold text-primary">
              Required
            </span>

          </CardHeader>

          <CardContent className="p-6">

            <UploadDropzone
              title="Upload RFP"
              description="PDF supported · Maximum 50 MB"
              files={rfp}
              onAdd={(files) =>
                setRfp(files)
              }
              onRemove={() =>
                setRfp([])
              }
            />

            <div className="mt-4 flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">

              <Info className="mt-0.5 size-4 shrink-0 text-primary/70" />

              <p>
                The platform will analyze this document to extract
                evaluation criteria, requirements, mandatory items,
                and scoring weights.
              </p>

            </div>

          </CardContent>

        </Card>

        <Card className="overflow-hidden">

          <CardHeader className="flex-row items-center justify-between border-b border-border bg-white px-6 py-5">

            <div className="flex items-center gap-3">

              <span className="flex size-10 items-center justify-center bg-primary/[0.06] text-primary">
                <Files className="size-5" />
              </span>

              <div>
                <CardTitle className="text-base">
                  Vendor Proposals
                </CardTitle>

                <p className="mt-1 text-xs text-muted-foreground">
                  Upload one proposal document for each vendor
                </p>
              </div>

            </div>

            <span className="text-xs font-medium text-muted-foreground">
              {proposals.length > 0
                ? `${proposals.length} proposal${
                    proposals.length > 1
                      ? 's'
                      : ''
                  } uploaded`
                : 'Multiple allowed'}
            </span>

          </CardHeader>

          <CardContent className="p-6">

            <UploadDropzone
              title="Upload Vendor Proposals"
              description="PDF supported · One file per vendor"
              multiple
              files={proposals}
              onAdd={(files) =>
                setProposals(
                  (previous) => [
                    ...previous,
                    ...files,
                  ],
                )
              }
              onRemove={(id) =>
                setProposals(
                  (previous) =>
                    previous.filter(
                      (proposal) =>
                        proposal.id !== id,
                    ),
                )
              }
            />

            <div className="mt-4 flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">

              <Info className="mt-0.5 size-4 shrink-0 text-primary/70" />

              <p>
                Every proposal will be matched against the same RFP
                framework for consistent scoring, compliance review,
                and vendor comparison.
              </p>

            </div>

          </CardContent>

        </Card>

      </div>

      {error && (
        <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">

        <Button
          variant="outline"
          size="lg"
          nativeButton={false}
          render={
            <Link href="/evaluations" />
          }
        >
          Cancel
        </Button>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">

          {!canContinue && (
            <p className="text-xs text-muted-foreground">
              Upload one RFP and at least one vendor proposal to continue.
            </p>
          )}

          <Button
            size="lg"
            disabled={
              !canContinue ||
              submitting
            }
            onClick={
              handleContinue
            }
          >
            {submitting
              ? 'Evaluating Proposals…'
              : (
                  <>
                    Start Evaluation
                    <ArrowRight className="size-4" />
                  </>
                )}
          </Button>

        </div>

      </div>

    </div>
  )
}