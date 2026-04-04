'use client'

import { useEffect, useState, useRef } from 'react'

// Projection GPS -> SVG pour la Bretagne
// Bounding box: lon [-5.2, -0.9], lat [47.2, 48.95]
function geoToSvg(lon: number, lat: number): [number, number] {
  const x = (lon + 5.2) * (460 / 4.3) + 20
  const y = 480 - (lat - 47.2) * (460 / 1.75) - 20
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
}

// Contour Bretagne (GeoJSON IGN, simplifie Visvalingam-Whyatt)
const BRETAGNE_COORDS: [number, number][] = [
  [-1.9723, 48.5346], [-2.0290, 48.6469], [-1.9907, 48.6827],
  [-1.8470, 48.7085], [-1.8720, 48.6471], [-1.7740, 48.6035],
  [-1.5711, 48.6264], [-1.4900, 48.4894], [-1.3799, 48.4561],
  [-1.2723, 48.5339], [-1.2042, 48.5413], [-1.0702, 48.5085],
  [-1.0836, 48.4337], [-1.0451, 48.3282], [-1.1020, 48.2625],
  [-1.0228, 47.9942], [-1.1565, 47.9643], [-1.2459, 47.7767],
  [-1.4796, 47.8353], [-1.4667, 47.8073], [-1.6231, 47.7636],
  [-1.6606, 47.7092], [-1.8540, 47.7082], [-2.0812, 47.6502],
  [-2.0985, 47.5340], [-2.1646, 47.4892], [-2.2981, 47.5155],
  [-2.3119, 47.4652], [-2.4296, 47.4758], [-2.4805, 47.4413],
  [-2.5209, 47.5269], [-2.7937, 47.4842], [-2.9078, 47.5631],
  [-2.7308, 47.5423], [-2.6900, 47.5896], [-2.7618, 47.6395],
  [-2.8587, 47.6229], [-2.8910, 47.5854], [-2.9582, 47.6386],
  [-2.9629, 47.5533], [-3.0246, 47.5921], [-3.1346, 47.5488],
  [-3.2086, 47.6702], [-3.2922, 47.7031], [-3.4528, 47.6953],
  [-3.5286, 47.7654], [-3.8004, 47.7874], [-3.8546, 47.8040],
  [-3.9578, 47.8968], [-3.9771, 47.8538], [-4.1232, 47.8648],
  [-4.1924, 47.7961], [-4.3742, 47.7980], [-4.3489, 47.8316],
  [-4.3921, 47.9315], [-4.5367, 48.0116], [-4.6973, 48.0262],
  [-4.7163, 48.0628], [-4.3625, 48.1093], [-4.3070, 48.0892],
  [-4.2703, 48.1313], [-4.3032, 48.1953], [-4.4639, 48.2394],
  [-4.5541, 48.1678], [-4.5826, 48.3194], [-4.5527, 48.2943],
  [-4.4099, 48.2760], [-4.2645, 48.3582], [-4.4481, 48.3256],
  [-4.3423, 48.4034], [-4.4337, 48.3964], [-4.6281, 48.3375],
  [-4.6806, 48.3556], [-4.7737, 48.3303], [-4.7954, 48.4147],
  [-4.7530, 48.5439], [-4.5435, 48.5983], [-4.3500, 48.6765],
  [-4.3161, 48.6402], [-4.2155, 48.6489], [-4.1880, 48.6857],
  [-3.9651, 48.7218], [-3.8477, 48.6310], [-3.8209, 48.7182],
  [-3.5730, 48.6749], [-3.5380, 48.8248], [-3.4268, 48.8172],
  [-3.0871, 48.8661], [-3.0457, 48.7875], [-2.9332, 48.7575],
  [-2.9474, 48.7233], [-2.8282, 48.6561], [-2.8239, 48.5972],
  [-2.6303, 48.5261], [-2.5479, 48.5976], [-2.4377, 48.6528],
  [-2.2858, 48.6677], [-2.2082, 48.5734], [-2.1165, 48.6388],
  [-2.0567, 48.6399],
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
