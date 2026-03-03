'use client'

import { useEffect, useState, useRef } from 'react'

// Projection GPS -> SVG
function geoToSvg(lon: number, lat: number): [number, number] {
  const x = (lon + 5.0) * (460 / 13.5) + 20
  const y = 480 - (lat - 42.1) * (460 / 9.2)
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
}

// Contour France metropolitaine
const OUTLINE_COORDS: [number, number][] = [
  [2.55, 51.15], [2.20, 51.05], [1.85, 50.95], [1.58, 50.73], [1.57, 50.13],
  [1.25, 49.92], [0.11, 49.48], [-0.37, 49.19], [-1.09, 48.88],
  [-1.84, 48.65], [-2.76, 48.56], [-3.47, 48.73], [-4.10, 48.65],
  [-4.70, 48.50], [-4.90, 48.30], [-4.77, 48.02], [-4.33, 47.83],
  [-3.36, 47.73], [-2.76, 47.50], [-2.51, 47.28], [-2.17, 47.08],
  [-1.57, 46.67], [-1.14, 46.16], [-1.18, 45.70], [-1.07, 45.23],
  [-1.16, 44.73], [-1.31, 44.20], [-1.52, 43.50], [-1.77, 43.37],
  [-0.73, 42.93], [0.32, 42.58], [1.42, 42.33], [1.86, 42.35],
  [2.53, 42.33], [3.03, 42.34], [3.17, 42.60], [3.08, 43.25],
  [3.54, 43.40], [3.88, 43.58], [4.36, 43.40], [4.80, 43.34],
  [5.06, 43.34], [5.50, 43.20], [5.78, 43.10], [6.14, 43.00],
  [6.63, 43.35], [7.01, 43.50], [7.40, 43.60], [7.55, 43.80],
  [7.13, 44.15], [6.75, 44.58], [6.87, 45.17], [6.85, 45.59],
  [6.87, 45.84], [6.20, 46.21], [6.10, 46.47], [6.83, 47.17],
  [7.02, 47.50], [7.55, 47.59], [7.90, 48.10], [8.10, 48.70],
  [8.20, 49.00], [7.42, 49.18], [6.36, 49.47], [5.82, 49.54],
  [5.39, 49.62], [4.85, 49.80], [4.23, 49.96], [3.61, 50.10],
  [3.20, 50.40], [3.15, 50.80], [3.10, 51.00], [2.89, 51.10],
]

// Contour Corse — decalee vers l'ouest pour tenir dans le viewBox
function corseSvg(lon: number, lat: number): [number, number] {
  return geoToSvg(lon - 1.5, lat)
}

const CORSE_COORDS: [number, number][] = [
  [9.56, 43.01], [9.49, 42.88], [9.41, 42.58], [9.36, 42.30],
  [9.21, 42.10], [9.19, 41.92], [9.12, 41.70], [9.02, 41.55],
  [8.80, 41.40], [8.58, 41.38], [8.57, 41.52], [8.62, 41.70],
  [8.58, 41.93], [8.67, 42.05], [8.57, 42.18], [8.60, 42.38],
  [8.77, 42.55], [9.10, 42.75], [9.30, 42.90], [9.41, 43.00],
  [9.56, 43.01],
]

const FRANCE_PATH = (() => {
  const points = OUTLINE_COORDS.map(([lon, lat]) => geoToSvg(lon, lat))
  return 'M' + points.map(([x, y]) => `${x} ${y}`).join(' L') + ' Z'
})()

const CORSE_PATH = (() => {
  const points = CORSE_COORDS.map(([lon, lat]) => corseSvg(lon, lat))
  return 'M' + points.map(([x, y]) => `${x} ${y}`).join(' L') + ' Z'
})()

type VilleCoord = { ville: string; lat: number; lon: number }

