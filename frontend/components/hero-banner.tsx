'use client'

import { useLanguage } from '@/lib/i18n/context'


interface HeroBannerProps {
  backgroundImage?: string
}


export function HeroBanner({
  backgroundImage = '/images/portal-hero.png',
}: HeroBannerProps) {
  const {
    isArabic,
  } = useLanguage()


  return (
    <section
      className="relative w-full overflow-hidden text-white"
      style={{
        aspectRatio: '1741 / 288',
        backgroundColor: '#161F56',
      }}
    >
      {/* ===================================== */}
      {/* BACKGROUND IMAGE */}
      {/* SAME FOR ARABIC + ENGLISH */}
      {/* ===================================== */}

      <img
        src={backgroundImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain"
      />


      {/* ===================================== */}
      {/* OVERLAY */}
      {/* DO NOT FLIP IN ARABIC */}
      {/* ===================================== */}

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(22,31,86,0.10) 0%, rgba(22,31,86,0.05) 50%, rgba(22,31,86,0.02) 100%)',
        }}
        aria-hidden="true"
      />


      {/* ===================================== */}
      {/* CONTENT */}
      {/* ===================================== */}

      <div className="relative z-10 flex h-full items-center">

        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className={`
            w-[50%]
            max-w-[800px]

            ${
              isArabic
                ? `
                  ml-auto
                  mr-[17%]
                  translate-y-2
                  text-right
                `
                : `
                  ml-[14%]
                  text-left
                `
            }
          `}
        >

          {/* ================================= */}
          {/* TITLE */}
          {/* ================================= */}

          <h1 className="text-2xl font-semibold leading-[1.25] tracking-tight text-white sm:text-3xl lg:text-[34px]">
            {isArabic
              ? 'بوابة تقييم العروض'
              : 'Proposal Evaluation Portal'}
          </h1>


          {/* ================================= */}
          {/* DESCRIPTION */}
          {/* ================================= */}

          <p
            className={`
              mt-4
              text-sm
              leading-7
              text-white/85
              sm:text-[15px]
              lg:text-base

              ${
                isArabic
                  ? 'max-w-[680px]'
                  : 'max-w-[740px]'
              }
            `}
          >
            {isArabic
              ? 'حلّل طلبات العروض، وقارن عروض الموردين، وقيّم الامتثال، وراجع نتائج التقييم من خلال سير عمل للمشتريات مدعوم بالذكاء الاصطناعي.'
              : 'Analyze RFPs, compare vendor proposals, assess compliance, and review evaluation outcomes through an AI-assisted procurement workflow.'}
          </p>

        </div>

      </div>

    </section>
  )
}