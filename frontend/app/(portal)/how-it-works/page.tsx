'use client'

import {
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import Link from 'next/link'

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  FileCheck2,
  GitCompareArrows,
  ShieldCheck,
} from 'lucide-react'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

import { useLanguage } from '@/lib/i18n/context'


gsap.registerPlugin(ScrollTrigger)


const COLORS = {
  navy: '#131B4F',

  beige: '#CDB78F',
  beigeLight: '#DFD2B8',
  beigeSoft: '#F1ECE0',
  cream: '#F7F3E9',

  blue: '#1D208E',
  blue2: '#1F2BB4',

  green: '#5FAC81',
  purple: '#9466C4',
  orange: '#EDB27A',
  yellow: '#ECD36D',

  muted: '#65708D',
}


const content = {
  ar: {
    hero: {
      eyebrow:
        'كيف تعمل البوابة',

      title:
        'من مستند المنافسة إلى صورة أوضح للقرار',

      description:
        'رحلة مترابطة تجمع مستندات المنافسة، وتحليل المتطلبات، ومراجعة عروض الموردين، والمقارنة والامتثال في مكان واحد.',

      cta:
        'إضافة منافسة',
    },


    why: {
      eyebrow:
        'ليش البوابة؟',

      title:
        'مراجعة أقل تشتتًا، ومقارنة أوضح',

      description:
        'بدل التنقل بين الملفات والجداول والملاحظات، ترتب البوابة رحلة التقييم وتعرض أهم المعلومات التي يحتاجها فريق المشتريات.',

      items: [
        {
          number:
            '01',

          label:
            'وقت أقل',

          title:
            'ابدأ من إطار تقييم واضح',

          description:
            'تُستخرج المعايير والمتطلبات من مستند المنافسة وتُنظم كأساس موحد لمراجعة جميع الموردين.',
        },

        {
          number:
            '02',

          label:
            'مقارنة أوضح',

          title:
            'شوف الفرق بين الموردين مباشرة',

          description:
            'الدرجات والامتثال ونقاط القوة والفجوات تظهر بشكل يساعد على المقارنة بدون الرجوع لكل عرض بشكل منفصل.',
        },

        {
          number:
            '03',

          label:
            'مراجعة أدق',

          title:
            'اعرف وين تحتاج تتوقف وتراجع',

          description:
            'المتطلبات الإلزامية وحالات عدم الاستيفاء والمخاطر تظهر بوضوح قبل الوصول إلى القرار النهائي.',
        },
      ],
    },


    journey: {
      eyebrow:
        'رحلة المنافسة',

      title:
        'من أول مستند إلى نتيجة قابلة للمراجعة',

      description:
        'كل خطوة تبني على اللي قبلها، بحيث يظل مسار التقييم واضح من بداية المنافسة إلى مقارنة الموردين ومراجعة النتيجة.',

      steps: [
        {
          number:
            '01',

          kicker:
            'البداية',

          title:
            'أضف المنافسة وارفع المستندات',

          description:
            'ابدأ بمستند المنافسة، ثم أضف عروض الموردين المراد مراجعتها داخل نفس المسار.',

          note:
            'تبدأ رحلة التقييم من المستندات نفسها التي يعمل عليها فريق المشتريات.',

          image:
            '/images/how-it-works/add-competition.png',

          accent:
            COLORS.blue,
        },

        {
          number:
            '02',

          kicker:
            'إطار التقييم',

          title:
            'تتضح المعايير والأوزان',

          description:
            'تحلل البوابة مستند المنافسة وتستخرج المعايير والأوزان والمتطلبات والبنود الإلزامية.',

          note:
            'كل مورد يتم تقييمه على نفس الأساس ونفس متطلبات المنافسة.',

          image:
            '/images/how-it-works/criteria.png',

          accent:
            COLORS.purple,
        },

        {
          number:
            '03',

          kicker:
            'تحليل العروض',

          title:
            'كل مورد يُراجع على نفس الأساس',

          description:
            'يرتبط محتوى كل عرض بالمتطلبات ذات العلاقة، ثم تظهر المطابقة والامتثال والدرجة والمخاطر.',

          note:
            'النتيجة ما تكون مجرد رقم؛ تقدر ترجع للتفاصيل التي بُنيت عليها.',

          image:
            '/images/how-it-works/vendor-ranking.png',

          accent:
            COLORS.green,
        },

        {
          number:
            '04',

          kicker:
            'المقارنة',

          title:
            'قارن الموردين جنبًا إلى جنب',

          description:
            'شوف الدرجات والامتثال والأهلية والمخاطر بين جميع الموردين في واجهة واحدة.',

          note:
            'الفروقات بين الموردين تكون أوضح وأسهل للمراجعة.',

          image:
            '/images/how-it-works/vendor-comparison.png',

          accent:
            COLORS.orange,
        },

        {
          number:
            '05',

          kicker:
            'التفاصيل',

          title:
            'ادخل في تفاصيل أي مورد',

          description:
            'راجع الدرجة الموزونة، والامتثال، والمتطلبات غير المستوفاة، والنتائج حسب كل معيار.',

          note:
            'انتقل من النتيجة العامة إلى التفاصيل الداعمة لها وقت ما تحتاج.',

          image:
            '/images/how-it-works/vendor-details.png',

          accent:
            COLORS.yellow,
        },

        {
          number:
            '06',

          kicker:
            'المتابعة',

          title:
            'كل المنافسات تبقى محفوظة',

          description:
            'ارجع للمنافسات الحالية والسابقة وحالتها وعدد الموردين ونتائج التقييم متى احتجت.',

          note:
            'سجل واحد يجمع المنافسات السابقة والحالية ونتائجها.',

          image:
            '/images/how-it-works/competition-history.png',

          accent:
            COLORS.blue2,
        },
      ],
    },


    outputs: {
      eyebrow:
        'وش تطلع لك البوابة؟',

      title:
        'مو مجرد درجة نهائية',

      description:
        'الهدف مو إعطاؤك رقم وبس، بل عرض المعلومات اللي تساعد فريق المشتريات يراجع النتيجة ويفهم سببها.',

      items: [
        {
          title:
            'إطار تقييم مرتب',

          description:
            'المعايير والأوزان والمتطلبات الإلزامية تكون واضحة ومتصلة بمستند المنافسة.',

          icon:
            'framework',
        },

        {
          title:
            'مقارنة مباشرة',

          description:
            'شوف ترتيب الموردين ودرجاتهم وامتثالهم وأبرز الفروقات بينهم في مكان واحد.',

          icon:
            'comparison',
        },

        {
          title:
            'نتيجة قابلة للمراجعة',

          description:
            'راجع التوصية والامتثال والمخاطر ثم ادخل في تفاصيل المورد قبل اتخاذ القرار.',

          icon:
            'review',
        },
      ],
    },


    compare: {
      eyebrow:
        'قبل وبعد',

      title:
        'نفس المنافسة، بطريقة أوضح',

      subtitle:
        'المستندات نفسها، لكن طريقة التعامل معها تختلف.',

      oldTitle:
        'بالطريقة التقليدية',

      newTitle:
        'مع بوابة تقييم العروض',

      rows: [
        {
          label:
            'المستندات',

          old:
            'ملفات موزعة بين مجلدات ورسائل وجداول',

          new:
            'المنافسة وعروض الموردين في مسار واحد',
        },

        {
          label:
            'المتطلبات',

          old:
            'استخراج ومتابعة يدوية',

          new:
            'معايير وأوزان ومتطلبات مرتبة',
        },

        {
          label:
            'المقارنة',

          old:
            'الرجوع لكل عرض بشكل منفصل',

          new:
            'مقارنة مباشرة بين الموردين',
        },

        {
          label:
            'الامتثال',

          old:
            'احتمالية فوات بند مهم أثناء المراجعة',

          new:
            'البنود الإلزامية وحالات الاستيفاء ظاهرة',
        },

        {
          label:
            'النتائج',

          old:
            'تلخيص يدوي قبل الوصول للتوصية',

          new:
            'نتائج مترابطة مع التفاصيل الداعمة لها',
        },
      ],
    },


    overview: {
      eyebrow:
        'الصورة الكاملة',

      title:
        'كل نتيجة مرتبطة بما قبلها',

      description:
        'من نفس المنافسة تقدر تنتقل بين إطار المتطلبات، ومقارنة الموردين، والامتثال، والنتيجة النهائية بدون ما تفقد سياق التقييم.',

      image:
        '/images/how-it-works/overview.png',
    },


    faq: {
      eyebrow:
        'أسئلة شائعة',

      items: [
        {
          question:
            'هل البوابة تتخذ قرار الترسية بشكل آلي؟',

          answer:
            'لا. البوابة تدعم فريق المشتريات بالتحليل والدرجات والامتثال والتوصية، لكن قرار الترسية النهائي يبقى قرارًا بشريًا وفق إجراءات الجهة.',
        },

        {
          question:
            'وش أنواع المنافسات اللي أقدر أرفعها؟',

          answer:
            'تدعم البوابة مستندات المنافسات المختلفة مثل RFP وRFQ وRFI، ويتم التحليل بناءً على المتطلبات الموجودة في المستند.',
        },

        {
          question:
            'هل أقدر أقارن أكثر من مورد في نفس المنافسة؟',

          answer:
            'نعم. تقدر تضيف أكثر من عرض مورد لنفس المنافسة، وبعد اكتمال التحليل تظهر النتائج والترتيب ومؤشرات الامتثال للمقارنة.',
        },

        {
          question:
            'كيف تتعامل البوابة مع المتطلبات الإلزامية؟',

          answer:
            'يتم تحديد البنود الإلزامية أثناء تحليل مستند المنافسة، ثم مراجعة مدى استيفاء كل مورد لها وإظهار حالات عدم الاستيفاء بوضوح.',
        },

        {
          question:
            'هل أقدر أرجع لمنافسة قديمة؟',

          answer:
            'نعم. سجل المنافسات يحتفظ بالمنافسات السابقة وحالتها والموردين المرتبطين بها ونتائج التقييم.',
        },
      ],
    },
  },


  en: {
    hero: {
      eyebrow:
        'How the Portal Works',

      title:
        'From competition documents to a clearer decision',

      description:
        'One connected journey bringing together competition documents, requirement analysis, vendor review, comparison, and compliance.',

      cta:
        'Add Competition',
    },


    why: {
      eyebrow:
        'Why the Portal?',

      title:
        'Less fragmented review. Clearer comparison.',

      description:
        'Instead of moving between files, spreadsheets, and notes, the portal organizes the evaluation journey and surfaces the information procurement teams need.',

      items: [
        {
          number:
            '01',

          label:
            'Less time',

          title:
            'Start from a clear evaluation framework',

          description:
            'Criteria and requirements are extracted and organized into one consistent basis for vendor review.',
        },

        {
          number:
            '02',

          label:
            'Clearer comparison',

          title:
            'See vendor differences directly',

          description:
            'Scores, compliance, strengths, and gaps become easier to compare without opening every proposal separately.',
        },

        {
          number:
            '03',

          label:
            'Better review',

          title:
            'Know what needs attention',

          description:
            'Mandatory requirements, missing evidence, and risk indicators are surfaced before the final decision.',
        },
      ],
    },


    journey: {
      eyebrow:
        'Competition Journey',

      title:
        'From the first document to a reviewable result',

      description:
        'Each stage builds on the previous one, keeping the evaluation journey clear from competition setup to vendor comparison and final review.',

      steps: [
        {
          number:
            '01',

          kicker:
            'Start',

          title:
            'Add the competition and documents',

          description:
            'Upload the competition document and add the vendor proposals you want to review.',

          note:
            'The evaluation journey begins with the same source documents used by procurement teams.',

          image:
            '/images/how-it-works/add-competition.png',

          accent:
            COLORS.blue,
        },

        {
          number:
            '02',

          kicker:
            'Evaluation Framework',

          title:
            'Criteria and weights become clear',

          description:
            'The portal extracts criteria, weights, requirements, and mandatory clauses from the competition document.',

          note:
            'Every vendor is evaluated against the same competition requirements.',

          image:
            '/images/how-it-works/criteria.png',

          accent:
            COLORS.purple,
        },

        {
          number:
            '03',

          kicker:
            'Proposal Analysis',

          title:
            'Every vendor is reviewed on the same basis',

          description:
            'Proposal content is mapped against requirements and evaluated for match quality, compliance, scoring, and risk.',

          note:
            'Users can move beyond the final score and review the supporting details.',

          image:
            '/images/how-it-works/vendor-ranking.png',

          accent:
            COLORS.green,
        },

        {
          number:
            '04',

          kicker:
            'Comparison',

          title:
            'Compare vendors side by side',

          description:
            'Bring scores, mandatory compliance, eligibility, and risk together in one view.',

          note:
            'Differences between vendor proposals become easier to review.',

          image:
            '/images/how-it-works/vendor-comparison.png',

          accent:
            COLORS.orange,
        },

        {
          number:
            '05',

          kicker:
            'Details',

          title:
            'Go deeper into any vendor',

          description:
            'Review weighted scoring, compliance, unmet requirements, and performance by criterion.',

          note:
            'Move from the overall result into the evidence and details behind it.',

          image:
            '/images/how-it-works/vendor-details.png',

          accent:
            COLORS.yellow,
        },

        {
          number:
            '06',

          kicker:
            'History',

          title:
            'Every competition remains accessible',

          description:
            'Return to current and previous competitions, their status, vendor count, and evaluation results.',

          note:
            'One history view keeps previous and active competitions together.',

          image:
            '/images/how-it-works/competition-history.png',

          accent:
            COLORS.blue2,
        },
      ],
    },


    outputs: {
      eyebrow:
        'What Do You Get?',

      title:
        'More than a final score',

      description:
        'The goal is not only to return a number, but to provide the information procurement teams need to review and understand the result.',

      items: [
        {
          title:
            'Structured evaluation framework',

          description:
            'Criteria, weights, and mandatory requirements remain clearly connected to the competition document.',

          icon:
            'framework',
        },

        {
          title:
            'Direct vendor comparison',

          description:
            'Review vendor ranking, scores, compliance, and key differences in one place.',

          icon:
            'comparison',
        },

        {
          title:
            'Reviewable outcome',

          description:
            'Review recommendation, compliance, and risk, then drill into vendor-level evidence before deciding.',

          icon:
            'review',
        },
      ],
    },


    compare: {
      eyebrow:
        'Before & After',

      title:
        'Same competition. A clearer process.',

      subtitle:
        'The documents stay the same. The way you work with them changes.',

      oldTitle:
        'Traditional approach',

      newTitle:
        'With the Proposal Evaluation Portal',

      rows: [
        {
          label:
            'Documents',

          old:
            'Files spread across folders, emails, and spreadsheets',

          new:
            'Competition and vendor proposals in one journey',
        },

        {
          label:
            'Requirements',

          old:
            'Manual extraction and tracking',

          new:
            'Structured criteria, weights, and requirements',
        },

        {
          label:
            'Comparison',

          old:
            'Reviewing every proposal separately',

          new:
            'Direct side-by-side vendor comparison',
        },

        {
          label:
            'Compliance',

          old:
            'Important clauses may be missed',

          new:
            'Mandatory requirements and exceptions surfaced clearly',
        },

        {
          label:
            'Outcome',

          old:
            'Manual summarization before recommendation',

          new:
            'Results connected to supporting details',
        },
      ],
    },


    overview: {
      eyebrow:
        'The Full Picture',

      title:
        'Every result stays connected',

      description:
        'Move between requirements, vendor comparison, compliance, and final outcomes without losing the context of the competition.',

      image:
        '/images/how-it-works/overview.png',
    },


    faq: {
      eyebrow:
        'Frequently Asked Questions',

      items: [
        {
          question:
            'Does the portal make the final award decision automatically?',

          answer:
            'No. The portal supports procurement teams with analysis, scoring, compliance, and recommendations, while the final award decision remains a human decision.',
        },

        {
          question:
            'What competition document types can be used?',

          answer:
            'The portal supports competition documents such as RFPs, RFQs, and RFIs based on the requirements contained in the document.',
        },

        {
          question:
            'Can I compare multiple vendors in one competition?',

          answer:
            'Yes. Multiple vendor proposals can be added to one competition and compared after analysis is completed.',
        },

        {
          question:
            'How are mandatory requirements handled?',

          answer:
            'Mandatory clauses are identified from the competition document and checked against each vendor proposal, with unmet requirements highlighted for review.',
        },

        {
          question:
            'Can I return to a previous competition?',

          answer:
            'Yes. Competition history keeps previous competitions, status, vendors, and evaluation results available for later review.',
        },
      ],
    },
  },
} as const


