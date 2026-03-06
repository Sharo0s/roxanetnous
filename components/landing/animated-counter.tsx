'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  end: number
  label: string
  duration?: number
}

export function AnimatedCounter({ end, label, duration = 5000 }: Props) {
  const [count, setCount] = useState(0)
  const [done, setDone] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1)
            // Ease-out quint — démarre vite, ralentit longuement
            const eased = 1 - Math.pow(1 - progress, 5)
            setCount(Math.round(eased * end))
            if (progress < 1) {
              requestAnimationFrame(animate)
            } else {
              setDone(true)
            }
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration])

  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <span
        className={`text-4xl md:text-5xl font-black text-black tabular-nums transition-transform duration-300 ${done ? 'scale-110' : ''}`}
      >
        {count.toLocaleString('fr-FR')}
      </span>
      <div className="w-8 h-1 rounded-full bg-accent" />
      <span className="text-xs text-black font-bold mt-0.5 tracking-wide uppercase">{label}</span>
    </div>
  )
}
