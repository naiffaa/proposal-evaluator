import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileSearch,
  GitCompareArrows,
  Plus,
} from 'lucide-react'

import { HeroBanner } from '@/components/hero-banner'


export default function HomePage() {
  const quickAccess = [
    {
      title: 'RFP Analysis',
      description:
        'Analyze an RFP and extract evaluation criteria, requirements, weights, and mandatory items.',
      href: '/rfp-analysis',
      icon: FileSearch,
    },
    {
      title: 'Evaluate Proposals',
      description:
        'Match vendor proposals against RFP requirements and generate evidence-based scores.',
      href: '/evaluations/new',
      icon: ClipboardCheck,
    },
    {
      title: 'Vendor Comparison',
      description:
        'Compare vendors across scoring, compliance, strengths, gaps, and overall ranking.',
      href: '/comparison',
      icon: GitCompareArrows,
    },
    {
      title: 'Evaluation Reports',
      description:
        'Review evaluation outcomes, recommendations, risks, and procurement reports.',
      href: '/reports',
      icon: BarChart3,
    },
  ]

  return (
    <div className="w-full">

      {/* ========================================= */}
      {/* HERO */}
      {/* ========================================= */}

      <HeroBanner />

      {/* ========================================= */}
      {/* PAGE CONTENT */}
      {/* ========================================= */}

      <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">

        {/* ======================================= */}
        {/* QUICK ACCESS */}
        {/* ======================================= */}

        <section>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
              Quick Access
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Everything you need in one place
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Manage the complete RFP and proposal evaluation process — from
              requirement analysis and proposal matching to compliance,
              comparison, scoring, and final reporting.
            </p>
          </div>

          {/* ===================================== */}
          {/* QUICK ACCESS CARDS */}
          {/* ===================================== */}

          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

            {quickAccess.map((item, index) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group"
                >
                  <div
                    className={`
                      relative
                      flex
                      h-full
                      min-h-[220px]
                      flex-col
                      border
                      bg-white
                      p-5
                      transition-all
                      duration-200
                      hover:-translate-y-0.5
                      hover:border-primary/35
                      hover:shadow-[0_10px_28px_rgba(22,31,86,0.10)]
                      ${
                        index === 1
                          ? 'border-primary/25'
                          : 'border-border'
                      }
                    `}
                  >
                    {/* Icon */}

                    <div className="flex size-11 items-center justify-center bg-primary/[0.06] text-primary">
                      <Icon className="size-5" />
                    </div>

                    {/* Title */}

                    <h3 className="mt-5 text-[15px] font-semibold text-primary">
                      {item.title}
                    </h3>

                    {/* Description */}

                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>

                    {/* Arrow */}

                    <div className="mt-auto pt-5">
                      <ArrowRight className="size-4 text-primary transition-transform duration-200 group-hover:translate-x-1" />
                    </div>

                  </div>
                </Link>
              )
            })}

          </div>

          {/* ===================================== */}
          {/* MAIN CTA */}
          {/* ===================================== */}

          <div className="mt-5 bg-primary px-6 py-6 text-white sm:px-8">

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              {/* CTA content */}

              <div className="flex items-start gap-4">

                <div className="flex size-11 shrink-0 items-center justify-center bg-white/10">
                  <Plus className="size-5" />
                </div>

                <div>
                  <h3 className="text-base font-semibold">
                    Start a New Proposal Evaluation
                  </h3>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-white/70">
                    Upload an RFP and one or more vendor proposals to begin
                    requirement matching, compliance assessment, scoring,
                    ranking, and recommendation.
                  </p>
                </div>

              </div>

              {/* CTA button */}

              <Link
                href="/evaluations/new"
                className="
                  inline-flex
                  h-11
                  shrink-0
                  items-center
                  justify-center
                  gap-2
                  bg-white
                  px-5
                  text-sm
                  font-semibold
                  text-primary
                  transition-colors
                  hover:bg-white/90
                "
              >
                Start Evaluation
                <ArrowRight className="size-4" />
              </Link>

            </div>

          </div>

        </section>

      </div>

    </div>
  )
}