export function HeroCarte({ villes }: { villes: VilleCoord[] }) {
  const [visibleCities, setVisibleCities] = useState<number[]>([])
  const [hoveredCity, setHoveredCity] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const corseRef = useRef<SVGPathElement>(null)
  const startedRef = useRef(false)

  // Convertir et mélanger côté client uniquement
  const [cities, setCities] = useState<{ name: string; x: number; y: number }[]>([])

  useEffect(() => {
    const mapped = villes.map((v) => {
      // Villes corses : appliquer le même décalage que le contour
      const isCorse = v.lon > 8.2 && v.lat < 43.1
      const [x, y] = isCorse ? corseSvg(v.lon, v.lat) : geoToSvg(v.lon, v.lat)
      return { name: v.ville, x, y }
    })
    for (let i = mapped.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mapped[i], mapped[j]] = [mapped[j], mapped[i]]
    }
    const filtered: typeof mapped = []
    for (const city of mapped) {
      const tooClose = filtered.some(
        (c) => Math.hypot(c.x - city.x, c.y - city.y) < 15
      )
      if (!tooClose) filtered.push(city)
      if (filtered.length >= 40) break
    }
    setCities(filtered)

    // Animer contours + villes
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true

          for (const ref of [pathRef, corseRef]) {
            const path = ref.current
            if (path) {
              const length = path.getTotalLength()
              path.style.strokeDasharray = `${length}`
              path.style.strokeDashoffset = `${length}`
              path.animate(
                [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
                { duration: 2000, easing: 'ease-in-out', fill: 'forwards' }
              )
            }
          }

          setTimeout(() => {
            for (let i = 0; i < filtered.length; i++) {
              setTimeout(() => {
                setVisibleCities((prev) => [...prev, i])
              }, i * 150)
            }
          }, 1800)
        }
      },
      { threshold: 0.15 }
    )

    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={containerRef} className="w-full">
      <svg viewBox="0 -20 500 540" className="w-full h-auto" aria-hidden="true">
        {/* Contour France */}
        <path
          ref={pathRef}
          d={FRANCE_PATH}
          fill="none"
          stroke="black"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Contour Corse */}
        <path
          ref={corseRef}
          d={CORSE_PATH}
          fill="none"
          stroke="black"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Villes */}
        {cities.map((city, i) => {
          const isVisible = visibleCities.includes(i)
          const isHovered = hoveredCity === i

          return (
            <g
              key={`${city.name}-${i}`}
              className="cursor-default"
              style={{ pointerEvents: 'none' }}
            >
              {/* Ripple */}
              {isVisible && (
                <circle cx={city.x} cy={city.y} r={5} fill="none" stroke="#FFB06E" strokeWidth={1.5}>
                  <animate attributeName="r" from="5" to="25" dur="0.8s" fill="freeze" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="0.8s" fill="freeze" />
                </circle>
              )}

              {/* Pulse */}
              {isVisible && (
                <circle cx={city.x} cy={city.y} r={5} fill="none" stroke="#FFB06E" strokeWidth={0.8}>
                  <animate attributeName="r" values="5;16;5" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.25;0;0.25" dur="3s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Point — seul element interactif */}
              <circle
                cx={city.x}
                cy={city.y}
                r={isHovered ? 8 : 5.5}
                fill="#FFB06E"
                opacity={isVisible ? 0.85 : 0}
                className="transition-all duration-300"
                style={{ pointerEvents: 'auto', cursor: 'default' }}
                onMouseEnter={() => setHoveredCity(i)}
                onMouseLeave={() => setHoveredCity(null)}
              />

              {/* Label hover */}
              {isVisible && isHovered && (() => {
                const labelW = city.name.length * 7.5 + 16
                const onRight = city.x > 350
                const rx = onRight ? city.x - 12 - labelW : city.x + 12
                const tx = onRight ? city.x - 12 - labelW + 8 : city.x + 20
                return (
                <g>
                  <rect
                    x={rx}
                    y={city.y - 13}
                    width={labelW}
                    height={26}
                    rx={5}
                    fill="#3d3329"
                  />
                  <text
                    x={tx}
                    y={city.y + 4}
                    fill="white"
                    className="text-[12px] font-medium"
                  >
                    {city.name}
                  </text>
                </g>
                )
              })()}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
