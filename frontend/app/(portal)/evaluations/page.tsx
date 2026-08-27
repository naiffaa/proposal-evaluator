'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  ArrowLeft,
  ArrowRight,
  FileCheck2,
  Plus,
  Search,
  Users,
} from 'lucide-react'

import { EmptyState } from '@/components/empty-state'

import {
  RecommendationBadge,
  StatusBadge,
} from '@/components/domain-badges'

import { evaluationsApi } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import { useLanguage } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

import type {
  EvaluationSummary,
} from '@/lib/types'


export default function EvaluationsPage() {
  const router =
    useRouter()

  const {
    language,
    isArabic,
  } =
    useLanguage()


  const [
    evaluations,
    setEvaluations,
  ] =
    useState<EvaluationSummary[]>([])


  const [
    loading,
    setLoading,
  ] =
    useState(true)


  const [
    error,
    setError,
  ] =
    useState<string | null>(null)


  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState('')


  useEffect(() => {
    let active =
      true


    async function loadEvaluations() {
      try {
        setLoading(true)
        setError(null)

        const data =
          await evaluationsApi.list()


        if (!active) {
          return
        }


        setEvaluations(
          Array.isArray(data)
            ? data
            : [],
        )
      } catch (err) {
        console.error(
          'Failed to load evaluations:',
          err,
        )


        if (!active) {
          return
        }


        setEvaluations([])

        setError(
          isArabic
            ? 'تعذر تحميل سجل المنافسات. حاول مرة أخرى.'
            : err instanceof Error
              ? err.message
              : 'Failed to load competition history.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }


    loadEvaluations()


    return () => {
      active =
        false
    }
  }, [
    isArabic,
  ])


  const activeEvaluations =
    useMemo(
      () =>
        evaluations.filter(
          (
            evaluation,
          ) =>
            evaluation.status !==
            'COMPLETED',
        ).length,
      [
        evaluations,
      ],
    )


  const completedEvaluations =
    useMemo(
      () =>
        evaluations.filter(
          (
            evaluation,
          ) =>
            evaluation.status ===
            'COMPLETED',
        ).length,
      [
        evaluations,
      ],
    )


  const filteredEvaluations =
    useMemo(
      () => {
        const query =
          searchQuery
            .trim()
            .toLowerCase()


        if (!query) {
          return evaluations
        }


        return evaluations.filter(
          (
            evaluation,
          ) => {
            const name =
              evaluation.rfpName
                ?.toLowerCase() ??
              ''

            const vendor =
              evaluation.topRankedVendor
                ?.toLowerCase() ??
              ''

            const id =
              String(
                evaluation.id,
              ).toLowerCase()


            return (
              name.includes(query) ||
              vendor.includes(query) ||
              id.includes(query)
            )
          },
        )
      },
      [
        evaluations,
        searchQuery,
      ],
    )


  const ArrowIcon =
    isArabic
      ? ArrowLeft
      : ArrowRight


  if (loading) {
    return (
      <div
        className="
          min-h-screen
          bg-white
        "
      >

        <div
          className="
            mx-auto
            w-full
            max-w-[1500px]
            px-5
            py-12

            sm:px-8

            lg:px-12
          "
        >

          <div
            className="
              h-[140px]
              animate-pulse
              bg-[#F4F5F7]
            "
          />


          <div
            className="
              mt-9
              h-[500px]
              animate-pulse
              bg-[#F4F5F7]
            "
          />

        </div>

      </div>
    )
  }


  return (
    <div
      className="
        min-h-screen
        bg-white
      "
      dir={
        isArabic
          ? 'rtl'
          : 'ltr'
      }
    >

      <main
        className="
          mx-auto
          w-full
          max-w-[1500px]
          px-5
          py-12

          sm:px-8

          lg:px-12
          lg:py-14
        "
      >

        {/* ======================================= */}
        {/* PAGE HEADER */}
        {/* ======================================= */}

        <section
          className="
            flex
            flex-col
            gap-7
            border-b
            border-[#E7E9EF]
            pb-9

            lg:flex-row
            lg:items-end
            lg:justify-between
          "
        >

          <div
            className="
              max-w-[760px]
            "
          >

            <p
              className="
                text-[11px]
                font-semibold
                tracking-[0.15em]
                text-[#9466C4]
              "
            >
              {isArabic
                ? 'إدارة المنافسات'
                : 'COMPETITION MANAGEMENT'}
            </p>


            <h1
              className="
                mt-3
                text-[clamp(38px,4vw,58px)]
                font-medium
                leading-[1.05]
                tracking-[-0.04em]
                text-[#131B4F]
              "
            >
              {isArabic
                ? 'سجل المنافسات'
                : 'Competition History'}
            </h1>


            <p
              className="
                mt-4
                max-w-[680px]
                text-base
                leading-8
                text-[#687086]
              "
            >
              {isArabic
                ? 'تابع المنافسات الحالية والسابقة وافتح أي منافسة لمراجعة الموردين والنتائج.'
                : 'Track current and previous competitions and open any competition to review vendors and results.'}
            </p>

          </div>


          <Link
            href="/evaluations/new"
            className="
              inline-flex
              h-13
              shrink-0
              items-center
              justify-center
              gap-2.5
              bg-[#131B4F]
              px-6
              text-sm
              font-semibold
              text-white
              transition-all
              duration-300

              hover:-translate-y-1
              hover:shadow-[0_12px_26px_rgba(19,27,79,0.15)]
            "
          >

            <Plus
              className="
                size-4
              "
            />


            {isArabic
              ? 'إضافة منافسة'
              : 'Add Competition'}

          </Link>

        </section>


        {/* ======================================= */}
        {/* ERROR */}
        {/* ======================================= */}

        {error && (
          <div
            className="
              mt-7
              border
              border-rose-200
              bg-rose-50
              px-5
              py-4
              text-sm
              text-rose-700
            "
          >
            {error}
          </div>
        )}


        {/* ======================================= */}
        {/* LIST AREA */}
        {/* ======================================= */}

        <section
          className="
            mt-10
          "
        >

          {/* TOP AREA */}

          <div
            className="
              flex
              flex-col
              gap-5

              xl:flex-row
              xl:items-center
              xl:justify-between
            "
          >

            {/* TITLE + MINI STATS */}

            <div>

              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-x-5
                  gap-y-3
                "
              >

                <h2
                  className="
                    text-[26px]
                    font-medium
                    tracking-[-0.025em]
                    text-[#131B4F]
                  "
                >
                  {isArabic
                    ? 'جميع المنافسات'
                    : 'All Competitions'}
                </h2>


                {/* TOTAL */}

                <div
                  className="
                    flex
                    items-center
                    gap-2
                    border-s
                    border-[#E1E4EA]
                    ps-5
                  "
                >

                  <span
                    className="
                      size-2
                      rounded-full
                      bg-[#131B4F]
                    "
                  />

                  <span
                    className="
                      text-xs
                      text-[#6F7789]
                    "
                  >
                    {isArabic
                      ? 'الإجمالي'
                      : 'Total'}
                  </span>


                  <span
                    className="
                      text-sm
                      font-semibold
                      text-[#131B4F]
                    "
                  >
                    {
                      evaluations.length
                    }
                  </span>

                </div>


                {/* ACTIVE */}

                <div
                  className="
                    flex
                    items-center
                    gap-2
                  "
                >

                  <span
                    className="
                      size-2
                      rounded-full
                      bg-[#EDB27A]
                    "
                  />

                  <span
                    className="
                      text-xs
                      text-[#6F7789]
                    "
                  >
                    {isArabic
                      ? 'قيد التقييم'
                      : 'Active'}
                  </span>


                  <span
                    className="
                      text-sm
                      font-semibold
                      text-[#131B4F]
                    "
                  >
                    {
                      activeEvaluations
                    }
                  </span>

                </div>


                {/* COMPLETED */}

                <div
                  className="
                    flex
                    items-center
                    gap-2
                  "
                >

                  <span
                    className="
                      size-2
                      rounded-full
                      bg-[#5FAC81]
                    "
                  />

                  <span
                    className="
                      text-xs
                      text-[#6F7789]
                    "
                  >
                    {isArabic
                      ? 'مكتملة'
                      : 'Completed'}
                  </span>


                  <span
                    className="
                      text-sm
                      font-semibold
                      text-[#131B4F]
                    "
                  >
                    {
                      completedEvaluations
                    }
                  </span>

                </div>

              </div>


              <p
                className="
                  mt-2
                  text-sm
                  leading-6
                  text-[#808797]
                "
              >
                {isArabic
                  ? 'افتح المنافسة لمراجعة المتطلبات والموردين والمقارنة والنتائج.'
                  : 'Open a competition to review requirements, vendors, comparison, and results.'}
              </p>

            </div>


            {/* SEARCH */}

            <div
              className="
                relative
                w-full

                xl:w-[340px]
              "
            >

              <Search
                className="
                  absolute
                  start-4
                  top-1/2
                  size-4
                  -translate-y-1/2
                  text-[#9097A7]
                "
              />


              <input
                type="search"
                value={
                  searchQuery
                }
                onChange={
                  (
                    event,
                  ) =>
                    setSearchQuery(
                      event.target.value,
                    )
                }
                placeholder={
                  isArabic
                    ? 'ابحث باسم المنافسة أو المورد'
                    : 'Search competition or vendor'
                }
                className="
                  h-12
                  w-full
                  border
                  border-[#DCE0E8]
                  bg-white
                  ps-11
                  pe-4
                  text-sm
                  text-[#131B4F]
                  outline-none
                  transition-all

                  placeholder:text-[#A0A6B2]

                  focus:border-[#131B4F]
                  focus:shadow-[0_0_0_3px_rgba(19,27,79,0.05)]
                "
              />

            </div>

          </div>


          {/* ===================================== */}
          {/* TABLE */}
          {/* ===================================== */}

          <div
            className="
              mt-6
              overflow-hidden
              border
              border-[#E3E6ED]
              bg-white
            "
          >

            {evaluations.length === 0 ? (

              <div
                className="
                  p-8

                  sm:p-12
                "
              >

                <EmptyState
                  icon={
                    FileCheck2
                  }
                  title={
                    error
                      ? isArabic
                        ? 'تعذر تحميل المنافسات'
                        : 'Unable to load competitions'
                      : isArabic
                        ? 'ما عندك منافسات حتى الآن'
                        : 'No competitions yet'
                  }
                  description={
                    error
                      ? isArabic
                        ? 'تعذر تحميل سجل المنافسات من النظام.'
                        : 'The competition list could not be loaded from the API.'
                      : isArabic
                        ? 'أضف أول منافسة وارفع مستند المنافسة وعروض الموردين حتى تبدأ التقييم.'
                        : 'Add your first competition and upload its document and vendor proposals to begin the evaluation.'
                  }
                  action={
                    <Link
                      href="/evaluations/new"
                      className="
                        inline-flex
                        h-11
                        items-center
                        justify-center
                        gap-2
                        bg-[#131B4F]
                        px-5
                        text-sm
                        font-semibold
                        text-white
                      "
                    >
                      <Plus
                        className="
                          size-4
                        "
                      />

                      {isArabic
                        ? 'إضافة منافسة'
                        : 'Add Competition'}
                    </Link>
                  }
                />

              </div>

            ) : filteredEvaluations.length === 0 ? (

              <div
                className="
                  flex
                  min-h-[260px]
                  flex-col
                  items-center
                  justify-center
                  px-6
                  text-center
                "
              >

                <div
                  className="
                    flex
                    size-11
                    items-center
                    justify-center
                    bg-[#F4F5F7]
                    text-[#131B4F]
                  "
                >

                  <Search
                    className="
                      size-5
                    "
                  />

                </div>


                <h3
                  className="
                    mt-4
                    text-lg
                    font-semibold
                    text-[#131B4F]
                  "
                >
                  {isArabic
                    ? 'ما لقينا منافسة مطابقة'
                    : 'No matching competition'}
                </h3>


                <p
                  className="
                    mt-2
                    text-sm
                    text-[#818898]
                  "
                >
                  {isArabic
                    ? 'جرّب كلمة بحث مختلفة.'
                    : 'Try a different search term.'}
                </p>

              </div>

            ) : (

              <div
                className="
                  overflow-x-auto
                "
              >

                <table
                  className="
                    min-w-[1080px]
                    w-full
                  "
                >

                  <thead>

                    <tr
                      className="
                        border-b
                        border-[#E7E9EF]
                        bg-[#F8F9FB]
                      "
                    >

                      <th
                        className="
                          px-6
                          py-4
                          text-start
                          text-[11px]
                          font-semibold
                          text-[#71798C]

                          sm:px-7
                        "
                      >
                        {isArabic
                          ? 'المنافسة'
                          : 'Competition'}
                      </th>


                      <th
                        className="
                          px-5
                          py-4
                          text-start
                          text-[11px]
                          font-semibold
                          text-[#71798C]
                        "
                      >
                        {isArabic
                          ? 'الموردون'
                          : 'Vendors'}
                      </th>


                      <th
                        className="
                          px-5
                          py-4
                          text-start
                          text-[11px]
                          font-semibold
                          text-[#71798C]
                        "
                      >
                        {isArabic
                          ? 'الحالة'
                          : 'Status'}
                      </th>


                      <th
                        className="
                          px-5
                          py-4
                          text-start
                          text-[11px]
                          font-semibold
                          text-[#71798C]
                        "
                      >
                        {isArabic
                          ? 'أعلى مورد'
                          : 'Top Vendor'}
                      </th>


                      <th
                        className="
                          px-5
                          py-4
                          text-start
                          text-[11px]
                          font-semibold
                          text-[#71798C]
                        "
                      >
                        {isArabic
                          ? 'التوصية'
                          : 'Recommendation'}
                      </th>


                      <th
                        className="
                          px-5
                          py-4
                          text-start
                          text-[11px]
                          font-semibold
                          text-[#71798C]
                        "
                      >
                        {isArabic
                          ? 'التاريخ'
                          : 'Date'}
                      </th>


                      <th
                        className="
                          px-6
                          py-4
                          text-end
                          text-[11px]
                          font-semibold
                          text-[#71798C]

                          sm:px-7
                        "
                      >
                        {isArabic
                          ? 'الإجراء'
                          : 'Action'}
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {filteredEvaluations.map(
                      (
                        evaluation,
                        index,
                      ) => (

                        <tr
                          key={
                            evaluation.id
                          }
                          role="button"
                          tabIndex={
                            0
                          }
                          onClick={
                            () =>
                              router.push(
                                `/evaluations/${evaluation.id}`,
                              )
                          }
                          onKeyDown={
                            (
                              event,
                            ) => {
                              if (
                                event.key ===
                                  'Enter' ||
                                event.key ===
                                  ' '
                              ) {
                                event.preventDefault()

                                router.push(
                                  `/evaluations/${evaluation.id}`,
                                )
                              }
                            }
                          }
                          className={cn(
                            `
                              group
                              cursor-pointer
                              transition-colors
                              duration-200

                              hover:bg-[#FAFAFB]

                              focus-visible:outline-none
                              focus-visible:ring-2
                              focus-visible:ring-inset
                              focus-visible:ring-[#131B4F]/20
                            `,
                            index !==
                              filteredEvaluations.length -
                                1 &&
                              `
                                border-b
                                border-[#ECEEF2]
                              `,
                          )}
                        >

                          {/* COMPETITION */}

                          <td
                            className="
                              px-6
                              py-5
                              align-middle

                              sm:px-7
                            "
                          >

                            <div
                              className="
                                flex
                                min-w-[280px]
                                items-center
                                gap-4
                              "
                            >

                              <div
                                className="
                                  flex
                                  size-9
                                  shrink-0
                                  items-center
                                  justify-center
                                  bg-[#F3F4F7]
                                  text-[#131B4F]
                                  transition-colors
                                  duration-300

                                  group-hover:bg-[#131B4F]
                                  group-hover:text-white
                                "
                              >

                                <FileCheck2
                                  className="
                                    size-4
                                  "
                                />

                              </div>


                              <div>

                                <p
                                  className="
                                    text-sm
                                    font-semibold
                                    leading-6
                                    text-[#131B4F]
                                  "
                                >
                                  {
                                    evaluation.rfpName
                                  }
                                </p>


                                <p
                                  className="
                                    mt-0.5
                                    text-xs
                                    text-[#979DAA]
                                  "
                                >
                                  {isArabic
                                    ? 'تقييم عروض الموردين'
                                    : 'Vendor proposal evaluation'}
                                </p>

                              </div>

                            </div>

                          </td>


                          {/* VENDORS */}

                          <td
                            className="
                              px-5
                              py-5
                              align-middle
                            "
                          >

                            <div
                              className="
                                flex
                                items-center
                                gap-2
                              "
                            >

                              <Users
                                className="
                                  size-4
                                  text-[#9098A9]
                                "
                              />


                              <span
                                className="
                                  text-sm
                                  font-semibold
                                  text-[#131B4F]
                                "
                              >
                                {
                                  evaluation.vendorCount
                                }
                              </span>

                            </div>

                          </td>


                          {/* STATUS */}

                          <td
                            className="
                              px-5
                              py-5
                              align-middle
                            "
                          >

                            <StatusBadge
                              status={
                                evaluation.status
                              }
                            />

                          </td>


                          {/* TOP VENDOR */}

                          <td
                            className="
                              px-5
                              py-5
                              align-middle
                            "
                          >

                            <p
                              className="
                                min-w-[140px]
                                text-sm
                                font-medium
                                text-[#30394F]
                              "
                            >
                              {
                                evaluation.topRankedVendor ??
                                '—'
                              }
                            </p>

                          </td>


                          {/* RECOMMENDATION */}

                          <td
                            className="
                              px-5
                              py-5
                              align-middle
                            "
                          >

                            {evaluation.recommendationStatus ? (

                              <RecommendationBadge
                                status={
                                  evaluation.recommendationStatus
                                }
                              />

                            ) : (

                              <span
                                className="
                                  text-sm
                                  text-[#9AA0AE]
                                "
                              >
                                —
                              </span>

                            )}

                          </td>


                          {/* DATE */}

                          <td
                            className="
                              px-5
                              py-5
                              align-middle
                            "
                          >

                            <p
                              className="
                                whitespace-nowrap
                                text-sm
                                text-[#626B7D]
                              "
                            >
                              {formatDate(
                                evaluation.createdDate,
                                language,
                              )}
                            </p>

                          </td>


                          {/* ACTION */}

                          <td
                            className="
                              px-6
                              py-5
                              text-end
                              align-middle

                              sm:px-7
                            "
                          >

                            <div
                              className="
                                inline-flex
                                items-center
                                gap-2
                                text-sm
                                font-semibold
                                text-[#131B4F]
                              "
                            >

                              <span>
                                {isArabic
                                  ? 'فتح'
                                  : 'Open'}
                              </span>


                              <ArrowIcon
                                className="
                                  size-4
                                  transition-transform
                                  duration-300

                                  group-hover:-translate-x-1
                                "
                              />

                            </div>

                          </td>

                        </tr>
                      ),
                    )}

                  </tbody>

                </table>

              </div>
            )}

          </div>

        </section>

      </main>

    </div>
  )
}