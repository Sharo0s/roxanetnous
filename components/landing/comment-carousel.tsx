'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

const STEPS = [
  {
    n: '01',
    t: 'Inscription',
    d: "Créez votre compte en tant qu'accompagnant ou accompagné.",
    src: '/carousel-1.png',
  },
  {
    n: '02',
    t: 'Justificatifs',
    d: "Accompagnants : déposez votre CV et pièce d'identité. Accompagnés : décrivez votre besoin.",
    src: '/carousel-2.png',
  },
  {
    n: '03',
    t: 'Validation',
    d: 'Notre équipe vérifie manuellement chaque profil accompagnant, sous 48h.',
    src: '/carousel-3.png',
  },
  {
    n: '04',
    t: 'Mise en relation',
    d: 'Publiez votre annonce, nous vous recommandons les profils les plus compatibles. Premiers contacts en quelques jours.',
    src: '/carousel-4.png',
  },
] as const

type Position = 'current' | 'prev' | 'next' | 'hidden'

const POSITION_CLASSES: Record<Position, string> = {
  current:
    'left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-100 z-30',
  prev:
    'left-[8%] -translate-x-1/2 -translate-y-1/2 scale-[0.7] opacity-75 z-20 cursor-pointer max-lg:left-[6%] max-sm:left-[2%]',
  next:
    'left-[92%] -translate-x-1/2 -translate-y-1/2 scale-[0.7] opacity-75 z-20 cursor-pointer max-lg:left-[94%] max-sm:left-[98%]',
  hidden:
    'left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.85] opacity-0 pointer-events-none z-10',
}

export function CommentCarousel() {
  const [current, setCurrent] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const count = STEPS.length

  const go = useCallback(
    (delta: number) => setCurrent((c) => (c + delta + count) % count),
    [count],
  )

  const getPosition = (i: number): Position => {
    const diff = (i - current + count) % count
    if (diff === 0) return 'current'
    if (diff === 1) return 'next'
    if (diff === count - 1) return 'prev'
    return 'hidden'
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    const el = trackRef.current
    if (!el) return
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [go])

  return (
    <div
      className="relative flex items-center justify-center w-full"
      role="region"
      aria-roledescription="carrousel"
      aria-label="Étapes de la mise en relation"
    >
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Étape précédente"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 text-5xl md:text-6xl text-gray-600 opacity-60 hover:opacity-100 transition-opacity leading-none font-serif focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf7f2] rounded"
      >
        <span aria-hidden="true">‹</span>
      </button>

      <div
        ref={trackRef}
        tabIndex={0}
        className="relative w-full max-w-[900px] aspect-[3/2] mx-auto overflow-visible focus:outline-none"
        aria-live="polite"
      >
        {STEPS.map((s, i) => {
          const pos = getPosition(i)
          const isSide = pos === 'prev' || pos === 'next'
          const isCurrent = pos === 'current'
          return (
            <div
              key={s.n}
              className={`absolute top-1/2 w-[42%] max-lg:w-[58%] max-sm:w-[68%] aspect-[3/4] rounded-xl overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform ${POSITION_CLASSES[pos]}`}
              onClick={isSide ? () => setCurrent(i) : undefined}
              aria-hidden={!isCurrent}
              aria-roledescription="slide"
              aria-label={`Étape ${i + 1} sur ${count} : ${s.t}`}
            >
              <Image
                src={s.src}
                alt=""
                fill
                sizes="(max-width: 640px) 68vw, (max-width: 1024px) 58vw, 42vw"
                className="object-cover"
                priority={i === 0}
              />
              {isSide && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(ellipse at center, rgba(250,247,242,0) 20%, rgba(250,247,242,0.55) 80%, rgba(250,247,242,0.85) 100%)',
                    filter: 'blur(5px) saturate(0.55) brightness(1.08)',
                  }}
                />
              )}
              <div
                className="absolute inset-0 flex flex-col justify-end p-6 md:p-7 text-white"
                style={{
                  background:
                    'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0) 70%)',
                }}
              >
                <div className="italic text-2xl md:text-3xl leading-none mb-2 text-[#f4c8a3]">
                  {s.n}
                </div>
                <h3 className="text-lg md:text-xl italic mb-1.5 font-normal">
                  {s.t}
                </h3>
                <p className="text-xs md:text-sm leading-relaxed opacity-95">
                  {s.d}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Étape suivante"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-40 text-5xl md:text-6xl text-gray-600 opacity-60 hover:opacity-100 transition-opacity leading-none font-serif focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf7f2] rounded"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  )
}
