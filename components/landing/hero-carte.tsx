'use client'

import { useEffect, useState, useRef } from 'react'

// Projection GPS -> SVG pour la Bretagne
// Bounding box: lon [-5.2, -0.9], lat [47.2, 48.95]
// Facteur de correction cos(48deg) ~ 0.67 pour compenser la deformation Mercator
function geoToSvg(lon: number, lat: number): [number, number] {
  const x = (lon + 5.2) * (460 / 2.5) + 20
  const y = 480 - (lat - 47.2) * (460 / 1.75) - 20
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
}

// Contour Bretagne (GeoJSON IGN, simplifie par mapshaper 1%)
const BRETAGNE_COORDS: [number, number][] = [
  [-2.0069, 48.5661], [-2.0622, 48.6404], [-2.1332, 48.6356],
  [-2.1608, 48.5867], [-2.2141, 48.5929], [-2.2858, 48.6677],
  [-2.3963, 48.6427], [-2.4676, 48.6500], [-2.6411, 48.5235],
  [-2.7248, 48.5469], [-2.8239, 48.5972], [-2.8282, 48.6561],
  [-3.0168, 48.7685], [-3.1117, 48.8673], [-3.2027, 48.8349],
  [-3.2577, 48.8402], [-3.3892, 48.8157], [-3.5413, 48.8227],
  [-3.5848, 48.7698], [-3.5496, 48.7467], [-3.6134, 48.6721],
  [-3.7338, 48.7088], [-3.8132, 48.7132], [-3.8544, 48.6893],
  [-3.8460, 48.6268], [-3.9505, 48.6529], [-3.9651, 48.7218],
  [-4.1805, 48.6838], [-4.2384, 48.6506], [-4.3500, 48.6765],
  [-4.4756, 48.6238], [-4.5587, 48.6233], [-4.6124, 48.5729],
  [-4.7464, 48.5465], [-4.7954, 48.4147], [-4.7227, 48.3299],
  [-4.6281, 48.3375], [-4.5011, 48.3778], [-4.4047, 48.3236],
  [-4.3632, 48.3466], [-4.3071, 48.2975], [-4.4099, 48.2760],
  [-4.5527, 48.2943], [-4.6180, 48.2665], [-4.5640, 48.2322],
  [-4.4484, 48.2356], [-4.3029, 48.1939], [-4.2705, 48.1350],
  [-4.3070, 48.0892], [-4.3625, 48.1093], [-4.4893, 48.0862],
  [-4.7134, 48.0602], [-4.6985, 48.0265], [-4.5493, 48.0121],
  [-4.4509, 47.9811], [-4.3921, 47.9315], [-4.3489, 47.8316],
  [-4.2678, 47.7903], [-4.1764, 47.8051], [-4.1636, 47.8492],
  [-4.0687, 47.8643], [-3.9802, 47.8543], [-3.9597, 47.8970],
  [-3.8398, 47.7963], [-3.5286, 47.7654], [-3.4528, 47.6953],
  [-3.2922, 47.7031], [-3.1233, 47.5695], [-3.0427, 47.5789],
  [-2.9684, 47.5572], [-2.8482, 47.6179], [-2.7782, 47.6187],
  [-2.6900, 47.5896], [-2.7308, 47.5423], [-2.8752, 47.5344],
  [-2.8153, 47.4866], [-2.6826, 47.4954], [-2.6160, 47.5450],
  [-2.4415, 47.4990], [-2.4794, 47.4418], [-2.3119, 47.4652],
  [-2.0985, 47.5340], [-2.0970, 47.6314], [-2.0391, 47.6695],
  [-1.8640, 47.7070], [-1.7716, 47.6983], [-1.6694, 47.7125],
  [-1.6199, 47.7643], [-1.3891, 47.8279], [-1.3651, 47.7991],
  [-1.2459, 47.7767], [-1.1890, 47.8670], [-1.1565, 47.9643],
  [-1.1080, 47.9894], [-1.0228, 47.9942], [-1.0216, 48.0680],
  [-1.0498, 48.0904], [-1.1013, 48.2662], [-1.0451, 48.3282],
  [-1.0836, 48.4337], [-1.0702, 48.5085], [-1.1699, 48.5311],
  [-1.2723, 48.5339], [-1.3799, 48.4561], [-1.4952, 48.5069],
  [-1.5711, 48.6264], [-1.7740, 48.6035], [-1.8720, 48.6471],
  [-1.8501, 48.6994], [-1.9860, 48.6812], [-2.0249, 48.6374],
]

