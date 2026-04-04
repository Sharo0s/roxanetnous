'use client'

import { useEffect, useState, useRef } from 'react'

// Projection GPS -> SVG pour la Bretagne
// Bounding box: lon [-5.2, -0.9], lat [47.2, 48.95]
function geoToSvg(lon: number, lat: number): [number, number] {
  const x = (lon + 5.2) * (460 / 4.3) + 20
  const y = 480 - (lat - 47.2) * (460 / 1.75) - 20
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
}

// Contour Bretagne lisse (GeoJSON IGN, moyenne mobile + echantillonnage)
const BRETAGNE_COORDS: [number, number][] = [
  [-2.0294, 48.5792], [-1.9857, 48.5898], [-1.9266, 48.6380],
  [-1.7373, 48.6164], [-1.4889, 48.5443], [-1.2517, 48.4841],
  [-1.1145, 48.3812], [-1.0756, 48.1794], [-1.1436, 47.9769],
  [-1.3282, 47.8528], [-1.5797, 47.7617], [-1.8628, 47.6739],
  [-2.1261, 47.5733], [-2.3312, 47.4972], [-2.4923, 47.4966],
  [-2.5685, 47.5275], [-2.6258, 47.5330], [-2.7351, 47.5287],
  [-2.8120, 47.5309], [-2.8029, 47.5603], [-2.7359, 47.5870],
  [-2.7342, 47.6169], [-2.8106, 47.6095], [-2.8988, 47.6127],
  [-2.9583, 47.5948], [-3.0205, 47.5806], [-3.0886, 47.5523],
  [-3.1452, 47.5955], [-3.1548, 47.6735], [-3.1616, 47.7166],
  [-3.2217, 47.7086], [-3.2830, 47.7130], [-3.3364, 47.7493],
  [-3.3827, 47.7555], [-3.4669, 47.7708], [-3.5769, 47.7862],
  [-3.6656, 47.8024], [-3.7852, 47.8238], [-3.9104, 47.8481],
  [-4.0297, 47.8886], [-4.1054, 47.9072], [-4.1428, 47.8993],
  [-4.2149, 47.8431], [-4.3379, 47.8841], [-4.5152, 47.9654],
  [-4.5975, 48.0482], [-4.5130, 48.0841], [-4.4120, 48.1474],
  [-4.4543, 48.2011], [-4.5482, 48.2566], [-4.4890, 48.2852],
  [-4.3245, 48.2741], [-4.2230, 48.2743], [-4.2481, 48.3024],
  [-4.3290, 48.3331], [-4.3580, 48.3698], [-4.4676, 48.3732],
  [-4.6207, 48.3773], [-4.7466, 48.4198], [-4.7186, 48.5041],
  [-4.6371, 48.5587], [-4.5529, 48.5911], [-4.4779, 48.6269],
  [-4.3498, 48.6526], [-4.1765, 48.6790], [-4.0293, 48.6751],
  [-3.9215, 48.6609], [-3.8270, 48.6647], [-3.7029, 48.6996],
  [-3.5744, 48.7542], [-3.4392, 48.8127], [-3.2904, 48.8328],
  [-3.1593, 48.8309], [-3.0811, 48.8159], [-2.9930, 48.7561],
  [-2.8565, 48.6578], [-2.6789, 48.5940], [-2.4863, 48.6019],
  [-2.3164, 48.6284], [-2.1949, 48.6206], [-2.0827, 48.5859],
]

const BRETAGNE_PATH = (() => {
  const points = BRETAGNE_COORDS.map(([lon, lat]) => geoToSvg(lon, lat))
  return 'M' + points.map(([x, y]) => `${x} ${y}`).join(' L') + ' Z'
})()

type VilleCoord = { ville: string; lat: number; lon: number }

export function HeroCarte({ villes }: { villes: VilleCoord[] }) {
  const [visibleCities, setVisibleCities] = useState<number[]>([])
  const [hoveredCity, setHoveredCity] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const startedRef = useRef(false)

  // Convertir et melanger cote client uniquement
  const [cities, setCities] = useState<{ name: string; x: number; y: number }[]>([])

  useEffect(() => {
    // Filtrer les villes en Bretagne (bounding box)
    const bretagneVilles = villes.filter(
      (v) => v.lon >= -5.2 && v.lon <= -0.9 && v.lat >= 47.2 && v.lat <= 49.0
    )

    const mapped = bretagneVilles.map((v) => {
      const [x, y] = geoToSvg(v.lon, v.lat)
      return { name: v.ville, x, y }
    })
    for (let i = mapped.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mapped[i], mapped[j]] = [mapped[j], mapped[i]]
    }
    const filtered: typeof mapped = []
    for (const city of mapped) {
      const tooClose = filtered.some(
        (c) => Math.hypot(c.x - city.x, c.y - city.y) < 20
      )
      if (!tooClose) filtered.push(city)
      if (filtered.length >= 30) break
    }
    setCities(filtered)

    // Animer contour + villes
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true

          const path = pathRef.current
          if (path) {
            const length = path.getTotalLength()
            path.style.strokeDasharray = `${length}`
            path.style.strokeDashoffset = `${length}`
            path.animate(
              [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
              { duration: 2000, easing: 'ease-in-out', fill: 'forwards' }
            )
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
        {/* Contour Bretagne */}
        <path
          ref={pathRef}
          d={BRETAGNE_PATH}
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
                <circle cx={city.x} cy={city.y} r={5} fill="none" stroke="black" strokeWidth={1.5}>
                  <animate attributeName="r" from="5" to="25" dur="0.8s" fill="freeze" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="0.8s" fill="freeze" />
                </circle>
              )}

              {/* Pulse */}
              {isVisible && (
                <circle cx={city.x} cy={city.y} r={5} fill="none" stroke="black" strokeWidth={0.8}>
                  <animate attributeName="r" values="5;16;5" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.25;0;0.25" dur="3s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Point */}
              <circle
                cx={city.x}
                cy={city.y}
                r={isHovered ? 8 : 5.5}
                fill="black"
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
