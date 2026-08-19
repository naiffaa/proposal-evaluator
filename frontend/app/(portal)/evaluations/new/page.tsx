'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileCheck2,
  FileText,
  Files,
  LoaderCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  UploadDropzone,
  type UploadedFile,
} from '@/components/upload-dropzone'

import { evaluationsApi } from '@/lib/api'


const STEPS = [
  {
    number: 1,
    title: 'Upload RFP',
    description: 'Add the RFP document.',
  },
  {
    number: 2,
    title: 'Upload Proposals',
    description: 'Add one or more vendor proposals.',
  },
  {
    number: 3,
    title: 'Review & Submit',
    description: 'Confirm the documents and start the evaluation.',
  },
]


export default function NewEvaluationPage() {
  const router = useRouter()

  const [currentStep, setCurrentStep] =
    useState(0)

  const [transitioning, setTransitioning] =
    useState(false)

  const [rfp, setRfp] =
    useState<UploadedFile[]>([])

  const [proposals, setProposals] =
    useState<UploadedFile[]>([])

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)


  const hasRfp =
    rfp.length === 1

  const hasProposals =
    proposals.length >= 1


  function changeStep(nextStep: number) {
    if (
      nextStep === currentStep ||
      transitioning
    ) {
      return
    }

    setError(null)
    setTransitioning(true)

    window.setTimeout(() => {
      setCurrentStep(nextStep)

      window.requestAnimationFrame(() => {
        setTransitioning(false)
      })
    }, 160)
  }


  function goToStep(step: number) {
    changeStep(step)
  }


  function handleNext() {
    if (
      currentStep === 0 &&
      !hasRfp
    ) {
      return
    }

    if (
      currentStep === 1 &&
      !hasProposals
    ) {
      return
    }

    const nextStep =
      Math.min(
        currentStep + 1,
        STEPS.length - 1,
      )

    changeStep(nextStep)
  }


  function handleBack() {
    const previousStep =
      Math.max(
        currentStep - 1,
        0,
      )

    changeStep(previousStep)
  }


  async function handleSubmit() {
    if (
      !hasRfp ||
      !hasProposals ||
      submitting
    ) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response =
        await evaluationsApi.runEvaluation({
          rfp: rfp[0].file,

          proposals: proposals.map(
            (proposal) =>
              proposal.file,
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
    <div className="mx-auto w-full max-w-[1380px] px-4 py-8 md:px-6 lg:py-10">

      {/* PAGE INTRO */}

      <div className="mb-7">

        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/60">
          Proposal Evaluation
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          New Evaluation
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Add the required documents, review them, and start the evaluation.
        </p>

      </div>


      {/* WIZARD */}

      <div
        className="
          grid
          min-h-[640px]
          overflow-hidden
          rounded-2xl
          border
          border-border
          bg-white
          shadow-[0_12px_40px_rgba(22,31,86,0.07)]
          lg:grid-cols-[300px_minmax(0,1fr)]
        "
      >

        {/* LEFT PANEL */}

        <aside className="relative bg-[#161F56] px-8 py-10 text-white">

          <div className="relative z-10 flex h-full flex-col">

            <div>

              <h2 className="text-lg font-semibold">
                Evaluation Setup
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/55">
                Complete each step before starting the proposal evaluation.
              </p>

            </div>


            {/* STEPS */}

            <div className="mt-10">

              {STEPS.map(
                (step, index) => {
                  const active =
                    index === currentStep

                  const completed =
                    index < currentStep

                  const accessible =
                    index === 0 ||
                    (
                      index === 1 &&
                      hasRfp
                    ) ||
                    (
                      index === 2 &&
                      hasRfp &&
                      hasProposals
                    )


                  return (
                    <button
                      key={step.number}
                      type="button"
                      disabled={
                        !accessible ||
                        transitioning
                      }
                      onClick={() => {
                        if (accessible) {
                          goToStep(index)
                        }
                      }}
                      className="
                        relative
                        flex
                        w-full
                        gap-4
                        pb-10
                        text-left
                        last:pb-0
                        disabled:cursor-default
                      "
                    >

                      {/* CONNECTOR */}

                      {index <
                        STEPS.length - 1 && (
                        <div
                          className={`
                            absolute
                            left-[17px]
                            top-10
                            h-[calc(100%-28px)]
                            w-px
                            transition-colors
                            duration-300

                            ${
                              completed
                                ? 'bg-white/70'
                                : 'bg-white/15'
                            }
                          `}
                        />
                      )}


                      {/* STEP NUMBER */}

                      <div
                        className={`
                          relative
                          z-10
                          flex
                          size-9
                          shrink-0
                          items-center
                          justify-center
                          rounded-full
                          border
                          text-sm
                          font-semibold
                          transition-all
                          duration-300

                          ${
                            completed
                              ? 'border-white bg-white text-[#161F56]'
                              : active
                                ? 'border-white bg-white text-[#161F56] shadow-[0_5px_18px_rgba(0,0,0,0.18)]'
                                : 'border-white/25 bg-transparent text-white/50'
                          }
                        `}
                      >
                        {completed ? (
                          <Check className="size-4" />
                        ) : (
                          step.number
                        )}
                      </div>


                      {/* STEP TEXT */}

                      <div className="pt-0.5">

                        <p
                          className={`
                            text-sm
                            transition-colors
                            duration-300

                            ${
                              active
                                ? 'font-semibold text-white'
                                : completed
                                  ? 'font-medium text-white/85'
                                  : 'font-medium text-white/45'
                            }
                          `}
                        >
                          {step.title}
                        </p>

                        <p
                          className={`
                            mt-1
                            text-xs
                            leading-5
                            transition-colors
                            duration-300

                            ${
                              active
                                ? 'text-white/55'
                                : completed
                                  ? 'text-white/45'
                                  : 'text-white/25'
                            }
                          `}
                        >
                          {step.description}
                        </p>

                      </div>

                    </button>
                  )
                },
              )}

            </div>


            <div className="mt-auto border-t border-white/10 pt-5 text-xs leading-5 text-white/40">
              The evaluation begins only after you review and submit
              the selected documents.
            </div>

          </div>

        </aside>


        {/* RIGHT PANEL */}

        <main className="flex min-w-0 flex-col">

          {/* STEP CONTENT */}

          <div className="relative flex-1 overflow-hidden">

            <div
              className={`
                px-6
                py-8
                transition-all
                duration-200
                ease-out
                sm:px-8
                lg:px-10

                ${
                  transitioning
                    ? 'translate-x-2 opacity-0'
                    : 'translate-x-0 opacity-100'
                }
              `}
            >

              {currentStep === 0 && (
                <StepOne
                  rfp={rfp}
                  setRfp={setRfp}
                />
              )}


              {currentStep === 1 && (
                <StepTwo
                  proposals={proposals}
                  setProposals={setProposals}
                />
              )}


              {currentStep === 2 && (
                <StepThree
                  rfp={rfp}
                  proposals={proposals}
                  onEditRfp={() =>
                    goToStep(0)
                  }
                  onEditProposals={() =>
                    goToStep(1)
                  }
                />
              )}


              {error && (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

            </div>

          </div>


          {/* FOOTER */}

          <div
            className="
              flex
              items-center
              justify-between
              gap-4
              border-t
              border-border
              bg-slate-50/45
              px-6
              py-5
              sm:px-8
              lg:px-10
            "
          >

            {/* LEFT */}

            {currentStep === 0 ? (
              <Button
                variant="ghost"
                size="lg"
                nativeButton={false}
                render={
                  <Link href="/evaluations" />
                }
                className="text-muted-foreground"
              >
                Cancel
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="lg"
                onClick={
                  handleBack
                }
                disabled={
                  submitting ||
                  transitioning
                }
                className="gap-2 text-muted-foreground"
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>
            )}


            {/* RIGHT */}

            {currentStep < 2 ? (
              <Button
                size="lg"
                onClick={
                  handleNext
                }
                disabled={
                  transitioning ||
                  (
                    currentStep === 0
                      ? !hasRfp
                      : !hasProposals
                  )
                }
                className="min-w-[150px]"
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={
                  handleSubmit
                }
                disabled={
                  !hasRfp ||
                  !hasProposals ||
                  submitting ||
                  transitioning
                }
                className="min-w-[210px]"
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    Start Evaluation
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            )}

          </div>

        </main>

      </div>

    </div>
  )
}


/* STEP 1 */

function StepOne({
  rfp,
  setRfp,
}: {
  rfp: UploadedFile[]
  setRfp: React.Dispatch<
    React.SetStateAction<UploadedFile[]>
  >
}) {
  return (
    <div className="mx-auto max-w-3xl">

      <StepHeader
        number={1}
        title="Upload RFP"
        description="Upload the RFP document that defines the evaluation requirements and criteria."
      />


      <div className="mt-8">

        <div className="mb-4 flex items-center gap-3">

          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/[0.06] text-primary">
            <FileCheck2 className="size-5" />
          </span>

          <div>

            <h3 className="text-sm font-semibold text-slate-900">
              RFP Document
            </h3>

            <p className="mt-0.5 text-xs text-muted-foreground">
              One PDF document is required
            </p>

          </div>

        </div>


        <UploadDropzone
          title="Upload RFP"
          description="PDF - Maximum 50 MB"
          files={rfp}
          onAdd={(files) =>
            setRfp(files)
          }
          onRemove={() =>
            setRfp([])
          }
        />


        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-4">

          <p className="text-xs font-semibold text-slate-700">
            What happens next?
          </p>

          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            The system will use this document to identify evaluation
            criteria, requirements, mandatory items, and scoring weights.
          </p>

        </div>

      </div>

    </div>
  )
}


/* STEP 2 */

function StepTwo({
  proposals,
  setProposals,
}: {
  proposals: UploadedFile[]
  setProposals: React.Dispatch<
    React.SetStateAction<UploadedFile[]>
  >
}) {
  return (
    <div className="mx-auto max-w-3xl">

      <StepHeader
        number={2}
        title="Upload Vendor Proposals"
        description="Add the proposals that will be evaluated against the RFP."
      />


      <div className="mt-8">

        <div className="mb-4 flex items-center justify-between gap-4">

          <div className="flex items-center gap-3">

            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/[0.06] text-primary">
              <Files className="size-5" />
            </span>

            <div>

              <h3 className="text-sm font-semibold text-slate-900">
                Vendor Proposals
              </h3>

              <p className="mt-0.5 text-xs text-muted-foreground">
                Upload one PDF for each vendor
              </p>

            </div>

          </div>


          {proposals.length > 0 && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              {proposals.length} uploaded
            </span>
          )}

        </div>


        <UploadDropzone
          title="Upload Vendor Proposals"
          description="PDF - Multiple files allowed"
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


        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-4">

          <p className="text-xs font-semibold text-slate-700">
            Consistent evaluation
          </p>

          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Every proposal will be evaluated against the same extracted
            RFP framework to ensure consistent scoring and comparison.
          </p>

        </div>

      </div>

    </div>
  )
}


/* STEP 3 */

function StepThree({
  rfp,
  proposals,
  onEditRfp,
  onEditProposals,
}: {
  rfp: UploadedFile[]
  proposals: UploadedFile[]
  onEditRfp: () => void
  onEditProposals: () => void
}) {
  return (
    <div className="mx-auto max-w-3xl">

      <StepHeader
        number={3}
        title="Review & Submit"
        description="Confirm the selected documents before starting the evaluation."
      />


      <div className="mt-8 space-y-5">

        <ReviewSection
          title="RFP Document"
          count="1 document"
          icon={FileCheck2}
          onEdit={onEditRfp}
        >

          {rfp.map((file) => (
            <ReviewFile
              key={file.id}
              file={file}
            />
          ))}

        </ReviewSection>


        <ReviewSection
          title="Vendor Proposals"
          count={`${proposals.length} proposal${
            proposals.length === 1
              ? ''
              : 's'
          }`}
          icon={Files}
          onEdit={onEditProposals}
        >

          <div className="divide-y divide-border">

            {proposals.map(
              (file) => (
                <ReviewFile
                  key={file.id}
                  file={file}
                />
              ),
            )}

          </div>

        </ReviewSection>


        <div
          className="
            flex
            items-start
            gap-3
            rounded-xl
            border
            border-emerald-200
            bg-emerald-50/70
            px-4
            py-4
          "
        >

          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />

          <div>

            <p className="text-sm font-semibold text-emerald-900">
              Ready to evaluate
            </p>

            <p className="mt-1 text-xs leading-5 text-emerald-800/70">
              The RFP will be analyzed first, then every vendor proposal
              will be evaluated against the same extracted framework.
            </p>

          </div>

        </div>

      </div>

    </div>
  )
}


/* SHARED */

function StepHeader({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4">

      <span
        className="
          flex
          size-10
          shrink-0
          items-center
          justify-center
          rounded-full
          bg-primary
          text-sm
          font-semibold
          text-white
        "
      >
        {number}
      </span>


      <div>

        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>

        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {description}
        </p>

      </div>

    </div>
  )
}


function ReviewSection({
  title,
  count,
  icon: Icon,
  onEdit,
  children,
}: {
  title: string
  count: string
  icon: typeof FileText
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">

      <div className="flex items-center justify-between border-b border-border bg-slate-50/60 px-4 py-3.5">

        <div className="flex items-center gap-3">

          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/[0.06] text-primary">
            <Icon className="size-4" />
          </span>

          <div>

            <p className="text-sm font-semibold text-slate-900">
              {title}
            </p>

            <p className="mt-0.5 text-xs text-muted-foreground">
              {count}
            </p>

          </div>

        </div>


        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-semibold text-primary transition-colors hover:text-primary/70"
        >
          Edit
        </button>

      </div>


      <div>
        {children}
      </div>

    </div>
  )
}


function ReviewFile({
  file,
}: {
  file: UploadedFile
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">

      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
        <FileText className="size-4" />
      </span>


      <div className="min-w-0 flex-1">

        <p className="truncate text-sm font-medium text-slate-900">
          {file.name}
        </p>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatSize(file.size)}
        </p>

      </div>


      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />

    </div>
  )
}


function formatSize(
  bytes: number,
) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(0)} KB`
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`
}