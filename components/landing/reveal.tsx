'use client'

import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'article' | 'span'
  variant?: 'fade-up' | 'fade' | 'zoom'
  threshold?: number
}

export function Reveal({
  children,
  delay = 0,
  className = '',
  as = 'div',
  variant = 'fade-up',
  threshold = 0.15,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
            break
          }
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  const hiddenClass =
    variant === 'zoom'
      ? 'opacity-0 scale-105'
      : variant === 'fade'
        ? 'opacity-0'
        : 'opacity-0 translate-y-4'

  const visibleClass = 'opacity-100 translate-y-0 scale-100'

  return createElement(
    as,
    {
      ref,
      style: { transitionDelay: `${delay}ms` },
      className: `transition-all duration-500 ease-out will-change-transform ${visible ? visibleClass : hiddenClass} ${className}`,
    },
    children,
  )
}
