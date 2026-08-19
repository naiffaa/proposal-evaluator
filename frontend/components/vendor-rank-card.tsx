'use client'

import Link from 'next/link'

import {
  ArrowUpRight,
  Ban,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { RiskBadge } from '@/components/domain-badges'
import { ScoreBar } from '@/components/score-progress'

import { formatPercent } from '@/lib/labels'
import { useLanguage } from '@/lib/i18n/context'

import type { Vendor } from '@/lib/types'


export function VendorRankCard({
  vendor,
  href,
}: {
  vendor: Vendor
  href: string
}) {
  const {
    isArabic,
  } = useLanguage()


  const isTop =
    vendor.rank === 1 &&
    vendor.eligible


  return (
    <Link
      href={href}
      className={cn(
        `
          group
          block
          rounded-xl
          border
          bg-card
          p-5
          transition-all
          hover:border-ring/40
          hover:shadow-sm
        `,

        isTop
          ? 'border-secondary/40 ring-1 ring-secondary/20'
          : 'border-border',
      )}
    >

      <div className="flex items-start gap-4">

        {/* RANK */}

        <div
          className={cn(
            `
              flex
              size-12
              shrink-0
              items-center
              justify-center
              rounded-lg
              text-lg
              font-semibold
              tabular-nums
            `,

            isTop
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {vendor.rank}
        </div>


        <div className="min-w-0 flex-1">

          {/* HEADER */}

          <div className="flex flex-wrap items-center gap-2">

            <h3 className="font-semibold text-foreground">
              {vendor.name}
            </h3>


            {isTop && (
              <span
                className="
                  inline-flex
                  items-center
                  gap-1
                  rounded
                  bg-secondary/10
                  px-1.5
                  py-0.5
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-secondary
                "
              >
                <TrendingUp className="size-3" />

                {isArabic
                  ? 'الأعلى ترتيبًا'
                  : 'Top Ranked'}
              </span>
            )}


            {vendor.eligible ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">

                <CheckCircle2 className="size-3.5" />

                {isArabic
                  ? 'مؤهل'
                  : 'Eligible'}

              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-destructive">

                <Ban className="size-3.5" />

                {isArabic
                  ? 'غير مؤهل'
                  : 'Ineligible'}

              </span>
            )}


            <div className="ms-auto">

              <RiskBadge
                risk={
                  vendor.riskLevel
                }
              />

            </div>

          </div>


          {/* SUMMARY */}

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {vendor.summary}
          </p>


          {/* SCORES */}

          <div className="mt-4 grid grid-cols-2 gap-4">

            <ScoreBar
              label={
                isArabic
                  ? 'الدرجة الإجمالية'
                  : 'Overall Score'
              }
              value={
                vendor.overallScore
              }
            />


            <ScoreBar
              label={
                isArabic
                  ? 'الامتثال الإلزامي'
                  : 'Mandatory Compliance'
              }
              value={
                vendor.overallMandatoryCompliance
              }
            />

          </div>

        </div>

      </div>


      {/* FOOTER */}

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-3">

        <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">

          <span>
            <span className="font-medium text-foreground">
              {
                vendor.strengths
                  .length
              }
            </span>{' '}

            {isArabic
              ? 'نقاط قوة'
              : 'strengths'}
          </span>


          <span>
            <span className="font-medium text-foreground">
              {
                vendor.gaps
                  .length
              }
            </span>{' '}

            {isArabic
              ? 'فجوات'
              : 'gaps'}
          </span>


          <span>

            <span className="font-medium text-foreground">
              {formatPercent(
                vendor.overallScore,
                0,
              )}
            </span>{' '}

            {isArabic
              ? 'موزونة'
              : 'weighted'}

          </span>

        </div>


        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-secondary group-hover:underline">

          {isArabic
            ? 'عرض التفاصيل'
            : 'View detail'}

          <ArrowUpRight
            className={cn(
              'size-3.5',
              isArabic &&
                '-rotate-90',
            )}
          />

        </span>

      </div>

    </Link>
  )
}