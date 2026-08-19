interface HeroBannerProps {
  backgroundImage?: string
}

export function HeroBanner({
  backgroundImage = '/images/portal-hero.png',
}: HeroBannerProps) {
  return (
    <section
      className="relative w-full overflow-hidden text-white"
      style={{
        aspectRatio: '1741 / 288',
        backgroundColor: '#161F56',
      }}
    >
      <img
        src={backgroundImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain"
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(22,31,86,0.10) 0%, rgba(22,31,86,0.05) 50%, rgba(22,31,86,0.02) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex h-full items-center">
        <div className="ml-[14%] w-[50%] max-w-[800px]">
          <h1 className="text-2xl font-semibold leading-[1.25] tracking-tight text-white sm:text-3xl lg:text-[34px]">
            Proposal Evaluation Portal
          </h1>

          <p className="mt-4 max-w-[740px] text-sm leading-7 text-white/85 sm:text-[15px] lg:text-base">
            Analyze RFPs, compare vendor proposals, assess compliance,
            and review evaluation outcomes through an AI-assisted
            procurement workflow.
          </p>
        </div>
      </div>
    </section>
  )
}