function OutputIcon({
  type,
}: {
  type: string
}) {
  if (
    type === 'comparison'
  ) {
    return (
      <GitCompareArrows className="size-7" />
    )
  }

  if (
    type === 'review'
  ) {
    return (
      <ShieldCheck className="size-7" />
    )
  }

  return (
    <FileCheck2 className="size-7" />
  )
}


export default function HowItWorksPage() {
  const {
    language,
    isArabic,
  } = useLanguage()


  const [
    openFaq,
    setOpenFaq,
  ] =
    useState<number>(0)


  const pageRef =
    useRef<HTMLDivElement>(null)


  const t =
    content[language]


  useLayoutEffect(() => {
    const lenis =
      new Lenis({
        duration:
          1.1,

        smoothWheel:
          true,
      })


    const ticker = (
      time: number,
    ) => {
      lenis.raf(
        time * 1000,
      )
    }


    gsap.ticker.add(
      ticker,
    )


    gsap.ticker.lagSmoothing(
      0,
    )


    lenis.on(
      'scroll',
      ScrollTrigger.update,
    )


    const ctx =
      gsap.context(
        () => {

          gsap
            .utils
            .toArray<HTMLElement>(
              '[data-reveal]',
            )
            .forEach(
              (
                element,
              ) => {
                gsap.fromTo(
                  element,

                  {
                    y:
                      45,

                    opacity:
                      0,
                  },

                  {
                    y:
                      0,

                    opacity:
                      1,

                    duration:
                      1,

                    ease:
                      'power3.out',

                    scrollTrigger: {
                      trigger:
                        element,

                      start:
                        'top 88%',
                    },
                  },
                )
              },
            )


          gsap
            .utils
            .toArray<HTMLElement>(
              '[data-why-card]',
            )
            .forEach(
              (
                element,
              ) => {
                gsap.fromTo(
                  element,

                  {
                    y:
                      60,

                    opacity:
                      0,

                    scale:
                      0.98,
                  },

                  {
                    y:
                      0,

                    opacity:
                      1,

                    scale:
                      1,

                    duration:
                      1,

                    ease:
                      'power3.out',

                    scrollTrigger: {
                      trigger:
                        element,

                      start:
                        'top 88%',

                      end:
                        'top 62%',

                      scrub:
                        0.4,
                    },
                  },
                )
              },
            )


          gsap
            .utils
            .toArray<HTMLElement>(
              '[data-story-image]',
            )
            .forEach(
              (
                element,
              ) => {
                gsap.fromTo(
                  element,

                  {
                    y:
                      30,

                    scale:
                      0.96,

                    opacity:
                      0.7,
                  },

                  {
                    y:
                      0,

                    scale:
                      1,

                    opacity:
                      1,

                    ease:
                      'none',

                    scrollTrigger: {
                      trigger:
                        element,

                      start:
                        'top 90%',

                      end:
                        'top 30%',

                      scrub:
                        0.8,
                    },
                  },
                )
              },
            )


          gsap
            .utils
            .toArray<HTMLElement>(
              '[data-output-card]',
            )
            .forEach(
              (
                element,
              ) => {
                gsap.fromTo(
                  element,

                  {
                    y:
                      45,

                    opacity:
                      0,
                  },

                  {
                    y:
                      0,

                    opacity:
                      1,

                    duration:
                      0.9,

                    ease:
                      'power3.out',

                    scrollTrigger: {
                      trigger:
                        element,

                      start:
                        'top 90%',
                    },
                  },
                )
              },
            )


          const overviewPanel =
            document.querySelector(
              '[data-overview-panel]',
            )


          if (
            overviewPanel
          ) {
            gsap.fromTo(
              overviewPanel,

              {
                y:
                  35,

                scale:
                  0.96,

                opacity:
                  0.75,
              },

              {
                y:
                  0,

                scale:
                  1,

                opacity:
                  1,

                ease:
                  'none',

                scrollTrigger: {
                  trigger:
                    overviewPanel,

                  start:
                    'top 90%',

                  end:
                    'top 35%',

                  scrub:
                    0.8,
                },
              },
            )
          }

        },
        pageRef,
      )


    ScrollTrigger.refresh()


    return () => {
      ctx.revert()

      gsap.ticker.remove(
        ticker,
      )

      lenis.destroy()
    }
  }, [
    isArabic,
  ])


  const ArrowIcon =
    isArabic
      ? ArrowLeft
      : ArrowRight


  return (
    <div
      ref={
        pageRef
      }
      dir={
        isArabic
          ? 'rtl'
          : 'ltr'
      }
      className="
        min-h-screen
        overflow-x-hidden
        bg-[#F7F3E9]
        text-[#131B4F]
      "
    >

      {/* HERO */}

      <section
        className="
          relative
          flex
          min-h-[calc(100svh-88px)]
          items-center
          overflow-hidden
          bg-[#131B4F]
          text-white

          lg:min-h-[calc(100svh-96px)]
        "
      >

        <div
          className="
            mx-auto
            grid
            w-full
            max-w-[1600px]
            items-center
            gap-12
            px-5
            py-14

            sm:px-8
            sm:py-16

            lg:grid-cols-[0.9fr_1.1fr]
            lg:gap-16
            lg:px-12
            lg:py-16

            xl:px-16
          "
        >

          <div
            data-reveal
            className="
              mx-auto
              w-full
              max-w-[760px]

              lg:mx-0
            "
          >

            <p
              className="
                text-xs
                font-semibold
                tracking-[0.15em]
                text-[#CDB78F]
              "
            >
              {
                t.hero.eyebrow
              }
            </p>


            <h1
              className="
                mt-5
                text-[clamp(40px,6vw,86px)]
                font-medium
                leading-[1.04]
                tracking-[-0.045em]
              "
            >
              {
                t.hero.title
              }
            </h1>


            <p
              className="
                mt-6
                max-w-[650px]
                text-sm
                leading-7
                text-white/72

                sm:text-base
                sm:leading-8

                lg:text-lg
              "
            >
              {
                t.hero.description
              }
            </p>


            <Link
              href="/evaluations/new"
              className="
                group
                relative
                mt-8
                inline-flex
                h-14
                items-center
                justify-center
                gap-3
                overflow-hidden
                bg-[#CDB78F]
                px-7
                text-sm
                font-semibold
                text-[#131B4F]
              "
            >

              <span
                className="
                  absolute
                  inset-0
                  origin-bottom
                  scale-y-0
                  -skew-y-3
                  bg-white
                  transition-transform
                  duration-500
                  ease-out

                  group-hover:scale-y-100
                "
              />


              <span
                className="
                  relative
                  z-10
                "
              >
                {
                  t.hero.cta
                }
              </span>


              <ArrowIcon
                className="
                  relative
                  z-10
                  size-4
                  transition-transform
                  duration-300

                  group-hover:-translate-x-1
                "
              />

            </Link>

          </div>


          <div
            data-reveal
            className="
              mx-auto
              w-full
              max-w-[850px]

              lg:mx-0
            "
          >

            <div
              className="
                relative
                overflow-hidden
                border
                border-white/15
                bg-white/[0.04]
                p-2

                sm:p-3
              "
            >

              <img
                src="/images/how-it-works/overview.png"
                alt=""
                className="
                  block
                  h-auto
                  w-full
                "
              />


              <div
                className="
                  absolute
                  bottom-4
                  start-4
                  hidden
                  bg-[#131B4F]/88
                  px-5
                  py-4
                  backdrop-blur-md

                  sm:block
                "
              >

                <p
                  className="
                    text-[10px]
                    font-semibold
                    tracking-[0.14em]
                    text-[#CDB78F]
                  "
                >
                  AI-ASSISTED
                </p>


                <p
                  className="
                    mt-1
                    text-sm
                    font-medium
                  "
                >
                  {
                    isArabic
                      ? 'رحلة تقييم مترابطة'
                      : 'A connected evaluation journey'
                  }
                </p>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* WHY */}

      <section
        className="
          bg-[#F1ECE0]
          px-5
          py-20

          sm:px-8
          sm:py-24

          lg:px-12
          lg:py-28

          xl:px-16
        "
      >

        <div
          className="
            mx-auto
            grid
            max-w-[1500px]
            gap-5

            lg:grid-cols-[0.82fr_1.18fr]
            lg:items-start
          "
        >

          <div
            data-reveal
            className="
              relative
              overflow-hidden
              bg-[#1D208E]
              p-8
              text-white

              sm:p-10

              lg:sticky
              lg:top-[120px]
              lg:flex
              lg:min-h-[700px]
              lg:flex-col
              lg:justify-between

              xl:p-12
            "
          >

            <div
              className="
                pointer-events-none
                absolute
                -bottom-32
                -start-20
                size-[400px]
                rounded-full
                bg-[#9466C4]/28
                blur-[90px]
              "
            />


            <div
              className="
                relative
                z-10
              "
            >

              <span
                className="
                  inline-flex
                  bg-white/10
                  px-4
                  py-2
                  text-[10px]
                  font-semibold
                "
              >
                {
                  t.why.eyebrow
                }
              </span>


              <h2
                className="
                  mt-7
                  max-w-[550px]
                  text-[clamp(38px,4.4vw,66px)]
                  font-medium
                  leading-[1.06]
                  tracking-[-0.04em]
                "
              >
                {
                  t.why.title
                }
              </h2>

            </div>


            <p
              className="
                relative
                z-10
                mt-16
                max-w-[510px]
                text-base
                leading-8
                text-white/70

                lg:mt-10
              "
            >
              {
                t.why.description
              }
            </p>

          </div>


          {/* SMALLER / MORE BALANCED WHY CARDS */}

          <div
            className="
              flex
              flex-col
              gap-5
            "
          >

            {
              t.why.items.map(
                (
                  item,
                ) => (
                  <article
                    key={
                      item.number
                    }
                    data-why-card
                    className="
                      grid
                      items-center
                      gap-5
                      bg-white
                      px-6
                      py-8

                      sm:grid-cols-[92px_1fr]
                      sm:px-8
                      sm:py-9

                      lg:min-h-[205px]
                      lg:grid-cols-[105px_1fr]
                      lg:px-9
                      lg:py-8

                      xl:min-h-[220px]
                      xl:px-10
                    "
                  >

                    <span
                      className="
                        text-[54px]
                        font-light
                        leading-none
                        text-[#1D208E]

                        sm:text-[64px]

                        lg:text-[70px]
                      "
                    >
                      {
                        item.number
                      }
                    </span>


                    <div
                      className="
                        max-w-[720px]
                      "
                    >

                      <p
                        className="
                          text-[10px]
                          font-semibold
                          tracking-[0.12em]
                          text-[#9466C4]
                        "
                      >
                        {
                          item.label
                        }
                      </p>


                      <h3
                        className="
                          mt-2
                          text-xl
                          font-medium
                          leading-[1.2]
                          tracking-[-0.02em]

                          sm:text-[24px]

                          xl:text-[26px]
                        "
                      >
                        {
                          item.title
                        }
                      </h3>


                      <p
                        className="
                          mt-3
                          text-sm
                          leading-7
                          text-[#65708D]

                          sm:text-[15px]

                          xl:text-base
                        "
                      >
                        {
                          item.description
                        }
                      </p>

                    </div>

                  </article>
                ),
              )
            }

          </div>

        </div>

      </section>


      {/* JOURNEY INTRO */}

      <section
        className="
          bg-white
          px-5
          pb-10
          pt-20

          sm:px-8
          sm:pt-24

          lg:px-12
          lg:pt-28

          xl:px-16
        "
      >

        <div
          data-reveal
          className="
            mx-auto
            max-w-[1500px]
          "
        >

          <p
            className="
              text-xs
              font-semibold
              tracking-[0.15em]
              text-[#1D208E]
            "
          >
            {
              t.journey.eyebrow
            }
          </p>


          <h2
            className="
              mt-5
              max-w-[1050px]
              text-[clamp(40px,5vw,74px)]
              font-medium
              leading-[1.05]
              tracking-[-0.045em]
            "
          >
            {
              t.journey.title
            }
          </h2>


          <p
            className="
              mt-6
              max-w-[760px]
              text-base
              leading-8
              text-[#65708D]

              sm:text-lg
            "
          >
            {
              t.journey.description
            }
          </p>

        </div>

      </section>


      {/* JOURNEY STEPS */}

      <section
        className="
          bg-white
        "
      >

        {
          t.journey.steps.map(
            (
              step,
              index,
            ) => {

              const imageFirst =
                index % 2 === 1


              return (
                <article
                  key={
                    step.number
                  }
                  className="
                    border-t
                    border-[#E7E9F1]
                    px-5
                    py-16

                    sm:px-8
                    sm:py-20

                    lg:min-h-[88svh]
                    lg:px-12
                    lg:py-24

                    xl:px-16
                  "
                >

                  <div
                    className="
                      mx-auto
                      grid
                      max-w-[1500px]
                      items-start
                      gap-10

                      lg:grid-cols-[0.82fr_1.18fr]
                      lg:gap-14

                      xl:gap-20
                    "
                  >

                    <div
                      className={
                        imageFirst
                          ? 'lg:order-2'
                          : 'lg:order-1'
                      }
                    >

                      <div
                        className="
                          lg:sticky
                          lg:top-[125px]
                          lg:flex
                          lg:min-h-[560px]
                          lg:flex-col
                          lg:justify-between
                        "
                      >

                        <div
                          data-reveal
                        >

                          <span
                            className="
                              text-[72px]
                              font-light
                              leading-none

                              sm:text-[90px]

                              xl:text-[100px]
                            "
                            style={{
                              color:
                                step.accent,
                            }}
                          >
                            {
                              step.number
                            }
                          </span>


                          <p
                            className="
                              mt-6
                              text-[10px]
                              font-semibold
                              tracking-[0.14em]
                              text-[#65708D]
                            "
                          >
                            {
                              step.kicker
                            }
                          </p>


                          <h3
                            className="
                              mt-3
                              max-w-[590px]
                              text-[clamp(32px,3.3vw,52px)]
                              font-medium
                              leading-[1.1]
                              tracking-[-0.04em]
                            "
                          >
                            {
                              step.title
                            }
                          </h3>


                          <p
                            className="
                              mt-6
                              max-w-[560px]
                              text-base
                              leading-8
                              text-[#65708D]

                              sm:text-lg
                            "
                          >
                            {
                              step.description
                            }
                          </p>

                        </div>


                        <p
                          data-reveal
                          className="
                            mt-10
                            max-w-[540px]
                            border-t
                            border-[#D8DCE7]
                            pt-5
                            text-sm
                            leading-7
                            text-[#65708D]
                          "
                        >
                          {
                            step.note
                          }
                        </p>

                      </div>

                    </div>


                    <div
                      className={
                        imageFirst
                          ? 'lg:order-1'
                          : 'lg:order-2'
                      }
                    >

                      <div
                        data-story-image
                        className="
                          overflow-hidden
                          border
                          border-[#E2E5EF]
                          bg-[#F8F9FC]
                          p-2
                          shadow-[0_22px_65px_rgba(19,27,79,0.10)]

                          sm:p-3

                          lg:sticky
                          lg:top-[120px]
                        "
                      >

                        <div
                          className="
                            flex
                            items-center
                            justify-between
                            px-1
                            pb-3
                          "
                        >

                          <div
                            className="
                              flex
                              gap-2
                            "
                          >

                            <span
                              className="
                                size-2.5
                                rounded-full
                              "
                              style={{
                                background:
                                  step.accent,
                              }}
                            />

                            <span
                              className="
                                size-2.5
                                rounded-full
                                bg-[#CDB78F]
                              "
                            />

                            <span
                              className="
                                size-2.5
                                rounded-full
                                bg-[#D8DCE7]
                              "
                            />

                          </div>


                          <span
                            className="
                              text-[9px]
                              font-semibold
                              tracking-[0.12em]
                              text-[#65708D]
                            "
                          >
                            KSF PORTAL
                          </span>

                        </div>


                        <img
                          src={
                            step.image
                          }
                          alt={
                            step.title
                          }
                          className="
                            block
                            h-auto
                            w-full
                          "
                        />

                      </div>

                    </div>

                  </div>

                </article>
              )
            },
          )
        }

      </section>


      {/* OUTPUTS */}

      <section
        className="
          bg-[#131B4F]
          px-5
          py-20
          text-white

          sm:px-8
          sm:py-24

          lg:px-12
          lg:py-28

          xl:px-16
        "
      >

        <div
          className="
            mx-auto
            max-w-[1500px]
          "
        >

          <div
            data-reveal
          >

            <p
              className="
                text-xs
                font-semibold
                tracking-[0.15em]
                text-[#CDB78F]
              "
            >
              {
                t.outputs.eyebrow
              }
            </p>


            <h2
              className="
                mt-5
                max-w-[900px]
                text-[clamp(40px,5vw,72px)]
                font-medium
                leading-[1.05]
                tracking-[-0.045em]
              "
            >
              {
                t.outputs.title
              }
            </h2>


            <p
              className="
                mt-6
                max-w-[720px]
                text-base
                leading-8
                text-white/65

                sm:text-lg
              "
            >
              {
                t.outputs.description
              }
            </p>

          </div>


          <div
            className="
              mt-12
              grid
              gap-5

              md:grid-cols-3
            "
          >

            {
              t.outputs.items.map(
                (
                  item,
                  index,
                ) => {

                  const backgrounds =
                    [
                      '#CDB78F',
                      '#DFD2B8',
                      '#F1ECE0',
                    ]


                  return (
                    <article
                      key={
                        item.title
                      }
                      data-output-card
                      className="
                        flex
                        min-h-[330px]
                        flex-col
                        justify-between
                        p-7
                        text-[#131B4F]

                        sm:p-8

                        lg:min-h-[410px]
                        lg:p-10
                      "
                      style={{
                        background:
                          backgrounds[
                            index
                          ],
                      }}
                    >

                      <div
                        className="
                          flex
                          size-14
                          items-center
                          justify-center
                          border
                          border-[#131B4F]/15
                        "
                      >
                        <OutputIcon
                          type={
                            item.icon
                          }
                        />
                      </div>


                      <div
                        className="
                          mt-14
                        "
                      >

                        <span
                          className="
                            text-xs
                            font-semibold
                            text-[#131B4F]/40
                          "
                        >
                          0{
                            index + 1
                          }
                        </span>


                        <h3
                          className="
                            mt-4
                            text-[28px]
                            font-medium
                            leading-[1.12]

                            lg:text-[31px]
                          "
                        >
                          {
                            item.title
                          }
                        </h3>


                        <p
                          className="
                            mt-4
                            text-sm
                            leading-7
                            text-[#131B4F]/65

                            sm:text-base
                          "
                        >
                          {
                            item.description
                          }
                        </p>

                      </div>

                    </article>
                  )
                },
              )
            }

          </div>

        </div>

      </section>


      {/* BEFORE / AFTER */}

      <section
        className="
          bg-[#F7F3E9]
          px-5
          py-20

          sm:px-8
          sm:py-24

          lg:px-12
          lg:py-28

          xl:px-16
        "
      >

        <div
          className="
            mx-auto
            max-w-[1400px]
          "
        >

          <div
            data-reveal
            className="
              text-center
            "
          >

            <p
              className="
                text-xs
                font-semibold
                tracking-[0.14em]
                text-[#1D208E]
              "
            >
              {
                t.compare.eyebrow
              }
            </p>


            <h2
              className="
                mx-auto
                mt-4
                max-w-[1000px]
                text-[clamp(40px,5vw,72px)]
                font-medium
                leading-[1.04]
                tracking-[-0.045em]
              "
            >
              {
                t.compare.title
              }
            </h2>


            <p
              className="
                mt-5
                text-base
                text-[#9466C4]

                sm:text-lg
              "
            >
              {
                t.compare.subtitle
              }
            </p>

          </div>


          <div
            data-reveal
            className="
              mt-14
              hidden
              overflow-hidden

              lg:grid
              lg:grid-cols-2
            "
          >

            <div
              className="
                bg-[#E8DFCC]
                p-10

                xl:p-12
              "
            >

              <p
                className="
                  text-[10px]
                  font-semibold
                  tracking-[0.13em]
                  text-[#131B4F]/40
                "
              >
                {
                  isArabic
                    ? 'الطريقة المعتادة'
                    : 'THE OLD WAY'
                }
              </p>


              <h3
                className="
                  mt-4
                  text-[42px]
                  font-medium
                  leading-[1.05]
                  text-[#777166]

                  xl:text-[52px]
                "
              >
                {
                  t.compare.oldTitle
                }
              </h3>


              <div
                className="
                  mt-12
                "
              >

                {
                  t.compare.rows.map(
                    (
                      row,
                    ) => (
                      <div
                        key={
                          row.label
                        }
                        className="
                          border-t
                          border-[#131B4F]/10
                          py-6
                        "
                      >

                        <p
                          className="
                            text-[10px]
                            font-semibold
                            tracking-[0.1em]
                            text-[#131B4F]/35
                          "
                        >
                          {
                            row.label
                          }
                        </p>


                        <p
                          className="
                            mt-2
                            text-lg
                            leading-7
                            text-[#716B60]
                          "
                        >
                          {
                            row.old
                          }
                        </p>

                      </div>
                    ),
                  )
                }

              </div>

            </div>


            <div
              className="
                bg-[#1D208E]
                p-10
                text-white

                xl:p-12
              "
            >

              <span
                className="
                  inline-flex
                  bg-white/10
                  px-4
                  py-2
                  text-[10px]
                  font-semibold
                  tracking-[0.13em]
                "
              >
                {
                  isArabic
                    ? 'مع البوابة'
                    : 'WITH THE PORTAL'
                }
              </span>


              <h3
                className="
                  mt-4
                  text-[42px]
                  font-medium
                  leading-[1.05]

                  xl:text-[52px]
                "
              >
                {
                  t.compare.newTitle
                }
              </h3>


              <div
                className="
                  mt-12
                "
              >

                {
                  t.compare.rows.map(
                    (
                      row,
                    ) => (
                      <div
                        key={
                          row.label
                        }
                        className="
                          border-t
                          border-white/15
                          py-6
                        "
                      >

                        <p
                          className="
                            text-[10px]
                            font-semibold
                            tracking-[0.1em]
                            text-white/40
                          "
                        >
                          {
                            row.label
                          }
                        </p>


                        <p
                          className="
                            mt-2
                            text-lg
                            font-medium
                            leading-7
                          "
                        >
                          {
                            row.new
                          }
                        </p>

                      </div>
                    ),
                  )
                }

              </div>

            </div>

          </div>


          <div
            className="
              mt-12
              space-y-5

              lg:hidden
            "
          >

            {
              t.compare.rows.map(
                (
                  row,
                  index,
                ) => (
                  <article
                    key={
                      row.label
                    }
                    className="
                      overflow-hidden
                      border
                      border-[#131B4F]/10
                    "
                  >

                    <div
                      className="
                        bg-[#E8DFCC]
                        p-6
                      "
                    >

                      <p
                        className="
                          text-[10px]
                          font-semibold
                          text-[#131B4F]/40
                        "
                      >
                        0{
                          index + 1
                        } — {
                          row.label
                        }
                      </p>


                      <p
                        className="
                          mt-3
                          text-base
                          leading-7
                          text-[#716B60]
                        "
                      >
                        {
                          row.old
                        }
                      </p>

                    </div>


                    <div
                      className="
                        bg-[#1D208E]
                        p-6
                        text-white
                      "
                    >

                      <p
                        className="
                          text-[10px]
                          font-semibold
                          text-white/45
                        "
                      >
                        {
                          isArabic
                            ? 'مع البوابة'
                            : 'WITH THE PORTAL'
                        }
                      </p>


                      <p
                        className="
                          mt-3
                          text-base
                          font-medium
                          leading-7
                        "
                      >
                        {
                          row.new
                        }
                      </p>

                    </div>

                  </article>
                ),
              )
            }

          </div>

        </div>

      </section>


      {/* OVERVIEW */}

      <section
        className="
          bg-[#F1ECE0]
          px-5
          py-20

          sm:px-8
          sm:py-24

          lg:px-12
          lg:py-28

          xl:px-16
        "
      >

        <div
          className="
            mx-auto
            grid
            max-w-[1500px]
            items-center
            gap-12

            lg:grid-cols-[0.85fr_1.15fr]
            lg:gap-16
          "
        >

          <div
            data-reveal
            className="
              max-w-[650px]
            "
          >

            <p
              className="
                text-xs
                font-semibold
                tracking-[0.14em]
                text-[#9466C4]
              "
            >
              {
                t.overview.eyebrow
              }
            </p>


            <h2
              className="
                mt-5
                text-[clamp(40px,5vw,72px)]
                font-medium
                leading-[1.04]
                tracking-[-0.045em]
              "
            >
              {
                t.overview.title
              }
            </h2>


            <p
              className="
                mt-6
                max-w-[570px]
                text-base
                leading-8
                text-[#131B4F]/65

                sm:text-lg
              "
            >
              {
                t.overview.description
              }
            </p>


            <ul
              className="
                mt-9
                grid
                gap-4

                sm:grid-cols-2
              "
            >

              {
                [
                  isArabic
                    ? 'إطار المتطلبات'
                    : 'Requirements',

                  isArabic
                    ? 'مقارنة الموردين'
                    : 'Vendor comparison',

                  isArabic
                    ? 'الامتثال'
                    : 'Compliance',

                  isArabic
                    ? 'النتيجة والتوصية'
                    : 'Outcome & recommendation',

                ].map(
                  (
                    item,
                  ) => (
                    <li
                      key={
                        item
                      }
                      className="
                        flex
                        items-center
                        gap-3
                        text-sm
                        font-medium
                      "
                    >

                      <span
                        className="
                          flex
                          size-6
                          shrink-0
                          items-center
                          justify-center
                          rounded-full
                          bg-[#131B4F]
                          text-white
                        "
                      >

                        <Check
                          className="
                            size-3.5
                          "
                        />

                      </span>


                      {
                        item
                      }

                    </li>
                  ),
                )
              }

            </ul>

          </div>


          <div
            data-overview-panel
            className="
              w-full
            "
          >

            <div
              className="
                overflow-hidden
                border
                border-[#D9DCE7]
                bg-white
                p-2
                shadow-[0_22px_70px_rgba(19,27,79,0.10)]

                sm:p-3
              "
            >

              <img
                src={
                  t.overview.image
                }
                alt=""
                className="
                  block
                  h-auto
                  w-full
                "
              />

            </div>

          </div>

        </div>

      </section>


      {/* FAQ */}

      <section
        className="
          bg-[#F7F3E9]
          px-5
          py-20

          sm:px-8
          sm:py-24

          lg:px-12
          lg:pb-32
          lg:pt-28

          xl:px-16
        "
      >

        <div
          className="
            mx-auto
            max-w-[1280px]
          "
        >

          <div
            data-reveal
          >

            <p
              className="
                text-xs
                font-semibold
                tracking-[0.14em]
                text-[#9466C4]
              "
            >
              {
                t.faq.eyebrow
              }
            </p>


            <h2
              className="
                mt-5
                max-w-[900px]
                text-[clamp(40px,5vw,70px)]
                font-medium
                leading-[1.04]
                tracking-[-0.045em]
              "
            >

              {
                isArabic
                  ? (
                    <>
                      عندك سؤال؟{' '}

                      <span
                        className="
                          text-[#1D208E]
                        "
                      >
                        غالبًا جوابه هنا.
                      </span>
                    </>
                  )
                  : (
                    <>
                      Questions?{' '}

                      <span
                        className="
                          text-[#1D208E]
                        "
                      >
                        We have answers.
                      </span>
                    </>
                  )
              }

            </h2>

          </div>


          <div
            className="
              mt-12
              border-t
              border-[#131B4F]/15
            "
          >

            {
              t.faq.items.map(
                (
                  item,
                  index,
                ) => {

                  const isOpen =
                    openFaq ===
                    index


                  return (
                    <div
                      key={
                        item.question
                      }
                      className="
                        border-b
                        border-[#131B4F]/15
                      "
                    >

                      <button
                        type="button"
                        aria-expanded={
                          isOpen
                        }
                        onClick={
                          () =>
                            setOpenFaq(
                              isOpen
                                ? -1
                                : index,
                            )
                        }
                        className="
                          flex
                          w-full
                          items-start
                          gap-4
                          py-7
                          text-start

                          sm:gap-7
                          sm:py-8

                          lg:py-9
                        "
                      >

                        <span
                          className={`
                            w-9
                            shrink-0
                            pt-1
                            text-sm
                            font-semibold

                            ${
                              isOpen
                                ? 'text-[#1D208E]'
                                : 'text-[#131B4F]/35'
                            }
                          `}
                        >
                          0{
                            index + 1
                          }
                        </span>


                        <span
                          className="
                            flex-1
                          "
                        >

                          <span
                            className="
                              block
                              text-lg
                              font-medium
                              leading-7

                              sm:text-xl
                              sm:leading-8

                              lg:text-2xl
                            "
                          >
                            {
                              item.question
                            }
                          </span>


                          <span
                            className={`
                              grid
                              transition-[grid-template-rows]
                              duration-500
                              ease-out

                              ${
                                isOpen
                                  ? 'grid-rows-[1fr]'
                                  : 'grid-rows-[0fr]'
                              }
                            `}
                          >

                            <span
                              className="
                                overflow-hidden
                              "
                            >

                              <span
                                className={`
                                  block
                                  max-w-[780px]
                                  pt-5
                                  text-sm
                                  leading-7
                                  text-[#131B4F]/65
                                  transition-all
                                  duration-500

                                  sm:text-base
                                  sm:leading-8

                                  ${
                                    isOpen
                                      ? 'translate-y-0 opacity-100'
                                      : '-translate-y-2 opacity-0'
                                  }
                                `}
                              >
                                {
                                  item.answer
                                }
                              </span>

                            </span>

                          </span>

                        </span>


                        <span
                          className="
                            mt-1
                            flex
                            size-9
                            shrink-0
                            items-center
                            justify-center
                          "
                        >

                          <ChevronDown
                            className={`
                              size-5
                              transition-transform
                              duration-500

                              ${
                                isOpen
                                  ? 'rotate-180'
                                  : ''
                              }
                            `}
                          />

                        </span>

                      </button>

                    </div>
                  )
                },
              )
            }

          </div>

        </div>

      </section>

    </div>
  )
}