'use client'

import { useEffect, useState, useRef } from 'react'

// Projection GPS -> SVG pour la Bretagne
// Bounding box: lon [-5.2, -0.9], lat [47.2, 48.95]
function geoToSvg(lon: number, lat: number): [number, number] {
  const x = (lon + 5.2) * (460 / 4.3) + 20
  const y = 480 - (lat - 47.2) * (460 / 1.75) - 20
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
}

// Contour Bretagne extrait du GeoJSON IGN (polygone principal, echantillonne)
const BRETAGNE_COORDS: [number, number][] = [
  [-2.0069, 48.5661], [-1.9578, 48.5253], [-2.0084, 48.5995],
  [-1.9637, 48.6844], [-1.8451, 48.6966], [-1.5651, 48.6144],
  [-1.4852, 48.4909], [-1.3231, 48.4991], [-1.1338, 48.5221],
  [-1.0784, 48.4134], [-1.0896, 48.2391], [-1.0216, 48.0680],
  [-1.1278, 47.9757], [-1.2148, 47.8419], [-1.4326, 47.8323],
  [-1.5938, 47.7684], [-1.7599, 47.7044], [-2.0027, 47.6735],
  [-2.1284, 47.5296], [-2.2958, 47.5145], [-2.4560, 47.4516],
  [-2.4529, 47.5054], [-2.6170, 47.5101], [-2.5765, 47.5569],
  [-2.6263, 47.5454], [-2.6219, 47.5274], [-2.8002, 47.4873],
  [-2.9100, 47.5528], [-2.8256, 47.5491], [-2.7676, 47.5357],
  [-2.6864, 47.6141], [-2.6972, 47.6114], [-2.7780, 47.6251],
  [-2.7872, 47.6206], [-2.8949, 47.5825], [-2.9494, 47.6214],
  [-2.9597, 47.6009], [-2.9722, 47.5719], [-3.0430, 47.5823],
  [-3.1289, 47.5600], [-3.1452, 47.4892], [-3.2094, 47.6670],
  [-3.1484, 47.7036], [-3.1452, 47.7287], [-3.1980, 47.7444],
  [-3.2148, 47.6945], [-3.3362, 47.6983], [-3.3506, 47.7160],
  [-3.2874, 47.7756], [-3.3883, 47.8252], [-3.3754, 47.7118],
  [-3.5226, 47.7596], [-3.5351, 47.8192], [-3.6403, 47.7755],
  [-3.6621, 47.8225], [-3.7495, 47.8439], [-3.8509, 47.7960],
  [-3.9315, 47.8725], [-4.0105, 47.8514], [-4.1168, 47.8838],
  [-4.1033, 47.9422], [-4.1451, 47.8988], [-4.1668, 47.8590],
  [-4.1614, 47.8242], [-4.3122, 47.8009], [-4.4130, 47.9504],
  [-4.5248, 48.0382], [-4.6985, 48.0265], [-4.6461, 48.0684],
  [-4.4833, 48.0892], [-4.3044, 48.0894], [-4.3691, 48.2050],
  [-4.5189, 48.1983], [-4.5606, 48.2588], [-4.5693, 48.2938],
  [-4.5217, 48.2975], [-4.2773, 48.2966], [-4.1770, 48.2452],
  [-4.2303, 48.2566], [-4.2448, 48.3063], [-4.3262, 48.3198],
  [-4.3291, 48.3485], [-4.4239, 48.3327], [-4.2944, 48.4281],
  [-4.4534, 48.3816], [-4.6550, 48.3480], [-4.7560, 48.3622],
  [-4.7703, 48.4574], [-4.7726, 48.5153], [-4.7006, 48.5653],
  [-4.5235, 48.5535], [-4.5931, 48.5934], [-4.5676, 48.6117],
  [-4.4575, 48.6298], [-4.3729, 48.6689], [-4.2465, 48.6497],
  [-4.1071, 48.6945], [-4.0072, 48.7214], [-3.9522, 48.6333],
  [-3.8962, 48.6659], [-3.8567, 48.6600], [-3.7912, 48.7029],
  [-3.6488, 48.6659], [-3.5609, 48.7570], [-3.5196, 48.8190],
  [-3.4407, 48.8062], [-3.2511, 48.8517], [-3.2201, 48.7876],
  [-3.0922, 48.8680], [-3.1010, 48.7866], [-3.0183, 48.8218],
  [-2.9516, 48.7684], [-2.8624, 48.6730], [-2.7348, 48.5608],
  [-2.6382, 48.5238], [-2.4885, 48.6438], [-2.3267, 48.6803],
  [-2.2741, 48.6365], [-2.1907, 48.6073], [-2.1462, 48.6267],
  [-2.0309, 48.6044],
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