// Belle-Ile-en-Mer
const BELLE_ILE_COORDS: [number, number][] = [
  [-3.2355, 47.3238], [-3.2539, 47.3375], [-3.2635, 47.3523],
  [-3.2561, 47.3733], [-3.2472, 47.3875], [-3.2186, 47.3759],
  [-3.1997, 47.3702], [-3.1661, 47.3623], [-3.1513, 47.3455],
  [-3.1316, 47.3280], [-3.0905, 47.3162], [-3.0582, 47.3117],
  [-3.0722, 47.2950], [-3.0918, 47.2784], [-3.1123, 47.2877],
  [-3.1397, 47.2860], [-3.1643, 47.2978], [-3.1823, 47.2959],
  [-3.2064, 47.2963], [-3.2250, 47.3002], [-3.2449, 47.3107],
]

// Ouessant
const OUESSANT_COORDS: [number, number][] = [
  [-5.1026, 48.4361], [-5.1125, 48.4385], [-5.0979, 48.4451],
  [-5.1054, 48.4552], [-5.1269, 48.4494], [-5.1333, 48.4556],
  [-5.1179, 48.4633], [-5.1049, 48.4723], [-5.0829, 48.4724],
  [-5.0762, 48.4806], [-5.0525, 48.4777], [-5.0538, 48.4650],
  [-5.0378, 48.4641], [-5.0509, 48.4576], [-5.0654, 48.4503],
  [-5.0831, 48.4481], [-5.1010, 48.4386],
]

// Groix
const GROIX_COORDS: [number, number][] = [
  [-3.4218, 47.6200], [-3.4327, 47.6235], [-3.4405, 47.6280],
  [-3.4505, 47.6234], [-3.4626, 47.6202], [-3.4764, 47.6273],
  [-3.4857, 47.6295], [-3.4925, 47.6324], [-3.5063, 47.6397],
  [-3.5151, 47.6471], [-3.5025, 47.6532], [-3.4822, 47.6504],
  [-3.4703, 47.6491], [-3.4547, 47.6452], [-3.4375, 47.6441],
  [-3.4234, 47.6381], [-3.4154, 47.6314], [-3.4214, 47.6223],
]

function coordsToPath(coords: [number, number][]): string {
  const points = coords.map(([lon, lat]) => geoToSvg(lon, lat))
  return 'M' + points.map(([x, y]) => `${x} ${y}`).join(' L') + ' Z'
}

const BRETAGNE_PATH = coordsToPath(BRETAGNE_COORDS)
const BELLE_ILE_PATH = coordsToPath(BELLE_ILE_COORDS)
const OUESSANT_PATH = coordsToPath(OUESSANT_COORDS)
const GROIX_PATH = coordsToPath(GROIX_COORDS)

// Test point-in-polygon (ray casting)
function isInPolygon(lon: number, lat: number, poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

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
    // Filtrer les villes reellement dans le contour de la Bretagne
    const bretagneVilles = villes.filter(
      (v) => isInPolygon(v.lon, v.lat, BRETAGNE_COORDS)
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
      <svg viewBox="-30 -20 850 560" className="w-full h-auto" aria-hidden="true">
        {/* Contour Bretagne */}
        <path
          ref={pathRef}
          d={BRETAGNE_PATH}
          fill="none"
          stroke="black"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Iles */}
        <path d={BELLE_ILE_PATH} fill="none" stroke="black" strokeWidth={1.2} strokeLinejoin="round" />
        <path d={OUESSANT_PATH} fill="none" stroke="black" strokeWidth={1.2} strokeLinejoin="round" />
        <path d={GROIX_PATH} fill="none" stroke="black" strokeWidth={1.2} strokeLinejoin="round" />

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
